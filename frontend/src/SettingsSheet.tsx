/**
 * Compact settings sheet — language toggle (DE/EN) + daily reminder + replay onboarding.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, TYPO } from './design';
import { useSettings, useT, type Lang } from './i18n';
import {
  cancelDailyReminder,
  getStoredReminder,
  isNotificationsSupported,
  scheduleDailyReminder,
  setStoredReminder,
} from './notifications';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const TIME_PRESETS: Array<{ hour: number; minute: number; label: string }> = [
  { hour: 7,  minute: 0,  label: '07:00' },
  { hour: 12, minute: 0,  label: '12:00' },
  { hour: 19, minute: 0,  label: '19:00' },
  { hour: 22, minute: 0,  label: '22:00' },
];

export function SettingsSheet({ visible, onClose }: Props) {
  const { lang, setLang, resetOnboarding } = useSettings();
  const t = useT();

  const [reminderOn,   setReminderOn]   = useState<boolean>(false);
  const [reminderTime, setReminderTime] = useState<string>('19:00');
  const [reminderBusy, setReminderBusy] = useState<boolean>(false);

  const supported = isNotificationsSupported();

  // hydrate stored preference
  useEffect(() => {
    if (!visible) return;
    (async () => {
      const r = await getStoredReminder();
      if (r) {
        setReminderOn(!!r.enabled);
        setReminderTime(`${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}`);
      }
    })();
  }, [visible]);

  const onToggleReminder = useCallback(async (next: boolean) => {
    setReminderBusy(true);
    try {
      const [hh, mm] = reminderTime.split(':').map(Number);
      const h = isFinite(hh) ? hh : 19;
      const m = isFinite(mm) ? mm : 0;
      if (next) {
        if (!supported) {
          Alert.alert(t('set.reminder'), t('notif.unsupported'));
        } else {
          const ok = await scheduleDailyReminder(h, m, lang);
          if (!ok) {
            Alert.alert(t('notif.permission_title'), t('notif.permission_body'));
            await setStoredReminder({ enabled: false, hour: h, minute: m });
            setReminderOn(false);
            return;
          }
        }
        await setStoredReminder({ enabled: true, hour: h, minute: m });
        setReminderOn(true);
      } else {
        await cancelDailyReminder();
        await setStoredReminder({ enabled: false, hour: h, minute: m });
        setReminderOn(false);
      }
    } finally {
      setReminderBusy(false);
    }
  }, [reminderTime, supported, lang, t]);

  const onPickTime = useCallback(async (hh: number, mm: number) => {
    const lbl = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    setReminderTime(lbl);
    if (reminderOn) {
      setReminderBusy(true);
      try {
        if (supported) await scheduleDailyReminder(hh, mm, lang);
      } finally { setReminderBusy(false); }
    }
    await setStoredReminder({ enabled: reminderOn, hour: hh, minute: mm });
  }, [reminderOn, supported, lang]);

  const LANGS: { code: Lang; label: string }[] = [
    { code: 'de', label: t('set.language.de') },
    { code: 'en', label: t('set.language.en') },
  ];

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.bg} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('set.language').toUpperCase()}</Text>
            <TouchableOpacity onPress={onClose} testID="settings-close" hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            {LANGS.map((l) => {
              const active = lang === l.code;
              return (
                <TouchableOpacity
                  key={l.code}
                  testID={`lang-${l.code}`}
                  onPress={() => setLang(l.code)}
                  style={[
                    styles.langBtn,
                    active && { borderColor: COLORS.amber, backgroundColor: 'rgba(245,176,65,0.08)' },
                  ]}
                >
                  <Text style={[styles.langText, active && { color: COLORS.amber }]}>
                    {l.label}
                  </Text>
                  {active ? (
                    <Ionicons name="checkmark" size={16} color={COLORS.amber} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Daily Reminder */}
          <View style={styles.sectionBox}>
            <View style={styles.reminderTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{t('set.reminder')}</Text>
                {!supported ? (
                  <Text style={styles.sectionHint}>{t('notif.unsupported')}</Text>
                ) : null}
              </View>
              <Switch
                testID="reminder-switch"
                value={reminderOn}
                onValueChange={onToggleReminder}
                disabled={reminderBusy}
                thumbColor={reminderOn ? COLORS.amber : '#888'}
                trackColor={{ false: '#222', true: 'rgba(245,176,65,0.4)' }}
                ios_backgroundColor="#222"
              />
            </View>
            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>{t('set.reminder.time')}</Text>
              <View style={styles.timeBtns}>
                {TIME_PRESETS.map((p) => {
                  const active = reminderTime === p.label;
                  return (
                    <TouchableOpacity
                      key={p.label}
                      testID={`time-${p.label}`}
                      onPress={() => onPickTime(p.hour, p.minute)}
                      style={[
                        styles.timeBtn,
                        active && { borderColor: COLORS.amber, backgroundColor: 'rgba(245,176,65,0.08)' },
                      ]}
                    >
                      <Text style={[styles.timeBtnText, active && { color: COLORS.amber }]}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          <TouchableOpacity
            testID="replay-onboarding"
            onPress={() => { resetOnboarding(); onClose(); }}
            style={styles.replayBtn}
          >
            <Ionicons name="refresh" size={16} color={COLORS.textSecondary} />
            <Text style={styles.replayText}>{t('set.replay_onboarding')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 380, padding: 18, borderRadius: 14,
    backgroundColor: COLORS.deepVoid,
    borderWidth: 1, borderColor: COLORS.panelBorder,
    gap: 14,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: TYPO.monoBold, fontSize: 12, letterSpacing: 3, color: COLORS.amber },

  row: { flexDirection: 'row', gap: 10 },
  langBtn: {
    flex: 1,
    paddingVertical: 12, paddingHorizontal: 10,
    borderWidth: 1, borderColor: COLORS.panelBorder, borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 48,
  },
  langText: { fontFamily: TYPO.labelBold, fontSize: 13, color: COLORS.textSecondary, letterSpacing: 1.5 },

  sectionBox: {
    padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.panelBorder,
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: 12,
  },
  reminderTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontFamily: TYPO.labelBold, fontSize: 12, color: COLORS.textPrimary, letterSpacing: 1.2 },
  sectionHint:  { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted, marginTop: 4, lineHeight: 13 },

  timeRow: { gap: 8 },
  timeLabel: { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 1.5 },
  timeBtns: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  timeBtn: {
    paddingVertical: 8, paddingHorizontal: 12,
    borderWidth: 1, borderColor: COLORS.panelBorder, borderRadius: 8,
    minHeight: 36, minWidth: 64,
    alignItems: 'center', justifyContent: 'center',
  },
  timeBtnText: { fontFamily: TYPO.mono, fontSize: 11, color: COLORS.textSecondary, letterSpacing: 1 },

  replayBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: COLORS.panelBorder, borderRadius: 10,
    minHeight: 44,
  },
  replayText: { fontFamily: TYPO.label, fontSize: 13, color: COLORS.textSecondary },
});
