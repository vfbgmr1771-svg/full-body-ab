import { useEffect, useState } from 'preact/hooks';
import { db, type DayType, type Exercise, type Session, type Settings } from '../db';
import {
  defaultVariant,
  exercisesFor,
  nextDayType,
  recommend,
  startSession,
  type Recommendation,
} from '../logic';
import { backupDue } from '../advice';
import { Badge } from '../ui';

interface Preview {
  ex: Exercise;
  variant: string;
  rec: Recommendation;
}

interface Props {
  settings: Settings;
  onStart: (id: number) => void;
  onGoSettings: () => void;
}

export function Today({ settings, onStart, onGoSettings }: Props) {
  const [rotation, setRotation] = useState<DayType | null>(null);
  const [day, setDay] = useState<DayType>('A');
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [recent, setRecent] = useState<Session[]>([]);
  const [due, setDue] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const r = await nextDayType();
      setRotation(r);
      setDay(r);
      setRecent(
        (await db.sessions.where('status').equals('done').toArray())
          .sort((a, b) => b.startedAt - a.startedAt)
          .slice(0, 3),
      );
      setDue(await backupDue(settings));
    })();
  }, [settings]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const all = await db.exercises.toArray();
      const list = exercisesFor(all, day);
      const p = await Promise.all(
        list.map(async (ex) => {
          const variant = await defaultVariant(ex);
          return { ex, variant, rec: await recommend(ex, variant) };
        }),
      );
      if (alive) setPreviews(p);
    })();
    return () => {
      alive = false;
    };
  }, [day]);

  const pick = (d: DayType) => {
    if (d === day) return;
    if (rotation && d !== rotation) {
      const ok = confirm(
        `ลำดับปกติวันนี้คือ Day ${rotation}\nสลับไปฝึก Day ${d} ใช่ไหม ครั้งต่อไปจะสลับต่อจาก Day ${d}`,
      );
      if (!ok) return;
    }
    setDay(d);
  };

  const start = async () => {
    setBusy(true);
    try {
      onStart(await startSession(day));
    } finally {
      setBusy(false);
    }
  };

  const now = new Date();
  const dateText = now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' });
  const trainingDay = [1, 3, 5].includes(now.getDay());
  const dayName = (s: Session) =>
    new Date(s.date + 'T00:00:00').toLocaleDateString('th-TH', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

  return (
    <div class="page">
      {due && (
        <button type="button" class="notice" onClick={onGoSettings}>
          ถึงเวลาสำรองข้อมูลแล้ว (ทุก 14 วัน) แตะเพื่อไปหน้าตั้งค่า
        </button>
      )}

      <section class="hero">
      <header class="topbar">
        <div>
          <p class="muted">{dateText}</p>
          <h1>วันนี้ฝึก Day {day}</h1>
        </div>
      </header>

      <div class="seg" role="group" aria-label="เลือกวันฝึก">
        {(['A', 'B'] as const).map((d) => (
          <button
            type="button"
            key={d}
            class={day === d ? 'on' : ''}
            aria-pressed={day === d}
            onClick={() => pick(d)}
          >
            Day {d}
            {rotation === d && <small>ลำดับปกติ</small>}
          </button>
        ))}
      </div>
      {!trainingDay && <p class="muted center">วันนี้ไม่ใช่วันฝึกปกติ (จ./พ./ศ.) แต่ฝึกได้เลย</p>}
      </section>

      <section class="card">
        <h2>เป้าหมายวันนี้</h2>
        {previews.map(({ ex, variant, rec }) => (
          <div class="li" key={ex.id}>
            <div>
              <div>{ex.variants.length > 1 ? variant : ex.variants[0]}</div>
              <div class="muted small">
                {ex.sets}×{ex.repMin}-{ex.repMax}
                {ex.isAccessory ? ' · ท่าเสริม' : ''}
              </div>
            </div>
            <Badge rec={rec} />
          </div>
        ))}
      </section>

      <button type="button" class="btn primary" onClick={start} disabled={busy}>
        เริ่มฝึก Day {day}
      </button>

      {recent.length > 0 && (
        <section class="card">
          <h2>ล่าสุด</h2>
          {recent.map((s) => (
            <div class="li" key={s.id}>
              <span>{dayName(s)}</span>
              <span class="muted">Day {s.dayType}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
