"""
journal_extractor.py — Resonant Intelligence · Logbuch-Übersetzer
==================================================================

Übersetzt freien Nutzertext (Logbuch/Journal) in mathematische
Knotenzustände (θ_n, A_n) für alle 8 Häuser.

Pipeline:
    raw_text
        → Claude Haiku (single-pass, JSON-only)
        → JournalExtraction (8 × NodeState)
        → Kalibrierungsecho für den Nutzer

Phase-Konvention (Lebenszykluswinkel):
    θ = 0            → Anfangsimpuls / frische Intention
    θ = π/2  (1.57)  → Aufbau / Wachstumsphase
    θ = π    (3.14)  → Höhepunkt / Krise / Wendepunkt
    θ = 3π/2 (4.71)  → Integration / Abschluss / Übergang

Amplitude:
    A ∈ [0.0, 1.0]
    0.0 = Haus nicht erwähnt / energielos
    1.0 = Haus sehr präsent / hohe emotionale Energie

Autor: AethonFlow / RI-Projekt
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from typing import Optional

# House-Metadaten (index 1-basiert, code, title)
_HOUSE_META = [
    {"index": 1, "code": "NNO", "title": "ORIGIN",      "core": "Intention, Identität, Anfang"},
    {"index": 2, "code": "ONO", "title": "OFFERING",    "core": "Substanz, Wert, Schöpfung"},
    {"index": 3, "code": "OSO", "title": "EXPRESSION",  "core": "Kommunikation, Sichtbarkeit"},
    {"index": 4, "code": "SSO", "title": "FOUNDATION",  "core": "Verwurzelung, Struktur, Sicherheit"},
    {"index": 5, "code": "SSW", "title": "REFLECTION",  "core": "Spiegelung, Beziehung, Resonanz"},
    {"index": 6, "code": "WSW", "title": "REFINEMENT",  "core": "Analyse, Optimierung, Präzision"},
    {"index": 7, "code": "WNW", "title": "INSIGHT",     "core": "Daten, Wahrheit, Durchblick"},
    {"index": 8, "code": "NNW", "title": "OMEGA",       "core": "Transformation, Kollaps, Erneuerung"},
]

# Phase-Labels für Haiku-Extraktion (Mnemonic)
_PHASE_ANCHORS = {
    "impulse":     0.0,           # 0    → frischer Anfang
    "building":    math.pi / 2,   # π/2  → Aufbau
    "peak":        math.pi,       # π    → Höhepunkt / Krise
    "integration": 3 * math.pi / 2,  # 3π/2 → Abschluss
}

_PHASE_LABELS = list(_PHASE_ANCHORS.keys())  # [impulse, building, peak, integration]


def _build_extractor_system_prompt() -> str:
    house_lines = "\n".join(
        f'  "house_{h["index"]}": {{"amplitude": float, "phase_label": str, "marker": str, "confidence": float}}'
        for h in _HOUSE_META
    )
    house_desc = "\n".join(
        f'  House {h["index"]} ({h["code"]}) — {h["title"]}: {h["core"]}'
        for h in _HOUSE_META
    )
    return f"""Du bist ein RESONANZ-MESSOPERATOR für das RI-System (Resonant Intelligence).
Deine Aufgabe: Analysiere den Freitext des Nutzers und extrahiere für jedes der 8 Häuser
den energetischen Knotenzustand.

Die 8 Häuser:
{house_desc}

Phasen-Labels (Lebenszyklus):
  "impulse"     → Frischer Anfang, neue Intention, erster Impuls
  "building"    → Aufbau, Wachstum, Umsetzung läuft
  "peak"        → Höhepunkt, Krise, Wendepunkt, Herausforderung
  "integration" → Abschluss, Integration, Übergang, Auflösung

Gib GENAU dieses JSON zurück (keine Prosa, keine Markdown-Fences):
{{
{house_lines}
}}

Regeln:
  amplitude: 0.000–1.000 (3 Dezimalstellen)
    0.0 = Haus nicht erwähnt oder energielos
    1.0 = Haus sehr präsent, viel Emotion/Energie im Text dazu
  phase_label: genau einer von ["impulse", "building", "peak", "integration"]
  marker: prägnantester Satz/Begriff aus dem Text für dieses Haus (max 15 Wörter), "" wenn nicht erwähnt
  confidence: 0.0–1.0 wie sicher du dir bei dieser Messung bist

Wichtig:
  - Wenn ein Haus nicht erwähnt wird: amplitude=0.0, phase_label="impulse", marker="", confidence=0.0
  - Haus 8 (OMEGA) betrifft Transformation, Loslassen, Ende eines Zyklus
  - Haus 7 (INSIGHT) betrifft Daten, Wahrheit, Analyse, Realitätscheck
  - Keine Erfindungen — nur was tatsächlich im Text steht
"""


_EXTRACTOR_SYSTEM = _build_extractor_system_prompt()


# ─────────────────────────────────────────────────────────────────
# Datenmodelle
# ─────────────────────────────────────────────────────────────────

@dataclass
class NodeState:
    """Knotenzustand eines Hauses nach Extraktion."""
    house_index: int          # 1..8
    code:        str
    title:       str
    amplitude:   float        # A_n ∈ [0.0, 1.0]
    theta:       float        # θ_n ∈ [0.0, 2π]
    phase_label: str          # impulse | building | peak | integration
    marker:      str          # Anker-Phrase aus dem Text
    confidence:  float        # 0.0..1.0


@dataclass
class JournalExtraction:
    """Vollständige Extraktion eines Logbuch-Eintrags."""
    raw_text:   str
    nodes:      list[NodeState]    # 8 Knoten, Index 1..8
    echo:       str                # Kalibrierungsecho für den Nutzer
    coherence:  float              # C = |(1/N)·Σ e^(iθ_n)| (gewichtet)
    cycle:      Optional[int]      # Spiralwindung (aus DB)

    def to_db_doc(self, user_id: str, delta_t: float = 1.0) -> dict:
        """Erzeugt das MongoDB-Dokument für diese Extraktion."""
        import uuid
        from datetime import datetime, timezone
        return {
            "id":              str(uuid.uuid4()),
            "user_id":         user_id,
            "created_at":      datetime.now(timezone.utc).isoformat(),
            "delta_t":         delta_t,
            "raw_journal_input": self.raw_text,
            "node_states": [
                {
                    "house_index": n.house_index,
                    "code":        n.code,
                    "title":       n.title,
                    "amplitude":   n.amplitude,
                    "theta":       n.theta,
                    "phase_label": n.phase_label,
                    "marker":      n.marker,
                    "confidence":  n.confidence,
                }
                for n in self.nodes
            ],
            "coherence":   self.coherence,
            "echo":        self.echo,
            "omega_collapse": None,   # wird vom OmegaEngine gesetzt
        }


# ─────────────────────────────────────────────────────────────────
# Parsing-Helpers
# ─────────────────────────────────────────────────────────────────

def _safe_float(x, default: float, lo: float = 0.0, hi: float = 1.0) -> float:
    try:
        v = float(x)
        return max(lo, min(hi, round(v, 3)))
    except Exception:
        return default


def _safe_phase_label(x) -> str:
    if str(x) in _PHASE_LABELS:
        return str(x)
    return "impulse"


def _parse_extractor_response(raw: str, text: str) -> list[NodeState]:
    """Parst die Haiku-Antwort in NodeState-Objekte."""
    nodes: list[NodeState] = []

    try:
        data = json.loads(raw)
    except Exception:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(0))
            except Exception:
                data = {}
        else:
            data = {}

    for h in _HOUSE_META:
        key = f"house_{h['index']}"
        slot = data.get(key, {}) if isinstance(data, dict) else {}
        if not isinstance(slot, dict):
            slot = {}

        phase_label = _safe_phase_label(slot.get("phase_label", "impulse"))
        theta = _PHASE_ANCHORS[phase_label]

        nodes.append(NodeState(
            house_index=h["index"],
            code=h["code"],
            title=h["title"],
            amplitude=_safe_float(slot.get("amplitude", 0.0), 0.0),
            theta=theta,
            phase_label=phase_label,
            marker=str(slot.get("marker", ""))[:100],
            confidence=_safe_float(slot.get("confidence", 0.0), 0.0),
        ))

    return nodes


def _compute_coherence(nodes: list[NodeState]) -> float:
    """Gewichtete globale Kohärenz C = |(1/N)·Σ A_n·e^(iθ_n)|."""
    import cmath
    if not nodes:
        return 0.0
    total_weight = sum(n.amplitude for n in nodes)
    if total_weight < 1e-9:
        return 0.0
    z_sum = sum(n.amplitude * cmath.exp(1j * n.theta) for n in nodes)
    return round(abs(z_sum) / total_weight, 4)


def _build_echo(nodes: list[NodeState], coherence: float) -> str:
    """
    Erzeugt das Kalibrierungsecho:
    Kurze Rückmeldung was das System verstanden hat + Kohärenzwert.
    """
    active = [n for n in nodes if n.amplitude > 0.15]
    active.sort(key=lambda n: n.amplitude, reverse=True)

    if not active:
        return "Das Feld ist noch ruhig — kein Haus trägt starke Energie. Stimmt das?"

    lines = []
    for n in active[:3]:
        phase_de = {
            "impulse":     "startet gerade",
            "building":    "ist im Aufbau",
            "peak":        "ist am Höhepunkt / in der Krise",
            "integration": "schließt sich ab",
        }.get(n.phase_label, "")
        if n.marker:
            lines.append(f"**{n.title}** (H{n.house_index}) {phase_de} — \"{n.marker}\"")
        else:
            lines.append(f"**{n.title}** (H{n.house_index}) {phase_de}")

    silent = [n for n in nodes if n.amplitude < 0.05]
    silent_names = ", ".join(f"H{n.house_index} {n.title}" for n in silent[:3])

    c_label = (
        "stark kohärent"  if coherence >= 0.75 else
        "mäßig kohärent"  if coherence >= 0.45 else
        "wenig kohärent"
    )

    echo = "Ich habe verstanden:\n" + "\n".join(f"• {l}" for l in lines)
    if silent_names:
        echo += f"\n\nStill / nicht erwähnt: {silent_names}"
    echo += f"\n\nFeldkohärenz: **{coherence:.2f}** ({c_label})\n\nStimmt das so?"
    return echo


# ─────────────────────────────────────────────────────────────────
# Hauptfunktion
# ─────────────────────────────────────────────────────────────────

async def extract_journal(
    text: str,
    anthropic_api_key: str,
) -> JournalExtraction:
    """
    Sendet den Logbuch-Text an Claude Haiku und gibt eine
    JournalExtraction mit 8 NodeStates zurück.

    Fehlerfall: Gibt neutrale NodeStates zurück (amplitude=0.0).
    """
    text = text.strip()[:3000]

    raw_response = ""
    if anthropic_api_key:
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=anthropic_api_key)
            message = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=600,
                system=_EXTRACTOR_SYSTEM,
                messages=[{
                    "role": "user",
                    "content": (
                        f'Logbuch-Eintrag:\n"""\n{text}\n"""\n\n'
                        "Gib das JSON mit den 8 Haus-Zuständen zurück."
                    ),
                }],
            )
            raw_response = message.content[0].text if message.content else ""
        except Exception:
            raw_response = ""

    nodes = _parse_extractor_response(raw_response, text)
    coherence = _compute_coherence(nodes)
    echo = _build_echo(nodes, coherence)

    return JournalExtraction(
        raw_text=text,
        nodes=nodes,
        echo=echo,
        coherence=coherence,
        cycle=None,
    )
