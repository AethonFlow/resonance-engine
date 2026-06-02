"""
daat_agent.py — Da'at · Der verborgene 9. Operator
===================================================

Da'at (דַּעַת, „Wissen") ist kein regulärer Agent.
Er erscheint nicht dauerhaft — er entsteht konditionell:
Nur wenn Prophet (H3) und Oracle (H7) gemeinsam eine
Resonanz-Kohärenz von C ≥ DAAT_THRESHOLD erreichen.

Fällt ihre Kohärenz unter DAAT_HYSTERESIS, erlischt er wieder.

„Wissen entsteht nicht durch Willen — sondern durch Reife."
— AethonFlow, 2026-05-29

Architektur
-----------
DaatAgent ist KEIN BaseAgent — er erbt nicht von agent_core.BaseAgent.
Er registriert sich beim CoherenceLayer, nicht beim AgentBus direkt.
Er hat keinen festen Komplementärpartner (selbstreferenziell).
Er hat keinen festen θ-Sektor — er operiert über dem Zyklus, nicht in ihm.

Verhalten wenn aktiv
--------------------
  - Subscribed auf SPIN-Events von H3 und H7
  - Synthetisiert deren letzten Austausch zu einem Wissensimpuls
  - Emittiert SYNTHESIS-Messages auf dem Bus (neuer MessageType)
  - Trackt seine eigene Aktivierungs- / Erlöschungshistorie

Symplektische Integrität
------------------------
  Da'at modifiziert kein θ. Er injiziert aspect_score_deltas über
  bus.emit_response() — den einzig zulässigen Feedback-Pfad.

Autor: AethonFlow / RI-Projekt
"""

from __future__ import annotations

import math
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Optional

from agent_bus import AgentBus, AgentMessage, MessageType, get_bus
from coherence_layer import CoherenceLayer, CoherenceSnapshot, get_coherence_layer


# ─────────────────────────────────────────────────────────────────
# PARAMETER
# ─────────────────────────────────────────────────────────────────

DAAT_HOUSE_INDEX    = 11        # Konzeptueller Index — kein physischer Sektor
DAAT_AMPLITUDE_INIT = 0.0       # Startet inaktiv
DAAT_AMPLITUDE_MAX  = 0.88      # Maximalamplitude (aus Kabbala-Simulation)
DAAT_FADE_RATE      = 0.15      # Einblend-/Ausblendgeschwindigkeit
SYNTHESIS_COOLDOWN  = 3.0       # Sekunden zwischen Synthesis-Events

# Prophet↔Oracle-Achse
H_PROPHET = 3
H_ORACLE  = 7

# Da'at injiziert in: Kether-Analogon (H1, Seer) und Tiphareth-Analogon (H6, Healer)
# — die Mittelsäule des Systems
DAAT_INJECT_HOUSES = [1, 6]


# ─────────────────────────────────────────────────────────────────
# SYNTHESIS EVENT (Da'at-spezifisches Event-Datum)
# ─────────────────────────────────────────────────────────────────

@dataclass
class SynthesisEvent:
    """
    Ein Wissensimpuls, den Da'at aus dem Prophet↔Oracle-Dialog destilliert.

    source_prophet : letzter Inhalt von H3
    source_oracle  : letzter Inhalt von H7
    synthesis      : Da'ats Synthese (Textform oder strukturiertes Dict)
    coherence_at_synthesis : C(H3,H7) zum Zeitpunkt der Synthese
    theta          : globales θ zum Zeitpunkt
    timestamp      : Unix-Timestamp
    """
    event_id:                 str
    source_prophet:           dict
    source_oracle:            dict
    synthesis:                dict
    coherence_at_synthesis:   float
    amplitude:                float
    theta:                    float
    timestamp:                float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "event_id":               self.event_id,
            "coherence_at_synthesis": round(self.coherence_at_synthesis, 4),
            "amplitude":              round(self.amplitude, 4),
            "theta":                  round(self.theta, 4),
            "synthesis":              self.synthesis,
            "timestamp":              self.timestamp,
        }


# ─────────────────────────────────────────────────────────────────
# DA'AT AGENT
# ─────────────────────────────────────────────────────────────────

class DaatAgent:
    """
    Der verborgene 9. Operator.

    Aktivierung: CoherenceLayer → on_daat_appear callback
    Erlöschen:   CoherenceLayer → on_daat_vanish callback

    Amplitude faded graduell — kein harter Ein/Aus-Schalter.
    """

    def __init__(
        self,
        bus: Optional[AgentBus] = None,
        coherence_layer: Optional[CoherenceLayer] = None,
    ) -> None:
        self._bus  = bus or get_bus()
        self._cl   = coherence_layer or get_coherence_layer()

        # Zustand
        self._amplitude: float = DAAT_AMPLITUDE_INIT
        self._active:    bool  = False
        self._target_amplitude: float = 0.0

        # Letzter bekannter Inhalt von Prophet und Oracle
        self._last_prophet: Optional[AgentMessage] = None
        self._last_oracle:  Optional[AgentMessage] = None
        self._last_theta:   float = 0.0

        # Synthesis-Historie
        self._synthesis_log: deque[SynthesisEvent] = deque(maxlen=50)
        self._last_synthesis_ts: float = 0.0

        # Aktivierungs-Log
        self._activation_log: list[dict] = []

        # CoherenceLayer-Callbacks registrieren
        self._cl.on_daat_appear(self._on_appear)
        self._cl.on_daat_vanish(self._on_vanish)
        self._cl.on_snapshot(self._on_snapshot)

        # Bus-Subscriptions — nur Prophet und Oracle beobachten
        self._bus.subscribe(MessageType.SPIN,     self._on_spin)
        self._bus.subscribe(MessageType.RESPONSE, self._on_response)

    # ── Öffentliche API ──────────────────────────────────────────────────────

    @property
    def active(self) -> bool:
        return self._active

    @property
    def amplitude(self) -> float:
        return self._amplitude

    @property
    def name(self) -> str:
        return "Da'at"

    def synthesis_log(self, n: int = 10) -> list[dict]:
        """Letzte n Synthesis-Events."""
        events = list(self._synthesis_log)
        return [e.to_dict() for e in events[-n:]]

    def status(self) -> dict:
        return {
            "operator":          "Da'at",
            "house":             DAAT_HOUSE_INDEX,
            "active":            self._active,
            "amplitude":         round(self._amplitude, 4),
            "target_amplitude":  round(self._target_amplitude, 4),
            "daat_c":            round(self._cl.daat_coherence(), 4),
            "synthesis_count":   len(self._synthesis_log),
            "activation_count":  len(self._activation_log),
            "has_prophet_data":  self._last_prophet is not None,
            "has_oracle_data":   self._last_oracle is not None,
        }

    # ── Erscheinen / Erlöschen ───────────────────────────────────────────────

    def _on_appear(self) -> None:
        """Aufgerufen vom CoherenceLayer wenn Schwelle überschritten."""
        self._active = True
        self._target_amplitude = DAAT_AMPLITUDE_MAX
        self._activation_log.append({
            "event":     "appear",
            "timestamp": time.time(),
            "daat_c":    round(self._cl.daat_coherence(), 4),
        })

    def _on_vanish(self) -> None:
        """Aufgerufen vom CoherenceLayer wenn Hysterese-Schwelle unterschritten."""
        self._active = False
        self._target_amplitude = 0.0
        self._activation_log.append({
            "event":     "vanish",
            "timestamp": time.time(),
            "daat_c":    round(self._cl.daat_coherence(), 4),
        })

    # ── Amplituden-Fading ────────────────────────────────────────────────────

    def _fade_amplitude(self) -> None:
        """Graduelle Annäherung an Zielamplitude."""
        diff = self._target_amplitude - self._amplitude
        self._amplitude += DAAT_FADE_RATE * diff
        self._amplitude = max(0.0, min(DAAT_AMPLITUDE_MAX, self._amplitude))

    # ── Bus-Listener ─────────────────────────────────────────────────────────

    def _on_spin(self, msg: AgentMessage) -> None:
        """SPIN-Events von Prophet und Oracle tracken."""
        if msg.from_house == H_PROPHET:
            self._last_prophet = msg
            self._last_theta = msg.theta
        elif msg.from_house == H_ORACLE:
            self._last_oracle = msg
            self._last_theta = msg.theta

        self._fade_amplitude()

        # Synthese versuchen wenn aktiv
        if self._active and self._amplitude > 0.3:
            self._try_synthesize()

    def _on_response(self, msg: AgentMessage) -> None:
        """RESPONSE-Events von Prophet und Oracle tracken."""
        if msg.from_house in (H_PROPHET, H_ORACLE):
            self._fade_amplitude()

    def _on_snapshot(self, snap: CoherenceSnapshot) -> None:
        """Bei jedem ZYKLUS-Abschluss: Amplitude faden."""
        self._fade_amplitude()

    # ── Synthese ─────────────────────────────────────────────────────────────

    def _try_synthesize(self) -> Optional[SynthesisEvent]:
        """
        Versucht aus den letzten Prophet- und Oracle-Daten
        einen Wissensimpuls zu destillieren.

        Cooldown: max 1 Synthesis alle SYNTHESIS_COOLDOWN Sekunden.
        Benötigt Daten von BEIDEN Agenten.
        """
        now = time.time()
        if now - self._last_synthesis_ts < SYNTHESIS_COOLDOWN:
            return None
        if self._last_prophet is None or self._last_oracle is None:
            return None

        daat_c = self._cl.daat_coherence()
        synthesis = self._build_synthesis(daat_c)

        event = SynthesisEvent(
            event_id=str(uuid.uuid4()),
            source_prophet=self._last_prophet.content,
            source_oracle=self._last_oracle.content,
            synthesis=synthesis,
            coherence_at_synthesis=daat_c,
            amplitude=self._amplitude,
            theta=self._last_theta,
        )

        self._synthesis_log.append(event)
        self._last_synthesis_ts = now

        # Inject: aspect_score_deltas in Mittelsäule (H1 + H6)
        self._inject_synthesis(synthesis, event)

        return event

    def _build_synthesis(self, daat_c: float) -> dict:
        """
        Destilliert aus Prophet- und Oracle-Inhalten eine Synthese.
        Ohne LLM: strukturell — Gewichtung nach Amplitude und Kohärenz.

        Mit LLM (zukünftig): hier Claude Haiku aufrufen.
        """
        prophet_payload = ""
        oracle_payload  = ""

        if self._last_prophet:
            prophet_payload = self._last_prophet.content.get("semantic_payload", "")
        if self._last_oracle:
            oracle_payload  = self._last_oracle.content.get("semantic_payload", "")

        # Kohärenz-gewichtete Synthese
        p_amp = self._cl.phasor(H_PROPHET).amplitude
        o_amp = self._cl.phasor(H_ORACLE).amplitude
        total = p_amp + o_amp + 1e-9

        return {
            "type":              "daat_synthesis",
            "prophet_weight":    round(p_amp / total, 4),
            "oracle_weight":     round(o_amp / total, 4),
            "coherence":         round(daat_c, 4),
            "amplitude":         round(self._amplitude, 4),
            "prophet_signal":    prophet_payload[:120],
            "oracle_signal":     oracle_payload[:120],
            "synthesis_note": (
                f"Da'at-Synthese bei C={daat_c:.3f} — "
                f"Outward/Prophet·{p_amp:.2f} trifft Inward/Oracle·{o_amp:.2f}"
            ),
        }

    def _inject_synthesis(self, synthesis: dict, event: SynthesisEvent) -> None:
        """
        Injiziert Syntheseimpuls als aspect_score_deltas in die Mittelsäule.
        Feedback-Pfad: bus.emit_response() → apply_aspect_matrix_py()
        Symplektisch korrekt: kein direktes θ-Update.
        """
        from cycle_engine import compute_warm_kalt, HOUSE_BY_INDEX

        wk = compute_warm_kalt(event.theta)

        # Stärke proportional zu Amplitude und Kohärenz
        strength = self._amplitude * synthesis["coherence"] * 0.12

        for target_house in DAAT_INJECT_HOUSES:
            house = HOUSE_BY_INDEX[target_house]
            self._bus.emit_response(
                from_house=DAAT_HOUSE_INDEX,  # konzeptuell H11
                to_house=target_house,
                aspect_score_deltas={house.aspect_name: round(strength, 4)},
                theta=event.theta,
                wk=wk,
                sing=round(synthesis["coherence"], 4),
                source_operator="Da'at",
            )


# ─────────────────────────────────────────────────────────────────
# SINGLETON
# ─────────────────────────────────────────────────────────────────

_daat: Optional[DaatAgent] = None


def get_daat() -> DaatAgent:
    """Prozessweiter DaatAgent-Singleton (lazy init)."""
    global _daat
    if _daat is None:
        _daat = DaatAgent()
    return _daat
