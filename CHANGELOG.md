# Changelog – Resonance Engine / TheOrbit

## [2.0.0] – 2026-06-08

### Major Release

Diese Version markiert den Übergang von der Prototyp-Phase zur ersten vollständigen
Produktionsarchitektur. Frontend, Backend und Deployment-Stack sind stabil und Play-Store-fähig.

### Added

- **Resonance Memory Module** (`journal_extractor.py`, `omega_engine.py`)  
  Persistente Knotenzustände pro Nutzer; Zeitreihen-API (`/api/resonance/history`, `/api/resonance/echo`)
- **Omega-Kollaps** (`/api/resonance/omega`)  
  Spiralübergang mit T_Ω-Spektralfilter und Sonifikation
- **7 neue API-Endpoints** für Resonanzfeld, Echo, Sonifikation, Omega-Transition
- **resonance.tsx** – dedizierter Frontend-Screen für Resonanzgedächtnis und Kohärenz-Timeline
- **Immersive Web-UX** (Vercel) – vollständiges Web-Frontend via Expo Web Export
- **Layer-1 Mirror** (`mirror_layer1`) – klarsprachlicher Spiegel-Text pro Probe-Ergebnis
- **DailyAlignment, InsightFeed, StreakBadge** – neue UI-Komponenten
- **Onboarding-Flow** komplett überarbeitet
- **i18n-Basis** (`i18n.tsx`) für Mehrsprachigkeit vorbereitet

### Changed

- Coherence Engine: `v0.3` → `v2.0`
- `versionCode` Android: `2` → `3`
- Backend vollständig auf direktes Anthropic SDK (Claude Haiku) migriert
- `newArchEnabled: false` für stabile Android-Kompatibilität
- Reanimated auf `3.19.5` (old arch kompatibel)
- Vercel Build-Pipeline stabilisiert (`outputDirectory: frontend/dist`)
- Railway Deploy: uvicorn mit `on_failure` Restart-Policy

### Fixed

- Doppelte `app.include_router`-Aufrufe in `server.py` entfernt
- `orchestrator.py` von Null-Bytes und dupliziertem Code bereinigt
- `babel.config.js` wiederhergestellt (war überschrieben)
- `expo-modules-core` korrekte Version für SDK 54
- `react-native-svg` ersetzt durch pure RN (EAS-Kompatibilität)

### Infrastructure

- **Railway**: Backend (`FastAPI + uvicorn`), `rootDirectory: backend`
- **Vercel**: Web-Frontend (Expo Export), `outputDirectory: frontend/dist`
- **EAS Build**: Android `.aab` Production Build, `appVersionSource: remote`
- **MongoDB**: Atlas, persistent über Railway-Umgebungsvariable

---

## [1.0.0] – 2026-05 (Play Store Initial Submission)

- Erste vollständige Android-App (`versionCode: 2`)
- TheOrbit V6 — 8–24 Knoten, Phasen-Architektur, Cycle Engine
- Multi-Agent Layer (8 stateful agents)
- Kabbala-Simulation, Da'at-Knoten, Attraktor-Typen
- Layer-0 Probe + Aspects + Mirror
- EAS Build konfiguriert, Play Store Listing erstellt
