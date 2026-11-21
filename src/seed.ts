import type { Exercise } from './db';

type Seed = Omit<Exercise, 'order' | 'enabled' | 'isAccessory'>;

const main: Seed[] = [
  // Day A
  { id: 'bench', name: 'Chest Press', variants: ['Bench Press', 'Machine Flat Press'], increments: [2.5, 5], day: 'A', sets: 2, repMin: 5, repMax: 9 },
  { id: 'pullup', name: 'Vertical Pull', variants: ['Pull up', 'Lat Pulldown'], increments: [2.5, 5], day: 'A', sets: 2, repMin: 5, repMax: 9 },
  { id: 'row', name: 'Row', variants: ['Barbell Row', 'Machine Row'], increments: [2.5, 5], day: 'A', sets: 2, repMin: 5, repMax: 9 },
  { id: 'squat', name: 'Squat', variants: ['Squat', 'Leg Press'], increments: [2.5, 5], day: 'A', sets: 2, repMin: 5, repMax: 9 },
  { id: 'lateral', name: 'Lateral Raise', variants: ['Lateral Raise'], increments: [2.5], day: 'A', sets: 2, repMin: 8, repMax: 10 },
  { id: 'hamcurl', name: 'Hamstring Curl', variants: ['Hamstring Curl'], increments: [5], day: 'A', sets: 2, repMin: 8, repMax: 10 },
  // Day B
  { id: 'ohp', name: 'Shoulder Press', variants: ['Overhead Press', 'Machine Shoulder Press'], increments: [2.5, 5], day: 'B', sets: 2, repMin: 5, repMax: 9 },
  { id: 'chinup', name: 'Supinated Pull', variants: ['Chin up', 'Supinated Pulldown'], increments: [2.5, 5], day: 'B', sets: 2, repMin: 5, repMax: 9 },
  { id: 'deadlift', name: 'Hinge', variants: ['Deadlift', 'Smith SLDL'], increments: [2.5, 2.5], day: 'B', sets: 2, repMin: 5, repMax: 9 },
  { id: 'pecdeck', name: 'Pec Deck', variants: ['Pec Deck'], increments: [5], day: 'B', sets: 2, repMin: 8, repMax: 10 },
  { id: 'legext', name: 'Leg Extension', variants: ['Leg Extension'], increments: [5], day: 'B', sets: 2, repMin: 8, repMax: 10 },
];

const accessories: Seed[] = [
  { id: 'curl', name: 'หน้าแขน', variants: ['Dumbbell Curl'], increments: [2.5], day: 'both', sets: 2, repMin: 8, repMax: 10 },
  { id: 'pushdown', name: 'หลังแขน', variants: ['Tricep Pushdown'], increments: [5], day: 'both', sets: 2, repMin: 8, repMax: 10 },
  { id: 'hipthrust', name: 'ก้น', variants: ['Hip Thrust'], increments: [5], day: 'both', sets: 2, repMin: 8, repMax: 10 },
  { id: 'adductor', name: 'ขาหนีบ', variants: ['Hip Adductor'], increments: [5], day: 'both', sets: 2, repMin: 8, repMax: 10 },
  { id: 'calf', name: 'น่อง', variants: ['Calf Raise'], increments: [5], day: 'both', sets: 2, repMin: 8, repMax: 10 },
  { id: 'crunch', name: 'หน้าท้อง', variants: ['Rope Crunch'], increments: [5], day: 'both', sets: 2, repMin: 8, repMax: 10 },
];

export const SEED_EXERCISES: Exercise[] = [
  ...main.map((e, i) => ({ ...e, order: i, enabled: true, isAccessory: false })),
  ...accessories.map((e, i) => ({ ...e, order: 100 + i, enabled: false, isAccessory: true })),
];
