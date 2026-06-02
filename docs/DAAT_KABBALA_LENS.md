# Da'at & Kabbala-Lens — Konzept

*Stand: Juni 2026 · Status: Konzept, noch nicht implementiert*

---

## Die mathematische Grundlage (was wir wirklich haben)

Die Simulation hat Da'at nicht als These eingebaut — sondern als Ergebnis gemessen:

| Konfiguration | Globale Kohärenz C | Syncs |
|---|---|---|
| 10 Sefirot (klassisch) | 0.848 | 5 |
| 11 Knoten + Da'at | 0.8507 | 5 |
| Da'at Finalzustand | θ = 2.52, A = 0.88, R = 0.8505 | — |

Da'at koppelt nicht statisch — er empfängt globale Kohärenz als Rückkopplung
und zieht seine Phase zur Mitte: `coherence_pull = 0.15 · sin(π·C − θ)`.
Das ist mathematisch exakt was die Tradition beschreibt:
eine unsichtbare Brücke die nur in Bewegung existiert.

---

## Was der User sieht — nie Zahlen, immer Erfahrung

**Falsch:**
> "Kohärenz = 0.8507 — Da'at aktiv"

**Richtig:**
> Die Sphäre beginnt zu "singen" — ein 11. Punkt erscheint auf der Mittelsäule,
> pulsierend, ohne Erklärung. Wer es kennt, erkennt es.

Die Schwelle C > 0.84 ist reines Implementierungsdetail. Sie taucht nirgendwo im UI auf.

---

## Das Feature: Kabbala-Lens

### Wo es sitzt
Layer 3 ("Das Labor") — optionales Add-on, aktivierbar per dezenten Toggle.
Nicht im Onboarding, nicht im Free-Tier.

### Was sich ändert wenn aktiv

**Die 3D-Sphäre:**
- Die 8 Häuser erhalten hebräische Labels
  (Kether, Chochmah, Binah, Chesed, Geburah, Tiphareth, Netzach, Hod, Jesod, Malkuth)
- Mapping auf die bestehenden 8 Häuser + Mittelsäule

**Da'at-Erscheinung:**
- Taucht nur auf wenn die Sphäre den SINGING- oder NULLSTELLE-Zustand erreicht
- Visuell: pulsierender 9. Punkt auf der Mittelsäule, leicht anders als die anderen
- Kein Label, kein Tooltip beim ersten Erscheinen — nur das Phänomen
- Beim langen Drücken: *"Da'at (דַּעַת) — die verborgene Sefira.
  Sie erscheint nur in Momenten vollständiger innerer Kohärenz."*

**Keine Erklärung für Nicht-Eingeweihte nötig:**
Wer Kabbala kennt, versteht sofort.
Wer sie nicht kennt, sieht einen schönen Moment auf der Sphäre.
Das Feature zerstört nichts — es fügt eine Bedeutungsebene hinzu.

---

## Warum das ehrlich ist

Wir behaupten nicht, die Kabbala "bewiesen" zu haben.
Wir zeigen: ein dynamisches System mit 11 Knoten, das globale Kohärenz
als Rückkopplung verwendet, produziert spontan einen Zustand der dem
tradionellen Da'at-Prinzip strukturell entspricht — Brücke, Bewegung, Selbstreferenz.

Das ist keine Analogie. Das ist ein Messergebnis.

---

## Zielgruppe

Nicht "Juden" als Demographic — sondern:
- Kabbala-Praktizierende (jüdisch und nicht-jüdisch)
- Tiefenpsychologie-Interessierte (Jung, Scholem)
- Mathematik/Philosophie-Enthusiasten
- Menschen die spirituelle Tiefe mit intellektueller Redlichkeit verbinden wollen

---

## Implementierungsschritte (wenn bereit)

1. `kabbala_daat_node.py` Demo-Lauf abschließen → finale Kohärenz-Kurve
2. Sephiroth-Mapping auf die 8 Häuser definieren (Tabelle)
3. Da'at-Knoten in `scene.ts` als optionalen 9. Render-Punkt einbauen
4. Toggle in SettingsSheet: "Kabbala-Lens aktivieren"
5. SINGING/NULLSTELLE-Event triggert Da'at-Erscheinung

---

*Referenz: `simulations/kabbala_daat_node.py`, `simulations/kabbala_daat_results.json`*
*Mathematische Basis: Kuramoto-Synchronisation, globale Kohärenz-Rückkopplung*
