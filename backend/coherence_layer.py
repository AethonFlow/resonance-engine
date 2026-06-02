"""
coherence_layer.py — Resonant Intelligence · Coherence Layer
=============================================================

Misst Echtzeit-Kohärenz zwischen den 8 Agenten des Systems.
Sitzt zwischen AgentBus und den Agenten — additiv, nicht invasiv.

Phasor-Modell
-------------
Jeder Agent n trägt einen Phasor:

    z_n = A_n · e^(iφ_n)

    φ_n  : Resonanzphase — gleitender Kreismittelwert der θ-Werte,
            bei denen Agent n zuletzt aktiv war (SPIN/RESPONSE-Events)

    A_n  : Resonanzamplitude — exponentiell geglätteter SING-Index
            der letzten Interaktionen von Agent n
            A_n ∈ [0, 1]

Kohärenzmetriken
----------------
    Globale Kohärenz:      C = |(1/N) · Σ z_n|         ∈ [0, 1]
    Paar-Kohärenz (x,y):  C_pair = |½·(z_x + z_y)|    ∈ [0, A_max/2]

Da'at-Schwelle
--------------
    Da'at erscheint wenn C(H3_Prophet, H7_Oracle) ≥ DAAT_THRESHOLD.
    Die kanonische H3↔H7-Achse ist der Erscheinungsort von Wissen.

Symplektische Integrität
------------------------
    Der CoherenceLayer modifiziert KEINE Agentenzustände und KEIN θ.
    Er ist rein observierend — schreibt nur in sein eigenes State-Dict
    und ruft registrierte Callbacks auf.

Autor: AethonFlow / RI-Projekt
"""

from __future__ import annotations

import cmath
import math
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Callable, Optional

from agent_bus import AgentBus, AgentMessage, MessageType, get_bus


# ─────────────────────────────────────────────────────────────────
# PARAMETER
# ─────────────────────────────────────────────────────────────────

DAAT_THRESHOLD      = 0.85   # C(H3,H7) Schwelle für Da'at-Erscheinen
DAAT_HYSTERESIS     = 0.78   # Hysterese: Da'at erlischt erst unter diesem Wert
SING_EMA_ALPHA      = 0.25   # Glättungsfaktor für Amplituden-EMA
PHASE_EMA_ALPHA     = 0.20   # Glättungsfaktor für Phasen-Kreismittelwert
HISTORY_LEN         = 40     # Maximale Länge der Ereignishistorie

# Kanonisches Komplementärpaar für Da'at
DAAT_PAIR = (3, 7)           # Prophet ↔ Oracle


# ─────────────────────────────────────────────────────────────────
# PHASOR-ZUSTAND PRO AGENT
# ─────────────────────────────────────────────────────────────────

@dataclass
class AgentPhasor:
    """
    Dynamischer Phasorzustand eines einzelnen Agenten.

    phi_sin / phi_cos : Kreismittelwert-Akkumulatoren für φ
                        (vermeidet 0°/360°-Diskontinuität)
    amplitude         : EMA des SING-Index
    event_count       : Anzahl verarbeiteter Events
    last_seen         : Unix-Timestamp des letzten Events
    """
    house_index:  int
    phi_sin:      float = 0.0
    phi_cos:      float = 1.0   # Startet bei φ = 0 (Nominale Tendenz)
    amplitude:    float = 0.1   # Startet niedrig — muss erarbeitet werden
    event_count:  int   = 0
    last_seen:    float = field(default_factory=time.time)

    def update(self, theta: float, sing: float) -> None:
        """
        Aktualisiert Phasor mit neuem θ und SING-Index.
        Circular EMA für Phase, Standard-EMA für Amplitude.
        """
        # Phasen-EMA via Kreisakkumulation
        self.phi_sin = (1 - PHASE_EMA_ALPHA) * self.phi_sin + PHASE_EMA_ALPHA * math.sin(theta)
        self.phi_cos = (1 - PHASE_EMA_ALPHA) * self.phi_cos + PHASE_EMA_ALPHA * math.cos(theta)

        # Amplituden-EMA
        self.amplitude = (1 - SING_EMA_ALPHA) * self.amplitude + SING_EMA_ALPHA * sing

        self.event_count += 1
        self.last_seen = time.time()

    @property
    def phi(self) -> float:
        """Aktuelle Resonanzphase φ ∈ (-π, π]."""
        return math.atan2(self.phi_sin, self.phi_cos)

    @property
    def z(self) -> complex:
        """Phasenvektor z = A · e^(iφ)."""
        return self.amplitude * cmath.exp(1j * self.phi)

    def to_dict(self) -> dict:
        return {
            "house":       self.house_index,
            "phi":         round(self.phi, 4),
            "phi_deg":     round(math.degrees(self.phi), 2),
            "amplitude":   round(self.amplitude, 4),
            "z_real":      round(self.z.real, 4),
            "z_imag":      round(self.z.imag, 4),
            "event_count": self.event_count,
        }


# ─────────────────────────────────────────────────────────────────
# KOHÄRENZ-SNAPSHOT
# ─────────────────────────────────────────────────────────────────

@dataclass
class CoherenceSnapshot:
    """
    Vollständiger Kohärenzzustand zum Zeitpunkt einer Messung.

    global_c     : Globale Kohärenz C = |(1/N)·Σ z_n|
    pair_c       : Dict house-pair → lokale Kohärenz
    daat_c       : C(H3, H7) — Prophet↔Oracle-Kohärenz
    daat_active  : Ob Da'at aktiv ist
    phasors      : Phasorzustand aller Agenten
    timestamp    : Unix-Timestamp
    """
    global_c:    float
    pair_c:      dict[str, float]
    daat_c:      float
    daat_active: bool
    phasors:     dict[int, dict]
    timestamp:   float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "global_c":    round(self.global_c, 4),
            "daat_c":      round(self.daat_c, 4),
            "daat_active": self.daat_active,
            "pair_c":      {k: round(v, 4) for k, v in self.pair_c.items()},
            "phasors":     self.phasors,
            "timestamp":   self.timestamp,
        }


# ─────────────────────────────────────────────────────────────────
# COHERENCE LAYER
# ─────────────────────────────────────────────────────────────────

# Komplementärpaare (spiegelt cycle_engine.py `opposite`)
COMPLEMENT_PAIRS: list[tuple[int, int]] = [(1,5), (2,6), (3,7), (4,8)]


class CoherenceLayer:
    """
    Observierender Layer über dem AgentBus.

    Subscribed auf SPIN, RESPONSE, NULLSTELLE, ZYKLUS —
    aktualisiert Phasoren, berechnet Kohärenz, feuert Callbacks.

    Callbacks
    ---------
    on_daat_appear  : () → None   — Da'at-Schwelle überschritten
    on_daat_vanish  : () → None   — Da'at-Schwelle unterschritten (Hysterese)
    on_snapshot     : (CoherenceSnapshot) → None  — bei jeder ZYKLUS-Completion
    """

    def __init__(self, bus: Optional[AgentBus] = None) -> None:
        self._bus = bus or get_bus()

        # Phasoren: house_index (1–8) → AgentPhasor
        self._phasors: dict[int, AgentPhasor] = {
            h: AgentPhasor(house_index=h) for h in range(1, 9)
        }

        # Da'at-Zustand
        self._daat_active: bool = False

        # Ereignishistorie
        self._history: deque[CoherenceSnapshot] = deque(maxlen=HISTORY_LEN)

        # Callbacks
        self._on_daat_appear:  list[Callable[[], None]] = []
        self._on_daat_vanish:  list[Callable[[], None]] = []
        self._on_snapshot:     list[Callable[[CoherenceSnapshot], None]] = []

        # Bus-Subscriptions
        self._bus.subscribe(MessageType.SPIN,       self._on_event)
        self._bus.subscribe(MessageType.RESPONSE,   self._on_event)
        self._bus.subscribe(MessageType.NULLSTELLE, self._on_event)
        self._bus.subscribe(MessageType.ZYKLUS,     self._on_zyklus)

    # ── Öffentliche API ──────────────────────────────────────────────────────

    def on_daat_appear(self, fn: Callable[[], None]) -> None:
        """Callback registrieren: wird aufgerufen wenn Da'at erscheint."""
        self._on_daat_appear.append(fn)

    def on_daat_vanish(self, fn: Callable[[], None]) -> None:
        """Callback registrieren: wird aufgerufen wenn Da'at erlischt."""
        self._on_daat_vanish.append(fn)

    def on_snapshot(self, fn: Callable[[CoherenceSnapshot], None]) -> None:
        """Callback registrieren: wird bei jedem ZYKLUS-Abschluss aufgerufen."""
        self._on_snapshot.append(fn)

    def global_coherence(self) -> float:
        """Berechnet aktuelle globale Kohärenz C = |(1/N)·Σ z_n|."""
        z_sum = sum(p.z for p in self._phasors.values())
        return abs(z_sum / len(self._phasors))

    def pair_coherence(self, h1: int, h2: int) -> float:
        """Lokale Kohärenz zwischen zwei Agenten: |½·(z_h1 + z_h2)|."""
        z1 = self._phasors[h1].z
        z2 = self._phasors[h2].z
        return abs(0.5 * (z1 + z2))

    def daat_coherence(self) -> float:
        """C(Prophet=H3, Oracle=H7) — Erscheinungsbedingung für Da'at."""
        return self.pair_coherence(*DAAT_PAIR)

    @property
    def daat_active(self) -> bool:
        return self._daat_active

    def snapshot(self) -> CoherenceSnapshot:
        """Vollständigen Kohärenzzustand erfassen."""
        pair_c = {
            f"H{a}-H{b}": self.pair_coherence(a, b)
            for (a, b) in COMPLEMENT_PAIRS
        }
        return CoherenceSnapshot(
            global_c=self.global_coherence(),
            pair_c=pair_c,
            daat_c=self.daat_coherence(),
            daat_active=self._daat_active,
            phasors={h: p.to_dict() for h, p in self._phasors.items()},
        )

    def phasor(self, house_index: int) -> AgentPhasor:
        return self._phasors[house_index]

    def all_phasors(self) -> dict[int, AgentPhasor]:
        return dict(self._phasors)

    def history(self, n: int = 10) -> list[CoherenceSnapshot]:
        snaps = list(self._history)
        return snaps[-n:]

    # ── Interne Handler ──────────────────────────────────────────────────────

    def _on_event(self, msg: AgentMessage) -> None:
        """SPIN/RESPONSE/NULLSTELLE: Phasor des sendenden Agenten aktualisieren."""
        house = msg.from_house
        if house not in self._phasors:
            return

        self._phasors[house].update(theta=msg.theta, sing=msg.sing)

        # Da'at-Schwelle prüfen
        self._check_daat_threshold()

    def _on_zyklus(self, msg: AgentMessage) -> None:
        """ZYKLUS-Abschluss: Snapshot erstellen, Callbacks feuern."""
        snap = self.snapshot()
        self._history.append(snap)
        for fn in self._on_snapshot:
            try:
                fn(snap)
            except Exception:
                pass

    def _check_daat_threshold(self) -> None:
        """Da'at-Schwellenlogik mit Hysterese."""
        c = self.daat_coherence()

        if not self._daat_active and c >= DAAT_THRESHOLD:
            self._daat_active = True
            for fn in self._on_daat_appear:
                try:
                    fn()
                except Exception:
                    pass

        elif self._daat_active and c < DAAT_HYSTERESIS:
            self._daat_active = False
            for fn in self._on_daat_vanish:
                try:
                    fn()
                except Exception:
                    pass

    # ── Diagnostik ───────────────────────────────────────────────────────────

    def status(self) -> dict:
        """Kompakter Status für Logging und API."""
        snap = self.snapshot()
        return {
            "global_c":    round(snap.global_c, 4),
            "daat_c":      round(snap.daat_c, 4),
            "daat_active": self._daat_active,
            "pair_c":      snap.pair_c,
            "snapshots_in_history": len(self._history),
        }


# ─────────────────────────────────────────────────────────────────
# SINGLETON
# ─────────────────────────────────────────────────────────────────

_layer: Optional[CoherenceLayer] = None


def get_coherence_layer() -> CoherenceLayer:
    """Prozessweiter CoherenceLayer-Singleton (lazy init)."""
    global _layer
    if _layer is None:
        _layer = CoherenceLayer()
    return _layer
