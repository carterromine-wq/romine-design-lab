import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { DatabaseSync, backup } from 'node:sqlite';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, readFile, stat, unlink } from 'node:fs/promises';
import { resolve, extname, sep, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { lessons, type Lesson } from '../course-data';
import { videoDurations } from './video-durations';
import { createGoogleCredentialVerifier, type GoogleCredentialVerifier, type GoogleIdentity } from './google-auth';
import {
  emptyProgress, emptyProgressRecord, decodeStoredProgress, validateProgressPatch,
  mergeProgress, lessonUnlocked, maximumStep, assertSequentialPatch, ProgressValidationError,
  type LessonProgress, type ProgressRecord,
} from '../src/progress-model';

const scrypt = promisify(scryptCallback);
const SESSION_MS = 1000 * 60 * 60 * 24 * 7;
const BODY_LIMIT = 65_536;
const COOKIE = 'romine_session';
const GOOGLE_COOKIE = 'romine_google_challenge';
const GOOGLE_CHALLENGE_MS = 10 * 60_000;
const CLASS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const lessonMap = new Map(lessons.map(lesson => [lesson.id, lesson]));
const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,39}$/;
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
type UserRow = { id: string; username: string; display_name: string; password_hash: string; role: 'teacher' | 'student'; disabled: number; created_at: string };
type SessionRow = { token_hash: string; user_id: string; expires_at: number };
type PlaybackRow = { token_hash: string; session_hash: string; user_id: string; lesson_id: string; last_at: number; last_position: number; last_state: string; last_visible: number };
type PublicUser = { id: string; username: string; displayName: string; role: 'teacher' | 'student'; googleLinked: boolean; googleEmail: string | null };
type EnrollmentRow = { id: number; enabled: number; join_code: string };
type GoogleAccountRow = { user_id: string; subject: string; email: string };
type GoogleChallengeRow = { token_hash: string; nonce_hash: string; intent: 'signin' | 'link'; user_id: string | null; session_hash: string | null; expires_at: number };
type AppOptions = { dataDir?: string; teacherUsername?: string; teacherPassword?: string; production?: boolean; publicOrigin?: string; clientDir?: string; now?: () => number; googleClientId?: string; googleAllowedDomain?: string; verifyGoogleCredential?: GoogleCredentialVerifier };

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function tokenHash(token: string): string { return createHash('sha256').update(token).digest('hex'); }
function secureEqual(left: string, right: string): boolean { return timingSafeEqual(Buffer.from(tokenHash(left), 'hex'), Buffer.from(tokenHash(right), 'hex')); }
function readCookie(req: IncomingMessage, name: string): string | undefined {
  return (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
}
function appendCookie(res: ServerResponse, value: string): void {
  const existing = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(Array.isArray(existing) ? existing.map(String) : existing ? [String(existing)] : []), value]);
}
function newClassCode(): string {
  // Ten characters from a 32-character alphabet provide 50 bits of entropy.
  return [...randomBytes(10)].map(byte => CLASS_CODE_ALPHABET[byte & 31]).join('');
}
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
  const requestedGoogleClientId = (options.googleClientId ?? process.env.GOOGLE_CLIENT_ID ?? '').trim();
  const requestedGoogleDomain = (options.googleAllowedDomain ?? process.env.GOOGLE_ALLOWED_DOMAIN ?? '').trim().toLowerCase();
  const validGoogleId = /^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(requestedGoogleClientId);
  const validGoogleDomain = !requestedGoogleDomain || (requestedGoogleDomain.length <= 253 && requestedGoogleDomain.includes('.') && requestedGoogleDomain.split('.').every(part => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part)));
  const googleEnabled = validGoogleId && validGoogleDomain;
  const googleClientId = googleEnabled ? requestedGoogleClientId : null;
  const googleDomain = validGoogleDomain && requestedGoogleDomain ? requestedGoogleDomain : null;
  if ((requestedGoogleClientId && !validGoogleId) || !validGoogleDomain) console.warn('Google sign-in is disabled. Check GOOGLE_CLIENT_ID and GOOGLE_ALLOWED_DOMAIN.');
  const verifyGoogleCredential = options.verifyGoogleCredential || createGoogleCredentialVerifier();
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
    CREATE TABLE IF NOT EXISTS enrollment_settings (
      id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
      join_code TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS google_accounts (
      user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject TEXT PRIMARY KEY, email TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS google_challenges (
      token_hash TEXT PRIMARY KEY, nonce_hash TEXT NOT NULL,
      intent TEXT NOT NULL CHECK(intent IN ('signin','link')),
      user_id TEXT, session_hash TEXT, expires_at INTEGER NOT NULL
    );
  `);
  db.prepare('INSERT OR IGNORE INTO enrollment_settings(id,enabled,join_code) VALUES(1,1,?)').run(newClassCode());
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
  function publicUser(user: UserRow): PublicUser {
    const google = db.prepare('SELECT email FROM google_accounts WHERE user_id=?').get(user.id) as { email: string } | undefined;
    return { id: user.id, username: user.username, displayName: user.display_name, role: user.role, googleLinked: !!google, googleEmail: google?.email || null };
  }
  function enrollment() {
    const settings = db.prepare('SELECT * FROM enrollment_settings WHERE id=1').get() as EnrollmentRow;
    return { enabled: !!settings.enabled, joinCode: settings.join_code, googleEnabled, googleDomain };
  }
  function requireEnrollment(classCode: unknown, peer: string): void {
    const settings = enrollment();
    if (!settings.enabled) throw new HttpError(403, 'Student sign-ups are closed. Ask Mr. Romine for help.');
    const normalized = typeof classCode === 'string' && classCode.length <= 80 ? classCode.replace(/[\s-]/g, '').toUpperCase() : '';
    if (!secureEqual(normalized, settings.joinCode)) {
      rate(`enrollment-invalid:${peer}`, 40, 5 * 60_000);
      throw new HttpError(403, 'That class code is not valid. Ask Mr. Romine for the current code.');
    }
  }
  function googleChallengeContext(req: IncomingMessage, challenge: GoogleChallengeRow): UserRow | null {
    if (challenge.expires_at <= now()) throw new HttpError(401, 'Google sign-in expired. Try the Google button again.');
    const found = session(req);
    if (challenge.intent === 'link') {
      if (!found || found.user.role !== 'student' || found.user.id !== challenge.user_id || found.hash !== challenge.session_hash) throw new HttpError(401, 'Your account session changed. Sign in again before connecting Google.');
      return found.user;
    }
    if (found) throw new HttpError(409, 'You are already signed in. Use Connect Google from your account instead.');
    return null;
  }
  function validateGoogleIdentity(identity: GoogleIdentity, challenge: GoogleChallengeRow): void {
    if (!object(identity) || typeof identity.sub !== 'string' || !identity.sub || identity.sub.length > 255 || typeof identity.email !== 'string' || identity.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email) || identity.email_verified !== true) throw new HttpError(401, 'Google could not verify this account. Try another school-approved account.');
    if (typeof identity.nonce !== 'string' || !secureEqual(tokenHash(identity.nonce), challenge.nonce_hash)) throw new HttpError(401, 'Google sign-in could not be matched to this browser. Try again.');
    // Google Workspace membership is represented by hd, not the email suffix.
    if (googleDomain && (typeof identity.hd !== 'string' || identity.hd.toLowerCase() !== googleDomain)) throw new HttpError(403, 'Use the school Google account approved for this class.');
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
    const token = readCookie(req, COOKIE);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const hash = tokenHash(token);
    const stored = db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?').get(hash, now()) as SessionRow | undefined;
    if (!stored) return null;
    const user = db.prepare('SELECT * FROM users WHERE id=? AND disabled=0').get(stored.user_id) as UserRow | undefined;
    return user ? { user, hash } : null;
  }
  function issueSession(req: IncomingMessage, res: ServerResponse, userId: string): void {
    const previous = session(req);
    if (previous) {
      db.prepare('DELETE FROM sessions WHERE token_hash=?').run(previous.hash);
      db.prepare('DELETE FROM playback_sessions WHERE session_hash=?').run(previous.hash);
    }
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now());
    db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(tokenHash(token), userId, now() + SESSION_MS);
    db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=? ORDER BY expires_at DESC,rowid DESC LIMIT 8)').run(userId, userId);
    appendCookie(res, `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1000}${production ? '; Secure' : ''}`);
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
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' https://www.youtube.com https://s.ytimg.com https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; img-src 'self' data: https://i.ytimg.com; frame-src https://www.youtube-nocookie.com https://www.youtube.com https://accounts.google.com/gsi/; connect-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://accounts.google.com/gsi/; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
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
      if (path === '/api/auth/options' && method === 'GET') {
        json(res, 200, { registrationEnabled: enrollment().enabled, googleEnabled, googleClientId, googleDomain }); return;
      }
      if (path === '/api/auth/register' && method === 'POST') {
        const body = await readBody(req);
        if (session(req)) throw new HttpError(409, 'Sign out before creating a new student account.');
        const peer = req.socket.remoteAddress || 'unknown';
        rate(`registration:${peer}`, 120, 5 * 60_000);
        const student = validateStudent(body);
        if (typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 128) throw new HttpError(400, 'Choose a password with 10–128 characters.');
        requireEnrollment(body.classCode, peer);
        if (db.prepare('SELECT 1 FROM users WHERE username=?').get(student.username)) throw new HttpError(409, 'That username is already in use. Sign in or choose another username.');
        const hash = await passwordHash(body.password);
        // Enrollment may be closed or its code rotated during password hashing.
        requireEnrollment(body.classCode, peer);
        if (session(req)) throw new HttpError(409, 'Your sign-in changed. Refresh the page before creating another account.');
        const id = randomUUID();
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)')
            .run(id, student.username, student.displayName, hash, 'student', isoNow());
          audit(id, id, 'student.self_registered', { method: 'password' });
          db.exec('COMMIT');
        } catch (error) { db.exec('ROLLBACK'); throw error; }
        issueSession(req, res, id);
        json(res, 201, { user: publicUser(findStudent(id)) }); return;
      }
      if (path === '/api/auth/google/challenge' && method === 'POST') {
        if (!googleEnabled) throw new HttpError(503, 'Google sign-in is not set up yet. Use your course username and password.');
        const body = await readBody(req);
        if (body.intent !== 'signin' && body.intent !== 'link') throw new HttpError(400, 'Choose whether to sign in or connect Google.');
        const found = session(req);
        if (body.intent === 'link' && (!found || found.user.role !== 'student')) throw new HttpError(403, 'Sign in to your student account before connecting Google.');
        if (body.intent === 'signin' && found) throw new HttpError(409, 'You are already signed in. Use Connect Google from your account instead.');
        rate(`google-challenge:${req.socket.remoteAddress || 'unknown'}`, 300, 5 * 60_000);
        const oldToken = readCookie(req, GOOGLE_COOKIE);
        if (oldToken && /^[a-f0-9]{64}$/.test(oldToken)) db.prepare('DELETE FROM google_challenges WHERE token_hash=?').run(tokenHash(oldToken));
        db.prepare('DELETE FROM google_challenges WHERE expires_at<=?').run(now());
        const token = randomBytes(32).toString('hex');
        const nonce = randomBytes(32).toString('hex');
        db.prepare('INSERT INTO google_challenges(token_hash,nonce_hash,intent,user_id,session_hash,expires_at) VALUES(?,?,?,?,?,?)')
          .run(tokenHash(token), tokenHash(nonce), body.intent, body.intent === 'link' ? found!.user.id : null, body.intent === 'link' ? found!.hash : null, now() + GOOGLE_CHALLENGE_MS);
        appendCookie(res, `${GOOGLE_COOKIE}=${token}; Path=/api/auth/google; HttpOnly; SameSite=Strict; Max-Age=${GOOGLE_CHALLENGE_MS / 1000}${production ? '; Secure' : ''}`);
        json(res, 200, { nonce }); return;
      }
      if (path === '/api/auth/google' && method === 'POST') {
        if (!googleEnabled || !googleClientId) throw new HttpError(503, 'Google sign-in is not set up yet. Use your course username and password.');
        const body = await readBody(req);
        if (typeof body.credential !== 'string' || !body.credential || body.credential.length > 16_384) throw new HttpError(400, 'Google did not return a valid sign-in response. Try again.');
        const peer = req.socket.remoteAddress || 'unknown';
        rate(`google-login:${peer}`, 200, 5 * 60_000);
        const token = readCookie(req, GOOGLE_COOKIE);
        const challenge = token && /^[a-f0-9]{64}$/.test(token) ? db.prepare('SELECT * FROM google_challenges WHERE token_hash=?').get(tokenHash(token)) as GoogleChallengeRow | undefined : undefined;
        if (!challenge) throw new HttpError(401, 'Start Google sign-in from this browser and try again.');
        // Atomically consume before network I/O so a credential response cannot be replayed.
        db.prepare('DELETE FROM google_challenges WHERE token_hash=?').run(challenge.token_hash);
        appendCookie(res, `${GOOGLE_COOKIE}=; Path=/api/auth/google; HttpOnly; SameSite=Strict; Max-Age=0${production ? '; Secure' : ''}`);
        googleChallengeContext(req, challenge);
        let identity: GoogleIdentity;
        try { identity = await verifyGoogleCredential(body.credential, googleClientId); }
        catch { throw new HttpError(401, 'Google sign-in could not be verified. Try the Google button again.'); }
        validateGoogleIdentity(identity, challenge);
        let linkingUser = googleChallengeContext(req, challenge);
        let linked = db.prepare('SELECT * FROM google_accounts WHERE subject=?').get(identity.sub) as GoogleAccountRow | undefined;
        let newPasswordHash: string | null = null;
        if (challenge.intent === 'signin' && !linked) {
          requireEnrollment(body.classCode, peer);
          // Google-only accounts have an unguessable, discarded course password. A teacher
          // can later reset it if a student needs the username/password sign-in option.
          newPasswordHash = await passwordHash(randomBytes(32).toString('hex'));
          linkingUser = googleChallengeContext(req, challenge);
          linked = db.prepare('SELECT * FROM google_accounts WHERE subject=?').get(identity.sub) as GoogleAccountRow | undefined;
        }
        const email = identity.email.trim().toLowerCase();
        let user: UserRow;
        let created = false;
        if (linked) {
          if (linkingUser && linked.user_id !== linkingUser.id) throw new HttpError(409, 'That Google account is connected to another student. Use the Google account for this course account.');
          const existing = db.prepare('SELECT * FROM users WHERE id=?').get(linked.user_id) as UserRow | undefined;
          if (!existing || existing.disabled || existing.role !== 'student') throw new HttpError(403, 'This student account is unavailable. Ask Mr. Romine for help.');
          user = existing;
          db.prepare('UPDATE google_accounts SET email=? WHERE subject=?').run(email, identity.sub);
        } else if (linkingUser) {
          if (db.prepare('SELECT 1 FROM google_accounts WHERE user_id=?').get(linkingUser.id)) throw new HttpError(409, 'This course account is already connected to a different Google account. Ask Mr. Romine for help.');
          db.prepare('INSERT INTO google_accounts(user_id,subject,email,created_at) VALUES(?,?,?,?)').run(linkingUser.id, identity.sub, email, isoNow());
          audit(linkingUser.id, linkingUser.id, 'student.google_connected', {});
          user = linkingUser;
        } else {
          requireEnrollment(body.classCode, peer);
          if (!newPasswordHash) throw new HttpError(401, 'Start Google sign-in again.');
          const id = randomUUID();
          // An independent username avoids linking or overwriting any existing account by
          // email or name. The Google subject is the only federated account identifier.
          let username = `student-${randomBytes(6).toString('hex')}`;
          while (db.prepare('SELECT 1 FROM users WHERE username=?').get(username)) username = `student-${randomBytes(6).toString('hex')}`;
          const displayName = (typeof identity.name === 'string' ? identity.name.trim().slice(0, 80) : '') || email.split('@')[0].slice(0, 80) || 'Student';
          db.exec('BEGIN IMMEDIATE');
          try {
            db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(id, username, displayName, newPasswordHash, 'student', isoNow());
            db.prepare('INSERT INTO google_accounts(user_id,subject,email,created_at) VALUES(?,?,?,?)').run(id, identity.sub, email, isoNow());
            audit(id, id, 'student.self_registered', { method: 'google' });
            db.exec('COMMIT');
          } catch (error) { db.exec('ROLLBACK'); throw error; }
          user = findStudent(id); created = true;
        }
        // Linking keeps the already authenticated session. A delayed response must not
        // install a new session cookie after another tab has signed the student out.
        if (challenge.intent === 'signin') issueSession(req, res, user.id);
        json(res, created ? 201 : 200, { user: publicUser(user) }); return;
      }
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
        issueSession(req, res, fresh.id);
        json(res, 200, { user: publicUser(fresh) }); return;
      }
      if (path === '/api/auth/logout' && method === 'POST') {
        const found = session(req);
        if (found) { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(found.hash); db.prepare('DELETE FROM playback_sessions WHERE session_hash=?').run(found.hash); }
        const challengeToken = readCookie(req, GOOGLE_COOKIE);
        if (challengeToken && /^[a-f0-9]{64}$/.test(challengeToken)) db.prepare('DELETE FROM google_challenges WHERE token_hash=?').run(tokenHash(challengeToken));
        appendCookie(res, `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${production ? '; Secure' : ''}`);
        appendCookie(res, `${GOOGLE_COOKIE}=; Path=/api/auth/google; HttpOnly; SameSite=Strict; Max-Age=0${production ? '; Secure' : ''}`);
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
      if (path === '/api/admin/enrollment' && method === 'GET') {
        teacherOnly(req); json(res, 200, enrollment()); return;
      }
      if (path === '/api/admin/enrollment' && method === 'PATCH') {
        teacherOnly(req); const body = await readBody(req); const { user } = teacherOnly(req);
        if (typeof body.enabled !== 'boolean') throw new HttpError(400, 'Choose whether student sign-ups are open.');
        db.prepare('UPDATE enrollment_settings SET enabled=? WHERE id=1').run(body.enabled ? 1 : 0);
        audit(user.id, null, body.enabled ? 'enrollment.opened' : 'enrollment.closed', {});
        json(res, 200, enrollment()); return;
      }
      if (path === '/api/admin/enrollment/rotate' && method === 'POST') {
        teacherOnly(req); await readBody(req); const { user } = teacherOnly(req);
        db.prepare('UPDATE enrollment_settings SET join_code=? WHERE id=1').run(newClassCode());
        audit(user.id, null, 'enrollment.code_rotated', {});
        json(res, 200, enrollment()); return;
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
