user_problem_statement: |
  v5 release — "Resonance Journal" enrichment:
    1) App-Icon · Splash · Store-Assets in Sphere style (Google Play ready).
    2) Streak-Counter ("X days in a row aligned").
    3) 30-day view toggle in the History tab (Sparkline + streak).
    4) Insight-Journal — horizontal carousel of last 7 insights on Home.
    5) PDF / Text export of single resonance reports (Share API + expo-print).

  Plus: brainstorm marketing positionings for the Google Play Store.

backend:
  - task: "v5 — streak_current/streak_best on /api/tenzor/stats + new /api/tenzor/journal"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: |
          442/442 backend assertions PASS.
            • S/T   stats now exposes streak_current, streak_best (non-neg ints,
                    current ≤ best ≤ days). Sequential proof: clear → 0/0,
                    one happy POST → 1/1, layer-0 fail does NOT bump streak.
            • U/V   /api/tenzor/journal newest-first, max-30 clamped, 8 keys per entry.
            • W     limit=0 → 1, limit=200 → 30. Full v1+v2+v3+v4 regression green.
          Stats avg 146 ms over 3 samples through the public ingress.

frontend:
  - task: "Sphere-style app icons + splash + Play-Store feature graphic"
    implemented: true
    working: true
    file: "/app/frontend/assets/{icon,adaptive-icon,splash-icon,favicon,feature-graphic}.png"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          Generated programmatically (PIL):
            * icon.png             1024 x 1024  · launcher
            * adaptive-icon.png    1024 x 1024  · Android FG (transparent)
            * splash-icon.png      1242 x 2436  · iOS splash + wordmark
            * favicon.png           196 x  196
            * feature-graphic.png  1024 x  500  · Play Store
          All on deep-void background (#06080A), with three concentric
          orbit rings, 8 amber house dots, lime trine triangle and an
          amber core (Nullstelle). Verified visually via analyze_file_tool.
          app.json updated: splash + adaptive-icon backgroundColor → #06080A.

  - task: "StreakBadge on Home + inline streak in History"
    implemented: true
    working: true
    file: "/app/frontend/src/StreakBadge.tsx , /app/frontend/app/index.tsx , /app/frontend/app/history.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          Flame icon + current/best counter. Colour ramp:
              ≥7 amber · ≥3 amber-soft · ≥1 lime · 0 muted.
          Tap opens /history.
          Lives next to the DailyAlignment pill (single row).
          History page also shows inline streak block beside the
          7-day / 30-day range toggle.

  - task: "7 / 30-day toggle on /history sparkline"
    implemented: true
    working: true
    file: "/app/frontend/app/history.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          Two-pill toggle (7 TAGE / 30 TAGE). Re-fetches stats on change.
          Sparkline component already accepts arbitrary series length —
          gracefully renders 30 points with compressed x-labels.

  - task: "InsightFeed carousel on Home"
    implemented: true
    working: true
    file: "/app/frontend/src/InsightFeed.tsx , /app/frontend/app/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          Horizontal ScrollView with snap-to-card decoration.
          Each card shows state pill, score, 3-line insight, date.
          Tap → /history, with auto-refresh whenever a TUNE/INVOKE
          completes on Home (refreshKey from host state).

  - task: "Export reports — Text + PDF (expo-print + expo-sharing)"
    implemented: true
    working: true
    file: "/app/frontend/src/export.ts , /app/frontend/app/tenzor.tsx , /app/frontend/app/history.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          shareReportText() — universal Share API (works on iOS, Android, Web).
          shareReportPdf()  — expo-print → printToFileAsync(html) →
                              expo-sharing → shareAsync(uri, application/pdf).
          On web → graceful fallback to text share.
          Stoic HTML template (dark void, accented score, vector grid,
          insight + action blockquotes). Available on /tenzor (after INVOKE)
          and on every /history row when expanded.

metadata:
  created_by: "main_agent"
  version: "5.0"
  test_sequence: 4
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "testing"
    message: |
      v5 regression: 442/442 PASS. No fixes required.
