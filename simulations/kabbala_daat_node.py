"""
Resonant Intelligence — Da'at als aktiver 11. Knoten
=====================================================
Erweiterung der Kabbala-Simulation:
Da'at wird aus dem Epoch-Operator herausgelöst und als vollwertiger
Netzwerkknoten integriert. Vergleich Attraktor 10-Knoten vs. 11-Knoten.

Da'at (דַּעַת, "Wissen") — die verborgene Sefira:
  - Liegt auf der Mittelsäule zwischen Binah/Chokmah und Tiphareth
  - Hat keine klassische Komplementär-Sefira → selbstreferenziell
  - Koppelt an: Kether (1), Chokmah (2), Binah (3), Chesed (4),
                Geburah (5), Tiphareth (6)
  - Sonderrolle: empfängt globales Kohärenzsignal als Rückkopplung

Autor: AethonFlow / RI-Projekt
"""

import numpy as np
import json
import math
from dataclasses import dataclass
from typing import Optional
from copy import deepcopy


# ─────────────────────────────────────────────
# SEFIRAH KLASSE (identisch zur Basis-Simulation)
# ─────────────────────────────────────────────

@dataclass
class Sefirah:
    id: int
    name: str
    hebrew: str
    meaning: str
    pillar: str
    world: str
    theta: float
    amplitude: float
    resonance: float = 0.0
    complement_id: Optional[int] = None
    is_hidden: bool = False     # Da'at-Flag

    def z(self) -> complex:
        return self.amplitude * np.exp(1j * self.theta)

    def evolve(self, dt: float, coupling: complex = 0+0j,
               global_coherence: float = 0.0):
        """
        Phasendynamik. Da'at erhält zusätzlich globale Kohärenz-Rückkopplung.
        """
        omega = 0.1 + 0.05 * self.amplitude
        if abs(coupling) > 0:
            delta_theta = np.angle(coupling) - self.theta
            self.theta += (omega + 0.3 * math.sin(delta_theta)) * dt
        else:
            self.theta += omega * dt

        # Da'at-Sonderregel: globale Kohärenz zieht seine Phase zur Mitte
        if self.is_hidden and global_coherence > 0:
            # Da'at "hört" den globalen Zustand und reagiert
            coherence_pull = 0.15 * math.sin(math.pi * global_coherence - self.theta)
            self.theta += coherence_pull * dt

        self.theta = self.theta % (2 * math.pi)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "theta": round(self.theta, 4),
            "amplitude": round(self.amplitude, 4),
            "resonance": round(self.resonance, 4),
        }


# ─────────────────────────────────────────────
# TOPOLOGIE: 10 SEFIROT (Basis)
# ─────────────────────────────────────────────

def make_base_sefirot() -> list[Sefirah]:
    return [
        Sefirah(1,  "Kether",    "כֶּתֶר",   "Krone",        "middle",   "atziluth", 0.0,             1.00, complement_id=10),
        Sefirah(2,  "Chokmah",   "חָכְמָה",   "Weisheit",     "mercy",    "atziluth", math.pi/6,       0.92, complement_id=8),
        Sefirah(3,  "Binah",     "בִּינָה",   "Verständnis",  "severity", "atziluth", 5*math.pi/6,     0.92, complement_id=7),
        Sefirah(4,  "Chesed",    "חֶסֶד",    "Güte",         "mercy",    "beriah",   math.pi/4,       0.82, complement_id=5),
        Sefirah(5,  "Geburah",   "גְּבוּרָה",  "Stärke",       "severity", "beriah",   3*math.pi/4,     0.82, complement_id=4),
        Sefirah(6,  "Tiphareth", "תִּפְאֶרֶת", "Schönheit",    "middle",   "beriah",   math.pi/2,       0.95, complement_id=9),
        Sefirah(7,  "Netzach",   "נֶצַח",    "Ewigkeit",     "mercy",    "yetzirah", math.pi/3,       0.75, complement_id=3),
        Sefirah(8,  "Hod",       "הוֹד",     "Herrlichkeit", "severity", "yetzirah", 2*math.pi/3,     0.75, complement_id=2),
        Sefirah(9,  "Yesod",     "יְסוֹד",   "Fundament",    "middle",   "yetzirah", math.pi/2 + 0.2, 0.85, complement_id=6),
        Sefirah(10, "Malkuth",   "מַלְכוּת",  "Königreich",   "middle",   "assiah",   math.pi,         0.70, complement_id=1),
    ]


# ─────────────────────────────────────────────
# DA'AT ALS 11. KNOTEN
# ─────────────────────────────────────────────
# Position: Mittelsäule, zwischen Supernal-Dreieck und Tiphareth
# Phase: π/4 — "zwischen" Kether (0) und Tiphareth (π/2), leicht verschoben
# Amplitude: 0.88 — stark, aber latent (verborgene Sefira)
# Kein Komplement — selbstreferenziell

DAAT = Sefirah(
    id=11, name="Da'at", hebrew="דַּעַת", meaning="Wissen",
    pillar="middle", world="beriah",
    theta=math.pi / 4,
    amplitude=0.88,
    complement_id=None,
    is_hidden=True
)

# Da'at-Pfade: Kether, Chokmah, Binah, Chesed, Geburah, Tiphareth
DAAT_PATHS: list[tuple[int, int, float]] = [
    (11, 1, 0.95),   # Da'at – Kether    (direkter Zugang zur Krone)
    (11, 2, 0.88),   # Da'at – Chokmah
    (11, 3, 0.88),   # Da'at – Binah
    (11, 4, 0.72),   # Da'at – Chesed    (Brücke nach unten)
    (11, 5, 0.72),   # Da'at – Geburah
    (11, 6, 0.85),   # Da'at – Tiphareth (Herzverbindung)
]

# Basis-Pfade (22 Wege)
BASE_PATHS: list[tuple[int, int, float]] = [
    (1,2,0.9),(1,3,0.9),(1,6,0.85),(2,3,0.7),(2,4,0.8),(2,6,0.75),
    (3,5,0.8),(3,6,0.75),(4,5,0.65),(4,6,0.8),(4,7,0.7),(5,6,0.8),
    (5,8,0.7),(6,7,0.75),(6,8,0.75),(6,9,0.85),(7,8,0.6),(7,9,0.7),
    (7,10,0.65),(8,9,0.7),(8,10,0.65),(9,10,0.9),
]


def build_adjacency(paths: list[tuple[int, int, float]],
                    n_nodes: int) -> dict[int, list[tuple[int, float]]]:
    adj: dict[int, list[tuple[int, float]]] = {i: [] for i in range(1, n_nodes + 1)}
    for (a, b, w) in paths:
        adj[a].append((b, w))
        adj[b].append((a, w))
    return adj


# ─────────────────────────────────────────────
# MESSFUNKTIONEN
# ─────────────────────────────────────────────

def local_coherence(s1: Sefirah, s2: Sefirah) -> float:
    return abs(0.5 * (s1.z() + s2.z()))

def global_coherence(sefirot: list[Sefirah]) -> float:
    return abs(sum(s.z() for s in sefirot) / len(sefirot))

def coupling_field(node_id: int, adj: dict, by_id: dict) -> complex:
    neighbors = adj.get(node_id, [])
    if not neighbors:
        return 0+0j
    total = sum(w * by_id[nid].z() for nid, w in neighbors)
    return total / len(neighbors)


# ─────────────────────────────────────────────
# SYNC-BRIDGE
# ─────────────────────────────────────────────

SYNC_THRESHOLD = 0.72
SYNC_STEPS = 3

def sync_dialogue(s1: Sefirah, s2: Sefirah) -> dict:
    log = []
    for step in range(SYNC_STEPS):
        c = local_coherence(s1, s2)
        log.append({"step": step, "coherence": round(c, 4)})
        mid_theta = np.angle(s1.z() + s2.z())
        s1.theta += 0.4 * math.sin(mid_theta - s1.theta)
        s2.theta += 0.4 * math.sin(mid_theta - s2.theta)
        s1.theta %= 2 * math.pi
        s2.theta %= 2 * math.pi
    return {"pair": f"{s1.name} ↔ {s2.name}",
            "final_coherence": round(local_coherence(s1, s2), 4)}


# ─────────────────────────────────────────────
# EPOCH COLLAPSE
# ─────────────────────────────────────────────

def omega_collapse(sefirot: list[Sefirah], epoch: int,
                   daat: Optional[Sefirah] = None) -> dict:
    """
    Wenn Da'at als Knoten aktiv ist, wird sein Phasenvektor
    mit in den Kollaps einbezogen — er ist nicht mehr externer Operator,
    sondern Teil des kollabierten Feldes.
    """
    z_vectors = [s.z() for s in sefirot]
    mean_z = np.mean(z_vectors)
    coherence = abs(mean_z)
    dominant_phase = float(np.angle(mean_z))
    survived = coherence > 0.45
    reset_strength = 0.25
    for s in sefirot:
        s.theta += reset_strength * math.sin(dominant_phase - s.theta)
        s.theta %= 2 * math.pi
    return {
        "epoch": epoch,
        "global_coherence": round(coherence, 4),
        "dominant_phase": round(dominant_phase, 4),
        "signal": "CONTINUE" if survived else "RESET",
        "survived": bool(survived),
        "daat_included": daat is not None,
    }


# ─────────────────────────────────────────────
# SIMULATION (generisch für beide Modi)
# ─────────────────────────────────────────────

def run_simulation(sefirot: list[Sefirah],
                   paths: list[tuple[int, int, float]],
                   epochs: int = 50,
                   steps_per_epoch: int = 10,
                   dt: float = 0.1) -> list[dict]:
    """Gibt pro Epoch: global_coherence, sync_count, collapse_coherence zurück."""
    n = len(sefirot)
    by_id = {s.id: s for s in sefirot}
    adj = build_adjacency(paths, max(by_id.keys()))

    complement_pairs = [
        (s.id, s.complement_id)
        for s in sefirot
        if s.complement_id and s.id < s.complement_id
    ]

    # Da'at identifizieren falls vorhanden
    daat_node = next((s for s in sefirot if s.is_hidden), None)

    epoch_log = []

    for epoch in range(1, epochs + 1):
        gc = global_coherence(sefirot)

        for _ in range(steps_per_epoch):
            for s in sefirot:
                cf = coupling_field(s.id, adj, by_id)
                s.evolve(dt, coupling=cf, global_coherence=gc)
                s.resonance = global_coherence(sefirot)
            gc = global_coherence(sefirot)

        syncs = 0
        for (id1, id2) in complement_pairs:
            s1, s2 = by_id[id1], by_id[id2]
            if local_coherence(s1, s2) > SYNC_THRESHOLD:
                sync_dialogue(s1, s2)
                syncs += 1

        collapse = omega_collapse(sefirot, epoch, daat=daat_node)
        epoch_log.append({
            "epoch": epoch,
            "global_coherence": round(global_coherence(sefirot), 4),
            "syncs": syncs,
            "collapse_coherence": collapse["global_coherence"],
            "signal": collapse["signal"],
        })

    return epoch_log


# ─────────────────────────────────────────────
# VERGLEICHSLAUF
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 65)
    print("Resonant Intelligence — Da'at als 11. Knoten: Vergleichslauf")
    print("=" * 65)

    # ── Lauf A: 10 Knoten (Basis) ──
    sefirot_10 = make_base_sefirot()
    print("\n[Lauf A] 10 Knoten, 22 Pfade (Baseline)")
    log_10 = run_simulation(sefirot_10, BASE_PATHS, epochs=50)

    # ── Lauf B: 11 Knoten mit Da'at ──
    sefirot_11 = make_base_sefirot()
    daat = deepcopy(DAAT)
    sefirot_11.append(daat)
    all_paths = BASE_PATHS + [(a, b, w) for a, b, w in DAAT_PATHS]
    print("[Lauf B] 11 Knoten, 28 Pfade (Da'at aktiv)")
    log_11 = run_simulation(sefirot_11, all_paths, epochs=50)

    # ── Tabellenausgabe ──
    print(f"\n{'Epoch':>6}  {'10-Knoten C':>12}  {'11+Da\'at C':>12}  {'Δ':>8}")
    print(f"  {'─'*6}  {'─'*12}  {'─'*12}  {'─'*8}")
    for i in range(50):
        c10 = log_10[i]["global_coherence"]
        c11 = log_11[i]["global_coherence"]
        delta = c11 - c10
        marker = " ←" if abs(delta) > 0.001 and i < 15 else ""
        print(f"  {i+1:>6}  {c10:>12.4f}  {c11:>12.4f}  {delta:>+8.4f}{marker}")

    final_10 = log_10[-1]["global_coherence"]
    final_11 = log_11[-1]["global_coherence"]
    print(f"\n  Attraktor 10-Knoten:  C = {final_10:.4f}")
    print(f"  Attraktor 11+Da'at:   C = {final_11:.4f}")
    print(f"  Differenz:            ΔC = {final_11 - final_10:+.4f}")

    # Da'at Finalzustand
    daat_final = next(s for s in sefirot_11 if s.is_hidden)
    print(f"\n  Da'at Finalzustand:")
    print(f"    θ = {daat_final.theta:.4f} rad  ({math.degrees(daat_final.theta):.1f}°)")
    print(f"    z = {daat_final.z():.4f}")
    print(f"    A = {daat_final.amplitude:.2f}")

    # JSON speichern
    results = {
        "baseline_10": log_10,
        "daat_11": log_11,
        "attractors": {
            "10_nodes": final_10,
            "11_nodes_with_daat": final_11,
            "delta": round(final_11 - final_10, 4),
        },
        "daat_final_state": daat_final.to_dict(),
    }
    with open("simulations/kabbala_daat_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n  [Ergebnisse gespeichert]: simulations/kabbala_daat_results.json")
    print("=" * 65)
