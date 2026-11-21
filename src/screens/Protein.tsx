import { useCallback, useEffect, useState } from 'preact/hooks';
import { db, todayStr, type ProteinLog, type Settings } from '../db';
import { NumInput } from '../ui';

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
          <p class="muted">เป้าหมาย = น้ำหนักตัว × {settings.proteinFactor}</p>
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

      <section class="card">
        <div class="big">
          <b>{got}</b>
          <span class="muted"> / {target ?? '—'} กรัม</span>
        </div>
        <div class="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${pct}%` }} />
        </div>
        <p class="muted">
          {target
            ? got >= target
              ? 'ถึงเป้าแล้ว'
              : `เหลืออีก ${target - got} กรัม (${pct}%)`
            : 'ใส่น้ำหนักตัวเพื่อดูเป้าหมาย'}
        </p>
        <div class="quick">
          {QUICK.map((g) => (
            <button type="button" key={g} class="btn tonal" onClick={() => add(g)}>
              +{g}
            </button>
          ))}
        </div>
        <div class="inline">
          <input
            class="num"
            type="text"
            inputMode="decimal"
            placeholder="ใส่เอง (กรัม)"
            aria-label="จำนวนโปรตีนที่ใส่เอง"
            value={custom}
            onInput={(e) => setCustom((e.currentTarget as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustom()}
          />
          <button type="button" class="btn tonal" onClick={addCustom}>
            เพิ่ม
          </button>
        </div>
        <div class="inline">
          <button type="button" class="btn ghost" onClick={() => add(-10)}>
            −10
          </button>
          <button
            type="button"
            class="link danger"
            onClick={() => got > 0 && confirm('รีเซ็ตยอดวันนี้เป็น 0 ใช่ไหม') && add(-got)}
          >
            รีเซ็ตวันนี้
          </button>
        </div>
      </section>

      {logs.length > 0 && (
        <section class="card">
          <h2>7 วันล่าสุด</h2>
          {logs.map((l) => (
            <div class="li" key={l.date}>
              <span>{dateText(l.date)}</span>
              <span>
                {l.grams} ก.
                {target ? <span class="muted"> · {Math.round((l.grams / target) * 100)}%</span> : null}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
