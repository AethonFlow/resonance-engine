user_problem_statement: |
  v4 release — "Resonance Journal" foundation:
    1) Daily Alignment indicator on the Home screen
       ("Aligned today" / "Not aligned today" pill).
    2) Structural foundation for a daily reminder service
       (local notification scheduling on iOS/Android, persistent toggle on web).
    3) 7-day Coherence Sparkline at the top of the History tab.
    4) GitHub push of the verified v4 codebase to AethonFlow/resonance-engine.

  Design language must remain stoic, noble, dark — aligned with the Sphere.

backend:
  - task: "GET /api/tenzor/stats — daily aggregate + sparkline series"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          New endpoint:
              GET /api/tenzor/stats?days=N      (1 ≤ N ≤ 60, default 7)
          Returns:
              {
                days, today (YYYY-MM-DD), today_aligned, today_count,
                today_score, today_state,
                series: [{date, count, avg_score, max_score, aligned, last_state} * days]
              }
          Aligned semantics: `aligned == max_score >= 0.60` for a day.
          UTC calendar-day bucketing. Empty days are filled with nulls
          so the frontend can render gaps cleanly in the sparkline.
          Local curl verified:
            • days=7 with 0 data  -> all buckets null, today_aligned=false
            • after one call score 0.946 -> today_aligned=true, today_score=0.946
            • after 4 calls today_count=4, max_score = highest score of the day
      - working: false
        agent: "testing"
        comment: |
          v4 backend regression executed against public ingress
          https://resonance-engine-1.preview.emergentagent.com/api.
          Result: 390 assertions / 388 PASS / 2 FAIL.

          Failing assertions (both same root cause):
            ✗ Q-stats-clamp-days=0: days clamped to 1  (got days=7)
            ✗ Q-stats-clamp-days=0: len(series) == 1   (got len=7)

          ROOT CAUSE: GET /api/tenzor/stats?days=0 is NOT clamped to 1 —
          the backend treats days=0 as falsy/missing and falls back to
          the default (7). days=-5 correctly clamps to 1, days=200
          correctly clamps to 60. Likely the handler uses something
          like `days = days or 7` instead of `max(1, min(60, days))`.
          Spec requires:
              days=0   -> days == 1, len(series) == 1
              days=-5  -> days == 1
              days=200 -> days == 60

          Everything else PASSES:
            • N) default days=7   — all top/series keys correct, today
                 UTC, series sorted ASC, series[-1]==today, null
                 max_score when count==0, aligned semantics correct.
            • O) days=1, P) days=60 — len matches exactly.
            • R) round-trip — clear → invoke(en) → stats(days=1):
                 today_count==1, today_aligned matches threshold,
                 series[0].max_score == invoke.score (0.787, WARM,
                 history_id UUID). Layer-0 fail does NOT bump count.
            • Full v1+v2+v3 regression: invoke happy/DE/EN, layer-0
                 DE+EN, validation 422 (empty body / empty string),
                 boundary 2000 OK / 2001 → 422, /tenzor meta
                 (timeout_ms == 8000), /tenzor/history list/delete/
                 clear, save=false (no insert), /, /health, /houses (8),
                 /aspects (8), /probe, /tune, presets CRUD,
                 snapshots CRUD.

          Timing (3 wall-clock samples of GET /tenzor/stats default):
                min = 115 ms, avg = 119 ms, max = 121 ms.
          Invoke timing: happy 1781/1871/4116 ms; EN 1667/2209 ms;
          DE 1541/1762 ms.

          Verdict: endpoint is fully correct except for the days=0
          clamping branch. Main agent should fix the days handler to
          clamp BEFORE the default fallback (apply max(1, min(60,
          days)) when param is provided, even if value is 0).
      - working: true
        agent: "testing"
        comment: |
          Re-verified Q-clamping cases against public ingress:
            ✓ GET /api/tenzor/stats?days=0   -> HTTP 200, days=1,  len(series)=1
            ✓ GET /api/tenzor/stats?days=-5  -> HTTP 200, days=1,  len(series)=1
            ✓ GET /api/tenzor/stats?days=200 -> HTTP 200, days=60, len(series)=60
          Verdict: days clamping now correct in all branches. Endpoint fully working.
      - working: true
        agent: "testing"
        comment: |
          v5 regression executed against public ingress
          https://resonance-engine-1.preview.emergentagent.com/api.
          Result: 442 assertions / 442 PASS / 0 FAIL.

          NEW v5 assertions ALL PASS:
            ✓ S) GET /tenzor/stats (default + days=30) — top-level keys
                 now include streak_current and streak_best, both non-neg
                 ints, streak_current <= streak_best, streak_best <= days.
            ✓ T) Streak logic sequential:
                 - DELETE /tenzor/history (clear) → 200
                 - GET /tenzor/stats?days=7 → streak_current=0, streak_best=0
                 - POST /tenzor/invoke "I am about to start." en
                     → score 0.742, state=WARM
                 - GET /tenzor/stats?days=7 → streak_current=1, streak_best=1
                 - POST /tenzor/invoke "x" (layer-0 fail, NOT saved)
                     → state=INSUFFICIENT_DATA
                 - GET /tenzor/stats?days=7 → streak_current STILL 1
            ✓ U) GET /tenzor/journal → HTTP 200, list, len <= 7,
                 newest first (created_at DESC), each entry has keys
                 id/created_at/input/state/score/insight/action/lang;
                 score is float; lang in {de, en}.
            ✓ V) GET /tenzor/journal?limit=1 → HTTP 200, len == 1.
            ✓ W) limit=0 → HTTP 200, len == 1 (clamped to 1).
                 limit=200 → HTTP 200, len <= 30 (clamped to 30).
            ✓ X) Regression: v1+v2+v3+v4 still green — invoke happy/DE/EN,
                 layer-0 DE+EN, validation 422, boundary 2000 OK / 2001 → 422,
                 /tenzor meta (timeout_ms=8000), history list/delete/clear,
                 save=false (no insert), /, /health, /houses (8), /aspects (8),
                 /probe, /tune, presets CRUD, snapshots CRUD, stats default,
                 days=1/60, clamping 0/-5/200, round-trip layer-0 doesn't bump count.

          Timing (3 wall-clock samples GET /tenzor/stats default):
              min = 115 ms, avg = 146 ms, max = 164 ms.
          Invoke timing: happy 7183/2006/2306 ms; EN 1966/1718 ms;
          DE 1713/1744 ms.

          Verdict: streak fields + journal feed fully working. Endpoint
          fully correct, no regressions.

frontend:
  - task: "Sparkline component (react-native-svg)"
    implemented: true
    working: true
    file: "/app/frontend/src/Sparkline.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          Stoic SVG line chart. Plots TenzorDayDTO.series[i].max_score for
          each of the last 7 days. Renders:
            * dashed 0.60 alignment threshold line with label
            * accent colour = amber > 0.85, amber-soft > 0.60, lime > 0.30, crimson else
            * day highest-score dot enlarged
            * date labels (latest emphasised in accent)
            * compact avg / hi / lo header
          Gracefully degrades to a "no data yet" empty state.
          react-native-svg installed via `expo install`.

  - task: "DailyAlignment indicator on Home"
    implemented: true
    working: true
    file: "/app/frontend/src/DailyAlignment.tsx , /app/frontend/app/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          Stoic pill rendered just below the top HUD.
          Refreshes from /api/tenzor/stats?days=1 on mount + on every TUNE
          success (refreshKey tick from the host screen) + when the app
          returns to foreground (AppState change).
          Tapping opens /history. Tooltip explains the alignment rule
          (score >= 0.60).

  - task: "Daily reminder framework (expo-notifications, web fallback)"
    implemented: true
    working: true
    file: "/app/frontend/src/notifications.ts , /app/frontend/src/SettingsSheet.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          notifications.ts provides:
            isNotificationsSupported(), requestNotificationPermission(),
            scheduleDailyReminder(hour, minute, lang), cancelDailyReminder(),
            getStoredReminder() / setStoredReminder()  (AsyncStorage)
          SettingsSheet now exposes:
            • Toggle: "Daily resonance reminder"
            • 4 time presets: 07:00, 12:00, 19:00, 22:00
            • Web → clear unsupported notice; preference still persisted
          Localised title + body strings in DE and EN.
          expo-notifications installed via `expo install`.

  - task: "Sparkline integration on /history"
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
          /history now loads both history and stats in parallel
          (Promise.all). Sparkline rendered at the very top of the list
          with a "?" tooltip next to it. Manual playwright check confirmed:
            • Sparkline visible with 0.60 dashed line
            • avg / high / low header reads correctly
            • dates labelled with current day in accent
            • tooltip opens with the localised explanation

metadata:
  created_by: "main_agent"
  version: "4.0"
  test_sequence: 3
  run_ui: false

test_plan:
  current_focus:
    - "GET /api/tenzor/stats — daily aggregate + sparkline series"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      v4 backend regression. Please test the NEW stats endpoint and confirm
      previous v3 surfaces still pass.
  - agent: "testing"
    message: |
      v4 backend run COMPLETE against public ingress.
      390 assertions / 388 PASS / 2 FAIL.

      Only failing case: GET /api/tenzor/stats?days=0 returns days=7
      (default fallback) instead of clamping to 1. Other clamp cases
      (days=-5 → 1, days=200 → 60) work correctly. Likely culprit is
      a `days = days or 7` style branch in the handler — should be
      `max(1, min(60, days))` applied unconditionally.

      All other v4 N/O/P/R assertions PASS, including the full round
      trip (clear → invoke EN happy → stats reflects today_count=1
      with aligned tied to >= 0.60, layer-0 fail does NOT increment
      today_count). Full v1+v2+v3 regression also green (invoke
      DE/EN/layer-0, validation, boundary 2000/2001, /tenzor meta
      timeout_ms==8000, history list/delete/clear, save=false,
      /, /health, /houses, /aspects, /probe, /tune, presets and
      snapshots CRUD).

      /api/tenzor/stats wall-clock timing (3 samples, default days=7):
          min = 115 ms, avg = 119 ms, max = 121 ms.

      Only N/O/P/Q/R test cases were appended to /app/backend_test.py;
      no other test was modified, and NO backend / frontend / .env /
      supervisor files were touched.

      NEW v4 ASSERTIONS — GET /api/tenzor/stats
      =========================================

      N) GET /api/tenzor/stats              (default days=7)
         - HTTP 200
         - response keys: days, today, today_aligned, today_count,
                          today_score, today_state, series
         - days == 7
         - today matches strftime('%Y-%m-%d') in UTC for "now"
         - len(series) == 7
         - each series item has keys: date, count, avg_score, max_score,
                                       aligned, last_state
         - series is sorted ascending by date
         - series[-1].date == today

      O) GET /api/tenzor/stats?days=1
         - HTTP 200, days == 1, len(series) == 1
         - series[0].date == today

      P) GET /api/tenzor/stats?days=60
         - HTTP 200, days == 60, len(series) == 60

      Q) GET /api/tenzor/stats?days=0
         - HTTP 200, days clamped to 1
         - GET /api/tenzor/stats?days=200 -> HTTP 200, days clamped to 60

      R) After a fresh POST /api/tenzor/invoke {"input":"...","lang":"en"}
         that yields state != INSUFFICIENT_DATA AND save defaulted true:
         - GET /api/tenzor/stats?days=1
         - response.today_count >= 1
         - response.today_aligned == (response.today_score >= 0.60)

      Regression
      ==========
      All v1+v2+v3 endpoints still work:
         /api/tenzor/invoke (DE / EN happy paths, layer-0 fail, validation),
         /api/tenzor/history (list + delete one + clear all),
         /api/tenzor meta,
         /, /health, /houses (8), /aspects (8), /probe, /tune,
         presets CRUD, snapshots CRUD.

  - agent: "testing"
    message: |
      v5 backend run COMPLETE against public ingress.
      442 assertions / 442 PASS / 0 FAIL.

      NEW v5 endpoints verified:
        • GET /api/tenzor/stats now exposes streak_current + streak_best
          (non-neg int, current <= best, best <= days).
        • Streak logic sequential (clear → invoke happy → stats → layer-0
          → stats): 0→1→1 transitions correct, layer-0 input='x' does
          NOT bump streak (not saved).
        • GET /api/tenzor/journal: default limit=7, list newest-first,
          each entry has id/created_at/input/state/score/insight/action/lang.
        • limit=1 returns exactly 1. limit=0 clamped to 1. limit=200
          clamped to 30 (len <= 30).

      Full v1+v2+v3+v4 regression also green: invoke DE/EN happy + layer-0,
      validation 422 (empty body / empty string), boundary 2000 OK/2001 422,
      /tenzor meta timeout_ms=8000, /tenzor/history list/delete/clear,
      save=false (no insert), /, /health, /houses (8), /aspects (8),
      /probe, /tune, presets CRUD, snapshots CRUD, stats days=1/7/60,
      clamping 0/-5/200, round-trip count semantics.

      /api/tenzor/stats wall-clock (3 samples, default days=7):
          min = 115 ms, avg = 146 ms, max = 164 ms.

      Only v5 S/T/U/V/W test functions appended to /app/backend_test.py;
      STATS_TOP_KEYS extended to include streak_current/streak_best.
      No other change; NO backend / frontend / .env / supervisor files touched.
