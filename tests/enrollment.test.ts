import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const { createApp } = await import(new URL('../dist/server.mjs', import.meta.url).href);
const teacherPassword = 'Synthetic-teacher-secret-2026';
const studentPassword = 'Synthetic-student-secret-2026';
const googleClientId = '1234567890-test.apps.googleusercontent.com';
type Identity = { sub: string; email: string; email_verified: boolean; nonce?: string; name?: string; hd?: string };

async function fixture(config: { google?: boolean; domain?: string } = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'romine-enrollment-test-'));
  let time = Date.UTC(2026, 0, 1);
  let app: any;
  let origin = '';
  const credentials = new Map<string, Identity>();
  let verificationGate: { wait: Promise<void>; started: () => void } | null = null;
  let verificationCalls = 0;
  async function start() {
    app = await createApp({
      dataDir, teacherPassword, production: false, now: () => time,
      googleClientId: config.google ? googleClientId : '', googleAllowedDomain: config.domain || '',
      verifyGoogleCredential: async (credential: string, audience: string) => {
        verificationCalls++;
        assert.equal(audience, googleClientId);
        const identity = credentials.get(credential);
        if (!identity) throw new Error('Synthetic invalid credential');
        const gate = verificationGate;
        if (gate) { gate.started(); await gate.wait; }
        return identity;
      },
    });
    await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${app.server.address().port}`;
  }
  await start();
  async function request(path: string, method = 'GET', body?: unknown, cookie = '', headers: Record<string, string> = {}) {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: { ...(method === 'GET' ? {} : { 'Content-Type': 'application/json', Origin: origin }), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    const cookies = response.headers.getSetCookie();
    const cookieNamed = (name: string) => cookies.find(c => c.startsWith(`${name}=`))?.split(';')[0] || '';
    return { status: response.status, data, response, cookie: cookieNamed('romine_session'), challengeCookie: cookieNamed('romine_google_challenge') };
  }
  const teacher = await request('/api/auth/login', 'POST', { username: 'mrromine', password: teacherPassword });
  assert.equal(teacher.status, 200);
  const enrollment = async () => request('/api/admin/enrollment', 'GET', undefined, teacher.cookie);
  const register = (classCode: string, username = 'student01', extra: Record<string, unknown> = {}) => request('/api/auth/register', 'POST', {
    username, displayName: 'Student One', password: studentPassword, classCode, ...extra,
  });
  const token = (identity: Identity) => { const value = `synthetic-google-credential-${randomUUID()}`; credentials.set(value, identity); return value; };
  const challenge = (cookie = '', intent = 'signin') => request('/api/auth/google/challenge', 'POST', { intent }, cookie);
  const google = (challengeResult: any, overrides: Partial<Identity> = {}, classCode?: string, sessionCookie = '') => {
    const identity: Identity = { sub: 'google-student-001', email: 'student@school.example', email_verified: true, name: 'Google Student', nonce: challengeResult.data.nonce, ...overrides };
    return request('/api/auth/google', 'POST', { credential: token(identity), ...(classCode ? { classCode } : {}) }, [sessionCookie, challengeResult.challengeCookie].filter(Boolean).join('; '));
  };
  return {
    teacher, request, enrollment, register, challenge, google, token, app: () => app,
    tick: (seconds: number) => { time += seconds * 1000; },
    verificationCalls: () => verificationCalls,
    pauseVerification: () => {
      let release!: () => void; let entered!: () => void;
      const wait = new Promise<void>(resolve => { release = resolve; });
      const started = new Promise<void>(resolve => { entered = resolve; });
      verificationGate = { wait, started: entered };
      return { started, release: () => { verificationGate = null; release(); } };
    },
    restart: async () => { await app.close(); await start(); },
    close: async () => { await app.close(); await rm(dataDir, { recursive: true, force: true }); },
  };
}

test('self-registration requires the private class code and creates only a student with durable progress', async () => {
  const f = await fixture();
  try {
    const options = await f.request('/api/auth/options');
    assert.equal(options.status, 200);
    assert.equal(options.data.registrationEnabled, true);
    assert.equal(options.data.googleEnabled, false);
    assert.equal('joinCode' in options.data, false);
    assert.equal((await f.enrollment()).status, 200);
    const code = (await f.enrollment()).data.joinCode;
    assert.ok(code.length >= 10);
    assert.ok((await f.register('WRONG-CODE')).status >= 400);
    assert.equal((await f.register(code, 'student01', { password: 'short' })).status, 400);
    const registered = await f.register(code, 'Student01', { role: 'teacher' });
    assert.equal(registered.status, 201, JSON.stringify(registered.data));
    assert.equal(registered.data.user.role, 'student');
    assert.equal(registered.data.user.username, 'student01');
    assert.equal(registered.data.user.googleLinked, false);
    assert.match(registered.response.headers.get('set-cookie') || '', /HttpOnly/);
    const student = registered.data.user;
    assert.equal((await f.request('/api/admin/enrollment', 'GET', undefined, registered.cookie)).status, 403);
    assert.equal((await f.request('/api/progress', 'PUT', { lessonId: 'shapes', patch: { read: true } }, registered.cookie)).status, 403);
    assert.equal((await f.request('/api/progress', 'PUT', { lessonId: 'frames', patch: { read: true, notes: 'My original saved progress.' } }, registered.cookie)).status, 200);
    assert.equal((await f.register(code, 'STUDENT01')).status, 409);
    const stored = f.app().db.prepare('SELECT password_hash FROM users WHERE id=?').get(student.id);
    assert.match(stored.password_hash, /^scrypt\$/);
    assert.notEqual(stored.password_hash, studentPassword);
    await f.restart();
    assert.equal((await f.enrollment()).data.joinCode, code);
    const login = await f.request('/api/auth/login', 'POST', { username: 'student01', password: studentPassword });
    assert.equal(login.status, 200);
    assert.equal(login.data.user.id, student.id);
    assert.equal((await f.request('/api/progress', 'GET', undefined, login.cookie)).data.lessons.frames.notes, 'My original saved progress.');
  } finally { await f.close(); }
});

test('enrollment controls, code rotation, and CSRF protect signups without locking out existing accounts', async () => {
  const f = await fixture();
  try {
    const code = (await f.enrollment()).data.joinCode;
    const student = await f.register(code);
    assert.equal(student.status, 201);
    assert.equal((await f.request('/api/auth/register', 'POST', { username: 'evil', displayName: 'Invalid', password: studentPassword, classCode: code }, '', { Origin: 'https://other.example' })).status, 403);
    assert.equal((await f.request('/api/admin/enrollment', 'PATCH', { enabled: false }, student.cookie)).status, 403);
    assert.equal((await f.request('/api/admin/enrollment/rotate', 'POST', {}, student.cookie)).status, 403);
    assert.equal((await f.request('/api/admin/enrollment', 'PATCH', { enabled: false }, f.teacher.cookie)).data.enabled, false);
    assert.ok((await f.register(code, 'student02')).status >= 400);
    assert.equal((await f.request('/api/auth/options')).data.registrationEnabled, false);
    assert.equal((await f.request('/api/auth/login', 'POST', { username: 'student01', password: studentPassword })).status, 200);
    const rotated = await f.request('/api/admin/enrollment/rotate', 'POST', {}, f.teacher.cookie);
    assert.equal(rotated.status, 200);
    assert.notEqual(rotated.data.joinCode, code);
    await f.request('/api/admin/enrollment', 'PATCH', { enabled: true }, f.teacher.cookie);
    assert.ok((await f.register(code, 'student02')).status >= 400);
    assert.equal((await f.register(rotated.data.joinCode, 'student02')).status, 201);
    assert.equal((await f.request('/api/admin/students', 'GET', undefined, f.teacher.cookie)).data.students.length, 2);
  } finally { await f.close(); }
});

test('Google challenges are browser-bound, one-time, expiring, and require verified identity', async () => {
  const f = await fixture({ google: true });
  try {
    const code = (await f.enrollment()).data.joinCode;
    const c = await f.challenge();
    assert.equal(c.status, 200);
    assert.ok(c.data.nonce.length >= 32);
    assert.match(c.response.headers.get('set-cookie') || '', /HttpOnly; SameSite=Strict/);
    const credential = f.token({ sub: 'one', email: 'one@school.example', email_verified: true, nonce: c.data.nonce });
    assert.ok((await f.request('/api/auth/google', 'POST', { credential, classCode: code })).status >= 400);
    assert.equal(f.verificationCalls(), 0);
    assert.ok((await f.google(c, { nonce: 'wrong-nonce' }, code)).status >= 400);
    assert.ok((await f.google(c, {}, code)).status >= 400);
    const unverified = await f.challenge();
    assert.ok((await f.google(unverified, { email_verified: false }, code)).status >= 400);
    const expired = await f.challenge(); f.tick(601);
    assert.ok((await f.google(expired, {}, code)).status >= 400);
    const valid = await f.challenge();
    const result = await f.google(valid, {}, code);
    assert.equal(result.status, 201, JSON.stringify(result.data));
    assert.equal(result.data.user.role, 'student');
    assert.equal(result.data.user.googleLinked, true);
    assert.ok((await f.google(valid, {}, code)).status >= 400);
  } finally { await f.close(); }
});

test('Google enrolls only with a class code and uses subject identity on later signins', async () => {
  const f = await fixture({ google: true, domain: 'school.example' });
  try {
    const code = (await f.enrollment()).data.joinCode;
    assert.equal((await f.request('/api/auth/options')).data.googleClientId, googleClientId);
    assert.ok((await f.google(await f.challenge(), { hd: 'school.example' })).status >= 400);
    // A matching email suffix does not satisfy the hosted-domain restriction.
    assert.ok((await f.google(await f.challenge(), { email: 'student@school.example' }, code)).status >= 400);
    assert.ok((await f.google(await f.challenge(), { hd: 'other.example' }, code)).status >= 400);
    const joined = await f.google(await f.challenge(), { hd: 'school.example' }, code);
    assert.equal(joined.status, 201, JSON.stringify(joined.data));
    await f.request('/api/progress', 'PUT', { lessonId: 'frames', patch: { read: true, notes: 'Google account progress remains.' } }, joined.cookie);
    await f.request('/api/admin/enrollment', 'PATCH', { enabled: false }, f.teacher.cookie);
    const back = await f.google(await f.challenge(), { hd: 'school.example', email: 'changed@school.example' });
    assert.equal(back.status, 200);
    assert.equal(back.data.user.id, joined.data.user.id);
    assert.equal((await f.request('/api/progress', 'GET', undefined, back.cookie)).data.lessons.frames.notes, 'Google account progress remains.');
    assert.ok((await f.google(await f.challenge(), { hd: 'school.example', sub: 'new-subject' }, code)).status >= 400);
    await f.request(`/api/admin/students/${joined.data.user.id}`, 'PATCH', { disabled: true }, f.teacher.cookie);
    assert.ok((await f.google(await f.challenge(), { hd: 'school.example' })).status >= 400);
  } finally { await f.close(); }
});

test('linking Google keeps an existing student id and progress, and cannot claim another account', async () => {
  const f = await fixture({ google: true });
  try {
    const code = (await f.enrollment()).data.joinCode;
    const old = await f.register(code);
    const other = await f.register(code, 'student02');
    await f.request('/api/progress', 'PUT', { lessonId: 'frames', patch: { read: true, notes: 'Existing password account work.' } }, old.cookie);
    assert.equal((await f.challenge(f.teacher.cookie, 'link')).status, 403);
    assert.equal((await f.challenge('', 'link')).status, 403);
    const link = await f.google(await f.challenge(old.cookie, 'link'), {}, undefined, old.cookie);
    assert.equal(link.status, 200, JSON.stringify(link.data));
    assert.equal(link.data.user.id, old.data.user.id);
    assert.equal(link.data.user.googleLinked, true);
    assert.equal(link.cookie, '', 'Linking must not replace the session or revive it after a concurrent logout.');
    assert.equal((await f.request('/api/auth/me', 'GET', undefined, old.cookie)).data.user.googleLinked, true);
    assert.ok((await f.google(await f.challenge(other.cookie, 'link'), {}, undefined, other.cookie)).status >= 400);
    // The same email on a different verified subject must not merge or take over.
    const separate = await f.google(await f.challenge(), { sub: 'different-subject' }, code);
    assert.equal(separate.status, 201);
    assert.notEqual(separate.data.user.id, old.data.user.id);
    const returned = await f.google(await f.challenge());
    assert.equal(returned.status, 200);
    assert.equal(returned.data.user.id, old.data.user.id);
    assert.equal((await f.request('/api/progress', 'GET', undefined, returned.cookie)).data.lessons.frames.notes, 'Existing password account work.');
    assert.equal((await f.request('/api/auth/login', 'POST', { username: 'student01', password: studentPassword })).status, 200);
    assert.equal((await f.request('/api/admin/students', 'GET', undefined, f.teacher.cookie)).data.students.length, 3);
  } finally { await f.close(); }
});

test('Google callback rechecks enrollment and account access after asynchronous verification', async () => {
  const f = await fixture({ google: true });
  try {
    const code = (await f.enrollment()).data.joinCode;
    const c = await f.challenge(); const gate = f.pauseVerification();
    const request = f.google(c, {}, code);
    await gate.started;
    await f.request('/api/admin/enrollment', 'PATCH', { enabled: false }, f.teacher.cookie);
    gate.release();
    assert.ok((await request).status >= 400);
    await f.request('/api/admin/enrollment', 'PATCH', { enabled: true }, f.teacher.cookie);
    const student = await f.register(code);
    const linkChallenge = await f.challenge(student.cookie, 'link'); const linkGate = f.pauseVerification();
    const linking = f.google(linkChallenge, {}, undefined, student.cookie);
    await linkGate.started;
    await f.request(`/api/admin/students/${student.data.user.id}`, 'PATCH', { disabled: true }, f.teacher.cookie);
    linkGate.release();
    assert.ok((await linking).status >= 400);
    assert.equal(f.app().db.prepare('SELECT COUNT(*) AS count FROM google_accounts').get().count, 0);
  } finally { await f.close(); }
});
