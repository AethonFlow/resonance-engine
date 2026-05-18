"""
THE SPHERE — House Topology (STABLE)

The 8 houses are fixed energetic-functional lifecycle domains.
They are the system's *topology*, not its measurement layer.

Aspects (in aspects.py) are dynamic modulation operators that act on these houses
through the Aspect Matrix — they are NEVER allowed to redefine the houses.

The spatial vectors, antipodal pair structure, and array order are PRESERVED from
the original physics model (no physics rewrite). Only metadata (code, title, core
energy, guiding question, low/high state) is supplied by this module.
"""

from __future__ import annotations

from typing import List, TypedDict


class HouseMeta(TypedDict):
    index: int               # 1..8 (1-based, matches frontend roman / human display)
    array_index: int         # 0..7 (0-based, used by physics arrays)
    code: str                # compass-style symbolic code (NNO, ONO, …)
    title: str               # canonical title (ORIGIN, OFFERING, …)
    core_energy: str         # the energy this house carries
    guiding_question: str    # the question the house asks
    low_state: str           # what dissonance / weakness looks like
    high_state: str          # what coherence / fullness looks like
    vector: List[float]      # spatial unit-vector × radius=5 (antipodal pairs preserved)
    opposite_index: int      # 1-based index of the antipode (sums to 9 for opposite pairs)


HOUSES: List[HouseMeta] = [
    {
        "index": 1, "array_index": 0,
        "code": "NNO", "title": "ORIGIN",
        "core_energy":     "birth of intention, identity, initial direction",
        "guiding_question": "What wants to emerge?",
        "low_state":        "diffuse impulse, unclear identity",
        "high_state":       "clear intention, coherent beginning",
        "vector": [5.0, 0.0, 0.0],
        "opposite_index": 5,
    },
    {
        "index": 2, "array_index": 1,
        "code": "ONO", "title": "OFFERING",
        "core_energy":     "what the system creates and cares about",
        "guiding_question": "What is being formed as substance?",
        "low_state":        "imitation, weak substance",
        "high_state":       "authentic offering, inner commitment",
        "vector": [0.0, 5.0, 0.0],
        "opposite_index": 6,
    },
    {
        "index": 3, "array_index": 2,
        "code": "OSO", "title": "EXPRESSION",
        "core_energy":     "communication, visibility, outward signal",
        "guiding_question": "How does the system speak outward?",
        "low_state":        "noise, unclear message",
        "high_state":       "precise signal, resonant expression",
        "vector": [0.0, 0.0, 5.0],
        "opposite_index": 7,
    },
    {
        "index": 4, "array_index": 3,
        "code": "SSO", "title": "GROUND",
        "core_energy":     "foundation, research, truth-testing",
        "guiding_question": "What principle carries the system?",
        "low_state":        "unstable assumptions",
        "high_state":       "deep insight, verified foundation",
        "vector": [3.5, 3.5, 0.0],
        "opposite_index": 8,
    },
    {
        "index": 5, "array_index": 4,
        "code": "SSW", "title": "EMBODIMENT",
        "core_energy":     "capacity, resources, materialization",
        "guiding_question": "What can be embodied?",
        "low_state":        "overload, weak capacity",
        "high_state":       "grounded resources, available energy",
        "vector": [-5.0, 0.0, 0.0],
        "opposite_index": 1,
    },
    {
        "index": 6, "array_index": 5,
        "code": "WSW", "title": "VALUE",
        "core_energy":     "exchange, usefulness, value flow",
        "guiding_question": "Does the world receive it?",
        "low_state":        "no traction, blocked flow",
        "high_state":       "real value, healthy exchange",
        "vector": [0.0, -5.0, 0.0],
        "opposite_index": 2,
    },
    {
        "index": 7, "array_index": 6,
        "code": "WNW", "title": "FEEDBACK",
        "core_energy":     "observation, measurement, learning",
        "guiding_question": "What does the system learn?",
        "low_state":        "blindness, ignored signals",
        "high_state":       "clear feedback, adaptive intelligence",
        "vector": [0.0, 0.0, -5.0],
        "opposite_index": 3,
    },
    {
        "index": 8, "array_index": 7,
        "code": "NNW", "title": "EVALUATION",
        "core_energy":     "closure, consequence, transition",
        "guiding_question": "What must be released or integrated?",
        "low_state":        "unresolved residue",
        "high_state":       "clean transition, readiness for next cycle",
        "vector": [-3.5, -3.5, 0.0],
        "opposite_index": 4,
    },
]


def house_by_index(idx_1based: int) -> HouseMeta:
    if not (1 <= idx_1based <= 8):
        raise IndexError(f"house index must be in 1..8 (got {idx_1based})")
    return HOUSES[idx_1based - 1]


def house_summaries() -> list[dict]:
    """Lightweight view for /api/houses — no internal array_index leak."""
    return [
        {
            "index":            h["index"],
            "code":             h["code"],
            "title":            h["title"],
            "core_energy":      h["core_energy"],
            "guiding_question": h["guiding_question"],
            "low_state":        h["low_state"],
            "high_state":       h["high_state"],
            "vector":           h["vector"],
            "opposite_index":   h["opposite_index"],
        }
        for h in HOUSES
    ]
