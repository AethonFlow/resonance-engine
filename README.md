# THE SPHERE / Coherence Journal

A stoic, single-pass resonance journal. Write one honest sentence a day, receive a
clear insight + next action in under two seconds. Tracks your streak and shows a
7‑30-day coherence trace. No feed, no ads, no tracking.

## Stack

- **Frontend** — Expo Router (React Native + TypeScript), three.js sphere, react-native-svg
- **Backend**  — FastAPI + MongoDB, Hamiltonian 24-knot physics engine
- **LLM**      — Claude Haiku 4.5 via Emergent LLM key, single-pass orchestrator
- **Mobile**   — Expo SDK 54, EAS Build (`production` profile builds an Android `.aab`)

## Layout

```
/app
├─ backend/            FastAPI service · /api/tenzor/*
│   ├─ server.py
│   ├─ orchestrator.py
│   ├─ aspects.py / houses.py
│   └─ config/         agents.json · flows.json · tenzor_orchestrator.txt
├─ frontend/           Expo app · expo-router file-based routes
│   ├─ app/            index.tsx · tenzor.tsx · history.tsx · paywall.tsx · privacy.tsx · imprint.tsx
│   ├─ src/            physics.ts · scene.ts · i18n.tsx · export.ts · …
│   ├─ assets/         icon.png · splash-icon.png · adaptive-icon.png · feature-graphic.png
│   ├─ app.json
│   ├─ eas.json
│   ├─ package.json
│   ├─ metro.config.js / babel.config.js / tsconfig.json
└─ STORE_LISTING.md    Play-Store copy (DE + EN)
```

## Build a signed Android Bundle

```bash
cd frontend
npx eas-cli login
npx eas-cli build -p android --profile production
```

Needs an existing Expo / EAS account (free tier OK). The resulting `.aab` is
ready to upload to the Google Play Console.

## Run locally

Backend:
```bash
cd backend
uvicorn server:app --reload --port 8001
```

Frontend:
```bash
cd frontend
yarn install
yarn expo start --web
```

The frontend talks to the backend via `EXPO_PUBLIC_BACKEND_URL` defined in
`frontend/.env` (not committed). All backend routes are prefixed with `/api`.
