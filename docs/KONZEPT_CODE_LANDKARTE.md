# Konzept ↔ Code — ehrliche Landkarte (RI / The Sphere / Coherence Journal)

Stand: 2026-05-21 · Code: `D:\GitHub\resonance-engine` · Quellen: 5 Vision-Papers aus Google Drive
(The Sphere · Einhaitskreis · Wellenausbreitung · Agenten-Vektor-Konzept · The orbit – main UX).
Noch nicht gelesen: *Working Draft v0.1*, *Manifest*.

## Kernaussage in einem Satz
Der Code ist eine **echte, lauffähige Verkörperung des Einheitskreis-/Kuramoto-Teils**
der Vision. Was die Papers darüber hinaus über „Wellen ersetzen LLMs", „kein Number
Crunching mehr", „quantum" behaupten, ist **im Code NICHT umgesetzt** — die App nutzt
für die Bedeutung weiterhin Claude-Haiku-Aufrufe.

---

## A) Was die Papers behaupten — und im Code wirklich steht (REAL)

| Paper-Konzept | Paper-Quelle | Code-Stelle | Status |
|---|---|---|---|
| 8 Häuser als fix verankerte Vektoren / Winkel (0°, 45° … 315°) | Einhaitskreis; The orbit (ℝ³-Vektortabelle) | `backend/houses.py`, `frontend/src/houses.ts` | ✅ umgesetzt |
| Agent = rotierender Vektor V = e^{iθ} = (cos θ, sin θ) | Einhaitskreis; Wellenausbreitung | `frontend/src/physics.ts` (Phasen auf dem Einheitskreis) | ✅ umgesetzt |
| Oszillation H_i(t) = A·sin(ωt+φ)·v̂ | The orbit (Oscillation Engine) | `physics.ts` | ✅ umgesetzt |
| Nachbar-Kopplung + Antipoden-Kopplung (Gegenpol = Phase π) | The orbit (Coupling), Einhaitskreis | PRD: `k_neigh·Σ(1−cos(q[h]−q[h+1]))`, `k_quad` Antipode-Lock | ✅ umgesetzt |
| Hamiltonian H = T + V, Stabilität bei E = 25 (Nullstelle) | The orbit (§6) | `physics.ts` Hamiltonian, C_E-Basin um E=25 | ✅ umgesetzt |
| Symplektischer Integrator (Verlet / Symplectic Euler) | The orbit; The Sphere | Velocity-Verlet (2. Ordnung) | ✅ umgesetzt |
| Kuramoto-Synchronisation Δθ = Σ A·sin(θⱼ−θₙ) | Einhaitskreis | SING-INDEX als Kuramoto-Ordnungsparameter R_l = \|Z_l\|, Z_l = (1/8)Σ e^{i·q[h,l]} | ✅ umgesetzt |
| Inkohärenz-/Nullstellen-Event (I < 0.05 → Snap, Bloom, Haptik) | The orbit (§9), The Sphere | Coherence-States COLD/WARM/SINGING/NULLSTELLE + expo-haptics | ✅ umgesetzt |
| Ghost-Vector / Vorwärtsprojektion der Trajektorie | The orbit (§10), The Sphere | `frontend/src/scene.ts` (1,2 s Forward-Projection) | ✅ umgesetzt |
| TheMap als Polarkoordinaten: θ = Haus/Rolle, r = Zyklus/Schicht | Wellenausbreitung | PRD-Vokabular, Schicht-Architektur | ✅ konzeptuell umgesetzt |
| 3 Schichten (Ground/Modulation/Faszien) → 24-Knoten-Tensor | (Erweiterung über Papers hinaus) | `physics.ts`-Rewrite, PRD v0.2 | ✅ umgesetzt (geht über Papers hinaus) |

→ Das ist die **starke, ehrliche Geschichte**: ein elegantes, energieerhaltendes
Resonanz-Instrument auf dem Einheitskreis, mathematisch sauber und lauffähig.

---

## B) Was die Papers behaupten, der Code aber NICHT tut (noch Vision / angreifbar)

| Behauptung in den Papers | Quelle | Realität im Code |
|---|---|---|
| „Wellen ersetzen 70-Mrd.-Parameter-LLMs" / „Alternative zu LLMs" | Einhaitskreis | ❌ App ruft 8 parallele **Claude-Haiku**-Probes pro Eintrag (`server.py`) |
| „Ende des Number Crunching" / „massive Energieeinsparung" | Einhaitskreis | ❌ nicht belegt; LLM-Calls verursachen reale Kosten pro Eintrag |
| „Sinfonische Intelligenz": Output = 8 Amplituden-Koeffizienten, selbst-reinigende Logik | Agenten-Vektor-Konzept | ❌ nicht implementiert; Geometrie ordnet LLM-Output an, erzeugt ihn nicht |
| „Quantum-adjacent" / Microsoft-Topological-Quantum-Bezug | Einhaitskreis | ❌ Marketing-Analogie, kein technischer Bezug im Code |
| Fourier zerlegt Aufgaben in 8 Agenten-Frequenzen | Agenten-Vektor-Konzept | ⚠️ FFT existiert nur in `ri-prototype/resonance_memory.py` (HRR-Binding), nicht in der App |
| „Zwiebel"-Resonanzgedächtnis / Jahresringe (radiales Wachstum r_{n+1}=r+βA) | Wellenausbreitung, Einhaitskreis | ⚠️ separat als `ri-prototype/resonance_memory.py` (HRR) — **nicht** in der App; Demo-Zahlen stehen noch aus |
| Deep-Link-Sharing (12-Byte Preset-String, virales Feature) | The Sphere | ❌ vorgeschlagen, nicht gebaut |

---

## C) Empfehlung für Seattle (woran man nicht umfällt)
1. **Zeigen, was real ist:** das laufende Einheitskreis-/Kuramoto-/Hamiltonian-Instrument
   (Punkte in Tabelle A) — Code mitbringen, live laufen lassen.
2. **Nicht behaupten, es ersetze LLMs.** Die App *nutzt* ein LLM und ordnet dessen
   Output geometrisch/resonant an. Genau das ist verteidigbar.
3. **RI/Zwiebel ehrlich als „neben dem LLM" positionieren** (semantischer Cache /
   assoziativer Speicher) — exakt wie es das Nordstrang-Paper selbst sagt — und mit
   der Kapazitätskurve untermauern, sobald `resonance_memory.py` durchgelaufen ist.
4. **Die Mathematik der Papers ist echt anschlussfähig** (Kuramoto, symplektische
   Integration, Fourier/HRR) — das ist die zitierbare Substanz. Die astrologischen /
   „Wassermann"-Bezüge gehören nicht in den technischen Pitch.

## Offene Punkte
- *Working Draft v0.1* und *Manifest* noch lesen (vermutlich Business/Vision) — auf Wunsch nachziehen.
- `ri-prototype/resonance_memory.py` ausführen → echte Kohärenz-Zahlen + Kapazitätskurve.
