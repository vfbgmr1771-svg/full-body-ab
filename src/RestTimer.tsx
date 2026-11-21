import { useState } from 'preact/hooks';
import type { RestApi } from './rest';

export function RestBar({ rest }: { rest: RestApi }) {
  const [collapsed, setCollapsed] = useState(false);
  const s = rest.state;
  if (!s) return null;
  const end = s.start + s.total * 1000;
  const left = Math.max(0, Math.ceil((end - rest.now) / 1000));
  const done = left === 0;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  const clock = new Date(end).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  return (
    <div class={`restbar${done ? ' done' : ''}${collapsed ? ' mini' : ''}`} role="timer">
      <button
        type="button"
        class="rest-main"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'ขยายตัวจับเวลา' : 'ย่อตัวจับเวลา'}
      >
        <span class="rest-label">{done ? 'พักครบแล้ว' : 'พัก'}</span>
        <span class="rest-time">
          {mm}:{ss}
        </span>
        <span class="rest-end">ถึง {clock}</span>
      </button>
      {collapsed ? (
        <button type="button" class="rest-btn" onClick={rest.skip}>
          ข้าม
        </button>
      ) : (
        <div class="rest-btns">
          <button type="button" class="rest-btn" onClick={() => rest.adjust(-15)}>
            −15
          </button>
          <button type="button" class="rest-btn" onClick={() => rest.adjust(15)}>
            +15
          </button>
          <button type="button" class="rest-btn" onClick={rest.restart} aria-label="เริ่มนับใหม่">
            ↻
          </button>
          <button type="button" class="rest-btn" onClick={rest.skip}>
            ข้าม
          </button>
        </div>
      )}
    </div>
  );
}
