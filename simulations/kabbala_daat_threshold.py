"""
Resonant Intelligence — Da'at als Schwellenphänomen
====================================================
Da'at erscheint nicht dauerhaft — er entsteht konditionell:
Nur wenn Chokmah (2) und Binah (3) gemeinsam C >= DAAT_THRESHOLD erreichen.
Fällt ihre Kohärenz darunter, erlischt Da'at.

Das erzeugt einen Meta-Rhythmus:
  Chokmah+Binah reifen → Da'at erscheint → Limit-Zyklus beginnt
  → Störung der Paarresonanz → Da'at erlischt → Fixpunkt kehrt zurück
  → Paar findet sich wieder → Da'at erscheint erneut → ...

"Wissen entsteht nicht durch Willen — sondern durch Reife."
— AethonFlow, 2026-05-29

Autor: AethonFlow / RI-Projekt
"""

import numpy as np
import json
import math
from dataclasses import dataclass
from typing import Optional
from copy import deepcopy


# ─────────────────────────────────────────────
# PARAMETER
# ─────────────────────────────────────────────

DAAT_THRESHOLD   = 0.85   # Chokmah-Binah Mindest-Kohärenz für Da'at-Erscheinen
DAAT_FADE_SPEED  = 0.15   # Wie schnell Da'at ein/ausgeblendet wird (pro Step)
SYNC_THRESHOLD   = 0.72   # Komplementärpaar-Synchronisation
SYNC_STEPS       = 3


# ─────────────────────────────────────────────
# SEFIRAH
# ─────────────────────────────────────────────

@dataclass
class Sefirah:
    id: int
    name: str
    pillar: str
    theta: float
    amplitude: float
    target_amplitude: float = 0.0   # Zielamplitude (für Fade)
    resonance: float = 0.0
    complement_id: Optional[int] = None
    is_hidden: bool = False

    def z(self) -> complex:
        return self.amplitude * np.exp(1j * self.theta)

    def evolve(self, dt: float, coupling: complex = 0+0j,
               global_c: float = 0.0):
        if self.amplitude < 0.001:
            return  # Inaktiv — keine Evolution

        omega = 0.1 + 0.05 * self.amplitude
        if abs(coupling) > 0:
            delta = np.angle(coupling) - self.theta
            self.theta += (omega + 0.3 * math.sin(delta)) * dt
        else:
            self.theta += omega * dt

        if self.is_hidden and global_c > 0:
            pull = 0.15 * math.sin(math.pi * global_c - self.theta)
            self.theta += pull * dt

        self.theta %= 2 * math.pi

    def fade(self, dt: float):
        """Amplitude graduell zur Zielamplitude schieben."""
        diff = self.target_amplitude - self.amplitude
        self.amplitude += DAAT_FADE_SPEED * diff * dt
        self.amplitude = max(0.0, min(1.0, self.amplitude))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "theta": round(self.theta, 4),
            "amplitude": round(self.amplitude, 4),
        }


# ─────────────────────────────────────────────
# TOPOLOGIE
# ─────────────────────────────────────────────

def make_sefirot() -> list[Sefirah]:
    return [
        Sefirah(1,  "Kether",    "middle",   0.0,             1.00, target_amplitude=1.00, complement_id=10),
        Sefirah(2,  "Chokmah",   "mercy",    math.pi/6,       0.92, target_amplitude=0.92, complement_id=8),
        Sefirah(3,  "Binah",     "severity", 5*math.pi/6,     0.92, target_amplitude=0.92, complement_id=7),
        Sefirah(4,  "Chesed",    "mercy",    math.pi/4,       0.82, target_amplitude=0.82, complement_id=5),
        Sefirah(5,  "Geburah",   "severity", 3*math.pi/4,     0.82, target_amplitude=0.82, complement_id=4),
        Sefirah(6,  "Tiphareth", "middle",   math.pi/2,       0.95, target_amplitude=0.95, complement_id=9),
        Sefirah(7,  "Netzach",   "mercy",    math.pi/3,       0.75, target_amplitude=0.75, complement_id=3),
        Sefirah(8,  "Hod",       "severity", 2*math.pi/3,     0.75, target_amplitude=0.75, complement_id=2),
        Sefirah(9,  "Yesod",     "middle",   math.pi/2+0.2,   0.85, target_amplitude=0.85, complement_id=6),
        Sefirah(10, "Malkuth",   "middle",   math.pi,         0.70, target_amplitude=0.70, complement_id=1),
        # Da'at — startet inaktiv
        Sefirah(11, "Da'at",     "middle",   math.pi/4,       0.00, target_amplitude=0.00,
                complement_id=None, is_hidden=True),
    ]

BASE_PATHS = [
    (1,2,0.9),(1,3,0.9),(1,6,0.85),(2,3,0.7),(2,4,0.8),(2,6,0.75),
    (3,5,0.8),(3,6,0.75),(4,5,0.65),(4,6,0.8),(4,7,0.7),(5,6,0.8),
    (5,8,0.7),(6,7,0.75),(6,8,0.75),(6,9,0.85),(7,8,0.6),(7,9,0.7),
    (7,10,0.65),(8,9,0.7),(8,10,0.65),(9,10,0.9),
]
DAAT_PATHS = [(11,1,0.95),(11,2,0.88),(11,3,0.88),(11,4,0.72),(11,5,0.72),(11,6,0.85)]
ALL_PATHS  = BASE_PATHS + DAAT_PATHS


def build_adj(paths):
    adj = {}
    for (a, b, w) in paths:
        adj.setdefault(a, []).append((b, w))
        adj.setdefault(b, []).append((a, w))
    return adj


# ─────────────────────────────────────────────
# MESSUNG
# ─────────────────────────────────────────────

def local_c(s1: Sefirah, s2: Sefirah) -> float:
    return abs(0.5 * (s1.z() + s2.z()))

def global_c(sefirot: list[Sefirah]) -> float:
    active = [s for s in sefirot if s.amplitude > 0.001]
    if not active:
        return 0.0
    return abs(sum(s.z() for s in active) / len(active))

def coupling_field(node_id: int, adj: dict, by_id: dict) -> complex:
    neighbors = adj.get(node_id, [])
    if not neighbors:
        return 0+0j
    active = [(nid, w) for nid, w in neighbors if by_id[nid].amplitude > 0.001]
    if not active:
        return 0+0j
    return sum(w * by_id[nid].z() for nid, w in active) / len(active)


# ─────────────────────────────────────────────
# SYNC
# ─────────────────────────────────────────────

def sync_dialogue(s1: Sefirah, s2: Sefirah) -> float:
    for _ in range(SYNC_STEPS):
        mid = np.angle(s1.z() + s2.z())
        s1.theta += 0.4 * math.sin(mid - s1.theta)
        s2.theta += 0.4 * math.sin(mid - s2.theta)
        s1.theta %= 2*math.pi
        s2.theta %= 2*math.pi
    return local_c(s1, s2)


# ─────────────────────────────────────────────
# EPOCH COLLAPSE
# ─────────────────────────────────────────────

def epoch_collapse(sefirot: list[Sefirah]) -> float:
    active = [s for s in sefirot if s.amplitude > 0.001]
    mean_z = np.mean([s.z() for s in active])
    coherence = abs(mean_z)
    dominant = float(np.angle(mean_z))
    for s in active:
        s.theta += 0.25 * math.sin(dominant - s.theta)
        s.theta %= 2*math.pi
    return round(coherence, 4)


# ─────────────────────────────────────────────
# HAUPTSIMULATION
# ─────────────────────────────────────────────

def run(epochs: int = 120, steps: int = 10, dt: float = 0.1) -> list[dict]:
    sefirot = make_sefirot()
    by_id   = {s.id: s for s in sefirot}
    adj     = build_adj(ALL_PATHS)
    daat    = by_id[11]
    chokmah = by_id[2]
    binah   = by_id[3]

    complement_pairs = [
        (s.id, s.complement_id)
        for s in sefirot
        if s.complement_id and s.id < s.complement_id
    ]

    log = []
    daat_was_active = False

    for epoch in range(1, epochs + 1):
        gc = global_c(sefirot)

        # ── Evolution ──
        for _ in range(steps):
            cb_coherence = local_c(chokmah, binah)

            # Da'at Schwelle prüfen
            if cb_coherence >= DAAT_THRESHOLD:
                daat.target_amplitude = 0.88
            else:
                daat.target_amplitude = 0.0

            for s in sefirot:
                cf = coupling_field(s.id, adj, by_id)
                s.evolve(dt, coupling=cf, global_c=gc)
                s.fade(dt)

            gc = global_c(sefirot)

        # ── Sync ──
        syncs = 0
        for (id1, id2) in complement_pairs:
            s1, s2 = by_id[id1], by_id[id2]
            if s1.amplitude > 0.1 and s2.amplitude > 0.1:
                if local_c(s1, s2) > SYNC_THRESHOLD:
                    sync_dialogue(s1, s2)
                    syncs += 1

        # ── Collapse ──
        collapse_c = epoch_collapse(sefirot)

        # ── Da'at Status ──
        cb_c    = round(local_c(chokmah, binah), 4)
        daat_active = daat.amplitude > 0.05
        appeared   = daat_active and not daat_was_active
        vanished   = not daat_active and daat_was_active
        daat_was_active = daat_active

        log.append({
            "epoch":        epoch,
            "global_c":     round(global_c(sefirot), 4),
            "collapse_c":   collapse_c,
            "syncs":        syncs,
            "cb_coherence": cb_c,
            "daat_amp":     round(daat.amplitude, 4),
            "daat_theta":   round(daat.theta, 4),
            "daat_active":  daat_active,
            "appeared":     appeared,
            "vanished":     vanished,
        })

    return log


# ─────────────────────────────────────────────
# OUTPUT
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 65)
    print("RI — Da'at als Schwellenphänomen (120 Epochen)")
    print(f"  Erscheint wenn C(Chokmah,Binah) ≥ {DAAT_THRESHOLD}")
    print("=" * 65)

    log = run(epochs=120)

    print(f"\n{'Ep':>4}  {'Global C':>9}  {'C(Ch,Bi)':>9}  {'Da\'at A':>8}  Status")
    print(f"  {'─'*4}  {'─'*9}  {'─'*9}  {'─'*8}  {'─'*12}")

    for e in log:
        status = ""
        if e["appeared"]: status = "✦ ERSCHEINT"
        elif e["vanished"]: status = "✧ ERLISCHT"
        elif e["daat_active"]: status = "  aktiv"

        print(f"  {e['epoch']:>4}  {e['global_c']:>9.4f}  {e['cb_coherence']:>9.4f}"
              f"  {e['daat_amp']:>8.4f}  {status}")

    # Zusammenfassung
    appearances = sum(1 for e in log if e["appeared"])
    vanishings  = sum(1 for e in log if e["vanished"])
    active_pct  = 100 * sum(1 for e in log if e["daat_active"]) / len(log)

    print(f"\n  Da'at erschien:   {appearances}×")
    print(f"  Da'at erlosch:    {vanishings}×")
    print(f"  Aktiv-Anteil:     {active_pct:.1f}% der Epochen")

    if appearances > 1:
        appear_epochs = [e["epoch"] for e in log if e["appeared"]]
        if len(appear_epochs) > 1:
            periods = [appear_epochs[i+1]-appear_epochs[i]
                       for i in range(len(appear_epochs)-1)]
            print(f"  Meta-Rhythmus:    ~{sum(periods)/len(periods):.1f} Epochen Periode")

    # JSON
    with open("simulations/kabbala_daat_threshold_results.json", "w", encoding="utf-8") as f:
        json.dump({"log": log, "params": {
            "daat_threshold": DAAT_THRESHOLD,
            "epochs": 120,
            "appearances": appearances,
            "active_pct": round(active_pct, 1),
        }}, f, ensure_ascii=False, indent=2)
    print(f"\n  [Gespeichert]: simulations/kabbala_daat_threshold_results.json")
    print("=" * 65)
