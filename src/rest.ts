import { useEffect, useRef, useState } from 'preact/hooks';
import type { Settings } from './db';

export interface RestState {
  start: number; // ms epoch
  total: number; // seconds
}

export interface RestApi {
  state: RestState | null;
  now: number;
  start: () => void;
  adjust: (deltaSec: number) => void;
  restart: () => void;
  skip: () => void;
}

const KEY = 'workout-rest';

function load(): RestState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as RestState;
    // keep a finished timer on screen ("พักครบแล้ว") until dismissed; drop only very stale ones
    if (s.start + s.total * 1000 < Date.now() - 3 * 3600 * 1000) return null;
    return s;
  } catch {
    return null;
  }
}

let ctx: AudioContext | null = null;

/** Call from a tap handler so the browser allows sound later. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* ignore */
  }
}

export function beep() {
  try {
    unlockAudio();
    const c = ctx!;
    [0, 0.3, 0.6].forEach((t) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.25;
      o.connect(g);
      g.connect(c.destination);
      o.start(c.currentTime + t);
      o.stop(c.currentTime + t + 0.18);
    });
  } catch {
    /* ignore */
  }
  try {
    navigator.vibrate?.([300, 150, 300, 150, 300]);
  } catch {
    /* ignore */
  }
}

export function useRest(settings: Settings | null): RestApi {
  const [state, setState] = useState<RestState | null>(load);
  const [now, setNow] = useState(Date.now());
  const fired = useRef<string>('');

  useEffect(() => {
    try {
      if (state) localStorage.setItem(KEY, JSON.stringify(state));
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    if (!state) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const end = state.start + state.total * 1000;
    const key = `${state.start}:${state.total}`;
    if (now >= end && fired.current !== key) {
      fired.current = key;
      // only alert if it just ended, not when reopening the app much later
      if (Date.now() - end < 4000) beep();
    }
  }, [now, state]);

  const clamp = (sec: number) => {
    const min = settings?.restMin ?? 90;
    const max = settings?.restMax ?? 180;
    return Math.min(max, Math.max(min, sec));
  };

  return {
    state,
    now,
    start: () => {
      setNow(Date.now());
      setState({ start: Date.now(), total: clamp(settings?.restDefault ?? 120) });
    },
    // during a rest the range is looser (30 s to 5 min) so short corrections always work
    adjust: (d) =>
      setState((s) => (s ? { ...s, total: Math.min(300, Math.max(30, s.total + d)) } : s)),
    restart: () => {
      setNow(Date.now());
      setState({ start: Date.now(), total: clamp(settings?.restDefault ?? 120) });
    },
    skip: () => setState(null),
  };
}
