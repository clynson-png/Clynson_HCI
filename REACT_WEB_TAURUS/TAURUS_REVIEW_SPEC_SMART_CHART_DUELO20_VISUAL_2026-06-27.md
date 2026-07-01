# TAURUS Review SPEC - Smart Chart, Target Engines, Duel 20 Prescription, and Visual Migration

Date: 2026-06-27
Project root: `C:\HCI_REACT_WEB\REACT_WEB_TAURUS`
Status: operational review spec

## Current Implemented Baseline

This project is already beyond the older migration specs from 2026-06-23. Treat those documents as historical anchors, not the current stop point.

The current TAURUS lane has:

- Dedicated target entry and output page in `src/pages/TaurusTargetPage.jsx`.
- Dedicated IndexedDB persistence in `src/services/taurusTargetStore.js` and `src/services/taurusTargetSchema.js`.
- Dedicated target intelligence services:
  - `src/services/taurusHumanoidIntelligence.js`
  - `src/services/taurusColorIntelligence.js`
  - `src/services/taurusDuelIntelligence.js`
- Smart Chart model builder in `src/services/taurusSmartChartEngine.js`.
- Smart Chart visualizer in `src/components/taurus/TaurusSmartChart.jsx`.
- Standalone Smart Chart route page in `src/pages/TaurusSmartChartPage.jsx`.
- Admin approval workflow in `src/pages/AdminPage.jsx` using `TaurusAdminResults`.
- Visual assets already present for TAURUS identity and targets:
  - `src/assets/taurus-logo-wordmark.png`
  - `src/assets/taurus-logo-symbol.png`
  - `src/assets/taurus-humanoid-real.png`
  - `src/assets/taurus-duel20-real.png`

The active workflow is:

1. TAURUS target entry creates a session as `PENDING`.
2. Admin reviews and changes workflow to `APPROVED` or `ARCHIVED`.
3. Smart Chart consumes only `APPROVED` sessions.
4. Target engines produce report readings and training recommendations from the training library.

## Non-Negotiable Boundaries

- TAURUS is its own product lane. Do not fold these changes into generic HCI Target or old ISSF mock behavior.
- Smart Chart is a visualizer. Keep business logic in `taurusSmartChartEngine.js` and the target intelligence services, not inside JSX.
- Do not consume `PENDING` or `ARCHIVED` sessions in Smart Chart prescriptions.
- Do not reopen the Rhythm migration while executing this TAURUS review.
- Preserve the separated TAURUS IndexedDB persistence. TAURUS target data must remain portable and distinct from the broader HCI snapshot.
- Preserve the Admin approval gate: `PENDING -> APPROVED -> ARCHIVED`.
- Keep canonical storage/contracts in English where practical; UI text can be Portuguese.

## Main Problems To Review

### 1. Smart Chart Engines

Current engine file: `src/services/taurusSmartChartEngine.js`

Review goals:

- Confirm that `buildTaurusSmartChartModel()` is the single orchestration point for Smart Chart model generation.
- Separate target-neutral Smart Chart calculations from target-specific intelligence.
- Make the engine explicitly accept:
  - approved sessions
  - athlete identity
  - target type
  - athlete view when available
  - phase or prescription context when it becomes available
- Remove or clearly quarantine demo/fallback data from production model output.
- Add explicit empty states instead of using fictitious default values when no approved sessions exist.
- Review the index formulas:
  - Humanoid: alpha/intermediate/peripheral weighting.
  - Color cards: distribution/balance formula.
  - Duel 20: score ratio against max score.
- Review trend and consistency:
  - current trend uses recent index delta.
  - consistency uses coefficient of variation over the recent window.
  - confirm thresholds with coach logic before treating as final intelligence.
- Review time prediction:
  - current implementation uses logarithmic regression over available `durationSeconds`.
  - currently time capture exists for Humanoid and Color.
  - decide whether Duel 20 should receive time capture or stay score/direction-only for now.

Acceptance criteria:

- Smart Chart returns an honest model with no invented session values.
- Empty state is valid when the athlete has no approved session for the selected target.
- All target-specific recommendation parameters come from the correct TAURUS engine.
- Build passes after changes.

### 2. Smart Chart Functioning and Visualizer

Current visual component: `src/components/taurus/TaurusSmartChart.jsx`

Review goals:

- Preserve Smart Chart as a premium visualizer fed by `buildTaurusSmartChartModel()`.
- Fix Portuguese text encoding issues visible in the component.
- Replace custom inline SVG icons with the shared icon approach if the project standardizes one.
- Remove hard-coded athlete/session copy such as fixed session counts when not backed by data.
- Replace chart fallback timeline/history with explicit "no approved sessions" state.
- Make target tabs fully data-aware:
  - Humanoide
  - Cartões Coloridos
  - Duelo 20
- Ensure the chart does not misrepresent the right axis:
  - efficiency line is percent.
  - time bar/prediction is seconds.
  - Duel 20 should not show time if no time data exists.
- Ensure the "Treino Principal" card points to the engine recommendation and shows fallback only when the library has no matching drill.

Acceptance criteria:

- No fictitious data appears as if it were real.
- Athlete name, session count, latest date, current index, best index, insights, and training recommendation all come from model data.
- Empty states are visually polished and operationally clear.
- Humanoide, Cartões Coloridos, and Duelo 20 can be switched without breaking layout.

### 3. Cards Coloridos: Functioning and Graphs

Current target engine: `src/services/taurusColorIntelligence.js`
Current output chart: `ColorPiePerformance` inside `src/pages/TaurusTargetPage.jsx`

Review goals:

- Validate the official LINADE 4-color rule card:
  - 2 series of 15 seconds.
  - 8 shots total.
  - 1 shot per color per series.
  - max score currently represented as 40.
- Confirm whether the current data entry by color count is enough, or whether each series needs its own row.
- Review the color-to-parameter mapping:
  - missing shots -> `TARGET_COLOR_IDENTIFICATION`
  - green -> `TARGET_AIMING`
  - blue -> `TARGET_TRIGGERING`
  - red -> `TARGET_GRIP`
  - yellow -> `TARGET_POSITION`
- Confirm with the user whether the color mapping is coach-approved or still provisional.
- Review the current pie and time chart:
  - pie shows distribution by color.
  - composed chart currently mixes time, predicted time, and shot count.
  - time should not appear as per-color data unless each color has a real timing field.
- Decide whether Color Cards need:
  - session-level time only, or
  - per-series time, or
  - per-color reaction/recognition time.

Acceptance criteria:

- Graphs match real captured data.
- The color chart does not create per-color time values from a session-level value.
- The report card shows engine-derived diagnosis, metrics, insights, and recommended training.
- The recommendation lookup remains tied to `PRECISION_COLOR`, `TARGET_BASIC`, `COLOR_CARD_BASIC`, `GENERAL_PREPARATION`.

### 4. Duelo 20 Engine Link and Prescription Intelligence

Current target engine: `src/services/taurusDuelIntelligence.js`
Current output chart: `DuelOctagonChart` inside `src/pages/TaurusTargetPage.jsx`

Review goals:

- Treat this as the beginning of deeper Duelo 20 prescription intelligence, not only chart rendering.
- Preserve existing rule support:
  - Duelo 20 25m.
  - Duelo 20 10m.
  - 20 shots.
  - 4 series of 5.
  - `X` center handling.
  - 10m currently maps `X = 12`; 25m maps `X = 10`.
- Review shot capture:
  - `shotNumber`
  - `seriesCode`
  - `score`
  - `directionCode`
  - derived total score
  - direction hit count
- Review whether prescription should use more than the current `PROCESS`/`TRANSFER` split.
- Proposed next prescription dimensions:
  - score efficiency
  - dominant error direction
  - repeated direction cluster
  - series drop-off
  - center/X retention
  - completion under rule
  - mode-specific threshold, 10m vs 25m
- Proposed expanded recommendation parameters:
  - `PROCESS`
  - `TRANSFER`
  - `TARGET_TRIGGERING`
  - `TARGET_AIMING`
  - `TARGET_POSITION`
  - `TARGET_GRIP`
  - `DECISION_SPEED`
  - `SERIES_CONSISTENCY`
- Before implementation, audit `src/data/training_library_canonical.json` to confirm which of these parameters actually have TAURUS-compatible drills.

Acceptance criteria:

- Duelo 20 diagnosis comes from real score and direction data.
- Prescription recommendation is explainable in the report card.
- Smart Chart can display Duelo 20 progression without using Humanoid/Color assumptions.
- Any new prescription dimension is backed by available captured data or added explicitly to the entry schema.

Increment closed on 2026-06-27:

- Manual Duelo 20 entry now captures execution time per series (`SR1` to `SR4`).
- Shot details persist `seriesTimeSeconds` with each shot, keeping the data available for the engine/report.
- The Duelo target preview and output render shot marks over the real target image.
- The directional chart uses octagon rings, not a star/radar grid.
- Directional dominance is calculated from IDD logic aligned with HCI:
  - `IDD = QTDE_TIROS * DIST_MEDIA_MM`
  - Duelo currently estimates `DIST_MEDIA_MM` from score loss because the entry does not yet capture exact XY coordinates.
  - When exact coordinates are added, the estimator must be replaced by real distance from center.
- The Duelo report includes `IDD direcional` and `Tempo por série` as official metrics.

### 5. Visual Identity Review

Current surfaces:

- `src/pages/TaurusTargetPage.jsx`
- `src/components/taurus/TaurusSmartChart.jsx`
- `src/components/taurus/TaurusAdminResults.jsx`
- `src/pages/AdminPage.jsx`
- `src/pages/TaurusSmartChartPage.jsx`
- `src/components/Sidebar.jsx`
- `src/index.css`

Review goals:

- Align TAURUS pages with the current accepted visual standard used by the newer app pages.
- Preserve TAURUS brand presence without turning the app into a landing page.
- Use real TAURUS assets already in `src/assets`.
- Clean up encoding-corrupted Portuguese labels before judging visual quality.
- Standardize:
  - page header density
  - target tabs
  - action buttons
  - table styling
  - approval cards
  - report cards
  - empty states
  - target output charts
- Avoid nested card stacks where page sections can be full-width bands or structured panels.
- Keep the UI operational and dense enough for repeated coaching use.

Acceptance criteria:

- TAURUS Target, Smart Chart, and Admin TAURUS review surfaces look like the same product.
- No page shows outdated mock identity or mismatched labels.
- No text overlap at desktop or mobile widths.
- The target photos/assets render clearly where they matter.

### 6. Migration Of Remaining Pages To Current Visual Pattern

Relevant pages to inspect after TAURUS review:

- `src/pages/DashboardResumo.jsx`
- `src/pages/IndicesPage.jsx`
- `src/pages/PlanoPage.jsx`
- `src/pages/LibraryPage.jsx`
- `src/pages/AdminPage.jsx`
- `src/pages/TaurusTargetPage.jsx`
- `src/pages/TaurusSmartChartPage.jsx`

Review goals:

- Identify which pages are already on the current accepted visual standard.
- List remaining pages that still show older layout, corrupted labels, or mixed identity.
- Migrate one page at a time.
- After each visual migration:
  - preserve data path.
  - preserve engines.
  - preserve user-approved behavior.
  - run build.
  - visually inspect the page.

Acceptance criteria:

- A page-by-page migration checklist exists before broad visual edits begin.
- Each page migration is narrow and testable.
- No visual migration changes engine calculations unless the SPEC explicitly opens that engine.

## Execution Order

Execute one item at a time:

1. Audit Smart Chart model honesty.
2. Remove or quarantine Smart Chart fallback/demo data.
3. Fix Smart Chart encoding and empty states.
4. Audit Color Cards engine and graph assumptions.
5. Audit Duelo 20 engine and define the first real prescription expansion.
6. Audit TAURUS Admin workflow display and approval actions.
7. Review TAURUS visual identity tokens and assets.
8. Create page-by-page remaining visual migration checklist.
9. Migrate remaining pages one by one.

## Validation Checklist

Use this checklist after implementation work:

- `npm.cmd run build`
- Open app at the active Vite origin.
- Confirm whether browser is using `localhost:5173` or `127.0.0.1:5173`.
- Create or identify one TAURUS session for each target:
  - Humanoide
  - Cartões Coloridos
  - Duelo 20
- Confirm new sessions are `PENDING`.
- Approve in Admin.
- Confirm approved sessions appear in Smart Chart.
- Confirm archived sessions disappear from Smart Chart.
- Confirm empty state appears when no approved sessions exist.
- Confirm no chart uses fallback data as production evidence.
- Confirm no console errors.
- Confirm no visible encoding corruption.

## Related Markdown Map

Historical specs in `src/contracts`:

- `CHATGPT_MIGRATION_SPEC_INDICES_2026-06-23.md`
- `CHATGPT_MIGRATION_SPEC_NEXT_5_HOURS_2026-06-23.md`
- `CHATGPT_MIGRATION_SPEC_TAURUS_TARGET_2026-06-23.md`
- `HCI_DERIVED_METRICS_ARCHITECTURE_2026-06-23.md`
- `README_SPEC_V4_1.md`
- `UNIFIED_SCHEMA_MASTER_V1.md`

More current TAURUS references:

- `src/contracts/TAURUS_SESSION_PERSISTENCE_LOSS_DEBUG_SPEC_2026-06-26.md`
- `src/contracts/TAURUS_ATHLETE_PERSISTENCE_AND_COMPARATIVE_DASHBOARD_SPEC_2026-06-25.md`
- `TAURUS_REVIEW_SPEC_SMART_CHART_DUELO20_VISUAL_2026-06-27.md`

Preview files in project root:

- `taurus-dashboard-resumo-preview.html`
- `taurus-indices-preview.html`
- `taurus-target-proposal-v2.html`
- `taurus-target-proposal.html`

## First Restart Step

Start with item 1:

Audit `src/services/taurusSmartChartEngine.js` and `src/components/taurus/TaurusSmartChart.jsx` together.

The first concrete implementation should remove or quarantine Smart Chart fallback/demo data so the visualizer never presents invented history, indexes, or session counts as if they were approved TAURUS results.
