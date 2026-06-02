from dataclasses import dataclass
from math import pi, exp

from core.hamilton import OscillatorState
from core.unit_circle import UnitCircleState


@dataclass
class CoherenceResult:
    energy_diff: float
    phase_diff: float
    score: float


def _phase_from_state(state: OscillatorState) -> float:
    uc = UnitCircleState(state.x, state.p).normalized
    return uc.theta


def coherence(a: OscillatorState, b: OscillatorState) -> CoherenceResult:
    ea = a.energy
    eb = b.energy
    energy_diff = abs(ea - eb)

    theta_a = _phase_from_state(a)
    theta_b = _phase_from_state(b)

    raw_diff = abs(theta_a - theta_b)
    phase_diff = min(raw_diff, 2 * pi - raw_diff)

    alpha = 0.5
    beta = 0.5

    score = exp(-alpha * energy_diff) * exp(-beta * phase_diff)

    return CoherenceResult(
        energy_diff=energy_diff,
        phase_diff=phase_diff,
        score=score,
    )

