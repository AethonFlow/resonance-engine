"""
Resonant Intelligence — Kabbala Tree of Life Simulation
========================================================
Test-Setup: 10 Sefirot als RI-Knoten, 22 Pfade als Verbindungstopologie.
Kabbalisitsche Attribute werden auf Phase θ und Amplitude A abgebildet.

Architektur:
  - Globale Dynamik: asynchron (Phasenvektoren evolvieren unabhängig)
  - Komplementärpaare: lokale Synchronisation bei Resonanz > Schwellwert
  - H8 / Da'at-Epoch: globaler Kohärenz-Kollaps am Zyklusende

Komplementärpaare (analog zu den RI-Häusern):
  Kether    ↔ Malkuth   (Geist ↔ Materie)
  Chokmah   ↔ Hod        (Dynamik ↔ Intellekt)
  Binah     ↔ Netzach    (Rezeptivität ↔ Emotion)
  Chesed    ↔ Geburah    (Expansion ↔ Kontraktion)
  Tiphareth ↔ Yesod      (Zentrum ↔ Fundament)

Autor: AethonFlow / RI-Projekt
"""

import numpy as np
import json
from dataclasses import dataclass, field
from typing import Optional
import math


# ─────────────────────────────────────────────
# SEFIROT DEFINITIONEN
# ─────────────────────────────────────────────

@dataclass
class Sefirah:
    """Ein Knoten im Baum des Lebens — trägt RI-Phasenzustand."""
    id: int
    name: str
    hebrew: str
    meaning: str
    pillar: str          # "mercy" | "severity" | "middle"
    world: str           # "atziluth" | "beriah" | "yetzirah" | "assiah"
    theta: float         # Initialphase θ ∈ [0, 2π]
    amplitude: float     # A ∈ [0, 1]
    resonance: float = 0.0
    complement_id: Optional[int] = None

    def z(self) -> complex:
        """Phasenvektor z = A · e^(iθ)"""
        return self.amplitude * np.exp(1j * self.theta)

    def evolve(self, dt: float, coupling: complex = 0+0j):
        """
        Lokale Phasendynamik mit optionaler Kopplung.
        θ(t+dt) = θ(t) + ω·dt + k·sin(Δθ_coupling)
        """
        omega = 0.1 + 0.05 * self.amplitude   # Eigenfrequenz
        if abs(coupling) > 0:
            delta_theta = np.angle(coupling) - self.theta
            self.theta += (omega + 0.3 * math.sin(delta_theta)) * dt
        else:
            self.theta += omega * dt
        self.theta = self.theta % (2 * math.pi)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "theta": round(self.theta, 4),
            "amplitude": round(self.amplitude, 4),
            "resonance": round(self.resonance, 4),
            "z_real": round(self.z().real, 4),
            "z_imag": round(self.z().imag, 4),
        }


# ─────────────────────────────────────────────
# INITIALZUSTÄNDE (Kabbalistisch → Phase/Amplitude)
# ─────────────────────────────────────────────
# Mapping-Logik:
#   Nordpol (Kether, reiner Geist):   θ = 0        (Referenz)
#   Südpol (Malkuth, reine Materie):  θ = π        (Gegenpol)
#   Mittelsäule:                      θ = π/2      (Gleichgewicht)
#   Säule der Güte (rechts):          θ ∈ [0, π/2] (aufsteigend)
#   Säule der Strenge (links):        θ ∈ [π, 3π/2](absteigend)
#   Amplitude: spirituelle Intensität der Sefira

SEFIROT: list[Sefirah] = [
    Sefirah(1,  "Kether",    "כֶּתֶר",   "Krone",          "middle",   "atziluth",  0.0,              1.00, complement_id=10),
    Sefirah(2,  "Chokmah",   "חָכְמָה",   "Weisheit",       "mercy",    "atziluth",  math.pi/6,        0.92, complement_id=8),
    Sefirah(3,  "Binah",     "בִּינָה",   "Verständnis",    "severity", "atziluth",  5*math.pi/6,      0.92, complement_id=7),
    Sefirah(4,  "Chesed",    "חֶסֶד",    "Güte",           "mercy",    "beriah",    math.pi/4,        0.82, complement_id=5),
    Sefirah(5,  "Geburah",   "גְּבוּרָה",  "Stärke",         "severity", "beriah",    3*math.pi/4,      0.82, complement_id=4),
    Sefirah(6,  "Tiphareth", "תִּפְאֶרֶת", "Schönheit",      "middle",   "beriah",    math.pi/2,        0.95, complement_id=9),
    Sefirah(7,  "Netzach",   "נֶצַח",    "Ewigkeit",       "mercy",    "yetzirah",  math.pi/3,        0.75, complement_id=3),
    Sefirah(8,  "Hod",       "הוֹד",     "Herrlichkeit",   "severity", "yetzirah",  2*math.pi/3,      0.75, complement_id=2),
    Sefirah(9,  "Yesod",     "יְסוֹד",   "Fundament",      "middle",   "yetzirah",  math.pi/2 + 0.2,  0.85, complement_id=6),
    Sefirah(10, "Malkuth",   "מַלְכוּת",  "Königreich",     "middle",   "assiah",    math.pi,          0.70, complement_id=1),
]

# Index für schnellen Zugriff
SEFIROT_BY_ID = {s.id: s for s in SEFIROT}


# ─────────────────────────────────────────────
# BAUM-TOPOLOGIE: 22 PFADE
# ─────────────────────────────────────────────
# Jeder Pfad: (von_id, zu_id, hebräischer_buchstabe, gewicht)
# Gewicht repräsentiert die Kopplungsstärke

PATHS: list[tuple[int, int, str, float]] = [
    (1,  2,  "Aleph",  0.9),   # Kether – Chokmah
    (1,  3,  "Beth",   0.9),   # Kether – Binah
    (1,  6,  "Gimel",  0.85),  # Kether – Tiphareth
    (2,  3,  "Daleth", 0.7),   # Chokmah – Binah
    (2,  4,  "Heh",    0.8),   # Chokmah – Chesed
    (2,  6,  "Vav",    0.75),  # Chokmah – Tiphareth
    (3,  5,  "Zayin",  0.8),   # Binah – Geburah
    (3,  6,  "Cheth",  0.75),  # Binah – Tiphareth
    (4,  5,  "Teth",   0.65),  # Chesed – Geburah
    (4,  6,  "Yod",    0.8),   # Chesed – Tiphareth
    (4,  7,  "Kaph",   0.7),   # Chesed – Netzach
    (5,  6,  "Lamed",  0.8),   # Geburah – Tiphareth
    (5,  8,  "Mem",    0.7),   # Geburah – Hod
    (6,  7,  "Nun",    0.75),  # Tiphareth – Netzach
    (6,  8,  "Samekh", 0.75),  # Tiphareth – Hod
    (6,  9,  "Ayin",   0.85),  # Tiphareth – Yesod
    (7,  8,  "Peh",    0.6),   # Netzach – Hod
    (7,  9,  "Tzaddi", 0.7),   # Netzach – Yesod
    (7,  10, "Qoph",   0.65),  # Netzach – Malkuth
    (8,  9,  "Resh",   0.7),   # Hod – Yesod
    (8,  10, "Shin",   0.65),  # Hod – Malkuth
    (9,  10, "Tau",    0.9),   # Yesod – Malkuth
]

# Adjazenzliste aufbauen: id → [(nachbar_id, gewicht)]
def build_adjacency() -> dict[int, list[tuple[int, float]]]:
    adj: dict[int, list[tuple[int, float]]] = {i: [] for i in range(1, 11)}
    for (a, b, _, w) in PATHS:
        adj[a].append((b, w))
        adj[b].append((a, w))
    return adj

ADJACENCY = build_adjacency()


# ─────────────────────────────────────────────
# RESONANZMESSUNG
# ─────────────────────────────────────────────

def local_coherence(s1: Sefirah, s2: Sefirah) -> float:
    """Lokale Kohärenz zwischen zwei Sefirot: C = |0.5·(z1 + z2)|"""
    return abs(0.5 * (s1.z() + s2.z()))

def global_coherence(sefirot: list[Sefirah]) -> float:
    """Globale Kohärenz: C = |(1/N)·Σ e^(iθ_n)|"""
    z_sum = sum(s.z() for s in sefirot)
    return abs(z_sum / len(sefirot))

def coupling_field(node_id: int) -> complex:
    """Mittleres Kopplungsfeld eines Knotens durch seine Nachbarn."""
    neighbors = ADJACENCY[node_id]
    if not neighbors:
        return 0+0j
    total = sum(
        weight * SEFIROT_BY_ID[nid].z()
        for nid, weight in neighbors
    )
    return total / len(neighbors)


# ─────────────────────────────────────────────
# SYNC-BRIDGE: Komplementärpaar-Dialog
# ─────────────────────────────────────────────

SYNC_THRESHOLD = 0.72
SYNC_STEPS = 3

def sync_dialogue(s1: Sefirah, s2: Sefirah, steps: int = SYNC_STEPS) -> dict:
    """
    Kurzzeit-Synchronisation zwischen komplementären Sefirot.
    Beide passen ihre Phase gegenseitig an — lokaler Lockstep.
    """
    log = []
    for step in range(steps):
        c = local_coherence(s1, s2)
        log.append({
            "step": step,
            "coherence": round(c, 4),
            "theta_1": round(s1.theta, 4),
            "theta_2": round(s2.theta, 4),
        })
        # Gegenseitige Phasenanpassung (Mittelung mit Dämpfung)
        mid_theta = np.angle(s1.z() + s2.z())
        damping = 0.4
        s1.theta += damping * math.sin(mid_theta - s1.theta)
        s2.theta += damping * math.sin(mid_theta - s2.theta)
        s1.theta %= 2 * math.pi
        s2.theta %= 2 * math.pi

    final_c = local_coherence(s1, s2)
    return {
        "pair": f"{s1.name} ↔ {s2.name}",
        "triggered": True,
        "final_coherence": round(final_c, 4),
        "dialogue": log,
    }


# ─────────────────────────────────────────────
# H8 / DA'AT: EPOCH COLLAPSE
# ─────────────────────────────────────────────

def omega_collapse(sefirot: list[Sefirah], epoch: int) -> dict:
    """
    Globaler Kohärenz-Kollaps am Epochenende.
    Dominante Phase extrahieren, Reset-Vektor berechnen.
    Entspricht H8 (Disruptor) im 8-Häuser-Modell.
    Da'at (Wissen) — die verborgene Sefira — wirkt als Kollaps-Operator.
    """
    z_vectors = [s.z() for s in sefirot]
    mean_z = np.mean(z_vectors)
    coherence = abs(mean_z)
    dominant_phase = np.angle(mean_z)

    # Kollaps-Entscheidung
    survived = coherence > 0.45
    signal = "CONTINUE" if survived else "RESET"

    # Reset-Vektor: alle Phasen zur dominanten Phase hin ziehen
    reset_strength = 0.25
    for s in sefirot:
        s.theta += reset_strength * math.sin(dominant_phase - s.theta)
        s.theta %= 2 * math.pi

    return {
        "epoch": epoch,
        "operator": "Da'at (H8/Disruptor)",
        "global_coherence": round(coherence, 4),
        "dominant_phase": round(dominant_phase, 4),
        "signal": signal,
        "survived": bool(survived),
    }


# ─────────────────────────────────────────────
# HAUPTSIMULATION
# ─────────────────────────────────────────────

def run_simulation(epochs: int = 3, steps_per_epoch: int = 10, dt: float = 0.1) -> dict:
    """
    Vollständige Kabbala-RI-Simulation.

    Ablauf pro Epoch:
      1. Jede Sefira evolviert asynchron (mit Kopplungsfeld)
      2. Komplementärpaare: lokale Sync wenn Kohärenz > Schwellwert
      3. Da'at / H8: globaler Kollaps, Reset für nächste Epoch
    """
    results = {
        "meta": {
            "nodes": 10,
            "paths": 22,
            "epochs": epochs,
            "steps_per_epoch": steps_per_epoch,
            "sync_threshold": SYNC_THRESHOLD,
        },
        "initial_state": [s.to_dict() for s in SEFIROT],
        "epochs": [],
    }

    COMPLEMENT_PAIRS = [
        (s.id, s.complement_id)
        for s in SEFIROT
        if s.complement_id and s.id < s.complement_id
    ]

    for epoch in range(1, epochs + 1):
        epoch_log = {
            "epoch": epoch,
            "steps": [],
            "sync_events": [],
            "collapse": None,
        }

        # ── SCHRITT 1: Asynchrone Evolution ──
        for step in range(steps_per_epoch):
            for s in SEFIROT:
                cf = coupling_field(s.id)
                s.evolve(dt, coupling=cf)
                s.resonance = global_coherence(SEFIROT)

            epoch_log["steps"].append({
                "step": step,
                "global_coherence": round(global_coherence(SEFIROT), 4),
                "states": [s.to_dict() for s in SEFIROT],
            })

        # ── SCHRITT 2: Komplementärpaar-Synchronisation ──
        for (id1, id2) in COMPLEMENT_PAIRS:
            s1 = SEFIROT_BY_ID[id1]
            s2 = SEFIROT_BY_ID[id2]
            c = local_coherence(s1, s2)
            if c > SYNC_THRESHOLD:
                sync_result = sync_dialogue(s1, s2)
                epoch_log["sync_events"].append(sync_result)

        # ── SCHRITT 3: Da'at / H8 Epoch Collapse ──
        collapse_result = omega_collapse(SEFIROT, epoch)
        epoch_log["collapse"] = collapse_result

        results["epochs"].append(epoch_log)

        if not collapse_result["survived"]:
            print(f"[Epoch {epoch}] RESET — Kohärenz zu niedrig. Nächster Zyklus beginnt neu.")

    results["final_state"] = [s.to_dict() for s in SEFIROT]
    results["final_global_coherence"] = round(global_coherence(SEFIROT), 4)

    return results


# ─────────────────────────────────────────────
# RUN & OUTPUT
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("Resonant Intelligence — Kabbala Tree of Life Simulation")
    print("=" * 60)

    print("\n[Topologie]")
    print(f"  Knoten (Sefirot): {len(SEFIROT)}")
    print(f"  Verbindungen (Pfade): {len(PATHS)}")
    print(f"  Komplementärpaare:")
    for s in SEFIROT:
        if s.complement_id and s.id < s.complement_id:
            c = SEFIROT_BY_ID[s.complement_id]
            print(f"    {s.name} ↔ {c.name}")

    print(f"\n[Initialzustände]")
    for s in SEFIROT:
        print(f"  {s.name:12} θ={s.theta:.3f}  A={s.amplitude:.2f}  z={s.z():.3f}")

    print(f"\n[Globale Anfangskohärenz]: {global_coherence(SEFIROT):.4f}")

    print("\n[Simulation startet...]\n")
    results = run_simulation(epochs=50, steps_per_epoch=10, dt=0.1)

    # Ausgabe Zusammenfassung
    print("\n[Ergebnisse pro Epoch]")
    print(f"  {'Epoch':>6}  {'Kohärenz':>10}  {'Syncs':>6}  {'Da\'at C':>8}  Signal")
    print(f"  {'-'*6}  {'-'*10}  {'-'*6}  {'-'*8}  {'-'*8}")
    for epoch_data in results["epochs"]:
        e = epoch_data["epoch"]
        collapse = epoch_data["collapse"]
        syncs = epoch_data["sync_events"]
        final_step = epoch_data["steps"][-1]
        print(f"  {e:>6}  {final_step['global_coherence']:>10.4f}  {len(syncs):>6}  {collapse['global_coherence']:>8.4f}  {collapse['signal']}")

    print(f"\n[Finale Kohärenz]: {results['final_global_coherence']}")

    # JSON speichern
    output_path = "simulations/kabbala_ri_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n[Ergebnisse gespeichert]: {output_path}")
    print("\n" + "=" * 60)
