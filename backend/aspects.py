"""
THE SPHERE — Aspect Layer (DYNAMIC)

Strict separation of concerns:

  HOUSES  (houses.py)   — stable lifecycle topology, never modified by probes.
  ASPECTS (this module) — transient modulation operators that act on houses
                           through the Aspect Matrix. The Aspect Matrix is the
                           ONLY bridge between probe output and physics state.

Aspects do NOT redefine houses. They modify five tunable parameters per target:
  amplitude · damping · coupling · noise · phase_shift

Public surface:
  Aspect                            (dataclass)
  ASPECT_OPERATORS                  (8 measurement-operator templates)
  probe_to_aspects(probe)           (ProbeResponse → list[Aspect])
  apply_aspect_matrix_py(state, aspects)   (server-side application; mirrors frontend)
  build_project_mirror(state)       (deterministic state → 4-section text)
  layer0_check(text)                (early-out clarification gate)
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Literal, Iterable

from houses import HOUSES, HouseMeta


# ════════════════════════════════════════════════════════════════
# 1) ASPECT DATA TYPE
# ════════════════════════════════════════════════════════════════

AspectScope = Literal["global", "local"]


@dataclass
class AspectEffects:
    """Five tunable parameters. Default 0.0 = no effect (Task 1 — safe init)."""
    amplitude:   float = 0.0   # additive delta on A[h, l]
    damping:     float = 0.0   # multiplicative on p[h, l]   (one-shot reduction)
    coupling:    float = 0.0   # per-house weight nudge      (advisory)
    noise:       float = 0.0   # additive jitter on q[h, l]
    phase_shift: float = 0.0   # additive on q[h, l]

    def to_dict(self) -> dict:
        return {
            "amplitude":   float(self.amplitude),
            "damping":     float(self.damping),
            "coupling":    float(self.coupling),
            "noise":       float(self.noise),
            "phase_shift": float(self.phase_shift),
        }

    @classmethod
    def safe(cls, raw) -> "AspectEffects":
        """Build from anything (dict / None / dataclass) without crashing."""
        if raw is None:
            return cls()
        if isinstance(raw, AspectEffects):
            return cls(
                amplitude=float(raw.amplitude or 0.0),
                damping=float(raw.damping or 0.0),
                coupling=float(raw.coupling or 0.0),
                noise=float(raw.noise or 0.0),
                phase_shift=float(raw.phase_shift or 0.0),
            )
        d = raw if isinstance(raw, dict) else {}
        def _f(k: str) -> float:
            v = d.get(k, 0.0)
            try:
                return float(v) if v is not None else 0.0
            except Exception:
                return 0.0
        return cls(
            amplitude=_f("amplitude"),
            damping=_f("damping"),
            coupling=_f("coupling"),
            noise=_f("noise"),
            phase_shift=_f("phase_shift"),
        )


@dataclass
class Aspect:
    name: str                                 # operator identifier (e.g. "analytical_coldness")
    scope: AspectScope = "local"
    target_houses: List[int] = field(default_factory=list)
    effects: AspectEffects = field(default_factory=AspectEffects)
    marker: Optional[str] = None              # UI-only feedback (not used by physics)

    def __post_init__(self):
        # Task 1 — defensive: tolerate `effects=None` or a raw dict.
        self.effects = AspectEffects.safe(self.effects)
        if self.target_houses is None:
            self.target_houses = []

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "scope": self.scope,
            "target_houses": list(self.target_houses or []),
            "effects": self.effects.to_dict(),
            "marker": self.marker or "",
        }


# ════════════════════════════════════════════════════════════════
# 2) THE 8 MEASUREMENT-OPERATOR TEMPLATES
#
# Each operator targets ONE house by default (1-to-1 mapping with the probe
# output index). The mapping is overridable at runtime (the field is just a
# default). Operators are explicitly NOT houses; they are aspects.
# ════════════════════════════════════════════════════════════════

ASPECT_OPERATORS: List[dict] = [
    {  # idx 0 — probe slot 0
        "name": "analytical_coldness",
        "default_target": 1,           # House 1 NNO ORIGIN
        "definition": "How analytic-detached is the input — logic, conceptual rigour, absent affect?",
        "anchor_low":  "pure intuition, vague feeling",
        "anchor_high": "pure calculus, formal logic",
    },
    {
        "name": "evidential_density",
        "default_target": 2,           # House 2 ONO OFFERING
        "definition": "How evidentially dense is the input — verifiable facts, numbers, observations per sentence?",
        "anchor_low":  "pure assertion",
        "anchor_high": "high factual density",
    },
    {
        "name": "relational_warmth",
        "default_target": 3,           # House 3 OSO EXPRESSION
        "definition": "How directly does the input address a 'you' — vulnerability, relational language?",
        "anchor_low":  "third-person, isolated",
        "anchor_high": "direct meeting, open",
    },
    {
        "name": "groundedness",
        "default_target": 4,           # House 4 SSO GROUND
        "definition": "How embodied-present is the input — slowness, breath room, somatic anchoring?",
        "anchor_low":  "frantic, scattered",
        "anchor_high": "slow, embodied, still",
    },
    {
        "name": "structural_completeness",
        "default_target": 5,           # House 5 SSW EMBODIMENT
        "definition": "How structurally complete — premise, carrier, conclusion, no missing parts?",
        "anchor_low":  "fragment, abrupt",
        "anchor_high": "closed arc",
    },
    {
        "name": "transformative_tension",
        "default_target": 6,           # House 6 WSW VALUE
        "definition": "How high is the threshold tension — before/after rupture, generative crisis, tipping point?",
        "anchor_low":  "static description",
        "anchor_high": "threshold, tipping point",
    },
    {
        "name": "semantic_depth",
        "default_target": 7,           # House 7 WNW FEEDBACK
        "definition": "How layered is the meaning — polysemy, archetypes, reference beyond the literal?",
        "anchor_low":  "literal, one-dimensional",
        "anchor_high": "deep, archetypal, polysemous",
    },
    {
        "name": "social_calibration",
        "default_target": 8,           # House 8 NNW EVALUATION
        "definition": "How well-tuned is the input to its addressee — register, context, social awareness?",
        "anchor_low":  "ignores listener, monologue",
        "anchor_high": "precisely tuned to receiver",
    },
]


# ════════════════════════════════════════════════════════════════
# 3) PROBE → ASPECT TRANSLATION
# ════════════════════════════════════════════════════════════════

# Scaling: how much one full probe "intensity" (score 0 vs 1) bends each parameter.
_AMPL_GAIN  = 0.40       # max ±0.40 amplitude swing
_DAMP_GAIN  = 0.25       # max  0.25 damping reduction (one-shot)
_NOISE_GAIN = 0.30       # max  0.30 noise injection
_PHASE_KICK = math.pi / 12.0   # discrete kick magnitude (matches frontend convention)


def probe_to_aspects(probe_response: dict) -> List[Aspect]:
    """
    Convert a /api/probe response  {scores, vectors, markers}  into 8 Aspect objects.

    Rules (per spec):
        scores  → intensity → small parameter deltas
        vectors → directional modulation (phase influence)
        markers → UI only; copied to Aspect.marker, NOT injected into physics

    DOES NOT reinterpret probe slots as houses. Each aspect targets ONE house via the
    default mapping in ASPECT_OPERATORS, fully overrideable by the caller.
    """
    scores  = probe_response.get("scores")  or []
    vectors = probe_response.get("vectors") or []
    markers = probe_response.get("markers") or []
    if len(scores) != 8 or len(vectors) != 8:
        raise ValueError("probe_response must have 8 scores and 8 vectors")

    aspects: List[Aspect] = []
    for i, op in enumerate(ASPECT_OPERATORS):
        s = max(0.0, min(1.0, float(scores[i])))
        intensity = (s - 0.5) * 2.0                  # ∈ [-1, +1]
        v = int(vectors[i])
        if v not in (-1, 0, 1):
            v = 0

        eff = AspectEffects(
            amplitude   = round(intensity * _AMPL_GAIN, 4),
            # damping appears when the operator pulls *down* the field (intensity < 0)
            damping     = round(max(0.0, -intensity) * _DAMP_GAIN, 4),
            # noise is the surprise / instability footprint of magnitude
            noise       = round(abs(intensity) * _NOISE_GAIN * (1 if v == 0 else 0.5), 4),
            phase_shift = round(v * _PHASE_KICK, 4),
            coupling    = None,
        )
        aspects.append(Aspect(
            name=op["name"],
            scope="local",
            target_houses=[op["default_target"]],
            effects=eff,
            marker=(markers[i] if i < len(markers) else "") or None,
        ))
    return aspects


# ════════════════════════════════════════════════════════════════
# 4) ASPECT MATRIX APPLICATION (server-side parity)
#
# The frontend has its own copy in src/aspects.ts that mutates the live
# physics state. This Python implementation is used by /api/tune so the
# server can compute the post-modulation snapshot used by build_project_mirror.
# Both must agree numerically (same gains, same iteration order).
# ════════════════════════════════════════════════════════════════

N_HOUSES = 8
N_LAYERS = 3
N_NODES = N_HOUSES * N_LAYERS


def _idx(h: int, l: int) -> int:
    return l * N_HOUSES + h


# Task 2 — mandatory clamping bounds (applied AFTER each modification).
CLAMP_AMP_MIN, CLAMP_AMP_MAX     = 0.0,  5.0
CLAMP_DAMP_MIN, CLAMP_DAMP_MAX   = 0.0,  2.0
CLAMP_COUP_MIN, CLAMP_COUP_MAX   = 0.0,  2.0
CLAMP_NOISE_MIN, CLAMP_NOISE_MAX = 0.0,  2.0
CLAMP_P_MIN, CLAMP_P_MAX         = -2.0, 2.0
CLAMP_PHASE_MIN, CLAMP_PHASE_MAX = -math.pi, math.pi


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _wrap_pi(q: float) -> float:
    """Wrap angle into (-π, π]."""
    twopi = 2.0 * math.pi
    q = (q + math.pi) % twopi
    if q <= 0:
        q += twopi
    return q - math.pi


def apply_aspect_matrix_py(
    q: List[float],
    p: List[float],
    A: List[float],
    aspects: Iterable[Aspect],
) -> tuple[list[float], list[float], list[float]]:
    """
    Apply the Aspect Matrix to the 24-knot state. Pure transformation —
    physics integrator stays untouched. Effect values are themselves clamped
    to safe ranges before use, then state arrays are clamped after every step.

    Returns mutated (q, p, A) as fresh lists.
    """
    q = list(q); p = list(p); A = list(A)
    for asp in aspects:
        eff = AspectEffects.safe(getattr(asp, "effects", None))

        # Sanitize incoming effect magnitudes (defensive — tolerates faulty probe input)
        amp_eff   = _clamp(eff.amplitude,   -CLAMP_AMP_MAX,   CLAMP_AMP_MAX)
        damp_eff  = _clamp(eff.damping,     CLAMP_DAMP_MIN,   CLAMP_DAMP_MAX)
        coup_eff  = _clamp(eff.coupling,    CLAMP_COUP_MIN,   CLAMP_COUP_MAX)   # advisory only
        noise_eff = _clamp(eff.noise,       CLAMP_NOISE_MIN,  CLAMP_NOISE_MAX)
        phase_eff = _clamp(eff.phase_shift, CLAMP_PHASE_MIN,  CLAMP_PHASE_MAX)
        _ = coup_eff  # advisory — not applied to live state

        scope = getattr(asp, "scope", "local")
        targets = list(range(1, 9)) if scope == "global" else list(getattr(asp, "target_houses", []) or [])
        for h_1b in targets:
            if not (1 <= h_1b <= 8):
                continue
            h = h_1b - 1
            for l in range(N_LAYERS):
                k = _idx(h, l)
                # ── Apply effects ─────────────────────────────
                A[k] = A[k] + amp_eff
                q[k] = q[k] + phase_eff
                if damp_eff > 0:
                    p[k] = p[k] * (1.0 - min(1.0, damp_eff))
                if noise_eff > 0:
                    seed = math.sin(13.0 * (k + 1) + 7.0 * h_1b)
                    q[k] = q[k] + noise_eff * (seed * 0.5)
                # ── Mandatory clamping (Task 2) ───────────────
                A[k] = _clamp(A[k], CLAMP_AMP_MIN, CLAMP_AMP_MAX)
                p[k] = _clamp(p[k], CLAMP_P_MIN,   CLAMP_P_MAX)
                q[k] = _wrap_pi(q[k])
    return q, p, A


# ════════════════════════════════════════════════════════════════
# 5) PROJECT MIRROR (DETERMINISTIC OUTPUT)
# ════════════════════════════════════════════════════════════════

# Task 4 — Three-tier tone thresholds (sing_index based).
SING_CLEAR     = 0.85   # > 0.85 → "clear"
SING_GUIDED    = 0.60   # 0.60–0.85 → "guided"
# below 0.60   → "questioning"
SING_INCOMPLETE = 0.30  # below this → mirror returns explicit incomplete-state response


def _circular_variance(angles: list[float]) -> float:
    """0 = perfectly aligned, 1 = uniformly scattered. Used per-house across layers."""
    if not angles:
        return 1.0
    sx = sum(math.cos(a) for a in angles) / len(angles)
    sy = sum(math.sin(a) for a in angles) / len(angles)
    return 1.0 - math.hypot(sx, sy)


def _layer_kuramoto(q: list[float], layer: int) -> tuple[float, float]:
    """Returns (R, arg(Z)) for a given layer index."""
    sx = 0.0; sy = 0.0
    for h in range(N_HOUSES):
        a = q[_idx(h, layer)]
        sx += math.cos(a); sy += math.sin(a)
    sx /= N_HOUSES; sy /= N_HOUSES
    return math.hypot(sx, sy), math.atan2(sy, sx)


def _compute_sing_index(q: list[float], A: list[float]) -> tuple[float, list[float], float, float]:
    """SING INDEX = (R₀·R₁·R₂)^(1/3) · T_inter · C_E.  Returns (sing, R_layer, T_inter, C_E)."""
    Rs: list[float] = []; args: list[float] = []
    for l in range(N_LAYERS):
        R, ar = _layer_kuramoto(q, l)
        Rs.append(R); args.append(ar)
    twopi3 = 2.0 * math.pi / 3.0
    def _wrap(x: float) -> float:
        x = (x + math.pi) % (2 * math.pi) - math.pi
        return x
    d01 = _wrap(args[1] - args[0] - twopi3)
    d12 = _wrap(args[2] - args[1] - twopi3)
    T_inter = (math.cos(d01 / 2) ** 2) * (math.cos(d12 / 2) ** 2)
    E_A = sum(A[_idx(h, 0)] ** 2 for h in range(N_HOUSES))
    sigma_E = 6.0
    C_E = math.exp(-((E_A - 25.0) ** 2) / (sigma_E * sigma_E))
    Rprod = (Rs[0] * Rs[1] * Rs[2]) ** (1.0 / 3.0) if min(Rs) > 0 else 0.0
    sing = Rprod * T_inter * C_E
    return sing, Rs, T_inter, C_E


def _safe_origin_sign(q: list[float]) -> int:
    """Task 3 — defensive read of Origin (House 1, Layer 0) phase. Falls back to +1."""
    try:
        v = q[_idx(0, 0)]
        s = math.sin(v)
        return 1 if s >= 0 else -1
    except Exception:
        return 1


def build_project_mirror(state: dict) -> dict:
    """
    Deterministic state → PROJECT MIRROR + TRACE.

    Required state keys:
        q: list[float]   (length 24)
        A: list[float]   (length 24)
    Optional:
        p: list[float]   (length 24)        — for completeness, not strictly required
        aspects: list[Aspect | dict]        — active aspect matrix
        sing_index: float                   — pre-computed; otherwise derived from q, A
        R_layer: list[float] (length 3)     — pre-computed; otherwise derived

    Returns:
        {
          core, value, friction, next_step,
          tone        : 'clear' | 'guided' | 'questioning' | 'incomplete',
          house_indices: { core, value, friction, next_step },
          incoherence : float,
          origin_sign : int,
          trace       : { core_idx, value_idx, friction_idx, origin_sign, sing_index,
                          R_layer, phase_var, amp_total, friction_per_house }
        }
    """
    q = list(state.get("q") or [])
    A = list(state.get("A") or [])
    if len(q) != N_NODES or len(A) != N_NODES:
        raise ValueError("q and A must be length 24")

    # ── Per-house phase variance (across the 3 layers, with 2π/3 trine offset) ──
    phase_var: list[float] = []
    for h in range(N_HOUSES):
        adjusted = [q[_idx(h, l)] - l * (2 * math.pi / 3) for l in range(N_LAYERS)]
        phase_var.append(_circular_variance(adjusted))

    # ── Per-house amplitude (sum across the 3 layers) ──
    amp_total = [sum(A[_idx(h, l)] for l in range(N_LAYERS)) for h in range(N_HOUSES)]

    # ── Friction per house: damping + noise ──
    friction_per_house = [0.0] * N_HOUSES
    raw_aspects = state.get("aspects") or []
    for asp in raw_aspects:
        if isinstance(asp, Aspect):
            scope = asp.scope; targets = asp.target_houses
            damp = abs(asp.effects.damping); nois = abs(asp.effects.noise)
        else:
            scope = asp.get("scope", "local")
            targets = asp.get("target_houses", []) or []
            eff = asp.get("effects", {}) or {}
            damp = abs(float(eff.get("damping") or 0.0))
            nois = abs(float(eff.get("noise") or 0.0))
        houses_1b = list(range(1, 9)) if scope == "global" else list(targets)
        for h_1b in houses_1b:
            if 1 <= h_1b <= 8:
                friction_per_house[h_1b - 1] += damp + nois

    # ── Aspect signal magnitude per house — used for tie-breaking ──
    aspect_signal_per_house = [0.0] * N_HOUSES
    for asp in raw_aspects:
        if isinstance(asp, Aspect):
            scope_x = asp.scope; targets_x = asp.target_houses
            amp = asp.effects.amplitude or 0.0
            phs = asp.effects.phase_shift or 0.0
        else:
            scope_x = asp.get("scope", "local")
            targets_x = asp.get("target_houses", []) or []
            eff_x = asp.get("effects", {}) or {}
            amp = float(eff_x.get("amplitude") or 0.0)
            phs = float(eff_x.get("phase_shift") or 0.0)
        houses_1b_x = list(range(1, 9)) if scope_x == "global" else list(targets_x)
        for h_1b in houses_1b_x:
            if 1 <= h_1b <= 8:
                aspect_signal_per_house[h_1b - 1] += abs(amp) + 0.5 * abs(phs)

    # ── House selection per spec, with aspect-signal tie-breakers ──
    core_idx = min(
        range(N_HOUSES),
        key=lambda h: (phase_var[h], -aspect_signal_per_house[h]),
    )
    value_idx = max(
        range(N_HOUSES),
        key=lambda h: (amp_total[h], aspect_signal_per_house[h]),
    )
    if max(friction_per_house) > 0:
        friction_idx = max(
            range(N_HOUSES),
            key=lambda h: (friction_per_house[h], aspect_signal_per_house[h]),
        )
    else:
        amp_layers_var: list[float] = []
        for h in range(N_HOUSES):
            vals = [A[_idx(h, l)] for l in range(N_LAYERS)]
            mean = sum(vals) / len(vals)
            amp_layers_var.append(sum((v - mean) ** 2 for v in vals) / len(vals))
        friction_idx = max(
            range(N_HOUSES),
            key=lambda h: (amp_layers_var[h], aspect_signal_per_house[h]),
        )

    # ── Avoid full-collapse when the field is symmetric and probe was neutral. ──
    used = {core_idx}
    if value_idx in used:
        if max(aspect_signal_per_house) < 1e-6:
            value_idx = (HOUSES[core_idx]["opposite_index"] - 1)
        used.add(value_idx)
    else:
        used.add(value_idx)
    if friction_idx in used and max(aspect_signal_per_house) < 1e-6:
        candidate = HOUSES[value_idx]["opposite_index"] - 1
        friction_idx = candidate if candidate not in used else (
            next((h for h in range(N_HOUSES) if h not in used), friction_idx)
        )

    # ── Origin direction (Task 3 — safe access) ──
    origin_sign = _safe_origin_sign(q)
    origin_q0 = q[_idx(0, 0)] if len(q) > 0 else 0.0
    origin_amp = A[_idx(0, 0)] if len(A) > 0 else 0.0
    origin_drive = math.sin(origin_q0) * origin_amp   # signed scalar component on Origin axis

    # ── SING INDEX (Task 4 tone gating) ──
    sing_provided = state.get("sing_index")
    R_provided = state.get("R_layer")
    if sing_provided is not None and R_provided and len(R_provided) == 3:
        sing = float(sing_provided)
        R_layer = [float(R_provided[i]) for i in range(3)]
    else:
        sing, R_layer, _T, _CE = _compute_sing_index(q, A)
    sing = max(0.0, min(1.0, sing))

    # incoherence (legacy field) — derived from layer-0 R
    incoh = max(0.0, min(1.0, 1.0 - R_layer[0]))

    # Tone resolution (extends rather than replaces — backward compatible)
    if sing > SING_CLEAR:
        tone = "clear"
    elif sing >= SING_GUIDED:
        tone = "guided"
    else:
        tone = "questioning"

    core_h:     HouseMeta = HOUSES[core_idx]
    value_h:    HouseMeta = HOUSES[value_idx]
    friction_h: HouseMeta = HOUSES[friction_idx]
    origin_h:   HouseMeta = HOUSES[0]

    # ── Sentence assembly · maps deterministically to TRACE values ──
    pv = phase_var[core_idx]
    at = amp_total[value_idx]
    fr = friction_per_house[friction_idx] if max(friction_per_house) > 0 else 0.0

    # Special incomplete state — Andreas: "if incoherence high → return incomplete state"
    if sing < SING_INCOMPLETE:
        return {
            "core":      "Field reading is too diffuse to resolve a centre.",
            "value":     "No amplitude dominance has formed yet — the offering has not crystallised.",
            "friction":  "Resistance is everywhere; nothing specific can be released yet.",
            "next_step": (
                f"Clarify {origin_h['code']} · {origin_h['title']} first. "
                f"{origin_h['guiding_question']}"
            ),
            "tone": "incomplete",
            "house_indices": {
                "core": core_h["index"], "value": value_h["index"],
                "friction": friction_h["index"], "next_step": origin_h["index"],
            },
            "incoherence": round(incoh, 3),
            "origin_sign": origin_sign,
            "trace": {
                "core_idx":               core_idx,
                "value_idx":              value_idx,
                "friction_idx":           friction_idx,
                "origin_sign":            origin_sign,
                "origin_drive":           round(origin_drive, 3),
                "sing_index":             round(sing, 3),
                "R_layer":                [round(r, 3) for r in R_layer],
                "phase_var":              [round(v, 3) for v in phase_var],
                "amp_total":              [round(v, 3) for v in amp_total],
                "friction_per_house":     [round(v, 3) for v in friction_per_house],
                "aspect_signal_per_house":[round(v, 3) for v in aspect_signal_per_house],
                "tone_threshold":         {"clear": SING_CLEAR, "guided": SING_GUIDED, "incomplete": SING_INCOMPLETE},
            },
        }

    if tone == "clear":
        core_text = (
            f"{core_h['code']} · {core_h['title']}: {core_h['high_state']}. "
            f"Phase variance {pv:.3f} → strongest stability axis."
        )
        value_text = (
            f"{value_h['code']} · {value_h['title']} carries the dominant amplitude "
            f"({at:.2f}). {value_h['core_energy'].capitalize()}."
        )
        if fr > 0:
            friction_text = (
                f"{friction_h['code']} · {friction_h['title']} concentrates the resistance "
                f"({fr:.2f}): {friction_h['low_state']}."
            )
        else:
            friction_text = (
                f"{friction_h['code']} · {friction_h['title']} carries the largest internal "
                f"trine imbalance: {friction_h['low_state']}."
            )
        next_text = (
            f"Move outward from {origin_h['code']} · {origin_h['title']}. "
            f"{origin_h['guiding_question']}"
        ) if origin_sign > 0 else (
            f"Step back into {origin_h['code']} · {origin_h['title']} and integrate. "
            f"{origin_h['guiding_question']}"
        )
    elif tone == "guided":
        core_text = (
            f"{core_h['code']} · {core_h['title']} is the most stable axis "
            f"(variance {pv:.3f}) — the centre is forming but still fluctuating."
        )
        value_text = (
            f"{value_h['code']} · {value_h['title']} shows the highest amplitude "
            f"({at:.2f}); the value vector is visible but needs sharpening."
        )
        if fr > 0:
            friction_text = (
                f"{friction_h['code']} · {friction_h['title']} is dragging the field "
                f"({fr:.2f}): {friction_h['low_state']}."
            )
        else:
            friction_text = (
                f"{friction_h['code']} · {friction_h['title']} is the least balanced trine — "
                f"{friction_h['low_state']}."
            )
        next_text = (
            f"Tighten coherence between {core_h['code']} and {value_h['code']} "
            f"before pushing {origin_h['code']} · {origin_h['title']} forward."
        )
    else:  # questioning
        core_text = (
            f"{core_h['code']} · {core_h['title']} — {core_h['guiding_question']} "
            f"(only the most stable of an unstable field; variance {pv:.3f})."
        )
        value_text = (
            f"{value_h['code']} · {value_h['title']}: amplitude {at:.2f} dominates but "
            f"is not yet centred. {value_h['guiding_question']}"
        )
        friction_text = (
            f"{friction_h['code']} · {friction_h['title']}: {friction_h['low_state']}, "
            "still unresolved."
        )
        next_text = (
            f"Clarify {origin_h['code']} · {origin_h['title']} first. "
            f"{origin_h['guiding_question']}"
        )

    return {
        "core":      core_text,
        "value":     value_text,
        "friction":  friction_text,
        "next_step": next_text,
        "tone":      tone,
        "house_indices": {
            "core":      core_h["index"],
            "value":     value_h["index"],
            "friction":  friction_h["index"],
            "next_step": origin_h["index"],
        },
        "incoherence": round(incoh, 3),
        "origin_sign": origin_sign,
        "trace": {
            "core_idx":               core_idx,
            "value_idx":              value_idx,
            "friction_idx":           friction_idx,
            "origin_sign":            origin_sign,
            "origin_drive":           round(origin_drive, 3),
            "sing_index":             round(sing, 3),
            "R_layer":                [round(r, 3) for r in R_layer],
            "phase_var":              [round(v, 3) for v in phase_var],
            "amp_total":              [round(v, 3) for v in amp_total],
            "friction_per_house":     [round(v, 3) for v in friction_per_house],
            "aspect_signal_per_house":[round(v, 3) for v in aspect_signal_per_house],
            "tone_threshold":         {"clear": SING_CLEAR, "guided": SING_GUIDED, "incomplete": SING_INCOMPLETE},
        },
    }


# ════════════════════════════════════════════════════════════════
# 6) LAYER 0 CHECK (clarification gate)
# ════════════════════════════════════════════════════════════════
_MIN_INPUT_LEN = 8
_MIN_ALPHA_RATIO = 0.5


def layer0_check(text: str) -> tuple[bool, str]:
    """
    Returns (ok, reason). When ok=False, the caller should respond with the
    reason as a clarification prompt instead of running the LLM.
    """
    if not text:
        return False, "Need a sentence to begin. What wants to emerge?"
    t = text.strip()
    if len(t) < _MIN_INPUT_LEN:
        return False, "Say a little more — what is the intention behind this?"
    alpha = sum(1 for c in t if c.isalpha())
    if (alpha / max(1, len(t))) < _MIN_ALPHA_RATIO:
        return False, "Use words rather than fragments. What are you trying to bring forward?"
    if len(set(t.lower().split())) < 2:
        return False, "One word is too thin. Add the texture around it."
    return True, ""
