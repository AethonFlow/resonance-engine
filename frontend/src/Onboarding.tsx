/**
 * First-launch onboarding wizard.
 * 3 minimalist slides. Persists via SettingsProvider (AsyncStorage).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { COLORS, TYPO } from './design';
import { useSettings, useT } from './i18n';

const { width: SCREEN_W } = Dimensions.get('window');

export function OnboardingOverlay() {
  const { onboardingSeen, markOnboardingSeen, ready } = useSettings();
  const t = useT();
  const [step, setStep] = useState<0 | 1 | 2>(0);

  if (!ready) return null;
  if (onboardingSeen) return null;

  const slides: Array<{
    icon: 'lan-pending' | 'tune-vertical' | 'lightning-bolt-outline';
    title: string;
    body: string;
    accent: string;
  }> = [
    {
      icon: 'lan-pending',
      title: t('onb.1.title'),
      body:  t('onb.1.body'),
      accent: COLORS.amber,
    },
    {
      icon: 'tune-vertical',
      title: t('onb.2.title'),
      body:  t('onb.2.body'),
      accent: COLORS.lime,
    },
    {
      icon: 'lightning-bolt-outline',
      title: t('onb.3.title'),
      body:  t('onb.3.body'),
      accent: COLORS.amberSoft,
    },
  ];

  const s = slides[step];

  return (
    <Modal transparent animationType="fade" visible onRequestClose={markOnboardingSeen}>
      <SafeAreaView style={styles.root} testID="onboarding-root">
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={markOnboardingSeen}
            testID="onb-skip"
            style={styles.skipBtn}
          >
            <Text style={styles.skipText}>{t('onb.skip')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={[styles.iconWrap, { borderColor: s.accent }]}>
            <MaterialCommunityIcons name={s.icon} size={64} color={s.accent} />
          </View>
          <Text style={[styles.title, { color: s.accent }]} testID={`onb-title-${step}`}>
            {s.title}
          </Text>
          <Text style={styles.bodyText} testID={`onb-body-${step}`}>
            {s.body}
          </Text>
        </View>

        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === step && { backgroundColor: s.accent, width: 24 },
              ]}
            />
          ))}
        </View>

        <View style={styles.cta}>
          {step < 2 ? (
            <TouchableOpacity
              testID="onb-next"
              style={[styles.cont, { borderColor: s.accent, backgroundColor: 'rgba(255,255,255,0.04)' }]}
              onPress={() => setStep((step + 1) as 0 | 1 | 2)}
            >
              <Text style={[styles.contText, { color: s.accent }]}>{t('onb.next')}</Text>
              <Ionicons name="arrow-forward" size={18} color={s.accent} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID="onb-start"
              style={[styles.cont, { borderColor: COLORS.amber, backgroundColor: 'rgba(245,176,65,0.10)' }]}
              onPress={markOnboardingSeen}
            >
              <Text style={[styles.contText, { color: COLORS.amber }]}>{t('onb.start')}</Text>
              <Ionicons name="checkmark" size={18} color={COLORS.amber} />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: COLORS.void,
    justifyContent: 'space-between',
    padding: 24,
  },
  topBar: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingTop: 4,
  },
  skipBtn: {
    paddingHorizontal: 12, paddingVertical: 8,
    minHeight: 44, minWidth: 60,
    alignItems: 'center', justifyContent: 'center',
  },
  skipText: {
    fontFamily: TYPO.mono, fontSize: 12, letterSpacing: 2,
    color: COLORS.textMuted,
  },

  body: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24,
    paddingHorizontal: 8,
  },
  iconWrap: {
    width: 128, height: 128, borderRadius: 64,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  title: {
    fontFamily: TYPO.monoBold, fontSize: 22, letterSpacing: 3,
    textAlign: 'center',
  },
  bodyText: {
    fontFamily: TYPO.label, fontSize: 16, lineHeight: 24,
    color: COLORS.textPrimary, textAlign: 'center',
    paddingHorizontal: 8,
    maxWidth: SCREEN_W - 64,
  },

  dots: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginBottom: 16,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  cta: { paddingBottom: 8 },
  cont: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12,
    borderWidth: 1, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 22,
    minHeight: 48,
  },
  contText: {
    fontFamily: TYPO.labelBold, fontSize: 13, letterSpacing: 3,
  },
});
