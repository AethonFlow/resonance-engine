/**
 * InsightFeed · horizontal carousel of the last N saved INSIGHTs.
 * Mobile-first compact cards. Tap a card to open the History detail.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { COLORS, TYPO } from './design';
import { API, type TenzorJournalEntryDTO } from './api';
import { useT } from './i18n';
import { Tooltip } from './Tooltip';

const CARD_W = Math.min(Dimensions.get('window').width - 48, 260);

const stateColor = (s: string): string => {
  switch (s) {
    case 'NULLSTELLE': return COLORS.amber;
    case 'SINGING':    return COLORS.amberSoft;
    case 'WARM':       return COLORS.amber;
    case 'DRIFT':      return COLORS.lime;
    case 'COLD':       return COLORS.lime;
    default:           return COLORS.crimson;
  }
};

type Props = {
  /** Increment to force-refresh from the host screen. */
  refreshKey?: number;
  limit?: number;
};

export function InsightFeed({ refreshKey, limit = 7 }: Props) {
  const t = useT();
  const router = useRouter();
  const [items, setItems] = useState<TenzorJournalEntryDTO[] | null>(null);

  const load = useCallback(async () => {
    try {
      const arr = await API.tenzorJournal(limit);
      setItems(arr);
    } catch {
      setItems([]);
    }
  }, [limit]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (items === null) {
    return null;
  }
  if (items.length === 0) {
    return (
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('journal.feed.title')}</Text>
        <Text style={styles.emptyInline}>{t('journal.feed.empty')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('journal.feed.title')}</Text>
          <Tooltip text={t('tip.journal_feed')} size={11} testID="tip-journal-feed" />
        </View>
        <TouchableOpacity onPress={() => router.push('/history')} hitSlop={8}>
          <Text style={styles.more}>{t('journal.feed.all')}  ›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={CARD_W + 10}
        decelerationRate="fast"
      >
        {items.map((e) => {
          const accent = stateColor(e.state);
          const dt = new Date(e.created_at);
          const dateStr = `${dt.getUTCDate().toString().padStart(2, '0')}.${(dt.getUTCMonth()+1).toString().padStart(2, '0')}.`;
          return (
            <TouchableOpacity
              key={e.id}
              testID={`feed-card-${e.id}`}
              onPress={() => router.push('/history')}
              activeOpacity={0.85}
              style={[styles.card, { borderColor: accent, width: CARD_W }]}
            >
              <View style={styles.cardHead}>
                <View style={[styles.dot, { backgroundColor: accent }]} />
                <Text style={[styles.state, { color: accent }]} numberOfLines={1}>{e.state}</Text>
                <Text style={styles.score}>{e.score.toFixed(2)}</Text>
              </View>
              <Text style={styles.insight} numberOfLines={3}>{e.insight}</Text>
              <View style={styles.cardFoot}>
                <Ionicons name="time-outline" size={10} color={COLORS.textMuted} />
                <Text style={styles.date}>{dateStr}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { fontFamily: TYPO.monoBold, fontSize: 10, color: COLORS.textMuted, letterSpacing: 2 },
  more:  { fontFamily: TYPO.mono, fontSize: 10, color: COLORS.amber, letterSpacing: 1 },
  emptyInline: { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted },

  scrollContent: { paddingHorizontal: 16, gap: 10 },
  card: {
    padding: 10, borderRadius: 12, borderWidth: 1,
    backgroundColor: 'rgba(6,8,10,0.85)',
    gap: 6,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  state: { fontFamily: TYPO.monoBold, fontSize: 9, letterSpacing: 1.5, flexShrink: 1 },
  score: { fontFamily: TYPO.monoBold, fontSize: 11, color: COLORS.textPrimary, marginLeft: 'auto' },

  insight: { fontFamily: TYPO.label, fontSize: 11, color: COLORS.textPrimary, lineHeight: 15 },

  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  date: { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 0.5 },
});
