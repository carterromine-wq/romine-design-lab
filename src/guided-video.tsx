import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, Pause, Play } from 'lucide-react';
import type { Lesson } from '../course-data';
import type { LessonProgress } from './progress-model';

type PlaybackState = 'playing' | 'paused' | 'buffering' | 'ended';
type Phase = 'loading' | 'ready' | PlaybackState | 'error';
type VideoReply = {
  token?: string;
  verifiedSeconds: number;
  duration: number;
  watched: boolean;
  progress: LessonProgress;
  seekTo?: number;
};
type Sample = { position: number; state: PlaybackState; visible: boolean };
type YouTubePlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getPlaybackRate(): number;
  setPlaybackRate(rate: number): void;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
};
type PlayerOptions = {
  videoId: string;
  host: string;
  width: string;
  height: string;
  playerVars: Record<string, string | number>;
  events: {
    onReady(event: { target: YouTubePlayer }): void;
    onStateChange(event: { target: YouTubePlayer; data: number }): void;
    onPlaybackRateChange(event: { target: YouTubePlayer; data: number }): void;
    onError(event: { data: number }): void;
  };
};

declare global {
  interface Window {
    YT?: { Player: new (element: HTMLElement, options: PlayerOptions) => YouTubePlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const script = document.createElement('script');
    const fail = () => {
      clearTimeout(timeout);
      if (window.onYouTubeIframeAPIReady === ready) window.onYouTubeIframeAPIReady = previous;
      script.remove();
      reject(new Error('The tutorial could not load. Check your connection or ask Mr. Romine about school video access.'));
    };
    const ready = () => {
      clearTimeout(timeout);
      try { previous?.(); } catch { /* Other embeds must not block this one. */ }
      resolve();
    };
    const timeout = window.setTimeout(fail, 18000);
    window.onYouTubeIframeAPIReady = ready;
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch(error => {
    apiPromise = null;
    throw error;
  });
  return apiPromise;
}

async function postVideo(path: string, body: object): Promise<VideoReply> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      keepalive: true,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({})) as VideoReply & { error?: string };
    if (!response.ok) throw new Error(data.error || 'Video progress could not be saved. Please try again.');
    if (!Number.isFinite(data.verifiedSeconds) || !Number.isFinite(data.duration) || data.duration <= 0 || !data.progress) {
      throw new Error('Video progress could not be confirmed. Please try again.');
    }
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The connection timed out. Your saved place is safe; try again to resume.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function clock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

export type GuidedVideoProps = {
  lesson: Lesson;
  progress: LessonProgress;
  onProgress: (progress: LessonProgress) => void;
};

/**
 * The server decides completion. This component only reports playback samples.
 * All custom controls sit outside the official iframe; no branding or player
 * content is covered. YouTube links remain controlled by YouTube itself.
 */
export default function GuidedVideo({ lesson, progress, onProgress }: GuidedVideoProps) {
  const mount = useRef<HTMLDivElement>(null);
  const action = useRef<() => Promise<void>>(async () => {});
  const latestProgress = useRef(progress);
  const onProgressRef = useRef(onProgress);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [verified, setVerified] = useState(progress.verifiedSeconds || 0);
  const [duration, setDuration] = useState(progress.videoDuration || 0);
  const [complete, setComplete] = useState(progress.watched);

  latestProgress.current = progress;
  onProgressRef.current = onProgress;

  useEffect(() => {
    setVerified(progress.verifiedSeconds || 0);
    setDuration(progress.videoDuration || 0);
    setComplete(progress.watched);
  }, [progress.verifiedSeconds, progress.videoDuration, progress.watched]);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let alive = true;
    let player: YouTubePlayer | null = null;
    let playerReady = false;
    let token: string | null = null;
    let starting: Promise<void> | null = null;
    let reporting = false;
    let queued: Sample | null = null;
    let failed = false;
    let confirmed = latestProgress.current.verifiedSeconds || 0;
    let canonicalDuration = latestProgress.current.videoDuration || 0;
    let watched = latestProgress.current.watched;
    let currentRevision = latestProgress.current.revision || 0;
    let frontier = confirmed;
    let anchorPosition = confirmed;
    let anchorTime = performance.now();
    let lastPosition = confirmed;
    let lastTick = performance.now();
    let lastReport = 0;
    let suppressUntil = 0;

    setPhase('loading');
    setMessage('');
    setBusy(false);
    setVerified(confirmed);
    setDuration(canonicalDuration);
    setComplete(watched);

    const position = () => Math.max(0, Number(player?.getCurrentTime()) || 0);
    const visible = () => document.visibilityState === 'visible';
    const state = (): PlaybackState => {
      switch (player?.getPlayerState()) {
        case 1: return 'playing';
        case 3: return 'buffering';
        case 0: return 'ended';
        default: return 'paused';
      }
    };
    const apply = (reply: VideoReply) => {
      if (!alive) return false;
      const latest = latestProgress.current;
      if (reply.progress.revision < Math.max(currentRevision, latest.revision)) {
        if (latest.revision > currentRevision) {
          currentRevision = latest.revision;
          confirmed = latest.verifiedSeconds;
          canonicalDuration = latest.videoDuration || canonicalDuration;
          watched = latest.watched;
        }
        return false;
      }
      currentRevision = reply.progress.revision;
      confirmed = reply.verifiedSeconds;
      canonicalDuration = reply.duration;
      watched = reply.watched;
      setVerified(confirmed);
      setDuration(canonicalDuration);
      setComplete(watched);
      onProgressRef.current(reply.progress);
      return true;
    };
    const seek = (seconds: number) => {
      if (!player || !playerReady) return;
      player.seekTo(seconds, true);
      frontier = seconds;
      lastPosition = seconds;
      anchorPosition = seconds;
      anchorTime = performance.now();
      lastTick = anchorTime;
      suppressUntil = anchorTime + 600;
    };
    const fail = (error: unknown) => {
      if (!alive) return;
      failed = true;
      queued = null;
      player?.pauseVideo();
      setPhase('error');
      setBusy(false);
      setMessage(error instanceof Error ? error.message : 'The video could not continue. Please try again.');
    };

    const send = async (sample: Sample): Promise<void> => {
      if (!alive || !token || failed) return;
      if (reporting) { queued = sample; return; }
      reporting = true;
      const thisToken = token;
      try {
        const reply = await postVideo('/api/video/heartbeat', { lessonId: lesson.id, token: thisToken, ...sample });
        if (!alive || token !== thisToken) return;
        const accepted = apply(reply);
        if (accepted && typeof reply.seekTo === 'number') {
          queued = null;
          seek(reply.seekTo);
          setMessage('Continue from your saved place. Skipped time does not count.');
        }
      } catch (error) { fail(error); }
      finally {
        reporting = false;
        const next = queued;
        queued = null;
        if (next && alive && !failed) void send(next);
      }
    };
    const report = (override?: PlaybackState) => {
      if (!playerReady || !token || failed) return;
      lastReport = performance.now();
      void send({ position: position(), state: override || state(), visible: visible() });
    };
    const startSession = async () => {
      if (token) return;
      if (starting) return starting;
      const work = async () => {
        const reply = await postVideo('/api/video/start', { lessonId: lesson.id });
        if (!alive) return;
        if (!reply.token) throw new Error('The video session could not start. Please try again.');
        token = reply.token;
        apply(reply);
        seek(watched ? 0 : confirmed);
      };
      starting = work();
      try { await starting; } finally { starting = null; }
    };

    const begin = async () => {
      if (!playerReady || !player || failed || !visible()) return;
      setBusy(true);
      setMessage('');
      try {
        await startSession();
        if (!alive || !player || failed) return;
        if (player.getPlayerState() === 0) seek(watched ? 0 : confirmed);
        if (player.getPlaybackRate() !== 1) player.setPlaybackRate(1);
        anchorTime = performance.now();
        anchorPosition = performance.now() < suppressUntil ? frontier : Math.min(position(), frontier);
        player.playVideo();
      } catch (error) { fail(error); }
      finally { if (alive) setBusy(false); }
    };

    action.current = async () => {
      if (!playerReady || !player || failed) return;
      if (player.getPlayerState() === 1 || player.getPlayerState() === 3) {
        player.pauseVideo();
        report('paused');
        setPhase('paused');
      } else await begin();
    };

    const onVisibility = () => {
      if (visible() || !playerReady || !player) return;
      player.pauseVideo();
      report('paused');
      if (!failed) {
        setPhase('paused');
        setMessage('Paused while this tab is away. Press Play when you are ready.');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onVisibility);

    const timer = window.setInterval(() => {
      if (!playerReady || !player || !token || failed) return;
      const now = performance.now();
      const current = position();
      const currentState = state();
      if (currentState === 'playing' && visible()) {
        if (player.getPlaybackRate() !== 1) player.setPlaybackRate(1);
        const jumpAllowance = Math.max(1.4, (now - lastTick) / 1000 + 0.7);
        const naturalLimit = anchorPosition + (now - anchorTime) / 1000 + 1.4;
        if (!watched && now > suppressUntil && (current > frontier + jumpAllowance || current > naturalLimit)) {
          seek(Math.max(confirmed, Math.min(frontier, canonicalDuration)));
          setMessage('Continue from your saved place. Skipped time does not count.');
          report('playing');
        } else {
          if (current < lastPosition - 1.4) {
            anchorPosition = current;
            anchorTime = now;
          }
          frontier = Math.max(frontier, current);
          lastPosition = current;
          if (now - lastReport >= 3000) report('playing');
        }
      }
      lastTick = now;
    }, 250);

    const readyTimeout = window.setTimeout(() => {
      if (!playerReady) fail(new Error('The video player is taking too long to load. Try again, or ask Mr. Romine to check video access.'));
    }, 25000);

    void loadYouTubeAPI().then(() => {
      if (!alive || !window.YT?.Player) return;
      // YouTube owns and replaces this child. React owns only the outer host.
      const child = document.createElement('div');
      host.replaceChildren(child);
      player = new window.YT.Player(child, {
        videoId: lesson.videoId,
        host: 'https://www.youtube-nocookie.com',
        width: '100%',
        height: '100%',
        playerVars: {
          controls: 0, disablekb: 1, fs: 0, playsinline: 1,
          cc_load_policy: 1, cc_lang_pref: 'en', rel: 0,
          autoplay: 0, origin: window.location.origin,
        },
        events: {
          onReady: event => {
            if (!alive) return;
            player = event.target;
            playerReady = true;
            clearTimeout(readyTimeout);
            const iframe = player.getIframe();
            iframe.title = `${lesson.title} — Figma tutorial`;
            iframe.referrerPolicy = 'strict-origin-when-cross-origin';
            player.setPlaybackRate(1);
            setPhase('ready');
          },
          onStateChange: event => {
            if (!alive || failed || !playerReady) return;
            if (event.data === 1) {
              if (!token) {
                event.target.pauseVideo();
                void begin();
                return;
              }
              if (!visible()) { onVisibility(); return; }
              const current = position();
              if (!watched && current > frontier + 1.4) seek(Math.max(frontier, confirmed));
              anchorPosition = performance.now() < suppressUntil ? frontier : Math.min(position(), frontier);
              anchorTime = performance.now();
              const actualDuration = event.target.getDuration();
              if (canonicalDuration && actualDuration > 0 && Math.abs(actualDuration - canonicalDuration) > 2) {
                fail(new Error('This tutorial has changed. Ask Mr. Romine to check its video requirement.'));
                return;
              }
              setPhase('playing');
              report('playing');
            } else if (event.data === 2) {
              setPhase('paused');
              report('paused');
            } else if (event.data === 3) {
              setPhase('buffering');
              report('buffering');
            } else if (event.data === 0) {
              setPhase('ended');
              report('ended');
            }
          },
          onPlaybackRateChange: event => {
            if (alive && event.data !== 1) event.target.setPlaybackRate(1);
          },
          onError: event => {
            fail(new Error(event.data === 100 || event.data === 101 || event.data === 150
              ? 'This tutorial is unavailable in the embedded player. Ask Mr. Romine for help with this step.'
              : 'The tutorial could not play. Try again, or ask Mr. Romine to check school video access.'));
          },
        },
      });
    }).catch(fail);

    return () => {
      if (token && playerReady && !failed) {
        // Best effort on navigation; frequent confirmed samples remain durable.
        void postVideo('/api/video/heartbeat', {
          lessonId: lesson.id, token, position: position(), state: 'paused', visible: visible(),
        }).catch(() => {});
      }
      alive = false;
      action.current = async () => {};
      clearInterval(timer);
      clearTimeout(readyTimeout);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onVisibility);
      player?.destroy();
      host.replaceChildren();
    };
  }, [lesson.id, lesson.videoId, lesson.title, attempt]);

  const percent = complete ? 100 : duration ? Math.min(99, Math.floor(verified / duration * 100)) : 0;
  const isPlaying = phase === 'playing' || phase === 'buffering';
  return <div className="guided-video">
    <div className="guided-video-frame" ref={mount} />
    <div className="guided-video-controls">
      <button className="button dark" type="button" disabled={phase === 'loading' || phase === 'error' || busy}
        onClick={() => void action.current()} aria-label={isPlaying ? 'Pause tutorial' : 'Play tutorial'}>
        {busy || phase === 'loading' ? <LoaderCircle size={17} className="spin" /> : isPlaying ? <Pause size={17} /> : <Play size={17} />}
        {busy ? 'Starting…' : phase === 'loading' ? 'Loading tutorial…' : isPlaying ? 'Pause' : phase === 'ended' && complete ? 'Replay tutorial' : verified > 0 && !complete ? 'Resume video' : 'Play video'}
      </button>
      <span className="guided-video-time">{clock(complete ? Math.ceil(duration) : verified)}{duration > 0 ? ` / ${clock(Math.ceil(duration))}` : ''} watched</span>
      {complete && <span className="guided-video-complete"><CheckCircle2 size={17} /> Video complete</span>}
    </div>
    <div className="guided-video-progress" role="progressbar" aria-label="Saved video progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <span style={{ width: `${percent}%` }} />
    </div>
    <p className="guided-video-caption">Captions are on when available. Pause anytime. Your place saves as you watch.</p>
    {phase === 'buffering' && <p className="guided-video-message" role="status">Waiting for the video to load…</p>}
    {message && <div className={`guided-video-message ${phase === 'error' ? 'video-error' : ''}`} role={phase === 'error' ? 'alert' : 'status'}>
      {phase === 'error' && <AlertCircle size={17} />}
      <span>{message}</span>
      {phase === 'error' && <button className="text-link" type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button>}
    </div>}
    {!complete && <p className="guided-video-next">Finish the tutorial to unlock Build.</p>}
  </div>;
}
