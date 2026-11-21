import { useCallback, useEffect, useState } from 'preact/hooks';
import { db, todayStr, type ProteinLog, type Settings } from '../db';
import { NumInput, Ring } from '../ui';

interface Props {
  settings: Settings;
  onSettings: (patch: Partial<Settings>) => void;
}

const QUICK = [10, 20, 30, 50];

export function Protein({ settings, onSettings }: Props) {
  const today = todayStr();
  const [logs, setLogs] = useState<ProteinLog[]>([]);
  const [custom, setCustom] = useState('');

  const load = useCallback(async () => {
    setLogs(await db.proteinLogs.orderBy('date').reverse().limit(7).toArray());
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const got = logs.find((l) => l.date === today)?.grams ?? 0;
  const bw = settings.bodyweightKg;
  const target = bw ? Math.round(bw * settings.proteinFactor) : null;
  const pct = target ? Math.min(100, Math.round((got / target) * 100)) : 0;

  const add = async (g: number) => {
    await db.proteinLogs.put({ date: today, grams: Math.max(0, Math.round(got + g)) });
    await load();
  };

  const addCustom = () => {
    const n = parseFloat(custom.replace(',', '.'));
    if (isNaN(n) || n === 0) return;
    setCustom('');
    void add(n);
  };

  const dateText = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('th-TH', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

  return (
    <div class="page protein">
      <header class="topbar">
        <div>
          <h1>โปรตีน</h1>
          <p class="muted">
            {bw ? `${bw} กก. × ${settings.proteinFactor}` : `น้ำหนักตัว × ${settings.proteinFactor}`}
          </p>
        </div>
      </header>

      {!bw && (
        <section class="card">
          <h2>ใส่น้ำหนักตัวก่อน</h2>
          <div class="inline">
            <NumInput
              label="น้ำหนักตัว"
              value={null}
              placeholder="เช่น 70"
              onCommit={(v) => v && onSettings({ bodyweightKg: v })}
            />
            <span>กก.</span>
          </div>
        </section>
      )}

      <section class="hero orange center">
        <Ring
          pct={target ? got / target : 0}
          size={168}
          stroke={12}
          color="#111318"
          track="rgba(255,255,255,0.6)"
          label={`โปรตีน ${got} จาก ${target ?? '—'} กรัม`}
        >
          <span class="ring-big" key={got}>
            {got}
          </span>
          <span class="ring-small">จาก {target ?? '—'} กรัม</span>
        </Ring>
        <p class="hero-sub">
          {target
            ? got >= target
              ? 'ถึงเป้าแล้ว'
              : `เหลืออีก ${target - got} กรัม (${pct}%)`
            : 'ใส่น้ำหนักตัวเพื่อดูเป้าหมาย'}
        </p>
        <div class="roundrow">
          {QUICK.map((g) => (
            <button type="button" key={g} class="round big" aria-label={`เพิ่ม ${g} กรัม`} onClick={() => add(g)}>
              +{g}
            </button>
          ))}
        </div>
      </section>

      <div class="pillinput">
        <input
          class="num"
          type="text"
          inputMode="decimal"
          placeholder="ใส่จำนวนกรัมเอง…"
          aria-label="จำนวนโปรตีนที่ใส่เอง"
          value={custom}
          onInput={(e) => setCustom((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustom()}
        />
        <button type="button" class="btn primary" onClick={addCustom}>
          เพิ่ม
        </button>
      </div>
      <div class="inline spread">
        <button type="button" class="link" onClick={() => add(-10)}>
          ลบ 10 กรัม
        </button>
        <button
          type="button"
          class="link danger"
          onClick={() => got > 0 && confirm('รีเซ็ตยอดวันนี้เป็น 0 ใช่ไหม') && add(-got)}
        >
          รีเซ็ตวันนี้
        </button>
      </div>

      {logs.length > 0 && (
        <section class="card">
          <h2>7 วันล่าสุด</h2>
          {logs.map((l) => {
            const p = target ? Math.min(100, Math.round((l.grams / target) * 100)) : 0;
            return (
              <div class="barrow" key={l.date}>
                <span class="small">{dateText(l.date)}</span>
                <div class="bar">
                  <div class={p >= 100 ? 'full' : ''} style={{ width: `${p}%` }} />
                </div>
                <span class="small">{target ? `${p}%` : `${l.grams} ก.`}</span>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
