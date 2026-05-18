/**
 * StreakBadge · stoic flame icon + current/best streak counter.
 * Renders compactly next to the DailyAlignment pill on Home.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { COLORS, TYPO } from './design';
import { useT } from './i18n';
import { Tooltip } from './Tooltip';

type Props = {
  current: number;
  best:    number;
};

export function StreakBadge({ current, best }: Props) {
  const router = useRouter();
  const t = useT();

  const lit = current >= 1;
  const accent = current >= 7 ? COLORS.amber
               : current >= 3 ? COLORS.amberSoft
               : current >= 1 ? COLORS.lime
               :               COLORS.textMuted;

  return (
    <TouchableOpacity
      onPress={() => router.push('/history')}
      style={[styles.box, { borderColor: lit ? accent : COLORS.panelBorder }]}
      testID="streak-badge"
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Streak ${current} of ${best}`}
    >
      <MaterialCommunityIcons
        name={lit ? 'fire' : 'fire-off'}
        size={14}
        color={accent}
      />
      <Text style={[styles.cur, { color: accent }]}>{current}</Text>
      <View style={styles.divider} />
      <Text style={styles.best}>{best}</Text>
      <View style={styles.tip}>
        <Tooltip
          testID="tip-streak"
          size={11}
          text={t('tip.streak')}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 5,
    minHeight: 28,
  },
  cur:  { fontFamily: TYPO.monoBold, fontSize: 12, letterSpacing: 1 },
  divider: { width: 1, height: 10, backgroundColor: 'rgba(255,255,255,0.10)' },
  best: { fontFamily: TYPO.mono, fontSize: 10, color: COLORS.textMuted, letterSpacing: 0.5 },
  tip:  { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
});
