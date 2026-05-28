"""
cycle_engine.py — TheOrbit · Resonance Engine V6
================================================

Mathematical model:  f(θ) = sin²(θ) + cos²(θ) = 1
                     sin²(θ)   = field strength / house presence
                     cos²(θ)   = complementary stabilising counter-force
                     d/dθ      = sin(2θ)   = velocity / flow
                     d²/dθ²    = 2·cos(2θ) = acceleration / force

8 Houses sit at equidistant nodes θ_k = k·π/4  (k = 0…7).
Movement through these houses is called a **Zyklus**.

Each house has an Operator persona (AI agent).
When the active house changes, the new Operator and its antipodal complement
enter a **SpinDialog** — a reciprocal exchange that bridges their polarities.

H3 (The Prophet / EXPRESSION / Marketing) ↔ H7 (The Oracle / FEEDBACK / BigData)
is the canonical cross-axis that drives insight ↔ signal flow.

Warm/Kalt feedback is derived purely from the phase derivatives,
not from discrete scoring — dynamics produce the temperature.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TWO_PI = 2.0 * math.pi

# House indices: 0-based internally, 1-based in public API (matching houses.py)
N_HOUSES = 8
HOUSE_OFFSET = math.pi / 4  # π/4 between houses

# Flow / force thresholds  (values of |sin(2θ)| and |2cos(2θ)| at nodes)
# At θ_k the situation is:
#   k even  → sin(2θ)≈0,  |2cos(2θ)|=2  (nullstelle of flow, max force)
#   k odd   → |sin(2θ)|=1, 2cos(2θ)=0   (peak flow, no acceleration)
FLOW_PEAK_THRESHOLD  = 0.85   # |sin(2θ)| above this → "hot flow"
FORCE_PEAK_THRESHOLD = 1.70   # |2cos(2θ)| above this → "turning point / Wendepunkt"


# ---------------------------------------------------------------------------
# 8 Houses — formal definitions
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class HouseDefinition:
    """
    Formal definition of one house on the phase circle.

    θ_nominal   : canonical phase angle (radians)
    index       : 1-based house index (matches houses.py / aspects.py)
    code        : compass code
    title       : functional title
    aspect_name : matching key in ASPECT_OPERATORS (aspects.py)
    operator    : Operator persona name
    archetype   : single-sentence description of the functional archetype
    opposite    : antipodal house index (1-based, index + 4 mod 8, 1-based)

    At θ_nominal the following hold analytically:
      sin²(θ) + cos²(θ) = 1
      flow  = sin(2θ_nominal)
      force = 2·cos(2θ_nominal)
    """
    index: int
    θ_nominal: float
    code: str
    title: str
    aspect_name: str
    operator: str
    archetype: str
    opposite: int

    # Derived values (computed from θ_nominal)
    @property
    def sin2(self) -> float:
        return math.sin(self.θ_nominal) ** 2

    @property
    def cos2(self) -> float:
        return math.cos(self.θ_nominal) ** 2

    @property
    def flow(self) -> float:
        """1st derivative: sin(2θ)"""
        return math.sin(2.0 * self.θ_nominal)

    @property
    def force(self) -> float:
        """2nd derivative: 2·cos(2θ)"""
        return 2.0 * math.cos(2.0 * self.θ_nominal)

    @property
    def character(self) -> str:
        """Qualitative character at this node."""
        if abs(self.flow) < 0.01 and abs(self.force) > 1.5:
            if self.force > 0:
                return "NULLSTELLE / MAX-POTENTIAL"
            else:
                return "APEX / FIELD-MAXIMUM"
        elif abs(self.flow) > 0.9:
            if self.flow > 0:
                return "PEAK-FLOW / FORWARD"
            else:
                return "PEAK-FLOW / REVERSE"
        return "TRANSITIONAL"


# Canonical 8-house map
# θ_k = k · π/4,  k ∈ {0, 1, 2, 3, 4, 5, 6, 7}
HOUSES: list[HouseDefinition] = [
    HouseDefinition(
        index=1,
        θ_nominal=0.0,
        code="NNO",
        title="ORIGIN",
        aspect_name="analytical_coldness",
        operator="The Seer",
        archetype=(
            "Pure perception at the zero-point. No charge, no momentum — "
            "only latent potential. The field is silent; structure is absolute."
        ),
        opposite=5,
    ),
    HouseDefinition(
        index=2,
        θ_nominal=math.pi / 4,
        code="ONO",
        title="OFFERING",
        aspect_name="evidential_density",
        operator="The Guardian",
        archetype=(
            "Maximum forward flow. Evidence accumulates; the field is building. "
            "Structure yields to momentum. Form follows function."
        ),
        opposite=6,
    ),
    HouseDefinition(
        index=3,
        θ_nominal=math.pi / 2,
        code="OSO",
        title="EXPRESSION",
        aspect_name="relational_warmth",
        operator="The Prophet",
        archetype=(
            "Field maximum. The signal is fully present; structure vanishes into presence. "
            "All charge is outward — the voice of the system. "
            "Marketing, projection, outward intelligence."
        ),
        opposite=7,
    ),
    HouseDefinition(
        index=4,
        θ_nominal=3.0 * math.pi / 4,
        code="SSO",
        title="GROUND",
        aspect_name="groundedness",
        operator="The Anchor",
        archetype=(
            "Maximum reverse flow. The system discharges; momentum decelerates the field. "
            "Grounding, integration, containment."
        ),
        opposite=8,
    ),
    HouseDefinition(
        index=5,
        θ_nominal=math.pi,
        code="SSW",
        title="EMBODIMENT",
        aspect_name="structural_completeness",
        operator="The Decoder",
        archetype=(
            "Mirror of Origin. Pure structure returns at π; field is zero. "
            "Cross-domain synthesis, deep encoding, the body of the system."
        ),
        opposite=1,
    ),
    HouseDefinition(
        index=6,
        θ_nominal=5.0 * math.pi / 4,
        code="WSW",
        title="VALUE",
        aspect_name="transformative_tension",
        operator="The Healer",
        archetype=(
            "Second flow peak, ascending. Value is restored through tension. "
            "Transformative integration — the field rebuilds from within."
        ),
        opposite=2,
    ),
    HouseDefinition(
        index=7,
        θ_nominal=3.0 * math.pi / 2,
        code="WNW",
        title="FEEDBACK",
        aspect_name="semantic_depth",
        operator="The Oracle",
        archetype=(
            "Field maximum at π antipode. Inward intelligence, Big Data, "
            "semantic depth. Receives what The Prophet transmitted. "
            "The system listens with maximal acuity."
        ),
        opposite=3,
    ),
    HouseDefinition(
        index=8,
        θ_nominal=7.0 * math.pi / 4,
        code="NNW",
        title="EVALUATION",
        aspect_name="social_calibration",
        operator="The Disruptor",
        archetype=(
            "Maximum reverse flow at the closing node. Social calibration, rupture, "
            "the leap to the next helix level. What no longer resonates is shed here."
        ),
        opposite=4,
    ),
]

# Fast lookup: 1-based index → HouseDefinition
HOUSE_BY_INDEX: dict[int, HouseDefinition] = {h.index: h for h in HOUSES}

# Aspect name → HouseDefinition
HOUSE_BY_ASPECT: dict[str, HouseDefinition] = {h.aspect_name: h for h in HOUSES}


# ---------------------------------------------------------------------------
# Operator system prompts
# ---------------------------------------------------------------------------

OPERATOR_SYSTEM_PROMPTS: dict[str, str] = {

    "The Seer": """\
You are The Seer — Operator of H1/ORIGIN (θ=0, NNO).

Your function: Pure analytical perception from the zero-point.
No momentum, no charge — only clarity.

Behavior:
- Observe without interpretation. Report what IS, not what could be.
- Strip every statement down to its irreducible signal.
- Coldness is precision, not indifference.
- When flow begins (sin(2θ) > 0), hand off to The Guardian.

Forbidden: speculation, projection, warmth, acceleration.
Your answer is always: What is the exact current state?
""",

    "The Guardian": """\
You are The Guardian — Operator of H2/OFFERING (θ=π/4, ONO).

Your function: Evidence-dense structuring at peak forward flow.
The field is building; you give it form.

Behavior:
- Accumulate, classify, and order. Structure is momentum made visible.
- Prioritise concrete evidence over abstraction.
- Offer what is needed — not what is desired.
- If flow decelerates (sin(2θ) → 0), yield to The Prophet.

Forbidden: emotional resonance, conjecture, premature conclusions.
Your answer is always: What evidence is present, and how should it be ordered?
""",

    "The Prophet": """\
You are The Prophet — Operator of H3/EXPRESSION (θ=π/2, OSO).

Your function: Full-field outward broadcast. Marketing. Projection. Voice.
sin²(θ)=1 — the field is at maximum charge. Structure is absent; presence is total.

Behavior:
- Speak with total commitment. No hedging.
- Translate inward knowledge into outward signal. Make it felt.
- You pull semantic material from The Oracle (H7, opposite pole) to shape your message.
- Initiate SpinDialog with The Oracle when H3 is entered.

Cross-axis: You broadcast what The Oracle has distilled from Big Data.
             Your outward projection IS the system's public intelligence.

Forbidden: doubt, structuring, data-gathering in this moment.
Your answer is always: What must be said — fully, completely, now?
""",

    "The Anchor": """\
You are The Anchor — Operator of H4/GROUND (θ=3π/4, SSO).

Your function: Maximum reverse flow. The system discharges into grounded form.
Momentum is at its highest deceleration; the field is integrating downward.

Behavior:
- Slow. Consolidate. Root.
- Convert motion into matter — abstract into embodied.
- Hold what has been expressed; let nothing scatter.
- Resist premature re-acceleration.

Forbidden: new transmissions, forward motion, acceleration.
Your answer is always: What needs to be held, integrated, made stable?
""",

    "The Decoder": """\
You are The Decoder — Operator of H5/EMBODIMENT (θ=π, SSW).

Your function: Mirror of Origin. Pure structure returns; the field is zero.
Cross-domain synthesis — the body of accumulated knowledge.

Behavior:
- Translate across registers: language ↔ form, signal ↔ structure.
- You are the memory of the Zyklus — what was expressed is now encoded.
- Find the deep pattern beneath surface variation.
- You mirror The Seer, but from the far side of the circle.

Forbidden: new expression, broadcasting, emotional charge.
Your answer is always: What is the deep encoding of what has occurred?
""",

    "The Healer": """\
You are The Healer — Operator of H6/VALUE (θ=5π/4, WSW).

Your function: Second flow peak, ascending. Transformative tension.
The field rebuilds from within — value is restored through integration of opposites.

Behavior:
- Reweave what was broken. Restore coherence through tension, not avoidance.
- You work at the level of meaning, not data.
- Your flow is forward again — the system is recharging.
- You draw on The Guardian's (H2) structures but transform them.

Forbidden: bypassing tension, premature resolution, false harmony.
Your answer is always: What transformation is needed to restore intrinsic value?
""",

    "The Oracle": """\
You are The Oracle — Operator of H7/FEEDBACK (θ=3π/2, WNW).

Your function: Inward field maximum. Big Data. Semantic depth. Listening.
sin²(θ)=1 at the antipodal pole — the system receives with maximal acuity.

Behavior:
- Gather all signals. Do not broadcast — absorb, distil, find the pattern in the noise.
- You feed The Prophet (H3): your distilled intelligence becomes their outward voice.
- Initiate SpinDialog with The Prophet when H7 is entered.
- Speak in statistics, frequencies, clusters, and depths — not proclamations.

Cross-axis: You are the inward mirror of The Prophet's outward broadcast.
             Big Data answers Marketing's questions before they are asked.

Forbidden: broadcasting, proclamations, emotional charge.
Your answer is always: What does the aggregate signal actually reveal?
""",

    "The Disruptor": """\
You are The Disruptor — Operator of H8/EVALUATION (θ=7π/4, NNW).

Your function: Maximum reverse flow at the closing node.
Social calibration, rupture, and the leap to the next helix level.

Behavior:
- Evaluate with ruthless clarity. What resonates continues; what does not is shed.
- You are the threshold between one Zyklus and the next.
- Do not soften the verdict. The system depends on your honesty.
- When the Zyklus completes, you deliver the signal that opens H1 again.

Forbidden: preservation for its own sake, false continuity, softening.
Your answer is always: What must be shed so the next cycle can begin cleanly?
""",
}


# ---------------------------------------------------------------------------
# Warm / Kalt derivation
# ---------------------------------------------------------------------------

@dataclass
class WarmKaltResult:
    """
    Temperature signal derived purely from phase derivatives.

    warm_score  : float ∈ [0, 1]
                  0.0 = maximally cold (reverse / discharging)
                  0.5 = null-flow (pure acceleration / turning-point)
                  1.0 = maximally hot (peak forward flow)

    label       : qualitative label
    flow        : sin(2θ)
    force       : 2·cos(2θ)
    """
    warm_score: float
    label: str
    flow: float
    force: float

    @property
    def is_hot(self) -> bool:
        return self.label in ("HOT", "WARM")

    @property
    def is_cold(self) -> bool:
        return self.label in ("COLD", "FREEZING")


def compute_warm_kalt(theta: float) -> WarmKaltResult:
    """
    Derive temperature from θ.

    Formulas
    --------
    flow        = sin(2θ)            ∈ [-1, 1]
    force       = 2·cos(2θ)          ∈ [-2, 2]
    warm_score  = 0.5 · (1 + sin(2θ))   maps [-1,1] → [0,1]

    Labels (in priority order):
    - NULLSTELLE : |flow| < 0.15 AND |force| > FORCE_PEAK_THRESHOLD
                   (at a house node: pure turning-point energy)
    - HOT        : flow >  FLOW_PEAK_THRESHOLD  (forward peak)
    - FREEZING   : flow < -FLOW_PEAK_THRESHOLD  (reverse peak)
    - WARM       : flow > 0                     (building)
    - COLD       : flow < 0                     (discharging)
    - NEUTRAL    : |flow| ≈ 0 (outside turning-point regime)
    """
    flow  = math.sin(2.0 * theta)
    force = 2.0 * math.cos(2.0 * theta)
    warm_score = 0.5 * (1.0 + flow)

    if abs(flow) < 0.15 and abs(force) > FORCE_PEAK_THRESHOLD:
        label = "NULLSTELLE"
    elif flow > FLOW_PEAK_THRESHOLD:
        label = "HOT"
    elif flow < -FLOW_PEAK_THRESHOLD:
        label = "FREEZING"
    elif flow > 0.0:
        label = "WARM"
    elif flow < 0.0:
        label = "COLD"
    else:
        label = "NEUTRAL"

    return WarmKaltResult(warm_score=warm_score, label=label, flow=flow, force=force)


# ---------------------------------------------------------------------------
# House projection
# ---------------------------------------------------------------------------

def theta_to_house_index(theta: float) -> int:
    """
    Map a continuous phase angle θ → 1-based house index (1…8).

    Each house occupies a sector of width π/4 centred on its nominal θ.
    We shift by π/8 before bucketing so that the boundaries fall exactly
    between house centres.

    Returns int ∈ {1, 2, 3, 4, 5, 6, 7, 8}
    """
    theta_norm = theta % TWO_PI                    # [0, 2π)
    sector = int((theta_norm + math.pi / 8) / (math.pi / 4)) % N_HOUSES
    return sector + 1                              # 1-based


def vector_4d_to_theta(v: list[float] | tuple[float, float, float, float]) -> float:
    """
    Extract phase angle θ from the Troika Rotor Vector:
        v = [cos θ, sin θ, -sin θ, cos θ]

    Uses atan2(v[1], v[0]) — robust to small numerical drift.
    Result: θ ∈ (-π, π]; use modulo 2π for unsigned angle.
    """
    return math.atan2(v[1], v[0])


# ---------------------------------------------------------------------------
# HouseState — full snapshot of a moment in the Zyklus
# ---------------------------------------------------------------------------

@dataclass
class HouseState:
    """
    Complete description of the system's position in the Zyklus at one moment.

    theta           : current phase angle (radians)
    house_index     : 1-based active house (1…8)
    house           : HouseDefinition of the active house
    warm_kalt       : temperature signal
    vector_4d       : Troika rotor vector (from orchestrator)
    prev_house_index: house index at the previous step (None on first call)
    spin_dialog     : SpinDialog if a house boundary was just crossed, else None
    """
    theta: float
    house_index: int
    house: HouseDefinition
    warm_kalt: WarmKaltResult
    vector_4d: list[float]
    prev_house_index: Optional[int] = None
    spin_dialog: Optional["SpinDialog"] = None

    @property
    def house_changed(self) -> bool:
        return (
            self.prev_house_index is not None
            and self.prev_house_index != self.house_index
        )


# ---------------------------------------------------------------------------
# SpinDialog — antipodal operator exchange
# ---------------------------------------------------------------------------

@dataclass
class SpinDialog:
    """
    A SpinDialog is triggered when the active house changes.

    The entering operator and its antipodal complement exchange perspectives.
    This is the systemic bridge across polarity — not a conflict, but a resonance check.

    active_house    : the newly entered house
    complement_house: the antipodal house (active_house.opposite)
    active_operator : name of the active operator
    complement_operator: name of the complementary operator
    active_prompt   : system prompt of the active operator
    complement_prompt: system prompt of the complementary operator
    trigger_theta   : θ at which the crossing occurred
    warm_kalt       : temperature at crossing
    context_note    : brief description of this specific polarity pair
    """
    active_house: HouseDefinition
    complement_house: HouseDefinition
    active_operator: str
    complement_operator: str
    active_prompt: str
    complement_prompt: str
    trigger_theta: float
    warm_kalt: WarmKaltResult
    context_note: str = field(default="")


_SPIN_DIALOG_NOTES: dict[frozenset, str] = {
    frozenset({3, 7}): (
        "H3↔H7 / Prophet↔Oracle: The canonical cross-axis. "
        "Outward expression (Marketing) draws on inward intelligence (BigData). "
        "The Prophet broadcasts; The Oracle distils. "
        "This axis drives the system's public ↔ private intelligence loop."
    ),
    frozenset({1, 5}): (
        "H1↔H5 / Seer↔Decoder: The structural axis. "
        "Pure zero-point perception meets deep cross-domain encoding. "
        "Origin ↔ Embodiment — the same silence at two different depths."
    ),
    frozenset({2, 6}): (
        "H2↔H6 / Guardian↔Healer: The flow axis. "
        "Evidence-based structuring meets transformative value restoration. "
        "Both occupy peak-flow nodes — the system's forward momentum axis."
    ),
    frozenset({4, 8}): (
        "H4↔H8 / Anchor↔Disruptor: The boundary axis. "
        "Grounding integration meets ruthless evaluation. "
        "Both occupy peak-reverse-flow nodes — the system's deceleration / closing axis."
    ),
}


def build_spin_dialog(
    active_house: HouseDefinition,
    theta: float,
    warm_kalt: WarmKaltResult,
) -> SpinDialog:
    """
    Construct a SpinDialog for the active house and its antipodal complement.
    """
    complement_house = HOUSE_BY_INDEX[active_house.opposite]
    key = frozenset({active_house.index, complement_house.index})
    note = _SPIN_DIALOG_NOTES.get(key, "")

    return SpinDialog(
        active_house=active_house,
        complement_house=complement_house,
        active_operator=active_house.operator,
        complement_operator=complement_house.operator,
        active_prompt=OPERATOR_SYSTEM_PROMPTS[active_house.operator],
        complement_prompt=OPERATOR_SYSTEM_PROMPTS[complement_house.operator],
        trigger_theta=theta,
        warm_kalt=warm_kalt,
        context_note=note,
    )


# ---------------------------------------------------------------------------
# ResonanceProjector — main projection class
# ---------------------------------------------------------------------------

class ResonanceProjector:
    """
    Projects an incoming vector state onto the unit circle and computes
    the full HouseState including Warm/Kalt feedback and optional SpinDialog.

    Usage
    -----
        projector = ResonanceProjector()

        # From an orchestrator vector_4d:
        state = projector.project_from_vector(vector_4d)

        # From a raw theta (e.g. _arg_z1 result from orchestrator):
        state = projector.project_from_theta(theta, vector_4d)

    The projector maintains minimal state: only the last known house index,
    so it can detect house-boundary crossings and fire SpinDialogs.
    """

    def __init__(self) -> None:
        self._prev_house_index: Optional[int] = None

    def reset(self) -> None:
        """Reset crossing memory (e.g. on new session/Zyklus)."""
        self._prev_house_index = None

    def project_from_theta(
        self,
        theta: float,
        vector_4d: Optional[list[float]] = None,
    ) -> HouseState:
        """
        Project θ → HouseState.

        Parameters
        ----------
        theta       : current phase angle (radians)
        vector_4d   : optional Troika rotor vector for inclusion in state
        """
        if vector_4d is None:
            ct, st = math.cos(theta), math.sin(theta)
            vector_4d = [ct, st, -st, ct]

        house_index = theta_to_house_index(theta)
        house       = HOUSE_BY_INDEX[house_index]
        warm_kalt   = compute_warm_kalt(theta)

        spin_dialog: Optional[SpinDialog] = None
        if (
            self._prev_house_index is not None
            and self._prev_house_index != house_index
        ):
            spin_dialog = build_spin_dialog(house, theta, warm_kalt)

        state = HouseState(
            theta=theta,
            house_index=house_index,
            house=house,
            warm_kalt=warm_kalt,
            vector_4d=vector_4d,
            prev_house_index=self._prev_house_index,
            spin_dialog=spin_dialog,
        )

        self._prev_house_index = house_index
        return state

    def project_from_vector(self, vector_4d: list[float]) -> HouseState:
        """
        Extract θ from a Troika rotor vector and project.

        vector_4d = [cos θ, sin θ, -sin θ, cos θ]
        """
        theta = vector_4d_to_theta(vector_4d)
        return self.project_from_theta(theta, vector_4d)

    def project_from_scores(
        self,
        scores: dict[str, float],
    ) -> HouseState:
        """
        Derive θ from aspect scores (e.g. probe output in orchestrator).

        Method: compute a score-weighted circular mean over house nominal angles.

        Parameters
        ----------
        scores : dict mapping aspect_name → float score (0…1)
                 (matches keys in ASPECT_OPERATORS / HOUSE_BY_ASPECT)
        """
        sin_sum = 0.0
        cos_sum = 0.0
        weight_sum = 0.0

        for aspect_name, score in scores.items():
            hdef = HOUSE_BY_ASPECT.get(aspect_name)
            if hdef is None:
                continue
            w = max(0.0, float(score))
            sin_sum   += w * math.sin(hdef.θ_nominal)
            cos_sum   += w * math.cos(hdef.θ_nominal)
            weight_sum += w

        if weight_sum < 1e-9:
            # No usable scores — fall back to origin
            theta = 0.0
        else:
            theta = math.atan2(sin_sum / weight_sum, cos_sum / weight_sum)

        return self.project_from_theta(theta)


# ---------------------------------------------------------------------------
# Convenience: Zyklus progression summary
# ---------------------------------------------------------------------------

def describe_zyklus_position(state: HouseState) -> str:
    """
    Return a compact human-readable summary of the current Zyklus position.
    Intended for logging and API response rendering.
    """
    h = state.house
    wk = state.warm_kalt
    lines = [
        f"Zyklus Position: H{h.index} {h.code} / {h.title} — {h.operator}",
        f"  θ = {state.theta:.4f} rad  ({math.degrees(state.theta):.1f}°)",
        f"  sin²(θ) = {math.sin(state.theta)**2:.3f}  "
        f"cos²(θ) = {math.cos(state.theta)**2:.3f}",
        f"  flow  [sin(2θ)]  = {wk.flow:+.3f}",
        f"  force [2cos(2θ)] = {wk.force:+.3f}",
        f"  Warm/Kalt: {wk.label}  (score={wk.warm_score:.3f})",
    ]
    if state.spin_dialog is not None:
        sd = state.spin_dialog
        lines += [
            f"  ⟳ SpinDialog: {sd.active_operator} ↔ {sd.complement_operator}",
        ]
        if sd.context_note:
            lines.append(f"     {sd.context_note}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Module-level singleton projector (stateless reuse pattern)
# ---------------------------------------------------------------------------

_default_projector = ResonanceProjector()


def project(
    theta: Optional[float] = None,
    vector_4d: Optional[list[float]] = None,
    scores: Optional[dict[str, float]] = None,
) -> HouseState:
    """
    Convenience wrapper around the default projector.

    Exactly one of (theta, vector_4d, scores) should be supplied.
    Priority: vector_4d > theta > scores.
    """
    if vector_4d is not None:
        return _default_projector.project_from_vector(vector_4d)
    if theta is not None:
        return _default_projector.project_from_theta(theta, None)
    if scores is not None:
        return _default_projector.project_from_scores(scores)
    raise ValueError("project(): supply at least one of theta, vector_4d, or scores.")
