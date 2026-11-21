import { db, type Exercise, type Settings } from './db';
import { fmtKg, increment, type Recommendation } from './logic';

/** One-line reason shown under today's target weight. */
export function reasonText(ex: Exercise, variant: string, rec: Recommendation): string {
  switch (rec.status) {
    case 'new':
      return 'ยังไม่เคยทำท่านี้ ใส่น้ำหนักเริ่มต้นเอง เซ็ตถัดไปจะเติมให้';
    case 'up':
      return `ครั้งก่อนทำครบ ${ex.repMax} ครั้งทุกเซ็ต เพิ่ม ${fmtKg(increment(ex, variant))} กก.`;
    case 'down':
      return `ต่ำกว่า ${ex.repMin} ครั้ง 2 เซสชันติดกัน ลด 10% ปัดลงตามขั้น ${fmtKg(increment(ex, variant))} กก.`;
    default:
      return `ยังไม่ครบ ${ex.repMax} ครั้งทุกเซ็ต คงน้ำหนัก เน้นเพิ่มจำนวนครั้ง`;
  }
}

const BACKUP_DAYS = 14;

/** True when the user has data and the last backup (or first session) is over 14 days old. */
export async function backupDue(s: Settings): Promise<boolean> {
  let baseline = s.lastBackupAt;
  if (baseline == null) {
    const first = await db.sessions.where('status').equals('done').first();
    baseline = first ? first.startedAt : null;
  }
  if (baseline == null) return false;
  return Date.now() - baseline > BACKUP_DAYS * 24 * 3600 * 1000;
}
