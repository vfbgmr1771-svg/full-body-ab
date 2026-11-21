import { useEffect, useState } from 'preact/hooks';
import { db, todayStr, type DayType, type Exercise, type Settings } from '../db';
import {
  defaultVariant,
  exercisesFor,
  fmtWeight,
  nextDayType,
  recommend,
  startSession,
  type Recommendation,
} from '../logic';
import { backupDue } from '../advice';
import { STATUS_TEXT, StatusIcon, stagger } from '../ui';
import { IconBarbell, IconCheck } from '../icons';

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

const WEEKDAYS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];

export function Today({ settings, onStart, onGoSettings }: Props) {
  const [rotation, setRotation] = useState<DayType | null>(null);
  const [day, setDay] = useState<DayType>('A');
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [doneDates, setDoneDates] = useState<Set<string>>(new Set());
  const [due, setDue] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const r = await nextDayType();
      setRotation(r);
      setDay(r);
      const done = await db.sessions.where('status').equals('done').toArray();
      setDoneDates(new Set(done.map((s) => s.date)));
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
  const today = todayStr(now);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const week = WEEKDAYS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const date = todayStr(d);
    return { label, date, isToday: date === today, done: doneDates.has(date) };
  });

  const dateText = now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' });
  const trainingDay = [1, 3, 5].includes(now.getDay());
  const totalSets = previews.reduce((n, p) => n + p.ex.sets, 0);

  return (
    <div class="page">
      <header class="topbar">
        <div class="who">
          <div class="circ blk">
            <IconBarbell />
          </div>
          <div>
            <div class="b">Full Body A/B</div>
            <div class="muted small">{dateText}</div>
          </div>
        </div>
      </header>

      {due && (
        <button type="button" class="notice" onClick={onGoSettings}>
          ถึงเวลาสำรองข้อมูลแล้ว (ทุก 14 วัน) แตะเพื่อไปหน้าตั้งค่า
        </button>
      )}

      <section class="hero peri">
        <div class="row">
          <div class="circ white">
            <IconBarbell />
          </div>
          <span class="chip white">{totalSets} เซ็ต</span>
        </div>
        <h1>วันนี้ Day {day}</h1>
        <p class="hero-sub">
          {previews.length} ท่า · เป้า {previews[0] ? `${previews[0].ex.repMin}-${previews[0].ex.repMax}` : '–'} ครั้ง
        </p>

        <div class="wk" aria-label="สัปดาห์นี้">
          {week.map((w) => (
            <div key={w.date}>
              <span>{w.label}</span>
              {w.done ? (
                <div class="d blk" aria-label={`${w.label} ฝึกแล้ว`}>
                  <IconCheck size={15} />
                </div>
              ) : w.isToday ? (
                <div class="d today" aria-label="วันนี้">
                  {day}
                </div>
              ) : (
                <div class="d" />
              )}
            </div>
          ))}
        </div>

        <button type="button" class="btn primary hero-btn" onClick={start} disabled={busy}>
          เริ่มฝึก Day {day}
        </button>
      </section>

      <div class="chips" role="group" aria-label="เลือกวันฝึก">
        {(['A', 'B'] as const).map((d) => (
          <button
            type="button"
            key={d}
            class={`chip${day === d ? ' on' : ''}`}
            aria-pressed={day === d}
            onClick={() => pick(d)}
          >
            Day {d}
            {rotation === d ? ' · ลำดับปกติ' : ''}
          </button>
        ))}
      </div>
      {!trainingDay && <p class="muted center small">วันนี้ไม่ใช่วันฝึกปกติ (จ./พ./ศ.) แต่ฝึกได้เลย</p>}

      <h2 class="sec">ท่าวันนี้</h2>
      <div class="hscroll">
        {previews.map(({ ex, variant, rec }, i) => (
          <div class={`mcard st-${rec.status}`} key={ex.id} style={stagger(Math.min(i, 5))}>
            <div class="row">
              <div class="circ white sm">
                <StatusIcon status={rec.status} />
              </div>
              <span class="small">
                {ex.sets}×{ex.repMin}-{ex.repMax}
              </span>
            </div>
            <div class="b mname">{ex.variants.length > 1 ? variant : ex.variants[0]}</div>
            <div class="small">
              {rec.weight == null ? 'ใส่น้ำหนักเอง' : `เป้า ${fmtWeight(rec.weight)}`}
            </div>
            {/* a new exercise already says "ใส่น้ำหนักเอง" above; don't repeat it */}
            {rec.status !== 'new' && <div class="small mstat">{STATUS_TEXT[rec.status]}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
