import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { fmtWeight, type RecStatus, type Recommendation } from './logic';
import { IconArrowDown, IconArrowUp, IconDot } from './icons';

export const STATUS_TEXT: Record<RecStatus, string> = {
  up: 'เพิ่มน้ำหนัก',
  same: 'เพิ่มจำนวนครั้ง',
  down: 'ลดน้ำหนัก',
  new: 'ใส่น้ำหนักเอง',
};

export function StatusIcon({ status, size = 16 }: { status: RecStatus; size?: number }) {
  if (status === 'up') return <IconArrowUp size={size} />;
  if (status === 'down') return <IconArrowDown size={size} />;
  return <IconDot size={size} />;
}

/** Sets the stagger index used by CSS (`animation-delay: calc(var(--i) * …)`). */
export const stagger = (i: number) => ({ '--i': i }) as unknown as preact.JSX.CSSProperties;

/** Circular progress. pct is 0..1; children are drawn in the middle. */
export function Ring(props: {
  pct: number;
  size: number;
  stroke: number;
  color: string;
  track: string;
  label?: string;
  children?: ComponentChildren;
}) {
  const { size, stroke } = props;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, props.pct));
  return (
    <div class="ring" style={{ width: size, height: size }} role="img" aria-label={props.label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={props.track} stroke-width={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={props.color}
          stroke-width={stroke}
          stroke-linecap="round"
          style={{ strokeDasharray: c, strokeDashoffset: c * (1 - p) }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div class="ring-in">{props.children}</div>
    </div>
  );
}

export function Badge({ rec, long }: { rec: Recommendation; long?: boolean }) {
  const w = rec.weight;
  let cls = 'new';
  let text = 'ใหม่';
  if (rec.status === 'up') {
    cls = 'up';
    text = long ? '⬆ เพิ่มน้ำหนัก' : `⬆ ${fmtWeight(w)}`;
  } else if (rec.status === 'same') {
    cls = 'same';
    text = long ? '● เพิ่มจำนวนครั้ง' : `● ${fmtWeight(w)}`;
  } else if (rec.status === 'down') {
    cls = 'down';
    text = long ? '⬇ ลดน้ำหนัก' : `⬇ ${fmtWeight(w)}`;
  }
  return <span class={`badge ${cls}`}>{text}</span>;
}

/**
 * Text field that commits on blur/Enter. It is never remounted: when the value changes from
 * outside (stepper, propagation) the text is refreshed only if the field isn't being edited.
 */
export function NumInput(props: {
  value: number | null;
  /** Return `false` to reject the value; the field then shows the current value again. */
  onCommit: (v: number | null) => unknown;
  placeholder?: string;
  flash?: boolean;
  label: string;
  class?: string;
}) {
  const { value, onCommit, placeholder, flash, label } = props;
  const ref = useRef<HTMLInputElement>(null);
  const dirty = useRef(false); // true only while the user has typed something not yet committed
  const text = value == null ? '' : String(value);

  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el) {
      el.value = text;
      dirty.current = false;
    }
  }, [text]);

  return (
    <input
      ref={ref}
      class={`num ${props.class ?? ''}${flash ? ' flash' : ''}`}
      type="text"
      inputMode="decimal"
      aria-label={label}
      placeholder={placeholder ?? '-'}
      defaultValue={text}
      onFocus={(e) => (e.currentTarget as HTMLInputElement).select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
      }}
      onInput={() => {
        dirty.current = true;
      }}
      onBlur={(e) => {
        const el = e.currentTarget as HTMLInputElement;
        // untouched field: never commit its old text, just show the latest value
        if (!dirty.current) {
          el.value = text;
          return;
        }
        dirty.current = false;
        const t = el.value.trim().replace(',', '.');
        const n = t === '' ? null : Number(t);
        if (n !== null && !Number.isFinite(n)) {
          el.value = text; // not a number: put the old value back
          return;
        }
        if (n === value) {
          el.value = text;
          return;
        }
        const res = onCommit(n);
        if (res === false) el.value = text;
      }}
    />
  );
}

export function Stepper(props: {
  value: number | null;
  onMinus: () => void;
  onPlus: () => void;
  onCommit: (v: number | null) => void;
  label: string;
  flash?: boolean;
  placeholder?: string;
}) {
  return (
    <div class="stepper">
      <button type="button" class="step" aria-label={`ลด${props.label}`} onClick={props.onMinus}>
        −
      </button>
      <NumInput
        value={props.value}
        onCommit={props.onCommit}
        label={props.label}
        flash={props.flash}
        placeholder={props.placeholder}
      />
      <button type="button" class="step" aria-label={`เพิ่ม${props.label}`} onClick={props.onPlus}>
        +
      </button>
    </div>
  );
}
