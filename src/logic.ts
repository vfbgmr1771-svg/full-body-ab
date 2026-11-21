import { db, logId, todayStr, type DayType, type Exercise, type Session, type SetLog } from './db';

/** When a session actually ended (falls back to its start). */
export const sessionTime = (s: Session) => s.finishedAt ?? s.startedAt;

export const clampWeight = (w: number) => Math.round(Math.min(1000, Math.max(-300, w)) * 100) / 100;

/** Variant shown for an exercise: the session's choice, else what the logs say, else the first. */
export function variantFor(session: Session, ex: Exercise, logs: SetLog[]): string {
  return (
    session.variants[ex.id] ?? logs.find((l) => l.exerciseId === ex.id)?.variant ?? ex.variants[0]
  );
}

export async function nextDayType(): Promise<DayType> {
  const done = await db.sessions.where('status').equals('done').toArray();
  if (!done.length) return 'A';
  done.sort((a, b) => sessionTime(b) - sessionTime(a));
  return done[0].dayType === 'A' ? 'B' : 'A';
}

export function exercisesFor(all: Exercise[], day: DayType): Exercise[] {
  return all
    .filter((e) => e.enabled && (e.day === day || e.day === 'both'))
    .sort((a, b) => a.order - b.order);
}

export interface PastPerf {
  weight: number; // lowest weight across completed sets
  reps: number[];
  date: string;
  t: number;
}

export type RecStatus = 'new' | 'up' | 'same' | 'down';

export interface Recommendation {
  status: RecStatus;
  weight: number | null;
  last: PastPerf | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Completed sessions for one exercise + variant, newest first. */
export async function history(
  exerciseId: string,
  variant: string,
  excludeSessionId?: number,
): Promise<PastPerf[]> {
  const logs = await db.setLogs
    .where('[exerciseId+variant]')
    .equals([exerciseId, variant])
    .filter((l) => l.completed && l.sessionId !== excludeSessionId && l.reps != null)
    .toArray();
  const bySession = new Map<number, SetLog[]>();
  for (const l of logs) {
    if (!bySession.has(l.sessionId)) bySession.set(l.sessionId, []);
    bySession.get(l.sessionId)!.push(l);
  }
  const sessions = await db.sessions.bulkGet([...bySession.keys()]);
  const out: PastPerf[] = [];
  for (const s of sessions) {
    if (!s || s.status !== 'done') continue;
    const sets = bySession.get(s.id!)!.sort((a, b) => a.setNo - b.setNo);
    out.push({
      weight: Math.min(...sets.map((x) => x.weightKg ?? 0)),
      reps: sets.map((x) => x.reps ?? 0),
      date: s.date,
      t: sessionTime(s),
    });
  }
  return out.sort((a, b) => b.t - a.t);
}

export function hitTop(ex: Exercise, reps: number[]): boolean {
  return reps.length >= ex.sets && reps.every((r) => r >= ex.repMax);
}

export function increment(ex: Exercise, variant: string): number {
  const i = Math.max(0, ex.variants.indexOf(variant));
  return ex.increments[i] ?? ex.increments[0] ?? 2.5;
}

/** -10% rounded down to the increment grid; bodyweight/assisted go one step more assisted. */
export function deload(weight: number, inc: number): number {
  if (weight > 0) return Math.max(0, r2(Math.floor((weight * 0.9) / inc) * inc));
  return clampWeight(weight - inc);
}

export async function recommend(
  ex: Exercise,
  variant: string,
  excludeSessionId?: number,
): Promise<Recommendation> {
  const h = await history(ex.id, variant, excludeSessionId);
  if (!h.length) return { status: 'new', weight: null, last: null };
  const last = h[0];
  const inc = increment(ex, variant);
  if (hitTop(ex, last.reps)) {
    return { status: 'up', weight: clampWeight(last.weight + inc), last };
  }
  const below = (p: PastPerf) => p.reps.some((r) => r < ex.repMin);
  if (h.length >= 2 && below(h[0]) && below(h[1])) {
    return { status: 'down', weight: deload(last.weight, inc), last };
  }
  return { status: 'same', weight: last.weight, last };
}

/** Variant used most recently for this exercise (defaults to the first). */
export async function defaultVariant(ex: Exercise): Promise<string> {
  let best = ex.variants[0];
  let bestT = -1;
  for (const v of ex.variants) {
    const h = await history(ex.id, v);
    if (h[0] && h[0].t > bestT) {
      bestT = h[0].t;
      best = v;
    }
  }
  return best;
}

export async function createSets(sessionId: number, ex: Exercise, variant: string) {
  const rec = await recommend(ex, variant);
  const logs: SetLog[] = Array.from({ length: ex.sets }, (_, i) => ({
    id: logId(sessionId, ex.id, i + 1),
    sessionId,
    exerciseId: ex.id,
    variant,
    setNo: i + 1,
    weightKg: rec.weight,
    reps: null,
    completed: false,
  }));
  await db.setLogs.bulkPut(logs);
}

export async function startSession(dayType: DayType): Promise<number> {
  const existing = await db.sessions.where('status').equals('in_progress').first();
  if (existing) return existing.id!;
  const all = await db.exercises.toArray();
  const list = exercisesFor(all, dayType);
  const variants: Record<string, string> = {};
  for (const ex of list) variants[ex.id] = await defaultVariant(ex);
  const id = await db.sessions.add({
    date: todayStr(),
    dayType,
    status: 'in_progress',
    startedAt: Date.now(),
    variants,
    extra: [],
  });
  for (const ex of list) await createSets(id, ex, variants[ex.id]);
  return id;
}

export async function discardSession(id: number) {
  await db.setLogs.where('sessionId').equals(id).delete();
  await db.sessions.delete(id);
}

export function fmtKg(n: number): string {
  return Number.isInteger(n) ? String(n) : String(r2(n));
}

/** 0 = bodyweight, negative = assisted. */
export function fmtWeight(n: number | null | undefined): string {
  if (n == null) return '-';
  if (n === 0) return 'BW';
  if (n < 0) return `ช่วย ${fmtKg(-n)} กก.`;
  return `${fmtKg(n)} กก.`;
}
