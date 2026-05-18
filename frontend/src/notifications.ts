/**
 * Daily reminder · scheduling wrapper around expo-notifications.
 *
 * Works on iOS / Android (full local notifications).
 * On Web → no native push, but the on/off + time preference is still
 * persisted via AsyncStorage so the UX is consistent across platforms.
 *
 * Public API:
 *   isNotificationsSupported()
 *   requestNotificationPermission()
 *   scheduleDailyReminder(hour, minute, lang)
 *   cancelDailyReminder()
 *   getStoredReminder()   -> { enabled, hour, minute } | null
 *   setStoredReminder(...)
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { translate, type Lang } from './i18n';

const KEY = '@sphere/reminder/v1';
const NOTIF_ID = 'sphere-daily-resonance-v1';

export type Reminder = {
  enabled: boolean;
  hour:    number;     // 0-23
  minute:  number;     // 0-59
};

export function isNotificationsSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export async function getStoredReminder(): Promise<Reminder | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (typeof o?.hour !== 'number' || typeof o?.minute !== 'number') return null;
    return {
      enabled: !!o.enabled,
      hour:    Math.max(0, Math.min(23, Math.floor(o.hour))),
      minute:  Math.max(0, Math.min(59, Math.floor(o.minute))),
    };
  } catch {
    return null;
  }
}

export async function setStoredReminder(r: Reminder): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(r));
  } catch { /* ignore */ }
}

/**
 * Dynamic import keeps the module lightweight on web (where
 * expo-notifications has no useful native implementation).
 */
async function getNotificationsModule(): Promise<any | null> {
  if (!isNotificationsSupported()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');
    return Notifications;
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const N = await getNotificationsModule();
  if (!N) return false;
  try {
    const settings = await N.getPermissionsAsync();
    let granted =
      settings.granted ||
      settings.ios?.status === N.IosAuthorizationStatus?.PROVISIONAL ||
      settings.status === 'granted';
    if (!granted) {
      const req = await N.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      granted = !!req?.granted || req?.status === 'granted';
    }
    return !!granted;
  } catch {
    return false;
  }
}

export async function cancelDailyReminder(): Promise<void> {
  const N = await getNotificationsModule();
  if (!N) return;
  try {
    // Cancel by both stored id and any prior scheduled with same ID.
    const scheduled = await N.getAllScheduledNotificationsAsync();
    for (const s of scheduled ?? []) {
      if (s?.identifier && (s.identifier === NOTIF_ID || s.content?.data?.tag === NOTIF_ID)) {
        await N.cancelScheduledNotificationAsync(s.identifier);
      }
    }
  } catch { /* ignore */ }
}

/**
 * Schedule a daily reminder at the given hour:minute (local time).
 * Returns true on success, false on web/unsupported/no-permission.
 */
export async function scheduleDailyReminder(
  hour: number,
  minute: number,
  lang: Lang = 'de',
): Promise<boolean> {
  const N = await getNotificationsModule();
  if (!N) return false;
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return false;
    await cancelDailyReminder();

    const title = translate(lang, 'notif.daily.title');
    const body  = translate(lang, 'notif.daily.body');

    await N.scheduleNotificationAsync({
      identifier: NOTIF_ID,
      content: {
        title,
        body,
        sound: 'default',
        data: { tag: NOTIF_ID, kind: 'daily-resonance' },
      },
      trigger: {
        hour: Math.max(0, Math.min(23, Math.floor(hour))),
        minute: Math.max(0, Math.min(59, Math.floor(minute))),
        repeats: true,
        channelId: 'daily-resonance',
      },
    });

    // Best-effort Android channel so the notification appears on Android 8+.
    if (Platform.OS === 'android' && N.setNotificationChannelAsync) {
      try {
        await N.setNotificationChannelAsync('daily-resonance', {
          name: 'Daily Resonance',
          importance: N.AndroidImportance?.DEFAULT ?? 3,
          sound: 'default',
        });
      } catch { /* ignore */ }
    }
    return true;
  } catch {
    return false;
  }
}
