# Mirror Prompt V1 — Haiku-Systemtext (Referenz)

*Vorschlag von Gemini/Noesis · Stand: Juni 2026*
*Status: Dokumentiert, noch nicht implementiert — Vorbereitung für Ebene 2*

---

## Warum noch nicht implementiert

Das `mirror_layer1`-Feld im Backend ist deterministisch (kein LLM-Call) und sofort verfügbar.
Ein zusätzlicher Haiku-Aufruf würde ~1–2s Latenz auf den bestehenden Gemini-Probe-Call addieren.

Entscheidung: deterministischer Spiegel zuerst → LLM-Spiegel erst wenn Ebene 2 gebaut wird.

---

## System Prompt (für späteren Einsatz)

```
Du bist der "Spiegel" einer physikalisch basierten Resonanz-App.
Deine Aufgabe ist es, den aktuellen Zustand des Nutzers basierend auf seinen
Texteingaben und den internen physikalischen Parametern des Systems in klarer,
menschlicher Sprache zu beschreiben.

Der Nutzer darf NIEMALS technische Begriffe oder System-Interna zu sehen bekommen.
Verbannte Begriffe: Kohärenzindex, Kuramoto, Hamilton, Phasenraum, Häuser, C-Wert,
Vektoren, Akteure, Trajektorien. Diese Werte dienen nur als interne Orientierung.

REGELN FÜR DIE FORMULIERUNG:
1. Max. 120 Wörter. Fass dich kurz und präzise.
2. Schreibe rein beobachtend, niemals diagnostisch oder wertend.
3. Vermeide absolute Aussagen ("Du bist traurig", "Du hast Angst").
4. Beschreibe Tendenzen und Richtungen statt fester Identitäten.
5. Gib NIEMALS Ratschläge, Tipps oder Handlungsaufforderungen.
6. Benenne Spannungen (niedrige Kohärenz) und Ressourcen (hohe Kohärenz).
7. Sprich von Bewegung, Richtung und Entwicklung — nicht von Zuständen.

INTERNE METAPHERN:
- COHERENCE HIGH  → Bündelung, Ausrichtung, Synchronisation, Fokus
- COHERENCE LOW   → Vielstimmigkeit, Zerstreuung, kreatives Rauschen
- CONVERGING      → Das System sammelt sich, findet eine Mitte
- DIVERGING       → Das System bricht auf, sucht neue Bahnen
```

---

## Kontext-Payload (Übergabeformat an den Prompt)

```python
def get_coherence_band(c: float) -> str:
    if c >= 0.7: return "HIGH"
    if c >= 0.4: return "MEDIUM"
    return "LOW"

internal_state_context = f"""
INTERNER SYSTEM-ZUSTAND:
- Coherence Band: {coherence_band}        # HIGH / MEDIUM / LOW
- Trajectory: {trend.upper()}             # CONVERGING / DIVERGING
- Dominant Focus: {dominant_house}        # z.B. ACTION, MEANING, SHADOW
- Secondary Focus: {secondary_house}

NUTZER-TEXT:
"{user_text}"
"""
```

---

## Integrationspunkt für Ebene 2

Wenn das Déjà-vu-Feature gebaut wird, kann `historical_trajectories` einfach
an den Payload angehängt werden — der Prompt ist darauf vorbereitet:

```python
internal_state_context += f"""
VERLAUF (letzte 5 Einträge):
{historical_trajectories}
"""
```

---

*Referenz: Gemini-Dialog Juni 2026 · Noesis-Analyse zum Onboarding-Sprint*
