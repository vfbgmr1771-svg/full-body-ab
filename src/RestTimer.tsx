import { useEffect, useRef } from 'preact/hooks';
import type { Settings } from './db';
import type { RestApi } from './rest';
import { Ring } from './ui';
import { IconSkip } from './icons';

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/**
 * Big timer card at the top of the workout. It is always there (idle, running or done) so the
 * page never jumps when a set is checked. `onVisible` tells the parent when it scrolled away.
 */
export function RestPanel({
  rest,
  settings,
  onVisible,
}: {
  rest: RestApi;
  settings: Settings;
  onVisible: (v: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onVisible);
  cb.current = onVisible;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => cb.current(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const s = rest.state;
  const total = s ? s.total : settings.restDefault;
  const end = s ? s.start + s.total * 1000 : 0;
  const left = s ? Math.max(0, Math.ceil((end - rest.now) / 1000)) : total;
  const done = !!s && left === 0;
  const running = !!s && !done;

  return (
    <section class={`restpanel${done ? ' done' : ''}`} ref={ref} role="timer" aria-label="ตัวจับเวลาพัก">
      <div class="rp-row">
        <button
          type="button"
          class="round"
          disabled={!running}
          aria-label="ลดเวลาพัก 15 วินาที"
          onClick={() => rest.adjust(-15)}
        >
          −15
        </button>
        <Ring
          pct={running ? left / total : done ? 0 : 1}
          size={124}
          stroke={9}
          color="#111318"
          track="rgba(255,255,255,0.6)"
          label={`เหลือ ${mmss(left)}`}
        >
          <span class="rp-time">{mmss(left)}</span>
          <span class="rp-sub">{done ? 'พักครบแล้ว' : running ? `ถึง ${clock(end)}` : 'พัก'}</span>
        </Ring>
        <button
          type="button"
          class="round"
          disabled={!running}
          aria-label="เพิ่มเวลาพัก 15 วินาที"
          onClick={() => rest.adjust(15)}
        >
          +15
        </button>
      </div>
      {running ? (
        <button type="button" class="rp-pill" onClick={rest.skip}>
          <IconSkip size={18} /> ข้ามการพัก
        </button>
      ) : (
        <button type="button" class="rp-pill" onClick={rest.restart}>
          {done ? 'เริ่มพักใหม่' : 'เริ่มพัก'}
        </button>
      )}
    </section>
  );
}

/** Slim bar pinned to the bottom, shown only while the big card is scrolled out of view. */
export function RestMini({ rest }: { rest: RestApi }) {
  const s = rest.state;
  if (!s) return null;
  const end = s.start + s.total * 1000;
  const left = Math.max(0, Math.ceil((end - rest.now) / 1000));
  const done = left === 0;
  return (
    <div class={`restbar${done ? ' done' : ''}`} role="timer">
      <div class="rest-main">
        <span class="rest-label">{done ? 'พักครบแล้ว' : 'พัก'}</span>
        <span class="rest-time">{mmss(left)}</span>
      </div>
      <div class="rest-btns">
        <button type="button" class="rest-btn" onClick={() => rest.adjust(-15)}>
          −15
        </button>
        <button type="button" class="rest-btn" onClick={() => rest.adjust(15)}>
          +15
        </button>
        <button type="button" class="rest-btn" onClick={rest.skip}>
          ข้าม
        </button>
      </div>
    </div>
  );
}
