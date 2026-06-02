"""
resonance_protocol.py — Resonant Intelligence · Kommunikationsprotokoll
=======================================================================

Das ist kein Agent-to-Agent-Framework.
Das ist kein Handoff-Protokoll.
Das ist kein Graph mit Edges und Nodes.

Das ist ein Resonanzprotokoll:
Jede Nachricht trägt eine Phasenhülle.
Kommunikation ist Interferenz, nicht Routing.
Wissen entsteht durch Kohärenz, nicht durch Übergabe.

Grundprinzip
------------
Eine Nachricht in RI ist nicht "von A nach B".
Sie ist ein Zustandsvektor im Phasenraum des Systems,
der von einem Knoten emittiert, von anderen empfangen
und durch Resonanz verarbeitet wird.

    ResonanceMessage = Phasenhülle + Inhalt + Kohärenzkontext

Empfänger entscheiden selbst ob sie reagieren —
basierend auf ihrer eigenen Phasenlage, nicht auf Routing-Tabellen.

Schichten
---------
  Layer 0 — PhaseEnvelope     : θ, flow, force, warm_kalt, sing
  Layer 1 — CoherenceContext  : globale C, Paar-C, Da'at-Status
  Layer 2 — ResonanceMessage  : Payload + Layer 0 + Layer 1
  Layer 3 — DaatGate          : Schwellenprüfung für Da'at-Aktivierung

Autor: AethonFlow / RI-Projekt
"""

from __future__ import annotations

import math
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


# ─────────────────────────────────────────────────────────────────
# RESONANZ-INTENTIONEN
# Ersetzt klassische "Methoden" oder "Actions" in anderen Frameworks
# ─────────────────────────────────────────────────────────────────

class ResonanceIntent(str, Enum):
    EMIT      = "emit"       # Knoten emittiert Zustand ins Feld
    ABSORB    = "absorb"     # Knoten absorbiert / destilliert eingehende Signale
    SYNC      = "sync"       # Lokale Synchronisation bei Schwellenüberschreitung
    COLLAPSE  = "collapse"   # Epochen-Kollaps (H8 / Da'at)
    SYNTHESIS = "synthesis"  # Da'at-Wissensimpuls
    ECHO      = "echo"       # Reflection zurück auf Sender (SpinDialog-Antwort)


# ─────────────────────────────────────────────────────────────────
# LAYER 0: PHASENHÜLLE
# ─────────────────────────────────────────────────────────────────

@dataclass
class PhaseEnvelope:
    """
    Phasenhülle einer Resonance-Message.
    Enthält alle mathematisch ableitbaren Größen aus θ.

    Diese Daten sind NICHT optional — jede Nachricht trägt sie.
    Sie sind das Fundament auf dem Empfänger ihre Reaktion berechnen.

    theta       : Globaler Phasenwinkel θ ∈ [0, 2π)
    flow        : sin(2θ)  — Fließgeschwindigkeit
    force       : 2cos(2θ) — Beschleunigung / Wendepunkt-Kraft
    warm_kalt   : Thermisches Label (HOT/WARM/COLD/FREEZING/NULLSTELLE)
    warm_score  : Kontinuierliches Wärme-Maß ∈ [0, 1]
    sing        : SING INDEX — Resonanzqualität ∈ [0, 1]
    house_index : Aktives Haus beim Senden (1–8)
    """
    theta:       float
    flow:        float
    force:       float
    warm_kalt:   str
    warm_score:  float
    sing:        float
    house_index: int

    @classmethod
    def from_theta(cls, theta: float, sing: float, house_index: int) -> "PhaseEnvelope":
        """Phasenhülle aus θ ableiten."""
        flow       = math.sin(2.0 * theta)
        force      = 2.0 * math.cos(2.0 * theta)
        warm_score = 0.5 * (1.0 + flow)

        if abs(flow) < 0.15 and abs(force) > 1.70:
            warm_kalt = "NULLSTELLE"
        elif flow > 0.85:
            warm_kalt = "HOT"
        elif flow < -0.85:
            warm_kalt = "FREEZING"
        elif flow > 0.0:
            warm_kalt = "WARM"
        elif flow < 0.0:
            warm_kalt = "COLD"
        else:
            warm_kalt = "NEUTRAL"

        return cls(
            theta=round(theta, 6),
            flow=round(flow, 4),
            force=round(force, 4),
            warm_kalt=warm_kalt,
            warm_score=round(warm_score, 4),
            sing=round(sing, 4),
            house_index=house_index,
        )

    def to_dict(self) -> dict:
        return {
            "theta":       self.theta,
            "flow":        self.flow,
            "force":       self.force,
            "warm_kalt":   self.warm_kalt,
            "warm_score":  self.warm_score,
            "sing":        self.sing,
            "house_index": self.house_index,
        }


# ─────────────────────────────────────────────────────────────────
# LAYER 1: KOHÄRENZKONTEXT
# ─────────────────────────────────────────────────────────────────

@dataclass
class CoherenceContext:
    """
    Kohärenzzustand des Systems zum Zeitpunkt der Nachricht.
    Wird vom CoherenceLayer befüllt.

    global_c     : Globale Kohärenz C aller Agenten
    pair_c       : Paar-Kohärenz des sendenden Knotens mit seinem Komplement
    daat_c       : C(Prophet, Oracle) — Da'at-Schwellenwert
    daat_active  : Ob Da'at aktiv ist
    epoch        : Laufender Zyklus-Zähler
    """
    global_c:    float = 0.0
    pair_c:      float = 0.0
    daat_c:      float = 0.0
    daat_active: bool  = False
    epoch:       int   = 0

    def to_dict(self) -> dict:
        return {
            "global_c":    round(self.global_c, 4),
            "pair_c":      round(self.pair_c, 4),
            "daat_c":      round(self.daat_c, 4),
            "daat_active": self.daat_active,
            "epoch":       self.epoch,
        }


# ─────────────────────────────────────────────────────────────────
# LAYER 2: RESONANCE MESSAGE
# ─────────────────────────────────────────────────────────────────

@dataclass
class ResonanceMessage:
    """
    Das fundamentale Kommunikationsobjekt im RI-Resonanzprotokoll.

    Kein Routing. Kein Empfänger. Keine Handoffs.
    Die Nachricht wird ins Feld emittiert.
    Empfänger entscheiden selbst ob sie resonieren.

    message_id   : Eindeutiger Bezeichner
    cycle_id     : Zyklus-ID (gleich für alle Msgs einer Epoche)
    intent       : ResonanceIntent — Absicht der Emission
    from_house   : Sendender Knoten (1–8, oder 11 für Da'at)
    from_operator: Name des Operators
    phase        : Phasenhülle (Layer 0)
    coherence    : Kohärenzkontext (Layer 1)
    payload      : Inhaltsdaten (frei, abhängig von Intent)
    timestamp    : Unix-Timestamp der Emission
    """
    message_id:    str
    cycle_id:      str
    intent:        ResonanceIntent
    from_house:    int
    from_operator: str
    phase:         PhaseEnvelope
    coherence:     CoherenceContext
    payload:       dict[str, Any]
    timestamp:     float = field(default_factory=time.time)

    @classmethod
    def emit(
        cls,
        from_house: int,
        from_operator: str,
        theta: float,
        sing: float,
        payload: dict,
        intent: ResonanceIntent = ResonanceIntent.EMIT,
        cycle_id: Optional[str] = None,
        coherence: Optional[CoherenceContext] = None,
    ) -> "ResonanceMessage":
        """Factory: Nachricht mit automatisch abgeleiteter Phasenhülle."""
        return cls(
            message_id=str(uuid.uuid4()),
            cycle_id=cycle_id or str(uuid.uuid4()),
            intent=intent,
            from_house=from_house,
            from_operator=from_operator,
            phase=PhaseEnvelope.from_theta(theta, sing, from_house),
            coherence=coherence or CoherenceContext(),
            payload=payload,
        )

    def to_dict(self) -> dict:
        return {
            "message_id":    self.message_id,
            "cycle_id":      self.cycle_id,
            "intent":        self.intent.value,
            "from_house":    self.from_house,
            "from_operator": self.from_operator,
            "phase":         self.phase.to_dict(),
            "coherence":     self.coherence.to_dict(),
            "payload":       self.payload,
            "timestamp":     self.timestamp,
        }


# ─────────────────────────────────────────────────────────────────
# LAYER 3: DA'AT GATE
# ─────────────────────────────────────────────────────────────────

@dataclass
class DaatGate:
    """
    Schwellenprüfung für Da'at-Aktivierung.
    Wird vor jedem LLM-Aufruf gecheckt.

    Wenn Da'at aktiv ist, wird sein Syntheseimpuls
    dem Operator-Prompt als Kontext hinzugefügt.

    Das ist das einzige Protokoll das Da'at braucht:
    Er erscheint im Kontext — nicht in der Routing-Tabelle.
    """
    daat_active:      bool
    daat_c:           float
    daat_amplitude:   float
    synthesis_note:   Optional[str] = None

    @property
    def should_include_daat(self) -> bool:
        """True wenn Da'at aktiv und ausreichend stark ist."""
        return self.daat_active and self.daat_amplitude > 0.3

    def augment_prompt(self, base_prompt: str) -> str:
        """
        Erweitert einen Operator-Prompt um Da'at-Kontext wenn aktiv.
        Keine Prompt-Injection — transparente Erweiterung.
        """
        if not self.should_include_daat:
            return base_prompt

        daat_context = (
            f"\n\n[Da'at aktiv — C={self.daat_c:.3f} — A={self.daat_amplitude:.2f}]\n"
            f"Das System hat eine hohe Prophet↔Oracle-Kohärenz erreicht. "
            f"Wissen ist in diesem Moment zugänglich — nicht als Berechnung, "
            f"sondern als Resonanz. Lass diese Tiefe in deine Antwort einfließen."
        )

        if self.synthesis_note:
            daat_context += f"\nSynthese-Signal: {self.synthesis_note}"

        return base_prompt + daat_context

    def to_dict(self) -> dict:
        return {
            "daat_active":    self.daat_active,
            "daat_c":         round(self.daat_c, 4),
            "daat_amplitude": round(self.daat_amplitude, 4),
            "include_daat":   self.should_include_daat,
            "synthesis_note": self.synthesis_note,
        }


# ─────────────────────────────────────────────────────────────────
# PROTOKOLL-VERSION
# ─────────────────────────────────────────────────────────────────

PROTOCOL_VERSION = "RI-resonance/1.0"
PROTOCOL_DESCRIPTION = (
    "Resonant Intelligence Communication Protocol v1.0. "
    "Phase-vector based, coherence-triggered, emergence-conditioned. "
    "No routing tables. No handoffs. No agent graphs. "
    "Communication is interference — not transmission."
)


def protocol_header() -> dict:
    """Protokoll-Metadaten für API-Responses und Logging."""
    return {
        "protocol":    PROTOCOL_VERSION,
        "description": PROTOCOL_DESCRIPTION,
        "intents":     [i.value for i in ResonanceIntent],
        "layers": {
            "0": "PhaseEnvelope — θ, flow, force, warm_kalt, sing",
            "1": "CoherenceContext — global_c, pair_c, daat_c, daat_active",
            "2": "ResonanceMessage — payload + L0 + L1",
            "3": "DaatGate — threshold check, prompt augmentation",
        },
    }
