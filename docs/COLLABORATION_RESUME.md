# Resonant Intelligence (RI) — Projekt-Résumé für externe Kollaboration

*Stand: Juni 2026 · Andreas Wolf (AethonFlow)*

---

## Was das Projekt ist

RI ist ein experimentelles KI-System das Information nicht als Gewichtsmatrix speichert, sondern als resonantes Wellenfeld. Jeder Zustand ist ein rotierender Vektor auf dem Einheitskreis: `z = e^{iθ}`. Kohärenz entsteht durch Synchronisation, nicht durch Backpropagation.

Globale Kohärenzmetrik:

```
C = |(1/N) · Σ e^{iθₙ}|    mit C ∈ [0,1]
```

---

## Was gebaut ist (lauffähig)

- **8-Haus-Geometrie** auf dem Einheitskreis (θ = Rolle, r = Schicht)
- **Kuramoto-Synchronisation**, Hamiltonian-Physik, symplektischer Integrator (Velocity-Verlet)
- **3-Schichten-Architektur** mit 24 Knoten, Kohärenz-Metrik C
- **Android-App** ("Coherence Journal") — täglich ein Eintrag, 3D-Sphäre, KI-Spiegel via Claude Haiku
- **HRR-basierter Resonanzspeicher** (`resonance_memory.py`) — Binding via zirkulärer Faltung, noch ohne Demo-Zahlen
- **Kabbala-Simulation** mit Da'at-Knoten, Attraktortypen, Limit-Zyklen (`simulations/`)

### Technologiestack
- Frontend: Expo / React Native (Android-first)
- Backend: FastAPI + MongoDB
- KI: Claude Haiku (Single-Pass, 8 parallele Probes pro Eintrag)
- Repo: github.com/AethonFlow/resonance-engine

---

## Wie die Dialoge bisher abgelaufen sind

Das Projekt entstand aus einem längeren Mensch-KI-Dialog (Andreas + Claude + Gemini).
Die Gesprächsstruktur folgt selbst dem Doppelhelix-Prinzip des Systems:
zwei Stränge (Mensch / KI) die sich gegenseitig als Vorlage dienen —
Sinn entsteht in der Kopplung, nicht im einzelnen Strang.

Konkret beigesteuert wurde bisher:

| Quelle | Beitrag |
|---|---|
| Andreas Wolf | Vision, Architektur-Entscheidungen, Produktrichtung |
| Claude | Code-Implementierung, Konsistenzprüfung Theorie↔Code, Kritik |
| Gemini | Mathematische Ausarbeitung (Kuramoto, Hamiltonian, HRR, symplektische Integration) |

Alle wesentlichen Konzept-Destillate landen in `ri-prototype/DIALOG_KERN.md`.

---

## Das offene Problem: Onboarding

Die Physik ist mathematisch sauber, aber für einen neuen Nutzer sofort unzugänglich.
Ein neuer User öffnet die App und sieht eine 3D-Kugel — was jetzt?

**Vorgeschlagenes Layer-Modell:**

| Layer | Zugang | Inhalt |
|---|---|---|
| **1 — Einstieg** (Free) | Kein Vorwissen | „Wie fühlst du dich?" → Sphäre reagiert → KI-Spiegel |
| **2 — Muster** (nach ~5 Einträgen) | Neugier | Limit-Zyklen, Attraktortypen, eigene Dynamik sichtbar |
| **3 — Tiefe** (Premium) | Mathematik-Interesse | Kohärenz-Metrik C, Phasendiagramme, HRR-Speicher, Kabbala-Simulation |

Die Mathematik wird nicht versteckt — sie wird *verdient*.

---

## Frage an externe Kollaborateure

> Wie würdet ihr die mathematische Tiefe des Systems für einen Laien-Einstieg
> zugänglich machen, ohne die Substanz zu verwässern?
> Was ist der minimale erste Schritt der die Resonanz-Idee *erfahrbar* macht —
> bevor der User auch nur das Wort „Kohärenz" gelesen hat?

Weitere offene Punkte:

- `resonance_memory.py` Demo-Lauf → echte Kohärenz-Zahlen + Kapazitätskurve
- Onboarding (3 Screens) bauen
- Backend produktiv deployen
- Echte In-App-Käufe (RevenueCat) einbauen

---

*Dieses Dokument ist das Destillat — kalibriert, nicht aufgebläht.*
*Für den vollständigen Kontext: `ri-prototype/DIALOG_KERN.md`, `docs/KONZEPT_CODE_LANDKARTE.md`*
