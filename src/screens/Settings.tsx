import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { db, type DayType, type Exercise, type Settings } from '../db';
import { exportBackup, importBackup } from '../backup';
import { backupDue } from '../advice';
import { NumInput } from '../ui';

interface Props {
  settings: Settings;
  onSettings: (patch: Partial<Settings>) => void;
}

export function SettingsScreen({ settings, onSettings }: Props) {
  const [exs, setExs] = useState<Exercise[]>([]);
  const [due, setDue] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setExs((await db.exercises.toArray()).sort((a, b) => a.order - b.order));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    void backupDue(settings).then(setDue);
  }, [settings]);

  const patchEx = async (id: string, changes: Partial<Exercise>) => {
    await db.exercises.update(id, changes);
    await load();
  };

  const setIncrement = (ex: Exercise, i: number, v: number | null) => {
    if (!v || v <= 0) return;
    const incs = [...ex.increments];
    incs[i] = v;
    void patchEx(ex.id, { increments: incs });
  };

  const doExport = async () => {
    const t = await exportBackup();
    onSettings({ lastBackupAt: t });
    setMsg('บันทึกไฟล์สำรองแล้ว เก็บไฟล์ไว้ในที่ปลอดภัย เช่น Google Drive');
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    if (!confirm('การกู้คืนจะแทนที่ข้อมูลทั้งหมดในเครื่องนี้ ทำต่อไหม')) return;
    try {
      await importBackup(file);
      location.reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'กู้คืนไม่สำเร็จ');
    }
  };

  const lastBackup = settings.lastBackupAt
    ? new Date(settings.lastBackupAt).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'ยังไม่เคยสำรอง';

  const accessories = exs.filter((e) => e.isAccessory);

  return (
    <div class="page">
      <header class="topbar">
        <h1>ตั้งค่า</h1>
      </header>

      <section class="card">
        <h2>ร่างกายและโปรตีน</h2>
        <div class="srow">
          <span>น้ำหนักตัว (กก.)</span>
          <NumInput
            label="น้ำหนักตัว"
            value={settings.bodyweightKg}
            onCommit={(v) => onSettings({ bodyweightKg: v && v > 0 ? v : null })}
          />
        </div>
        <div class="srow">
          <span>กรัม ต่อ กก.</span>
          <NumInput
            label="ค่าโปรตีนต่อน้ำหนักตัว"
            value={settings.proteinFactor}
            onCommit={(v) => v && v > 0 && onSettings({ proteinFactor: v })}
          />
        </div>
      </section>

      <section class="card">
        <h2>ตัวจับเวลาพัก</h2>
        <div class="srow">
          <span>เวลาพักเริ่มต้น (วินาที)</span>
          <NumInput
            label="เวลาพักเริ่มต้น"
            value={settings.restDefault}
            onCommit={(v) =>
              v &&
              onSettings({
                restDefault: Math.min(settings.restMax, Math.max(settings.restMin, Math.round(v))),
              })
            }
          />
        </div>
        <p class="muted small">ปรับได้ระหว่าง {settings.restMin}–{settings.restMax} วินาที</p>
        <label class="srow">
          <span>เริ่มจับเวลาอัตโนมัติเมื่อติ๊ก ✓</span>
          <input
            type="checkbox"
            class="tgl"
            checked={settings.autoStartTimer}
            onChange={(e) => onSettings({ autoStartTimer: (e.currentTarget as HTMLInputElement).checked })}
          />
        </label>
        <p class="muted small">
          เมื่อใช้เป็น PWA ถ้าจอดับหรือสลับไปแอปอื่นนาน เสียงเตือนอาจช้ากว่าเวลาจริง
        </p>
      </section>

      <section class="card">
        <h2>ท่าเสริม</h2>
        {accessories.map((e) => (
          <div class="srow" key={e.id}>
            <label class="grow">
              <input
                type="checkbox"
                class="tgl"
                checked={e.enabled}
                onChange={(ev) => patchEx(e.id, { enabled: (ev.currentTarget as HTMLInputElement).checked })}
              />
              <span>
                {e.name} · {e.variants[0]}
              </span>
            </label>
            <select
              aria-label={`วันของ ${e.name}`}
              value={e.day}
              onChange={(ev) =>
                patchEx(e.id, { day: (ev.currentTarget as HTMLSelectElement).value as DayType | 'both' })
              }
            >
              <option value="A">Day A</option>
              <option value="B">Day B</option>
              <option value="both">ทั้งสองวัน</option>
            </select>
          </div>
        ))}
        <p class="muted small">ท่าที่ปิดไว้ยังเพิ่มเข้าเซสชันได้ระหว่างฝึกด้วยปุ่ม “+ เพิ่มท่าเสริม”</p>
      </section>

      <section class="card">
        <h2>น้ำหนักที่เพิ่มต่อครั้ง (กก.)</h2>
        {exs.map((e) =>
          e.variants.map((v, i) => (
            <div class="srow" key={`${e.id}:${v}`}>
              <span>{v}</span>
              <NumInput
                label={`increment ${v}`}
                value={e.increments[i] ?? e.increments[0]}
                onCommit={(n) => setIncrement(e, i, n)}
              />
            </div>
          )),
        )}
      </section>

      <section class="card">
        <h2>สำรองและกู้คืนข้อมูล</h2>
        <p class="muted">สำรองล่าสุด: {lastBackup}</p>
        {due && <p class="notice static">ผ่านมาเกิน 14 วันแล้ว ควรสำรองข้อมูลตอนนี้</p>}
        <div class="inline">
          <button type="button" class="btn primary" onClick={doExport}>
            Export JSON
          </button>
          <button type="button" class="btn ghost" onClick={() => fileRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const input = e.currentTarget as HTMLInputElement;
              void doImport(input.files?.[0]);
              input.value = '';
            }}
          />
        </div>
        {msg && <p class="muted">{msg}</p>}
      </section>
    </div>
  );
}
