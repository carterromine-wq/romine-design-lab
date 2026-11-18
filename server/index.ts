import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { DatabaseSync, backup } from 'node:sqlite';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, readFile, stat, unlink } from 'node:fs/promises';
import { resolve, extname, sep, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { lessons, type Lesson } from '../course-data';
import { videoDurations } from './video-durations';
import {
  emptyProgress, emptyProgressRecord, decodeStoredProgress, validateProgressPatch,
  mergeProgress, lessonUnlocked, maximumStep, assertSequentialPatch, ProgressValidationError,
  type LessonProgress, type ProgressRecord,
} from '../src/progress-model';

const scrypt = promisify(scryptCallback);
const SESSION_MS = 1000 * 60 * 60 * 24 * 7;
const BODY_LIMIT = 65_536;
const COOKIE = 'romine_session';
const lessonMap = new Map(lessons.map(lesson => [lesson.id, lesson]));
const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,39}$/;
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
type UserRow = { id: string; username: string; display_name: string; password_hash: string; role: 'teacher' | 'student'; disabled: number; created_at: string };
type SessionRow = { token_hash: string; user_id: string; expires_at: number };
type PlaybackRow = { token_hash: string; session_hash: string; user_id: string; lesson_id: string; last_at: number; last_position: number; last_state: string; last_visible: number };
type PublicUser = { id: string; username: string; displayName: string; role: 'teacher' | 'student' };
type AppOptions = { dataDir?: string; teacherUsername?: string; teacherPassword?: string; production?: boolean; publicOrigin?: string; clientDir?: string; now?: () => number };

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function publicUser(user: UserRow): PublicUser {
  return { id: user.id, username: user.username, displayName: user.display_name, role: user.role };
}
function tokenHash(token: string): string { return createHash('sha256').update(token).digest('hex'); }
function object(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function newPassword(): string {
  // Rejection sampling avoids modulo bias and confusing characters on printed login cards.
  let password = '';
  const max = Math.floor(256 / PASSWORD_ALPHABET.length) * PASSWORD_ALPHABET.length;
  while (password.length < 14) for (const byte of randomBytes(24)) {
    if (byte < max && password.length < 14) password += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
  }
  return password;
}
async function passwordHash(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}
async function passwordMatches(password: string, encoded: string): Promise<boolean> {
  const [scheme, salt, hex] = encoded.split('$');
  if (scheme !== 'scrypt' || !salt || !/^[a-f0-9]{128}$/.test(hex || '')) return false;
  const derived = await scrypt(password, salt, 64) as Buffer;
  return timingSafeEqual(derived, Buffer.from(hex, 'hex'));
}
function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > BODY_LIMIT) { req.resume(); return Promise.reject(new HttpError(413, 'The request is too large.')); }
  return new Promise((resolveBody, reject) => {
    const parts: Buffer[] = []; let size = 0; let failed = false;
    req.on('data', chunk => {
      if (failed) return;
      size += chunk.length;
      if (size > BODY_LIMIT) { failed = true; reject(new HttpError(413, 'The request is too large.')); return; }
      parts.push(Buffer.from(chunk));
    });
    req.on('error', () => reject(new HttpError(400, 'Could not read the request.')));
    req.on('end', () => {
      if (failed) return;
      try {
        const parsed = JSON.parse(Buffer.concat(parts).toString('utf8') || '{}');
        if (!object(parsed)) throw new Error();
        resolveBody(parsed);
      } catch { reject(new HttpError(400, 'Send a valid JSON object.')); }
    });
  });
}
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
function validateStudent(input: unknown): {username: string; displayName: string} {
  if (!object(input) || typeof input.username !== 'string' || typeof input.displayName !== 'string') throw new HttpError(400, 'Each student needs a username and display name.');
  const username = input.username.trim().toLowerCase();
  const displayName = input.displayName.trim();
  if (!usernamePattern.test(username)) throw new HttpError(400, 'Usernames must be 3–40 characters: letters, numbers, dots, dashes, or underscores.');
  if (displayName.length < 1 || displayName.length > 80) throw new HttpError(400, 'Display names must be 1–80 characters.');
  return { username, displayName };
}

export async function createApp(options: AppOptions = {}) {
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const dataDir = resolve(options.dataDir || process.env.DATA_DIR || './data');
  if (production && !options.dataDir && !process.env.DATA_DIR) throw new Error('DATA_DIR must point to persistent storage in production.');
  const teacherUsername = (options.teacherUsername || process.env.TEACHER_USERNAME || 'mrromine').toLowerCase();
  const teacherPassword = options.teacherPassword || process.env.TEACHER_PASSWORD || '';
  if (!usernamePattern.test(teacherUsername)) throw new Error('TEACHER_USERNAME must be a valid 3–40 character username.');
  if (teacherPassword.length < 12 || teacherPassword.length > 256) throw new Error('Set TEACHER_PASSWORD to a unique password of 12–256 characters.');
  const rawOrigin = options.publicOrigin || process.env.PUBLIC_ORIGIN || process.env.RENDER_EXTERNAL_URL;
  if (production && !rawOrigin) throw new Error('Set PUBLIC_ORIGIN to the HTTPS app URL (Render supplies RENDER_EXTERNAL_URL automatically).');
  const publicOrigin = rawOrigin ? new URL(rawOrigin).origin : null;
  if (production && publicOrigin && !publicOrigin.startsWith('https://')) throw new Error('The production origin must use HTTPS.');
  const clientDir = resolve(options.clientDir || './dist/client');
  const now = options.now || Date.now;
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(resolve(dataDir, 'course.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      display_name TEXT NOT NULL, password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('teacher','student')), disabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS lesson_progress (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY(user_id,lesson_id)
    );
    CREATE TABLE IF NOT EXISTS course_position (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      lesson_id TEXT NOT NULL, step INTEGER NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS playback_sessions (
      token_hash TEXT PRIMARY KEY, session_hash TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id TEXT NOT NULL, last_at INTEGER NOT NULL, last_position REAL NOT NULL,
      last_state TEXT NOT NULL, last_visible INTEGER NOT NULL,
      UNIQUE(user_id,lesson_id)
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT NOT NULL,
      student_id TEXT, action TEXT NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL
    );
  `);
  const isoNow = () => new Date(now()).toISOString();
  let teacher = db.prepare("SELECT * FROM users WHERE role='teacher' LIMIT 1").get() as UserRow | undefined;
  if (!teacher) {
    db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)')
      .run(randomUUID(), teacherUsername, 'Mr. Romine', await passwordHash(teacherPassword), 'teacher', isoNow());
  } else {
    const changed = !await passwordMatches(teacherPassword, teacher.password_hash);
    if (changed || teacher.username !== teacherUsername) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const hash = changed ? await passwordHash(teacherPassword) : teacher.password_hash;
        db.prepare('UPDATE users SET username=?, password_hash=?, disabled=0 WHERE id=?').run(teacherUsername, hash, teacher.id);
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(teacher.id);
        db.prepare('DELETE FROM playback_sessions WHERE user_id=?').run(teacher.id);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }
  }
  // Unknown usernames take the same expensive password check as real usernames.
  const dummyHash = await passwordHash(randomBytes(32).toString('hex'));
  const rates = new Map<string, { count: number; until: number }>();
  function rate(key: string, limit: number, interval: number): void {
    if (rates.size > 5000) for (const [k, value] of rates) if (value.until <= now()) rates.delete(k);
    const previous = rates.get(key);
    const bucket = previous && previous.until > now() ? previous : { count: 0, until: now() + interval };
    bucket.count++; rates.set(key, bucket);
    if (bucket.count > limit) throw new HttpError(429, 'Too many attempts. Wait a few minutes and try again.');
  }
  function readProgress(userId: string): ProgressRecord {
    const record = emptyProgressRecord();
    const rows = db.prepare('SELECT lesson_id,data,updated_at FROM lesson_progress WHERE user_id=?').all(userId) as {lesson_id:string;data:string;updated_at:string}[];
    for (const row of rows) if (lessonMap.has(row.lesson_id)) record.lessons[row.lesson_id] = decodeStoredProgress(row.data, row.updated_at);
    const position = db.prepare('SELECT lesson_id,step,updated_at FROM course_position WHERE user_id=?').get(userId) as {lesson_id:string;step:number;updated_at:string}|undefined;
    if (position) { record.lastLessonId = position.lesson_id; record.lastStep = position.step; record.updatedAt = position.updated_at; }
    return record;
  }
  function saveProgress(userId: string, lessonId: string, progress: LessonProgress): void {
    const timestamp = progress.updatedAt || isoNow();
    const previous = db.prepare('SELECT data,updated_at FROM lesson_progress WHERE user_id=? AND lesson_id=?').get(userId, lessonId) as {data:string;updated_at:string}|undefined;
    const oldRevision = previous ? decodeStoredProgress(previous.data, previous.updated_at).revision : 0;
    progress.revision = (Number.isSafeInteger(oldRevision) && oldRevision >= 0 ? oldRevision : 0) + 1;
    db.prepare('INSERT INTO lesson_progress(user_id,lesson_id,data,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,lesson_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at')
      .run(userId, lessonId, JSON.stringify(progress), timestamp);
    db.prepare('INSERT INTO course_position(user_id,lesson_id,step,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET lesson_id=excluded.lesson_id,step=excluded.step,updated_at=excluded.updated_at')
      .run(userId, lessonId, progress.currentStep, timestamp);
  }
  function session(req: IncomingMessage): { user: UserRow; hash: string } | null {
    const cookies = req.headers.cookie || '';
    const token = cookies.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const hash = tokenHash(token);
    const stored = db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?').get(hash, now()) as SessionRow | undefined;
    if (!stored) return null;
    const user = db.prepare('SELECT * FROM users WHERE id=? AND disabled=0').get(stored.user_id) as UserRow | undefined;
    return user ? { user, hash } : null;
  }
  function signedIn(req: IncomingMessage) {
    const found = session(req);
    if (!found) throw new HttpError(401, 'Your session has ended. Sign in again to continue.');
    return found;
  }
  function teacherOnly(req: IncomingMessage) {
    const found = signedIn(req);
    if (found.user.role !== 'teacher') throw new HttpError(403, 'Teacher access is required.');
    return found;
  }
  function originGuard(req: IncomingMessage): void {
    if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new HttpError(415, 'Use application/json for this request.');
    const expected = publicOrigin || `http://${req.headers.host}`;
    if (req.headers.origin !== expected || req.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403, 'This request must come from the classroom app. Refresh the page and try again.');
  }
  function gatedLesson(userId: string, value: unknown): { lesson: Lesson; record: ProgressRecord; progress: LessonProgress } {
    if (typeof value !== 'string' || !lessonMap.has(value)) throw new HttpError(404, 'This lesson does not exist.');
    const lesson = lessonMap.get(value)!; const record = readProgress(userId);
    if (!lessonUnlocked(lessons, record, lesson.id)) throw new HttpError(403, 'Complete the previous lesson before opening this one.');
    return { lesson, record, progress: record.lessons[lesson.id] || emptyProgress() };
  }
  function audit(actor: string, student: string | null, action: string, details: unknown) {
    db.prepare('INSERT INTO audit_log(actor_id,student_id,action,details,created_at) VALUES(?,?,?,?,?)')
      .run(actor, student, action, JSON.stringify(details), isoNow());
  }
  function findStudent(id: string): UserRow {
    const user = db.prepare("SELECT * FROM users WHERE id=? AND role='student'").get(id) as UserRow | undefined;
    if (!user) throw new HttpError(404, 'Student account not found.');
    return user;
  }
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://i.ytimg.com; frame-src https://www.youtube-nocookie.com https://www.youtube.com; connect-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  };
  async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    for (const [key, value] of Object.entries(securityHeaders)) res.setHeader(key, value);
    if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      const path = url.pathname;
      const method = req.method || 'GET';
      if (path.startsWith('/api/') && !['GET','HEAD'].includes(method)) originGuard(req);
      if (path === '/api/health' && method === 'GET') { db.prepare('SELECT 1').get(); json(res, 200, { ok: true }); return; }
      if (path === '/api/auth/me' && method === 'GET') { const found = session(req); json(res, 200, { user: found ? publicUser(found.user) : null }); return; }
      if (path === '/api/auth/login' && method === 'POST') {
        const body = await readBody(req);
        if (typeof body.username !== 'string' || typeof body.password !== 'string' || body.password.length > 256 || body.username.length > 80) throw new HttpError(400, 'Enter your username and password.');
        const username = body.username.trim().toLowerCase();
        const peer = req.socket.remoteAddress || 'unknown';
        rate(`login-global:${peer}`, 100, 5 * 60_000);
        rate(`login-user:${username}`, 12, 15 * 60_000);
        const user = db.prepare('SELECT * FROM users WHERE username=?').get(username) as UserRow | undefined;
        const match = await passwordMatches(body.password, user?.password_hash || dummyHash);
        // Password checks await a worker. Re-read before issuing a session so a reset/disable
        // completed during that await cannot be bypassed with the old credentials.
        const fresh = user ? db.prepare('SELECT * FROM users WHERE id=?').get(user.id) as UserRow | undefined : undefined;
        if (!user || !match || !fresh || fresh.disabled || fresh.password_hash !== user.password_hash || fresh.username !== user.username) throw new HttpError(401, 'The username or password is incorrect, or this account is unavailable. Ask Mr. Romine if you need help.');
        rates.delete(`login-user:${username}`);
        const token = randomBytes(32).toString('hex');
        db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now());
        db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(tokenHash(token), user.id, now()+SESSION_MS);
        // Bound each account to a small number of simultaneous signed-in devices.
        db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=? ORDER BY expires_at DESC LIMIT 8)').run(user.id,user.id);
        res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1000}${production ? '; Secure' : ''}`);
        json(res, 200, { user: publicUser(user) }); return;
      }
      if (path === '/api/auth/logout' && method === 'POST') {
        const found = session(req);
        if (found) { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(found.hash); db.prepare('DELETE FROM playback_sessions WHERE session_hash=?').run(found.hash); }
        res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${production ? '; Secure' : ''}`);
        json(res, 200, { ok: true }); return;
      }
      if (path === '/api/progress' && method === 'GET') { const { user } = signedIn(req); json(res, 200, readProgress(user.id)); return; }
      if (path === '/api/progress' && method === 'PUT') {
        signedIn(req); const body = await readBody(req); const { user } = signedIn(req);
        const { lesson, progress } = gatedLesson(user.id, body.lessonId);
        const patch = validateProgressPatch(lesson, body.patch);
        assertSequentialPatch(lesson, progress, patch);
        const updatedAt = isoNow(); const next = mergeProgress(lesson, progress, patch, updatedAt);
        saveProgress(user.id, lesson.id, next);
        json(res, 200, { lessonId: lesson.id, progress: next, updatedAt }); return;
      }
      if (path === '/api/video/start' && method === 'POST') {
        signedIn(req); const body = await readBody(req); const { user, hash } = signedIn(req);
        const { lesson, progress } = gatedLesson(user.id, body.lessonId);
        if (!progress.read) throw new HttpError(403, 'Finish Learn before watching the tutorial.');
        const duration = videoDurations[lesson.id];
        if (!Number.isFinite(duration) || duration < 1) throw new HttpError(503, 'This tutorial needs a verified duration. Please ask Mr. Romine.');
        const token = randomBytes(32).toString('hex');
        db.prepare('DELETE FROM playback_sessions WHERE user_id=? AND lesson_id=?').run(user.id, lesson.id);
        db.prepare('INSERT INTO playback_sessions(token_hash,session_hash,user_id,lesson_id,last_at,last_position,last_state,last_visible) VALUES(?,?,?,?,?,?,?,?)')
          .run(tokenHash(token), hash, user.id, lesson.id, now(), progress.verifiedSeconds, 'paused', 1);
        const next = { ...progress, videoDuration: duration, updatedAt: isoNow() };
        saveProgress(user.id, lesson.id, next);
        json(res, 200, { token, verifiedSeconds: next.verifiedSeconds, duration, watched: next.watched, progress: next }); return;
      }
      if (path === '/api/video/heartbeat' && method === 'POST') {
        signedIn(req); const body = await readBody(req); const { user, hash } = signedIn(req);
        const { lesson, progress } = gatedLesson(user.id, body.lessonId);
        const duration = videoDurations[lesson.id];
        if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) throw new HttpError(400, 'Start the tutorial before recording playback.');
        if (typeof body.position !== 'number' || !Number.isFinite(body.position) || body.position < 0 || body.position > duration + 2) throw new HttpError(400, 'Invalid playback position.');
        if (!['playing','paused','buffering','ended'].includes(String(body.state)) || typeof body.visible !== 'boolean') throw new HttpError(400, 'Invalid playback status.');
        const row = db.prepare('SELECT * FROM playback_sessions WHERE token_hash=? AND user_id=? AND lesson_id=? AND session_hash=?')
          .get(tokenHash(body.token), user.id, lesson.id, hash) as PlaybackRow | undefined;
        if (!row || now() - row.last_at > 30 * 60_000) throw new HttpError(409, 'The video session ended or opened in another tab. Reload this lesson to continue from your saved place.');
        const position = Math.min(duration, body.position);
        const elapsed = Math.max(0, (now()-row.last_at)/1000);
        const delta = position-row.last_position;
        let verified = progress.verifiedSeconds;
        let seekTo: number | undefined;
        if (!progress.watched && position > verified) {
          const contiguous = row.last_position <= verified + 0.75;
          const plausible = delta >= -0.25 && delta <= elapsed + 0.75;
          const playingInterval = row.last_state === 'playing' && row.last_visible === 1 && body.visible;
          if (contiguous && plausible && playingInterval && elapsed <= 10) {
            // A wall-clock cap prevents fast playback and repeated forged leaps from adding time.
            verified = Math.min(duration, position, verified + elapsed);
          } else if (position > verified + 0.75) seekTo = verified;
        }
        // Precise official media duration plus a sub-second allowance for the initial
        // PLAYING event and timer jitter. A natural end is still required.
        const watched = progress.watched || (body.state === 'ended' && body.visible && seekTo === undefined && verified >= duration - 0.8);
        if (watched) verified = duration;
        const next: LessonProgress = { ...progress, watched, verifiedSeconds: verified, videoDuration: duration, updatedAt: isoNow() };
        db.prepare('UPDATE playback_sessions SET last_at=?,last_position=?,last_state=?,last_visible=? WHERE token_hash=?')
          .run(now(), seekTo ?? position, String(body.state), body.visible ? 1 : 0, row.token_hash);
        saveProgress(user.id, lesson.id, next);
        json(res, 200, { verifiedSeconds: verified, duration, watched, progress: next, ...(seekTo !== undefined ? { seekTo } : {}) }); return;
      }
      if (path === '/api/admin/students' && method === 'GET') {
        teacherOnly(req);
        const students = db.prepare("SELECT * FROM users WHERE role='student' ORDER BY username COLLATE NOCASE").all() as UserRow[];
        json(res, 200, { students: students.map(user => {
          const progress = readProgress(user.id);
          return { ...publicUser(user), disabled: !!user.disabled, createdAt: user.created_at, completedLessons: lessons.filter(lesson => progress.lessons[lesson.id]?.completed).length, currentLessonId: lessons.find(lesson => !progress.lessons[lesson.id]?.completed)?.id || null, progress };
        }) }); return;
      }
      if (path === '/api/admin/students' && method === 'POST') {
        teacherOnly(req); const body = await readBody(req); const { user } = teacherOnly(req);
        if (!Array.isArray(body.students) || body.students.length < 1 || body.students.length > 100) throw new HttpError(400, 'Create between 1 and 100 student accounts at a time.');
        const students = body.students.map(validateStudent);
        if (new Set(students.map(student => student.username)).size !== students.length) throw new HttpError(409, 'Each username in this batch must be unique.');
        for (const student of students) if (db.prepare('SELECT 1 FROM users WHERE username=?').get(student.username)) throw new HttpError(409, `The username ${student.username} already exists. Nothing in this batch was created.`);
        const credentials = [];
        // Compute hashes outside a transaction so another awaited request cannot overlap a transaction.
        for (const student of students) {
          const password = newPassword();
          credentials.push({ id: randomUUID(), ...student, password, hash: await passwordHash(password) });
        }
        teacherOnly(req);
        db.exec('BEGIN IMMEDIATE');
        try {
          for (const credential of credentials) {
            db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)')
              .run(credential.id, credential.username, credential.displayName, credential.hash, 'student', isoNow());
            audit(user.id, credential.id, 'student.created', { username: credential.username });
          }
          db.exec('COMMIT');
        } catch (error) { db.exec('ROLLBACK'); throw error; }
        json(res, 201, { credentials: credentials.map(({hash: _hash, ...credential}) => credential) }); return;
      }
      const studentRoute = path.match(/^\/api\/admin\/students\/([a-f0-9-]+)(?:\/(reset-password|video-override))?$/);
      if (studentRoute && ['POST','PATCH'].includes(method)) {
        teacherOnly(req); const body = await readBody(req); const { user } = teacherOnly(req); const student = findStudent(studentRoute[1]);
        if (studentRoute[2] === 'reset-password' && method === 'POST') {
          const password = newPassword(); const hash = await passwordHash(password);
          teacherOnly(req);
          db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, student.id);
          db.prepare('DELETE FROM sessions WHERE user_id=?').run(student.id);
          db.prepare('DELETE FROM playback_sessions WHERE user_id=?').run(student.id);
          audit(user.id, student.id, 'student.password_reset', {});
          json(res, 200, { id: student.id, username: student.username, displayName: student.display_name, password }); return;
        }
        if (studentRoute[2] === 'video-override' && method === 'POST') {
          if (typeof body.reason !== 'string' || body.reason.trim().length < 8 || body.reason.length > 500) throw new HttpError(400, 'Add a reason of 8–500 characters for this video accommodation.');
          const { lesson, progress } = gatedLesson(student.id, body.lessonId);
          if (!progress.read) throw new HttpError(403, 'The student must finish Learn before a video accommodation can be recorded.');
          const next: LessonProgress = { ...progress, watched: true, videoDuration: videoDurations[lesson.id], videoOverride: { reason: body.reason.trim(), at: isoNow(), teacherId: user.id }, updatedAt: isoNow() };
          saveProgress(student.id, lesson.id, next);
          audit(user.id, student.id, 'video.accommodation', { lessonId: lesson.id, reason: body.reason.trim() });
          json(res, 200, { lessonId: lesson.id, progress: next, updatedAt: next.updatedAt }); return;
        }
        if (!studentRoute[2] && method === 'PATCH') {
          if (typeof body.disabled !== 'boolean') throw new HttpError(400, 'Choose whether this account is disabled.');
          db.prepare('UPDATE users SET disabled=? WHERE id=?').run(body.disabled ? 1 : 0, student.id);
          if (body.disabled) { db.prepare('DELETE FROM sessions WHERE user_id=?').run(student.id); db.prepare('DELETE FROM playback_sessions WHERE user_id=?').run(student.id); }
          audit(user.id, student.id, body.disabled ? 'student.disabled' : 'student.enabled', {});
          json(res, 200, { ok: true }); return;
        }
      }
      if (path === '/api/admin/backup' && method === 'GET') {
        const { user } = teacherOnly(req);
        rate(`backup:${user.id}`, 5, 60_000);
        const path = resolve(dataDir, `backup-${randomUUID()}.sqlite`);
        try {
          await backup(db, path);
          const bytes = await readFile(path);
          res.writeHead(200, { 'Content-Type': 'application/vnd.sqlite3', 'Content-Disposition': `attachment; filename="romine-course-${isoNow().slice(0,10)}.sqlite"`, 'Cache-Control': 'no-store' });
          res.end(bytes);
        } finally { await unlink(path).catch(() => {}); }
        return;
      }
      if (path.startsWith('/api/')) throw new HttpError(404, 'This API route does not exist.');
      if (!['GET','HEAD'].includes(method)) throw new HttpError(405, 'Method not allowed.');
      let decoded: string;
      try { decoded = decodeURIComponent(path); } catch { throw new HttpError(400, 'Invalid URL.'); }
      if (decoded.includes('\0') || decoded.split('/').some(part => part.startsWith('.'))) throw new HttpError(404, 'Not found.');
      let filePath = resolve(clientDir, `.${decoded}`);
      if (filePath !== clientDir && !filePath.startsWith(`${clientDir}${sep}`)) throw new HttpError(404, 'Not found.');
      let fileStat = await stat(filePath).catch(() => null);
      if (!fileStat?.isFile()) {
        if (extname(path)) throw new HttpError(404, 'Not found.');
        filePath = resolve(clientDir, 'index.html'); fileStat = await stat(filePath).catch(() => null);
      }
      if (!fileStat?.isFile()) throw new HttpError(503, 'Build the frontend with npm run build before starting the app.');
      const types: Record<string,string> = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2','.json':'application/json'};
      res.writeHead(200, { 'Content-Type': types[extname(filePath)] || 'application/octet-stream', 'Content-Length': fileStat.size, 'Cache-Control': filePath.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache' });
      res.end(method === 'HEAD' ? undefined : await readFile(filePath));
    } catch (error) {
      if (res.headersSent) { res.end(); return; }
      if (error instanceof HttpError || error instanceof ProgressValidationError) json(res, error.status, { error: error.message });
      else if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) json(res, 409, {error: 'That username was just taken. Refresh the roster and try again.'});
      else { console.error('Request failed:', error instanceof Error ? error.name : 'Unknown error'); json(res, 500, { error: 'The server could not finish this request. Please try again.' }); }
    }
  }
  const server = createServer((req, res) => { void handler(req, res); });
  server.requestTimeout = 30_000; server.headersTimeout = 15_000;
  return { server, db, handler, async close() { if (server.listening) await new Promise<void>((resolveClose,reject) => server.close(error => error ? reject(error) : resolveClose())); db.close(); } };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const app = await createApp();
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
  app.server.listen(port, '0.0.0.0', () => console.log(`Mr. Romine’s Technology Class is listening on port ${port}.`));
  for (const signal of ['SIGTERM','SIGINT'] as const) process.once(signal, () => { void app.close().then(() => process.exit(0)); });
}
