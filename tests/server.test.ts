import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { lessons } from '../course-data.ts';

const { createApp } = await import(new URL('../dist/server.mjs', import.meta.url).href);
const TEACHER_PASSWORD = 'Synthetic-test-secret-2026';

type Fixture = Awaited<ReturnType<typeof fixture>>;
async function fixture(existingDir?: string) {
  const dataDir = existingDir || await mkdtemp(join(tmpdir(), 'romine-server-test-'));
  let time = Date.UTC(2026, 0, 1);
  let app: any;
  let origin = '';
  async function start(password = TEACHER_PASSWORD) {
    app = await createApp({ dataDir, teacherPassword: password, production: false, now: () => time });
    await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${app.server.address().port}`;
  }
  await start();
  async function request(path: string, method = 'GET', body?: unknown, cookie = '', headers: Record<string,string> = {}) {
    const response = await fetch(`${origin}${path}`, { method, headers: { ...(method === 'GET' ? {} : {'Content-Type':'application/json',Origin:origin}), ...(cookie ? {Cookie:cookie} : {}), ...headers }, ...(body !== undefined ? {body:JSON.stringify(body)} : {}) });
    const text = await response.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { response, status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
  }
  async function login(username: string, password: string) { return request('/api/auth/login','POST',{username,password}); }
  const teacher = await login('mrromine', TEACHER_PASSWORD); assert.equal(teacher.status,200);
  async function createStudent(username='student01') {
    const created = await request('/api/admin/students','POST',{students:[{username,displayName:username}]},teacher.cookie);
    assert.equal(created.status,201,JSON.stringify(created.data));
    const credential = created.data.credentials[0];
    const signed = await login(credential.username,credential.password); assert.equal(signed.status,200);
    return { ...credential, cookie: signed.cookie };
  }
  return { dataDir, teacher, request, login, createStudent, url:()=>origin, tick: (seconds:number) => {time+=seconds*1000;}, start, getApp:()=>app, restart:async(password=TEACHER_PASSWORD)=>{await app.close();await start(password);}, close:async()=>{await app.close();if(!existingDir)await rm(dataDir,{recursive:true,force:true});} };
}

async function markLearn(f:Fixture,student:any,id='frames') {
  const response = await f.request('/api/progress','PUT',{lessonId:id,patch:{read:true,currentStep:1}},student.cookie);
  assert.equal(response.status,200,JSON.stringify(response.data));
}
async function startVideo(f:Fixture,student:any,id='frames') {
  const response = await f.request('/api/video/start','POST',{lessonId:id},student.cookie);
  assert.equal(response.status,200,JSON.stringify(response.data)); return response.data;
}
async function heartbeat(f:Fixture,student:any,token:string,position:number,state='playing',visible=true,id='frames') {
  return f.request('/api/video/heartbeat','POST',{lessonId:id,token,position,state,visible},student.cookie);
}
async function watchFull(f:Fixture,student:any,id='frames') {
  const video = await startVideo(f,student,id); let pos=video.verifiedSeconds+.25;
  // Real iframe events can arrive a fraction after playback starts; that fraction
  // earns no credit but must not strand a student after the natural video end.
  let response = await heartbeat(f,student,video.token,pos,'playing',true,id); assert.equal(response.status,200);
  while(pos<video.duration-.01) {
    const next=Math.min(video.duration-.01,pos+3); f.tick(next-pos);pos=next;
    response=await heartbeat(f,student,video.token,pos,'playing',true,id);
    assert.equal(response.status,200,JSON.stringify(response.data));
  }
  response=await heartbeat(f,student,video.token,pos,'ended',true,id);
  assert.equal(response.status,200);assert.equal(response.data.watched,true,JSON.stringify(response.data));
  return response.data;
}

test('authentication, CSRF, roles, unique accounts, and account isolation',async()=>{
  const f=await fixture();try {
    assert.equal((await f.request('/api/progress')).status,401);
    assert.equal((await f.request('/api/auth/me')).data.user,null);
    assert.equal((await f.request('/api/auth/signup','POST',{})).status,404);
    assert.equal((await f.request('/api/auth/login','POST',{username:'mrromine',password:TEACHER_PASSWORD},'',{Origin:'https://evil.example'})).status,403);
    assert.equal((await f.request('/api/auth/login','POST',{username:'mrromine',password:TEACHER_PASSWORD},'',{'Content-Type':'text/plain'})).status,415);
    const student=await f.createStudent();const other=await f.createStudent('student02');
    assert.equal((await f.request('/api/admin/students','GET',undefined,student.cookie)).status,403);
    assert.equal((await f.request(`/api/admin/students/${other.id}/video-override`,'POST',{lessonId:'frames',reason:'try to unlock'},student.cookie)).status,403);
    await markLearn(f,student);
    const second=await f.request('/api/progress','GET',undefined,other.cookie);assert.deepEqual(second.data.lessons,{});
    const duplicate=await f.request('/api/admin/students','POST',{students:[{username:'newstudent',displayName:'New'},{username:'student01',displayName:'Duplicate'}]},f.teacher.cookie);assert.equal(duplicate.status,409);
    const roster=await f.request('/api/admin/students','GET',undefined,f.teacher.cookie);assert.equal(roster.data.students.length,2);
    assert.equal(roster.data.students.some((s:any)=>'password_hash' in s||'password' in s),false);
    const injection=await f.request('/api/admin/students','POST',{students:[{username:"';DROP TABLE users;--",displayName:'Invalid'}]},f.teacher.cookie);assert.equal(injection.status,400);
    assert.match(f.teacher.response.headers.get('set-cookie')||'',/HttpOnly; SameSite=Strict/);
  } finally {await f.close();}
});

test('every lesson and step is gated on the server, including forged complete and watched fields',async()=>{
  const f=await fixture();try {
    const s=await f.createStudent();
    const patch=(lessonId:string,patch:unknown)=>f.request('/api/progress','PUT',{lessonId,patch},s.cookie);
    assert.equal((await patch('shapes',{read:true})).status,403);
    assert.equal((await patch('frames',{currentStep:1})).status,403);
    assert.equal((await patch('frames',{watched:true})).status,400);
    assert.equal((await patch('frames',{verifiedSeconds:800})).status,400);
    assert.equal((await patch('frames',{videoDuration:1})).status,400);
    assert.equal((await patch('frames',{completed:true})).status,403);
    assert.equal((await f.request('/api/video/start','POST',{lessonId:'frames'},s.cookie)).status,403);
    await markLearn(f,s);
    assert.equal((await patch('frames',{currentStep:2})).status,403);
    assert.equal((await patch('frames',{tasks:{[lessons[0].tasks[0].id]:true}})).status,403);
    assert.equal((await patch('frames',{notes:'Next time: continue watching.'})).status,200);
    assert.equal((await patch('frames',{read:false})).status,400);
  } finally {await f.close();}
});

test('video heartbeats reject seeking and fast playback, do not count paused or hidden time, and persist resume position',async()=>{
  const f=await fixture();try {
    const s=await f.createStudent();await markLearn(f,s);const video=await startVideo(f,s);
    assert.equal(video.duration,799.699);assert.equal(video.verifiedSeconds,0);
    await heartbeat(f,s,video.token,0);
    f.tick(3);let result=await heartbeat(f,s,video.token,300);assert.equal(result.data.verifiedSeconds,0);assert.equal(result.data.seekTo,0);assert.equal(result.data.watched,false);
    f.tick(3);result=await heartbeat(f,s,video.token,3);assert.equal(result.data.verifiedSeconds,3);
    f.tick(3);result=await heartbeat(f,s,video.token,6,'paused');assert.equal(result.data.verifiedSeconds,6);
    f.tick(60);result=await heartbeat(f,s,video.token,6,'paused');assert.equal(result.data.verifiedSeconds,6);
    await heartbeat(f,s,video.token,6,'playing');
    f.tick(3);result=await heartbeat(f,s,video.token,9,'playing',false);assert.equal(result.data.verifiedSeconds,6);assert.equal(result.data.seekTo,6);
    await heartbeat(f,s,video.token,6,'playing',true);
    f.tick(3);result=await heartbeat(f,s,video.token,12);assert.equal(result.data.verifiedSeconds,6);assert.equal(result.data.seekTo,6);
    const reload=await startVideo(f,s);assert.equal(reload.verifiedSeconds,6);
    assert.equal((await heartbeat(f,s,video.token,6)).status,409);
    const other=await f.createStudent('student02');await markLearn(f,other);
    assert.equal((await heartbeat(f,other,reload.token,6)).status,409);
    await f.restart();
    const saved=await f.request('/api/progress','GET',undefined,s.cookie);assert.equal(saved.status,200);assert.equal(saved.data.lessons.frames.verifiedSeconds,6);
    const resumed=await startVideo(f,s);assert.equal(resumed.verifiedSeconds,6);
  } finally {await f.close();}
});

test('continuous playback, ordered tasks, and valid final evidence unlock exactly the next lesson',async()=>{
  const f=await fixture();try {
    const s=await f.createStudent();await markLearn(f,s);await watchFull(f,s);
    const lesson=lessons[0];const patch=(patch:unknown)=>f.request('/api/progress','PUT',{lessonId:lesson.id,patch},s.cookie);
    assert.equal((await patch({currentStep:2})).status,200);
    assert.equal((await patch({quizAnswer:lesson.quiz.correctIndex})).status,403);
    assert.equal((await patch({tasks:{[lesson.tasks[1].id]:true}})).status,403);
    assert.equal((await patch({tasks:{[lesson.tasks[0].id]:true,[lesson.tasks[1].id]:true}})).status,403);
    for(const task of lesson.tasks)assert.equal((await patch({tasks:{[task.id]:true}})).status,200);
    assert.equal((await patch({currentStep:3})).status,200);
    assert.equal((await patch({projectUrl:'https://evil.example/file/123'})).status,400);
    assert.equal((await patch({completed:true})).status,422);
    assert.equal((await patch({quizAnswer:lesson.quiz.correctIndex,reflection:'I used a frame to keep all parts of my design together.',projectUrl:'https://www.figma.com/design/testfile/Frames'})).status,200);
    const done=await patch({completed:true});assert.equal(done.status,200);assert.equal(done.data.progress.completed,true);
    assert.equal((await f.request('/api/progress','PUT',{lessonId:'shapes',patch:{read:true}},s.cookie)).status,200);
    assert.equal((await f.request('/api/progress','PUT',{lessonId:'typography',patch:{read:true}},s.cookie)).status,403);
    assert.equal((await patch({reflection:''})).status,409);
    assert.equal((await patch({tasks:{[lesson.tasks[0].id]:false}})).status,400);
    assert.equal((await patch({notes:'Remember to use constraints next time.'})).status,200);
    await f.restart();const saved=await f.request('/api/progress','GET',undefined,s.cookie);assert.equal(saved.data.lessons.frames.completed,true);assert.equal(saved.data.lessons.frames.notes,'Remember to use constraints next time.');
  } finally {await f.close();}
});

test('a natural YouTube end is required; ending or jumping early never marks watched',async()=>{
  const f=await fixture();try {
    const s=await f.createStudent();await markLearn(f,s);const video=await startVideo(f,s);
    let result=await heartbeat(f,s,video.token,video.duration,'ended');assert.equal(result.data.watched,false);assert.equal(result.data.verifiedSeconds,0);
    await heartbeat(f,s,video.token,0,'playing');f.tick(2);result=await heartbeat(f,s,video.token,2,'ended');assert.equal(result.data.watched,false);assert.equal(result.data.verifiedSeconds,2);
    await heartbeat(f,s,video.token,2,'buffering');f.tick(30);result=await heartbeat(f,s,video.token,32,'playing');assert.equal(result.data.verifiedSeconds,2);assert.equal(result.data.seekTo,2);
  } finally {await f.close();}
});

test('lesson revisions strictly increase even in one millisecond and independent writes preserve each other',async()=>{
  const f=await fixture();try {
    const s=await f.createStudent();await markLearn(f,s);
    const video=await startVideo(f,s);
    const before=video.progress;
    const note=await f.request('/api/progress','PUT',{lessonId:'frames',patch:{notes:'My next step is to finish the frame tutorial.'}},s.cookie);
    const beat=await heartbeat(f,s,video.token,0,'playing');
    assert.equal(note.status,200);assert.equal(beat.status,200);
    assert.equal(note.data.progress.updatedAt,before.updatedAt);
    assert.equal(beat.data.progress.updatedAt,before.updatedAt);
    assert.ok(note.data.progress.revision>before.revision);
    assert.ok(beat.data.progress.revision>note.data.progress.revision);
    const saved=await f.request('/api/progress','GET',undefined,s.cookie);
    assert.equal(saved.data.lessons.frames.notes,'My next step is to finish the frame tutorial.');
    assert.equal(saved.data.lessons.frames.read,true);
    assert.equal(saved.data.lessons.frames.revision,beat.data.progress.revision);
    const simultaneous = await Promise.all([
      f.request('/api/progress','PUT',{lessonId:'frames',patch:{notes:'A concurrent note remains saved.'}},s.cookie),
      heartbeat(f,s,video.token,0,'playing'),
    ]);
    assert.ok(simultaneous.every(result=>result.status===200));
    const revisions=simultaneous.map(result=>result.data.progress.revision).sort((a,b)=>a-b);
    assert.equal(revisions[1],revisions[0]+1);
    assert.ok(revisions[0]>beat.data.progress.revision);
    const concurrentSaved=await f.request('/api/progress','GET',undefined,s.cookie);
    assert.equal(concurrentSaved.data.lessons.frames.notes,'A concurrent note remains saved.');
    assert.equal(concurrentSaved.data.lessons.frames.revision,revisions[1]);
    assert.equal(concurrentSaved.data.lessons.frames.read,true);
    assert.equal((await f.request('/api/progress','PUT',{lessonId:'frames',patch:{revision:9999}},s.cookie)).status,400);
  } finally {await f.close();}
});

test('teacher accommodations are attributed, limited to the current lesson, and never available to students',async()=>{
  const f=await fixture();try {
    const s=await f.createStudent();await markLearn(f,s);
    const route=`/api/admin/students/${s.id}/video-override`;
    assert.equal((await f.request(route,'POST',{lessonId:'shapes',reason:'School network blocked the video.'},f.teacher.cookie)).status,403);
    assert.equal((await f.request(route,'POST',{lessonId:'frames',reason:'ok'},f.teacher.cookie)).status,400);
    const result=await f.request(route,'POST',{lessonId:'frames',reason:'Completed with the teacher on the classroom screen.'},f.teacher.cookie);
    assert.equal(result.status,200);assert.equal(result.data.progress.watched,true);assert.equal(result.data.progress.verifiedSeconds,0);assert.equal(result.data.progress.videoOverride.reason,'Completed with the teacher on the classroom screen.');
    assert.equal((await f.request('/api/progress','PUT',{lessonId:'frames',patch:{currentStep:2}},s.cookie)).status,200);
  } finally {await f.close();}
});

test('password reset and disabling revoke sessions while preserving student work',async()=>{
  const f=await fixture();try {
    const s=await f.createStudent();await markLearn(f,s);
    const reset=await f.request(`/api/admin/students/${s.id}/reset-password`,'POST',{},f.teacher.cookie);assert.equal(reset.status,200);assert.notEqual(reset.data.password,s.password);
    assert.equal((await f.request('/api/progress','GET',undefined,s.cookie)).status,401);
    assert.equal((await f.login(s.username,s.password)).status,401);
    const again=await f.login(s.username,reset.data.password);assert.equal(again.status,200);
    assert.equal((await f.request('/api/progress','GET',undefined,again.cookie)).data.lessons.frames.read,true);
    assert.equal((await f.request(`/api/admin/students/${s.id}`,'PATCH',{disabled:true},f.teacher.cookie)).status,200);
    assert.equal((await f.request('/api/progress','GET',undefined,again.cookie)).status,401);
    assert.equal((await f.login(s.username,reset.data.password)).status,401);
    await f.request(`/api/admin/students/${s.id}`,'PATCH',{disabled:false},f.teacher.cookie);
    assert.equal((await f.login(s.username,reset.data.password)).status,200);
  } finally {await f.close();}
});

test('a session revoked while a slow request body is arriving cannot write progress',async()=>{
  const f=await fixture();try {
    const s=await f.createStudent();await markLearn(f,s);
    const body=JSON.stringify({lessonId:'frames',patch:{notes:'This revoked request must never save.'}});
    let finishBody:()=>void=()=>{};
    const pending=new Promise<number>((resolveRequest,reject)=>{
      const request=httpRequest(`${f.url()}/api/progress`,{method:'PUT',headers:{Origin:f.url(),'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),Cookie:s.cookie}},response=>{response.resume();response.on('end',()=>resolveRequest(response.statusCode||0));});
      request.on('error',reject);request.write(body.slice(0,15));finishBody=()=>request.end(body.slice(15));
    });
    await new Promise(resolve=>setTimeout(resolve,25));
    const reset=await f.request(`/api/admin/students/${s.id}/reset-password`,'POST',{},f.teacher.cookie);assert.equal(reset.status,200);
    finishBody();assert.equal(await pending,401);
    const signed=await f.login(s.username,reset.data.password);
    const saved=await f.request('/api/progress','GET',undefined,signed.cookie);assert.equal(saved.data.lessons.frames.notes,'');
  } finally {await f.close();}
});

test('teacher secret rotation revokes teacher sessions; backups are real SQLite and teacher-only',async()=>{
  const f=await fixture();try {
    const s=await f.createStudent();
    assert.equal((await f.request('/api/admin/backup','GET',undefined,s.cookie)).status,403);
    const backup=await f.request('/api/admin/backup','GET',undefined,f.teacher.cookie);assert.equal(backup.status,200);assert.match(backup.data,/^SQLite format 3/);assert.match(backup.response.headers.get('content-disposition')||'',/attachment/);
    await f.restart('New-synthetic-teacher-secret');
    assert.equal((await f.request('/api/admin/students','GET',undefined,f.teacher.cookie)).status,401);
    assert.equal((await f.login('mrromine',TEACHER_PASSWORD)).status,401);
    assert.equal((await f.login('mrromine','New-synthetic-teacher-secret')).status,200);
    assert.equal((await f.request('/api/progress','GET',undefined,s.cookie)).status,200);
  } finally {await f.close();}
});

test('login throttling, request bounds, and server-private files are enforced',async()=>{
  const f=await fixture();try {
    for(let i=0;i<12;i++)assert.equal((await f.login('not-a-user','wrong')).status,401);
    assert.equal((await f.login('not-a-user','wrong')).status,429);
    assert.equal((await f.request('/api/auth/login','POST',{username:'mrromine',password:'x'.repeat(70_000)})).status,413);
    assert.equal((await f.request('/.env')).status,404);
    assert.equal((await f.request('/data/course.sqlite')).status,404);
    assert.equal((await f.request('/api/health')).data.ok,true);
  } finally {await f.close();}
});
