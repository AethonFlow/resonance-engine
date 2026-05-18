/**
 * CheckInCard · the single most important CTA on the home screen.
 * Reads the user's daily stats and renders one of two states:
 *   • no entry today  → big "Eintrag erstellen" CTA with personal greeting
 *   • entry today     → "Heute eingetragen" with the latest insight preview
 *                       and a "Verlauf öffnen" link.
 *
 * Designed to make the home screen INTUITIVE for first-time users:
 * one large tap target, one clear next action.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { COLORS, TYPO } from './design';
import { API, type TenzorStatsDTO, type TenzorJournalEntryDTO } from './api';
import { useSettings, useT } from './i18n';

type Props = {
  /** Bumped from the host whenever a tune/invoke completes. */
  refreshKey?: number;
  /** Called when the user taps the primary CTA when no entry exists yet. */
  onPrimaryAction: () => void;
};

function timeOfDayKey(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours();
  if (h < 11) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

export function CheckInCard({ refreshKey, onPrimaryAction }: Props) {
  const t = useT();
  const router = useRouter();
  const { userName } = useSettings();

  const [stats, setStats]   = useState<TenzorStatsDTO | null>(null);
  const [latest, setLatest] = useState<TenzorJournalEntryDTO | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, j] = await Promise.all([
        API.tenzorStats(1),
        API.tenzorJournal(1).catch(() => []),
      ]);
      setStats(s);
      setLatest(j && j.length > 0 ? j[0] : null);
    } catch {
      setStats(null);
      setLatest(null);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  const hasToday = (stats?.today_count ?? 0) > 0;
  const greetingKey = `home.checkin.greet.${timeOfDayKey()}` as any;
  const greeting = t(greetingKey);
  const greetingFull = userName
    ? `${greeting}, ${userName}.`
    : `${greeting}.`;

  if (!hasToday) {
    return (
      <View style={[styles.card, styles.cardPrimary]} testID="checkin-card-empty">
        <Text style={styles.greet}>{greetingFull}</Text>
        <Text style={styles.headlinePrimary}>{t('home.checkin.prompt')}</Text>

        <TouchableOpacity
          onPress={onPrimaryAction}
          style={styles.primaryBtn}
          testID="checkin-cta"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="pen-plus" size={18} color={COLORS.void} />
          <Text style={styles.primaryBtnText}>{t('home.checkin.cta')}</Text>
          <Ionicons name="arrow-forward" size={18} color={COLORS.void} />
        </TouchableOpacity>

        <Text style={styles.hint}>{t('home.checkin.hint')}</Text>
      </View>
    );
  }

  // hasToday
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => router.push('/history')}
      style={[styles.card, styles.cardDone]}
      testID="checkin-card-done"
    >
      <View style={styles.doneTop}>
        <View style={styles.doneBadge}>
          <Ionicons name="checkmark" size={12} color={COLORS.amber} />
          <Text style={styles.doneBadgeText}>{t('home.checkin.done_today')}</Text>
        </View>
        <Text style={styles.scorePill}>
          {(stats?.today_score ?? 0).toFixed(2)}
        </Text>
      </View>

      {latest ? (
        <Text style={styles.preview} numberOfLines={2}>
          „{latest.insight}"
        </Text>
      ) : null}

      <View style={styles.doneFoot}>
        <Text style={styles.openLink}>{t('home.checkin.open')}</Text>
        <Ionicons name="chevron-forward" size={14} color={COLORS.amber} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginTop: 8, marginBottom: 6,
    padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(6,8,10,0.92)',
    borderWidth: 1,
    gap: 10,
  },
  cardPrimary: { borderColor: COLORS.amber },
  cardDone:    { borderColor: COLORS.panelBorder },

  greet: {
    fontFamily: TYPO.mono, fontSize: 10, letterSpacing: 1.5,
    color: COLORS.textMuted, textTransform: 'uppercase',
  },
  headlinePrimary: {
    fontFamily: TYPO.labelBold, fontSize: 16, lineHeight: 22,
    color: COLORS.textPrimary,
  },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.amber,
    paddingVertical: 14, borderRadius: 10,
    minHeight: 48,
    marginTop: 2,
  },
  primaryBtnText: {
    fontFamily: TYPO.monoBold, fontSize: 12, letterSpacing: 2.5,
    color: COLORS.void,
  },
  hint: {
    fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted,
    letterSpacing: 0.5, textAlign: 'center',
  },

  doneTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  doneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999, borderWidth: 1, borderColor: COLORS.amber,
    backgroundColor: 'rgba(245,176,65,0.06)',
  },
  doneBadgeText: { fontFamily: TYPO.monoBold, fontSize: 9, color: COLORS.amber, letterSpacing: 1.5 },
  scorePill:     { fontFamily: TYPO.monoBold, fontSize: 14, color: COLORS.amber },

  preview: {
    fontFamily: TYPO.label, fontSize: 13, lineHeight: 19,
    color: COLORS.textPrimary,
  },
  doneFoot: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 2,
  },
  openLink: { fontFamily: TYPO.monoBold, fontSize: 10, color: COLORS.amber, letterSpacing: 1.5 },
});
