import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Android-only rest alerts. A scheduled system notification fires on time even when the screen
 * is off or the app is in the background, which a web page cannot do.
 */

export const isNative = Capacitor.isNativePlatform();

const CHANNEL = 'rest-timer';
const REST_ID = 4201;

/** True once the system has agreed to show our notifications; the in-app beep is then skipped. */
let systemAlerts = false;
export const usesSystemAlerts = () => systemAlerts;

export async function initNativeAlerts() {
  if (!isNative) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL,
      name: 'หมดเวลาพัก',
      description: 'เตือนเมื่อพักครบและถึงเซ็ตถัดไป',
      importance: 5, // heads-up, sound and vibration
      visibility: 1,
      vibration: true,
    });
    const perm = await LocalNotifications.checkPermissions();
    systemAlerts = perm.display === 'granted';
  } catch {
    systemAlerts = false;
  }
}

async function ensurePermission(): Promise<boolean> {
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display === 'granted') return true;
  if (perm.display === 'denied') return false;
  const asked = await LocalNotifications.requestPermissions();
  return asked.display === 'granted';
}

/** Schedules (or with null, cancels) the "rest over" notification for the given end time. */
export async function scheduleRestEnd(endMs: number | null) {
  if (!isNative) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_ID }] });
    if (endMs == null || endMs <= Date.now() + 1000) return;
    systemAlerts = await ensurePermission();
    if (!systemAlerts) return;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REST_ID,
          channelId: CHANNEL,
          title: 'พักครบแล้ว',
          body: 'ได้เวลาเซ็ตถัดไป',
          schedule: { at: new Date(endMs), allowWhileIdle: true },
        },
      ],
    });
  } catch {
    systemAlerts = false;
  }
}
