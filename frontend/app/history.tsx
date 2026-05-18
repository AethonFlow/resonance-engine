/**
 * TENZOR — History tab.
 * Last 20 resonance reports with score, factor, state, vector + per-row delete.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { COLORS, TYPO } from '../src/design';
import { API, type TenzorHistoryDTO, type TenzorStatsDTO } from '../src/api';
import { useT, useSettings } from '../src/i18n';
import { Sparkline } from '../src/Sparkline';
import { Tooltip } from '../src/Tooltip';
import { shareReportText, shareReportPdf, fromHistory } from '../src/export';

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

export default function HistoryScreen() {
  const router = useRouter();
  const t = useT();
  const { lang } = useSettings();
  const [items, setItems] = useState<TenzorHistoryDTO[] | null>(null);
  const [stats, setStats] = useState<TenzorStatsDTO | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [range, setRange] = useState<7 | 30>(7);

  const load = useCallback(async () => {
    try {
      const [arr, st] = await Promise.all([
        API.tenzorHistory(20),
        API.tenzorStats(range).catch(() => null),
      ]);
      setItems(arr);
      setStats(st);
    } catch {
      setItems([]);
      setStats(null);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onDeleteOne = useCallback((id: string) => {
    Alert.alert(t('tnz.delete_one'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
          try {
            await API.tenzorHistoryDelete(id);
            try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
            setItems((prev) => (prev ?? []).filter((e) => e.id !== id));
          } catch { /* ignore */ }
        } },
    ]);
  }, [t]);

  const onClearAll = useCallback(() => {
    Alert.alert(t('tnz.delete_all'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.clear'), style: 'destructive', onPress: async () => {
          try {
            await API.tenzorHistoryClear();
            try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
            setItems([]);
          } catch { /* ignore */ }
        } },
    ]);
  }, [t]);

  return (
    <SafeAreaView style={styles.root} testID="history-root">
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          testID="history-back"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>{t('tnz.history')}</Text>
          <Text style={styles.sub}>{items?.length ?? '·'} / 20</Text>
        </View>
        <TouchableOpacity
          onPress={onClearAll}
          style={styles.clearBtn}
          testID="history-clear-all"
          disabled={!items || items.length === 0}
        >
          <Ionicons name="trash-outline" size={20} color={!items || items.length === 0 ? COLORS.textMuted : COLORS.crimson} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.amber} />}
      >
        {/* 7-day / 30-day coherence sparkline */}
        <View style={styles.sparkRow}>
          <View style={{ flex: 1 }}>
            <Sparkline series={stats?.series ?? []} />
          </View>
          <View style={styles.sparkTip}>
            <Tooltip text={t('tip.sparkline')} size={14} testID="tip-sparkline" />
          </View>
        </View>

        {/* Range toggle (7 / 30 days) */}
        <View style={styles.rangeRow}>
          <TouchableOpacity
            testID="range-7"
            onPress={() => setRange(7)}
            style={[styles.rangeBtn, range === 7 && styles.rangeBtnActive]}
          >
            <Text style={[styles.rangeText, range === 7 && styles.rangeTextActive]}>
              {t('journal.range.7')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="range-30"
            onPress={() => setRange(30)}
            style={[styles.rangeBtn, range === 30 && styles.rangeBtnActive]}
          >
            <Text style={[styles.rangeText, range === 30 && styles.rangeTextActive]}>
              {t('journal.range.30')}
            </Text>
          </TouchableOpacity>
          {stats ? (
            <View style={styles.streakInline}>
              <MaterialCommunityIcons
                name={stats.streak_current > 0 ? 'fire' : 'fire-off'}
                size={14}
                color={stats.streak_current > 0 ? COLORS.amber : COLORS.textMuted}
              />
              <Text style={styles.streakInlineText}>
                {stats.streak_current}{t('journal.streak_unit')}
              </Text>
              <Text style={styles.streakBest}>{`(best ${stats.streak_best})`}</Text>
            </View>
          ) : null}
        </View>

        {items === null ? (
          <View style={styles.emptyBox}>
            <ActivityIndicator color={COLORS.amber} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="text-box-search-outline" size={40} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>{t('tnz.empty')}</Text>
          </View>
        ) : (
          items.map((e) => {
            const accent = stateColor(e.state);
            const open = expandedId === e.id;
            return (
              <TouchableOpacity
                key={e.id}
                testID={`history-row-${e.id}`}
                activeOpacity={0.85}
                onPress={() => setExpandedId(open ? null : e.id)}
                onLongPress={() => onDeleteOne(e.id)}
                style={[styles.row, { borderColor: accent }]}
              >
                <View style={styles.rowTop}>
                  <View style={[styles.statePill, { borderColor: accent }]}>
                    <View style={[styles.stateDot, { backgroundColor: accent }]} />
                    <Text style={[styles.stateText, { color: accent }]} numberOfLines={1}>
                      {e.state}
                    </Text>
                  </View>
                  <Text style={[styles.scoreText, { color: accent }]}>
                    {e.score.toFixed(2)}
                  </Text>
                </View>
                <Text style={styles.input} numberOfLines={open ? undefined : 2}>
                  {e.input}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaText} numberOfLines={1}>
                    {e.factor.replaceAll('_', ' ').toLowerCase()}
                  </Text>
                  <Text style={styles.metaText}>
                    {new Date(e.created_at).toLocaleString()}
                  </Text>
                </View>
                {open ? (
                  <View style={styles.detail}>
                    <View style={styles.vecRow}>
                      {e.vector_4d.map((v, i) => (
                        <View key={i} style={styles.vecCell}>
                          <Text style={styles.vecIdx}>{['x','y','dx','dy'][i]}</Text>
                          <Text style={[styles.vecVal, { color: v >= 0 ? COLORS.amber : COLORS.lime }]}>
                            {v.toFixed(3)}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <View style={[styles.block, { borderLeftColor: accent }]}>
                      <Text style={[styles.blockLabel, { color: accent }]}>{t('tnz.insight')}</Text>
                      <Text style={styles.blockText}>{e.insight}</Text>
                    </View>
                    <View style={[styles.block, { borderLeftColor: COLORS.amber }]}>
                      <Text style={[styles.blockLabel, { color: COLORS.amber }]}>{t('tnz.action')}</Text>
                      <Text style={styles.blockText}>{e.action}</Text>
                    </View>
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        onPress={() => shareReportText(fromHistory(e), lang)}
                        style={[styles.shareBtn, { borderColor: COLORS.textSecondary }]}
                        testID={`share-text-${e.id}`}
                      >
                        <Ionicons name="document-text-outline" size={14} color={COLORS.textSecondary} />
                        <Text style={[styles.shareText, { color: COLORS.textSecondary }]}>
                          {t('journal.share.text')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => shareReportPdf(fromHistory(e), lang)}
                        style={[styles.shareBtn, { borderColor: COLORS.amber, backgroundColor: 'rgba(245,176,65,0.06)' }]}
                        testID={`share-pdf-${e.id}`}
                      >
                        <Ionicons name="document-outline" size={14} color={COLORS.amber} />
                        <Text style={[styles.shareText, { color: COLORS.amber }]}>
                          {t('journal.share.pdf')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => onDeleteOne(e.id)}
                        style={styles.deleteBtn}
                        testID={`history-delete-${e.id}`}
                      >
                        <Ionicons name="trash-outline" size={14} color={COLORS.crimson} />
                        <Text style={styles.deleteText}>{t('common.delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.void },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.panelBorder,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.panelBorder,
  },
  clearBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: TYPO.monoBold, fontSize: 12, color: COLORS.amber, letterSpacing: 3 },
  sub:   { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 1.5, marginTop: 2 },

  list: { padding: 14, gap: 10, paddingBottom: 40 },

  sparkRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sparkTip: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 2,
  },

  rangeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 4, marginTop: 4, flexWrap: 'wrap',
  },
  rangeBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.panelBorder,
    backgroundColor: 'rgba(0,0,0,0.35)',
    minHeight: 32,
  },
  rangeBtnActive: { borderColor: COLORS.amber, backgroundColor: 'rgba(245,176,65,0.08)' },
  rangeText: { fontFamily: TYPO.monoBold, fontSize: 10, color: COLORS.textSecondary, letterSpacing: 2 },
  rangeTextActive: { color: COLORS.amber },

  streakInline: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginLeft: 'auto',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.panelBorder,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  streakInlineText: { fontFamily: TYPO.monoBold, fontSize: 10, color: COLORS.textPrimary, letterSpacing: 1 },
  streakBest: { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 0.5 },

  actionRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    marginTop: 4,
  },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 6, borderWidth: 1,
  },
  shareText: { fontFamily: TYPO.mono, fontSize: 10, letterSpacing: 1 },

  emptyBox: {
    paddingVertical: 80, alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  emptyText: {
    fontFamily: TYPO.label, fontSize: 13, color: COLORS.textMuted,
    textAlign: 'center', lineHeight: 19,
  },

  row: {
    padding: 12, borderRadius: 12,
    borderWidth: 1, backgroundColor: 'rgba(6,8,10,0.85)',
    gap: 8,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1,
    maxWidth: '70%',
  },
  stateDot: { width: 6, height: 6, borderRadius: 3 },
  stateText: { fontFamily: TYPO.monoBold, fontSize: 10, letterSpacing: 1.5 },
  scoreText: { fontFamily: TYPO.monoBold, fontSize: 14 },

  input: { fontFamily: TYPO.label, fontSize: 13, color: COLORS.textPrimary, lineHeight: 18 },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  metaText: {
    fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 0.5, flexShrink: 1,
  },

  detail: {
    marginTop: 6, gap: 8,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.panelBorder,
  },
  vecRow: { flexDirection: 'row', gap: 6 },
  vecCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  vecIdx: { fontFamily: TYPO.mono, fontSize: 8, color: COLORS.textMuted },
  vecVal: { fontFamily: TYPO.monoBold, fontSize: 10, marginTop: 2 },

  block: {
    padding: 8, borderRadius: 8,
    borderLeftWidth: 3,
    backgroundColor: 'rgba(255,255,255,0.02)',
    gap: 4,
  },
  blockLabel: { fontFamily: TYPO.monoBold, fontSize: 9, letterSpacing: 1.5 },
  blockText: { fontFamily: TYPO.label, fontSize: 12, color: COLORS.textPrimary, lineHeight: 17 },

  deleteBtn: {
    alignSelf: 'flex-end',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,60,95,0.4)',
    marginLeft: 'auto',
  },
  deleteText: { fontFamily: TYPO.monoBold, fontSize: 9, color: COLORS.crimson, letterSpacing: 1.5 },
});
