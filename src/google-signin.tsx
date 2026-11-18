import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, RotateCcw } from 'lucide-react';
import { api, errorMessage, type User } from './api';

type IdentityApi = {
  initialize(options: {
    client_id: string; nonce: string; callback: (response: { credential?: string }) => void;
    ux_mode: 'popup'; auto_select: false; context: 'signin' | 'signup'; hd?: string;
  }): void;
  renderButton(parent: HTMLElement, options: {
    type: 'standard'; theme: 'outline'; size: 'large'; shape: 'pill';
    text: 'signin_with' | 'signup_with' | 'continue_with'; width: number; logo_alignment: 'left';
  }): void;
};

declare global { interface Window { google?: { accounts: { id: IdentityApi } } } }

let sdkPromise: Promise<IdentityApi> | null = null;

function loadGoogle(): Promise<IdentityApi> {
  if (window.google?.accounts.id) return Promise.resolve(window.google.accounts.id);
  if (sdkPromise) return sdkPromise;
  const pending = new Promise<IdentityApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    const fail = () => { clearTimeout(timeout); script.remove(); reject(new Error('Google sign-in could not load. You can use your class username or try Google again.')); };
    const timeout = window.setTimeout(fail, 15_000);
    script.onerror = fail;
    script.onload = () => {
      clearTimeout(timeout);
      if (window.google?.accounts.id) resolve(window.google.accounts.id);
      else fail();
    };
    document.head.append(script);
  });
  sdkPromise = pending;
  void pending.catch(() => { if (sdkPromise === pending) sdkPromise = null; });
  return pending;
}

type Props = {
  clientId: string;
  domain?: string | null;
  intent: 'signin' | 'link';
  signingUp?: boolean;
  classCode?: string;
  onSuccess: (user: User) => void;
  onBusyChange?: (busy: boolean) => void;
};

/** Uses Google's own branded control. Credentials only travel to our same-origin API. */
export default function GoogleSignIn(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const [phase, setPhase] = useState<'loading' | 'ready' | 'submitting' | 'error'>('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let submitted = false;
    setPhase('loading'); setError('');
    const element = container.current;
    element?.replaceChildren();
    void (async () => {
      try {
        // Fetch a fresh browser-bound nonce only when mounting or explicitly retrying.
        const google = await loadGoogle();
        if (!active) return;
        const challenge = await api<{ nonce: string }>('/api/auth/google/challenge', 'POST', { intent: props.intent });
        if (!active || !element) return;
        google.initialize({
          client_id: props.clientId,
          nonce: challenge.nonce,
          ux_mode: 'popup',
          auto_select: false,
          context: props.signingUp ? 'signup' : 'signin',
          ...(props.domain ? { hd: props.domain } : {}),
          callback: response => {
            if (!active || submitted) return;
            submitted = true;
            setPhase('submitting'); latest.current.onBusyChange?.(true);
            void (async () => {
              try {
                if (!response.credential) throw new Error('Google did not return a sign-in. Please try again.');
                const result = await api<{ user: User }>('/api/auth/google', 'POST', {
                  credential: response.credential,
                  ...(latest.current.classCode ? { classCode: latest.current.classCode } : {}),
                });
                if (active) latest.current.onSuccess(result.user);
              } catch (e) {
                if (active) { setError(errorMessage(e)); setPhase('error'); }
              } finally {
                if (active) latest.current.onBusyChange?.(false);
              }
            })();
          },
        });
        google.renderButton(element, {
          type: 'standard', theme: 'outline', size: 'large', shape: 'pill',
          text: props.intent === 'link' ? 'continue_with' : props.signingUp ? 'signup_with' : 'signin_with',
          width: Math.min(400, Math.max(200, Math.floor(element.clientWidth))), logo_alignment: 'left',
        });
        setPhase('ready');
      } catch (e) { if (active) { setError(errorMessage(e)); setPhase('error'); } }
    })();
    return () => { active = false; element?.replaceChildren(); };
  }, [props.clientId, props.domain, props.intent, props.signingUp, attempt]);

  return <div className="google-signin" aria-busy={phase === 'submitting'}>
    <div ref={container} className="google-button-mount" hidden={phase === 'submitting' || phase === 'error'} />
    {(phase === 'loading' || phase === 'submitting') && <p className="google-status" role="status"><LoaderCircle className="spin" size={16} />{phase === 'loading' ? 'Loading Google sign-in…' : 'Signing you in…'}</p>}
    {phase === 'error' && <div className="google-error"><p className="inline-error" role="alert">{error}</p><button type="button" className="text-link" onClick={() => setAttempt(value => value + 1)}><RotateCcw size={14} /> Try Google again</button></div>}
  </div>;
}
