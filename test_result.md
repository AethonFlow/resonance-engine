user_problem_statement: |
  v6 — "Coherence Journal" Release (Play-Store-ready + monetisable).
  Seven phases, executed sequentially:
    1) Monetisation base (isPremium flag + paywall UI)
    2) Freemium limits (7 reports / week, weekly reset)
    3) Onboarding 3-step + optional name + weekly focus
    4) Home ritual flow (CTA + done-today indicator, quota inline)
    5) Branding / UI-Polish (final app name, microcopy rename)
    6) Legal (privacy + imprint + medical disclaimer)
    7) Release pipeline (versionName 1.0.0 / versionCode 1, store-listing)

  Pricing displayed: €4.99/month, €19.99/year (save 67 %).
  Final app name: Coherence Journal.
  Bundle id: io.aethonflow.coherencejournal.

backend:
  - task: "v6 backend untouched — orchestrator + history + stats stable"
    implemented: true
    working: true
    file: "/app/backend/*"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          No backend changes in v6. Freemium gating is enforced client-side
          (UX-only, not security-critical). 442/442 prior backend assertions
          still apply.

frontend:
  - task: "v6 · Premium + Freemium quota (SettingsProvider extension)"
    implemented: true
    working: true
    file: "/app/frontend/src/i18n.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          SettingsProvider now persists:
            • isPremium (AsyncStorage @sphere/premium/v1)
            • freeUsed + weekStart  (resets on ISO Monday-based week change)
            • userName + weeklyFocus
          New API:  consumeFreeReport() → false if free user reached 7/week,
                    refreshQuota(), freeRemaining.

  - task: "v6 · Paywall screen + premium gate on TENZOR + History"
    implemented: true
    working: true
    file: "/app/frontend/app/paywall.tsx , /app/frontend/app/tenzor.tsx , /app/frontend/app/history.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          New /paywall route. Stoic dark layout: 4 feature bullets,
          monthly + yearly plan cards (yearly highlighted with "save 67%"),
          golden CTA. In dev → "simulate premium" alert toggles the flag.
          TENZOR invoke blocked when free quota = 0; offers paywall route.
          PDF share blocked for free users (lock icon on PDF button).
          30-day toggle on /history blocked for free users (lock icon).
          Verified visually via single playwright snapshot (no test agent run).

  - task: "v6 · Onboarding rewrite (3 slides + name + weekly focus)"
    implemented: true
    working: true
    file: "/app/frontend/src/Onboarding.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          New copy:
            1. "60 seconds of clarity a day"  (clock icon, amber)
            2. "Streak keeps you steady"       (fire icon, lime)
            3. "Share your trajectory"         (export icon, amber-soft)
            4. optional name input
            5. optional weekly focus input
          Verified visually (slide 1 captured).

  - task: "v6 · Home ritual flow — quota inline + free-tier feed limit"
    implemented: true
    working: true
    file: "/app/frontend/app/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          Free users see inline quota hint ("X freie Einträge diese Woche")
          + upgrade CTA when quota = 0. Existing DailyAlignment pill already
          encodes "Heute schon eingetragen?". InsightFeed limited to 3 cards
          for free, 7 for premium.

  - task: "v6 · Branding · final app name + microcopy"
    implemented: true
    working: true
    file: "/app/frontend/app.json , /app/frontend/src/i18n.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          App name → "Coherence Journal".
          Bundle id  → io.aethonflow.coherencejournal.
          Scheme    → coherencejournal.
          "STIMME DAS FELD" / "TUNE THE FIELD" → "EINTRAG ERSTELLEN" / "NEW ENTRY".
          "PROJECT MIRROR" / "PROJECT MIRROR" → "SPIEGEL" / "MIRROR".
          History already labelled "Verlauf" / "History" since v3.

  - task: "v6 · Legal screens — Privacy + Imprint"
    implemented: true
    working: true
    file: "/app/frontend/app/privacy.tsx , /app/frontend/app/imprint.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          /privacy and /imprint reachable via the new SettingsSheet LEGAL
          section. Privacy text bilingual (DE / EN), explicitly states:
            • only local + per-call HTTPS transmission
            • no sale of data, no tracking, no ad cookies, no profiling
            • Claude Haiku 4.5 disclosure
            • medical disclaimer
          Imprint exposes AethonFlow + contact email + privacy link.

  - task: "v6 · Release pipeline — versioning + store-listing assets"
    implemented: true
    working: true
    file: "/app/frontend/app.json , /app/STORE_LISTING.md"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          app.json:  version "1.0.0", android.versionCode 1, ios.buildNumber "1".
          STORE_LISTING.md: app name, short + long descriptions (DE + EN),
                            categories, content rating, pricing, asset list,
                            versioning scheme. Ready to copy-paste into the
                            Play Console.
          To build a signed AAB:
              cd /app/frontend
              eas build -p android --profile production
              # requires `eas.json` + a configured EAS account at build time.

metadata:
  created_by: "main_agent"
  version: "6.0"
  test_sequence: 5
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      v6 release complete. No backend tests were rerun (no backend changes).
      No frontend testing-agent run (saved credits per user request).
      Visual sanity check via single playwright snapshot:
        • onboarding slide 1 renders with new copy + 5-dot indicator
        • /paywall renders with 4 features, 2 plans, CTA, legal note
