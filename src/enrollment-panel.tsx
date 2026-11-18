import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Check, Copy, Link2, LoaderCircle, RotateCcw, UserPlus } from 'lucide-react';
import { api, errorMessage } from './api';

type Enrollment = { enabled: boolean; joinCode: string; googleEnabled: boolean; googleDomain: string | null };

export default function EnrollmentPanel() {
  const [settings, setSettings] = useState<Enrollment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmRotate, setConfirmRotate] = useState(false);
  const classUrl = window.location.origin;
  const load = useCallback(async () => {
    setError('');
    try { setSettings(await api<Enrollment>('/api/admin/enrollment')); }
    catch (e) { setError(errorMessage(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const copy = async (value: string, label: string) => {
    try { await navigator.clipboard.writeText(value); setNotice(`${label} copied.`); }
    catch { setNotice(`Select the ${label.toLowerCase()} below to copy it manually.`); }
  };
  const update = async (rotate: boolean) => {
    if (!settings) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const next = await api<Enrollment>(rotate ? '/api/admin/enrollment/rotate' : '/api/admin/enrollment', rotate ? 'POST' : 'PATCH', rotate ? {} : { enabled: !settings.enabled });
      setSettings(next); setConfirmRotate(false);
      setNotice(rotate ? 'A new class code is ready. Share it with students who still need an account.' : next.enabled ? 'Student sign-ups are open.' : 'New sign-ups are paused. Existing students can still sign in.');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  return <section className="enrollment-card" aria-labelledby="enrollment-title">
    <div className="enrollment-heading"><span className="enrollment-icon"><UserPlus size={24} /></span><div><p className="studio-eyebrow">ONE INVITE. THE WHOLE CLASS.</p><h2 id="enrollment-title">Let students join.</h2><p>Share your website and class code. Students choose Create account and take it from there.</p></div>{settings && <span className={`enrollment-status ${settings.enabled ? 'is-open' : ''}`}><i />{settings.enabled ? 'Sign-ups open' : 'Sign-ups paused'}</span>}</div>
    {!settings && !error && <p className="google-status" role="status"><LoaderCircle className="spin" size={16} /> Loading your class invite…</p>}
    {settings && <>
      <div className="enrollment-share-grid"><div className="enrollment-code"><div className="enrollment-field-label"><label htmlFor="teacher-class-code">Class code</label><button type="button" className="text-link" onClick={() => void copy(settings.joinCode, 'Class code')}><Copy size={14} /> Copy</button></div><input id="teacher-class-code" value={settings.joinCode} readOnly onFocus={e => e.target.select()} autoComplete="off" spellCheck={false} aria-describedby="class-code-privacy" /><small id="class-code-privacy">Share with your class. This code creates student accounts.</small></div><div className="enrollment-url"><div className="enrollment-field-label"><label htmlFor="teacher-class-url">Class website</label><button type="button" className="text-link" onClick={() => void copy(classUrl, 'Class link')}><Copy size={14} /> Copy link</button></div><input id="teacher-class-url" value={classUrl} readOnly onFocus={e => e.target.select()} /><small>Post this link in Google Classroom.</small></div></div>
      <div className="enrollment-controls"><button type="button" className="secondary-button small" disabled={busy} onClick={() => void update(false)}>{busy ? <LoaderCircle size={15} className="spin" /> : settings.enabled ? 'Pause sign-ups' : 'Open sign-ups'}</button><button type="button" className="quiet-button" disabled={busy} onClick={() => setConfirmRotate(true)}><RotateCcw size={14} /> New class code</button><p>Changing the code or pausing sign-ups keeps existing accounts and progress.</p></div>
      {confirmRotate && <div className="rotate-confirm"><p>Create a new code? The current code will stop working for new sign-ups.</p><div><button type="button" className="primary-button" disabled={busy} onClick={() => void update(true)}>Create new code</button><button type="button" className="quiet-button" disabled={busy} onClick={() => setConfirmRotate(false)}>Keep current code</button></div></div>}
      <div className="enrollment-google"><span className={`provider-mark ${settings.googleEnabled ? 'is-ready' : ''}`}>{settings.googleEnabled ? <Check size={16} /> : <Link2 size={16} />}</span><div><strong>{settings.googleEnabled ? 'Google sign-in is ready.' : 'Google sign-in is ready to connect.'}</strong><p>{settings.googleEnabled ? settings.googleDomain ? `Students can use their ${settings.googleDomain} Google account with this class code.` : 'Students can use Google with this class code, or choose a username and password.' : 'Complete the one-time Google setup to offer school-account sign-in. Username sign-up is available now.'}</p></div>{!settings.googleEnabled && <a className="text-link" href="https://github.com/carterromine-wq/romine-design-lab/blob/main/docs/GOOGLE_SIGN_IN.md" target="_blank" rel="noopener">Google setup <ArrowUpRight size={13} /></a>}</div>
    </>}
    {notice && <p className="enrollment-notice" role="status"><Check size={15} />{notice}</p>}
    {error && <div className="enrollment-error"><p className="inline-error" role="alert">{error}</p><button type="button" className="text-link" onClick={() => void load()}>Retry</button></div>}
  </section>;
}
