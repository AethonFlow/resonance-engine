/**
 * THE SPHERE – Coherence Engine v0.2
 *
 * 24-Knoten-Tensor (8 Häuser × 3 Layer)
 *   Layer 0 (Ground / Body)      — physikalische Oszillation
 *   Layer 1 (Modulation / LLM)   — semantische Modulation durch 8 Probes
 *   Layer 2 (Faszien / Coupling) — tensegre Strukturträger
 *
 * Hamiltonian:
 *   H = ½ Σ p² / m
 *     + ½ k_intra · Σ_i [ (q_i,1 − q_i,0 − 2π/3)² + (q_i,2 − q_i,1 − 2π/3)² ]   (Trine-Lock)
 *     + k_neigh  · Σ_l Σ_i (1 − cos(q_i,l − q_{i+1},l))                         (Nachbarn)
 *     + ½ k_quad · Σ_l Σ_{i<4} (q_i,l + q_{i+4},l − π)²                         (Antipoden)
 *     + ½ k_E    · (E_0 − 25)²                                                   (Energiebecken)
 *
 * Integrator: Velocity-Verlet (2nd-order symplectic, energy-conserving).
 *
 * Coherence metric (SING INDEX):
 *   Z_l    = (1/8) Σ_i exp(i·q_i,l)
 *   R_l    = |Z_l|                              ∈ [0,1]
 *   Δ_01   = arg(Z_1) − arg(Z_0) − 2π/3
 *   Δ_12   = arg(Z_2) − arg(Z_1) − 2π/3
 *   T_inter = cos²(Δ_01/2) · cos²(Δ_12/2)        ∈ [0,1]
 *   C_E    = exp(−(E_0 − 25)²/σ²)               ∈ [0,1]
 *   S      = (R_0·R_1·R_2)^(1/3) · T_inter · C_E ∈ [0,1]
 *
 * Caput Mortuum noise score:
 *   N = α·||p||_RMS + β·σ_window(I) + γ·(1 − R_total)
 */

import { HOUSES, NULLSTELLE_ENERGY, NULLSTELLE_THRESHOLD } from './design';
import {
  type Aspect,
  applyAspectMatrix as applyAspectMatrixCore,
  probeToAspects,
  type ProbeResponse,
} from './aspects';

export type Vec3 = [number, number, number];
export type ResonanceState = 'warm' | 'cold' | 'hot' | 'nullstelle' | 'singing';

export const N_LAYERS = 3;
export const N_HOUSES = 8;
export const N_NODES = N_LAYERS * N_HOUSES; // 24

export const NULLSTELLE_N_THRESHOLD = 0.45; // Caput Mortuum trigger

// idx: 0..23  encodes  (house, layer)  as  layer*8 + house  for cache-friendly stride
export const idx = (h: number, l: number): number => l * N_HOUSES + h;

const TWO_PI_OVER_3 = (2 * Math.PI) / 3;
const DEFAULT_A = Math.sqrt(NULLSTELLE_ENERGY / N_HOUSES); // ≈1.7678 → E_0 = 25 at sin=±1

// Coupling constants (faszien tension)
const K_INTRA = 0.18;  // intra-house spring (trine lock)
const K_NEIGH = 0.05;  // neighbor coupling per layer
const K_QUAD  = 0.10;  // antipode coupling per layer
const K_E     = 0.06;  // energy basin pull
const SIGMA_E = 6;     // C_E gaussian width

const MODULATION_SIGMA = 0.55;       // amplitude swing on layer 1 from LLM scores
const PHASE_KICK = Math.PI / 12;     // discrete kick magnitude (vector ±1)
const MARKER_TTL_SEC = 7;            // how long markers fade in HUD

export type ProbeImpression = {
  score: number;     // 0..1
  vector: -1 | 0 | 1;
  marker: string;
  ts: number;        // physics time when applied
};

export type SphereState = {
  // canonical state arrays (length 24)
  q: Float32Array;
  p: Float32Array;
  A: Float32Array;

  omega: number;
  k_intra: number;
  k_neigh: number;
  k_quad: number;
  k_E: number;

  t: number;

  // derived (reused across frames)
  liveVectors: Vec3[];      // length 24
  ghostVectors: Vec3[];     // length 24, layer-0 only-meaningful (for HUD ghost)

  // per-layer Kuramoto results
  R_layer: [number, number, number];
  argZ_layer: [number, number, number];
  T_inter: number;
  C_E: number;

  energy: number;           // E_0 (layer 0)
  incoherence: number;      // 1 - R_0 (legacy compat)
  sing_index: number;       // S — main coherence metric
  noise_score: number;      // N — Caput Mortuum accumulator (smoothed)

  // recent LLM impressions  (per house, may be undefined)
  impressions: (ProbeImpression | null)[];   // length 8

  state: ResonanceState;

  // small windowed stats for noise score
  _i_window: number[];      // last 60 incoherence samples (~6 s @ 10 Hz)
  _last_window_t: number;
};

// ─────────────────────────────────────────────────────────────
// Init / reset
// ─────────────────────────────────────────────────────────────
export function createInitialState(): SphereState {
  const q = new Float32Array(N_NODES);
  const p = new Float32Array(N_NODES);
  const A = new Float32Array(N_NODES);

  for (let h = 0; h < N_HOUSES; h++) {
    for (let l = 0; l < N_LAYERS; l++) {
      const k = idx(h, l);
      A[k] = DEFAULT_A;
      // ALL 8 houses share the same phase per layer (full Kuramoto coherence).
      // Spatial antipodal symmetry is supplied by the unit vector v̂_i in design.ts.
      // Layers offset by 2π/3 each → trine geometry.
      q[k] = Math.PI / 2 + l * TWO_PI_OVER_3;
      p[k] = 0;
    }
  }

  const s: SphereState = {
    q, p, A,
    omega: 1.0,
    k_intra: K_INTRA, k_neigh: K_NEIGH, k_quad: K_QUAD, k_E: K_E,
    t: 0,
    liveVectors: Array.from({ length: N_NODES }, () => [0, 0, 0] as Vec3),
    ghostVectors: Array.from({ length: N_NODES }, () => [0, 0, 0] as Vec3),
    R_layer: [0, 0, 0],
    argZ_layer: [0, 0, 0],
    T_inter: 0,
    C_E: 0,
    energy: 0,
    incoherence: 0,
    sing_index: 0,
    noise_score: 0,
    impressions: Array.from({ length: N_HOUSES }, () => null),
    state: 'cold',
    _i_window: [],
    _last_window_t: 0,
  };
  recomputeDerived(s);
  return s;
}

/** Caput Mortuum reset — same canonical ICs. */
export function resetToInitial(s: SphereState): void {
  const fresh = createInitialState();
  s.q.set(fresh.q);
  s.p.set(fresh.p);
  s.A.set(fresh.A);
  s.omega = fresh.omega;
  s.t = 0;
  s.noise_score = 0;
  s._i_window = [];
  s.impressions = Array.from({ length: N_HOUSES }, () => null);
  recomputeDerived(s);
}

// ─────────────────────────────────────────────────────────────
// Energy & Forces
// ─────────────────────────────────────────────────────────────
function energyLayer0(A: Float32Array, q: Float32Array): number {
  let E = 0;
  for (let h = 0; h < N_HOUSES; h++) {
    const k = idx(h, 0);
    const x = A[k] * Math.sin(q[k]);
    E += x * x;
  }
  return E;
}

/** Compute -∂H/∂q for all 24 nodes, write into out[]. */
function computeForces(s: SphereState, q: Float32Array, out: Float32Array): void {
  const A = s.A;
  out.fill(0);

  // V_intra (trine lock between layers within a house)
  //   V = ½k[(q1-q0-c)² + (q2-q1-c)²]   where c = 2π/3
  //   ∂V/∂q0 = -k·d01      ∂V/∂q1 = +k·d01 - k·d12      ∂V/∂q2 = +k·d12
  for (let h = 0; h < N_HOUSES; h++) {
    const k0 = idx(h, 0), k1 = idx(h, 1), k2 = idx(h, 2);
    const d01 = q[k1] - q[k0] - TWO_PI_OVER_3;
    const d12 = q[k2] - q[k1] - TWO_PI_OVER_3;
    out[k0] += -s.k_intra * d01;
    out[k1] +=  s.k_intra * d01 - s.k_intra * d12;
    out[k2] +=  s.k_intra * d12;
  }

  // V_neigh (Kuramoto-like per layer): V = k * (1 - cos(Δ))
  // ∂V/∂q_i,l = k * sin(q_i,l - q_{i+1},l)  +  k * sin(q_i,l - q_{i-1},l)
  for (let l = 0; l < N_LAYERS; l++) {
    for (let h = 0; h < N_HOUSES; h++) {
      const k = idx(h, l);
      const kn = idx((h + 1) % N_HOUSES, l);
      const kp = idx((h + N_HOUSES - 1) % N_HOUSES, l);
      out[k] += s.k_neigh * (Math.sin(q[k] - q[kn]) + Math.sin(q[k] - q[kp]));
    }
  }

  // V_quad (antipode pairs lock in phase via Kuramoto-style coupling — they oscillate
  // together so their *spatial* live vectors point antipodally in lock-step).
  //   V = k * (1 - cos(q[i+4] - q[i]))
  //   dV/dq[i]   = -k · sin(q[i+4] - q[i])
  //   dV/dq[i+4] = +k · sin(q[i+4] - q[i])
  for (let l = 0; l < N_LAYERS; l++) {
    for (let h = 0; h < 4; h++) {
      const ka = idx(h, l);
      const kb = idx(h + 4, l);
      const sn = Math.sin(q[kb] - q[ka]);
      out[ka] += -s.k_quad * sn;
      out[kb] += +s.k_quad * sn;
    }
  }

  // V_E intentionally removed: with C_E now gated on the *amplitude* energy E_A
  // (constant under balanced amplitudes), the instantaneous E_inst is meant to
  // oscillate as the natural breath of the harmonic system. Adding a phase-pushing
  // V_E force here was destabilising the trine geometry without adding meaningful
  // constraint, since user-controlled amplitudes already determine E_A.

  // Forces are -∂V/∂q
  for (let i = 0; i < N_NODES; i++) out[i] = -out[i];
}

// scratch buffers for Velocity-Verlet
const _F0 = new Float32Array(N_NODES);
const _F1 = new Float32Array(N_NODES);
const _qBuf = new Float32Array(N_NODES);

/**
 * Velocity-Verlet integration step.
 *   p_{n+½}  = p_n + (dt/2) F(q_n)
 *   q_{n+1}  = q_n + dt · (ω + p_{n+½})
 *   p_{n+1}  = p_{n+½} + (dt/2) F(q_{n+1})
 */
export function step(s: SphereState, dt: number): void {
  // sub-step if dt large
  const subSteps = dt > 1 / 30 ? 2 : 1;
  const h = dt / subSteps;

  for (let sub = 0; sub < subSteps; sub++) {
    computeForces(s, s.q, _F0);

    // half kick
    for (let i = 0; i < N_NODES; i++) s.p[i] += 0.5 * h * _F0[i];

    // full drift  q ← q + h(ω + p)
    for (let i = 0; i < N_NODES; i++) {
      _qBuf[i] = s.q[i] + h * (s.omega + s.p[i]);
    }
    s.q.set(_qBuf);

    // forces at new q
    computeForces(s, s.q, _F1);

    // second half kick
    for (let i = 0; i < N_NODES; i++) s.p[i] += 0.5 * h * _F1[i];
  }

  s.t += dt;
  recomputeDerived(s);
}

// ─────────────────────────────────────────────────────────────
// Derived metrics
// ─────────────────────────────────────────────────────────────
function recomputeDerived(s: SphereState): void {
  const { q, A, p } = s;

  // Live vectors per node
  for (let h = 0; h < N_HOUSES; h++) {
    const v = HOUSES[h].vector;
    for (let l = 0; l < N_LAYERS; l++) {
      const k = idx(h, l);
      const scalar = Math.sin(q[k]) * (A[k] / 5);
      const lv = s.liveVectors[k];
      lv[0] = v[0] * scalar;
      lv[1] = v[1] * scalar;
      lv[2] = v[2] * scalar;
    }
  }

  // Energy & legacy incoherence (layer 0)
  s.energy = energyLayer0(A, q);  // instantaneous "breathing" energy → HUD only
  s.incoherence = 0;              // recomputed below as 1 - R_0

  // Per-layer Kuramoto — raw phases (all 8 houses share q on a coherent layer).
  // Antipodal spatial symmetry is supplied by HOUSES[h].vector (unit-vector mapping),
  // so phases just need to align for full Kuramoto coherence.
  for (let l = 0; l < N_LAYERS; l++) {
    let sumX = 0, sumY = 0;
    for (let h = 0; h < N_HOUSES; h++) {
      const k = idx(h, l);
      sumX += Math.cos(q[k]);
      sumY += Math.sin(q[k]);
    }
    sumX /= N_HOUSES; sumY /= N_HOUSES;
    s.R_layer[l] = Math.hypot(sumX, sumY);
    s.argZ_layer[l] = Math.atan2(sumY, sumX);
  }
  s.incoherence = 1 - s.R_layer[0];

  // Inter-layer trine residual
  const wrap = (x: number) => {
    let w = x % (2 * Math.PI);
    if (w > Math.PI)  w -= 2 * Math.PI;
    if (w < -Math.PI) w += 2 * Math.PI;
    return w;
  };
  const d01 = wrap(s.argZ_layer[1] - s.argZ_layer[0] - TWO_PI_OVER_3);
  const d12 = wrap(s.argZ_layer[2] - s.argZ_layer[1] - TWO_PI_OVER_3);
  s.T_inter = Math.cos(d01 / 2) ** 2 * Math.cos(d12 / 2) ** 2;

  // Energy basin — gate on amplitude energy E_A = Σ A² (constant when balanced),
  // NOT the instantaneous spatial deformation Σ(A·sin q)² which oscillates with the
  // breath. This keeps SING INDEX stable through the harmonic cycle while the HUD
  // still shows the live "breathing" energy.
  let E_A = 0;
  for (let h = 0; h < N_HOUSES; h++) {
    const a = A[idx(h, 0)];
    E_A += a * a;
  }
  s.C_E = Math.exp(-((E_A - NULLSTELLE_ENERGY) ** 2) / (SIGMA_E * SIGMA_E));

  // SING INDEX
  const Rprod = Math.cbrt(s.R_layer[0] * s.R_layer[1] * s.R_layer[2]);
  s.sing_index = Rprod * s.T_inter * s.C_E;

  // ghost vectors (1.2 s symplectic forward projection on Layer 0 only — light-weight)
  computeGhost(s);

  // Caput Mortuum noise score
  let pSq = 0;
  for (let i = 0; i < N_NODES; i++) pSq += p[i] * p[i];
  const pRms = Math.sqrt(pSq / N_NODES);
  // window of incoherence samples
  if (s.t - s._last_window_t > 0.1) {
    s._i_window.push(s.incoherence);
    if (s._i_window.length > 60) s._i_window.shift();
    s._last_window_t = s.t;
  }
  const w = s._i_window;
  let mean = 0; for (let i = 0; i < w.length; i++) mean += w[i]; mean /= Math.max(1, w.length);
  let varI = 0; for (let i = 0; i < w.length; i++) varI += (w[i] - mean) ** 2; varI /= Math.max(1, w.length);
  const sigmaI = Math.sqrt(varI);
  const totalR = (s.R_layer[0] + s.R_layer[1] + s.R_layer[2]) / 3;
  const Nraw = 0.5 * pRms + 1.0 * sigmaI + 0.3 * (1 - totalR);
  // exponential smoothing
  s.noise_score = 0.92 * s.noise_score + 0.08 * Nraw;

  // State classification
  const energyDelta = Math.abs(s.energy - NULLSTELLE_ENERGY) / NULLSTELLE_ENERGY;
  if (s.sing_index >= 0.95) {
    s.state = 'nullstelle';
  } else if (s.sing_index >= 0.85) {
    s.state = 'singing';
  } else if (s.energy > NULLSTELLE_ENERGY * 1.4) {
    s.state = 'hot';
  } else if (s.sing_index >= 0.6 && energyDelta < 0.25) {
    s.state = 'warm';
  } else {
    s.state = 'cold';
  }
}

function computeGhost(s: SphereState): void {
  // Lightweight extrapolation: project layer-0 phases forward by 1.2 s using current ω + p
  const horizon = 1.2;
  for (let h = 0; h < N_HOUSES; h++) {
    const k = idx(h, 0);
    const qf = s.q[k] + horizon * (s.omega + s.p[k]);
    const v = HOUSES[h].vector;
    const scalar = Math.sin(qf) * (s.A[k] / 5);
    const gv = s.ghostVectors[k];
    gv[0] = v[0] * scalar;
    gv[1] = v[1] * scalar;
    gv[2] = v[2] * scalar;
  }
}

// ─────────────────────────────────────────────────────────────
// User-facing mutators
// ─────────────────────────────────────────────────────────────
export function setMagnitude(s: SphereState, houseIndex0based: number, value: number): void {
  // Apply to ALL three layers for the chosen house — keeps trine balance
  const v = Math.max(0, Math.min(3.5, value));
  for (let l = 0; l < N_LAYERS; l++) s.A[idx(houseIndex0based, l)] = v;
  recomputeDerived(s);
}

export function getHouseMagnitude(s: SphereState, houseIndex0based: number, layer = 0): number {
  return s.A[idx(houseIndex0based, layer)];
}

export function setOmega(s: SphereState, value: number): void {
  s.omega = Math.max(0.1, Math.min(4, value));
}

/** Hard snap to perfect coherence (NULLSTELLE manual). */
export function snapToNullstelle(s: SphereState): void {
  resetToInitial(s);
}

/**
 * Apply a single LLM probe impression — legacy helper kept for HUD continuity.
 * Direct callers should prefer `applyAspectMatrix` (the only architectural bridge).
 */
export function applyProbeImpression(
  s: SphereState,
  houseIndex0based: number,
  impression: ProbeImpression,
): void {
  s.impressions[houseIndex0based] = impression;
}

/**
 * Apply an Aspect Matrix to the live state. This is the ONLY architectural bridge
 * between probe output and physics. Calls into the canonical aspect-matrix code
 * (src/aspects.ts) and additionally records markers as ProbeImpression entries
 * so the HUD can fade them in and out.
 */
export function applyAspectMatrix(s: SphereState, aspects: Aspect[]): void {
  applyAspectMatrixCore({ q: s.q, p: s.p, A: s.A }, aspects);
  // Record markers per aspect's first target house for HUD fade-in
  for (const aspect of aspects) {
    const marker = aspect.marker ?? '';
    const targets = aspect.scope === 'global'
      ? [1, 2, 3, 4, 5, 6, 7, 8]
      : aspect.target_houses;
    for (const h1 of targets) {
      if (h1 < 1 || h1 > 8) continue;
      // Derive a back-compat score & vector for HUD compatibility
      const ampDelta = aspect.effects.amplitude ?? 0;
      const score = 0.5 + ampDelta / 0.8;            // inverse of (intensity * AMPL_GAIN)
      const phase = aspect.effects.phase_shift ?? 0;
      const vec: -1 | 0 | 1 = phase > 0.05 ? 1 : phase < -0.05 ? -1 : 0;
      s.impressions[h1 - 1] = {
        score: Math.max(0, Math.min(1, score)),
        vector: vec,
        marker,
        ts: s.t,
      };
    }
  }
  recomputeDerived(s);
}

/**
 * Convenience: probe response → Aspect Matrix → live state.
 * Preferred entry point from the UI layer.
 */
export function applyProbeResponse(s: SphereState, probe: ProbeResponse): Aspect[] {
  const aspects = probeToAspects(probe);
  applyAspectMatrix(s, aspects);
  return aspects;
}

/**
 * @deprecated Use `applyProbeResponse` (preserves architectural separation).
 * Retained for backward compatibility with legacy call sites.
 */
export function applyProbeBatch(
  s: SphereState,
  scores: number[],
  vectors: number[],
  markers: string[],
): void {
  applyProbeResponse(s, { scores, vectors, markers });
}

/** True if marker should still be visible in the HUD. */
export function isImpressionFresh(imp: ProbeImpression | null, now_t: number): boolean {
  return !!imp && (now_t - imp.ts) < MARKER_TTL_SEC;
}

export { DEFAULT_A };
