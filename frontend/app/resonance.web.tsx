/**
 * resonance.web.tsx — Resonanz-Signatur (WEB-Variante)
 * =====================================================
 * Web-spezifische Version des Resonanz-Signatur-Screens.
 * Expo Router wählt automatisch diese Datei auf Web.
 *
 * Unterschied zu resonance.tsx (native):
 *   - Kein GLView / expo-gl
 *   - HTML5 Canvas 2D (useRef<HTMLCanvasElement>)
 *   - Kein expo-haptics
 *   - Vollständige Web-Kompatibilität
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPO, RADII } from '../src/design';
import { API, type ResonanceSignatureDTO, type SignaturePoint } from '../src/api';

const { width: SCREEN_W } = Dimensions.get('window');
const CANVAS_SIZE = Math.min(SCREEN_W - SPACING.lg * 2, 380);

const LABEL_META: Record<string, { color: string; de: string }> = {
  synchronized: { color: '#B8FF3C', de: 'synchronisiert' },
  coherent:     { color: '#F5B041', de: 'kohärent'       },
  transitional: { color: '#8A8F95', de: 'transitional'   },
  chaotic:      { color: '#FF3C5F', de: 'chaotisch'       },
};

// ─── Canvas2D Renderer ────────────────────────────────────────────────────────

function drawPath(
  canvas: HTMLCanvasElement,
  path: SignaturePoint[],
  label: string,
  symmetry: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !path.length) return;

  const W = canvas.width;
  const H = canvas.height;
  const meta = LABEL_META[label] ?? LABEL_META.coherent;

  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#050608';
  ctx.fillRect(0, 0, W, H);

  // Normalize path to canvas coordinates
  const xs = path.map(p => p.x);
  const ys = path.map(p => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xRange = Math.max(xMax - xMin, 1e-6);
  const yRange = Math.max(yMax - yMin, 1e-6);
  const margin = W * 0.1;
  const drawW = W - margin * 2;
  const drawH = H - margin * 2;

  const toX = (x: number) => margin + ((x - xMin) / xRange) * drawW;
  const toY = (y: number) => margin + ((y - yMin) / yRange) * drawH;

  // Glow effect (two passes)
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    ctx.moveTo(toX(path[0].x), toY(path[0].y));
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(toX(path[i].x), toY(path[i].y));
    }
    ctx.closePath();

    if (pass === 0) {
      // Glow
      ctx.strokeStyle = meta.color + '30';
      ctx.lineWidth = 6;
      ctx.shadowColor = meta.color;
      ctx.shadowBlur = 12;
      ctx.stroke();
    } else {
      // Sharp line
      ctx.strokeStyle = meta.color + 'E0';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 0;
      ctx.stroke();
    }
  }

  // Symmetry indicator (arc in top-right)
  const arcR = 18;
  const arcX = W - arcR - 10;
  const arcY = arcR + 10;
  ctx.beginPath();
  ctx.arc(arcX, arcY, arcR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * symmetry);
  ctx.strokeStyle = meta.color + 'A0';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ResonanceWebScreen() {
  const insets = useSafeAreaInsets();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [sig, setSig]         = useState<ResonanceSignatureDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [echo, setEcho]       = useState<string | null>(null);
  const [journal, setJournal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Draw whenever sig or canvas changes
  useEffect(() => {
    if (!sig || !canvasRef.current) return;
    drawPath(canvasRef.current, sig.path, sig.label, sig.symmetry);
  }, [sig]);

  const loadSignature = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await API.resonanceSignature('anonymous', 256);
      setSig(data);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(
        status === 404
          ? 'Noch kein Eintrag — schreibe dein erstes Logbuch.'
          : 'Verbindungsfehler.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSignature(); }, [loadSignature]);

  const handleSubmit = useCallback(async () => {
    const text = journal.trim();
    if (text.length < 5) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await API.journalSubmit(text, 'anonymous');
      setEcho(res.echo);
      setJournal('');
      const newSig = await API.resonanceSignature('anonymous', 256);
      setSig(newSig);
    } catch {
      setError('Fehler beim Einreichen.');
    } finally {
      setSubmitting(false);
    }
  }, [journal]);

  const meta = sig ? (LABEL_META[sig.label] ?? LABEL_META.coherent) : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.void }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + SPACING.md, paddingBottom: insets.bottom + SPACING.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text style={styles.header}>Resonanz-Signatur</Text>
        <Text style={styles.sub}>Fourier-Projektion · {new Date().toLocaleDateString('de-DE')}</Text>

        {/* Canvas */}
        <View style={[styles.canvasWrap, { width: CANVAS_SIZE, height: CANVAS_SIZE }]}>
          {/* @ts-ignore — canvas is valid HTML on web */}
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE * 2}   // retina
            height={CANVAS_SIZE * 2}
            style={{
              width: CANVAS_SIZE,
              height: CANVAS_SIZE,
              borderRadius: RADII.lg,
            }}
          />
          {loading && (
            <View style={styles.overlay}>
              <ActivityIndicator color={COLORS.amber} size="large" />
            </View>
          )}
          {!loading && !sig && !error && (
            <View style={styles.overlay}>
              <Text style={styles.emptyText}>—</Text>
            </View>
          )}
        </View>

        {/* State label + symmetry */}
        {sig && meta && (
          <View style={styles.stateRow}>
            <Text style={[styles.stateLabel, { color: meta.color }]}>
              {sig.label}
            </Text>
            <View style={styles.symRow}>
              {Array.from({ length: 10 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.symCell,
                    { backgroundColor: i < Math.round(sig.symmetry * 10) ? meta.color : COLORS.textMuted + '30' },
                  ]}
                />
              ))}
              <Text style={styles.symNum}>{sig.symmetry.toFixed(2)}</Text>
            </View>
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Echo */}
        {echo && (
          <View style={styles.echoBox}>
            <Text style={styles.echoText}>{echo}</Text>
            <Pressable onPress={() => setEcho(null)}>
              <Text style={styles.echoClose}>✕</Text>
            </Pressable>
          </View>
        )}

        {/* Journal input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Logbuch</Text>
          <TextInput
            style={styles.textInput}
            value={journal}
            onChangeText={setJournal}
            placeholder="Was bewegt dich heute? Schreibe frei…"
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <Pressable
            style={[
              styles.submitBtn,
              (submitting || journal.trim().length < 5) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting || journal.trim().length < 5}
          >
            {submitting
              ? <ActivityIndicator color={COLORS.void} size="small" />
              : <Text style={styles.submitText}>Feld aktualisieren</Text>
            }
          </Pressable>
        </View>

        <Pressable style={styles.reloadBtn} onPress={loadSignature}>
          <Text style={styles.reloadText}>↺  Signatur neu laden</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { alignItems: 'center', paddingHorizontal: SPACING.lg, gap: SPACING.md },
  header: {
    fontFamily: TYPO.monoBold, fontSize: 18, color: COLORS.textPrimary,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: SPACING.xs,
  },
  sub: {
    fontFamily: TYPO.mono, fontSize: 11, color: COLORS.textMuted,
    letterSpacing: 0.8, marginBottom: SPACING.sm,
  },
  canvasWrap: {
    borderRadius: RADII.lg, overflow: 'hidden',
    backgroundColor: COLORS.deepVoid,
    borderWidth: 1, borderColor: COLORS.panelBorder,
    position: 'relative',
  },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { fontFamily: TYPO.mono, fontSize: 32, color: COLORS.textMuted },
  stateRow: { alignItems: 'center', gap: SPACING.xs, width: '100%' },
  stateLabel: {
    fontFamily: TYPO.monoBold, fontSize: 13,
    letterSpacing: 2, textTransform: 'uppercase',
  },
  symRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  symCell: { width: 18, height: 6, borderRadius: 2 },
  symNum: { fontFamily: TYPO.mono, fontSize: 11, color: COLORS.textSecondary, marginLeft: SPACING.xs },
  errorText: {
    fontFamily: TYPO.mono, fontSize: 12, color: COLORS.crimson, textAlign: 'center',
  },
  echoBox: {
    backgroundColor: COLORS.panel, borderRadius: RADII.md,
    borderWidth: 1, borderColor: COLORS.panelBorder,
    padding: SPACING.md, width: '100%',
    flexDirection: 'row', gap: SPACING.sm,
  },
  echoText: {
    fontFamily: TYPO.mono, fontSize: 12, color: COLORS.textSecondary,
    flex: 1, lineHeight: 18,
  },
  echoClose: { color: COLORS.textMuted, fontSize: 14 },
  inputSection: { width: '100%', gap: SPACING.sm },
  inputLabel: {
    fontFamily: TYPO.label, fontSize: 12, color: COLORS.textMuted,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: COLORS.panel, borderRadius: RADII.md,
    borderWidth: 1, borderColor: COLORS.panelBorder,
    padding: SPACING.md, fontFamily: TYPO.mono, fontSize: 13,
    color: COLORS.textPrimary, minHeight: 110,
  },
  submitBtn: {
    backgroundColor: COLORS.amber, borderRadius: RADII.md,
    paddingVertical: SPACING.sm + 2, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.35 },
  submitText: {
    fontFamily: TYPO.monoBold, fontSize: 13, color: COLORS.void, letterSpacing: 1,
  },
  reloadBtn: { paddingVertical: SPACING.sm },
  reloadText: { fontFamily: TYPO.mono, fontSize: 12, color: COLORS.textMuted, letterSpacing: 0.8 },
});
