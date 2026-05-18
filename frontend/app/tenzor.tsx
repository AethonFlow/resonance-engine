import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { COLORS, TYPO } from '../src/design';
import { API, type TenzorInvokeResponseDTO } from '../src/api';
import { useSettings, useT } from '../src/i18n';
import { Tooltip } from '../src/Tooltip';
import { SettingsSheet } from '../src/SettingsSheet';

type FieldState =
  | 'COLD'
  | 'DRIFT'
  | 'WARM'
  | 'SINGING'
  | 'NULLSTELLE'
  | 'INSUFFICIENT_DATA';

const stateColor = (s: FieldState): string => {
  switch (s) {
    case 'NULLSTELLE': return COLORS.amber;
    case 'SINGING':    return COLORS.amberSoft;
    case 'WARM':       return COLORS.amber;
    case 'DRIFT':      return COLORS.lime;
    case 'COLD':       return COLORS.lime;
    default:           return COLORS.crimson;
  }
};

export default function TenzorScreen() {
  const router = useRouter();
  const { lang } = useSettings();
  const t = useT();
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<TenzorInvokeResponseDTO | null>(null);
  const [errMsg, setErrMsg] = useState<string>('');
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const inputRef = useRef<TextInput>(null);

  const onInvoke = useCallback(async () => {
    const text = input.trim();
    if (text.length < 1) return;
    setLoading(true);
    setErrMsg('');
    setResult(null);
    try {
      const r = await API.tenzorInvoke(text, { lang, save: true });
      setResult(r);
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    } catch (e: any) {
      setErrMsg(e?.message ?? 'Network error — INSUFFICIENT_DATA');
    } finally {
      setLoading(false);
    }
  }, [input, lang]);

  const onCopy = useCallback(async () => {
    if (!result) return;
    try {
      await Share.share({ message: result.report });
    } catch {
      Alert.alert('Share unavailable');
    }
  }, [result]);

  const onClear = useCallback(() => {
    setResult(null);
    setInput('');
    setErrMsg('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const accent = useMemo(
    () => (result ? stateColor(result.state as FieldState) : COLORS.lime),
    [result],
  );

  return (
    <SafeAreaView style={styles.root} testID="tenzor-root">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            testID="tenzor-back"
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.title}>{t('tnz.title')}</Text>
            <Text style={styles.sub}>{t('tnz.sub')}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push('/history')}
              style={styles.iconBtn}
              testID="open-history"
              hitSlop={6}
            >
              <Ionicons name="time-outline" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSettingsOpen(true)}
              style={styles.iconBtn}
              testID="open-settings"
              hitSlop={6}
            >
              <Text style={styles.langBadge}>{lang.toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          {/* INPUT BLOCK */}
          <View style={styles.inputCard}>
            <Text style={styles.label}>{t('tnz.input')}</Text>
            <TextInput
              ref={inputRef}
              testID="tenzor-input"
              value={input}
              onChangeText={setInput}
              placeholder={t('tnz.placeholder')}
              placeholderTextColor={COLORS.textMuted}
              multiline
              editable={!loading}
              style={styles.input}
            />
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.btn, { borderColor: COLORS.textMuted }]}
                onPress={onClear}
                disabled={loading}
                testID="tenzor-clear"
              >
                <Text style={[styles.btnText, { color: COLORS.textSecondary }]}>
                  {t('tnz.clear')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.btn,
                  { borderColor: COLORS.amber, backgroundColor: 'rgba(245,176,65,0.06)' },
                ]}
                onPress={onInvoke}
                disabled={loading || input.trim().length === 0}
                testID="tenzor-invoke"
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.amber} />
                ) : (
                  <Text style={[styles.btnText, { color: COLORS.amber }]}>
                    {t('tnz.invoke')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            {errMsg ? (
              <Text style={styles.err} testID="tenzor-error">{errMsg}</Text>
            ) : null}
          </View>

          {/* RESULT BLOCK */}
          {result && (
            <View style={[styles.resultCard, { borderColor: accent }]}>
              <View style={styles.resultHead}>
                <View style={[styles.statePill, { borderColor: accent }]}>
                  <View style={[styles.stateDot, { backgroundColor: accent }]} />
                  <Text style={[styles.stateText, { color: accent }]}>
                    {result.state}
                  </Text>
                </View>
                <Text style={styles.elapsed}>{result.elapsed_ms} ms</Text>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statCell}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>{t('tnz.score')}</Text>
                    <Tooltip text={t('tip.score')} testID="tip-score" />
                  </View>
                  <Text style={[styles.statVal, { color: accent }]} numberOfLines={1}>
                    {result.score.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.statCell}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>{t('tnz.energy')}</Text>
                    <Tooltip text={t('tip.energy_target')} testID="tip-energy" />
                  </View>
                  <Text style={[styles.statVal, { color: COLORS.amber }]} numberOfLines={1}>
                    {`${result.energy.toFixed(2)} / 0.5`}
                  </Text>
                </View>
              </View>

              <View style={styles.factorBox}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>{t('tnz.factor')}</Text>
                  <Tooltip text={t('tip.factor')} testID="tip-factor" />
                </View>
                <Text style={styles.factorText} numberOfLines={1}>{result.factor}</Text>
              </View>

              <View style={styles.factorBox}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>{t('tnz.agent')}</Text>
                  <Tooltip text={t('tip.agent')} testID="tip-agent" />
                </View>
                <Text style={[styles.agentText, { color: accent }]} numberOfLines={2}>
                  {result.agent_feedback}
                </Text>
              </View>

              <View style={styles.vectorBox}>
                <View style={[styles.labelRow, { marginBottom: 6 }]}>
                  <Text style={styles.label}>{t('tnz.vector')}</Text>
                  <Tooltip text={t('tip.vector4d')} testID="tip-vector" />
                </View>
                <View style={styles.vectorRow}>
                  {result.vector_4d.map((v, i) => (
                    <View key={i} style={styles.vCell}>
                      <Text style={styles.vIdx}>{['x', 'y', 'dx', 'dy'][i]}</Text>
                      <Text
                        style={[styles.vVal, { color: v >= 0 ? COLORS.amber : COLORS.lime }]}
                      >
                        {v.toFixed(4)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={[styles.blockBox, { borderLeftColor: accent }]}>
                <Text style={[styles.label, { color: accent }]}>{t('tnz.insight')}</Text>
                <Text style={styles.blockText} testID="tenzor-insight">
                  {result.insight}
                </Text>
              </View>

              <View style={[styles.blockBox, { borderLeftColor: COLORS.amber }]}>
                <Text style={[styles.label, { color: COLORS.amber }]}>{t('tnz.action')}</Text>
                <Text style={styles.blockText} testID="tenzor-action">
                  {result.action}
                </Text>
              </View>

              <View style={styles.reportBox} testID="tenzor-report-box">
                <View style={styles.reportHeader}>
                  <MaterialCommunityIcons name="text-box-outline" size={14} color={COLORS.textMuted} />
                  <Text style={styles.label}>{t('tnz.raw')}</Text>
                  <TouchableOpacity
                    onPress={onCopy}
                    style={styles.shareBtn}
                    testID="tenzor-share"
                  >
                    <Ionicons name="share-outline" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.shareText}>{t('tnz.share')}</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 6 }}
                >
                  <Text style={styles.report} testID="tenzor-report">
                    {result.report}
                  </Text>
                </ScrollView>
              </View>
            </View>
          )}

          {/* CONTRACT FOOTNOTE */}
          <View style={styles.contractBox}>
            <Text style={styles.contractLine}>{t('tnz.contract.1')}</Text>
            <Text style={styles.contractLine}>{t('tnz.contract.2')}</Text>
            <Text style={styles.contractLine}>{t('tnz.contract.3')}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </SafeAreaView>
  );
}

function _UnusedStat({
  label, value, color, compact,
}: { label: string; value: string; color: string; compact?: boolean }) {
  return (
    <View style={[styles.statCell, compact && { flex: 1.5 }]}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[styles.statVal, { color }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.void },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.panelBorder,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.panelBorder,
  },
  title: { fontFamily: TYPO.monoBold, fontSize: 12, color: COLORS.amber, letterSpacing: 3 },
  sub:   { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 1.5, marginTop: 2 },

  headerActions: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  iconBtn: {
    minWidth: 36, height: 36, paddingHorizontal: 8, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.panelBorder,
  },
  langBadge: {
    fontFamily: TYPO.monoBold, fontSize: 11, color: COLORS.textSecondary, letterSpacing: 1.5,
  },

  labelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },

  body: { padding: 14, gap: 14, paddingBottom: 40 },

  inputCard: {
    padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.panelBorder,
    backgroundColor: 'rgba(6,8,10,0.85)',
    gap: 10,
  },
  label: { fontFamily: TYPO.monoBold, fontSize: 10, color: COLORS.textMuted, letterSpacing: 2 },
  input: {
    minHeight: 90, padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.panelBorder, backgroundColor: '#000',
    color: COLORS.textPrimary, fontFamily: TYPO.label, fontSize: 14,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: {
    flex: 1, borderWidth: 1, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
    minHeight: 44,
  },
  btnText: { fontFamily: TYPO.labelBold, fontSize: 11, letterSpacing: 2 },
  err: {
    marginTop: 4,
    fontFamily: TYPO.label, fontSize: 12, color: COLORS.crimson,
    padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,60,95,0.4)',
    backgroundColor: 'rgba(255,60,95,0.06)',
  },

  resultCard: {
    padding: 14, borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(6,8,10,0.85)',
    gap: 12,
  },
  resultHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  statePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  stateDot: { width: 6, height: 6, borderRadius: 3 },
  stateText: { fontFamily: TYPO.monoBold, fontSize: 11, letterSpacing: 2 },
  elapsed: { fontFamily: TYPO.mono, fontSize: 10, color: COLORS.textMuted, letterSpacing: 1 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCell: {
    flex: 1, padding: 10, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.panelBorder,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  statVal: { fontFamily: TYPO.monoBold, fontSize: 14, marginTop: 4 },

  vectorBox: {
    padding: 10, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.panelBorder,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  vectorRow: { flexDirection: 'row', gap: 6 },
  vCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  vIdx:  { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted },
  vVal:  { fontFamily: TYPO.monoBold, fontSize: 11, marginTop: 2 },

  factorBox: {
    padding: 10, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.panelBorder,
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: 4,
  },
  factorText: { fontFamily: TYPO.monoBold, fontSize: 12, color: COLORS.textPrimary, letterSpacing: 1.2 },
  agentText:  { fontFamily: TYPO.monoBold, fontSize: 12, letterSpacing: 0.5 },

  blockBox: {
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    backgroundColor: 'rgba(255,255,255,0.02)',
    gap: 6,
  },
  blockText: {
    fontFamily: TYPO.label, fontSize: 13, color: COLORS.textPrimary,
    lineHeight: 19, letterSpacing: 0.2,
  },

  reportBox: {
    padding: 10, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.panelBorder,
    backgroundColor: '#000',
  },
  reportHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  shareBtn: {
    marginLeft: 'auto',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    borderWidth: 1, borderColor: COLORS.panelBorder,
  },
  shareText: { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textSecondary, letterSpacing: 1 },
  report: {
    fontFamily: TYPO.mono, fontSize: 11, color: COLORS.textPrimary,
    lineHeight: 16, letterSpacing: 0.3,
  },

  contractBox: {
    padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.panelBorder,
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: 2,
  },
  contractLine: {
    fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 0.5,
  },
});
