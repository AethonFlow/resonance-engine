/**
 * DailyAlignment · stoic pill on the Home screen.
 * Reflects /api/tenzor/stats?days=1 (today_aligned).
 *
 * Visuals:
 *   Aligned    -> amber dot + "Heute ausgerichtet"
 *   Not yet    -> dim grey dot + "Heute noch nicht ausgerichtet"
 *
 * Tapping opens the History screen.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, TYPO } from './design';
import { API, type TenzorStatsDTO } from './api';
import { useT } from './i18n';
import { Tooltip } from './Tooltip';

type Props = {
  /** Increment this when a new TENZOR call completes to force refresh. */
  refreshKey?: number;
};

export function DailyAlignment({ refreshKey }: Props) {
  const t = useT();
  const router = useRouter();
  const [stats, setStats] = useState<TenzorStatsDTO | null>(null);
  const mountedRef = useRef<boolean>(true);

  const load = useCallback(async () => {
    try {
      const r = await API.tenzorStats(1);
      if (mountedRef.current) setStats(r);
    } catch {
      if (mountedRef.current) setStats(null);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') load();
    });
    return () => {
      mountedRef.current = false;
      sub.remove();
    };
  }, [load]);

  useEffect(() => { load(); }, [refreshKey, load]);

  const aligned = !!stats?.today_aligned;
  const count   = stats?.today_count ?? 0;
  const score   = stats?.today_score ?? null;

  const dotColor  = aligned ? COLORS.amber : 'rgba(255,255,255,0.22)';
  const borderCol = aligned ? COLORS.amber : COLORS.panelBorder;
  const textCol   = aligned ? COLORS.amber : COLORS.textSecondary;
  const label     = aligned ? t('journal.aligned') : t('journal.not_aligned');

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.pill, { borderColor: borderCol }]}
        onPress={() => router.push('/history')}
        testID="daily-alignment"
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={[styles.label, { color: textCol }]} numberOfLines={1}>
          {label}
        </Text>
        {count > 0 ? (
          <View style={styles.meta}>
            {score !== null ? (
              <Text style={[styles.score, { color: textCol }]}>
                {score.toFixed(2)}
              </Text>
            ) : null}
            <View style={styles.divider} />
            <Ionicons name="time-outline" size={10} color={COLORS.textMuted} />
            <Text style={styles.count}>{count}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
      <View style={styles.tip}>
        <Tooltip text={t('tip.aligned')} size={13} testID="tip-aligned" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'center', gap: 4,
    paddingHorizontal: 4,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    minHeight: 30,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: { fontFamily: TYPO.mono, fontSize: 10, letterSpacing: 1.5 },
  meta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginLeft: 4, paddingLeft: 8,
    borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.15)',
  },
  score: { fontFamily: TYPO.monoBold, fontSize: 10, letterSpacing: 1 },
  divider: { width: 1, height: 10, backgroundColor: 'rgba(255,255,255,0.10)' },
  count: { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 0.5 },
  tip: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
});
