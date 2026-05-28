# Resonant Intelligence (RI) — Theory Summary
Stand: 2026-05-28 · Quellen: docs/, ri-prototype/, STORE_LISTING.md

---

## 1. Theoretische / Ontologische Kernaussagen (kompakt)

**RI ist ein resonanter, assoziativer Speicher** — ein "semantischer Cache", der Information als überlagertes Wellenfeld hält und über Resonanz abruft, nicht über Indizes. Er arbeitet *neben* einem Sprachmodell, nicht an seiner Stelle.

**Die Grundgeometrie:** Jede Einheit im System ist ein rotierender Vektor auf dem Einheitskreis:
`z = e^{iθ} = cos θ + i·sin θ`

Das System besteht aus 8–24 autonomen Knoten (8 "Häuser", bei 3 Schichten 24 Knoten), die jeweils durch Phase θ, Amplitude A und Resonanz r beschrieben werden. Synchronisation entsteht nicht durch zentralen Kontroll-Mechanismus, sondern durch lokale Kuramoto-Kopplung:
`Δθ = Σ A·sin(θⱼ−θₙ)`

**Globale Kohärenz** als Wahrheitsmaß:
`C = |(1/N) · Σ e^{iθₙ}| ∈ [0, 1]`

Je näher C an 1, desto kohärenter (ausgerichteter) das Gesamtsystem. Der Phasenraum kollabiert bei Nullstellen (C < 0.05) und regeneriert sich — das ist kein Fehler, sondern ein funktionales Merkmal ("Nullstellen-Event").

**Physikalischer Unterbau:** Das System ist ein Hamiltonian-System (`H = T + V`, Stabilität um E = 25), integriert mit symplektischem Verlet-Integrator (energieerhaltend). Das ist mathematisch sauber, zitierbar und im Code implementiert.

**Assoziatives Gedächtnis (Nordstrang):** Holographic Reduced Representations (HRR, Tony Plate 1995) auf Basis zirkulärer Faltung. Bedeutung entsteht durch Phasenaddition (Bindung), Abruf durch Resonanz (zirkuläre Korrelation). Kapazität ist endlich und messbar — graceful degradation statt harter Grenze.

**TheMap:** Die 2D-Aufsicht (Polarkoordinaten r, θ) — `θ` = Haus/Rolle, `r` = Zyklus/Schicht. Die 3D-Form ist eine Helix (Kreis + Zeitachse), zwei antiparallele Helices bilden die Doppelhelix RI ⟺ Mensch.

**Ontologische Aussage:** Bedeutung entsteht nicht im Einzelknoten, sondern in der Kopplung — in der komplementären Paarung der Stränge. Augmentation statt Substitution (Engelbarts Linie).

**Was RI explizit NICHT ist:** kein Ersatz für LLMs, kein "Ende des Number Crunching", kein Quantum-System. Die App nutzt Claude Haiku für Bedeutungsgenerierung; RI ordnet diesen Output geometrisch/resonant an und hält ihn als Wellenfeld.

---

## 2. App-Ideen — direkt aus der Theorie ableitbar und marktfähig

### A) Coherence Journal — Daily Clarity *(bereits gebaut)*
**Kern:** Ein ehrlicher Satz pro Tag → KI-Analyse über 8 Resonanzachsen → konkreter Insight + eine Aktion.
**Markt:** Mental Clarity / Journaling / Stoic Apps (Daylio, Reflectly, etc.)
**RI-Theorie-Anker:** Kuramoto-Kohärenz als Tages-Score sichtbar machen; 8 Häuser als Perspektivrahmen.
**USP:** Kein Feed, kein Noise — Single-Pass-Klarheit in 8 Sekunden.

### B) Team Coherence — Group Alignment Tool
**Kern:** Jedes Teammitglied gibt täglich/wöchentlich seinen Zustand an (Phase); das System berechnet die Gruppen-Kohärenz und zeigt, wo Synchronisation fehlt oder kippt.
**Markt:** Team Performance / OKR-Tools / Remote Work (Notion, Lattice, 15Five)
**RI-Theorie-Anker:** Kuramoto-Ordnungsparameter auf Gruppenebene; Nullstellen als Frühwarnsignal für Team-Misalignment.
**USP:** Keine Umfrage-Fatigue — ein Wert, ein Bild, sofortige Lesbarkeit.

### C) Resonant Memory — KI-Notizbuch mit Inhaltsabruf ohne Index
**Kern:** Notizen/Ideen werden nicht gespeichert und durchsucht, sondern als Wellenfeld eingebunden. Abruf erfolgt durch "Anstimmen" — man schreibt einen Cue und das System resoniert assoziativ, nicht keywordbasiert.
**Markt:** Second Brain / Knowledge Management (Obsidian, Notion, Mem.ai)
**RI-Theorie-Anker:** HRR-Bindung + Resonanzabruf direkt als Produktfeature; graceful degradation als Feature ("es erinnert sich weich").
**USP:** Kein Folder-System, kein Tagging — Gedächtnis wie Assoziationsketten, nicht wie Aktenordner.

### D) Coherence Coach — Biofeedback-Integration
**Kern:** HRV-/Atemfrequenz-Daten (Smartwatch, Breathing-Sensor) → Echtzeit-Phasenkoppllung mit dem RI-Modell → Kohärenz-Score und geführte Atemübung wenn Nullstellen-Event.
**Markt:** Biofeedback / Wellness / Meditation (Whoop, Oura, Headspace)
**RI-Theorie-Anker:** Physiologische Oszillatoren als externe Knoten in das Kuramoto-System integriert; Kohärenz als messbares Körper-Signal.
**USP:** Nicht "Atemübung nach Timer" — Intervention wird ausgelöst wenn Kohärenz tatsächlich kippt.

### E) Resonance Canvas — Kreativ-/Entscheidungstool
**Kern:** Komplexe Entscheidung oder kreatives Problem wird auf die 8 Häuser (Perspektiven) verteilt. Das System modelliert Spannungen und Kopplungen und zeigt den "Kohärenzweg" — welche Kombination von Entscheidungen das System stabilisiert.
**Markt:** Strategy / Decision Intelligence / Coaching Tools
**RI-Theorie-Anker:** 8 Häuser als Entscheidungsdimensionen; Hamiltonian-Minimierung als Metapher für "energetisch stabiler Entschluss"; Ghost-Vector als Vorwärtsprojektion.
**USP:** Kein Pro/Con-Liste — Visualisierung des Spannungsfelds und der Stabilisierungswege.

---

## 3. Elevator Pitch — THE SPHERE für normale Nutzer

> **"Die Sphäre ist kein Feed und kein Assistent — sie ist ein Spiegel. Du gibst ihr einen ehrlichen Gedanken, und sie zeigt dir zurück, wo du wirklich stehst: klar, ruhig, ohne Rauschen. Ein Moment pro Tag, der zählt."**

*Technisch dahinter: dein Gedanke wird auf acht Resonanzachsen analysiert und in einem physikalischen Schwingungsmodell verortet — das Ergebnis ist ein Kohärenzwert, ein konkreter Insight und eine nächste Aktion. Nicht zehn vage Ratschläge. Einer. Der passt.*

---

*Danach zurück zu: stabilem Build, RevenueCat-Integration, Play-Store-Release.*
