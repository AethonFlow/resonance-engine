/**
 * v6 · Onboarding wizard — 3 slides + optional name + optional weekly focus.
 * Persists via SettingsProvider (AsyncStorage).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { COLORS, TYPO } from './design';
import { useSettings, useT } from './i18n';

const { width: SCREEN_W } = Dimensions.get('window');

type Step = 0 | 1 | 2 | 3 | 4;

export function OnboardingOverlay() {
  const { onboardingSeen, markOnboardingSeen, ready, setUserName, setWeeklyFocus } = useSettings();
  const t = useT();
  const [step, setStep] = useState<Step>(0);
  const [name,  setName]  = useState<string>('');
  const [focus, setFocus] = useState<string>('');

  if (!ready) return null;
  if (onboardingSeen) return null;

  const finish = () => {
    if (name.trim())  setUserName(name.trim());
    if (focus.trim()) setWeeklyFocus(focus.trim());
    markOnboardingSeen();
  };

  const slides: Array<{
    icon: 'clock-fast' | 'fire' | 'file-export-outline';
    title: string;
    body: string;
    accent: string;
  }> = [
    { icon: 'clock-fast',         title: t('onb1.title'), body: t('onb1.body'), accent: COLORS.amber },
    { icon: 'fire',                title: t('onb2.title'), body: t('onb2.body'), accent: COLORS.lime },
    { icon: 'file-export-outline', title: t('onb3.title'), body: t('onb3.body'), accent: COLORS.amberSoft },
  ];

  return (
    <Modal transparent animationType="fade" visible onRequestClose={finish}>
      <SafeAreaView style={styles.root} testID="onboarding-root">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.topBar}>
            <TouchableOpacity onPress={finish} testID="onb-skip" style={styles.skipBtn}>
              <Text style={styles.skipText}>{t('common.skip')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.bodyWrap} keyboardShouldPersistTaps="handled">
          {step < 3 ? (
            <View style={styles.body}>
              <View style={[styles.iconWrap, { borderColor: slides[step].accent }]}>
                <MaterialCommunityIcons name={slides[step].icon as any} size={64} color={slides[step].accent} />
              </View>
              <Text style={[styles.title, { color: slides[step].accent }]} testID={`onb-title-${step}`}>
                {slides[step].title}
              </Text>
              <Text style={styles.bodyText} testID={`onb-body-${step}`}>
                {slides[step].body}
              </Text>
            </View>
          ) : step === 3 ? (
            <View style={styles.body}>
              <Ionicons name="person-outline" size={56} color={COLORS.amber} />
              <Text style={[styles.title, { color: COLORS.amber }]}>{t('onb.name.title')}</Text>
              <TextInput
                testID="onb-name-input"
                value={name}
                onChangeText={setName}
                placeholder={t('onb.name.placeholder')}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                maxLength={40}
                autoFocus
              />
            </View>
          ) : (
            <View style={styles.body}>
              <MaterialCommunityIcons name="target" size={56} color={COLORS.lime} />
              <Text style={[styles.title, { color: COLORS.lime }]}>{t('onb.focus.title')}</Text>
              <TextInput
                testID="onb-focus-input"
                value={focus}
                onChangeText={setFocus}
                placeholder={t('onb.focus.placeholder')}
                placeholderTextColor={COLORS.textMuted}
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                maxLength={200}
                multiline
              />
            </View>
          )}
          </ScrollView>

          <View style={styles.dots}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={[
                styles.dot,
                i === step && {
                  backgroundColor: i < 3 ? slides[Math.min(i, 2)].accent : COLORS.amber,
                  width: 22,
                },
              ]} />
            ))}
          </View>

          <View style={styles.cta}>
            {step < 4 ? (
              <TouchableOpacity
                testID="onb-next"
                style={[styles.cont, { borderColor: COLORS.amber, backgroundColor: 'rgba(255,255,255,0.04)' }]}
                onPress={() => setStep(((step + 1) as Step))}
              >
                <Text style={[styles.contText, { color: COLORS.amber }]}>{t('common.next')}</Text>
                <Ionicons name="arrow-forward" size={18} color={COLORS.amber} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                testID="onb-start"
                style={[styles.cont, { borderColor: COLORS.amber, backgroundColor: 'rgba(245,176,65,0.10)' }]}
                onPress={finish}
              >
                <Text style={[styles.contText, { color: COLORS.amber }]}>{t('common.done')}</Text>
                <Ionicons name="checkmark" size={18} color={COLORS.amber} />
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.void, justifyContent: 'space-between', padding: 24 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end' },
  skipBtn: { paddingHorizontal: 12, paddingVertical: 8, minHeight: 44, minWidth: 60, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontFamily: TYPO.mono, fontSize: 12, letterSpacing: 2, color: COLORS.textMuted },
  bodyWrap: { flexGrow: 1, justifyContent: 'center' },
  body: { alignItems: 'center', justifyContent: 'center', gap: 22, paddingHorizontal: 8 },
  iconWrap: { width: 128, height: 128, borderRadius: 64, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  title: { fontFamily: TYPO.monoBold, fontSize: 20, letterSpacing: 2, textAlign: 'center' },
  bodyText: { fontFamily: TYPO.label, fontSize: 16, lineHeight: 24, color: COLORS.textPrimary, textAlign: 'center', paddingHorizontal: 8, maxWidth: SCREEN_W - 64 },
  input: { width: SCREEN_W - 80, maxWidth: 420, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: COLORS.panelBorder, backgroundColor: '#000', color: COLORS.textPrimary, fontFamily: TYPO.label, fontSize: 15 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)' },
  cta: { paddingBottom: 8 },
  cont: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderWidth: 1, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 22, minHeight: 48 },
  contText: { fontFamily: TYPO.labelBold, fontSize: 13, letterSpacing: 3 },
});
