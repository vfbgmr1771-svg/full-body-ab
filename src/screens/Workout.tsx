import { useCallback, useEffect, useState } from 'preact/hooks';
import { db, type Exercise, type Session, type SetLog, type Settings } from '../db';
import {
  createSets,
  defaultVariant,
  discardSession,
  exercisesFor,
  fmtWeight,
  increment,
  recommend,
  variantFor,
  clampWeight,
  type Recommendation,
} from '../logic';
import { reasonText } from '../advice';
import { Badge, Stepper } from '../ui';
import { IconCheck } from '../icons';
import { unlockAudio, type RestApi } from '../rest';
import { RestMini, RestPanel } from '../RestTimer';

interface Props {
  sessionId: number;
  settings: Settings;
  rest: RestApi;
  onToggleAuto: (v: boolean) => void;
  onFinish: (id: number) => void;
  onCancel: () => void;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const exLabel = (ex: Exercise, variant: string) => (ex.variants.length > 1 ? ex.name : variant);

export function Workout({ sessionId, settings, rest, onToggleAuto, onFinish, onCancel }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [all, setAll] = useState<Exercise[]>([]);
  const [logs, setLogs] = useState<SetLog[]>([]);
  const [recs, setRecs] = useState<Record<string, Recommendation>>({});
  const [flash, setFlash] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [panelVisible, setPanelVisible] = useState(true);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    const s = await db.sessions.get(sessionId);
    if (!s) return;
    const ex = await db.exercises.toArray();
    const l = await db.setLogs.where('sessionId').equals(sessionId).toArray();
    const list = [
      ...exercisesFor(ex, s.dayType),
      ...s.extra.map((id) => ex.find((e) => e.id === id)).filter((e): e is Exercise => !!e),
    ];
    const entries = await Promise.all(
      list.map(async (e) => [e.id, await recommend(e, variantFor(s, e, l))] as const),
    );
    setSession(s);
    setAll(ex);
    setLogs(l);
    setRecs(Object.fromEntries(entries));
  }, [sessionId]);

  useEffect(() => {
    void load();
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [load]);

  if (!session) return <div class="loading">กำลังโหลด…</div>;

  const dayExercises = exercisesFor(all, session.dayType);
  const list = [
    ...dayExercises,
    ...session.extra
      .map((id) => all.find((e) => e.id === id))
      .filter((e): e is Exercise => !!e && !dayExercises.some((d) => d.id === e.id)),
  ];

  const applyChanges = async (changes: { key: string; changes: Partial<SetLog> }[]) => {
    const map = new Map(changes.map((c) => [c.key, c.changes]));
    setLogs((ls) => ls.map((l) => (map.has(l.id) ? { ...l, ...map.get(l.id)! } : l)));
    await db.setLogs.bulkUpdate(changes);
  };

  const flashField = (key: string) => {
    setFlash(key);
    setTimeout(() => setFlash((f) => (f === key ? null : f)), 900);
  };

  const setWeight = async (l: SetLog, raw: number | null) => {
    const w = raw == null ? null : clampWeight(raw);
    const later = logs.filter(
      (x) => x.exerciseId === l.exerciseId && x.setNo > l.setNo && !x.completed,
    );
    await applyChanges([
      { key: l.id, changes: { weightKg: w } },
      ...later.map((x) => ({ key: x.id, changes: { weightKg: w } })),
    ]);
  };

  const stepWeight = (l: SetLog, ex: Exercise, dir: 1 | -1) =>
    setWeight(l, r2((l.weightKg ?? 0) + dir * increment(ex, l.variant)));

  const setReps = (l: SetLog, r: number | null) =>
    applyChanges([{ key: l.id, changes: { reps: r == null ? null : Math.max(0, Math.round(r)) } }]);

  const stepReps = (l: SetLog, ex: Exercise, dir: 1 | -1) => {
    if (l.reps == null) {
      if (dir < 0) return;
      const prev = logs.find((x) => x.exerciseId === l.exerciseId && x.setNo === l.setNo - 1);
      return setReps(l, prev?.reps ?? ex.repMin);
    }
    return setReps(l, Math.max(0, l.reps + dir));
  };

  const toggle = async (l: SetLog) => {
    if (l.completed) {
      await applyChanges([{ key: l.id, changes: { completed: false } }]);
      return;
    }
    if (l.weightKg == null) return flashField(`${l.id}:w`);
    if (l.reps == null) return flashField(`${l.id}:r`);
    if (l.reps === 0 && !confirm('ทำได้ 0 ครั้งในเซ็ตนี้ใช่ไหม ถ้าบันทึก ระบบจะนับเป็นเซ็ตที่ทำไม่สำเร็จ')) return;
    if (l.reps > 50 && !confirm(`${l.reps} ครั้งดูเยอะผิดปกติ ใช่ค่าที่ถูกต้องไหม`)) return;
    const changes: { key: string; changes: Partial<SetLog> }[] = [
      { key: l.id, changes: { completed: true } },
    ];
    const next = logs.find(
      (x) => x.exerciseId === l.exerciseId && x.setNo === l.setNo + 1 && !x.completed,
    );
    if (next) {
      const c: Partial<SetLog> = {};
      if (next.weightKg == null) c.weightKg = l.weightKg;
      if (next.reps == null && l.reps > 0) c.reps = l.reps;
      if (Object.keys(c).length) changes.push({ key: next.id, changes: c });
    }
    await applyChanges(changes);
    if (settings.autoStartTimer) {
      unlockAudio();
      rest.start();
    }
  };

  const changeVariant = async (ex: Exercise, v: string) => {
    if (session.variants[ex.id] === v) return;
    const variants = { ...session.variants, [ex.id]: v };
    await db.sessions.update(sessionId, { variants });
    const rec = await recommend(ex, v);
    const mine = logs.filter((l) => l.exerciseId === ex.id);
    await applyChanges(
      mine.map((l) => ({
        key: l.id,
        changes: { variant: v, ...(l.completed ? {} : { weightKg: rec.weight }) },
      })),
    );
    setSession({ ...session, variants });
    setRecs((r) => ({ ...r, [ex.id]: rec }));
  };

  const addAccessory = async (ex: Exercise) => {
    const v = await defaultVariant(ex);
    await db.sessions.update(sessionId, {
      extra: [...session.extra, ex.id],
      variants: { ...session.variants, [ex.id]: v },
    });
    await createSets(sessionId, ex, v);
    setAdding(false);
    await load();
  };

  const completedCount = logs.filter((l) => l.completed).length;

  const finish = async () => {
    if (!completedCount) {
      alert('ยังไม่ได้ติ๊ก ✓ เซ็ตไหนเลย');
      return;
    }
    const left = logs.length - completedCount;
    if (left && !confirm(`ยังเหลือ ${left} เซ็ตที่ยังไม่ได้ทำ จบการฝึกเลยไหม`)) return;
    await db.setLogs.where('sessionId').equals(sessionId).filter((l) => !l.completed).delete();
    await db.sessions.update(sessionId, { status: 'done', finishedAt: Date.now() });
    rest.skip();
    onFinish(sessionId);
  };

  const cancel = async () => {
    const msg = completedCount
      ? `ยกเลิกการฝึกนี้จะลบ ${completedCount} เซ็ตที่บันทึกไว้ และกู้คืนไม่ได้`
      : 'ยกเลิกการฝึกครั้งนี้ใช่ไหม';
    if (!confirm(msg)) return;
    if (completedCount && !confirm('ยืนยันอีกครั้ง ลบข้อมูลการฝึกนี้ทั้งหมดใช่ไหม')) return;
    await discardSession(sessionId);
    rest.skip();
    onCancel();
  };

  const isDone = (ex: Exercise) => {
    const mine = logs.filter((l) => l.exerciseId === ex.id);
    return mine.length > 0 && mine.every((l) => l.completed);
  };
  const activeId = list.find((ex) => !isDone(ex))?.id;
  const minutes = Math.max(0, Math.round((Date.now() - session.startedAt) / 60000));
  const candidates = all
    .filter((e) => e.isAccessory && !list.some((x) => x.id === e.id))
    .sort((a, b) => a.order - b.order);

  const jump = (id: string) => {
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .getElementById(`ex-${id}`)
      ?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <div class="page workout">
      <header class="topbar">
        <div>
          <h1>Day {session.dayType}</h1>
          <p class="muted">
            {completedCount}/{logs.length} เซ็ต · {minutes} นาที
          </p>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            checked={settings.autoStartTimer}
            onChange={(e) => onToggleAuto((e.currentTarget as HTMLInputElement).checked)}
          />
          <span>จับเวลาอัตโนมัติ</span>
        </label>
      </header>

      <RestPanel rest={rest} settings={settings} onVisible={setPanelVisible} />

      <nav class="hscroll chips-nav" aria-label="ไปยังท่า">
        {list.map((ex) => {
          const variant = variantFor(session, ex, logs);
          return (
            <button
              type="button"
              key={ex.id}
              class={`chip${ex.id === activeId ? ' on' : ''}${isDone(ex) ? ' done' : ''}`}
              onClick={() => jump(ex.id)}
            >
              {isDone(ex) ? '✓ ' : ''}
              {exLabel(ex, variant)}
            </button>
          );
        })}
      </nav>

      {list.map((ex) => {
        const mine = logs.filter((l) => l.exerciseId === ex.id).sort((a, b) => a.setNo - b.setNo);
        const variant = variantFor(session, ex, mine);
        const rec = recs[ex.id] ?? { status: 'new' as const, weight: null, last: null };
        const allDone = isDone(ex);
        return (
          <section
            key={ex.id}
            id={`ex-${ex.id}`}
            class={`card ex st-${rec.status}${ex.id === activeId ? ' active' : ''}${allDone ? ' alldone' : ''}`}
          >
            <header class="ex-head">
              <div>
                <h2>{exLabel(ex, variant)}</h2>
                {ex.isAccessory && <span class="tag">ท่าเสริม · {ex.name}</span>}
              </div>
              <Badge rec={rec} long />
            </header>

            {ex.variants.length > 1 && (
              <div class="variants" role="group" aria-label="เลือกแบบท่า">
                {ex.variants.map((v) => (
                  <button
                    type="button"
                    key={v}
                    class={`chip small${v === variant ? ' on' : ''}`}
                    onClick={() => changeVariant(ex, v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}

            <div class="target">
              <div class="trow">
                <span class="k">ครั้งก่อน</span>
                <span>
                  {rec.last ? `${fmtWeight(rec.last.weight)} × ${rec.last.reps.join(', ')}` : '—'}
                </span>
              </div>
              <div class="trow goal">
                <span class="k">เป้าวันนี้</span>
                <b>
                  {rec.weight == null ? 'ใส่น้ำหนักเอง' : fmtWeight(rec.weight)} · {ex.sets}×
                  {ex.repMin}-{ex.repMax}
                </b>
              </div>
              <p class="why">{reasonText(ex, variant, rec)}</p>
            </div>

            {mine.map((l) => (
              <div key={l.id} class={`set${l.completed ? ' done' : ''}`}>
                <div class="set-head">
                  <span class="set-no">เซ็ต {l.setNo}</span>
                  <button
                    type="button"
                    class={`check${l.completed ? ' on' : ''}`}
                    aria-label={l.completed ? `ยกเลิกเซ็ต ${l.setNo}` : `เสร็จเซ็ต ${l.setNo}`}
                    aria-pressed={l.completed}
                    onClick={() => toggle(l)}
                  >
                    <IconCheck size={22} />
                  </button>
                </div>
                <div class="set-inputs">
                  <div class="field">
                    <span class="cap">กก.</span>
                    <Stepper
                      label="น้ำหนัก"
                      value={l.weightKg}
                      flash={flash === `${l.id}:w`}
                      onMinus={() => stepWeight(l, ex, -1)}
                      onPlus={() => stepWeight(l, ex, 1)}
                      onCommit={(v) => setWeight(l, v)}
                    />
                  </div>
                  <div class="field">
                    <span class="cap">ครั้ง</span>
                    <Stepper
                      label="จำนวนครั้ง"
                      value={l.reps}
                      flash={flash === `${l.id}:r`}
                      onMinus={() => stepReps(l, ex, -1)}
                      onPlus={() => stepReps(l, ex, 1)}
                      onCommit={(v) => setReps(l, v)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </section>
        );
      })}

      {adding ? (
        <section class="card">
          <h2>เลือกท่าเสริม</h2>
          {candidates.length === 0 && <p class="muted">เพิ่มท่าเสริมครบแล้ว</p>}
          <div class="variants">
            {candidates.map((e) => (
              <button type="button" key={e.id} class="chip" onClick={() => addAccessory(e)}>
                {e.name} · {e.variants[0]}
              </button>
            ))}
          </div>
          <button type="button" class="link" onClick={() => setAdding(false)}>
            ปิด
          </button>
        </section>
      ) : (
        <button type="button" class="btn ghost" onClick={() => setAdding(true)}>
          + เพิ่มท่าเสริม
        </button>
      )}

      <button type="button" class="btn primary" onClick={finish}>
        จบการฝึก
      </button>
      <button type="button" class="link danger" onClick={cancel}>
        ยกเลิกการฝึกนี้
      </button>

      {!panelVisible && <RestMini rest={rest} />}
    </div>
  );
}
