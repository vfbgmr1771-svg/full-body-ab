import { useEffect, useState } from 'preact/hooks';
import { db, type DayType, type Exercise, type Session } from '../db';
import { fmtWeight, nextDayType, recommend, variantFor, type Recommendation } from '../logic';
import { STATUS_TEXT, StatusIcon, stagger } from '../ui';
import { IconTrophy } from '../icons';

interface Row {
  ex: Exercise;
  variant: string;
  sets: number;
  best: string;
  rec: Recommendation;
}

export function Summary({ sessionId, onHome }: { sessionId: number; onHome: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [next, setNext] = useState<DayType>('A');

  useEffect(() => {
    void (async () => {
      const s = await db.sessions.get(sessionId);
      if (!s) return;
      const logs = await db.setLogs.where('sessionId').equals(sessionId).toArray();
      const exs = await db.exercises.toArray();
      const ids = [...new Set(logs.map((l) => l.exerciseId))];
      const out: Row[] = [];
      for (const id of ids) {
        const ex = exs.find((e) => e.id === id);
        if (!ex) continue;
        const mine = logs.filter((l) => l.exerciseId === id).sort((a, b) => a.setNo - b.setNo);
        const variant = variantFor(s, ex, mine);
        out.push({
          ex,
          variant,
          sets: mine.length,
          best: mine.map((l) => `${fmtWeight(l.weightKg)}×${l.reps}`).join('  ·  '),
          rec: await recommend(ex, variant),
        });
      }
      out.sort((a, b) => a.ex.order - b.ex.order);
      setSession(s);
      setRows(out);
      setNext(await nextDayType());
    })();
  }, [sessionId]);

  if (!session) return <div class="loading">กำลังโหลด…</div>;
  const mins = Math.max(
    1,
    Math.round(((session.finishedAt ?? Date.now()) - session.startedAt) / 60000),
  );
  const totalSets = rows.reduce((n, r) => n + r.sets, 0);
  const name = (r: Row) => (r.ex.variants.length > 1 ? r.variant : r.ex.variants[0]);

  return (
    <div class="page">
      <section class="hero peri center">
        <div class="circ white big">
          <IconTrophy size={28} />
        </div>
        <h1>จบ Day {session.dayType} แล้ว</h1>
        <p class="hero-sub">
          {rows.length} ท่า · {totalSets} เซ็ต · {mins} นาที
        </p>
      </section>

      <h2 class="sec">ที่ทำวันนี้</h2>
      <section class="card">
        {rows.map((r) => (
          <div class="li col" key={r.ex.id}>
            <div class="b">{name(r)}</div>
            <div class="muted small">{r.best}</div>
          </div>
        ))}
      </section>

      <h2 class="sec">ครั้งหน้า</h2>
      {rows.map((r, i) => (
        <div class={`nextrow st-${r.rec.status}`} key={r.ex.id} style={stagger(Math.min(i, 6))}>
          <div class="circ white sm">
            <StatusIcon status={r.rec.status} />
          </div>
          <div class="grow">
            <div class="b">{name(r)}</div>
            <div class="small">{STATUS_TEXT[r.rec.status]}</div>
          </div>
          <b>{r.rec.weight == null ? '—' : fmtWeight(r.rec.weight)}</b>
        </div>
      ))}
      <p class="muted center nextnote">ฝึกครั้งถัดไป: Day {next}</p>

      <button type="button" class="btn primary" onClick={onHome}>
        กลับหน้าแรก
      </button>
    </div>
  );
}
