import { useEffect, useState } from 'react';
import { CheckCircle2, Link2 } from 'lucide-react';
import { api, type AuthOptions, type User } from './api';
import GoogleSignIn from './google-signin';

export default function GoogleAccount({ user, onLinked }: { user: User; onLinked: (user: User) => void }) {
  const [options, setOptions] = useState<AuthOptions | null>(null);
  const [connecting, setConnecting] = useState(false);
  useEffect(() => {
    let active = true;
    void api<AuthOptions>('/api/auth/options').then(value => { if (active) setOptions(value); }).catch(() => {});
    return () => { active = false; };
  }, []);
  if (user.role !== 'student' || (!options?.googleEnabled && !user.googleLinked)) return null;
  return <section className="help-card google-account-card"><span className="account-card-icon">{user.googleLinked ? <CheckCircle2 size={23} /> : <Link2 size={23} />}</span><div><h2>{user.googleLinked ? 'Google is connected.' : 'An easier way back.'}</h2>
    {user.googleLinked ? <><p>You can sign in with <strong>{user.googleEmail || 'your connected Google account'}</strong>. Your lessons and saved work stay with this account.</p>{!options?.googleEnabled && <p>Google sign-in is currently unavailable. Use your class username to return.</p>}</> : <><p>Connect your Google account to this course login. You’ll keep all your progress and can use Google the next time you sign in.</p>{options?.googleDomain && <p>Use your {options.googleDomain} school account.</p>}{connecting && options?.googleClientId ? <div className="account-google-button"><GoogleSignIn clientId={options.googleClientId} domain={options.googleDomain} intent="link" onSuccess={onLinked} /></div> : <button type="button" className="secondary-button" onClick={() => setConnecting(true)}><Link2 size={16} /> Connect Google</button>}</>}
  </div></section>;
}
