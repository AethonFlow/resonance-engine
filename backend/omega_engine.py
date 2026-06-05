"""
omega_engine.py — Resonant Intelligence · Omega-Kollaps & Spektralfilter
========================================================================

Implementiert den Omega-Haus-Uebergang:

    1. Kollaps: kontinuierliches Phasenfeld -> diskreter Zustandsvektor v_omega
    2. T_Omega-Transformation: v_omega -> v_neu (Startbedingungen naechste Spirale)
    3. Erhaltungsgroessen: H (Energie), S (Entropie), K (Kopplung)
    4. Sonifikation: 5 Klangschichten aus Systemzustand
    5. OmegaState: Omega als eigener Zustandsraum

Mathematisches Fundament
------------------------
    Adjazenzmatrix:   W_{jk} = A_j * A_k * e^(i(theta_j - theta_k))
    Spektralfilter:   T_Omega = V * Lambda_filter * V^dagger
    Edge-of-Chaos:    mu = |C - C*|   (C* = 0.72 default)
    Globale Kohaerenz: C = |(1/N) * Sum e^(i*theta_n)|

Sonifikations-Schichten
-----------------------
    Layer 1 | Energie H = Sum(A_n^2)         -> Grundton-Frequenz
    Layer 2 | Spektrale Entropie S            -> Anzahl aktiver Moden (Breite)
    Layer 3 | Kohaerenz C                     -> Master-Volume
    Layer 4 | Dominanter Eigenwert lambda_max -> Melodie-Ton
    Layer 5 | Phase der dominanten Mode       -> Stereo-Pan [-1, +1]

Autor: AethonFlow / RI-Projekt
"""

from __future__ import annotations

import cmath
import math
from dataclasses import dataclass, field
from typing import List, Optional

import numpy as np


# ─────────────────────────────────────────────────────────────────
# PARAMETER
# ─────────────────────────────────────────────────────────────────

BASE_FREQ_HZ     = 220.0   # A3 als Basisfrequenz
SIGMOID_SLOPE    = 10.0    # Steilheit des Spektralfilters
N_NODES          = 8       # Anzahl Haeuser / Knoten
C_TARGET_DEFAULT = 0.72    # Sollkohaerenz (Edge-of-Chaos)


# ─────────────────────────────────────────────────────────────────
# Datenmodelle
# ─────────────────────────────────────────────────────────────────

@dataclass
class SonificationTone:
    """Ein einzelner Ton im Resonanzspektrum."""
    frequency_hz: float     # Hz
    amplitude:    float     # [0, 1] normiert
    stereo_pos:   float     # [-1, +1]: links=-1, Mitte=0, rechts=+1
    eigenvalue:   float     # zugehoeriger Eigenwert
    mode_index:   int       # Index im Eigenspektrum (0-basiert)
    is_dominant:  bool      # True fuer den staerksten Eigenwert


@dataclass
class ConservationQuantities:
    """
    Erhaltungsgroessen des Resonanzsystems.

    H        Hamiltonian / Gesamtenergie:  H = Sum(A_n^2)
    S        Spektrale Entropie:           S = -Sum(p_i * log(p_i))
             p_i = |lambda_i| / Sum|lambda_i| (Eigenwert-Gewichte)
    K        Mittlere Kopplungsstaerke:    K = mean(|W_{jk}|) j!=k
    C        Globale Kohaerenz:            C = |(1/N)*Sum(e^(i*theta_n))|
    H_norm   H normiert auf [0,1] via Maximum-Energie N*A_max^2
    S_norm   S normiert auf [0,1] via log2(N)
    """
    H:      float   # Rohenergie
    S:      float   # Spektrale Entropie (nats)
    K:      float   # Kopplungsstaerke
    C:      float   # Globale Kohaerenz
    H_norm: float   # H / N  (normiert)
    S_norm: float   # S / log(N)


@dataclass
class OmegaState:
    """
    Omega als eigener Zustandsraum.

    Nicht nur FFT-Filter, sondern ein vollstaendiges
    Wahrnehmungsfenster in den Systemzustand.
    """
    coherence:     float   # C in [0, 1]
    entropy:       float   # S_norm in [0, 1]
    energy:        float   # H_norm in [0, 1]
    coupling:      float   # K in [0, 1]
    dominant_mode: float   # lambda_max (groesster Eigenwert)
    dominant_phase: float  # Phase der dominanten Mode (theta_max)
    mu:            float   # aktueller Filterwert
    c_target:      Optional[float]  # Sollkohaerenz

    def label(self) -> str:
        """Zustandsbeschreibung aus Kohaerenz + Entropie."""
        if self.coherence >= 0.75 and self.entropy < 0.4:
            return "synchronized"
        if self.coherence >= 0.55:
            return "coherent"
        if self.entropy >= 0.75:
            return "chaotic"
        if self.coherence < 0.25:
            return "dispersed"
        return "transitional"

    def to_dict(self) -> dict:
        return {
            "coherence":      round(self.coherence, 4),
            "entropy":        round(self.entropy, 4),
            "energy":         round(self.energy, 4),
            "coupling":       round(self.coupling, 4),
            "dominant_mode":  round(self.dominant_mode, 4),
            "dominant_phase": round(self.dominant_phase, 4),
            "mu":             round(self.mu, 4),
            "c_target":       self.c_target,
            "label":          self.label(),
        }


@dataclass
class OmegaCollapseResult:
    """Ergebnis des Omega-Kollaps-Prozesses."""
    v_omega:          List[complex]
    phases_neu:       List[float]
    amplitudes_neu:   List[float]
    coherence_before: float
    coherence_after:  float
    eigenvalues:      List[float]
    tones:            List[SonificationTone]
    mu:               float
    conservation:     ConservationQuantities
    omega_state:      OmegaState

    def to_db_doc(self) -> dict:
        return {
            "v_omega":          [{"re": z.real, "im": z.imag} for z in self.v_omega],
            "phases_neu":       self.phases_neu,
            "amplitudes_neu":   self.amplitudes_neu,
            "coherence_before": self.coherence_before,
            "coherence_after":  self.coherence_after,
            "eigenvalues":      self.eigenvalues,
            "mu":               self.mu,
            "conservation":     {
                "H":      round(self.conservation.H, 4),
                "S":      round(self.conservation.S, 4),
                "K":      round(self.conservation.K, 4),
                "C":      round(self.conservation.C, 4),
                "H_norm": round(self.conservation.H_norm, 4),
                "S_norm": round(self.conservation.S_norm, 4),
            },
            "omega_state": self.omega_state.to_dict(),
            "tones": [
                {
                    "frequency_hz": t.frequency_hz,
                    "amplitude":    t.amplitude,
                    "stereo_pos":   t.stereo_pos,
                    "eigenvalue":   t.eigenvalue,
                    "mode_index":   t.mode_index,
                    "is_dominant":  t.is_dominant,
                }
                for t in self.tones
            ],
        }


# ─────────────────────────────────────────────────────────────────
# Hilfsfunktionen
# ─────────────────────────────────────────────────────────────────

def _sigmoid(x: float, slope: float = SIGMOID_SLOPE) -> float:
    if x * slope > 100:
        return 1.0
    if x * slope < -100:
        return 0.0
    return 1.0 / (1.0 + math.exp(-slope * x))


def compute_mu(C_global: float, c_target: Optional[float] = C_TARGET_DEFAULT) -> float:
    """
    Spektralfilter-Schwellwert mu.

    c_target gesetzt -> mu = |C - C*|   (Edge-of-Chaos-Regler)
    c_target None    -> mu = 1 - C       (legacy)

    Edge-of-Chaos (c_target=0.72):
      C=0.0  -> mu=0.72  (starker Filter bei Chaos)
      C=0.72 -> mu=0.00  (offener Filter im Sollbereich)
      C=1.0  -> mu=0.28  (moderater Filter bei Starre)
    """
    if c_target is None:
        return 1.0 - C_global
    return abs(C_global - c_target)


def compute_conservation_quantities(
    phases: List[float],
    amplitudes: List[float],
    W: np.ndarray,
) -> ConservationQuantities:
    """
    Berechnet die Erhaltungsgroessen des Resonanzsystems.

    H = Sum(A_n^2)                  — Gesamtenergie
    S = -Sum(p_i * log(p_i))        — Spektrale Entropie (Eigenwert-Verteilung)
    K = mean(|W_{jk}|) fuer j!=k   — Kopplungsstaerke
    C = |(1/N)*Sum(e^(i*theta))|    — Globale Kohaerenz
    """
    n = len(phases)

    # Energie
    H = float(sum(a**2 for a in amplitudes))
    H_norm = round(H / max(n, 1), 4)  # normiert auf Anzahl Knoten

    # Kohaerenz
    C = float(abs(np.mean(np.exp(1j * np.array(phases)))))

    # Spektrale Entropie aus Eigenwert-Verteilung
    W_sym = (W + W.conj().T) / 2.0
    eigvals = np.linalg.eigvalsh(W_sym).real
    abs_eigvals = np.abs(eigvals)
    total_ev = float(abs_eigvals.sum())
    if total_ev > 1e-9:
        p = abs_eigvals / total_ev
        # Sicherer log (p=0 -> 0*log(0) = 0)
        S = float(-sum(pi * math.log(pi) for pi in p if pi > 1e-12))
        log_n = math.log(n) if n > 1 else 1.0
        S_norm = round(min(1.0, S / log_n), 4)
    else:
        S = 0.0
        S_norm = 0.0

    # Kopplungsstaerke: Mittlerer Absolutwert der Off-Diagonalelemente
    n_pairs = n * (n - 1)
    if n_pairs > 0:
        K = float(sum(
            abs(W[j, k])
            for j in range(n) for k in range(n) if j != k
        ) / n_pairs)
    else:
        K = 0.0

    return ConservationQuantities(
        H=round(H, 4),
        S=round(S, 4),
        K=round(K, 4),
        C=round(C, 4),
        H_norm=H_norm,
        S_norm=S_norm,
    )


# ─────────────────────────────────────────────────────────────────
# Adjazenzmatrix
# ─────────────────────────────────────────────────────────────────

def build_adjacency_matrix(
    phases: List[float],
    amplitudes: List[float],
) -> np.ndarray:
    """
    Komplexe Adjazenzmatrix.
    W_{jk} = A_j * A_k * e^(i*(theta_j - theta_k))
    Hermitesch: W = W^dagger
    """
    n = len(phases)
    W = np.zeros((n, n), dtype=complex)
    for j in range(n):
        for k in range(n):
            if j != k:
                W[j, k] = amplitudes[j] * amplitudes[k] * cmath.exp(
                    1j * (phases[j] - phases[k])
                )
    return W


def build_adjacency_from_history(
    history: List[dict],
    decay: float = 0.85,
) -> np.ndarray:
    """
    Akkumuliertes W aus Zeitreihe mit exponentiellem Decay.
    Neuere Eintraege werden staerker gewichtet.
    """
    W_acc = np.zeros((N_NODES, N_NODES), dtype=complex)
    weight_sum = 0.0

    for t, entry in enumerate(reversed(history)):
        weight = decay ** t
        weight_sum += weight
        nodes = entry.get("node_states", [])
        if len(nodes) != N_NODES:
            continue
        sorted_nodes = sorted(nodes, key=lambda x: x["house_index"])
        ph = [n["theta"] for n in sorted_nodes]
        am = [n["amplitude"] for n in sorted_nodes]
        W_acc += weight * build_adjacency_matrix(ph, am)

    if weight_sum > 1e-9:
        W_acc /= weight_sum
    return W_acc


# ─────────────────────────────────────────────────────────────────
# T_Omega-Transformation
# ─────────────────────────────────────────────────────────────────

def build_T_omega(
    W: np.ndarray,
    C_global: float,
    c_target: Optional[float] = C_TARGET_DEFAULT,
) -> tuple:
    """
    Spektralzerlegung + Sigmoid-Filter.
    T_Omega = V * Lambda_filter * V^dagger

    Gibt zurueck: (T_omega, eigenvalues_real, V)
    """
    W_sym = (W + W.conj().T) / 2.0
    eigenvalues, V = np.linalg.eigh(W_sym)
    mu = compute_mu(C_global, c_target)

    lambda_filtered = np.array([
        ev * _sigmoid(abs(ev) - mu)
        for ev in eigenvalues
    ], dtype=complex)

    Lambda = np.diag(lambda_filtered)
    T_omega = V @ Lambda @ V.conj().T
    return T_omega, eigenvalues.real, V


# ─────────────────────────────────────────────────────────────────
# Kollaps
# ─────────────────────────────────────────────────────────────────

def omega_collapse(
    phases: List[float],
    amplitudes: List[float],
) -> tuple:
    """
    Kollabiert Phasenfeld via DFT-Projektion.
    Gibt (v_omega, C_global) zurueck.
    """
    z = np.array([
        a * cmath.exp(1j * p)
        for a, p in zip(amplitudes, phases)
    ], dtype=complex)
    n = len(phases)
    C_global = float(abs(np.mean(np.exp(1j * np.array(phases)))))
    v_omega = np.fft.fft(z) / n
    return v_omega, C_global


# ─────────────────────────────────────────────────────────────────
# Sonifikation (5 Schichten)
# ─────────────────────────────────────────────────────────────────

def sonify_state(
    eigenvalues: np.ndarray,
    C_global: float,
    phases: Optional[List[float]] = None,
    base_freq: float = BASE_FREQ_HZ,
) -> List[SonificationTone]:
    """
    5-Schichten-Sonifikation:

    Layer 1 | Energie         -> Grundton (via base_freq-Skalierung)
    Layer 2 | Spektr. Entropie -> Anzahl aktiver Moden
    Layer 3 | Kohaerenz C     -> Master-Volume (amplitude)
    Layer 4 | Lambda_max      -> hoechste Frequenz (Melodieton)
    Layer 5 | Phase der Mode  -> stereo_pos = sin(theta_dominant)

    phases: optionale Phasenliste (N Werte) fuer Stereo-Berechnung
    """
    positive = [(i, float(ev)) for i, ev in enumerate(eigenvalues) if ev > 1e-6]
    if not positive:
        return []

    ev_max = max(ev for _, ev in positive)
    if ev_max < 1e-9:
        return []

    total_ev = sum(ev for _, ev in positive)
    dom_idx = max(positive, key=lambda x: x[1])[0]

    tones: List[SonificationTone] = []
    for i, ev in positive:
        # Frequenz: normiert auf Basisfrequenz (Layer 1 + 4)
        freq = base_freq * (ev / ev_max)

        # Amplitude: kohaerenzgewichtet (Layer 3)
        amp = (ev / total_ev) * C_global

        # Stereoposition aus Phase der Mode (Layer 5)
        if phases is not None and i < len(phases):
            stereo = round(math.sin(phases[i]), 4)
        elif phases is not None and len(phases) > 0:
            # Interpolation: verwende Phase des naechsten Knotens
            stereo = round(math.sin(phases[i % len(phases)]), 4)
        else:
            stereo = 0.0

        tones.append(SonificationTone(
            frequency_hz=round(freq, 2),
            amplitude=round(min(1.0, amp), 4),
            stereo_pos=stereo,
            eigenvalue=round(ev, 4),
            mode_index=i,
            is_dominant=(i == dom_idx),
        ))

    tones.sort(key=lambda t: t.frequency_hz)
    return tones


# ─────────────────────────────────────────────────────────────────
# Kartesische Projektion (fuer Spiralvisualisierung)
# ─────────────────────────────────────────────────────────────────

def to_cartesian(
    phases: List[float],
    amplitudes: List[float],
) -> List[dict]:
    """
    Projiziert Knotenzustaende (r, theta) -> (x, y).

    x = A * cos(theta)
    y = A * sin(theta)

    Fuer Spiral-Trajektorie-Visualisierung.
    Gibt Liste mit {house_index, x, y, r, theta} zurueck.
    """
    return [
        {
            "house_index": i + 1,
            "x":     round(a * math.cos(p), 4),
            "y":     round(a * math.sin(p), 4),
            "r":     round(a, 4),
            "theta": round(p, 4),
        }
        for i, (p, a) in enumerate(zip(phases, amplitudes))
    ]


# ─────────────────────────────────────────────────────────────────
# Hauptfunktion
# ─────────────────────────────────────────────────────────────────

def run_omega_collapse(
    phases: List[float],
    amplitudes: List[float],
    history: Optional[List[dict]] = None,
    c_target: Optional[float] = C_TARGET_DEFAULT,
) -> OmegaCollapseResult:
    """
    Vollstaendiger Omega-Kollaps-Durchlauf.

    phases, amplitudes : aktueller Knotenzustand (8 Werte)
    history            : optionale Zeitreihe fuer akkumuliertes W
    c_target           : Sollkohaerenz fuer Edge-of-Chaos-Filter

    Gibt OmegaCollapseResult zurueck (inkl. ConservationQuantities + OmegaState).
    """
    assert len(phases) == N_NODES, f"Erwartet {N_NODES} Phasen"
    assert len(amplitudes) == N_NODES, f"Erwartet {N_NODES} Amplituden"

    # 1. Adjazenzmatrix
    if history and len(history) >= 2:
        W = build_adjacency_from_history(history)
    else:
        W = build_adjacency_matrix(phases, amplitudes)

    # 2. Erhaltungsgroessen (vor dem Kollaps)
    conservation = compute_conservation_quantities(phases, amplitudes, W)

    # 3. Kollaps -> v_omega, C_before
    v_omega, C_before = omega_collapse(phases, amplitudes)

    # 4. T_Omega mit Edge-of-Chaos-Filter
    T_omega, eigenvalues, V = build_T_omega(W, C_before, c_target=c_target)

    # 5. Transformation: v_neu = T_Omega * v_omega
    v_neu = T_omega @ v_omega

    # 6. Rueckprojektion auf Phasen und Amplituden
    phases_neu_raw     = [float(cmath.phase(z)) % (2 * math.pi) for z in v_neu]
    amplitudes_neu_raw = [min(1.0, max(0.0, abs(z))) for z in v_neu]
    amp_max = max(amplitudes_neu_raw) if max(amplitudes_neu_raw) > 1e-9 else 1.0
    amplitudes_neu = [round(a / amp_max, 4) for a in amplitudes_neu_raw]
    phases_neu     = [round(p, 4) for p in phases_neu_raw]

    # 7. C_after
    C_after = float(abs(np.mean(np.exp(1j * np.array(phases_neu)))))

    # 8. Sonifikation (5 Schichten, mit Phasen fuer Stereo)
    mu = compute_mu(C_before, c_target)
    tones = sonify_state(eigenvalues, C_before, phases=phases)

    # 9. OmegaState aufbauen
    pos_eigvals = [ev for ev in eigenvalues if ev > 1e-6]
    dom_ev = max(pos_eigvals) if pos_eigvals else 0.0
    dom_idx = int(np.argmax(eigenvalues)) if len(eigenvalues) > 0 else 0
    dom_phase = float(phases[dom_idx % len(phases)]) if phases else 0.0

    omega_state = OmegaState(
        coherence=round(C_before, 4),
        entropy=round(conservation.S_norm, 4),
        energy=round(conservation.H_norm, 4),
        coupling=round(conservation.K, 4),
        dominant_mode=round(dom_ev, 4),
        dominant_phase=round(dom_phase, 4),
        mu=round(mu, 4),
        c_target=c_target,
    )

    return OmegaCollapseResult(
        v_omega=list(v_omega),
        phases_neu=phases_neu,
        amplitudes_neu=amplitudes_neu,
        coherence_before=round(C_before, 4),
        coherence_after=round(C_after, 4),
        eigenvalues=[round(float(ev), 4) for ev in eigenvalues],
        tones=tones,
        mu=round(mu, 4),
        conservation=conservation,
        omega_state=omega_state,
    )


# ─────────────────────────────────────────────────────────────────
# Fourier-Signatur (Resonanzblüte)
# ─────────────────────────────────────────────────────────────────

def generate_epicycle_path(
    v_omega: np.ndarray,
    n_points: int = 256,
) -> List[dict]:
    """
    Erzeugt die geschlossene Fourier-Trajektorie ("Resonanzblüte").

    Z(t) = Σ_k v_omega[k] · e^(2πi · k · t / n_points)

    Jeder Fourier-Koeffizient v_omega[k] beschreibt einen Epizyklus:
      - |v_omega[k]|  → Radius (Amplitude dieser Frequenzkomponente)
      - arg(v_omega[k]) → Startwinkel
      - k              → Drehgeschwindigkeit

    Die überlagerten Kreisbewegungen erzeugen eine geschlossene Kurve
    im komplexen Zahlenraum — die visuelle Signatur des Resonanzfeldes.

    Charakteristika der Form:
      synchronized  → hochsymmetrisches Muster (wenige dominante Moden)
      chaotic       → verschlungene, unregelmäßige Kurve (viele Moden gleich)
      dispersed     → kleines, gedämpftes Muster (niedrige Amplituden)
      transitional  → asymmetrische Spirale

    Returns: Liste von {x, y, t} (n_points Punkte, geschlossen)
    """
    path: List[dict] = []
    N = len(v_omega)
    if N == 0:
        return path

    for step in range(n_points):
        t = step / n_points   # t ∈ [0, 1)
        Z = sum(
            v_omega[k] * cmath.exp(2j * math.pi * k * t)
            for k in range(N)
        )
        path.append({
            "x": round(Z.real, 4),
            "y": round(Z.imag, 4),
            "t": round(t, 4),
        })

    return path


def resonance_signature(
    phases: List[float],
    amplitudes: List[float],
    n_points: int = 256,
) -> dict:
    """
    Berechnet die Resonanz-Signatur direkt aus Phasen und Amplituden.

    Kein vollstaendiger Omega-Kollaps noetig — nur DFT + Epizyklenpfad.
    Geeignet fuer jeden Journal-Eintrag.

    Returns: {
        path: [{x, y, t}, ...],
        v_omega: [{re, im}, ...],
        bbox: {x_min, x_max, y_min, y_max, width, height},
        symmetry: float [0, 1]  — Annaeherung an Rotationssymmetrie
    }
    """
    z = np.array([
        a * cmath.exp(1j * p)
        for a, p in zip(amplitudes, phases)
    ], dtype=complex)

    v = np.fft.fft(z) / len(z)
    path = generate_epicycle_path(v, n_points=n_points)

    if not path:
        return {"path": [], "v_omega": [], "bbox": {}, "symmetry": 0.0}

    xs = [p["x"] for p in path]
    ys = [p["y"] for p in path]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    width  = round(x_max - x_min, 4)
    height = round(y_max - y_min, 4)

    # Symmetrie-Naeherung: wie ahnlich ist die Kurve ihrer Spiegelung?
    # Hoher Wert = fast rotationssymmetrisch (synchronized)
    # Niedriger Wert = asymmetrisch (chaotic / dispersed)
    radii = [math.sqrt(p["x"]**2 + p["y"]**2) for p in path]
    r_mean = sum(radii) / len(radii) if radii else 0.0
    r_std  = math.sqrt(sum((r - r_mean)**2 for r in radii) / len(radii)) if radii else 0.0
    symmetry = round(max(0.0, 1.0 - (r_std / (r_mean + 1e-9))), 4)

    return {
        "path": path,
        "v_omega": [{"re": round(c.real, 4), "im": round(c.imag, 4)} for c in v],
        "bbox": {
            "x_min": round(x_min, 4), "x_max": round(x_max, 4),
            "y_min": round(y_min, 4), "y_max": round(y_max, 4),
            "width": width, "height": height,
        },
        "symmetry": symmetry,
    }
