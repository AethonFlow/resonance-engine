/**
 * resonance.web.tsx — Immersives Resonanz-Instrument (Web)
 * =========================================================
 * Zwei Zustände. Kein Menü. Kein Button.
 *
 * input     → dunkler Screen, ein Freitextfeld, Enter genügt
 * signature → Fourier-Blüte erscheint, Zustandslabel, Symmetrie
 *
 * Transition: Fade-out Input (0.8s) → API-Call → Fade-in Blüte (1.2s)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { API, type ResonanceSignatureDTO, type SignaturePoint } from '../src/api';

const { width: W, height: H } = Dimensions.get('window');
const BLOOM_SIZE = Math.min(W * 0.85, 520);

const LABEL_COLOR: Record<string, string> = {
  synchronized: '#B8FF3C',
  coherent:     '#F5B041',
  transitional: '#8A8F95',
  chaotic:      '#FF3C5F',
};

const LABEL_DE: Record<string, string> = {
  synchronized: 'synchronisiert',
  coherent:     'kohärent',
  transitional: 'transitional',
  chaotic:      'chaotisch',
};

// ─── Canvas2D — Fourier-Blüte ─────────────────────────────────────────────────

function drawBloom(canvas: HTMLCanvasElement, path: SignaturePoint[], label: string, symmetry: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !path.length) return;

  const CW = canvas.width;
  const CH = canvas.height;
  const color = LABEL_COLOR[label] ?? '#F5B041';

  ctx.clearRect(0, 0, CW, CH);
  ctx.fillStyle = '#0b0b0d';
  ctx.fillRect(0, 0, CW, CH);

  const xs = path.map(p => p.x), ys = path.map(p => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const pad = CW * 0.1;
  const toX = (x: number) => pad + ((x - xMin) / Math.max(xMax - xMin, 1e-6)) * (CW - pad * 2);
  const toY = (y: number) => pad + ((y - yMin) / Math.max(yMax - yMin, 1e-6)) * (CH - pad * 2);

  const buildPath = () => {
    ctx.beginPath();
    ctx.moveTo(toX(path[0].x), toY(path[0].y));
    path.slice(1).forEach(p => ctx.lineTo(toX(p.x), toY(p.y)));
    ctx.closePath();
  };

  // outer glow
  buildPath();
  ctx.strokeStyle = color + '20';
  ctx.lineWidth = 12;
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.stroke();

  // inner glow
  buildPath();
  ctx.strokeStyle = color + '50';
  ctx.lineWidth = 4;
  ctx.shadowBlur = 10;
  ctx.stroke();

  // sharp line
  buildPath();
  ctx.strokeStyle = color + 'CC';
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 0;
  ctx.stroke();

  // symmetry ring (top centre)
  const r = 14, ax = CW / 2, ay = r + 14;
  ctx.beginPath();
  ctx.arc(ax, ay, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * symmetry);
  ctx.strokeStyle = color + '80';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Mode = 'input' | 'loading' | 'signature';

export default function ResonanceWebScreen() {
  const [mode, setMode]   = useState<Mode>('input');
  const [text, setText]   = useState('');
  const [sig, setSig]     = useState<ResonanceSignatureDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Animated opacity values
  const inputOp = useRef(new Animated.Value(1)).current;
  const bloomOp = useRef(new Animated.Value(0)).current;

  // Canvas container (imperative — no <canvas> in JSX)
  const canvasWrapRef = useRef<View>(null);
  const canvasRef     = useRef<HTMLCanvasElement | null>(null);

  // Create canvas once the wrapper is mounted
  useEffect(() => {
    if (!canvasWrapRef.current) return;
    const node = canvasWrapRef.current as unknown as HTMLElement;
    const canvas = document.createElement('canvas');
    canvas.width  = BLOOM_SIZE * 2;
    canvas.height = BLOOM_SIZE * 2;
    canvas.style.cssText = `width:${BLOOM_SIZE}px;height:${BLOOM_SIZE}px;display:block;`;
    node.appendChild(canvas);
    canvasRef.current = canvas;
    return () => { if (node.contains(canvas)) node.removeChild(canvas); };
  }, []);

  // Draw when sig arrives
  useEffect(() => {
    if (sig && canvasRef.current) {
      drawBloom(canvasRef.current, sig.path, sig.label, sig.symmetry);
    }
  }, [sig]);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (trimmed.length < 5 || mode !== 'input') return;
    setError(null);

    // Fade out input
    Animated.timing(inputOp, {
      toValue: 0, duration: 800, useNativeDriver: true,
    }).start(async () => {
      setMode('loading');
      try {
        await API.journalSubmit(trimmed, 'anonymous');
        const newSig = await API.resonanceSignature('anonymous', 256);
        setSig(newSig);
        setMode('signature');
        // Fade in bloom
        Animated.timing(bloomOp, {
          toValue: 1, duration: 1200, useNativeDriver: true,
        }).start();
      } catch {
        setError('Verbindungsfehler — Backend läuft?');
        setMode('input');
        Animated.timing(inputOp, {
          toValue: 1, duration: 400, useNativeDriver: true,
        }).start();
      }
    });
  }, [text, mode, inputOp, bloomOp]);

  const handleReset = useCallback(() => {
    Animated.timing(bloomOp, {
      toValue: 0, duration: 600, useNativeDriver: true,
    }).start(() => {
      setText('');
      setSig(null);
      setMode('input');
      Animated.timing(inputOp, {
        toValue: 1, duration: 800, useNativeDriver: true,
      }).start();
    });
  }, [bloomOp, inputOp]);

  const color = sig ? (LABEL_COLOR[sig.label] ?? '#F5B041') : '#F5B041';

  return (
    <View style={s.root}>

      {/* ── INPUT STAGE ── */}
      <Animated.View style={[s.stage, { opacity: inputOp }]} pointerEvents={mode === 'input' ? 'auto' : 'none'}>
        <Text style={s.prompt}>Was beschäftigt dein System gerade?</Text>
        <TextInput
          style={s.field}
          value={text}
          onChangeText={setText}
          placeholder="Schreib frei…"
          placeholderTextColor="#444"
          multiline
          autoFocus
          // Enter (ohne Shift) → Submit
          onKeyPress={(e: { nativeEvent: { key: string } }) => {
            if ((e.nativeEvent as unknown as KeyboardEvent).key === 'Enter' &&
                !(e.nativeEvent as unknown as KeyboardEvent).shiftKey) {
              handleSubmit();
            }
          }}
        />
        {error && <Text style={s.error}>{error}</Text>}
        <Text style={s.hint}>Enter ↵ zum Absenden · Shift+Enter für neue Zeile</Text>
      </Animated.View>

      {/* ── LOADING PULSE ── */}
      {mode === 'loading' && (
        <View style={s.stage} pointerEvents="none">
          <Text style={[s.loadingDot, { color }]}>◈</Text>
        </View>
      )}

      {/* ── SIGNATURE STAGE ── */}
      <Animated.View style={[s.stage, { opacity: bloomOp }]} pointerEvents={mode === 'signature' ? 'auto' : 'none'}>
        {sig && (
          <>
            <Text style={[s.sigLabel, { color }]}>
              {LABEL_DE[sig.label] ?? sig.label}
            </Text>
            <Text style={s.sigSym}>{sig.symmetry.toFixed(2)}</Text>
          </>
        )}

        {/* Canvas container */}
        <View
          ref={canvasWrapRef}
          style={[s.canvasWrap, { width: BLOOM_SIZE, height: BLOOM_SIZE }]}
        />

        {/* Tap anywhere to reset */}
        <Text style={s.resetHint} onPress={handleReset}>
          ↺  neu eingeben
        </Text>
      </Animated.View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    width: W,
    height: H,
    backgroundColor: '#0b0b0d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    position: 'absolute',
    width: '100%',
    maxWidth: 680,
    paddingHorizontal: 40,
    alignItems: 'center',
    gap: 20,
  },
  prompt: {
    fontSize: 22,
    color: '#e8e8e8',
    fontFamily: 'monospace',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 8,
    opacity: 0.9,
  },
  field: {
    width: '100%',
    minHeight: 160,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    fontFamily: 'monospace',
    textAlignVertical: 'top',
    outlineStyle: 'none',
  } as ReturnType<typeof StyleSheet.create>[string],
  hint: {
    fontSize: 11,
    color: '#444',
    fontFamily: 'monospace',
    marginTop: -8,
  },
  error: {
    fontSize: 12,
    color: '#FF3C5F',
    fontFamily: 'monospace',
  },
  loadingDot: {
    fontSize: 48,
    opacity: 0.6,
  },
  sigLabel: {
    fontSize: 14,
    fontFamily: 'monospace',
    letterSpacing: 3,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  sigSym: {
    fontSize: 11,
    color: '#555',
    fontFamily: 'monospace',
    marginTop: -12,
  },
  canvasWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0b0b0d',
  },
  resetHint: {
    fontSize: 11,
    color: '#444',
    fontFamily: 'monospace',
    marginTop: 8,
    cursor: 'pointer',
  } as ReturnType<typeof StyleSheet.create>[string],
});
