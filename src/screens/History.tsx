import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  Chart,
  CategoryScale,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { db, todayStr, type Exercise, type Session, type SetLog } from '../db';
import {
  clampWeight,
  defaultVariant,
  discardSession,
  fmtWeight,
  history,
  recommend,
  sessionTime,
  variantFor,
  type Recommendation,
} from '../logic';
import { Badge, NumInput } from '../ui';

Chart.register(CategoryScale, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip);

const exLabel = (ex: Exercise) => (ex.variants.length > 1 ? ex.name : ex.variants[0]);
const fmtDay = (ms: number) =>
  new Date(ms).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

/* ---------- calendar ---------- */

function Calendar({ sessions, onPick }: { sessions: Session[]; onPick: (date: string) => void }) {
  const now = new Date();
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const byDate = new Map<string, Session[]>();
  for (const s of sessions) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);

  const first = new Date(cur.y, cur.m, 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(cur.y, cur.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const shift = (d: number) => {
    const n = new Date(cur.y, cur.m + d, 1);
    setCur({ y: n.getFullYear(), m: n.getMonth() });
  };
  const today = todayStr();

  return (
    <section class="card">
      <div class="cal-head">
        <button type="button" class="step nav" aria-label="เดือนก่อน" onClick={() => shift(-1)}>
          ‹
        </button>
        <h2>{first.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</h2>
        <button type="button" class="step nav" aria-label="เดือนถัดไป" onClick={() => shift(1)}>
          ›
        </button>
      </div>
      <div class="cal">
        {['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'].map((d) => (
          <span class="dow" key={d}>
            {d}
          </span>
        ))}
        {cells.map((d, i) => {
          if (d == null) return <span key={`e${i}`} />;
          const date = `${cur.y}-${String(cur.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const ss = byDate.get(date);
          // order by start time: colour follows the day's first session
          const ordered = ss ? [...ss].sort((a, b) => a.startedAt - b.startedAt) : [];
          const types = [...new Set(ordered.map((s) => s.dayType))].join('·');
          const cls = ss ? `day has ${ordered[0].dayType === 'A' ? 'a' : 'b'}` : 'day';
          return (
            <button
              type="button"
              key={date}
              class={`${cls}${date === today ? ' today' : ''}`}
              disabled={!ss}
              aria-label={ss ? `${d} Day ${types}` : `${d}`}
              onClick={() => onPick(date)}
            >
              <span>{d}</span>
              {ss && <small>{types}</small>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- progress chart ---------- */

function ProgressChart({ exerciseId, variant }: { exerciseId: string; variant: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    let chart: Chart | null = null;
    let alive = true;
    void (async () => {
      const h = (await history(exerciseId, variant)).reverse();
      if (!alive) return;
      setEmpty(h.length === 0);
      if (!h.length || !canvas.current) return;
      chart = new Chart(canvas.current, {
        type: 'line',
        data: {
          labels: h.map((p) => fmtDay(p.t)),
          datasets: [
            {
              label: 'น้ำหนัก (กก.)',
              data: h.map((p) => p.weight),
              yAxisID: 'y',
              borderColor: '#343aa3',
              backgroundColor: '#343aa3',
              tension: 0.25,
            },
            {
              label: 'จำนวนครั้งเฉลี่ย',
              data: h.map((p) => Math.round((p.reps.reduce((a, b) => a + b, 0) / p.reps.length) * 10) / 10),
              yAxisID: 'y1',
              borderColor: '#e0752b',
              backgroundColor: '#e0752b',
              borderDash: [5, 4],
              tension: 0.25,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            y: { position: 'left', title: { display: true, text: 'กก.' } },
            y1: {
              position: 'right',
              grid: { drawOnChartArea: false },
              title: { display: true, text: 'ครั้ง' },
            },
          },
          plugins: { legend: { position: 'bottom' } },
        },
      });
    })();
    return () => {
      alive = false;
      chart?.destroy();
    };
  }, [exerciseId, variant]);

  return (
    <div>
      {empty && <p class="muted center">ยังไม่มีข้อมูลของท่านี้</p>}
      <div class="chart" style={{ display: empty ? 'none' : 'block' }}>
        <canvas ref={canvas} role="img" aria-label="กราฟความก้าวหน้า" />
      </div>
    </div>
  );
}

/* ---------- session detail (view + edit) ---------- */

function SessionDetail({ id, onBack, onChanged }: { id: number; onBack: () => void; onChanged: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [logs, setLogs] = useState<SetLog[]>([]);
  const [exs, setExs] = useState<Exercise[]>([]);
  const [recs, setRecs] = useState<Record<string, Recommendation>>({});

  const load = useCallback(async () => {
    const s = await db.sessions.get(id);
    if (!s) return;
    const l = (await db.setLogs.where('sessionId').equals(id).toArray()).sort(
      (a, b) => a.setNo - b.setNo,
    );
    const all = await db.exercises.toArray();
    const used = all.filter((e) => l.some((x) => x.exerciseId === e.id)).sort((a, b) => a.order - b.order);
    const entries = await Promise.all(
      used.map(async (e) => [e.id, await recommend(e, variantFor(s, e, l))] as const),
    );
    setSession(s);
    setLogs(l);
    setExs(used);
    setRecs(Object.fromEntries(entries));
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const edit = async (l: SetLog, patch: Partial<SetLog>) => {
    await db.setLogs.update(l.id, patch);
    await load();
    onChanged();
  };

  const remove = async () => {
    if (!confirm('ลบเซสชันนี้ทั้งหมดใช่ไหม ลบแล้วกู้คืนไม่ได้ (ถ้าไม่มีไฟล์สำรอง)')) return;
    await discardSession(id);
    onChanged();
    onBack();
  };

  if (!session) return <div class="loading">กำลังโหลด…</div>;
  const time = new Date(sessionTime(session)).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateText = new Date(session.date + 'T00:00:00').toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div class="page">
      <button type="button" class="link left" onClick={onBack}>
        ‹ กลับไปประวัติ
      </button>
      <header class="topbar">
        <div>
          <h1>Day {session.dayType}</h1>
          <p class="muted">
            {dateText} · {time}
          </p>
        </div>
      </header>
      <p class="muted small">แก้น้ำหนักหรือจำนวนครั้งได้ คำแนะนำครั้งถัดไปจะคำนวณใหม่ให้อัตโนมัติ</p>

      {exs.map((ex) => {
        const mine = logs.filter((l) => l.exerciseId === ex.id);
        const variant = variantFor(session, ex, mine);
        const rec = recs[ex.id];
        return (
          <section class="card" key={ex.id}>
            <header class="ex-head">
              <div>
                <h2>{exLabel(ex)}</h2>
                {ex.variants.length > 1 && <span class="tag">{variant}</span>}
              </div>
              {rec && <Badge rec={rec} />}
            </header>
            {mine.map((l) => (
              <div class="srow" key={l.id}>
                <span>เซ็ต {l.setNo}</span>
                <div class="pair">
                  <NumInput
                    label={`น้ำหนักเซ็ต ${l.setNo}`}
                    value={l.weightKg}
                    onCommit={(v) => {
                      if (v == null) return false;
                      void edit(l, { weightKg: clampWeight(v) });
                    }}
                  />
                  <span class="muted">กก. ×</span>
                  <NumInput
                    label={`จำนวนครั้งเซ็ต ${l.setNo}`}
                    value={l.reps}
                    onCommit={(v) => {
                      if (v == null) return false;
                      const reps = Math.min(100, Math.max(0, Math.round(v)));
                      if (reps === 0 && !confirm('แก้เป็น 0 ครั้งใช่ไหม ระบบจะนับเป็นเซ็ตที่ทำไม่สำเร็จ และมีผลกับคำแนะนำน้ำหนักครั้งถัดไป')) {
                        return false;
                      }
                      void edit(l, { reps });
                    }}
                  />
                </div>
              </div>
            ))}
            {rec && (
              <p class="muted small">
                ครั้งถัดไป: {rec.weight == null ? '—' : fmtWeight(rec.weight)}
              </p>
            )}
          </section>
        );
      })}

      <button type="button" class="link danger" onClick={remove}>
        ลบเซสชันนี้
      </button>
    </div>
  );
}

/* ---------- main screen ---------- */

export function History() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [exs, setExs] = useState<Exercise[]>([]);
  const [exId, setExId] = useState('');
  const [variant, setVariant] = useState('');
  const [detail, setDetail] = useState<number | null>(null);
  const [picked, setPicked] = useState<Session[]>([]);
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    const s = (await db.sessions.where('status').equals('done').toArray()).sort(
      (a, b) => sessionTime(b) - sessionTime(a),
    );
    const logs = await db.setLogs.filter((l) => l.completed).toArray();
    const used = new Set(logs.map((l) => l.exerciseId));
    const e = (await db.exercises.toArray())
      .filter((x) => used.has(x.id))
      .sort((a, b) => a.order - b.order);
    setSessions(s);
    setExs(e);
    setPicked([]);
    setExId((cur) => (e.some((x) => x.id === cur) ? cur : (e[0]?.id ?? '')));
  }, []);

  useEffect(() => {
    void load();
  }, [load, version]);

  const ex = exs.find((e) => e.id === exId);

  useEffect(() => {
    if (!ex) return;
    void defaultVariant(ex).then((v) => setVariant((cur) => (ex.variants.includes(cur) ? cur : v)));
  }, [ex]);

  const pick = (date: string) => {
    const ss = sessions.filter((s) => s.date === date);
    if (ss.length === 1) setDetail(ss[0].id!);
    else setPicked(ss);
  };

  if (detail != null) {
    return (
      <SessionDetail
        id={detail}
        onBack={() => setDetail(null)}
        onChanged={() => setVersion((v) => v + 1)}
      />
    );
  }

  return (
    <div class="page">
      <header class="topbar">
        <div>
          <h1>ประวัติ</h1>
          <p class="muted">ฝึกไปแล้ว {sessions.length} ครั้ง</p>
        </div>
      </header>

      {sessions.length === 0 && (
        <section class="card">
          <h2>ยังไม่มีประวัติ</h2>
          <p class="muted">เริ่มฝึกครั้งแรกจากแท็บวันนี้ แล้วผลจะมาอยู่ที่นี่</p>
        </section>
      )}

      <Calendar sessions={sessions} onPick={pick} />

      {picked.length > 1 && (
        <section class="card">
          <h2>เลือกเซสชัน</h2>
          {picked.map((s) => (
            <button type="button" key={s.id} class="btn ghost" onClick={() => setDetail(s.id!)}>
              Day {s.dayType} ·{' '}
              {new Date(s.startedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            </button>
          ))}
        </section>
      )}

      {ex && (
        <section class="card">
          <h2>ความก้าวหน้า</h2>
          <select
            class="full"
            aria-label="เลือกท่า"
            value={exId}
            onChange={(e) => setExId((e.currentTarget as HTMLSelectElement).value)}
          >
            {exs.map((e) => (
              <option key={e.id} value={e.id}>
                {exLabel(e)}
              </option>
            ))}
          </select>
          {ex.variants.length > 1 && (
            <div class="variants" role="group" aria-label="เลือกแบบท่า">
              {ex.variants.map((v) => (
                <button
                  type="button"
                  key={v}
                  class={`chip${v === variant ? ' on' : ''}`}
                  onClick={() => setVariant(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          {variant && <ProgressChart key={`${exId}:${variant}:${version}`} exerciseId={exId} variant={variant} />}
        </section>
      )}

      {sessions.length > 0 && (
        <section class="card">
          <h2>ล่าสุด</h2>
          {sessions.slice(0, 8).map((s) => (
            <button type="button" class="li rowbtn" key={s.id} onClick={() => setDetail(s.id!)}>
              <span>
                {new Date(s.date + 'T00:00:00').toLocaleDateString('th-TH', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
              <span class={`badge ${s.dayType === 'A' ? 'same' : 'up'}`}>Day {s.dayType}</span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
