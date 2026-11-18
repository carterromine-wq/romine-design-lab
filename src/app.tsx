import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle2, ChevronDown, ChevronRight, CloudCheck, ExternalLink, FolderOpen, HelpCircle, LayoutDashboard, LoaderCircle, LockKeyhole, LogOut, Menu, MessageSquare, Play, ShieldCheck, Sparkles, X } from 'lucide-react';
import { courseModules, courseSource, lessons, setupSteps, type Lesson } from '../course-data';
import { completionIssues, emptyProgress, emptyProgressRecord, firstUnfinished, isFigmaProjectUrl, lessonUnlocked, maximumStep, type LessonProgress, type ProgressPatch, type ProgressRecord } from './progress-model';
import { api, ApiError, errorMessage, type User } from './api';
import { LessonArt } from './lesson-art';
import Login from './login-page';
import GoogleAccount from './google-account';
import GuidedVideo from './guided-video';
import TeacherDashboard from './teacher-dashboard';

const stepNames = ['Learn', 'Watch', 'Build', 'Check'];
const stepIcons = [BookOpen, Play, FolderOpen, CheckCircle2];
const moduleColors = ['#007aff', '#ff3b30', '#e9b900', '#28a745'];
type SaveResponse = { lessonId: string; progress: LessonProgress; updatedAt: string };
type TextField = 'notes' | 'reflection';
type TextDraft = { lessonId: string; field: TextField; value: string };

function Brand() {
  return <div className="studio-brand"><span className="studio-monogram">mr.</span><div><strong>Mr. Romine’s</strong><small>TECHNOLOGY CLASS</small></div></div>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState('');
  const [page, setPage] = useState<'course' | 'teacher' | 'help'>('course');
  const [record, setRecord] = useState<ProgressRecord>(emptyProgressRecord);
  const [loaded, setLoaded] = useState(false);
  const [lessonId, setLessonId] = useState(lessons[0].id);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(0);
  const [error, setError] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, TextDraft>>({});
  const [projectDraft, setProjectDraft] = useState('');
  const [projectDirty, setProjectDirty] = useState(false);
  const [projectError, setProjectError] = useState('');
  const recordRef = useRef(record);
  const draftsRef = useRef(drafts);
  const queueRef = useRef<Promise<LessonProgress | null>>(Promise.resolve(null));
  const failedRef = useRef<{ lessonId: string; patch: ProgressPatch } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(0);
  const accountGeneration = useRef(0);
  const focusRef = useRef<HTMLElement>(null);
  const currentLesson = lessons.find(l => l.id === lessonId) || lessons[0];
  const p = record.lessons[currentLesson.id] || emptyProgress();
  const maxStep = maximumStep(currentLesson, p);
  const completedCount = lessons.filter(l => record.lessons[l.id]?.completed).length;
  const currentModule = courseModules.find(m => m.title === currentLesson.module)!;

  const loadSession = useCallback(async () => {
    setBooting(true); setBootError('');
    try { const data = await api<{user: User | null}>('/api/auth/me'); setUser(data.user); if (data.user?.role === 'teacher') setPage('teacher'); }
    catch (e) { setBootError(errorMessage(e)); }
    finally { setBooting(false); }
  }, []);
  useEffect(() => { void loadSession(); }, [loadSession]);

  const commit = useCallback((id: string, progress: LessonProgress) => {
    if ((recordRef.current.lessons[id]?.revision ?? -1) > progress.revision) return;
    const next = { ...recordRef.current, lastLessonId: id, lastStep: progress.currentStep, updatedAt: progress.updatedAt, lessons: { ...recordRef.current.lessons, [id]: progress } };
    recordRef.current = next; setRecord(next);
  }, []);

  const loadProgress = useCallback(async () => {
    const generation = accountGeneration.current;
    setError('');
    try {
      const data = await api<ProgressRecord>('/api/progress');
      if (generation !== accountGeneration.current) return;
      recordRef.current = data; setRecord(data);
      const requested = window.location.hash.match(/^#lesson\/([^/]+)\/(\d+)$/);
      const unfinished = firstUnfinished(lessons, data) || lessons[lessons.length - 1];
      const saved = lessons.find(l => l.id === data.lastLessonId);
      let selected = saved && !data.lessons[saved.id]?.completed && lessonUnlocked(lessons, data, saved.id) ? saved : unfinished;
      let requestedStep: number | undefined;
      if (requested && lessonUnlocked(lessons, data, requested[1])) { selected = lessons.find(l => l.id === requested[1]) || selected; requestedStep = Number(requested[2]); }
      const progress = data.lessons[selected.id] || emptyProgress();
      const targetStep = Math.min(maximumStep(selected, progress), requestedStep ?? progress.currentStep);
      setLessonId(selected.id); setStep(targetStep); setLoaded(true);
      setProjectDraft(progress.projectUrl); setProjectDirty(false); setProjectError('');
      window.history.replaceState(null, '', `#lesson/${selected.id}/${targetStep}`);
    } catch (e) { if (generation === accountGeneration.current) setError(errorMessage(e)); }
  }, []);
  useEffect(() => {
    accountGeneration.current++;
    if (timerRef.current) clearTimeout(timerRef.current);
    draftsRef.current = {}; setDrafts({}); failedRef.current = null;
    recordRef.current = emptyProgressRecord(); setRecord(emptyProgressRecord());
    setLoaded(false); setError(''); setNotesOpen(false); setMobileOpen(false);
    setProjectDraft(''); setProjectDirty(false); setProjectError('');
    if (user) void loadProgress();
  }, [user, loadProgress]);

  const savePatch = useCallback((id: string, patch: ProgressPatch): Promise<LessonProgress | null> => {
    pendingRef.current++; setSaving(pendingRef.current);
    const run = async () => {
      try {
        const result = await api<SaveResponse>('/api/progress', 'PUT', { lessonId: id, patch });
        commit(id, result.progress); setError(''); failedRef.current = null;
        return result.progress;
      } catch (e) {
        failedRef.current = { lessonId: id, patch }; setError(errorMessage(e));
        if (e instanceof ApiError && e.status === 401) setError('Your session has ended. Copy any unsaved writing, then sign in again.');
        return null;
      } finally { pendingRef.current--; setSaving(pendingRef.current); }
    };
    const work = queueRef.current.then(run, run); queueRef.current = work;
    return work;
  }, [commit]);

  const flushDrafts = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    for (const [key, draft] of Object.entries(draftsRef.current)) {
      const result = await savePatch(draft.lessonId, { [draft.field]: draft.value });
      if (!result) return false;
      if (draftsRef.current[key]?.value === draft.value) {
        const next = { ...draftsRef.current }; delete next[key]; draftsRef.current = next; setDrafts(next);
      }
    }
    await queueRef.current;
    return !failedRef.current;
  }, [savePatch]);

  const editText = (field: TextField, value: string) => {
    const key = `${lessonId}:${field}`;
    const next = { ...draftsRef.current, [key]: { lessonId, field, value } };
    draftsRef.current = next; setDrafts(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void flushDrafts(); }, 800);
  };
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (pendingRef.current || Object.keys(draftsRef.current).length || failedRef.current || projectDirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [projectDirty]);

  useEffect(() => { setProjectDraft(recordRef.current.lessons[lessonId]?.projectUrl || ''); setProjectDirty(false); setProjectError(''); }, [lessonId]);

  const saveProject = async () => {
    if (!projectDirty) return true;
    const trimmed = projectDraft.trim();
    if (!isFigmaProjectUrl(trimmed)) { setProjectError('Paste the full link to your own Figma design or prototype.'); return false; }
    const result = await savePatch(lessonId, { projectUrl: trimmed });
    if (!result) return false;
    setProjectDirty(false); setProjectDraft(result.projectUrl); setProjectError(''); return true;
  };
  const navigate = async (id: string, target: number) => {
    if (!lessonUnlocked(lessons, recordRef.current, id)) return;
    if (!(await flushDrafts()) || !(await saveProject())) return;
    const lesson = lessons.find(l => l.id === id)!;
    const progress = recordRef.current.lessons[id] || emptyProgress();
    const nextStep = Math.max(0, Math.min(target, maximumStep(lesson, progress)));
    const result = await savePatch(id, { currentStep: nextStep });
    if (!result) return;
    setPage('course'); setLessonId(id); setStep(nextStep); setMobileOpen(false); setNotesOpen(false);
    window.history.pushState(null, '', `#lesson/${id}/${nextStep}`);
    window.scrollTo({ top: 0, behavior: 'smooth' }); focusRef.current?.focus();
  };

  useEffect(() => {
    if (!loaded) return;
    const onHistory = () => {
      const match = window.location.hash.match(/^#lesson\/([^/]+)\/(\d+)$/);
      const data = recordRef.current;
      if (pendingRef.current || Object.keys(draftsRef.current).length || projectDirty) { window.history.replaceState(null, '', `#lesson/${lessonId}/${step}`); return; }
      if (match && lessonUnlocked(lessons, data, match[1])) {
        const lesson = lessons.find(l => l.id === match[1]);
        if (lesson) { const s = Math.min(Number(match[2]), maximumStep(lesson, data.lessons[lesson.id] || emptyProgress())); setLessonId(lesson.id); setStep(s); setPage('course'); window.history.replaceState(null, '', `#lesson/${lesson.id}/${s}`); return; }
      }
      window.history.replaceState(null, '', `#lesson/${lessonId}/${step}`);
    };
    window.addEventListener('hashchange', onHistory);
    return () => window.removeEventListener('hashchange', onHistory);
  }, [loaded, lessonId, step, projectDirty]);

  const switchPage = async (next: typeof page) => { if (await flushDrafts() && await saveProject()) { setPage(next); setMobileOpen(false); } };
  const signOut = async () => {
    if (!(await flushDrafts()) || !(await saveProject())) return;
    try {
      await api('/api/auth/logout', 'POST');
      accountGeneration.current++;
      if (timerRef.current) clearTimeout(timerRef.current);
      draftsRef.current = {}; setDrafts({}); failedRef.current = null;
      setProjectDraft(''); setProjectDirty(false); setProjectError(''); setNotesOpen(false); setError('');
      setUser(null); setLoaded(false); setRecord(emptyProgressRecord()); recordRef.current = emptyProgressRecord(); setPage('course'); window.history.replaceState(null, '', '/');
    }
    catch (e) { setError(errorMessage(e)); }
  };
  const retry = async () => { if (!loaded) return loadProgress(); if (failedRef.current) await savePatch(failedRef.current.lessonId, failedRef.current.patch); await flushDrafts(); };
  const nextStep = async () => { await navigate(lessonId, step + 1); };
  const readDone = async () => { const result = await savePatch(lessonId, { read: true, currentStep: 1 }); if (result) { setStep(1); window.history.replaceState(null, '', `#lesson/${lessonId}/1`); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
  const taskDone = async (taskId: string) => {
    const isLast = currentLesson.tasks[currentLesson.tasks.length - 1].id === taskId;
    const result = await savePatch(lessonId, { tasks: { [taskId]: true }, ...(isLast ? { currentStep: 3 } : {}) });
    if (result && isLast) { setStep(3); window.history.replaceState(null, '', `#lesson/${lessonId}/3`); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };
  const finishLesson = async () => {
    if (!(await flushDrafts()) || !(await saveProject())) return;
    const result = await savePatch(lessonId, { completed: true });
    if (result) window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const onVideoProgress = useCallback((progress: LessonProgress) => { commit(lessonId, progress); }, [lessonId, commit]);

  if (booting) return <div className="loading-page"><Brand /><LoaderCircle className="spin" /><p>Getting your classroom ready…</p></div>;
  if (bootError) return <div className="loading-page"><Brand /><p role="alert">{bootError}</p><button className="primary-button" onClick={() => void loadSession()}>Try again</button></div>;
  if (!user) return <Login onLogin={newUser => { accountGeneration.current++; setUser(newUser); setPage(newUser.role === 'teacher' ? 'teacher' : 'course'); }} />;

  return <div className="studio-shell">
    <a className="studio-skip" href="#main" onClick={e => { e.preventDefault(); focusRef.current?.focus(); }}>Skip to lesson</a>
    {mobileOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`studio-sidebar ${mobileOpen ? 'open' : ''}`}><Brand /><p className="sidebar-course-label">FIGMA DESIGN LAB</p>
      <nav className="studio-nav" aria-label="Class navigation">
        {user.role === 'teacher' && <button className={page === 'teacher' ? 'active' : ''} onClick={() => void switchPage('teacher')}><LayoutDashboard size={18} /> Teacher dashboard</button>}
        <button className={page === 'course' ? 'active' : ''} onClick={() => void switchPage('course')}><BookOpen size={18} /> {user.role === 'teacher' ? 'Try the course' : 'My next step'}</button>
        <button className={page === 'help' ? 'active' : ''} onClick={() => void switchPage('help')}><HelpCircle size={18} /> Resources & help</button>
      </nav>
      <div className="sidebar-progress"><div><strong>Your progress</strong><span>{completedCount} / 10</span></div><progress value={completedCount} max={10} aria-label={`${completedCount} of 10 lessons complete`} /><small>Small steps add up.</small></div>
      {loaded && <div className="sidebar-now"><p className="studio-eyebrow">YOUR CURRENT LESSON</p><span className="module-pill" style={{ '--module-color': moduleColors[courseModules.indexOf(currentModule)] } as React.CSSProperties}>{currentLesson.module}</span><strong>{String(currentLesson.number).padStart(2, '0')}. {currentLesson.title}</strong><p>{p.completed ? 'Complete. Nicely done.' : `${stepNames[Math.min(step, maxStep)]} · Step ${Math.min(step, maxStep) + 1} of 4`}</p></div>}
      <details className="course-outline"><summary>Course path <ChevronDown size={15} /></summary><div>{courseModules.map((module, index) => <section key={module.id}><h3><i style={{ background: moduleColors[index] }} />{module.title}</h3>{lessons.filter(l => l.module === module.title).map(lesson => {
        const unlocked = lessonUnlocked(lessons, record, lesson.id); const done = record.lessons[lesson.id]?.completed;
        return <button key={lesson.id} disabled={!loaded || !unlocked || saving > 0} onClick={() => void navigate(lesson.id, record.lessons[lesson.id]?.currentStep || 0)} className={lessonId === lesson.id ? 'current' : ''}>{done ? <CheckCircle2 size={14} /> : !unlocked ? <LockKeyhole size={13} /> : <span className="outline-number">{lesson.number}</span>}<span>{lesson.title}</span></button>;
      })}</section>)}</div></details>
      <div className="sidebar-footer"><div className="color-signature" aria-hidden="true"><i /><i /><i /><i /></div><p>Learn. Make. Keep going.</p></div>
    </aside>
    <div className="studio-workspace"><header className="studio-topbar"><div><button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={21} /></button><span>Design Lab</span><ChevronRight size={14} /><strong>{page === 'teacher' ? 'Your classroom' : page === 'help' ? 'Resources & help' : 'One step at a time'}</strong></div><div className="account-tools"><span className={`studio-save ${error ? 'failed' : ''}`} role="status">{saving || Object.keys(drafts).length ? <><LoaderCircle className="spin" size={14} /> Saving…</> : error ? 'Check your connection' : loaded ? <><CloudCheck size={15} /> Saved</> : 'Loading…'}</span><span className="account-name">{user.displayName}</span><button aria-label="Sign out" title="Sign out" onClick={() => void signOut()} disabled={saving > 0}><LogOut size={18} /></button></div></header>
      <main id="main" ref={focusRef} tabIndex={-1} className="studio-main">
        {error && <div className="save-error" role="alert"><span>{error}</span><button onClick={() => void retry()}>Retry</button>{error.includes('session') && <button onClick={() => window.location.reload()}>Sign in again</button>}</div>}
        {page === 'teacher' && user.role === 'teacher' ? <TeacherDashboard /> : page === 'help' ? <Help user={user} onLinked={setUser} /> : !loaded ? <div className="lesson-loading"><LoaderCircle className="spin" /><p>Loading your saved place…</p></div> : <>
          <div className="lesson-heading"><div><p className="studio-eyebrow">LESSON {String(currentLesson.number).padStart(2, '0')} OF 10 <span> / </span> {currentLesson.module.toUpperCase()}</p><h1>{currentLesson.title}</h1><p>{currentLesson.subtitle}</p></div><button className={`notes-button ${notesOpen ? 'active' : ''}`} onClick={() => setNotesOpen(!notesOpen)}><MessageSquare size={17} /><span>My notes</span></button></div>
          {notesOpen && <section className="notes-panel"><div><h2>A note for next time</h2><button aria-label="Close notes" onClick={() => setNotesOpen(false)}><X size={18} /></button></div><p>What do you want to remember when you come back?</p><textarea aria-label="My notes" value={drafts[`${lessonId}:notes`]?.value ?? p.notes} maxLength={2000} onChange={e => editText('notes', e.target.value)} onBlur={() => void flushDrafts()} placeholder="Next class, I want to…" /><small>Your notes save automatically.</small></section>}
          <nav className="guided-steps" aria-label="Lesson steps">{stepNames.map((name, index) => {
            const Icon = stepIcons[index]; const done = index < maxStep || index === 3 && p.completed;
            return <button key={name} aria-current={step === index ? 'step' : undefined} disabled={index > maxStep || saving > 0} className={`${step === index ? 'active' : ''} ${done ? 'done' : ''}`} onClick={() => void navigate(lessonId, index)}><span>{done ? <Check size={15} /> : index > maxStep ? <LockKeyhole size={14} /> : <Icon size={15} />}</span><strong>{name}</strong></button>;
          })}</nav>
          {p.completed && step === 3 ? <section className="completion-panel"><span className="success-icon"><Check size={35} /></span><p className="studio-eyebrow">LESSON COMPLETE</p><h2>{completedCount === 10 ? 'You made it yours.' : 'One more skill. All yours.'}</h2><p>{completedCount === 10 ? 'You’ve completed all ten lessons. Keep experimenting, and share your work with Mr. Romine.' : `You’ve finished ${currentLesson.title.toLowerCase()}. Your next lesson is ready when you are.`}</p>{currentLesson.number < 10 && <button className="primary-button" onClick={() => void navigate(lessons[currentLesson.number].id, 0)}>Next lesson <ArrowRight size={18} /></button>}<button className="quiet-button" onClick={() => void navigate(lessonId, 2)}>Review my work</button></section> : <section className="lesson-stage" key={`${lessonId}-${step}`}>
            {step === 0 && <><div className="stage-label"><BookOpen size={17} /> STEP 1 · LEARN</div><h2>Start with the idea.</h2><div className="learn-layout"><div className="lesson-prose">{currentLesson.summary.map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div><div className="lesson-mini-art"><LessonArt number={currentLesson.number} /></div></div><div className="goals-box"><h3>By the end, you’ll be able to…</h3>{currentLesson.objectives.map(goal => <p key={goal}><CheckCircle2 size={16} />{goal}</p>)}</div><details className="optional-detail"><summary>Words to know <ChevronDown size={16} /></summary><dl>{currentLesson.vocabulary.map(word => <div key={word.term}><dt>{word.term}</dt><dd>{word.definition}</dd></div>)}</dl></details><div className="stage-bottom"><span>Next up: watch the tutorial.</span><button className="primary-button" disabled={saving > 0} onClick={() => void (p.read ? nextStep() : readDone())}>{p.read ? 'Continue to video' : 'I’m ready to watch'} <ArrowRight size={17} /></button></div></>}
            {step === 1 && <><div className="stage-label"><Play size={17} /> STEP 2 · WATCH</div><h2>See it. Then try it.</h2><p className="stage-intro">Watch the tutorial from your saved place. You can pause whenever you need. Your practice tasks open when the video is complete.</p><GuidedVideo lesson={currentLesson} progress={p} onProgress={onVideoProgress} /><a className="companion-strip" href={currentLesson.companionUrl} target="_blank" rel="noopener"><FolderOpen size={23} /><span><strong>Open the companion file</strong><small>Make your own copy in Figma so you can follow along.</small></span><ArrowUpRight size={19} /></a><div className="stage-bottom"><span>{p.watched ? 'Video complete. Time to create.' : 'Finish watching to unlock Build.'}</span><button className="primary-button" disabled={!p.watched || saving > 0} onClick={() => void nextStep()}>{p.watched ? <><span>Start building</span><ArrowRight size={17} /></> : <><LockKeyhole size={15} /> Build locked</>}</button></div></>}
            {step === 2 && <Build lesson={currentLesson} progress={p} busy={saving > 0} onComplete={taskDone} onNext={nextStep} />}
            {step === 3 && <><div className="stage-label"><CheckCircle2 size={17} /> STEP 4 · CHECK</div><h2>Make it count.</h2><p className="stage-intro">Take a moment to check your work, explain one choice, and save the link to what you made.</p><details className="optional-detail"><summary>Check my finished design <ChevronDown size={16} /></summary><ul>{currentLesson.criteria.map(item => <li key={item}>{item}</li>)}</ul></details><section className="check-section"><h3>One quick question</h3><p>{currentLesson.quiz.question}</p><div className="quiz-options">{currentLesson.quiz.options.map((option, index) => <button key={option} className={p.quizAnswer === index ? 'selected' : ''} onClick={() => void savePatch(lessonId, { quizAnswer: index })} disabled={saving > 0}><span>{String.fromCharCode(65 + index)}</span>{option}{p.quizAnswer === index && <Check size={17} />}</button>)}</div>{p.quizAnswer !== null && <p className={`quiz-feedback ${p.quizAnswer === currentLesson.quiz.correctIndex ? 'correct' : ''}`} role="status">{p.quizAnswer === currentLesson.quiz.correctIndex ? <><CheckCircle2 size={17} />{currentLesson.quiz.explanation}</> : 'Take another look and try again. You can keep learning as you go.'}</p>}</section><section className="check-section"><label htmlFor="reflection"><h3>Your design choice</h3><p>{currentLesson.reflectionPrompt}</p></label><textarea id="reflection" value={drafts[`${lessonId}:reflection`]?.value ?? p.reflection} maxLength={2000} onChange={e => editText('reflection', e.target.value)} onBlur={() => void flushDrafts()} placeholder="Explain your thinking in a sentence or two…" /><small>At least 15 characters. Saves automatically.</small></section><section className="check-section"><label htmlFor="project-link"><h3>Your Figma project</h3><p>Paste the link to your own finished design. Give Mr. Romine permission to view it in Figma.</p></label><div className="project-link-row"><input id="project-link" type="url" placeholder="https://www.figma.com/design/…" value={projectDraft} maxLength={2048} onChange={e => { setProjectDraft(e.target.value); setProjectDirty(true); setProjectError(''); }} /><button className="secondary-button" onClick={() => void saveProject()} disabled={saving > 0 || !projectDirty}>Save link</button></div>{projectError && <p className="inline-error" role="alert">{projectError}</p>}{projectDirty && <button className="text-link discard-link" onClick={() => { setProjectDraft(p.projectUrl); setProjectDirty(false); setProjectError(''); }}>Discard unsaved link</button>}{p.projectUrl && !projectDirty && <p className="saved-link"><CheckCircle2 size={15} /> Link saved <a href={p.projectUrl} target="_blank" rel="noopener">Open <ArrowUpRight size={13} /></a></p>}<small>Saving here does not submit an assignment in Google Classroom.</small></section><div className="completion-requirements">{completionIssues(currentLesson, { ...p, reflection: drafts[`${lessonId}:reflection`]?.value ?? p.reflection, projectUrl: projectDraft }).map(issue => <p key={issue}><span />{issue}</p>)}</div><div className="stage-bottom"><span>Finish this lesson to open the next.</span><button className="primary-button" disabled={saving > 0} onClick={() => void finishLesson()}>Complete lesson <Check size={18} /></button></div></>}
          </section>}
          <div className="lesson-subfooter"><span><LockKeyhole size={13} /> Your next step opens when you finish this one.</span><a href={`${courseSource}#${currentLesson.sourceAnchor}`} target="_blank" rel="noopener">Original lesson by Figma <ExternalLink size={12} /></a></div>
        </>}
      </main><footer className="studio-footer"><span>Mr. Romine’s Technology Class</span><span>Small steps. Big ideas.</span></footer>
    </div>
  </div>;
}

function Build({ lesson, progress, busy, onComplete, onNext }: { lesson: Lesson; progress: LessonProgress; busy: boolean; onComplete: (id: string) => Promise<void>; onNext: () => Promise<void> }) {
  const next = lesson.tasks.findIndex(task => !progress.tasks[task.id]);
  const completed = lesson.tasks.filter(task => progress.tasks[task.id]);
  const task = lesson.tasks[next];
  return <><div className="stage-label"><FolderOpen size={17} /> STEP 3 · BUILD</div><h2>{task ? 'Your turn to create.' : 'Your practice is complete.'}</h2><p className="stage-intro">{lesson.deliverable}</p><a className="companion-strip compact" href={lesson.companionUrl} target="_blank" rel="noopener"><FolderOpen size={20} /><span><strong>Open your companion file in Figma</strong><small>Do the activity in your own copy.</small></span><ArrowUpRight size={17} /></a><div className="task-progress"><span>{completed.length} of {lesson.tasks.length} tasks complete</span><progress max={lesson.tasks.length} value={completed.length} /></div>{task && <article className="focused-task"><div className="task-number">{String(next + 1).padStart(2, '0')}</div><div><p className="studio-eyebrow">ONE TASK AT A TIME</p><h3>{task.title}</h3><p>{task.description}</p><button className="primary-button" disabled={busy} onClick={() => void onComplete(task.id)}>I’ve done this in Figma <Check size={17} /></button></div></article>}{completed.length > 0 && <details className="optional-detail"><summary>Completed tasks ({completed.length}) <ChevronDown size={16} /></summary><div className="completed-tasks">{completed.map(item => <article key={item.id}><CheckCircle2 size={16} /><div><strong>{item.title}</strong><p>{item.description}</p></div></article>)}</div></details>}<details className="optional-detail"><summary>Need a hint? <ChevronDown size={16} /></summary>{lesson.troubleshooting.map(hint => <div className="hint" key={hint.problem}><strong>{hint.problem}</strong><p>{hint.solution}</p></div>)}</details>{next === -1 && <div className="stage-bottom"><span>Ready for a final check.</span><button className="primary-button" disabled={busy} onClick={() => void onNext()}>Check my work <ArrowRight size={17} /></button></div>}</>;
}

function Help({ user, onLinked }: { user: User; onLinked: (user: User) => void }) {
  return <div className="help-page"><p className="studio-eyebrow">A LITTLE HELP GOES A LONG WAY</p><h1>Ready when you are.</h1><p>Everything you need to get started and keep going.</p><GoogleAccount user={user} onLinked={onLinked} /><section className="help-card"><h2>Before you begin</h2>{setupSteps.slice(0, 3).map((item, index) => <div className="setup-item" key={item.title}><span>{index + 1}</span><div><h3>{item.title}</h3><p>{item.description}</p></div></div>)}</section><section className="help-card"><h2>Good to know</h2><details><summary>How do I save my progress?</summary><p>Use the same course account each time, with your username and password or your connected Google account. Steps, tasks, video position, notes, and reflections save to your account as you work. Wait for “Saved” before leaving. Sign out when using a shared computer. Your actual Figma designs save separately in Figma.</p></details><details><summary>Why is the next step locked?</summary><p>The course opens one small step at a time. Read the lesson, watch the full video, complete the Figma tasks in order, then finish the check. Complete all four steps to open the next lesson. You can review steps and lessons you’ve already completed.</p></details><details><summary>What if the video will not play?</summary><p>Try the player’s retry button and check your connection. If school filtering still blocks it, ask Mr. Romine. He can arrange an alternative and approve the video step from his teacher dashboard. Students cannot mark a video complete themselves.</p></details><details><summary>Can I stop and come back tomorrow?</summary><p>Yes. Pause the video, leave a short note about what to do next, and wait for your work to save. Next time, use the same class login. The video resumes from the last position the server saved.</p></details><details><summary>I forgot my password.</summary><p>If you connected Google, choose Google on the sign-in screen. For a class password reset, ask Mr. Romine. Your lessons and saved work stay with your account.</p></details><details><summary>Does a saved link turn in my assignment?</summary><p>No. Save the link to your own Figma file here and make sure Mr. Romine can view it. If he also asks you to submit it in Google Classroom, follow those directions.</p></details></section><section className="help-card"><h2>Handy Figma shortcuts</h2><div className="shortcut-list">{[['V', 'Move'], ['F', 'Frame'], ['R', 'Rectangle'], ['O', 'Ellipse'], ['T', 'Text'], ['P', 'Pen'], ['Shift + 2', 'Zoom to selection']].map(([key, text]) => <div key={key}><span>{text}</span><kbd>{key}</kbd></div>)}</div></section><p className="course-credit">Tutorials and companion files are provided by <a href={courseSource} target="_blank" rel="noopener">Figma’s K–12 Design Basics course <ArrowUpRight size={13} /></a>. Classroom activities and the guided learning experience are for Mr. Romine’s Technology Class.</p></div>;
}
