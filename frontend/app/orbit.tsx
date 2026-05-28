/**
 * orbit.tsx — TheOrbit Screen
 * ===========================
 * Phase circle navigation: input → TENZOR → Zyklus position.
 *
 * Visualisation built from pure React Native Views + transforms.
 * No SVG dependency. Design tokens from src/design.ts.
 *
 * Layout:
 *   ┌──────────────────────────────────┐
 *   │  Header: TheOrbit                │
 *   │  Phase Circle (compass wheel)    │
 *   │  Active Operator card            │
 *   │  SpinDialog card (if active)     │
 *   │  Input field + Analyze button    │
 *   │  Agent drift row                 │
 *   └──────────────────────────────────┘
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPO, RADII } from '../src/design';
import { API } from '../src/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type CycleState = {
  theta: number;
  theta_deg: number;
  house_index: number;
  house_code: string;
  house_title: string;
  operator: string;
  archetype: string;
  opposite_house: { index: number; code: string; title: string; operator: string };
  warm_kalt: string;
  warm_score: number;
  flow: number;
  force: number;
  character: string;
  sin2: number;
  cos2: number;
};

type SpinDialog = {
  active_operator: string;
  complement_operator: string;
  axis: string;
  message_count: number;
  last_warm_kalt: string;
};

type AgentStatus = {
  house: number;
  operator: string;
  drift: number;
  cycle_count: number;
  beliefs: Record<string, unknown>;
};

type OrbitResult = {
  state: string;
  score: number;
  insight: string;
  action: string;
  cycle_state: CycleState;
  spin_dialog: SpinDialog | null;
  agent_statuses: AgentStatus[];
  bus_cycle_id: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUSE_LABELS = [
  { idx: 1, code: 'NNO', label: 'ORIGIN',     short: '○' },
  { idx: 2, code: 'ONO', label: 'OFFERING',   short: '◇' },
  { idx: 3, code: 'OSO', label: 'EXPRESSION', short: '▷' },
  { idx: 4, code: 'SSO', label: 'GROUND',     short: '▽' },
  { idx: 5, code: 'SSW', label: 'EMBODIMENT', short: '●' },
  { idx: 6, code: 'WSW', label: 'VALUE',      short: '◆' },
  { idx: 7, code: 'WNW', label: 'FEEDBACK',   short: '◁' },
  { idx: 8, code: 'NNW', label: 'EVALUATION', short: '△' },
];

// θ at each house node — k·π/4 mapped to compass angle
// Compass: 0° = top (N), clockwise. Math: 0 = right, CCW.
// We rotate so H1 (θ=0) = right (East), increasing CCW.
const HOUSE_ANGLES_DEG = [0, 45, 90, 135, 180, 225, 270, 315]; // θ_k in math space

const WARM_KALT_COLOR: Record<string, string> = {
  HOT:        '#FF3C5F',
  WARM:       '#F5B041',
  NULLSTELLE: '#8A8F95',
  COLD:       '#4FC3F7',
  FREEZING:   '#1565C0',
  NEUTRAL:    '#4A4E54',
};

const STATE_COLOR: Record<string, string> = {
  NULLSTELLE:       '#8A8F95',
  SINGING:          '#F5B041',
  WARM:             '#FFD28A',
  DRIFT:            '#B8FF3C',
  COLD:             '#4FC3F7',
  INSUFFICIENT_DATA:'#4A4E54',
};

// ─── Phase Circle Component ───────────────────────────────────────────────────

const CIRCLE_SIZE  = 260;
const CIRCLE_R     = CIRCLE_SIZE / 2 - 28;
const DOT_SIZE     = 10;
const NEEDLE_LEN   = CIRCLE_R - 14;

function degToRad(d: number) { return (d * Math.PI) / 180; }

/** Convert math-angle θ (radians) to screen x,y on the compass circle.
 *  Math θ=0 → right, CCW. Screen: x right, y down.
 *  We flip y: screenY = center - r·sin(θ)  so CCW math = CW visual (compass).
 *  H1 at θ=0 = East, H3 at θ=π/2 = North, etc. */
function thetaToXY(thetaRad: number, r: number, cx: number, cy: number) {
  return {
    x: cx + r * Math.cos(thetaRad),
    y: cy - r * Math.sin(thetaRad),
  };
}

type PhaseCircleProps = {
  thetaDeg: number;         // current theta in degrees (0..360)
  activeHouse: number;      // 1-based
  warmKalt: string;
};

function PhaseCircle({ thetaDeg, activeHouse, warmKalt }: PhaseCircleProps) {
  const cx = CIRCLE_SIZE / 2;
  const cy = CIRCLE_SIZE / 2;
  const thetaRad = degToRad(thetaDeg);
  const needleEnd = thetaToXY(thetaRad, NEEDLE_LEN, cx, cy);
  const needleColor = WARM_KALT_COLOR[warmKalt] ?? COLORS.textMuted;

  return (
    <View style={[styles.circleContainer, { width: CIRCLE_SIZE, height: CIRCLE_SIZE }]}>
      {/* Outer ring */}
      <View style={[styles.ring, {
        width: CIRCLE_SIZE, height: CIRCLE_SIZE,
        borderRadius: CIRCLE_SIZE / 2,
        borderColor: COLORS.panelBorder,
      }]} />

      {/* Inner ring (minor) */}
      <View style={[styles.ring, {
        position: 'absolute',
        width: CIRCLE_SIZE * 0.55, height: CIRCLE_SIZE * 0.55,
        borderRadius: CIRCLE_SIZE * 0.275,
        top: CIRCLE_SIZE * 0.225, left: CIRCLE_SIZE * 0.225,
        borderColor: 'rgba(255,255,255,0.03)',
      }]} />

      {/* House dots + labels */}
      {HOUSE_LABELS.map(({ idx, label }) => {
        const angle = degToRad(HOUSE_ANGLES_DEG[idx - 1]);
        const pos = thetaToXY(angle, CIRCLE_R, cx, cy);
        const isActive = idx === activeHouse;
        return (
          <View
            key={idx}
            style={[
              styles.houseDot,
              {
                left: pos.x - (isActive ? 7 : DOT_SIZE / 2),
                top:  pos.y - (isActive ? 7 : DOT_SIZE / 2),
                width:  isActive ? 14 : DOT_SIZE,
                height: isActive ? 14 : DOT_SIZE,
                borderRadius: isActive ? 7 : DOT_SIZE / 2,
                backgroundColor: isActive ? COLORS.amber : COLORS.textMuted,
                opacity: isActive ? 1 : 0.4,
              },
            ]}
          />
        );
      })}

      {/* House codes around the circle */}
      {HOUSE_LABELS.map(({ idx, code }) => {
        const angle = degToRad(HOUSE_ANGLES_DEG[idx - 1]);
        const labelR = CIRCLE_R + 18;
        const pos = thetaToXY(angle, labelR, cx, cy);
        const isActive = idx === activeHouse;
        return (
          <Text
            key={`label-${idx}`}
            style={[
              styles.houseCode,
              {
                left: pos.x - 12,
                top:  pos.y - 7,
                color:   isActive ? COLORS.amber : COLORS.textMuted,
                opacity: isActive ? 1 : 0.5,
                fontFamily: TYPO.mono,
              },
            ]}
          >
            {code}
          </Text>
        );
      })}

      {/* Needle */}
      {thetaDeg > 0 || activeHouse > 0 ? (
        <View
          style={[
            styles.needle,
            {
              width: NEEDLE_LEN,
              left:  cx,
              top:   cy - 1,
              transformOrigin: 'left center',
              transform: [{ rotate: `${-thetaDeg}deg` }],
              backgroundColor: needleColor,
            },
          ]}
        />
      ) : null}

      {/* Centre dot */}
      <View style={[styles.centerDot, {
        left: cx - 4, top: cy - 4,
        backgroundColor: COLORS.textSecondary,
      }]} />
    </View>
  );
}

// ─── Warm/Kalt Badge ──────────────────────────────────────────────────────────

function WarmKaltBadge({ label }: { label: string }) {
  const color = WARM_KALT_COLOR[label] ?? COLORS.textMuted;
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color, fontFamily: TYPO.mono }]}>
        {label}
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OrbitScreen() {
  const insets = useSafeAreaInsets();
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<OrbitResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  // Animate needle on new result
  const needleAnim = useRef(new Animated.Value(0)).current;

  const analyze = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    try {
      // @ts-ignore — endpoint added in this session
      const res = await API.orbitInvoke(text, { lang: 'de' });
      setResult(res as OrbitResult);
      Animated.timing(needleAnim, {
        toValue: res.cycle_state?.theta_deg ?? 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    } catch (e: any) {
      setError(e?.message ?? 'Fehler bei der Analyse');
    } finally {
      setLoading(false);
    }
  }, [input, loading, needleAnim]);

  const cs = result?.cycle_state;
  const sd = result?.spin_dialog;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.void }}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { fontFamily: TYPO.labelBold }]}>
          TheOrbit
        </Text>
        <Text style={[styles.headerSub, { fontFamily: TYPO.mono }]}>
          Resonance Engine V6
        </Text>
      </View>

      {/* ── Phase Circle ── */}
      <View style={styles.circleWrapper}>
        <PhaseCircle
          thetaDeg={cs?.theta_deg ?? 0}
          activeHouse={cs?.house_index ?? 0}
          warmKalt={cs?.warm_kalt ?? 'NEUTRAL'}
        />
        {cs && (
          <View style={styles.circleCenter}>
            <Text style={[styles.singScore, { fontFamily: TYPO.monoBold, color: STATE_COLOR[result?.state ?? ''] ?? COLORS.amber }]}>
              {(result?.score ?? 0).toFixed(2)}
            </Text>
            <Text style={[styles.singLabel, { fontFamily: TYPO.mono }]}>SING</Text>
          </View>
        )}
      </View>

      {/* ── Active Operator card ── */}
      {cs && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardOperator, { fontFamily: TYPO.labelBold }]}>
              {cs.operator}
            </Text>
            <WarmKaltBadge label={cs.warm_kalt} />
          </View>
          <Text style={[styles.cardHouse, { fontFamily: TYPO.mono }]}>
            H{cs.house_index} · {cs.house_code} · {cs.house_title}
          </Text>
          <Text style={[styles.cardArchetype, { fontFamily: TYPO.label }]}>
            {cs.archetype}
          </Text>
          <View style={styles.metricsRow}>
            <MetricPill label="flow"  value={cs.flow.toFixed(3)}  color={cs.flow > 0 ? COLORS.amber : COLORS.lime} />
            <MetricPill label="force" value={cs.force.toFixed(3)} color={COLORS.textSecondary} />
            <MetricPill label="sin²"  value={cs.sin2.toFixed(2)}  color={COLORS.amberSoft} />
            <MetricPill label="θ"     value={`${cs.theta_deg.toFixed(1)}°`} color={COLORS.textSecondary} />
          </View>
          {result?.insight ? (
            <Text style={[styles.insight, { fontFamily: TYPO.label }]}>{result.insight}</Text>
          ) : null}
          {result?.action ? (
            <Text style={[styles.action, { fontFamily: TYPO.mono }]}>→ {result.action}</Text>
          ) : null}
        </View>
      )}

      {/* ── SpinDialog card ── */}
      {sd && (
        <View style={[styles.card, styles.spinCard]}>
          <Text style={[styles.spinTitle, { fontFamily: TYPO.monoBold }]}>
            ⟳ SpinDialog  {sd.axis}
          </Text>
          <Text style={[styles.spinOperators, { fontFamily: TYPO.label }]}>
            {sd.active_operator}  ↔  {sd.complement_operator}
          </Text>
          <Text style={[styles.spinMeta, { fontFamily: TYPO.mono }]}>
            {sd.message_count} Nachrichten · Thermal {sd.last_warm_kalt}
          </Text>
        </View>
      )}

      {/* ── Agent drift row ── */}
      {result?.agent_statuses?.length ? (
        <View style={styles.agentRow}>
          {result.agent_statuses.slice(0, 8).map((a) => (
            <View key={a.house} style={styles.agentChip}>
              <Text style={[styles.agentName, { fontFamily: TYPO.mono }]}>
                H{a.house}
              </Text>
              <View style={[styles.driftBar, { width: Math.round(a.drift * 28) + 2, backgroundColor: a.drift > 0.5 ? COLORS.crimson : COLORS.amber }]} />
            </View>
          ))}
        </View>
      ) : null}

      {/* ── Input ── */}
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { fontFamily: TYPO.label }]}
          placeholder="Intention eingeben…"
          placeholderTextColor={COLORS.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={analyze}
          returnKeyType="send"
          multiline={false}
          editable={!loading}
        />
        <Pressable
          style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
          onPress={analyze}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator size="small" color={COLORS.void} />
            : <Text style={[styles.sendText, { fontFamily: TYPO.monoBold }]}>→</Text>
          }
        </Pressable>
      </View>

      {error ? (
        <Text style={[styles.errorText, { fontFamily: TYPO.mono }]}>{error}</Text>
      ) : null}
    </ScrollView>
  );
}

// ─── Metric Pill ──────────────────────────────────────────────────────────────

function MetricPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.metricPill}>
      <Text style={[styles.metricLabel, { fontFamily: TYPO.mono, color: COLORS.textMuted }]}>{label}</Text>
      <Text style={[styles.metricValue, { fontFamily: TYPO.monoBold, color }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    gap: SPACING.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerSub: {
    color: COLORS.textMuted,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 2,
  },
  circleWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.sm,
  },
  circleContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
  },
  houseDot: {
    position: 'absolute',
  },
  houseCode: {
    position: 'absolute',
    fontSize: 8,
    letterSpacing: 0.5,
    textAlign: 'center',
    width: 24,
  },
  needle: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
  },
  centerDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  singScore: {
    fontSize: 22,
    letterSpacing: 1,
  },
  singLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 2,
    marginTop: -2,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.panel,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  spinCard: {
    borderColor: 'rgba(245,176,65,0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardOperator: {
    color: COLORS.amber,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  cardHouse: {
    color: COLORS.textMuted,
    fontSize: 10,
    letterSpacing: 1,
  },
  cardArchetype: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: SPACING.xs,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
    flexWrap: 'wrap',
  },
  metricPill: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADII.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 8,
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 11,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  insight: {
    color: COLORS.textPrimary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: SPACING.xs,
  },
  action: {
    color: COLORS.amberSoft,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  spinTitle: {
    color: COLORS.amber,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  spinOperators: {
    color: COLORS.textPrimary,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  spinMeta: {
    color: COLORS.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  badge: {
    borderWidth: 1,
    borderRadius: RADII.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
    letterSpacing: 1,
  },
  agentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    width: '100%',
  },
  agentChip: {
    alignItems: 'center',
    gap: 2,
  },
  agentName: {
    color: COLORS.textMuted,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  driftBar: {
    height: 3,
    borderRadius: 1.5,
    minWidth: 2,
  },
  inputRow: {
    flexDirection: 'row',
    width: '100%',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: RADII.md,
    backgroundColor: COLORS.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendText: {
    color: COLORS.void,
    fontSize: 18,
  },
  errorText: {
    color: COLORS.crimson,
    fontSize: 11,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
