# THE SPHERE – Coherence Engine · PRD (v0.2)

## Vision
A mobile-first 3D **Coherence Engine** — a Hamiltonian, symplectic, vector-based resonance instrument. The 8 Houses live across **three layers** (Ground · Modulation · Faszien) forming a **3×8 = 24-knot tensor**. Eight parallel Claude Haiku 4.5 measurement-operators tune the Modulation Layer from user text, while a Velocity-Verlet integrator keeps the trine geometry locked. The system *sings* when all 24 nodes phase-align across the three layers in a 2π/3 trine.

## Stack
- **Frontend** — Expo SDK 54 · expo-router 6 · expo-gl · three.js 0.160 · expo-three · React Native 0.81 · TypeScript
- **Physics** — 24-knot Hamiltonian tensor, Velocity-Verlet (2nd-order symplectic), Kuramoto coupling (V_neigh + V_quad), trine-lock V_intra
- **Backend** — FastAPI 0.115 · Motor (async MongoDB) · Pydantic v2 · `emergentintegrations`
- **LLM** — `claude-haiku-4-5-20251001` via Emergent LLM Key (8 parallel deterministic JSON-only measurement probes per request)
- **Persistence** — MongoDB 7 · `presets` (legacy 8-knot) · `snapshots` (legacy 8-knot) · `snapshots24` (rich 24-knot + LLM scores) · `caput_mortuum` (residue archive)
- **Feedback** — expo-haptics (Nullstelle / Singing burst) + expo-av (sinus-resonance audio, pitch tracks energy)
- **Design** — Pure #000 · Amber #F5B041 (coherence) · Cyber-Lime #B8FF3C (dissonance) · Crimson #FF3C5F (overload / Caput Mortuum)

## v0.2 Coherence Engine

### Layer architecture (3×8 tensor)
| Layer | Role | Radius | Color | Subdiv |
|---|---|---|---|---|
| **L₀ Ground** | physical / biochemical oscillation | 4.6 | amber wireframe | 4 |
| **L₁ Modulation** | semantic shaping by 8 LLM probes | 5.0 | cyber-lime wireframe | 3 |
| **L₂ Faszien** | tensegrity / inter-layer coupling | 5.4 | white fine wireframe | 2 |

### Hamiltonian
```
H(p, q) = ½ Σ p²
        + ½ k_intra · Σ_h [(q[h,1]-q[h,0]-2π/3)² + (q[h,2]-q[h,1]-2π/3)²]   (trine lock)
        + k_neigh   · Σ_l Σ_h (1 - cos(q[h,l] - q[h+1,l]))                  (Kuramoto neighbours)
        + k_quad    · Σ_l Σ_h<4 (1 - cos(q[h+4,l] - q[h,l]))                (antipode lock)
```

Integrator: **Velocity-Verlet** (2nd-order symplectic). Energy basin is now a *gating metric* (C_E based on amplitude energy E_A = Σ A²) rather than a phase force, freeing the system to breathe through its harmonic cycle.

### SING INDEX (the singing metric)
```
Z_l    = (1/8) · Σ_h exp(i · q[h,l])              (per-layer Kuramoto)
R_l    = |Z_l|                                     ∈ [0, 1]
Δ_01   = arg(Z_1) - arg(Z_0) - 2π/3                (trine residual 1)
Δ_12   = arg(Z_2) - arg(Z_1) - 2π/3                (trine residual 2)
T_inter = cos²(Δ_01/2) · cos²(Δ_12/2)              ∈ [0, 1]
C_E    = exp(-(E_A - 25)²/σ²)                       ∈ [0, 1]    (amplitude basin)
S      = (R_0 · R_1 · R_2)^(1/3) · T_inter · C_E   ∈ [0, 1]
```

| S range | State | Visual |
|---|---|---|
| 0.00 – 0.60 | COLD | Lime, Perlin-noise deformation |
| 0.60 – 0.85 | WARM | Amber, standing waves |
| 0.85 – 0.95 | **SINGING** | All 3 layers visibly synchronized |
| > 0.95 | **NULLSTELLE** | Full amber bloom, central golden core, haptic burst |

### Caput Mortuum
```
N(t) = 0.5 · ‖p‖_RMS  +  1.0 · σ_window(I)  +  0.3 · (1 - R_total)   (smoothed exp 0.92/0.08)
N* = 0.45                                                              (hardcoded)
```
When `N > N*` → archive snapshot to `caput_mortuum` collection, return canonical IC. Manual purification via long-press on NULL or recycle button.

### LLM Probes (Modulation Layer)
8 parallel `LlmChat` calls with `claude-haiku-4-5-20251001`, deterministic JSON-only output:
```
{ "score": float ∈ [0,1], "marker": phrase ≤ 12 words, "vector": int ∈ {-1, 0, +1} }
```
Mapping into the tensor:
```
A[h,1] = √(25/8) + (2·score - 1) · σ_modulation       (amplitude swing)
q[h,1] += vector · π/12                                (discrete phase kick)
impressions[h] = { score, marker, vector, ts }         (HUD fade-in)
```

| House | Operator | Dimension |
|---|---|---|
| I — Impulse   | `analytical_coldness`     | analytic vs intuitive |
| II — Substance | `evidential_density`     | facts vs assertion |
| III — Contact  | `relational_warmth`      | I-Thou vs isolated |
| IV — Root      | `groundedness`           | embodied vs hectic |
| V — Form       | `structural_completeness`| closed arc vs fragment |
| VI — Change    | `transformative_tension` | threshold vs static |
| VII — Meaning  | `semantic_depth`         | polysemic vs literal |
| VIII — Status  | `social_calibration`     | tuned vs monologue |

Total round-trip ~7-10 s for 8 parallel Haiku calls.

## API surface (additions)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/probe` | Run 8 parallel LLM probes on input text |
| POST | `/api/snapshots24` | Persist 24-knot + LLM score snapshot |
| GET  | `/api/snapshots24` | List rich snapshots |
| DELETE | `/api/snapshots24/{id}` | Delete |
| POST | `/api/coherence/reset` | Archive Caput Mortuum residue + return canonical IC |
| GET  | `/api/coherence/residues` | Field-level history of residues |

Legacy 8-knot endpoints (`/api/presets`, `/api/snapshots`) preserved.

## File map (delta from v0.1)
- `frontend/src/physics.ts` — full rewrite: 24-knot tensor, Velocity-Verlet, Kuramoto couplings, SING INDEX, Caput Mortuum noise score, LLM impression dispatcher
- `frontend/src/scene.ts` — full rewrite: 3 concentric spheres, 24 vector beams, layer-1 probe-light pulse, trine phasor indicator
- `frontend/src/api.ts` — new `probe()`, `createSnapshot24()`, `coherenceReset()`, `listResidues()`
- `frontend/app/index.tsx` — TUNE bottom-sheet probe modal (German UX), SING INDEX vertical bar with R₀/R₁/R₂/T readouts, Caput Mortuum red ring around NULL button, marker fade-in under house chips, dedicated CAPUT recycle button
- `frontend/app/snapshots.tsx` — tabbed view (`SINGING · NULLSTELLE` / `CAPUT MORTUUM`)
- `backend/server.py` — `/api/probe`, `/api/snapshots24`, `/api/coherence/reset`, `/api/coherence/residues`; 8 measurement-operator definitions; `_run_probe()` parallel async dispatcher

## Testing (iteration_2)
- **Backend: 28/28 pytest pass** (legacy + 24-knot CRUD + length validation + probe live + Caput Mortuum reset + residues)
- **Frontend: all flows verified** — 3-layer render, NULL snap → S=1.00 sustained, TUNE probe German text → 8 markers populate house chips, snapshots tabs render archived events
- **Live verification**: probe of "Mir ist heute Morgen aufgefallen, wie der Druck in meinem Brustkorb sich auflöst..." returned Root=0.875 (highest) and Meaning=0.782 — exactly matching predicted body-grounding/semantic-depth signature

## Future directions (Andreas)
- Voice input (whisper-1 STT via Emergent LLM Key) → speech becomes a probe trigger
- Background low-frequency probes (one tick/30s on the field's ambient state)
- Multi-user resonance rooms (WebSocket — two phasor-locked spheres)
- Phase-space (q, p) plot HUD overlay
- Preset deep-link share (12-byte URL-safe encoding)
