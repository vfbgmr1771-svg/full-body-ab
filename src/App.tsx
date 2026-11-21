import { useEffect, useState } from 'preact/hooks';
import { db, getSettings, type Settings } from './db';
import { useRest } from './rest';
import { RestBar } from './RestTimer';
import { Today } from './screens/Today';
import { Workout } from './screens/Workout';
import { Summary } from './screens/Summary';
import { History } from './screens/History';
import { Protein } from './screens/Protein';
import { SettingsScreen } from './screens/Settings';

type TabName = 'today' | 'history' | 'protein' | 'settings';
type View = { name: TabName } | { name: 'workout'; id: number } | { name: 'summary'; id: number };

const TABS: { name: TabName; icon: string; label: string }[] = [
  { name: 'today', icon: '🏋️', label: 'วันนี้' },
  { name: 'history', icon: '📅', label: 'ประวัติ' },
  { name: 'protein', icon: '🍗', label: 'โปรตีน' },
  { name: 'settings', icon: '⚙️', label: 'ตั้งค่า' },
];

export function App() {
  const [view, setView] = useState<View | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const rest = useRest(settings);

  useEffect(() => {
    void (async () => {
      setSettings(await getSettings());
      const active = await db.sessions.where('status').equals('in_progress').first();
      setView(active ? { name: 'workout', id: active.id! } : { name: 'today' });
    })();
  }, []);

  if (!settings || !view) return <div class="loading">กำลังโหลด…</div>;

  const updateSettings = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await db.settings.put(next);
  };

  const tab = TABS.find((t) => t.name === view.name);

  return (
    <>
      {view.name === 'today' && (
        <Today
          settings={settings}
          onStart={(id) => setView({ name: 'workout', id })}
          onGoSettings={() => setView({ name: 'settings' })}
        />
      )}
      {view.name === 'workout' && (
        <Workout
          sessionId={view.id}
          settings={settings}
          rest={rest}
          onToggleAuto={(v) => updateSettings({ autoStartTimer: v })}
          onFinish={(id) => setView({ name: 'summary', id })}
          onCancel={() => setView({ name: 'today' })}
        />
      )}
      {view.name === 'summary' && (
        <Summary sessionId={view.id} onHome={() => setView({ name: 'today' })} />
      )}
      {view.name === 'history' && <History />}
      {view.name === 'protein' && <Protein settings={settings} onSettings={updateSettings} />}
      {view.name === 'settings' && <SettingsScreen settings={settings} onSettings={updateSettings} />}

      {view.name === 'workout' && <RestBar rest={rest} />}

      {tab && (
        <nav class="tabbar" aria-label="เมนูหลัก">
          {TABS.map((t) => (
            <button
              type="button"
              key={t.name}
              class={view.name === t.name ? 'on' : ''}
              aria-current={view.name === t.name ? 'page' : undefined}
              onClick={() => setView({ name: t.name })}
            >
              <span class="ico" aria-hidden="true">
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </nav>
      )}
    </>
  );
}
