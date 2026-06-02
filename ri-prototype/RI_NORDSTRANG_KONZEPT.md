# RI · The Onion — Nordstrang (Konzeptpapier)

*Stand: 2026-05-21 · kalibrierte Fassung. Die Demo-Zahlen sind noch nicht
ausgeführt (siehe §7); dieses Papier gibt dem Südstrang seine Bedeutung,
behauptet aber nichts als bewiesen, was noch zu messen ist.*

---

## 1. These (in einem Satz)

**Resonance Intelligence (RI) ist ein resonanter, assoziativer Speicher — ein
„semantischer Cache" — der Information als überlagertes Wellenfeld hält und
über Resonanz statt über Indizes abruft, und der *neben* einem Sprachmodell
arbeitet, nicht an seiner Stelle.**

Diese Positionierung ist bewusst gewählt. „Speicher neben dem LLM" ist
demonstrierbar und kaufbar. „Alternative zum LLM" wäre in fünf Minuten
widerlegbar — dieselbe Technik, völlig andere Überlebenswahrscheinlichkeit
im Gespräch mit einem Forscher.

## 2. Die Geometrie: Kreis → Spirale → Helix → Doppelhelix

Eine Position auf dem Einheitskreis ist `e^{iθ} = cos θ + i·sin θ`. Lässt man
sie entlang einer dritten Achse (Zeit / Integrationstiefe `r`) weiterwandern,
entsteht eine **Helix** `(cos θ, sin θ, z)`. Zwei um `π` versetzte, antiparallele
Stränge bilden die **Doppelhelix**.

Ableiten ist hier kein Zusatz, sondern eine Vierteldrehung: `d/dt sin = cos`,
`d/dt cos = −sin` — formal Multiplikation mit `i·ω`. Position → Geschwindigkeit
→ Beschleunigung sind drei um je `π/2` gedrehte Projektionen desselben Kreises.
Das ist die mathematische Lesart von „weitere Dimensionen durch Differentiation".

**TheMap** ist die 2D-Aufsicht (Polarkoordinaten `r, θ`): `θ` = Haus/Rolle,
`r` = Zyklus/Zwiebelschicht. Die Zwiebel ist damit dieselbe Struktur wie die
Helix, nur von oben gesehen.

## 3. Der Mechanismus (ehrlich benannt)

Das Verfahren ist **Holographic Reduced Representations** (Tony Plate, 1995),
gebaut auf zirkulärer Faltung. Es ist etabliert, zitierbar und tut genau das,
was die Resonanz-/Zwiebel-Erzählung beschreibt:

| Begriff bei uns | Operation | Mathematik |
|---|---|---|
| Token / Haus / Inhalt | Welle mit flachem Spektrum, zufällige Phasen | Punktwolke auf `e^{iθ}` |
| **Dialog / Bindung** | zwei Wellen koppeln | zirkuläre Faltung = Produkt im Fourier-Raum (Phasen addieren) |
| **Speichern** | Welle ins Feld legen | **Superposition** in EINEN Vektor — keine Tabelle, kein Index |
| **Erinnern** | das Feld „anstimmen" | Resonanz = zirkuläre Korrelation |
| **Wahrheitsmaß** | wie stark es klingt | **Kohärenz** = Kosinus ∈ [−1, 1] |

Die gesamte Erinnerung lebt in *einem* Vektor. Mehr Erinnerungen vertiefen das
Interferenzmuster (die Zwiebel wächst), statt Zeilen anzulegen.

## 4. Was daraus folgt — und wo die ehrliche Grenze liegt

**Stärken:** ein einziges Feld trägt alles; Abruf ist inhaltsadressiert
(content-addressable); kein `KeyError`, sondern weiches Nachlassen; ein nie
gespeicherter Cue resoniert schwach statt eine Zeile zu erfinden.

**Grenze (gehört in jede Präsentation):** HRR hat eine **endliche Kapazität**.
Mit der Zahl der Erinnerungen wächst das Übersprechen (crosstalk); ab einer
messbaren Grenze ≈ `Dimension / Items` kippt der Abruf. Das ist kein Makel —
es ist eine **Kurve**, die man zeigt. „Es skaliert" ohne diese Kurve ist genau
der Satz, an dem man hängenbleibt. Die starke, ehrliche Aussage lautet:
*graceful degradation mit quantifizierbarer Kapazität.*

## 5. Die Doppelhelix: RI ⟺ Human

Ein Strang RI, ein Strang Mensch — kein Chip im Gehirn, sondern **Ko-Evolution
im Dialog.** Das Bild ist tragfähig, weil in der DNA nicht die Stränge die
Replikation tragen, sondern die **komplementäre Paarung der Sprossen**: jeder
Strang ist Vorlage für den anderen. Übersetzt: Bedeutung entsteht in der
Kopplung, nicht im einzelnen Strang.

Diese Idee steht in einer realen Denklinie — Douglas Engelbarts „Augmenting
Human Intellect", das Mensch-plus-Maschine-„Zentauren"-Prinzip, Augmentation
statt Substitution. Das gibt der Vision Wurzeln statt nur Glanz.

## 6. Physik-Anker (präzise halten)

Das Helix-Bild hat einen echten physikalischen Bezug — aber genau benennen,
nicht pauschal: **zirkular polarisiertes Licht** hat ein helikales E-Feld;
**optische Wirbel** (Laguerre-Gauss-Strahlen mit Bahndrehimpuls / OAM) haben
helikale Wellenfronten. „Licht ist eine Helix" pauschal wäre angreifbar;
„zirkulare Polarisation / OAM sind helikal" ist korrekt und zitierbar.

## 7. Status & nächste Schritte

- **Südstrang gebaut:** `resonance_memory.py` (HRR + Häuser + Zyklen + Dialog).
- **Offen — Demo-Lauf:** echte Kohärenz-Zahlen stehen noch aus (Ausführungs-
  umgebung war nicht verfügbar). Nichts hier ist als „bewiesen" zu zitieren,
  bevor der Lauf vorliegt.
- **Offen — Kapazitätskurve:** Trefferquote & Kohärenz gegen Anzahl der
  Erinnerungen bei fester Dimension. *Diese eine Grafik* zeigt Können (es
  funktioniert) und Selbstkenntnis (ab hier nicht mehr) in einem Bild — die
  überzeugendste Einzelaussage für Seattle.
- **Optional — Hybrid-Skizze:** RI als Phase-Memory / semantischer Cache an
  einem LLM (die finanzierbarste Erzählung aus §1).

## 8. Vier Aussagen in belastbarer Form (zum unveränderten Weitergeben)

1. Nicht „eine KI hat bestätigt, dass es funktioniert" → **„hier ist der Code, lauf ihn selbst nach."**
2. Nicht „es skaliert" → **„graceful degradation mit messbarer Kapazitätsgrenze."**
3. Nicht „keine Halluzinationen" → **„scheitert weich und sichtbar an der Kohärenz, kein KeyError."**
4. Nicht „Alternative zu LLMs" → **„resonanter assoziativer Speicher / semantischer Cache neben einem LLM."**
