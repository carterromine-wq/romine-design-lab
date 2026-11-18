import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, CheckCircle2, Download, KeyRound, LoaderCircle, LockKeyhole, Plus, RefreshCw, Search, ShieldCheck, Users, X } from 'lucide-react';
import { lessons } from '../course-data';
import { emptyProgress, maximumStep, type ProgressRecord } from './progress-model';
import { api, errorMessage } from './api';
import EnrollmentPanel from './enrollment-panel';

type Student = {
  id: string; username: string; displayName: string; disabled: boolean;
  googleEmail?: string | null; createdAt: string; completedLessons: number; currentLessonId: string | null; progress: ProgressRecord;
};
type Credential = { id: string; username: string; displayName: string; password: string };

function downloadCsv(filename: string, rows: string[][]) {
  const cell = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
  const content = '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function TeacherDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [rosterInput, setRosterInput] = useState('');
  const [credentials, setCredentials] = useState<Credential[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);
  const [notice, setNotice] = useState('');
  const modal = useRef<HTMLDialogElement>(null);
  const selected = students.find(student => student.id === selectedId) || null;
  const isModal = adding || !!credentials || !!selected;

  const load = useCallback(async () => {
    setError('');
    try { const data = await api<{ students: Student[] }>('/api/admin/students'); setStudents(data.students); }
    catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (isModal && !modal.current?.open) modal.current?.showModal(); else if (!isModal && modal.current?.open) modal.current.close(); }, [isModal]);
  const close = () => { if (busy) return; setAdding(false); setCredentials(null); setSelectedId(null); setReason(''); setResetConfirm(false); setError(''); };

  const createStudents = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const list = rosterInput.split(/\r?\n/).filter(line => line.trim()).map(line => {
        const [username, ...name] = line.split(',');
        return { username: username.trim().toLowerCase(), displayName: name.join(',').trim() || username.trim().toLowerCase() };
      });
      const result = await api<{ credentials: Credential[] }>('/api/admin/students', 'POST', { students: list });
      setAdding(false); setRosterInput(''); setCredentials(result.credentials); await load();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const resetPassword = async () => {
    if (!selected) return; setError(''); setBusy(true);
    try {
      const credential = await api<Credential>(`/api/admin/students/${selected.id}/reset-password`, 'POST');
      setSelectedId(null); setResetConfirm(false); setCredentials([credential]); await load();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const setDisabled = async () => {
    if (!selected) return; setError(''); setBusy(true);
    try { await api(`/api/admin/students/${selected.id}`, 'PATCH', { disabled: !selected.disabled }); setNotice(selected.disabled ? 'Account enabled.' : 'Account disabled. Progress is preserved.'); await load(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const approveVideo = async (event: FormEvent) => {
    event.preventDefault(); if (!selected?.currentLessonId) return; setError(''); setBusy(true);
    try {
      await api(`/api/admin/students/${selected.id}/video-override`, 'POST', { lessonId: selected.currentLessonId, reason: reason.trim() });
      setReason(''); setNotice('Video step approved. The student can refresh to continue to Build.'); await load();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const exportCredentials = () => {
    if (!credentials) return;
    downloadCsv('student-login-cards.csv', [['Website', 'Student', 'Username', 'Password'], ...credentials.map(item => [window.location.origin, item.displayName, item.username, item.password])]);
  };
  const exportProgress = () => downloadCsv('class-progress.csv', [['Student', 'Username', 'Account', 'Lessons complete', 'Current lesson', 'Last saved'], ...students.map(student => [student.displayName, student.username, student.disabled ? 'Disabled' : 'Active', String(student.completedLessons), lessons.find(l => l.id === student.currentLessonId)?.title || 'Course complete', student.progress.updatedAt || 'Not started'])]);
  const displayed = students.filter(student => `${student.username} ${student.displayName} ${student.googleEmail || ''}`.toLowerCase().includes(filter.toLowerCase()));
  const current = selected ? lessons.find(l => l.id === selected.currentLessonId) : null;
  const currentProgress = current && selected ? selected.progress.lessons[current.id] || emptyProgress() : null;

  return <div className="teacher-page"><div className="teacher-heading"><div><p className="studio-eyebrow">MR. ROMINE’S TECHNOLOGY CLASS</p><h1>Your classroom.</h1><p>Invite your class. Follow progress. Keep everyone moving.</p></div><button className="primary-button" onClick={() => { setError(''); setAdding(true); }}><Plus size={17} /> Add students</button></div>
    <EnrollmentPanel />
    <div className="teacher-stats"><div><span><Users size={18} /></span><strong>{students.filter(s => !s.disabled).length}</strong><p>Active students</p></div><div><span><Sparkle /></span><strong>{students.filter(s => s.completedLessons > 0 && s.completedLessons < 10).length}</strong><p>Making progress</p></div><div><span><CheckCircle2 size={18} /></span><strong>{students.filter(s => s.completedLessons === 10).length}</strong><p>Course complete</p></div></div>
    {notice && <div className="teacher-notice" role="status"><CheckCircle2 size={17} /><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice('')}><X size={15} /></button></div>}
    {error && !isModal && <div className="save-error" role="alert"><span>{error}</span><button onClick={() => void load()}>Retry</button></div>}
    <section className="roster-card"><div className="roster-toolbar"><h2>Students</h2><button className="secondary-button small" type="button" aria-label="Refresh student list" title="Refresh student list" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /></button><label className="roster-search"><Search size={16} /><input aria-label="Search students" value={filter} placeholder="Find a student" onChange={e => setFilter(e.target.value)} /></label><button className="secondary-button small" onClick={exportProgress} disabled={!students.length}><Download size={15} /><span>Export progress</span></button></div>{loading ? <div className="empty-roster"><LoaderCircle className="spin" /><p>Loading your class…</p></div> : !students.length ? <div className="empty-roster"><span className="empty-roster-icon"><Users size={29} /></span><h3>A fresh start for your class.</h3><p>Share your class link and code above. Students create their own accounts and are added to your roster. You can also add students yourself.</p><button className="primary-button" onClick={() => setAdding(true)}><Plus size={17} /> Add students manually</button></div> : <div className="roster-scroll"><table><thead><tr><th>Student</th><th>Progress</th><th>Next lesson</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>{displayed.map(student => <tr key={student.id}><td><strong>{student.displayName}</strong><small>{student.username} {student.googleEmail && <span className="google-roster-tag">Google</span>} {student.disabled && <em>Disabled</em>}</small></td><td><span>{student.completedLessons} / 10</span><progress max={10} value={student.completedLessons} aria-label={`${student.completedLessons} lessons complete`} /></td><td>{lessons.find(l => l.id === student.currentLessonId)?.title || 'Course complete'}</td><td><button className="secondary-button small" onClick={() => { setSelectedId(student.id); setResetConfirm(false); setReason(''); setError(''); }}>View</button></td></tr>)}</tbody></table>{!displayed.length && <p className="no-results">No students match that search.</p>}</div>}</section>
    <div className="teacher-bottom"><section><ShieldCheck size={23} /><div><h3>Accounts stay with the student.</h3><p>Reset a forgotten password without losing progress. Use student IDs or nicknames if you prefer. Students need their separate school-approved Figma account for design work.</p></div></section><section><Download size={23} /><div><h3>Keep a classroom backup.</h3><p>Download a database snapshot after adding students and periodically during the course. Store it privately.</p><a className="text-link" href="/api/admin/backup" download>Download database backup <ArrowUpRight size={13} /></a></div></section></div>
    <dialog className="teacher-dialog" ref={modal} onCancel={event => { event.preventDefault(); close(); }} aria-labelledby="dialog-title"><div className="dialog-top"><div className="color-signature" aria-hidden="true"><i /><i /><i /><i /></div><button aria-label="Close dialog" onClick={close} disabled={busy}><X size={20} /></button></div>
      {adding && <><h2 id="dialog-title">Add your students.</h2><p className="dialog-intro">Enter one student per line. Use a username, followed by an optional display name.</p><form onSubmit={createStudents}><label htmlFor="new-students">Student list</label><textarea id="new-students" className="roster-input" value={rosterInput} onChange={e => setRosterInput(e.target.value)} placeholder={'student01, Student 01\nstudent02, Student 02\nstudent03, Student 03'} required autoFocus /><small>Usernames: 3–40 lowercase letters, numbers, periods, underscores, or hyphens. Up to 100 students per batch.</small>{error && <p className="inline-error" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary-button" onClick={close} disabled={busy}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <><Plus size={16} /> Create logins</>}</button></div></form></>}
      {credentials && <><h2 id="dialog-title">Logins are ready.</h2><p className="dialog-intro">Download these passwords before closing this window. They are only shown now. Give each student their own login privately.</p><div className="credentials-table"><table><thead><tr><th>Student</th><th>Username</th><th>Password</th></tr></thead><tbody>{credentials.map(item => <tr key={item.id}><td>{item.displayName}</td><td><code>{item.username}</code></td><td><code>{item.password}</code></td></tr>)}</tbody></table></div><div className="dialog-actions"><button className="secondary-button" onClick={close}>Done</button><button className="primary-button" onClick={exportCredentials}><Download size={17} /> Download logins</button></div></>}
      {selected && !credentials && <><p className="studio-eyebrow">STUDENT DETAILS</p><h2 id="dialog-title">{selected.displayName}</h2><p className="dialog-intro">{selected.username}{selected.googleEmail ? ` · ${selected.googleEmail}` : ''} · {selected.disabled ? 'Account disabled' : 'Active account'} · {selected.completedLessons} of 10 lessons complete</p><div className="student-lesson-list">{lessons.map(lesson => {
        const progress = selected.progress.lessons[lesson.id] || emptyProgress();
        const accessible = lesson.number <= (current?.number || 10);
        return <details key={lesson.id} className={!accessible ? 'locked' : ''}><summary><span>{progress.completed ? <CheckCircle2 size={16} /> : !accessible ? <LockKeyhole size={14} /> : <span className="outline-number">{lesson.number}</span>}{lesson.title}</span><small>{progress.completed ? 'Complete' : !accessible ? 'Locked' : ['Learn', 'Watch', 'Build', 'Check'][maximumStep(lesson, progress)]}</small></summary><div className="student-work"><p><strong>Build tasks:</strong> {lesson.tasks.filter(t => progress.tasks[t.id]).length} / {lesson.tasks.length}</p><p><strong>Video:</strong> {progress.watched ? progress.videoOverride ? 'Teacher approved' : 'Complete' : `${Math.floor(progress.verifiedSeconds / 60)}:${String(Math.floor(progress.verifiedSeconds % 60)).padStart(2, '0')} watched`}</p>{progress.videoOverride && <p><strong>Approval reason:</strong> {progress.videoOverride.reason}</p>}{progress.reflection && <p><strong>Reflection:</strong> {progress.reflection}</p>}{progress.notes && <p><strong>Notes:</strong> {progress.notes}</p>}{progress.projectUrl && <a href={progress.projectUrl} target="_blank" rel="noopener" className="text-link">Open Figma work <ArrowUpRight size={14} /></a>}</div></details>;
      })}</div>{current && currentProgress?.read && !currentProgress.watched && <form className="video-approval" onSubmit={approveVideo}><h3>Approve the video step</h3><p>Use after arranging an alternative for a blocked video or an accommodation. This opens Build for this lesson only.</p><label htmlFor="approval-reason">Reason for approval</label><textarea id="approval-reason" value={reason} onChange={e => setReason(e.target.value)} minLength={10} maxLength={500} required placeholder="Describe the alternative or accommodation…" /><button className="secondary-button" disabled={busy || reason.trim().length < 10}><ShieldCheck size={16} /> Approve {current.title}</button></form>}{error && <p className="inline-error" role="alert">{error}</p>}<div className="account-management"><h3>Account controls</h3>{resetConfirm ? <div className="reset-confirm"><p>Generate a new password and sign this student out of other devices? Their progress will stay saved.</p><button className="primary-button" onClick={() => void resetPassword()} disabled={busy}>Create new password</button><button className="quiet-button" onClick={() => setResetConfirm(false)} disabled={busy}>Cancel</button></div> : <button className="secondary-button" onClick={() => setResetConfirm(true)} disabled={busy}><KeyRound size={16} /> Reset password</button>}<button className="quiet-button" disabled={busy} onClick={() => void setDisabled()}>{selected.disabled ? 'Enable account' : 'Disable account'}</button></div></>}
    </dialog>
  </div>;
}

function Sparkle() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" /></svg>; }
