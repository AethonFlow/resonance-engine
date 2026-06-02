# Coherence Journal — Store-Readiness (ehrliche Bewertung)

Stand: 2026-05-21 · Repo: `D:\GitHub\resonance-engine`

## Kurzantwort
Ja, daraus lässt sich eine verkaufbare App machen — und der Abstand ist **kleiner**,
als der letzte Eindruck vermuten ließ. Das Produkt ist bereits scharf positioniert
("Coherence Journal", ein Eintrag/Tag → Insight + Aktion), und die meiste Release-Arbeit
(Onboarding, Branding, Legal-Texte, Store-Listing, Versionierung 1.0.0) ist gemacht.

Aber: Es gibt **einen harten Blocker**, der zwischen "läuft" und "verkaufbar" steht —
es ist **keine echte Bezahlung eingebaut**. Mit dem aktuellen Stand kannst du
niemandem Geld abnehmen.

---

## Der eine Blocker: Bezahlung ist nur Attrappe
- `frontend/app/paywall.tsx` zeigt nur eine UI. Der "Kaufen"-Button öffnet einen
  Dialog mit einem **"simulate premium"**-Schalter, der lokal ein Flag setzt.
- `package.json` enthält **keine** Billing-Bibliothek (kein `react-native-iap`,
  kein RevenueCat, kein Play Billing).
- Das Freischalten von Premium passiert **nur clientseitig** (laut Testprotokoll
  "UX-only, not security-critical"). Das heißt: jeder könnte es umgehen — und vor
  allem fließt **kein Cent**.

→ Ohne echte In-App-Käufe (Google Play Billing / Apple IAP, am einfachsten über
   RevenueCat) ist die App nicht verkaufbar. Das ist Arbeitspaket Nr. 1.

---

## Die vollständige Lückenliste bis "Store-live" (Android zuerst)

| # | Lücke | Warum nötig | Aufwand (grob) |
|---|---|---|---|
| 1 | **Echte In-App-Käufe** (RevenueCat o. Play Billing), Abo-Produkte im Play Console anlegen, Kauf wiederherstellen | Ohne das kein Verkauf; Play verlangt für digitale Abos zwingend Play Billing | mittel–groß |
| 2 | **Backend hosten** (FastAPI + MongoDB + LLM-Key) statt localhost; `EXPO_PUBLIC_BACKEND_URL` auf echte URL | App ruft das Backend bei jedem Eintrag; muss öffentlich erreichbar sein | mittel |
| 3 | **LLM-Kosten/Key klären**: läuft über "Emergent LLM Key". Für Produktion eigener Anthropic-Key + Kosten pro Eintrag einkalkulieren (jeder Eintrag = mehrere Haiku-Calls) | Laufende Betriebskosten müssen vom Abo gedeckt sein; `emergentintegrations` fehlt sogar in requirements.txt | klein–mittel |
| 4 | **Google Play Developer-Konto** (einmalig 25 USD) | Pflicht zum Veröffentlichen | klein |
| 5 | **Signierten Release-Build (.aab)** via EAS bauen | Play akzeptiert nur signierte App-Bundles | klein |
| 6 | **Screenshots** (mind. 2× 1080×1920) — laut Store-Listing noch offen | Pflichtfeld im Store-Eintrag | klein |
| 7 | **Öffentliche Datenschutz-URL** (nicht nur In-App-Screen) | Play verlangt eine im Web erreichbare Privacy-Policy-URL | klein |
| 8 | **Daten-Sicherheits-Formular** im Play Console (Data Safety) + AI/Content-Angaben | Pflicht-Deklaration vor Veröffentlichung | klein |
| 9 | **Account-/Daten-Löschung** (Play verlangt Löschpfad, wenn Konten/Daten existieren) | Play-Richtlinie | klein–mittel |
| 10 | **Testlauf auf echtem Gerät** (Closed Testing Track) vor Produktion | Play empfiehlt/braucht Test-Phase; fängt reale Bugs | mittel |

iOS (App Store) kommt später: eigenes Apple-Developer-Konto (99 USD/Jahr) + Apple-IAP.
**Empfehlung: erst Android sauber live bringen, dann iOS.**

---

## Realistische Reihenfolge
1. Entscheidung: **RevenueCat** (deutlich schneller, kostenlos bis ~2,5k USD/Monat Umsatz)
   oder natives Play Billing.
2. Billing einbauen + Abo-Produkte anlegen → Paywall mit echtem Kauf verdrahten.
3. Backend deployen + Produktions-LLM-Key + Kosten pro Eintrag messen.
4. Play-Konto, Pflicht-Formulare, Datenschutz-URL, Screenshots.
5. Closed Testing → Fix → Produktion.

## Was ich sofort übernehmen kann
- Billing-Integration (RevenueCat) in `paywall.tsx` + SettingsProvider einbauen.
- `emergentintegrations` / Key-Handling in `requirements.txt` und server.py geradeziehen.
- Eine Schritt-für-Schritt-Deploy-Anleitung fürs Backend schreiben.
- Die Play-Console-Pflichtangaben (Data Safety, Datenschutz) als Checkliste vorbereiten.

## Was nur du kannst (Konten/Geld/Entscheidungen)
- Google-Play- (und ggf. Apple-) Konto eröffnen und bezahlen.
- Bankdaten/Steuerprofil für Auszahlungen hinterlegen.
- Entscheiden: RevenueCat vs. Play Billing; Hosting-Anbieter wählen.
