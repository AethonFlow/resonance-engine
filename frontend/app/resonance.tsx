/**
 * resonance.tsx — Resonanz-Signatur Screen
 * =========================================
 * Visualisiert die Fourier-Blüte (generate_epicycle_path) aus
 * /api/resonance/signature als geschlossene Kurve auf einem
 * expo-gl Canvas2D — ohne SVG-Dependency.
 *
 * Layout:
 *   ┌────────────────────────────────┐
 *   │  Header: Resonanz-Signatur     │
 *   │  Canvas: Fourier-Kurve         │
 *   │  Label + Symmetrie-Balken      │
 *   │  Journal-Eingabe (Logbuch)     │
 *   │  Submit-Button                 │
 *   └────────────────────────────────┘
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
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import { COLORS, SPACING, TYPO, RADII } from '../src/design';
import { API, type ResonanceSignatureDTO, type SignaturePoint } from '../src/api';

const { width: SCREEN_W } = Dimensions.get('window');
const CANVAS_SIZE = Math.min(SCREEN_W - SPACING.lg * 2, 340);

// ─── Label colours ────────────────────────────────────────────────────────────

const LABEL_META: Record<string, { color: string; de: string }> = {
  synchronized: { color: '#B8FF3C', de: 'synchronisiert' },
  coherent:     { color: '#F5B041', de: 'kohärent'       },
  transitional: { color: '#8A8F95', de: 'transitional'   },
  chaotic:      { color: '#FF3C5F', de: 'chaotisch'       },
};

// ─── Canvas renderer ─────────────────────────────────────────────────────────

function drawSignature(
  gl: ExpoWebGLRenderingContext,
  path: SignaturePoint[],
  label: string,
  symmetry: number,
) {
  if (!path.length) return;

  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;

  // --- WebGL 2D-Simulation via pixel drawing is complex —
  // We use the simpler approach: encode path as a WebGL line strip.

  gl.viewport(0, 0, w, h);
  gl.clearColor(0.02, 0.025, 0.03, 1.0);   // deepVoid
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Vertex shader
  const vsSource = `
    attribute vec2 aPos;
    uniform vec2 uScale;
    void main() {
      gl_Position = vec4(aPos * uScale, 0.0, 1.0);
    }
  `;

  // Fragment shader — colour from label
  const meta = LABEL_META[label] ?? LABEL_META.coherent;
  const hex = meta.color;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const fsSource = `
    precision mediump float;
    uniform vec3 uColor;
    void main() {
      gl_FragColor = vec4(uColor, 0.9);
    }
  `;

  const vs = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vs, vsSource);
  gl.compileShader(vs);

  const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(fs, fsSource);
  gl.compileShader(fs);

  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  // Normalise path to [-1, 1]
  const xs = path.map(p => p.x);
  const ys = path.map(p => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xRange = Math.max(xMax - xMin, 1e-6);
  const yRange = Math.max(yMax - yMin, 1e-6);
  const scale = 0.85;   // 85% of canvas

  const vertices = new Float32Array(path.flatMap(p => [
    ((p.x - xMin) / xRange * 2 - 1) * scale,
    ((p.y - yMin) / yRange * 2 - 1) * scale,
  ]));

  // Close the curve
  const closed = new Float32Array([...Array.from(vertices), vertices[0], vertices[1]]);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, closed, gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uColor = gl.getUniformLocation(prog, 'uColor');
  gl.uniform3f(uColor, r, g, b);

  // Aspect ratio correction
  const aspect = w / h;
  const uScale = gl.getUniformLocation(prog, 'uScale');
  gl.uniform2f(uScale, aspect > 1 ? 1 / aspect : 1, aspect < 1 ? aspect : 1);

  gl.drawArrays(gl.LINE_STRIP, 0, closed.length / 2);
  gl.flush();
  // endFrameEXP is Expo-native only — guard for web compatibility
  if (typeof (gl as ExpoWebGLRenderingContext & { endFrameEXP?: () => void }).endFrameEXP === 'function') {
    (gl as ExpoWebGLRenderingContext & { endFrameEXP: () => void }).endFrameEXP();
  }
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ResonanceScreen() {
  const insets = useSafeAreaInsets();

  const [sig, setSig]         = useState<ResonanceSignatureDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [echo, setEcho]       = useState<string | null>(null);
  const [journal, setJournal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);

  // Load current signature
  const loadSignature = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await API.resonanceSignature('anonymous', 256);
      setSig(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { status?: number } })?.response?.status === 404
        ? 'Noch kein Eintrag — schreibe dein erstes Logbuch.'
        : 'Verbindungsfehler.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSignature(); }, [loadSignature]);

  // Redraw when sig changes and gl is ready
  useEffect(() => {
    if (sig && glRef.current) {
      drawSignature(glRef.current, sig.path, sig.label, sig.symmetry);
    }
  }, [sig]);

  const onGLContextCreate = useCallback(
    (gl: ExpoWebGLRenderingContext) => {
      glRef.current = gl;
      if (sig) drawSignature(gl, sig.path, sig.label, sig.symmetry);
    },
    [sig],
  );

  // Submit journal entry
  const handleSubmit = useCallback(async () => {
    const text = journal.trim();
    if (text.length < 5) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await API.journalSubmit(text, 'anonymous');
      setEcho(res.echo);
      setJournal('');
      // Reload signature after submission
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.void }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
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
        <Text style={styles.sub}>Fourier-Projektion des aktuellen Feldes</Text>

        {/* Canvas */}
        <View style={[styles.canvasContainer, { width: CANVAS_SIZE, height: CANVAS_SIZE }]}>
          <GLView
            style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
            onContextCreate={onGLContextCreate}
          />
          {loading && (
            <View style={styles.canvasOverlay}>
              <ActivityIndicator color={COLORS.amber} size="large" />
            </View>
          )}
          {!loading && !sig && !error && (
            <View style={styles.canvasOverlay}>
              <Text style={styles.placeholder}>—</Text>
            </View>
          )}
        </View>

        {/* State label + symmetry */}
        {sig && meta && (
          <View style={styles.stateRow}>
            <Text style={[styles.label, { color: meta.color }]}>
              {sig.label}
            </Text>
            <View style={styles.symRow}>
              <SymBar value={sig.symmetry} color={meta.color} />
              <Text style={styles.symNum}>{sig.symmetry.toFixed(2)}</Text>
            </View>
          </View>
        )}

        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        {/* Echo (Kalibrierungs-Rückmeldung) */}
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
            style={({ pressed }) => [
              styles.submitBtn,
              pressed && { opacity: 0.75 },
              journal.trim().length < 5 && styles.submitBtnDisabled,
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

        {/* Reload */}
        <Pressable style={styles.reloadBtn} onPress={loadSignature}>
          <Text style={styles.reloadText}>↺  Signatur neu laden</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Symmetry bar ─────────────────────────────────────────────────────────────

function SymBar({ value, color }: { value: number; color: string }) {
  const filled = Math.round(value * 10);
  return (
    <View style={styles.symBar}>
      {Array.from({ length: 10 }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.symCell,
            { backgroundColor: i < filled ? color : COLORS.textMuted + '30' },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  header: {
    fontFamily: TYPO.monoBold,
    fontSize: 18,
    color: COLORS.textPrimary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  sub: {
    fontFamily: TYPO.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },
  canvasContainer: {
    borderRadius: RADII.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.deepVoid,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    position: 'relative',
  },
  canvasOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    fontFamily: TYPO.mono,
    fontSize: 32,
    color: COLORS.textMuted,
  },
  stateRow: {
    alignItems: 'center',
    gap: SPACING.xs,
    width: '100%',
  },
  label: {
    fontFamily: TYPO.monoBold,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  symRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  symBar: {
    flexDirection: 'row',
    gap: 3,
  },
  symCell: {
    width: 18,
    height: 6,
    borderRadius: 2,
  },
  symNum: {
    fontFamily: TYPO.mono,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontFamily: TYPO.mono,
    fontSize: 12,
    color: COLORS.crimson,
    textAlign: 'center',
  },
  echoBox: {
    backgroundColor: COLORS.panel,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    padding: SPACING.md,
    width: '100%',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  echoText: {
    fontFamily: TYPO.mono,
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  echoClose: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  inputSection: {
    width: '100%',
    gap: SPACING.sm,
  },
  inputLabel: {
    fontFamily: TYPO.label,
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: COLORS.panel,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    padding: SPACING.md,
    fontFamily: TYPO.mono,
    fontSize: 13,
    color: COLORS.textPrimary,
    minHeight: 110,
  },
  submitBtn: {
    backgroundColor: COLORS.amber,
    borderRadius: RADII.md,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.35,
  },
  submitText: {
    fontFamily: TYPO.monoBold,
    fontSize: 13,
    color: COLORS.void,
    letterSpacing: 1,
  },
  reloadBtn: {
    paddingVertical: SPACING.sm,
  },
  reloadText: {
    fontFamily: TYPO.mono,
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
});
