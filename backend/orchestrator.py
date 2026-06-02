"""
TENZOR Orchestrator  ·  Single-Pass Resonance Pipeline
========================================================

Strict single-pass execution. One input string in, one [RESONANCE REPORT]
out. Hard 8000 ms timeout enforced at the orchestrator boundary.

Pipeline (declarative, executed once):
  ingest        -> accept { "input": "..." }
  layer0        -> input validity gate
  probe         -> Gemini Flash, 8 operators, JSON only
  aspect_matrix -> deterministic Python (clamps applied)
  sing_index    -> (R0*R1*R2)^(1/3) * T_inter * C_E
  vector_4d     -> [cos t, sin t, -sin t, cos t]  from arg(Z1) post-modulation
  hamiltonian   -> H = 0.5  (rotation invariant of the unit Troika vector)
  resonant_field-> deterministic state -> single tag line
  synthesize    -> render [RESONANCE REPORT] template (insight + action in German)

Inviolable rules:
  * no loops, no self-correction, no retries
  * no LLM call in the passthrough / synthesis steps
  * physics equations / clamping NEVER modified
  * fail-safe defaults on any timeout / exception:
      coherence score = 0.00 ,  factor = INSUFFICIENT_DATA
"""

from __future__ import annotations

import asyncio
import json
import math
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Tuple

# Re-use the existing Coherence Engine primitives.
try:
    from agent_bus import get_bus as _get_bus, MessageType as _MessageType
    from agent_core import get_registry as _get_registry
    _get_registry()  # wire all 8 agents to the bus at import time
except ImportError:
    _get_bus = None
    _get_registry = None
    _MessageType = None  # graceful degradation if cycle_engine unavailable

from aspects import (
    ASPECT_OPERATORS,
    _compute_sing_index,
    apply_aspect_matrix_py,
    layer0_check,
    probe_to_aspects,
)

# Total wall-clock budget for the whole pipeline. Hard ceiling.
TENZOR_TIMEOUT_MS: int = 8000
PROBE_BUDGET_MS:   int = 5500   # internal probe ceiling; leaves ~2.5s buffer

# ─── Field-state thresholds (sing-index bands) ───────────────────
S_COLD       = 0.30
S_DRIFT      = 0.60
S_SINGING    = 0.85
S_NULLSTELLE = 0.95

_CFG_DIR     = Path(__file__).parent / "config"
_FLOWS_PATH  = _CFG_DIR / "flows.json"
_AGENTS_PATH = _CFG_DIR / "agents.json"
_PROMPT_PATH = _CFG_DIR / "tenzor_orchestrator.txt"


# ════════════════════════════════════════════════════════════════
# Field-state classification + Resonant-Agent passthrough tag
# ════════════════════════════════════════════════════════════════
def _state_tag(sing: float) -> Tuple[str, str]:
    """Return (state, agent_feedback_line) for a given SING INDEX."""
    if sing >= S_NULLSTELLE:
        return "NULLSTELLE", "WARM (Troika silent · resonance lock)"
    if sing >= S_SINGING:
        return "SINGING",    "WARM (Troika locked · singing)"
    if sing >= S_DRIFT:
        return "WARM",       "WARM (Troika aligned)"
    if sing >= S_COLD:
        return "DRIFT",      "COLD (Troika partial · drift)"
    return "COLD",           "COLD (Troika scattered)"


def _primary_factor(scores: list[float]) -> str:
    """The single operator with largest deviation from neutral 0.5."""
    try:
        best_i = max(range(8), key=lambda i: abs(float(scores[i]) - 0.5))
        return ASPECT_OPERATORS[best_i]["name"].upper()
    except Exception:
        return "INSUFFICIENT_DATA"


# ════════════════════════════════════════════════════════════════
# Vector-4D — [cos t, sin t, -sin t, cos t]   from arg(Z1) post-aspect
# ════════════════════════════════════════════════════════════════
N_HOUSES = 8
N_LAYERS = 3


def _arg_z1(q: list[float]) -> float:
    """Phase angle of the modulation-layer Kuramoto order parameter Z_1."""
    sx = 0.0
    sy = 0.0
    base = N_HOUSES * 1  # layer 1 offset in layer-major (l*8 + h) convention
    for h in range(N_HOUSES):
        a = q[base + h]
        sx += math.cos(a)
        sy += math.sin(a)
    return math.atan2(sy, sx)


def _vector_4d(theta: float) -> list[float]:
    """Construct the Troika rotor vector. Analytic norm^2 = 2 (always)."""
    return [math.cos(theta), math.sin(theta), -math.sin(theta), math.cos(theta)]


def _energy_level(v: list[float]) -> float:
    """
    Kinetic energy of the rotor in canonical form.
    For a valid Troika vector  [cos t, sin t, -sin t, cos t] :
        E = 0.5 * (dx^2 + dy^2) = 0.5 * (sin^2 t + cos^2 t) = 0.5
    For INSUFFICIENT_DATA we use v = [0,0,0,0]  -> E = 0.00 ; degrade gracefully.
    """
    return 0.5 * (v[2] * v[2] + v[3] * v[3])


# ════════════════════════════════════════════════════════════════
# Canonical baseline state — coherent trine, all amplitudes = sqrt(25/8)
# ════════════════════════════════════════════════════════════════
def _canonical_baseline() -> tuple[list[float], list[float], list[float]]:
    DEFAULT_A = math.sqrt(25.0 / 8.0)
    p = [0.0] * 24
    A = [DEFAULT_A] * 24
    q: list[float] = []
    for l in range(N_LAYERS):
        for _h in range(N_HOUSES):
            q.append(math.pi / 2 + l * (2 * math.pi / 3))
    return q, p, A


# ════════════════════════════════════════════════════════════════
# Deterministic [INSIGHT] / [ACTION] templates — bilingual DE / EN
# ════════════════════════════════════════════════════════════════
_FACTOR_DE: dict[str, str] = {
    "ANALYTICAL_COLDNESS":     "analytische Kälte",
    "EVIDENTIAL_DENSITY":      "evidenzielle Dichte",
    "RELATIONAL_WARMTH":       "relationale Wärme",
    "GROUNDEDNESS":            "Erdung",
    "STRUCTURAL_COMPLETENESS": "strukturelle Vollständigkeit",
    "TRANSFORMATIVE_TENSION":  "transformative Spannung",
    "SEMANTIC_DEPTH":          "semantische Tiefe",
    "SOCIAL_CALIBRATION":      "soziale Kalibrierung",
    "INSUFFICIENT_DATA":       "fehlende Daten",
}

_FACTOR_EN: dict[str, str] = {
    "ANALYTICAL_COLDNESS":     "analytical coldness",
    "EVIDENTIAL_DENSITY":      "evidential density",
    "RELATIONAL_WARMTH":       "relational warmth",
    "GROUNDEDNESS":            "groundedness",
    "STRUCTURAL_COMPLETENESS": "structural completeness",
    "TRANSFORMATIVE_TENSION":  "transformative tension",
    "SEMANTIC_DEPTH":          "semantic depth",
    "SOCIAL_CALIBRATION":      "social calibration",
    "INSUFFICIENT_DATA":       "insufficient data",
}


def _factor_text(factor: str, lang: str) -> str:
    table = _FACTOR_EN if lang == "en" else _FACTOR_DE
    return table.get(factor, factor.lower())


def _insight(state: str, factor: str, lang: str = "de") -> str:
    f = _factor_text(factor, lang)
    if lang == "en":
        if state == "NULLSTELLE":
            return (
                f"The field rests in the zero-point — all three layers are "
                f"phase-synchronous; {f} dominates without drift."
            )
        if state == "SINGING":
            return (
                f"The Troika is singing — ground, modulation and fascia are "
                f"locked into a trine phase; {f} carries the axis."
            )
        if state == "WARM":
            return (
                f"The Troika is aligned but not yet sealed; "
                f"{f} shapes the coherence, though the form is still open."
            )
        if state == "DRIFT":
            return (
                f"The field is drifting — layer phases are out of full trine; "
                f"{f} is acting as a destabiliser."
            )
        if state == "COLD":
            return (
                f"The field is scattered — no coherent axis has formed; "
                f"{f} remains isolated."
            )
        return (
            "Input too thin for a resonance reading — the Layer-0 filter "
            "did not let it through."
        )

    # default: German
    if state == "NULLSTELLE":
        return (
            f"Das Feld ruht in der Nullstelle — alle drei Schichten sind "
            f"phasensynchron; {f} dominiert ohne Drift."
        )
    if state == "SINGING":
        return (
            f"Die Troika singt — Ground, Modulation und Faszien sind in "
            f"Trine-Phase verschränkt; {f} trägt die Achse."
        )
    if state == "WARM":
        return (
            f"Die Troika ist ausgerichtet, aber noch nicht versiegelt; "
            f"{f} prägt die Kohärenz, doch die Form ist nicht geschlossen."
        )
    if state == "DRIFT":
        return (
            f"Das Feld driftet — die Layer-Phasen sind nicht in voller Trine; "
            f"{f} wirkt destabilisierend."
        )
    if state == "COLD":
        return (
            f"Das Feld ist verstreut — keine kohärente Achse hat sich gebildet; "
            f"{f} bleibt isoliert."
        )
    return (
        "Eingabe zu dünn für eine Resonanzmessung — der Layer-0-Filter "
        "hat sie nicht durchgelassen."
    )


def _action(state: str, factor: str, lang: str = "de") -> str:
    f = _factor_text(factor, lang)
    if lang == "en":
        if state == "NULLSTELLE":
            return "Hold the state · archive the snapshot before sending a new intention."
        if state == "SINGING":
            return f"Deepen the intention around {f} or save the singing snapshot."
        if state == "WARM":
            return f"Sharpen {f} with a more precise second formulation."
        if state == "DRIFT":
            return f"Concentrate the intention around {f} before tuning again."
        if state == "COLD":
            return "Start with a single, embodied statement — what is moving in you right now?"
        return "Write a complete sentence with a clear intention (≥ 8 chars, ≥ 2 words)."

    # default: German
    if state == "NULLSTELLE":
        return "Halte den Zustand · archiviere den Snapshot, bevor du eine neue Intention sendest."
    if state == "SINGING":
        return f"Vertiefe die Intention um {f} herum oder speichere den Singing-Snapshot."
    if state == "WARM":
        return f"Verschärfe {f} durch eine präzisere zweite Formulierung."
    if state == "DRIFT":
        return f"Konzentriere die Intention um {f}, bevor du erneut stimmst."
    if state == "COLD":
        return "Beginne mit einer einzelnen, körpernahen Aussage — was bewegt sich jetzt?"
    return "Schreibe einen vollständigen Satz mit klarer Intention (≥ 8 Zeichen, ≥ 2 Wörter)."


# Backwards-compatible aliases (used internally)
def _insight_de(state: str, factor: str) -> str:
    return _insight(state, factor, "de")


# ════════════════════════════════════════════════════════════════
# Layer-1 Mirror — plain human language, no technical terms
#   Maps (state, factor) → 2-3 German sentences the user actually feels.
#   Deterministic, zero LLM calls.
# ════════════════════════════════════════════════════════════════
_FACTOR_HUMAN_DE: dict[str, str] = {
    "ANALYTICAL_COLDNESS":     "Klarheit und Orientierung",
    "EVIDENTIAL_DENSITY":      "das Bedürfnis nach Belegen und Sicherheit",
    "RELATIONAL_WARMTH":       "Verbindung und Nähe zu anderen",
    "GROUNDEDNESS":            "Stabilität und Halt",
    "STRUCTURAL_COMPLETENESS": "der Wunsch, etwas zu Ende zu bringen",
    "TRANSFORMATIVE_TENSION":  "eine Spannung, die sich verändern will",
    "SEMANTIC_DEPTH":          "ein tieferes Muster, das sichtbar wird",
    "SOCIAL_CALIBRATION":      "die Frage, wie du auf andere wirkst",
    "INSUFFICIENT_DATA":       "",
}

_COHERENCE_LINE_DE: dict[str, str] = {
    "NULLSTELLE": "Dein Zustand ist vollständig klar und in sich ruhend.",
    "SINGING":    "Dein Zustand ist klar und gebündelt — alles zieht in eine Richtung.",
    "WARM":       "Dein Zustand hat eine erkennbare Richtung, ist aber noch nicht ganz geschlossen.",
    "DRIFT":      "Es ist Bewegung da, aber noch keine klare Linie.",
    "COLD":       "Deine Gedanken streuen gerade in verschiedene Richtungen — viel Bewegung, wenig Mitte.",
    "INSUFFICIENT_DATA": "Zu wenig, um etwas zu erkennen — schreib ruhig mehr.",
}

_GROUNDING_LINE_DE: dict[str, str] = {
    "DRIFT": "Das ist keine Schwäche — es ist eine Phase des Suchens.",
    "COLD":  "Das ist kein Fehler, sondern ein Zeichen dass gerade viel in dir arbeitet.",
}


def _mirror_layer1(state: str, factor: str) -> str:
    """
    Returns 2-3 plain German sentences for the Layer-1 (Spiegel) view.
    No scores, no field names, no technical language.
    """
    coherence_line = _COHERENCE_LINE_DE.get(state, "")
    factor_theme   = _FACTOR_HUMAN_DE.get(factor, "")
    grounding      = _GROUNDING_LINE_DE.get(state, "")

    parts = [coherence_line]
    if factor_theme:
        parts.append(f"Die meiste Energie liegt gerade bei: {factor_theme}.")
    if grounding:
        parts.append(grounding)

    return " ".join(p for p in parts if p)


def _action_de(state: str, factor: str) -> str:
    return _action(state, factor, "de")


# ════════════════════════════════════════════════════════════════
# Template renderer — strict, deterministic, no markdown wrappers
# ════════════════════════════════════════════════════════════════
def _fmt(x: float, n: int = 4) -> str:
    """Format with sign-stable fixed decimals (handles -0.0 cleanly)."""
    if x == 0:
        x = 0.0
    return f"{x:.{n}f}"


def _render_report(
    *,
    v: list[float],
    sing: float,
    energy: float,
    agent_feedback: str,
    insight_de: str,
    action_de: str,
) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    iv = f"[{_fmt(v[0],4)}, {_fmt(v[1],4)}, {_fmt(v[2],4)}, {_fmt(v[3],4)}]"
    lines = [
        "[RESONANCE REPORT]",
        f"Timestamp: {ts}",
        f"Input Vector: {iv}",
        f"Coherence Score: {_fmt(sing, 2)}",
        f"Energy Level: {_fmt(energy, 2)} (Target: 0.5)",
        f"Agent Feedback: {agent_feedback}",
        "",
        "[INSIGHT]",
        insight_de,
        "",
        "[ACTION]",
        action_de,
    ]
    return "\n".join(lines)


def _insufficient_report(lang: str = "de") -> str:
    """Fail-safe report. Vector collapses to [0,0,0,0]; energy degrades to 0.00."""
    v = [0.0, 0.0, 0.0, 0.0]
    return _render_report(
        v=v,
        sing=0.0,
        energy=0.0,
        agent_feedback="INSUFFICIENT_DATA",
        insight_de=_insight("INSUFFICIENT_DATA", "INSUFFICIENT_DATA", lang),
        action_de=_action("INSUFFICIENT_DATA", "INSUFFICIENT_DATA", lang),
    )


# ════════════════════════════════════════════════════════════════
# Pipeline core
# ════════════════════════════════════════════════════════════════
async def _run_probe(text: str, *, emergent_key: str, deadline_s: float) -> Optional[dict]:
    """
    Single Gemini Flash call wrapped in asyncio.wait_for(deadline_s).
    Returns probe-payload dict or None on any failure / timeout.
    emergent_key parameter kept for signature compatibility but unused.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return None

    prompt_parts = [
        "You are a QUALITATIVE MEASUREMENT OPERATOR — not an answer generator.",
        "You measure 8 dimensions of an input, each on a 0.000–1.000 scale.",
        "Return EXACTLY ONE JSON object with these keys, in this order:",
        "",
    ]
    for op in ASPECT_OPERATORS:
        prompt_parts.append(
            f'  "{op["name"]}": {{"score": float, "marker": str, "vector": int}},'
        )
    prompt_parts += [
        "",
        "score: 0.000–1.000 (three decimals).",
        'marker: one phrase from the input, max 12 words. "" if input too thin.',
        "vector: -1, 0, or +1 (sign of deviation from neutral 0.5).",
        "Return only the JSON object. No prose. No markdown. No code fences.",
    ]
    system_prompt = "\n".join(prompt_parts)

    user_text = (
        f'Input:\n"""\n{text}\n"""\n\n'
        "Return the JSON object measuring all 8 dimensions."
    )

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=system_prompt,
        )

        async def _call() -> str:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, lambda: model.generate_content(user_text)
            )
            return response.text

        raw = await asyncio.wait_for(_call(), timeout=deadline_s)
        if not isinstance(raw, str):
            raw = str(raw)

        # Robust JSON extraction — strip markdown fences if present
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            return None
        data = json.loads(m.group(0))
        if not isinstance(data, dict):
            return None

        scores: list[float] = []
        vectors: list[int] = []
        markers: list[str] = []
        for op in ASPECT_OPERATORS:
            slot = data.get(op["name"])
            if not isinstance(slot, dict):
                scores.append(0.5)
                vectors.append(0)
                markers.append("")
                continue
            try:
                s_val = float(slot.get("score", 0.5))
            except Exception:
                s_val = 0.5
            scores.append(max(0.0, min(1.0, round(s_val, 3))))
            try:
                v_val = int(slot.get("vector", 0))
            except Exception:
                v_val = 0
            vectors.append(v_val if v_val in (-1, 0, 1) else 0)
            markers.append(str(slot.get("marker", ""))[:80])

        return {"scores": scores, "vectors": vectors, "markers": markers}

    except Exception:
        return None


async def tenzor_invoke(
    input_str: str,
    *,
    emergent_key: Optional[str] = None,
    lang: str = "de",
) -> dict:
    """
    Execute one full pipeline pass. `lang` may be "de" (default) or "en"
    and controls the language of the rendered [INSIGHT] / [ACTION] blocks.
    """
    started = time.monotonic()
    s_in = (input_str or "").strip()[:2000]
    lang = "en" if (lang or "de").lower().startswith("en") else "de"

    def _insufficient_payload() -> dict:
        return {
            "report": _insufficient_report(lang),
            "state":  "INSUFFICIENT_DATA",
            "factor": "INSUFFICIENT_DATA",
            "score":  0.0,
            "energy": 0.0,
            "vector_4d": [0.0, 0.0, 0.0, 0.0],
            "agent_feedback": "INSUFFICIENT_DATA",
            "insight":       _insight("INSUFFICIENT_DATA", "INSUFFICIENT_DATA", lang),
            "action":        _action("INSUFFICIENT_DATA", "INSUFFICIENT_DATA", lang),
            "mirror_layer1": _mirror_layer1("INSUFFICIENT_DATA", "INSUFFICIENT_DATA"),
            "lang":          lang,
        }

    async def _pipeline() -> dict:
        # ── Stage 1: layer-0 gate ─────────────────────────────────
        ok, _reason = layer0_check(s_in)
        if not ok:
            return _insufficient_payload()

        # ── Stage 2: probe (Gemini Flash) ──────────────────────────
        budget_left = (TENZOR_TIMEOUT_MS / 1000.0) - (time.monotonic() - started) - 0.5
        probe_deadline = max(0.5, min(PROBE_BUDGET_MS / 1000.0, budget_left))
        # emergent_key kept for backwards-compat; Gemini key comes from env
        probe = await _run_probe(s_in, emergent_key="", deadline_s=probe_deadline)
        if probe is None:
            return _insufficient_payload()

        # ── Stage 3: aspect-matrix on canonical baseline ──────────
        aspects = probe_to_aspects(probe)

        # ── Stage 3b: agent feedback loop (cross-pass correction) ─
        # RESPONSE messages from the previous tenzor pass carry
        # aspect_score_deltas from agents. Apply them as small
        # amplitude corrections before physics computation.
        # This closes the loop: agent perception → delta → state.
        if _get_bus is not None and _MessageType is not None:
            try:
                delta_map: dict = {}
                for msg in _get_bus().get_log(12):
                    if msg.type == _MessageType.RESPONSE:
                        for asp_name, d in msg.content.get(
                            "aspect_score_deltas", {}
                        ).items():
                            delta_map[asp_name] = (
                                delta_map.get(asp_name, 0.0) + d
                            )
                if delta_map:
                    from aspects import _AMPL_GAIN as _AG
                    for asp in aspects:
                        raw_d = delta_map.get(asp.name, 0.0)
                        if abs(raw_d) > 0.005:
                            # clamp per-aspect delta to ±0.15 score units
                            d = max(-0.15, min(0.15, raw_d))
                            # convert score delta → amplitude space
                            amp_delta = d * 2.0 * _AG
                            asp.effects.amplitude = max(
                                -_AG,
                                min(_AG, asp.effects.amplitude + amp_delta),
                            )
            except Exception:
                pass  # never break the pipeline

        q0, p0, A0 = _canonical_baseline()
        q1, _p1, A1 = apply_aspect_matrix_py(q0, p0, A0, aspects)

        # ── Stage 4: SING INDEX on post-modulation state ──────────
        sing, _R_layer, _T_inter, _C_E = _compute_sing_index(q1, A1)
        sing = max(0.0, min(1.0, sing))

        # ── Stage 5: vector-4D from arg(Z1) ───────────────────────
        theta = _arg_z1(q1)
        v = _vector_4d(theta)
        energy = _energy_level(v)

        # ── Stage 5b: Agent Bus routing (non-blocking) ────────────
        bus_events: list[dict] = []
        if _get_bus is not None:
            try:
                msgs = _get_bus().on_state_update(
                    theta=theta, vector_4d=v, sing=sing,
                    scores=probe["scores"],
                )
                bus_events = [m.to_dict() for m in msgs]
            except Exception:
                pass  # bus must never break the pipeline

        # ── Stage 6: deterministic resonant-field passthrough ─────
        state, agent_feedback = _state_tag(sing)
        factor = _primary_factor(probe["scores"])

        # ── Stage 7: synthesize strict template (in chosen lang) ──
        insight = _insight(state, factor, lang)
        action  = _action(state, factor, lang)

        report = _render_report(
            v=v,
            sing=sing,
            energy=energy,
            agent_feedback=agent_feedback,
            insight_de=insight,
            action_de=action,
        )

        return {
            "report":          report,
            "state":           state,
            "factor":          factor,
            "score":           round(sing, 3),
            "energy":          round(energy, 3),
            "vector_4d":       v,
            "agent_feedback":  agent_feedback,
            "insight":         insight,
            "action":          action,
            "mirror_layer1":   _mirror_layer1(state, factor),
            "lang":            lang,
            "llm_scores":      probe["scores"],   # 8 operator scores — persisted for drift analysis
            "llm_vectors":     probe["vectors"],
            "bus_events":      bus_events,        # AgentBus messages fired this pass
        }

    try:
        remaining = TENZOR_TIMEOUT_MS / 1000.0
        result = await asyncio.wait_for(_pipeline(), timeout=remaining)
    except asyncio.TimeoutError:
        result = _insufficient_payload()
    except Exception:
        result = _insufficient_payload()

    result["elapsed_ms"] = int((time.monotonic() - started) * 1000)
    return result


# ════════════════════════════════════════════════════════════════
# Static config readers — exposed for diagnostic GET endpoints
# ════════════════════════════════════════════════════════════════
def load_agents_config() -> dict:
    try:
        return json.loads(_AGENTS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"agents": []}


def load_flows_config() -> dict:
    try:
        return json.loads(_FLOWS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"flows": []}


def load_orchestrator_prompt() -> str:
    try:
        return _PROMPT_PATH.read_text(encoding="utf-8")
    except Exception:
        return ""
_events = [m.to_dict() for m in msgs]
            except Exception:
                pass  # bus must never break the pipeline

        # ── Stage 6: deterministic resonant-field passthrough ─────
        state, agent_feedback = _state_tag(sing)
        factor = _primary_factor(probe["scores"])

        # ── Stage 7: synthesize strict template (in chosen lang) ──
        insight = _insight(state, factor, lang)
        action  = _action(state, factor, lang)

        report = _render_report(
            v=v,
            sing=sing,
            energy=energy,
            agent_feedback=agent_feedback,
            insight_de=insight,
            action_de=action,
        )

        return {
            "report":          report,
            "state":           state,
            "factor":          factor,
            "score":           round(sing, 3),
            "energy":          round(energy, 3),
            "vector_4d":       v,
            "agent_feedback":  agent_feedback,
            "insight":         insight,
            "action":          action,
            "mirror_layer1":   _mirror_layer1(state, factor),
            "lang":            lang,
            "llm_scores":      probe["scores"],
            "llm_vectors":     probe["vectors"],
            "bus_events":      bus_events,
        }

    try:
        remaining = TENZOR_TIMEOUT_MS / 1000.0
        result = await asyncio.wait_for(_pipeline(), timeout=remaining)
    except asyncio.TimeoutError:
        result = _insufficient_payload()
    except Exception:
        result = _insufficient_payload()

    result["elapsed_ms"] = int((time.monotonic() - started) * 1000)
    return result


# ════════════════════════════════════════════════════════════════
# Static config readers — exposed for diagnostic GET endpoints
# ════════════════════════════════════════════════════════════════
def load_agents_config() -> dict:
    try:
        return json.loads(_AGENTS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"agents": []}


def load_flows_config() -> dict:
    try:
        return json.loads(_FLOWS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"flows": []}


def load_orchestrator_prompt() -> str:
    try:
        return _PROMPT_PATH.read_text(encoding="utf-8")
    except Exception:
        return ""
:
        return _PROMPT_PATH.read_text(encoding="utf-8")
    except Exception:
        return ""
