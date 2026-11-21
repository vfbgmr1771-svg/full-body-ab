import { db, DEFAULT_SETTINGS, getSettings } from './db';

const APP_ID = 'workout-app';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Builds the file and starts the download. `lastBackupAt` is only saved after the
 * download was started without error (the browser gives no completion signal).
 */
export async function exportBackup(): Promise<number> {
  const now = Date.now();
  const settings = { ...(await getSettings()), lastBackupAt: now };
  const data = {
    app: APP_ID,
    version: 1,
    exportedAt: new Date(now).toISOString(),
    exercises: await db.exercises.toArray(),
    sessions: await db.sessions.toArray(),
    setLogs: await db.setLogs.toArray(),
    settings,
    proteinLogs: await db.proteinLogs.toArray(),
  };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const d = new Date(now);
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `workout-backup-${stamp}.json`;
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  await db.settings.update('main', { lastBackupAt: now });
  return now;
}

function fail(msg: string): never {
  throw new Error(`ไฟล์สำรองไม่ถูกต้อง: ${msg}`);
}

const isObj = (v: unknown): v is Record<string, any> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Checks structure and links between tables. Throws before anything is changed. */
function validate(data: any): void {
  if (!isObj(data) || data.app !== APP_ID) fail('ไม่ใช่ไฟล์ของแอปนี้');
  for (const k of ['exercises', 'sessions', 'setLogs'] as const) {
    if (!Array.isArray(data[k])) fail(`ไม่มีข้อมูล ${k}`);
  }

  const exIds = new Set<string>();
  const exVariants = new Map<string, string[]>();
  for (const e of data.exercises) {
    if (!isObj(e) || typeof e.id !== 'string' || typeof e.name !== 'string') fail('ท่าออกกำลังกายผิดรูปแบบ');
    if (!Array.isArray(e.variants) || !e.variants.length || !e.variants.every((v: unknown) => typeof v === 'string'))
      fail(`ท่า ${e.id} ไม่มี variant`);
    if (!Array.isArray(e.increments) || !e.increments.every(isNum)) fail(`ท่า ${e.id} มี increment ผิดรูปแบบ`);
    if (!['A', 'B', 'both'].includes(e.day)) fail(`ท่า ${e.id} กำหนดวันผิด`);
    if (!isNum(e.sets) || e.sets < 1 || !isNum(e.repMin) || !isNum(e.repMax) || e.repMin > e.repMax)
      fail(`ท่า ${e.id} กำหนดเซ็ตหรือช่วงจำนวนครั้งผิด`);
    if (exIds.has(e.id)) fail(`ท่า ${e.id} ซ้ำ`);
    exIds.add(e.id);
    exVariants.set(e.id, e.variants);
  }

  const sIds = new Set<number>();
  let inProgress = 0;
  for (const s of data.sessions) {
    if (!isObj(s) || !isNum(s.id) || sIds.has(s.id)) fail('เซสชันผิดรูปแบบหรือ id ซ้ำ');
    if (typeof s.date !== 'string' || !DATE_RE.test(s.date)) fail(`เซสชัน ${s.id} วันที่ผิดรูปแบบ`);
    if (s.dayType !== 'A' && s.dayType !== 'B') fail(`เซสชัน ${s.id} ไม่ใช่ Day A/B`);
    if (s.status !== 'done' && s.status !== 'in_progress') fail(`เซสชัน ${s.id} สถานะผิด`);
    if (!isNum(s.startedAt)) fail(`เซสชัน ${s.id} ไม่มีเวลาเริ่ม`);
    if (s.status === 'in_progress') inProgress++;
    s.variants = s.variants ?? {};
    s.extra = s.extra ?? [];
    if (
      !isObj(s.variants) ||
      !Object.entries(s.variants).every(
        ([k, v]) => typeof v === 'string' && !!exVariants.get(k)?.includes(v),
      )
    )
      fail(`เซสชัน ${s.id} เลือกแบบท่าที่ไม่มีอยู่`);
    if (!Array.isArray(s.extra) || !s.extra.every((x: unknown) => typeof x === 'string' && exIds.has(x)))
      fail(`เซสชัน ${s.id} มีท่าเสริมที่ไม่มีอยู่`);
    sIds.add(s.id);
  }
  if (inProgress > 1) fail('มีเซสชันที่กำลังฝึกอยู่มากกว่าหนึ่งอัน');

  const lIds = new Set<string>();
  for (const l of data.setLogs) {
    if (!isObj(l) || typeof l.id !== 'string' || lIds.has(l.id)) fail('บันทึกเซ็ตผิดรูปแบบหรือ id ซ้ำ');
    if (!sIds.has(l.sessionId)) fail(`บันทึกเซ็ต ${l.id} อ้างถึงเซสชันที่ไม่มีอยู่`);
    if (!exIds.has(l.exerciseId)) fail(`บันทึกเซ็ต ${l.id} อ้างถึงท่าที่ไม่มีอยู่`);
    if (typeof l.variant !== 'string' || !Number.isInteger(l.setNo) || l.setNo < 1) fail(`บันทึกเซ็ต ${l.id} ผิดรูปแบบ`);
    if (l.weightKg !== null && !isNum(l.weightKg)) fail(`บันทึกเซ็ต ${l.id} น้ำหนักผิด`);
    if (l.reps !== null && (!isNum(l.reps) || l.reps < 0)) fail(`บันทึกเซ็ต ${l.id} จำนวนครั้งผิด`);
    if (typeof l.completed !== 'boolean') fail(`บันทึกเซ็ต ${l.id} ไม่มีสถานะเสร็จ`);
    lIds.add(l.id);
  }

  if (data.settings !== undefined) {
    const st = data.settings;
    if (!isObj(st)) fail('การตั้งค่าผิดรูปแบบ');
    const nullableNum = (v: unknown) => v === undefined || v === null || (isNum(v) && v > 0);
    const posNum = (v: unknown) => v === undefined || (isNum(v) && v > 0);
    if (!nullableNum(st.bodyweightKg)) fail('น้ำหนักตัวในการตั้งค่าผิด');
    if (!posNum(st.proteinFactor)) fail('ค่าโปรตีนต่อน้ำหนักตัวผิด');
    for (const k of ['restDefault', 'restMin', 'restMax']) if (!posNum(st[k])) fail(`ค่า ${k} ผิด`);
    const min = st.restMin ?? DEFAULT_SETTINGS.restMin;
    const max = st.restMax ?? DEFAULT_SETTINGS.restMax;
    const def = st.restDefault ?? DEFAULT_SETTINGS.restDefault;
    if (min > max || def < min || def > max) fail('ช่วงเวลาพักในการตั้งค่าไม่สมเหตุสมผล');
    if (st.autoStartTimer !== undefined && typeof st.autoStartTimer !== 'boolean')
      fail('ค่าเริ่มจับเวลาอัตโนมัติผิด');
    if (st.lastBackupAt !== undefined && st.lastBackupAt !== null && !isNum(st.lastBackupAt))
      fail('วันที่สำรองข้อมูลล่าสุดผิด');
  }

  if (data.proteinLogs !== undefined) {
    if (!Array.isArray(data.proteinLogs)) fail('ข้อมูลโปรตีนผิดรูปแบบ');
    for (const p of data.proteinLogs) {
      if (!isObj(p) || typeof p.date !== 'string' || !DATE_RE.test(p.date) || !isNum(p.grams) || p.grams < 0)
        fail('ข้อมูลโปรตีนผิดรูปแบบ');
    }
  }
}

/** Replaces all data with the file's contents. Throws on an invalid file, leaving data untouched. */
export async function importBackup(file: File): Promise<void> {
  let data: any;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('อ่านไฟล์ไม่ได้');
  }
  validate(data);
  await db.transaction(
    'rw',
    [db.exercises, db.sessions, db.setLogs, db.settings, db.proteinLogs],
    async () => {
      await Promise.all([
        db.exercises.clear(),
        db.sessions.clear(),
        db.setLogs.clear(),
        db.settings.clear(),
        db.proteinLogs.clear(),
      ]);
      await db.exercises.bulkPut(data.exercises);
      await db.sessions.bulkPut(data.sessions);
      await db.setLogs.bulkPut(data.setLogs);
      await db.settings.put({ ...DEFAULT_SETTINGS, ...(isObj(data.settings) ? data.settings : {}), id: 'main' });
      if (Array.isArray(data.proteinLogs)) await db.proteinLogs.bulkPut(data.proteinLogs);
    },
  );
}
