import Dexie, { type Table } from 'dexie';
import { SEED_EXERCISES } from './seed';

export type DayType = 'A' | 'B';

export interface Exercise {
  id: string;
  name: string;
  variants: string[];
  /** kg added when progressing, one entry per variant (same order as variants) */
  increments: number[];
  day: DayType | 'both';
  sets: number;
  repMin: number;
  repMax: number;
  isAccessory: boolean;
  enabled: boolean;
  order: number;
}

export interface Session {
  id?: number;
  date: string; // YYYY-MM-DD (local)
  dayType: DayType;
  status: 'in_progress' | 'done';
  startedAt: number;
  finishedAt?: number;
  /** chosen variant per exercise id */
  variants: Record<string, string>;
  /** accessory exercises added ad-hoc during this session */
  extra: string[];
}

export interface SetLog {
  id: string; // `${sessionId}:${exerciseId}:${setNo}`
  sessionId: number;
  exerciseId: string;
  variant: string;
  setNo: number;
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
}

export interface Settings {
  id: 'main';
  bodyweightKg: number | null;
  proteinFactor: number;
  restDefault: number;
  restMin: number;
  restMax: number;
  autoStartTimer: boolean;
  lastBackupAt: number | null;
}

export interface ProteinLog {
  date: string; // YYYY-MM-DD
  grams: number;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  bodyweightKg: null,
  proteinFactor: 1.6,
  restDefault: 120,
  restMin: 90,
  restMax: 180,
  autoStartTimer: true,
  lastBackupAt: null,
};

class WorkoutDB extends Dexie {
  exercises!: Table<Exercise, string>;
  sessions!: Table<Session, number>;
  setLogs!: Table<SetLog, string>;
  settings!: Table<Settings, string>;
  proteinLogs!: Table<ProteinLog, string>;

  constructor() {
    super('workout-app');
    this.version(1).stores({
      exercises: 'id, order',
      sessions: '++id, status, startedAt',
      setLogs: 'id, sessionId, [exerciseId+variant]',
      settings: 'id',
      proteinLogs: 'date',
    });
    this.on('populate', (tx) => {
      tx.table('exercises').bulkAdd(SEED_EXERCISES);
      tx.table('settings').add(DEFAULT_SETTINGS);
    });
  }
}

export const db = new WorkoutDB();

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('main');
  if (s) return { ...DEFAULT_SETTINGS, ...s };
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export function todayStr(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function logId(sessionId: number, exerciseId: string, setNo: number) {
  return `${sessionId}:${exerciseId}:${setNo}`;
}
