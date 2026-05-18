import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  PanResponder,
  Platform,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as Haptics from 'expo-haptics';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as THREE from 'three';

import { COLORS, HOUSES, NULLSTELLE_ENERGY, TYPO } from '../src/design';
import {
  createInitialState,
  step,
  setMagnitude,
  snapToNullstelle,
  resetToInitial,
  applyAspectMatrix,
  isImpressionFresh,
  NULLSTELLE_N_THRESHOLD,
  N_HOUSES,
  N_LAYERS,
  N_NODES,
  type SphereState,
  type ResonanceState,
} from '../src/physics';
import { createScene, updateScene, SceneRefs } from '../src/scene';
import { API, type MirrorDTO, type TenzorStatsDTO } from '../src/api';
import { layer0Check } from '../src/aspects';
import { enableAudio, disableAudio, updateTone, isAudioEnabled } from '../src/audio';
import { useSettings, useT } from '../src/i18n';
import { Tooltip } from '../src/Tooltip';
import { SettingsSheet } from '../src/SettingsSheet';
import { DailyAlignment } from '../src/DailyAlignment';
import { StreakBadge } from '../src/StreakBadge';
import { InsightFeed } from '../src/InsightFeed';
import { CheckInCard } from '../src/CheckInCard';

const { height: SCREEN_H } = Dimensions.get('window');

export default function SphereScreen() {
  const router = useRouter();
  const { lang } = useSettings();
  const { isPremium, freeRemaining } = useSettings();
  const t = useT();

  const stateRef = useRef<SphereState>(createInitialState());
  const sceneRef = useRef<SceneRefs | null>(null);
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef({ x: 0, y: 0, active: false });
  const lastFrameRef = useRef<number>(Date.now());
  const lastNullstelleRef = useRef<number>(0);
  const lastSingingRef = useRef<number>(0);
  const lastToneUpdateRef = useRef<number>(0);
  const lastCaputAutoRef = useRef<number>(0);

  // HUD mirror — refresh at 10 Hz
  const [hud, setHud] = useState({
    energy: 0,
    incoherence: 0,
    state: 'cold' as ResonanceState,
    sing_index: 0,
    R_layer: [0, 0, 0] as [number, number, number],
    T_inter: 0,
    noise_score: 0,
    t: 0,
    impressions: stateRef.current.impressions.map((i) => (i ? { ...i } : null)),
  });

  const [selectedHouse, setSelectedHouse] = useState<number>(0);
  const [magnitude, setMagnitudeState] = useState<number>(stateRef.current.A[0]);
  const [audioOn, setAudioOn] = useState<boolean>(false);
  const [flashPulse, setFlashPulse] = useState<number>(0);
  const [saveModal, setSaveModal] = useState<boolean>(false);
  const [presetName, setPresetName] = useState<string>('');
  const [probeOpen, setProbeOpen] = useState<boolean>(false);
  const [probeText, setProbeText] = useState<string>('');
  const [probeLoading, setProbeLoading] = useState<boolean>(false);
  const [mirror, setMirror] = useState<MirrorDTO | null>(null);
  const [layer0Hint, setLayer0Hint] = useState<string>('');
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [alignmentTick, setAlignmentTick] = useState<number>(0);
  const [streak, setStreak] = useState<{ current: number; best: number } | null>(null);

  // Fetch streak whenever alignmentTick changes (and on mount)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await API.tenzorStats(30);
        if (active) setStreak({ current: s.streak_current, best: s.streak_best });
      } catch {
        if (active) setStreak(null);
      }
    })();
    return () => { active = false; };
  }, [alignmentTick]);

  // HUD ticker
  useEffect(() => {
    const id = setInterval(() => {
      const s = stateRef.current;
      setHud({
        energy: s.energy,
        incoherence: s.incoherence,
        state: s.state,
        sing_index: s.sing_index,
        R_layer: [s.R_layer[0], s.R_layer[1], s.R_layer[2]],
        T_inter: s.T_inter,
        noise_score: s.noise_score,
        t: s.t,
        impressions: s.impressions.map((i) => (i ? { ...i } : null)),
      });
    }, 100);
    return () => clearInterval(id);
  }, []);

  // Drag rotation
  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        dragRef.current.active = true;
        dragRef.current.x = e.nativeEvent.pageX;
        dragRef.current.y = e.nativeEvent.pageY;
      },
      onPanResponderMove: (e) => {
        if (!sceneRef.current) return;
        const nx = e.nativeEvent.pageX, ny = e.nativeEvent.pageY;
        const dx = nx - dragRef.current.x, dy = ny - dragRef.current.y;
        sceneRef.current.dragRotY += dx * 0.005;
        sceneRef.current.dragRotX += dy * 0.005;
        if (sceneRef.current.dragRotX > 1.3) sceneRef.current.dragRotX = 1.3;
        if (sceneRef.current.dragRotX < -1.3) sceneRef.current.dragRotX = -1.3;
        dragRef.current.x = nx; dragRef.current.y = ny;
      },
      onPanResponderRelease: () => { dragRef.current.active = false; },
      onPanResponderTerminate: () => { dragRef.current.active = false; },
    }), []);

  // GL animation
  const onContextCreate = useCallback(async (gl: ExpoWebGLRenderingContext) => {
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const renderer = new Renderer({ gl, alpha: false, antialias: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 1);

    const refs = createScene(w, h);
    refs.renderer = renderer;
    refs.camera.aspect = w / h;
    refs.camera.updateProjectionMatrix();
    sceneRef.current = refs;

    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      const now = Date.now();
      let dt = (now - lastFrameRef.current) / 1000;
      if (dt > 0.08) dt = 0.08;
      lastFrameRef.current = now;

      step(stateRef.current, dt);
      updateScene(refs, stateRef.current, dt);

      // singing-event auto-snapshot (throttled 12 s)
      if (
        (stateRef.current.state === 'singing' || stateRef.current.state === 'nullstelle')
        && now - lastSingingRef.current > 12_000
      ) {
        lastSingingRef.current = now;
        if (stateRef.current.state === 'nullstelle' && now - lastNullstelleRef.current > 12_000) {
          lastNullstelleRef.current = now;
          triggerNullstelleEvent('nullstelle');
        } else {
          triggerNullstelleEvent('singing');
        }
      }

      // Caput Mortuum auto-trigger (throttled 30 s)
      if (
        stateRef.current.noise_score > NULLSTELLE_N_THRESHOLD
        && now - lastCaputAutoRef.current > 30_000
      ) {
        lastCaputAutoRef.current = now;
        archiveCaputMortuum('auto');
      }

      // audio
      if (isAudioEnabled() && now - lastToneUpdateRef.current > 200) {
        lastToneUpdateRef.current = now;
        const stateForAudio = stateRef.current.state === 'singing' ? 'warm' : (stateRef.current.state === 'cold' || stateRef.current.state === 'warm' || stateRef.current.state === 'hot' || stateRef.current.state === 'nullstelle') ? stateRef.current.state : 'warm';
        updateTone(stateRef.current.energy, stateForAudio as 'warm' | 'cold' | 'hot' | 'nullstelle').catch(() => {});
      }

      refs.renderer!.render(refs.scene, refs.camera);
      gl.endFrameEXP();
    };
    render();
  }, []);

  const triggerNullstelleEvent = async (event: 'nullstelle' | 'singing') => {
    if (event === 'nullstelle') {
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      setFlashPulse(1);
      const start = Date.now();
      const fade = () => {
        const t = (Date.now() - start) / 1200;
        if (t >= 1) { setFlashPulse(0); return; }
        setFlashPulse(Math.max(0, 1 - t));
        requestAnimationFrame(fade);
      };
      fade();
    } else {
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    }
    const s = stateRef.current;
    try {
      await API.createSnapshot24({
        event,
        sing_index: s.sing_index,
        energy: s.energy,
        R_layer: [s.R_layer[0], s.R_layer[1], s.R_layer[2]],
        T_inter: s.T_inter,
        C_E: s.C_E,
        q: Array.from(s.q),
        p: Array.from(s.p),
        A: Array.from(s.A),
        llm_scores: s.impressions.map((i) => (i ? i.score : 0.5)),
        llm_markers: s.impressions.map((i) => (i ? i.marker : '')),
        resonance_state: s.state,
      });
    } catch { /* offline-tolerant */ }
  };

  const archiveCaputMortuum = async (reason: 'auto' | 'manual') => {
    const s = stateRef.current;
    try {
      await API.coherenceReset({
        noise_score: s.noise_score,
        energy: s.energy,
        incoherence: s.incoherence,
        q: Array.from(s.q),
        p: Array.from(s.p),
        A: Array.from(s.A),
        reason,
      });
    } catch { /* offline-tolerant */ }
    resetToInitial(stateRef.current);
    setMagnitudeState(stateRef.current.A[selectedHouse * N_LAYERS]);
    if (reason === 'manual') {
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
    }
  };

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    disableAudio().catch(() => {});
  }, []);

  useEffect(() => {
    setMagnitudeState(stateRef.current.A[selectedHouse * N_LAYERS]);
  }, [selectedHouse]);

  const onChangeMagnitude = (v: number) => {
    setMagnitudeState(v);
    setMagnitude(stateRef.current, selectedHouse, v);
  };

  const onSnapToNullstelle = async () => {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
    snapToNullstelle(stateRef.current);
    setMagnitudeState(stateRef.current.A[selectedHouse * N_LAYERS]);
  };

  const onCaputMortuum = async () => {
    Alert.alert(
      'Caput Mortuum',
      'Archive the residue and purify the field?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Purify', style: 'destructive', onPress: () => archiveCaputMortuum('manual') },
      ],
    );
  };

  const onToggleAudio = async () => {
    if (audioOn) { await disableAudio(); setAudioOn(false); }
    else { await enableAudio(); setAudioOn(true); }
  };

  const onSendProbe = async () => {
    const text = probeText.trim();
    // ── Layer 0 client-side check (mirror of backend gate)
    const gate = layer0Check(text);
    if (!gate.ok) {
      setLayer0Hint(gate.reason);
      return;
    }
    setLayer0Hint('');
    setProbeLoading(true);
    setMirror(null);
    try {
      const res = await API.tune(text);
      if (!res.ok || !res.layer0_ok) {
        setLayer0Hint(res.clarification || 'Need a clearer signal.');
        return;
      }
      // Apply the Aspect Matrix (the ONLY bridge probe → physics)
      if (res.aspects && res.aspects.length > 0) {
        // Coerce DTO → safe Aspect (all 5 effect fields defaulted to 0)
        const safeAspects = res.aspects.map((a) => ({
          name: a.name,
          scope: a.scope,
          target_houses: a.target_houses,
          effects: {
            amplitude:   a.effects.amplitude   ?? 0,
            damping:     a.effects.damping     ?? 0,
            coupling:    a.effects.coupling    ?? 0,
            noise:       a.effects.noise       ?? 0,
            phase_shift: a.effects.phase_shift ?? 0,
          },
          marker: a.marker,
        }));
        applyAspectMatrix(stateRef.current, safeAspects);
      }
      // Show the deterministic mirror in the same modal
      if (res.mirror) setMirror(res.mirror);
      // Refresh daily-alignment indicator
      setAlignmentTick((n) => n + 1);
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    } catch (e: any) {
      Alert.alert('Probe failed', e?.message ?? 'Network error');
    } finally {
      setProbeLoading(false);
    }
  };

  const onCloseProbeModal = () => {
    setProbeOpen(false);
    setProbeText('');
    setMirror(null);
    setLayer0Hint('');
  };

  const onSavePreset = async () => {
    const name = presetName.trim() || `Preset ${new Date().toLocaleTimeString()}`;
    const s = stateRef.current;
    try {
      await API.createPreset({
        name,
        magnitudes: Array.from({ length: N_HOUSES }, (_, h) => s.A[h * N_LAYERS]),
        phases: Array.from({ length: N_HOUSES }, (_, h) => s.q[h * N_LAYERS]),
        omega: s.omega,
      });
      setSaveModal(false);
      setPresetName('');
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
      Alert.alert('Preset saved', `"${name}" archived in field library.`);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Unknown error');
    }
  };

  // Adaptive accent colour
  const stateColor =
    hud.state === 'nullstelle' ? COLORS.amber
    : hud.state === 'singing' ? COLORS.amberSoft
    : hud.state === 'warm' ? COLORS.amber
    : hud.state === 'hot' ? COLORS.crimson : COLORS.lime;

  const noiseRatio = Math.min(1, hud.noise_score / NULLSTELLE_N_THRESHOLD);

  return (
    <View style={styles.root} testID="sphere-root">
      <View style={styles.canvasWrap} {...panResponder.panHandlers}>
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} testID="sphere-gl" />
      </View>

      {flashPulse > 0 && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.amber, opacity: flashPulse * 0.45 }]}
        />
      )}

      <SafeAreaView style={styles.safe} pointerEvents="box-none">
        {/* TOP HUD */}
        <View style={styles.topHud} pointerEvents="box-none">
          <View style={styles.hudBlockLeft}>
            <View style={styles.hudLabelRow}>
              <Text style={styles.hudLabel}>{t('hud.energy')}</Text>
              <Tooltip text={t('tip.energy')} size={12} testID="tip-energy" />
            </View>
            <Text testID="hud-energy" style={[styles.hudValueBig, { color: stateColor }]}>
              {hud.energy.toFixed(2)}
            </Text>
            <Text style={styles.hudSub}>{t('hud.target')}{NULLSTELLE_ENERGY.toFixed(0)}</Text>
          </View>

          <TouchableOpacity
            style={[styles.stateChip, { borderColor: stateColor }]}
            testID="hud-state"
            onPress={() => setSettingsOpen(true)}
            hitSlop={8}
          >
            <View style={[styles.stateDot, { backgroundColor: stateColor }]} />
            <Text style={[styles.stateText, { color: stateColor }]}>
              {hud.state.toUpperCase()}
            </Text>
            <Text style={styles.langBadge}>{lang.toUpperCase()}</Text>
          </TouchableOpacity>

          <View style={styles.hudBlockRight}>
            <View style={[styles.hudLabelRow, { justifyContent: 'flex-end' }]}>
              <Text style={styles.hudLabel}>{t('hud.incoherence')}</Text>
              <Tooltip text={t('tip.incoherence')} size={12} testID="tip-incoherence" />
            </View>
            <Text testID="hud-incoherence" style={[styles.hudValueBig, { color: stateColor }]}>
              {hud.incoherence.toFixed(3)}
            </Text>
            <Text style={styles.hudSub}>{t('hud.minus_r0')}</Text>
          </View>
        </View>

        {/* DAILY ALIGNMENT pill + STREAK */}
        <View style={styles.alignmentRow} pointerEvents="box-none">
          <DailyAlignment refreshKey={alignmentTick} />
          {streak ? (
            <StreakBadge current={streak.current} best={streak.best} />
          ) : null}
        </View>

        {/* v6.1 · CHECK-IN CARD — primary CTA / today's status */}
        <CheckInCard
          refreshKey={alignmentTick}
          onPrimaryAction={() => {
            if (!isPremium && freeRemaining <= 0) {
              router.push('/paywall');
            } else {
              setProbeOpen(true);
            }
          }}
        />

        {/* INSIGHT FEED — last 7 insights as scroll cards (3 if free) */}
        <View style={styles.feedRow} pointerEvents="box-none">
          <InsightFeed refreshKey={alignmentTick} limit={isPremium ? 7 : 3} />
        </View>

        {/* Free-quota inline hint (only for non-premium) */}
        {!isPremium ? (
          <View style={styles.quotaRow} pointerEvents="box-none">
            <Text style={styles.quotaText} testID="quota-inline">
              {freeRemaining > 0
                ? t('home.quota.left').replace('{{n}}', String(freeRemaining))
                : t('home.quota.none')}
            </Text>
            {freeRemaining <= 0 ? (
              <TouchableOpacity
                onPress={() => router.push('/paywall')}
                style={styles.quotaBtn}
                testID="quota-upgrade"
              >
                <Ionicons name="diamond-outline" size={12} color={COLORS.amber} />
                <Text style={styles.quotaBtnText}>{t('set.premium.upgrade')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* SING INDEX vertical bar (right edge) */}
        <View pointerEvents="box-none" style={styles.singBox}>
          <View style={styles.singLabelRow}>
            <Text style={styles.singLabel}>{t('hud.sing')}</Text>
            <Tooltip text={t('tip.sing')} size={11} testID="tip-sing" />
          </View>
          <View style={styles.singTrack}>
            <View
              testID="hud-sing-index-fill"
              style={[
                styles.singFill,
                {
                  height: `${Math.max(2, hud.sing_index * 100)}%`,
                  backgroundColor: stateColor,
                  shadowColor: stateColor,
                },
              ]}
            />
            {/* threshold ticks */}
            <View style={[styles.singTick, { bottom: '65%' }]} />
            <View style={[styles.singTick, { bottom: '85%' }]} />
            <View style={[styles.singTick, { bottom: '95%' }]} />
          </View>
          <Text testID="hud-sing-index" style={[styles.singValue, { color: stateColor }]}>
            {hud.sing_index.toFixed(2)}
          </Text>
          {/* per-layer R values */}
          <Text style={styles.singR}>R₀ {hud.R_layer[0].toFixed(2)}</Text>
          <Text style={styles.singR}>R₁ {hud.R_layer[1].toFixed(2)}</Text>
          <Text style={styles.singR}>R₂ {hud.R_layer[2].toFixed(2)}</Text>
          <Text style={styles.singR}>T  {hud.T_inter.toFixed(2)}</Text>
        </View>

        {/* SIDE TOOLS */}
        <View style={styles.sideTools} pointerEvents="box-none">
          {/* Caput Mortuum gauge wraps NULL button */}
          <View style={styles.nullWrap}>
            {/* gauge ring (red, fills with N) */}
            <View pointerEvents="none" style={[
              styles.caputRing,
              { borderColor: 'transparent' },
            ]} />
            <View pointerEvents="none" style={[
              styles.caputRingFill,
              {
                borderTopColor: noiseRatio > 0.05 ? '#FF3C5F' : 'transparent',
                borderRightColor: noiseRatio > 0.30 ? '#FF3C5F' : 'transparent',
                borderBottomColor: noiseRatio > 0.55 ? '#FF3C5F' : 'transparent',
                borderLeftColor: noiseRatio > 0.80 ? '#FF3C5F' : 'transparent',
                opacity: 0.4 + noiseRatio * 0.6,
              },
            ]} />
            <TouchableOpacity
              testID="btn-nullstelle"
              style={[styles.sideBtn, { borderColor: COLORS.amber }]}
              onPress={onSnapToNullstelle}
              onLongPress={onCaputMortuum}
            >
              <MaterialCommunityIcons name="target" size={20} color={COLORS.amber} />
              <Text style={[styles.sideBtnText, { color: COLORS.amber }]}>NULL</Text>
            </TouchableOpacity>
            <View style={styles.tipFloat}>
              <Tooltip text={t('tip.null')} size={12} testID="tip-null" />
            </View>
          </View>

          <View style={styles.tipWrap}>
            <TouchableOpacity
              testID="btn-probe"
              style={[styles.sideBtn, styles.probeBtn, { borderColor: COLORS.lime }]}
              onPress={() => setProbeOpen(true)}
            >
              <Ionicons name="prism-outline" size={18} color={COLORS.lime} />
              <Text style={[styles.sideBtnText, { color: COLORS.lime }]}>TUNE</Text>
            </TouchableOpacity>
            <View style={styles.tipFloat}>
              <Tooltip text={t('tip.tune')} size={12} testID="tip-tune" />
            </View>
          </View>

          <TouchableOpacity
            testID="btn-caput"
            style={[styles.sideBtn, { borderColor: '#FF3C5F' }]}
            onPress={onCaputMortuum}
          >
            <MaterialCommunityIcons name="recycle-variant" size={18} color="#FF3C5F" />
          </TouchableOpacity>

          <View style={styles.tipWrap}>
            <TouchableOpacity
              testID="btn-audio"
              style={[styles.sideBtn, { borderColor: audioOn ? COLORS.amber : COLORS.textMuted }]}
              onPress={onToggleAudio}
            >
              <Ionicons name={audioOn ? 'volume-high' : 'volume-mute'} size={18} color={audioOn ? COLORS.amber : COLORS.textMuted} />
            </TouchableOpacity>
            <View style={styles.tipFloat}>
              <Tooltip text={t('tip.audio')} size={12} testID="tip-audio" />
            </View>
          </View>

          <TouchableOpacity
            testID="btn-save"
            style={[styles.sideBtn, { borderColor: COLORS.textSecondary }]}
            onPress={() => setSaveModal(true)}
          >
            <Ionicons name="bookmark-outline" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            testID="btn-presets"
            style={[styles.sideBtn, { borderColor: COLORS.textSecondary }]}
            onPress={() => router.push('/presets')}
          >
            <Ionicons name="library-outline" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            testID="btn-snapshots"
            style={[styles.sideBtn, { borderColor: COLORS.textSecondary }]}
            onPress={() => router.push('/snapshots')}
          >
            <Ionicons name="pulse" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <View style={styles.tipWrap}>
            <TouchableOpacity
              testID="btn-tenzor"
              style={[styles.sideBtn, { borderColor: COLORS.amberSoft }]}
              onPress={() => router.push('/tenzor')}
            >
              <MaterialCommunityIcons name="lightning-bolt-outline" size={18} color={COLORS.amberSoft} />
              <Text style={[styles.sideBtnText, { color: COLORS.amberSoft }]}>TNZ</Text>
            </TouchableOpacity>
            <View style={styles.tipFloat}>
              <Tooltip text={t('tip.tnz')} size={12} testID="tip-tnz" />
            </View>
          </View>

          <TouchableOpacity
            testID="btn-history"
            style={[styles.sideBtn, { borderColor: COLORS.textSecondary }]}
            onPress={() => router.push('/history')}
          >
            <Ionicons name="time-outline" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* BOTTOM */}
        <View style={styles.bottom} pointerEvents="box-none">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.houseStrip}
            style={{ maxHeight: 110 }}
          >
            {HOUSES.map((h, i) => {
              const active = i === selectedHouse;
              const val = stateRef.current.A[i * N_LAYERS];
              const imp = hud.impressions[i];
              const fresh = isImpressionFresh(imp ?? null, hud.t);
              const probeColor = imp
                ? (imp.score > 0.5 ? COLORS.amber : COLORS.lime)
                : COLORS.textMuted;
              return (
                <TouchableOpacity
                  key={h.index}
                  testID={`house-${h.index}`}
                  onPress={() => {
                    setSelectedHouse(i);
                    Haptics.selectionAsync().catch(() => {});
                  }}
                  style={[
                    styles.houseChip,
                    active && { borderColor: stateColor, backgroundColor: 'rgba(245,176,65,0.06)' },
                  ]}
                >
                  <View style={styles.houseChipTop}>
                    <Text style={[styles.houseRoman, active && { color: stateColor }]}>{h.code}</Text>
                    {/* probe light */}
                    <View
                      testID={`probe-light-${h.index}`}
                      style={[
                        styles.probeLight,
                        { backgroundColor: fresh ? probeColor : 'rgba(255,255,255,0.08)' },
                      ]}
                    />
                  </View>
                  <Text style={styles.houseName}>{h.title}</Text>
                  <Text style={styles.houseMag}>{val.toFixed(2)}</Text>
                  {fresh && imp ? (
                    <Text testID={`probe-marker-${h.index}`} style={styles.markerText} numberOfLines={1}>
                      {imp.marker || `score ${imp.score.toFixed(2)}`}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <MagnitudeSlider
            value={magnitude}
            onChange={onChangeMagnitude}
            accent={stateColor}
            houseName={HOUSES[selectedHouse].title}
            houseRoman={HOUSES[selectedHouse].code}
          />
        </View>
      </SafeAreaView>

      {/* Save preset */}
      <Modal transparent animationType="fade" visible={saveModal} onRequestClose={() => setSaveModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>SAVE RESONANCE STATE</Text>
            <Text style={styles.modalSub}>
              E={hud.energy.toFixed(2)} · S={hud.sing_index.toFixed(2)} · {hud.state}
            </Text>
            <TextInput
              testID="preset-name-input"
              value={presetName}
              onChangeText={setPresetName}
              placeholder="Name this field…"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.modalBtn, { borderColor: COLORS.textMuted }]} onPress={() => setSaveModal(false)}>
                <Text style={[styles.modalBtnText, { color: COLORS.textSecondary }]}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="preset-save-confirm" style={[styles.modalBtn, { borderColor: COLORS.amber, backgroundColor: 'rgba(245,176,65,0.08)' }]} onPress={onSavePreset}>
                <Text style={[styles.modalBtnText, { color: COLORS.amber }]}>SAVE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Probe (Tune) */}
      <Modal transparent animationType="slide" visible={probeOpen} onRequestClose={onCloseProbeModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.probeModalBg}
        >
          <View style={styles.probeCard}>
            <View style={styles.probeHeader}>
              <Text style={styles.modalTitle}>{mirror ? t('tune.title_mirror') : t('tune.title')}</Text>
              <TouchableOpacity onPress={onCloseProbeModal} testID="probe-close">
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {!mirror ? (
              <>
                <Text style={styles.modalSub}>
                  {t('tune.body')}
                </Text>
                <TextInput
                  testID="probe-input"
                  value={probeText}
                  onChangeText={(t) => { setProbeText(t); if (layer0Hint) setLayer0Hint(''); }}
                  placeholder={t('tune.placeholder')}
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.probeInput}
                  multiline
                  autoFocus
                  editable={!probeLoading}
                />
                {layer0Hint ? (
                  <Text testID="layer0-hint" style={styles.layer0Hint}>{layer0Hint}</Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { borderColor: COLORS.textMuted }]}
                    onPress={onCloseProbeModal}
                    disabled={probeLoading}
                  >
                    <Text style={[styles.modalBtnText, { color: COLORS.textSecondary }]}>{t('tune.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="probe-send"
                    style={[styles.modalBtn, { borderColor: COLORS.lime, backgroundColor: 'rgba(184,255,60,0.06)' }]}
                    onPress={onSendProbe}
                    disabled={probeLoading}
                  >
                    {probeLoading ? (
                      <ActivityIndicator color={COLORS.lime} />
                    ) : (
                      <Text style={[styles.modalBtnText, { color: COLORS.lime }]}>{t('tune.send')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.probeHint}>
                  {t('tune.hint')}
                </Text>
              </>
            ) : (
              <>
                <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 14, paddingTop: 4 }}>
                  <MirrorBlock label="CORE"      text={mirror.core}      tone={mirror.tone} />
                  <MirrorBlock label="VALUE"     text={mirror.value}     tone={mirror.tone} />
                  <MirrorBlock label="FRICTION"  text={mirror.friction}  tone={mirror.tone} accent={COLORS.crimson} />
                  <MirrorBlock label="NEXT STEP" text={mirror.next_step} tone={mirror.tone} accent={mirror.tone === 'clear' ? COLORS.amber : COLORS.lime} />
                  <View style={styles.traceBox} testID="mirror-trace">
                    <Text style={styles.traceLine}>core_idx={mirror.trace.core_idx}</Text>
                    <Text style={styles.traceLine}>value_idx={mirror.trace.value_idx}</Text>
                    <Text style={styles.traceLine}>friction_idx={mirror.trace.friction_idx}</Text>
                    <Text style={styles.traceLine}>origin_sign={mirror.trace.origin_sign}</Text>
                    <Text style={styles.traceLine}>sing_index={mirror.trace.sing_index.toFixed(3)}</Text>
                  </View>
                  <Text style={styles.mirrorMeta}>
                    tone: {mirror.tone}  ·  incoherence {mirror.incoherence.toFixed(3)}  ·  origin {mirror.origin_sign > 0 ? '+' : '−'}
                  </Text>
                </ScrollView>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <TouchableOpacity
                    testID="probe-again"
                    style={[styles.modalBtn, { borderColor: COLORS.textMuted }]}
                    onPress={() => { setMirror(null); setProbeText(''); }}
                  >
                    <Text style={[styles.modalBtnText, { color: COLORS.textSecondary }]}>{t('tune.again')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="probe-done"
                    style={[styles.modalBtn, { borderColor: COLORS.amber, backgroundColor: 'rgba(245,176,65,0.06)' }]}
                    onPress={onCloseProbeModal}
                  >
                    <Text style={[styles.modalBtnText, { color: COLORS.amber }]}>{t('tune.close')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Magnitude Slider
// ─────────────────────────────────────────────────────────────
type SliderProps = {
  value: number;
  onChange: (v: number) => void;
  accent: string;
  houseName: string;
  houseRoman: string;
};
function MagnitudeSlider({ value, onChange, accent, houseName, houseRoman }: SliderProps) {
  const t = useT();
  const MIN = 0; const MAX = 3.5;
  const widthRef = useRef<number>(1);
  const tNorm = (value - MIN) / (MAX - MIN);

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const x = e.nativeEvent.locationX;
      onChange(MIN + Math.max(0, Math.min(1, x / widthRef.current)) * (MAX - MIN));
    },
    onPanResponderMove: (e) => {
      const x = e.nativeEvent.locationX;
      onChange(MIN + Math.max(0, Math.min(1, x / widthRef.current)) * (MAX - MIN));
    },
  }), [onChange]);

  return (
    <View style={styles.sliderBox} testID="mag-slider-box">
      <View style={styles.sliderHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.sliderLabel, { color: accent }]}>
            {houseRoman} · {houseName.toUpperCase()}
          </Text>
          <Tooltip text={t('tip.slider')} size={12} testID="tip-slider" />
        </View>
        <Text style={[styles.sliderValue, { color: accent }]}>{value.toFixed(2)}</Text>
      </View>
      <View
        testID="mag-slider"
        {...responder.panHandlers}
        onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; }}
        style={styles.track}
      >
        <View style={[styles.trackBg]} />
        <View style={[styles.trackFill, { width: `${tNorm * 100}%`, backgroundColor: accent }]} />
        <View style={[styles.thumb, { left: `${tNorm * 100}%`, borderColor: accent }]} />
      </View>
      <View style={styles.sliderTicks}>
        <Text style={styles.tickLabel}>0</Text>
        <Text style={styles.tickLabel}>1.77 (null)</Text>
        <Text style={styles.tickLabel}>3.5</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Project Mirror — deterministic, per-section
// ─────────────────────────────────────────────────────────────
function MirrorBlock({
  label, text, tone, accent,
}: {
  label: string;
  text: string;
  tone: 'clear' | 'guided' | 'questioning' | 'incomplete';
  accent?: string;
}) {
  const labelColor = accent ?? (
    tone === 'clear'      ? COLORS.amber :
    tone === 'guided'     ? COLORS.amberSoft :
    tone === 'incomplete' ? COLORS.crimson :
                            COLORS.lime
  );
  return (
    <View testID={`mirror-${label.toLowerCase().replace(' ', '-')}`} style={styles.mirrorBlock}>
      <Text style={[styles.mirrorLabel, { color: labelColor }]}>{label}</Text>
      <Text style={styles.mirrorText}>{text}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.void },
  canvasWrap: { ...StyleSheet.absoluteFillObject },

  safe: { flex: 1, justifyContent: 'space-between' },

  // TOP HUD
  topHud: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 8 : 16,
  },
  alignmentRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingTop: 6, paddingBottom: 2, gap: 6,
  },
  feedRow: {
    paddingTop: 2, paddingBottom: 6,
  },
  quotaRow: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center',
    paddingHorizontal: 16, paddingVertical: 4, gap: 8,
  },
  quotaText: {
    fontFamily: TYPO.mono, fontSize: 10, color: COLORS.textMuted, letterSpacing: 0.5,
  },
  quotaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    borderWidth: 1, borderColor: COLORS.amber, backgroundColor: 'rgba(245,176,65,0.08)',
  },
  quotaBtnText: {
    fontFamily: TYPO.monoBold, fontSize: 9, color: COLORS.amber, letterSpacing: 1,
  },
  hudBlockLeft:  { alignItems: 'flex-start', minWidth: 90 },
  hudBlockRight: { alignItems: 'flex-end',  minWidth: 90 },
  hudLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
  },
  hudLabel: { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 2 },
  hudValueBig: { fontFamily: TYPO.monoBold, fontSize: 24, marginTop: 2 },
  hudSub: { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted, marginTop: 2, letterSpacing: 1 },

  stateChip: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  stateDot: { width: 6, height: 6, borderRadius: 3 },
  stateText: { fontFamily: TYPO.monoBold, fontSize: 10, letterSpacing: 2 },
  langBadge: {
    fontFamily: TYPO.monoBold, fontSize: 9, letterSpacing: 1.5,
    color: COLORS.textMuted,
    marginLeft: 4, paddingLeft: 6,
    borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.15)',
  },

  // SING INDEX bar (left edge)
  singBox: {
    position: 'absolute', left: 14, top: SCREEN_H * 0.18, alignItems: 'center', gap: 6,
  },
  singLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  singLabel: { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 2 },
  singTrack: {
    width: 6, height: 180,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'visible',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  singFill: {
    width: 6, borderRadius: 3,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 6,
  },
  singTick: {
    position: 'absolute', right: -3, width: 12, height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  singValue: { fontFamily: TYPO.monoBold, fontSize: 11, marginTop: 4 },
  singR: { fontFamily: TYPO.mono, fontSize: 8, color: COLORS.textMuted, letterSpacing: 1 },

  // SIDE TOOLS (right edge)
  sideTools: {
    position: 'absolute', right: 12, top: SCREEN_H * 0.18, gap: 8,
  },
  nullWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tipWrap:  { position: 'relative' },
  tipFloat: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22,
    backgroundColor: COLORS.deepVoid,
    borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  caputRing: { position: 'absolute', width: 56, height: 56, borderRadius: 28, borderWidth: 1.5 },
  caputRingFill: {
    position: 'absolute', width: 56, height: 56, borderRadius: 28, borderWidth: 2,
    transform: [{ rotate: '-45deg' }],
  },
  sideBtn: {
    width: 48, height: 48, borderRadius: 999,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', gap: 2,
  },
  probeBtn: { gap: 0 },
  sideBtnText: { fontFamily: TYPO.monoBold, fontSize: 8, letterSpacing: 1 },

  // BOTTOM
  bottom: { paddingBottom: 12 },
  houseStrip: { paddingHorizontal: 14, paddingVertical: 6, gap: 8 },
  houseChip: {
    minWidth: 96,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.panelBorder,
    backgroundColor: 'rgba(8,10,12,0.85)',
    alignItems: 'flex-start',
  },
  houseChipTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch' },
  houseRoman: { fontFamily: TYPO.monoBold, fontSize: 14, color: COLORS.textPrimary, letterSpacing: 1 },
  probeLight: { width: 7, height: 7, borderRadius: 4 },
  houseName: { fontFamily: TYPO.label, fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
  houseMag: { fontFamily: TYPO.mono, fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  markerText: { fontFamily: TYPO.mono, fontSize: 8, color: COLORS.amberSoft, marginTop: 4, maxWidth: 110 },

  // SLIDER
  sliderBox: {
    marginHorizontal: 16, padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(6,8,10,0.85)',
    borderWidth: 1, borderColor: COLORS.panelBorder,
  },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sliderLabel: { fontFamily: TYPO.labelBold, fontSize: 11, letterSpacing: 2 },
  sliderValue: { fontFamily: TYPO.monoBold, fontSize: 13 },
  track: { height: 36, justifyContent: 'center' },
  trackBg: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: COLORS.panelBorder, borderRadius: 1 },
  trackFill: { position: 'absolute', left: 0, height: 2, borderRadius: 1 },
  thumb: { position: 'absolute', width: 22, height: 22, borderRadius: 11, marginLeft: -11, borderWidth: 2, backgroundColor: '#000' },
  sliderTicks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  tickLabel: { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted },

  // Save modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: {
    width: '100%', maxWidth: 380, padding: 20, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.panelBorder, backgroundColor: COLORS.deepVoid,
  },
  modalTitle: { fontFamily: TYPO.monoBold, fontSize: 12, color: COLORS.amber, letterSpacing: 2 },
  modalSub: { fontFamily: TYPO.mono, fontSize: 10, color: COLORS.textMuted, marginTop: 6, letterSpacing: 1 },
  input: {
    marginTop: 16, borderWidth: 1, borderColor: COLORS.panelBorder, padding: 12, borderRadius: 8,
    color: COLORS.textPrimary, fontFamily: TYPO.label, fontSize: 14, backgroundColor: '#000',
  },
  modalBtn: {
    flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  modalBtnText: { fontFamily: TYPO.labelBold, fontSize: 11, letterSpacing: 2 },

  // Probe modal
  probeModalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  probeCard: {
    padding: 20, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderColor: COLORS.panelBorder, backgroundColor: COLORS.deepVoid,
    minHeight: 280,
  },
  probeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  probeInput: {
    marginTop: 14, minHeight: 96, padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.panelBorder, backgroundColor: '#000',
    color: COLORS.textPrimary, fontFamily: TYPO.label, fontSize: 14,
    textAlignVertical: 'top',
  },
  probeHint: {
    fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted,
    letterSpacing: 1, marginTop: 12, textAlign: 'center',
  },

  // Layer-0 hint
  layer0Hint: {
    marginTop: 10, padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,60,95,0.4)',
    backgroundColor: 'rgba(255,60,95,0.06)',
    fontFamily: TYPO.label, fontSize: 12, color: COLORS.crimson,
    letterSpacing: 0.3,
  },

  // Mirror
  mirrorBlock: {
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 10,
    borderLeftWidth: 2, borderLeftColor: COLORS.amber,
    backgroundColor: 'rgba(255,255,255,0.02)',
    gap: 4,
  },
  mirrorLabel: { fontFamily: TYPO.monoBold, fontSize: 10, letterSpacing: 2 },
  mirrorText: { fontFamily: TYPO.label, fontSize: 13, color: COLORS.textPrimary, lineHeight: 18 },
  mirrorMeta: {
    fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted,
    letterSpacing: 1, textAlign: 'center', marginTop: 4,
  },
  traceBox: {
    marginTop: 4,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1, borderColor: COLORS.panelBorder,
  },
  traceLine: {
    fontFamily: TYPO.mono, fontSize: 10, color: COLORS.textSecondary,
    letterSpacing: 0.5, lineHeight: 14,
  },
});
