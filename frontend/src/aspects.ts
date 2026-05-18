/**
 * THE SPHERE — Aspect Layer (DYNAMIC).
 *
 * 1:1 contract with /app/backend/aspects.py:
 *   - same Aspect shape
 *   - same gain constants
 *   - same parameter list (amplitude · damping · coupling · noise · phase_shift)
 *   - same Aspect Matrix application semantics
 *
 * Rule: this is the ONLY bridge between probe output and physics state.
 * Physics equations remain untouched; only initial conditions are nudged.
 */

import { HOUSES } from './houses';

export type AspectScope = 'global' | 'local';

export type AspectEffects = {
  amplitude:   number;   // default 0
  damping:     number;
  coupling:    number;
  noise:       number;
  phase_shift: number;
};

/** Task 1 — safe init: anything → fully defaulted AspectEffects, no crashes. */
export function safeEffects(raw: any): AspectEffects {
  const r = raw && typeof raw === 'object' ? raw : {};
  const f = (k: string): number => {
    const v = r[k];
    if (v === null || v === undefined) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    amplitude:   f('amplitude'),
    damping:     f('damping'),
    coupling:    f('coupling'),
    noise:       f('noise'),
    phase_shift: f('phase_shift'),
  };
}

export type Aspect = {
  name: string;
  scope: AspectScope;
  target_houses: number[];   // 1-based house indices
  effects: AspectEffects;
  marker?: string;           // UI-only feedback
};

// Gains — identical to backend
export const AMPL_GAIN  = 0.40;
export const DAMP_GAIN  = 0.25;
export const NOISE_GAIN = 0.30;
export const PHASE_KICK = Math.PI / 12;

/**
 * The 8 measurement-operator templates. NEVER define houses.
 * default_target_house is the 1-based house each operator nudges by default.
 */
export const ASPECT_OPERATORS: Array<{
  name: string;
  default_target: number;
}> = [
  { name: 'analytical_coldness',     default_target: 1 },
  { name: 'evidential_density',      default_target: 2 },
  { name: 'relational_warmth',       default_target: 3 },
  { name: 'groundedness',            default_target: 4 },
  { name: 'structural_completeness', default_target: 5 },
  { name: 'transformative_tension',  default_target: 6 },
  { name: 'semantic_depth',          default_target: 7 },
  { name: 'social_calibration',      default_target: 8 },
];

// ─────────────────────────────────────────────────────────────
// 1) probe → aspects translation
// ─────────────────────────────────────────────────────────────
export type ProbeResponse = {
  scores: number[];
  vectors: number[];
  markers: string[];
};

export function probeToAspects(probe: ProbeResponse): Aspect[] {
  if (!probe || probe.scores.length !== 8 || probe.vectors.length !== 8) {
    throw new Error('probe must have 8 scores and 8 vectors');
  }
  const aspects: Aspect[] = [];
  for (let i = 0; i < 8; i++) {
    const op = ASPECT_OPERATORS[i];
    const score = clamp(probe.scores[i], 0, 1);
    const intensity = (score - 0.5) * 2;                    // ∈ [-1, +1]
    const v = (probe.vectors[i] === -1 || probe.vectors[i] === 1) ? probe.vectors[i] : 0;

    const effects: AspectEffects = {
      amplitude:   round4(intensity * AMPL_GAIN),
      damping:     round4(Math.max(0, -intensity) * DAMP_GAIN),
      coupling:    0,
      noise:       round4(Math.abs(intensity) * NOISE_GAIN * (v === 0 ? 1 : 0.5)),
      phase_shift: round4(v * PHASE_KICK),
    };
    aspects.push({
      name: op.name,
      scope: 'local',
      target_houses: [op.default_target],
      effects,
      marker: probe.markers?.[i] ?? '',
    });
  }
  return aspects;
}

// ─────────────────────────────────────────────────────────────
// 2) Aspect Matrix application — the ONLY bridge
//
// Mutates state in-place: amplitudes A, phases q, momenta p.
// Coupling is advisory and recorded only; physics equations stay untouched.
// ─────────────────────────────────────────────────────────────
export type MutableState = {
  q: Float32Array;   // length 24
  p: Float32Array;
  A: Float32Array;
  /** Optional record of last applied matrix — for HUD / mirror later */
  lastAspects?: Aspect[];
};

const N_HOUSES = 8;
const N_LAYERS = 3;
const idx = (h: number, l: number) => l * N_HOUSES + h;

// Task 2 — mandatory clamp ranges (parity with backend aspects.py)
export const CLAMP_AMP_MIN  = 0.0,  CLAMP_AMP_MAX  = 5.0;
export const CLAMP_DAMP_MAX = 2.0;
export const CLAMP_COUP_MAX = 2.0;
export const CLAMP_NOISE_MAX = 2.0;
export const CLAMP_P_MIN    = -2.0, CLAMP_P_MAX    = 2.0;

function wrapPi(q: number): number {
  const TWO_PI = 2 * Math.PI;
  let v = ((q + Math.PI) % TWO_PI);
  if (v <= 0) v += TWO_PI;
  return v - Math.PI;
}

export function applyAspectMatrix(state: MutableState, aspects: Aspect[]): void {
  for (const aspect of aspects) {
    const eff = safeEffects(aspect.effects);
    // sanitize incoming effect magnitudes
    const amp_eff   = clamp(eff.amplitude,   -CLAMP_AMP_MAX, CLAMP_AMP_MAX);
    const damp_eff  = clamp(eff.damping,     0,              CLAMP_DAMP_MAX);
    // coupling captured but advisory (does not touch live state)
    const _coup_eff = clamp(eff.coupling,    0,              CLAMP_COUP_MAX);
    void _coup_eff;
    const noise_eff = clamp(eff.noise,       0,              CLAMP_NOISE_MAX);
    const phase_eff = clamp(eff.phase_shift, -Math.PI,       Math.PI);

    const targets = aspect.scope === 'global'
      ? [1, 2, 3, 4, 5, 6, 7, 8]
      : (aspect.target_houses ?? []);
    for (const h1 of targets) {
      if (h1 < 1 || h1 > 8) continue;
      const h = h1 - 1;
      for (let l = 0; l < N_LAYERS; l++) {
        const k = idx(h, l);
        // Apply
        state.A[k] = state.A[k] + amp_eff;
        state.q[k] = state.q[k] + phase_eff;
        if (damp_eff > 0) state.p[k] = state.p[k] * (1 - Math.min(1, damp_eff));
        if (noise_eff > 0) {
          const seed = Math.sin(13 * (k + 1) + 7 * h1);
          state.q[k] = state.q[k] + noise_eff * (seed * 0.5);
        }
        // Mandatory clamping
        state.A[k] = clamp(state.A[k], CLAMP_AMP_MIN, CLAMP_AMP_MAX);
        state.p[k] = clamp(state.p[k], CLAMP_P_MIN,   CLAMP_P_MAX);
        state.q[k] = wrapPi(state.q[k]);
      }
    }
  }
  state.lastAspects = aspects;
}

// ─────────────────────────────────────────────────────────────
// 3) Layer-0 client check — mirror of backend layer0_check
// ─────────────────────────────────────────────────────────────
export function layer0Check(text: string): { ok: boolean; reason: string } {
  if (!text) return { ok: false, reason: 'Need a sentence to begin. What wants to emerge?' };
  const t = text.trim();
  if (t.length < 8) return { ok: false, reason: 'Say a little more — what is the intention behind this?' };
  const alphaCount = [...t].filter((c) => /[a-zA-ZäöüÄÖÜß]/.test(c)).length;
  if (alphaCount / Math.max(1, t.length) < 0.5) {
    return { ok: false, reason: 'Use words rather than fragments. What are you trying to bring forward?' };
  }
  const tokens = new Set(t.toLowerCase().split(/\s+/).filter(Boolean));
  if (tokens.size < 2) return { ok: false, reason: 'One word is too thin. Add the texture around it.' };
  return { ok: true, reason: '' };
}

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

// expose HOUSES for symmetry with backend
export { HOUSES };
