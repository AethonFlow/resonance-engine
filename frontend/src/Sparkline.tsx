/**
 * Sparkline · stoic line chart for the last N coherence scores.
 * Pure React Native implementation — no native SVG dependency.
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

import { COLORS, TYPO } from './design';
import { useT } from './i18n';
import type { TenzorDayDTO } from './api';

type Props = {
  series: TenzorDayDTO[];
  height?: number;
};

const PADDING_X = 12;
const PADDING_Y = 16;

export function Sparkline({ series, height = 110 }: Props) {
  const t = useT();
  const W = Math.min(Dimensions.get('window').width - 28, 720);
  const H = height;

  const nonEmpty = series.filter((d) => d.max_score !== null);
  const valid = nonEmpty.length >= 1;

  if (!valid) {
    return (
      <View style={[styles.box, { height: H + 32 }]}>
        <Text style={styles.title}>{t('journal.spark.title')}</Text>
        <View style={[styles.emptyArea, { height: H }]}>
          <Text style={styles.empty}>{t('journal.spark.empty')}</Text>
        </View>
      </View>
    );
  }

  const scores = nonEmpty.map((d) => d.max_score as number);
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  const hi = Math.max(...scores);
  const lo = Math.min(...scores);

  const accent =
    avg >= 0.85 ? COLORS.amber
    : avg >= 0.60 ? COLORS.amberSoft
    : avg >= 0.30 ? COLORS.lime
    : COLORS.crimson;

  const N = series.length;
  const xs = (i: number) =>
    PADDING_X + (i * (W - 2 * PADDING_X)) / Math.max(1, N - 1);
  const ys = (v: number) =>
    H - PADDING_Y - v * (H - 2 * PADDING_Y);

  // Render dots as absolutely positioned circles
  const dots = series.map((d, i) => {
    if (d.max_score === null) {
      return (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: xs(i) - 2,
            top: H - PADDING_Y - 2,
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: COLORS.textMuted,
            opacity: 0.35,
          }}
        />
      );
    }
    const isHi = d.max_score === hi;
    const r = isHi ? 3.5 : 2.5;
    return (
      <View
        key={i}
        style={{
          position: 'absolute',
          left: xs(i) - r,
          top: ys(d.max_score) - r,
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          backgroundColor: accent,
        }}
      />
    );
  });

  // Render line segments between consecutive non-null points
  const segments: React.ReactElement[] = [];
  let prevIndex: number | null = null;
  series.forEach((d, i) => {
    if (d.max_score === null) {
      prevIndex = null;
      return;
    }
    if (prevIndex !== null && series[prevIndex].max_score !== null) {
      const x1 = xs(prevIndex);
      const y1 = ys(series[prevIndex].max_score as number);
      const x2 = xs(i);
      const y2 = ys(d.max_score);
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      segments.push(
        <View
          key={`seg-${i}`}
          style={{
            position: 'absolute',
            left: x1,
            top: y1 - 0.75,
            width: length,
            height: 1.5,
            backgroundColor: accent,
            transformOrigin: '0 50%',
            transform: [{ rotate: `${angle}deg` }],
          }}
        />
      );
    }
    prevIndex = i;
  });

  // Alignment guide at 0.60
  const yAlign = ys(0.60);

  const labels = series.map((d) => {
    const dd = new Date(d.date + 'T00:00:00Z');
    return `${dd.getUTCDate()}.`;
  });

  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('journal.spark.title')}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaItem}>{t('journal.spark.avg')} {avg.toFixed(2)}</Text>
          <Text style={[styles.metaItem, { color: COLORS.amber }]}>{t('journal.spark.high')} {hi.toFixed(2)}</Text>
          <Text style={[styles.metaItem, { color: COLORS.lime }]}>{t('journal.spark.low')} {lo.toFixed(2)}</Text>
        </View>
      </View>

      {/* Chart area */}
      <View style={{ width: W, height: H, position: 'relative', overflow: 'hidden' }}>
        {/* Alignment line at 0.60 */}
        <View
          style={{
            position: 'absolute',
            left: PADDING_X,
            top: yAlign,
            width: W - 2 * PADDING_X,
            height: 1,
            backgroundColor: COLORS.amberSoft,
            opacity: 0.18,
          }}
        />
        <Text
          style={{
            position: 'absolute',
            right: PADDING_X,
            top: yAlign - 12,
            fontSize: 9,
            color: COLORS.amberSoft,
            opacity: 0.55,
            fontFamily: TYPO.mono,
          }}
        >
          0.60
        </Text>

        {segments}
        {dots}
      </View>

      <View style={styles.xLabels}>
        {labels.map((lbl, i) => (
          <Text
            key={i}
            style={[
              styles.xLabel,
              i === labels.length - 1 && { color: accent, fontFamily: TYPO.monoBold },
            ]}
          >
            {lbl}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    backgroundColor: 'rgba(6,8,10,0.85)',
    gap: 8,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: TYPO.monoBold, fontSize: 10, color: COLORS.textMuted, letterSpacing: 2 },
  metaRow: { flexDirection: 'row', gap: 10 },
  metaItem: { fontFamily: TYPO.mono, fontSize: 10, color: COLORS.textSecondary, letterSpacing: 1 },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: PADDING_X,
    marginTop: -4,
  },
  xLabel: { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 0.5 },
  emptyArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  empty: { fontFamily: TYPO.label, fontSize: 12, color: COLORS.textMuted, textAlign: 'center' },
});
