/**
 * v6 · Settings sheet — language, daily reminder, premium status, profile,
 * legal links, version.
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
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';

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
  const router = useRouter();
  const {
    lang, setLang, resetOnboarding,
    isPremium, setPremium,
    userName, setUserName, weeklyFocus, setWeeklyFocus,
    freeRemaining,
  } = useSettings();
  const t = useT();

  const [reminderOn,   setReminderOn]   = useState<boolean>(false);
  const [reminderTime, setReminderTime] = useState<string>('19:00');
  const [reminderBusy, setReminderBusy] = useState<boolean>(false);
  const [nameDraft,  setNameDraft]  = useState<string>(userName);
  const [focusDraft, setFocusDraft] = useState<string>(weeklyFocus);

  const supported = isNotificationsSupported();

  useEffect(() => {
    if (!visible) return;
    setNameDraft(userName);
    setFocusDraft(weeklyFocus);
    (async () => {
      const r = await getStoredReminder();
      if (r) {
        setReminderOn(!!r.enabled);
        setReminderTime(`${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}`);
      }
    })();
  }, [visible, userName, weeklyFocus]);

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
    if (reminderOn && supported) await scheduleDailyReminder(hh, mm, lang);
    await setStoredReminder({ enabled: reminderOn, hour: hh, minute: mm });
  }, [reminderOn, supported, lang]);

  const LANGS: { code: Lang; label: string }[] = [
    { code: 'de', label: t('set.language.de') },
    { code: 'en', label: t('set.language.en') },
  ];

  const appVersion = (Constants?.expoConfig?.version as string) || '1.0.0';

  const saveProfile = () => {
    setUserName(nameDraft);
    setWeeklyFocus(focusDraft);
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.bg} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>SETTINGS</Text>
            <TouchableOpacity onPress={onClose} testID="settings-close" hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ gap: 14 }} showsVerticalScrollIndicator={false}>
            {/* Premium status */}
            <View style={styles.sectionBox}>
              <View style={styles.premiumTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{t('set.premium.status')}</Text>
                  <Text style={[styles.premiumPill, isPremium ? styles.pillActive : styles.pillInactive]}>
                    {isPremium ? `★ ${t('set.premium.active')}` : t('set.premium.inactive')}
                  </Text>
                </View>
                <TouchableOpacity
                  testID="open-paywall"
                  onPress={() => { onClose(); router.push('/paywall'); }}
                  style={[styles.upgradeBtn, isPremium && { opacity: 0.6 }]}
                >
                  <Ionicons name="diamond-outline" size={14} color={COLORS.amber} />
                  <Text style={styles.upgradeText}>{t('set.premium.upgrade')}</Text>
                </TouchableOpacity>
              </View>
              {!isPremium ? (
                <Text style={styles.quotaInline}>
                  {freeRemaining > 0
                    ? t('home.quota.left').replace('{{n}}', String(freeRemaining))
                    : t('home.quota.none')}
                </Text>
              ) : (
                <Text style={[styles.quotaInline, { color: COLORS.amberSoft }]}>
                  {t('home.quota.unlimited')}
                </Text>
              )}
            </View>

            {/* Language */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>{t('set.language')}</Text>
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
                      <Text style={[styles.langText, active && { color: COLORS.amber }]}>{l.label}</Text>
                      {active ? <Ionicons name="checkmark" size={16} color={COLORS.amber} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Profile */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>{t('set.name')}</Text>
              <TextInput
                testID="set-name"
                value={nameDraft}
                onChangeText={setNameDraft}
                onBlur={saveProfile}
                placeholder={t('onb.name.placeholder')}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                maxLength={40}
              />
              <Text style={[styles.sectionTitle, { marginTop: 8 }]}>{t('set.focus')}</Text>
              <TextInput
                testID="set-focus"
                value={focusDraft}
                onChangeText={setFocusDraft}
                onBlur={saveProfile}
                placeholder={t('onb.focus.placeholder')}
                placeholderTextColor={COLORS.textMuted}
                style={[styles.input, { minHeight: 56, textAlignVertical: 'top' }]}
                maxLength={200}
                multiline
              />
            </View>

            {/* Daily Reminder */}
            <View style={styles.sectionBox}>
              <View style={styles.reminderTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{t('set.reminder')}</Text>
                  {!supported ? <Text style={styles.sectionHint}>{t('notif.unsupported')}</Text> : null}
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
              <Text style={[styles.sectionTitle, { fontSize: 9 }]}>{t('set.reminder.time')}</Text>
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
                      <Text style={[styles.timeBtnText, active && { color: COLORS.amber }]}>{p.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Legal */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>LEGAL</Text>
              <TouchableOpacity
                testID="open-privacy"
                onPress={() => { onClose(); router.push('/privacy'); }}
                style={styles.legalRow}
              >
                <Ionicons name="shield-checkmark-outline" size={15} color={COLORS.textSecondary} />
                <Text style={styles.legalText}>{t('legal.privacy')}</Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
              <TouchableOpacity
                testID="open-imprint"
                onPress={() => { onClose(); router.push('/imprint'); }}
                style={styles.legalRow}
              >
                <Ionicons name="information-circle-outline" size={15} color={COLORS.textSecondary} />
                <Text style={styles.legalText}>{t('legal.imprint')}</Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
              <View style={[styles.legalRow, { borderBottomWidth: 0 }]}>
                <MaterialCommunityIcons name="information-outline" size={15} color={COLORS.textMuted} />
                <Text style={[styles.legalText, { color: COLORS.textMuted }]}>{t('set.version')} {appVersion}</Text>
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
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  card: { width: '100%', maxWidth: 400, maxHeight: '88%', padding: 16, borderRadius: 14, backgroundColor: COLORS.deepVoid, borderWidth: 1, borderColor: COLORS.panelBorder },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontFamily: TYPO.monoBold, fontSize: 12, letterSpacing: 3, color: COLORS.amber },

  sectionBox: { padding: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.panelBorder, backgroundColor: 'rgba(0,0,0,0.35)', gap: 8 },
  sectionTitle: { fontFamily: TYPO.labelBold, fontSize: 10, color: COLORS.textMuted, letterSpacing: 2 },
  sectionHint:  { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted, marginTop: 4, lineHeight: 13 },

  premiumTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  premiumPill: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, fontFamily: TYPO.monoBold, fontSize: 9, letterSpacing: 1.5 },
  pillActive:   { backgroundColor: 'rgba(245,176,65,0.12)', color: COLORS.amber, borderWidth: 1, borderColor: COLORS.amber },
  pillInactive: { backgroundColor: 'rgba(255,255,255,0.04)', color: COLORS.textMuted, borderWidth: 1, borderColor: COLORS.panelBorder },
  upgradeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.amber, backgroundColor: 'rgba(245,176,65,0.06)' },
  upgradeText: { fontFamily: TYPO.monoBold, fontSize: 10, color: COLORS.amber, letterSpacing: 1 },
  quotaInline: { fontFamily: TYPO.mono, fontSize: 10, color: COLORS.textSecondary, letterSpacing: 0.5 },

  row: { flexDirection: 'row', gap: 8 },
  langBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 10, borderWidth: 1, borderColor: COLORS.panelBorder, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40 },
  langText: { fontFamily: TYPO.labelBold, fontSize: 12, color: COLORS.textSecondary, letterSpacing: 1.5 },

  input: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.panelBorder, backgroundColor: '#000', color: COLORS.textPrimary, fontFamily: TYPO.label, fontSize: 13 },

  reminderTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeBtns: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  timeBtn: { paddingVertical: 7, paddingHorizontal: 10, borderWidth: 1, borderColor: COLORS.panelBorder, borderRadius: 6, minHeight: 32, minWidth: 56, alignItems: 'center', justifyContent: 'center' },
  timeBtnText: { fontFamily: TYPO.mono, fontSize: 11, color: COLORS.textSecondary, letterSpacing: 1 },

  legalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  legalText: { fontFamily: TYPO.label, fontSize: 13, color: COLORS.textPrimary },

  replayBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.panelBorder, borderRadius: 8, minHeight: 40 },
  replayText: { fontFamily: TYPO.label, fontSize: 12, color: COLORS.textSecondary },
});
