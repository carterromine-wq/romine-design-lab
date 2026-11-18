import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, CloudCheck, LoaderCircle, LockKeyhole, UserPlus } from 'lucide-react';
import { courseSource } from '../course-data';
import { api, errorMessage, type AuthOptions, type User } from './api';
import { HeroArt } from './lesson-art';
import GoogleSignIn from './google-signin';

export default function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [options, setOptions] = useState<AuthOptions | null>(null);
  const [optionsError, setOptionsError] = useState('');
  const [optionsAttempt, setOptionsAttempt] = useState(0);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState('');
  const signingUp = mode === 'signup';
  const blocked = busy || googleBusy;
  const canRegister = options?.registrationEnabled === true;
  const hasCode = classCode.replace(/[\s-]/g, '').length >= 10;

  useEffect(() => {
    let active = true;
    setOptionsError('');
    void api<AuthOptions>('/api/auth/options').then(data => { if (active) setOptions(data); }).catch(e => { if (active) setOptionsError(errorMessage(e)); });
    return () => { active = false; };
  }, [optionsAttempt]);

  const changeMode = (next: typeof mode) => {
    setMode(next); setError(''); setPassword(''); setConfirmation('');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (signingUp && !hasCode) { setError('Enter the class code Mr. Romine shared with you.'); return; }
    if (signingUp && password !== confirmation) { setError('Your passwords do not match. Enter them again.'); return; }
    setBusy(true);
    try {
      const result = await api<{ user: User }>(signingUp ? '/api/auth/register' : '/api/auth/login', 'POST', signingUp
        ? { username: username.trim(), displayName: displayName.trim(), password, classCode: classCode.trim() }
        : { username: username.trim(), password });
      setPassword(''); setConfirmation(''); onLogin(result.user);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  return <main className="login-page">
    <header className="login-header"><div className="studio-brand"><span className="studio-monogram">mr.</span><div><strong>Mr. Romine’s</strong><small>TECHNOLOGY CLASS</small></div></div><span>Figma Design Lab</span></header>
    <div className={`login-grid ${signingUp ? 'signup-grid' : ''}`}>
      <section className="login-story"><p className="studio-eyebrow">BIG IDEAS. SMALL STEPS.</p><h1>Learn design.<br /><span>Make it yours.</span></h1><p>One lesson. One step. Something new to create.</p><div className="login-art"><HeroArt /></div><div className="color-signature" aria-hidden="true"><i /><i /><i /><i /></div></section>
      <section className="login-card" aria-labelledby="login-title">
        <div className="auth-tabs" role="tablist" aria-label="Class account"><button id="signin-tab" type="button" role="tab" aria-selected={!signingUp} aria-controls="auth-panel" disabled={blocked} onClick={() => changeMode('signin')}>Sign in</button><button id="signup-tab" type="button" role="tab" aria-selected={signingUp} aria-controls="auth-panel" disabled={blocked} onClick={() => changeMode('signup')}>Create account</button></div>
        <div id="auth-panel" role="tabpanel" aria-labelledby={signingUp ? 'signup-tab' : 'signin-tab'}>
          <span className={`login-icon ${signingUp ? 'signup-icon' : ''}`}>{signingUp ? <UserPlus size={24} /> : <LockKeyhole size={24} />}</span>
          <h2 id="login-title">{signingUp ? 'Join your class.' : 'Welcome back.'}</h2>
          <p className="auth-intro">{signingUp ? 'Use the class code from Mr. Romine to create your own student account.' : 'Sign in to pick up right where you left off.'}</p>
          {signingUp && !options && !optionsError && <p className="google-status" role="status"><LoaderCircle className="spin" size={16} /> Checking class sign-ups…</p>}
          {signingUp && options && !canRegister && <div className="enrollment-paused"><LockKeyhole size={23} /><h3>Sign-ups are paused.</h3><p>Ask Mr. Romine to open sign-ups for your class. If you already have an account, you can sign in.</p><button className="secondary-button" type="button" onClick={() => changeMode('signin')}>Go to sign in <ArrowRight size={15} /></button></div>}
          {optionsError && <div className="auth-options-error"><p role="status">Student sign-up options could not load. Username sign-in is still available.</p><button type="button" className="text-link" onClick={() => setOptionsAttempt(value => value + 1)}>Try loading options again</button></div>}
          {(!signingUp || canRegister) && <>
            {signingUp && <div className="class-code-entry"><label htmlFor="class-code">Class code</label><input id="class-code" form="class-auth-form" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={classCode} onChange={e => setClassCode(e.target.value.toUpperCase())} maxLength={24} required disabled={blocked} placeholder="Your class code" /><small>Ask Mr. Romine for your code.</small></div>}
            {options?.googleEnabled && options.googleClientId && <div className="google-auth-option">
              {(!signingUp || hasCode) ? <GoogleSignIn key={mode} clientId={options.googleClientId} domain={options.googleDomain} intent="signin" signingUp={signingUp} classCode={signingUp ? classCode : undefined} onSuccess={onLogin} onBusyChange={setGoogleBusy} /> : <p className="google-code-hint">Enter your class code above to sign up with Google.</p>}
              {options.googleDomain && <p className="auth-small">Use your {options.googleDomain} school account.</p>}
              <div className="auth-divider"><span>{signingUp ? 'or create a username' : 'or use your username'}</span></div>
            </div>}
            <form id="class-auth-form" onSubmit={submit}>
              {signingUp && <><label htmlFor="display-name">Your name</label><input id="display-name" autoComplete="name" value={displayName} onChange={e => setDisplayName(e.target.value)} required maxLength={80} disabled={blocked} placeholder="The name Mr. Romine knows you by" /></>}
              <label htmlFor="username">Username</label><input id="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={e => setUsername(e.target.value)} required minLength={signingUp ? 3 : undefined} maxLength={40} disabled={blocked} autoFocus={!signingUp} />
              {signingUp && <small>3–40 letters, numbers, periods, underscores, or hyphens.</small>}
              <label htmlFor="password">{signingUp ? 'Create a password' : 'Password'}</label><input id="password" type="password" autoComplete={signingUp ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={signingUp ? 10 : undefined} maxLength={signingUp ? 128 : 256} disabled={blocked} />
              {signingUp && <><small>Use at least 10 characters.</small><label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} required minLength={10} maxLength={128} disabled={blocked} /></>}
              {error && <p className="inline-error" role="alert">{error}</p>}
              <button className="primary-button" disabled={blocked}>{busy ? <LoaderCircle className="spin" size={18} /> : <>{signingUp ? 'Create my account' : 'Let’s get started'} <ArrowRight size={18} /></>}</button>
            </form>
          </>}
          <p className="login-help">{signingUp ? <><strong>Already started the course?</strong> Sign in to your existing account. You can connect Google from Resources & help.</> : <>Forgot your login? Ask Mr. Romine to reset it.</>}</p>
          <div className="login-note"><CloudCheck size={17} /><span>Saved to your account. Ready for next class.</span></div>
        </div>
      </section>
    </div><footer className="login-footer">Mr. Romine’s Technology Class <span>Original tutorials by <a href={courseSource} target="_blank" rel="noopener">Figma <ArrowUpRight size={12} /></a></span></footer>
  </main>;
}
