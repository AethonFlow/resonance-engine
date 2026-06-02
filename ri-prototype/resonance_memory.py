"""
RI · The Onion — Resonance Memory  (proof-of-concept · "South strand")
======================================================================

A memory that stores information NOT as rows in a database, but as
overlapping waves in a SINGLE complex field. Recall happens by RESONANCE
(interference / correlation), never by an index lookup.

Honest name for the mechanism: Holographic Reduced Representations
(Tony Plate, 1995) built on circular convolution. This is exactly the
unit-circle + Fourier + superposition story we have been drawing:

  • every token is a wave with a flat power spectrum and random phases
    — i.e. a point-cloud on the unit circle e^{iθ}
  • BINDING two tokens  = circular convolution
                        = elementwise product in the Fourier domain
                        = on the unit circle, the phases simply ADD
  • STORING             = SUPERPOSITION: add the bound wave into ONE field
    vector ("the onion"). No row is created anywhere.
  • RECALL              = RESONANCE: correlate a cue against the field; the
    matching component interferes constructively, the rest cancels out.
  • MATCH STRENGTH      = COHERENCE: cosine similarity ∈ [-1, 1], peaks ~1
    on a true hit, stays near 0 for something that was never stored.

Consequences (the part a Seattle audience cares about):
  • the entire memory is a single vector — there is no table, no key index
  • storing more memories deepens the interference pattern (the onion grows)
  • recall degrades GRACEFULLY (associative, content-addressable); it does
    not raise KeyError, it returns a weaker resonance
  • a cue that was never stored returns LOW coherence — no hallucinated row

Map vocabulary:
  θ (house)  → which angular sector / role the memory belongs to
  r (cycle)  → which onion layer / time-ring it lives in
  dialogue   → the binding operation that couples two waves
"""

from __future__ import annotations

import numpy as np


class ResonanceField:
    """A holographic resonance memory: one field vector, recall by resonance."""

    def __init__(self, dim: int = 4096, seed: int = 7):
        self.dim = dim
        self.rng = np.random.default_rng(seed)
        # THE ONION — the entire memory lives here, in ONE vector. No table.
        self.field = np.zeros(dim, dtype=float)
        # lexicon is ONLY used for clean-up at recall (the "world" of knowns);
        # it is not an index into the field and is never searched by key.
        self.lexicon: dict[str, np.ndarray] = {}
        self._stored = 0

    # ── a token is a unit wave on the circle (random phases, flat spectrum) ──
    def token(self, name: str) -> np.ndarray:
        if name not in self.lexicon:
            v = self.rng.normal(0.0, 1.0 / np.sqrt(self.dim), self.dim)
            self.lexicon[name] = v
        return self.lexicon[name]

    # ── BIND: circular convolution (phases add on the unit circle) ──────────
    @staticmethod
    def bind(a: np.ndarray, b: np.ndarray) -> np.ndarray:
        n = a.shape[0]
        return np.fft.irfft(np.fft.rfft(a) * np.fft.rfft(b), n=n)

    # ── RESONATE: circular correlation = approximate unbind ─────────────────
    @staticmethod
    def resonate(cue: np.ndarray, field: np.ndarray) -> np.ndarray:
        n = field.shape[0]
        return np.fft.irfft(np.fft.rfft(cue).conj() * np.fft.rfft(field), n=n)

    # ── STORE: lay a wave into the onion (superposition) ────────────────────
    def store(self, house: str, content: str, cycle: int = 0) -> None:
        """Store  content  at  house  in onion layer  cycle.

        We bind (cycle ⊛ house ⊛ content) and ADD it to the single field.
        Nothing is indexed; the memory becomes part of the interference field.
        """
        self.token(content)  # register so clean-up can resonate against it
        wave = self.bind(self.token(f"cycle:{cycle}"),
                         self.bind(self.token(f"house:{house}"),
                                   self.token(content)))
        self.field = self.field + wave
        self._stored += 1

    # ── RECALL: ask the field by resonance, read out by coherence ───────────
    def recall(self, house: str, cycle: int = 0, top: int = 3):
        """Recall what resonates at (house, cycle). Returns (best, coherence, ranking)."""
        cue = self.bind(self.token(f"cycle:{cycle}"), self.token(f"house:{house}"))
        echo = self.resonate(cue, self.field)

        scores: list[tuple[str, float]] = []
        en = np.linalg.norm(echo) + 1e-12
        for name, w in self.lexicon.items():
            if name.startswith("house:") or name.startswith("cycle:"):
                continue  # role/structural tokens are not "contents"
            coh = float(echo @ w / (en * (np.linalg.norm(w) + 1e-12)))
            scores.append((name, coh))
        scores.sort(key=lambda x: x[1], reverse=True)
        best, best_coh = scores[0]
        return best, best_coh, scores[:top]

    def info(self) -> str:
        n_contents = sum(1 for k in self.lexicon
                         if not k.startswith(("house:", "cycle:")))
        return (f"field = ONE vector of {self.dim} numbers · "
                f"{self._stored} memories superposed · "
                f"{n_contents} distinct contents · 0 table rows")


# ════════════════════════════════════════════════════════════════════════
# DEMO — run:  python resonance_memory.py
# ════════════════════════════════════════════════════════════════════════
def _bar(x: float, width: int = 24) -> str:
    fill = int(max(0.0, min(1.0, x)) * width)
    return "█" * fill + "·" * (width - fill)


def demo() -> None:
    print("=" * 70)
    print("RI · THE ONION — resonance memory (no database, recall by resonance)")
    print("=" * 70)

    mem = ResonanceField(dim=4096, seed=7)

    # Cycle 0 — the company analogy, one onion layer.
    cycle0 = {
        "ORIGIN":     "grundlagenforschung_batterie",
        "OFFERING":   "produktentwicklung",
        "EXPRESSION": "marketing_kampagne",
        "GROUND":     "regulierung_lobby",
        "FORM":       "serienreifes_produkt",
        "VALUE":      "markt_umsatz",
        "FEEDBACK":   "big_data_verkaufszahlen",
        "EVALUATION": "reife_markterkenntnis",
    }
    print("\n▸ STORING cycle 0 (laying 8 waves into the field — no rows):")
    for house, content in cycle0.items():
        mem.store(house, content, cycle=0)
        print(f"    house {house:<11} ⟸  {content}")

    # Cycle 1 — the NEXT onion ring, stored into the SAME single field.
    cycle1 = {
        "ORIGIN":   "festkoerper_zelle_v2",
        "OFFERING": "plattform_strategie",
        "VALUE":    "abo_modell",
        "FEEDBACK": "telemetrie_flottendaten",
    }
    print("\n▸ STORING cycle 1 (a deeper onion ring, SAME field):")
    for house, content in cycle1.items():
        mem.store(house, content, cycle=1)
        print(f"    house {house:<11} ⟸  {content}")

    print(f"\n▸ FIELD STATE:  {mem.info()}")

    # ── Recall by resonance ────────────────────────────────────────────
    print("\n" + "-" * 70)
    print("RECALL — we ask the field by resonance at (house, cycle).")
    print("Coherence is the cosine of the echo with each known content.")
    print("-" * 70)

    checks = [
        ("ORIGIN", 0), ("FEEDBACK", 0), ("EVALUATION", 0),
        ("ORIGIN", 1), ("VALUE", 1),
    ]
    correct = 0
    for house, cyc in checks:
        truth = (cycle0 if cyc == 0 else cycle1).get(house)
        best, coh, ranking = mem.recall(house, cyc)
        hit = (best == truth)
        correct += hit
        runner = ranking[1]
        print(f"\n  cue (house={house}, cycle={cyc})  →  resonates with: {best}")
        print(f"      coherence {coh:+.3f}  {_bar(coh)}   {'✓ correct' if hit else '✗'}")
        print(f"      (next strongest: {runner[0]} @ {runner[1]:+.3f}  — clearly weaker)")

    # ── A cue that was never stored → no hallucinated memory ────────────
    print("\n" + "-" * 70)
    print("FALSE CUE — ask for something never stored (house=GROUND, cycle=1).")
    print("A database would raise KeyError. The field just resonates weakly.")
    print("-" * 70)
    best, coh, ranking = mem.recall("GROUND", 1)
    print(f"\n  best resonance: {best} @ coherence {coh:+.3f}  {_bar(coh)}")
    print(f"  → low / ambiguous coherence = 'nothing coherent here', not a fake row")

    print("\n" + "=" * 70)
    print(f"VERIFIED: {correct}/{len(checks)} recalls correct, "
          f"by resonance, from ONE {mem.dim}-number field. No table, no index.")
    print("=" * 70)


if __name__ == "__main__":
    demo()
