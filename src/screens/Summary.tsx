import { useEffect, useState } from 'preact/hooks';
import { db, type DayType, type Exercise, type Session } from '../db';
import { fmtWeight, nextDayType, recommend, variantFor, type Recommendation } from '../logic';
import { Badge } from '../ui';

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

  return (
    <div class="page">
      <header class="topbar center">
        <div>
          <div class="trophy" aria-hidden="true">
            🏆
          </div>
          <h1>จบ Day {session.dayType} แล้ว</h1>
          <p class="muted">
            {rows.length} ท่า · {totalSets} เซ็ต · {mins} นาที
          </p>
        </div>
      </header>

      <section class="card">
        <h2>ที่ทำวันนี้</h2>
        {rows.map((r) => (
          <div class="li col" key={r.ex.id}>
            <div>{r.ex.variants.length > 1 ? r.variant : r.ex.variants[0]}</div>
            <div class="muted small">{r.best}</div>
          </div>
        ))}
      </section>

      <section class="card">
        <h2>ครั้งหน้า</h2>
        {rows.map((r) => (
          <div class="li" key={r.ex.id}>
            <span>{r.ex.variants.length > 1 ? r.variant : r.ex.variants[0]}</span>
            <Badge rec={r.rec} />
          </div>
        ))}
        <p class="muted center">ฝึกครั้งถัดไป: Day {next}</p>
      </section>

      <button type="button" class="btn primary" onClick={onHome}>
        กลับหน้าแรก
      </button>
    </div>
  );
}
