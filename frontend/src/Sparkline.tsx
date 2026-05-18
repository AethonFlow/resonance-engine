/**
 * Sparkline · stoic line chart for the last N coherence scores.
 * Stoic, noble, dark. Uses react-native-svg.
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';

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
  const valid    = nonEmpty.length >= 1;

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

  const N = series.length;
  const xs = (i: number) => PADDING_X + (i * (W - 2 * PADDING_X)) / Math.max(1, N - 1);
  const ys = (v: number) => H - PADDING_Y - v * (H - 2 * PADDING_Y);   // v in [0,1]

  // Path string — interpolate over missing days as gaps.
  const segs: string[] = [];
  let started = false;
  series.forEach((d, i) => {
    if (d.max_score === null) {
      started = false;
      return;
    }
    const cmd = started ? 'L' : 'M';
    segs.push(`${cmd} ${xs(i).toFixed(2)} ${ys(d.max_score).toFixed(2)}`);
    started = true;
  });
  const pathD = segs.join(' ');

  const scores = nonEmpty.map((d) => d.max_score as number);
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  const hi  = Math.max(...scores);
  const lo  = Math.min(...scores);

  const accent = avg >= 0.85 ? COLORS.amber
              : avg >= 0.60 ? COLORS.amberSoft
              : avg >= 0.30 ? COLORS.lime
              :              COLORS.crimson;

  // Y guide-line at 0.60 (alignment threshold)
  const yAlign = ys(0.60);

  // Date labels (compact, every other on small widths)
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
          <Text style={[styles.metaItem, { color: COLORS.lime  }]}>{t('journal.spark.low')} {lo.toFixed(2)}</Text>
        </View>
      </View>

      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* alignment threshold (0.60) */}
        <Line
          x1={PADDING_X} y1={yAlign} x2={W - PADDING_X} y2={yAlign}
          stroke={COLORS.amberSoft} strokeOpacity={0.18} strokeDasharray="3,4" strokeWidth={1}
        />
        <SvgText
          x={W - PADDING_X} y={yAlign - 4}
          fontSize="9" textAnchor="end" fill={COLORS.amberSoft} opacity={0.55}
          fontFamily="JetBrainsMono_400Regular"
        >
          0.60
        </SvgText>

        {/* line */}
        <Path d={pathD} stroke={accent} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />

        {/* points */}
        {series.map((d, i) => {
          if (d.max_score === null) {
            return (
              <Circle
                key={i}
                cx={xs(i)} cy={H - PADDING_Y}
                r={1.6} fill={COLORS.textMuted} opacity={0.35}
              />
            );
          }
          const isHi = d.max_score === hi;
          return (
            <Circle
              key={i}
              cx={xs(i)} cy={ys(d.max_score)}
              r={isHi ? 3.5 : 2.5}
              fill={accent}
              stroke={COLORS.deepVoid}
              strokeWidth={isHi ? 1 : 0}
            />
          );
        })}
      </Svg>

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
    padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.panelBorder,
    backgroundColor: 'rgba(6,8,10,0.85)',
    gap: 8,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:  { fontFamily: TYPO.monoBold, fontSize: 10, color: COLORS.textMuted, letterSpacing: 2 },
  metaRow: { flexDirection: 'row', gap: 10 },
  metaItem: { fontFamily: TYPO.mono, fontSize: 10, color: COLORS.textSecondary, letterSpacing: 1 },

  xLabels: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: PADDING_X, marginTop: -4,
  },
  xLabel: { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 0.5 },

  emptyArea: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 8,
  },
  empty: { fontFamily: TYPO.label, fontSize: 12, color: COLORS.textMuted, textAlign: 'center' },
});
