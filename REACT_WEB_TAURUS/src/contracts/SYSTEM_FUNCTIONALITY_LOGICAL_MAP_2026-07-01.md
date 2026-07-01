# System Functionality And Logical Map

Date: 2026-07-01

Project root:

```text
C:\HCI_REACT_WEB\REACT_WEB_TAURUS
```

Purpose:

This document is a future consultation map for the implemented React Web TAURUS/HCI system. It lists the visible modules, their data links, persistence stores, access gates, and specific algorithms currently used by the application.

Canonical rule:

```text
Native system language: English for engines, APIs, JSON keys, database fields, internal codes and contracts.
Portuguese and other languages are UI translation layers.
Admin/source data and approved stores are the source of truth.
Viewer surfaces render normalized/approved data.
Smart Chart remains a visualizer.
```

## 1. Application Shell

Main file:

```text
src/App.jsx
```

Main responsibilities:

- Load base snapshot from `src/services/api.js`.
- Load persisted active snapshot from IndexedDB through `src/services/activeSnapshotStore.js`.
- Normalize the active snapshot through `src/services/unifiedSnapshotSchema.js`.
- Maintain current page state.
- Maintain selected athlete state.
- Maintain language state in `localStorage` key `hci_lang`.
- Maintain auth session through `src/services/authService.js`.
- Gate pages according to `authSession.access`.

Current visible sidebar items:

```text
Resumo
Admin
Taurus Target
Smart Chart
Plano
Biblioteca
```

Hidden but still coded:

```text
Indices
```

`IndicesPage` still exists and the `App.jsx` route still protects it, but the sidebar no longer exposes the tab.

## 2. Authentication And Access

Files:

```text
src/pages/AthleteLoginPage.jsx
src/services/authService.js
src/services/subscriptionAccess.js
```

Login behavior:

- Login is by lead/athlete name.
- No password flow is implemented.
- `loginWithLeadName()` searches `snapshot.leads` and `snapshot.athletes`.
- Auth session is stored in `localStorage` under `TAURUS_AUTH_SESSION_V1`.
- Subscription and role helpers are also stored in:
  - `TAURUS_SUBSCRIPTION_TIER`
  - `TAURUS_USER_ROLE`

Access matrix from `buildSubscriptionAccess()`:

| Capability | FREE | PREMIUM | ADMIN |
|---|---:|---:|---:|
| Taurus/Target | yes | yes | yes |
| Smart Chart | no | yes | yes |
| PDF export | no | yes | yes |
| Library full | no | no | yes |
| Library HCI_109 approved area | no | yes | yes |
| Indices | no | no | yes |
| Plano | no | no | yes |
| Admin | no | no | yes |

Identity rule:

- FREE/PREMIUM use athlete identity from login.
- ADMIN may select athletes.

## 3. Persistence Layers

### 3.1 Active HCI Snapshot

File:

```text
src/services/activeSnapshotStore.js
```

IndexedDB:

```text
DB: HCI_UNIFIED_DB_V1
version: 3
meta store: meta
data stores:
  leads
  pendingGroups
  approvedSubmissions
  shotSeries
  archivedIssfSessions
  prescriptions
  athlete360
  athletes
  sessionHeaders
  sessionSeries
  sessionShots
  unifiedPrescriptions
  athleteViewCache
```

Legacy target stores removed during upgrade:

```text
targetSessions
approvedTargetSessions
archivedTargetSessions
unifiedTargetSessions
```

Write algorithm:

1. Open IndexedDB.
2. Clear every configured table store.
3. Add an internal `__id` to each row using the best stable key available.
4. Write rows.
5. Store metadata:
   - `collections`
   - `dismissedPendingApprovalKeys`
   - `migratedAt`

Read algorithm:

1. Read `meta.collections`.
2. Load only known table stores.
3. Strip `__id`.
4. Rehydrate snapshot object.

### 3.2 TAURUS Target Sessions

Files:

```text
src/services/taurusTargetStore.js
src/services/taurusTargetSchema.js
```

IndexedDB stores:

```text
taurus_target_session
taurus_target_hit
meta
```

Session write behavior:

- `saveTaurusTargetSession(session)` writes the session header and its per-zone/per-shot hits.
- Existing hits for the same `sessionId` are deleted before writing the new hit set.
- Target sessions are independent from legacy HCI target/mock arrays.

Workflow updates:

```text
updateTaurusTargetSessionWorkflow(sessionId, workflowStatus, metadata)
deleteTaurusTargetSession(sessionId)
```

Known workflow statuses:

```text
PENDING_REVIEW
APPROVED
ARCHIVED
```

### 3.3 HCI_109 Sessions

File:

```text
src/services/hci109SessionStore.js
```

IndexedDB:

```text
DB: HCI_109_SESSION_DB_V1
store: hci109_session
keyPath: sessionId
```

Behavior:

- HCI_109 sessions save as `PENDING_REVIEW`.
- Admin can approve, reject, or delete.
- Approval changes `reviewFlag` to `ADMIN_APPROVED`.
- Rejection changes `reviewFlag` to `ADMIN_REJECTED`.

## 4. Unified Snapshot And Athlete View

Files:

```text
src/services/unifiedSnapshotSchema.js
src/services/athleteViewMapper.js
src/contracts/ATHLETE_VIEW_JSON_v4_1.js
src/contracts/README_SPEC_V4_1.md
```

Normalization responsibilities:

- Normalize athlete names.
- Normalize session type:
  - `TREINO` / `TRAINING` -> `TRAINING`
  - `SIMULADO` / `SIMULATION` -> `SIMULATION`
  - `COMPETICAO` / `COMPETITION` -> `COMPETITION`
- Normalize event status:
  - `PARCIAL` / `PARTIAL` -> `PARTIAL`
  - `FINAL` -> `FINAL`
- Derive canonical approved ISSF entities:
  - `sessionHeaders`
  - `sessionSeries`
  - `sessionShots`
- Derive athletes from leads and athlete360.
- Derive pending and archived ISSF headers.
- Preserve Admin lead access bootstrap.

Athlete View mapping:

```text
snapshot -> materializeSnapshotDerivedMetrics() -> ATHLETE_VIEW_JSON_V4_1
```

`mapSnapshotToAthleteView()` produces:

- metadata
- athlete identity
- summary
- indices
- rhythm
- targetIntelligence placeholder
- trainingPlan
- physicalTraining
- reports
- exportPackage

Rhythm algorithms in athlete mapper:

- Sessions are built from canonical `sessionHeaders`, `sessionSeries`, and `sessionShots`.
- Series median is used as `media`.
- Series STD is calculated against the median, not the arithmetic mean.
- `mainDropDepth` is the positive drop from previous series median.
- `breakCount` is `1` when a positive median drop exists.
- `rhythmPath` splits each 10-shot series into:
  - P1 = shots 1-3
  - P2 = shots 4-7
  - P3 = shots 8-10
  and stores the median of each part.

## 5. Dashboard / Resumo

File:

```text
src/pages/DashboardResumo.jsx
```

Role:

- Viewer/summary surface for the active athlete and active snapshot.
- Reads normalized snapshot data.
- Shows athlete-oriented state and approved/session-derived information.
- Does not own engines.

Architectural rule:

```text
Admin and stores own data/engine writes.
Resumo renders normalized data.
```

## 6. Admin

File:

```text
src/pages/AdminPage.jsx
```

Major functions:

- Import/export `ATHLETE_VIEW_JSON`.
- Manage leads.
- Manage ISSF pending approvals.
- Manage archived ISSF sessions.
- Manage TAURUS pending/approved/archived sessions through `TaurusAdminResults`.
- Manage HCI_109 sessions:
  - filter by athlete/status
  - approve
  - reject
  - delete
- Prescribe HCI_109 rhythm/sight sessions.

TAURUS Admin timing/audio display:

- Pending/approved/archived target tables show timing/audio status.
- Timing summary distinguishes:
  - `AUDIO_SEQUENCE`
  - `ROW_SUM`
  - `MANUAL_TOTAL`
  - fallback/no timing

## 7. TAURUS Target Entry

Main file:

```text
src/pages/TaurusTargetPage.jsx
```

Supported target types:

```text
HUMANOID
COLOR
DUEL20
```

Entry models:

### 7.1 Humanoide

Current model:

- Manual zone counts by humanoid zone.
- Optional row/zone time fields.
- No audio timing workflow implemented for Humanoide.

Product decision:

Audio alone cannot identify which impact landed in which humanoid zone, so Humanoide remains manual for timing/zone assignment.

### 7.2 Cartoes Coloridos

Current model:

- Fixed 8-shot table.
- Two 4-shot series.
- Fixed color sequence:

```text
T1 / T5 = Yellow
T2 / T6 = Green
T3 / T7 = Red
T4 / T8 = Blue
```

Audio rule:

- Audio capture works in 4-shot blocks.
- First approved audio sequence fills SR1 / T1-T4.
- Second approved audio sequence fills SR2 / T5-T8.
- Max series time: 15 seconds.

### 7.3 Duelo 20

Current model:

- 20 shots.
- 4 series of 5 shots.
- Session mode can affect scoring:
  - 25M: X = 10
  - 10M: X = 12
- Per-shot score/direction/time fields.

Audio rule:

- Capture is by series, not as one continuous 20-shot clock.
- Each audio capture detects up to 5 shots.
- Max series time: 20 seconds.
- Clock starts when `Iniciar audio` is pressed.
- Clock ends at the fifth shot or when stopped.
- Next series starts only after pressing `Iniciar audio` again.

Audio detection parameters:

```text
default peak threshold: 80 dB
max peak threshold: 200 dB
default min peak gap: 350 ms
Duelo max audio marks per capture: 5
Color max audio marks per capture: 4
```

Audio governance:

- Audio never writes official timing automatically.
- `Aprovar sequencia de audio` applies detected timing into visible result rows.
- Manual timing remains allowed.
- Saving remains allowed without audio.
- `Limpar sequencia de audio` clears suggested audio sequence and, with confirmation, can clear audio-applied timing fields without clearing scores/impacts.

Duration source:

```text
AUDIO_SEQUENCE
ROW_SUM
MANUAL_TOTAL
null
```

Total time rule:

```text
total time should derive from row/shot partial times when present.
direct total is secondary/legacy.
```

## 8. TAURUS Target Intelligence Algorithms

### 8.1 Decision Parameter Codes

File:

```text
src/services/taurusDecisionEngines.js
```

Used by:

- Humanoide analysis
- Cartoes Coloridos analysis
- Duelo 20 analysis
- Smart Chart recommendation lookup

The engines map session patterns into TAURUS parameter codes, then use those codes to find matching training-library entries.

### 8.2 Humanoide Intelligence

File:

```text
src/services/taurusHumanoidIntelligence.js
```

Input:

- TAURUS Humanoide session with `hits`, `totalShots`, `maxShots`.

Core calculations:

- `assignedShots = sum(hit.hitCount)`
- `zeroShots = max(0, maxShots - assignedShots)`
- Zone percentages use `maxShots` as denominator.
- Alpha = `ALPHA_HEAD + ALPHA_TORSO`
- Charlie = `CHARLIE_LEFT + CHARLIE_CENTER + CHARLIE_RIGHT`
- Delta = `DELTA_LEFT + DELTA_RIGHT + DELTA_LOWER`

Parameter inference:

1. If there are unregistered shots -> `POSITION`.
2. If impacts are spread across 4+ active zones and each top zone is <= 35% -> `AIMING`.
3. If dominant zone is `DELTA_RIGHT` or `DELTA_LOWER` -> `TRIGGERING`.
4. If dominant zone is lateralized (`CHARLIE_LEFT`, `CHARLIE_RIGHT`, `DELTA_LEFT`, `DELTA_RIGHT`) -> `GRIP`.
5. Default -> `AIMING`.

Output:

- report title
- parameter
- metrics
- insights
- recommended training from library
- key phrase

### 8.3 Cartoes Coloridos Intelligence

File:

```text
src/services/taurusColorIntelligence.js
```

Input:

- TAURUS Color session with color hits and timing.

Core calculations:

- `assignedShots = sum(hit.hitCount)`
- `zeroShots = max(0, maxShots - assignedShots)`
- Color percentages use `maxShots` as denominator.
- Top colors are sorted by percentage.

Parameter inference:

1. If `zeroShots > 1` -> `COLOR_IDENTIFICATION`.
2. If dominant color is `GREEN` -> `AIMING`.
3. If dominant color is `BLUE` -> `TRIGGERING`.
4. If dominant color is `RED` -> `GRIP`.
5. If dominant color is `YELLOW` -> `POSITION`.
6. Default -> `AIMING`.

Color Smart Chart timing:

- `buildTaurusColorChartModel()` sorts color sessions by `recordedAt`.
- Impact percent = `impactCount / maxShots * 100`.
- Predicted best time uses logarithmic regression over session sequence.

### 8.4 Duelo 20 Intelligence

File:

```text
src/services/taurusDuelIntelligence.js
```

Input:

- TAURUS Duelo 20 session.
- `shotDetailsJson` is parsed into per-shot details.

Core metrics:

- `scoreRatio = totalScore / maxScore`
- `xCount = count(score === X)`
- `seriesProfile`
- `directionProfile`
- `rhythmProfile`
- `totalIdd`

Series profile:

- Groups shots by `seriesCode` or by shot number.
- Sums score per series.
- Counts X per series.
- Stores series time if present.

Direction profile:

- Groups shots by `directionCode`.
- Estimates distance:

```text
distanceMm = max(0, maxShotScore - scoreValue) * 10
```

- Computes directional IDD:

```text
idd = hitCount * averageDistanceMm
```

Rhythm profile:

- Resolves interval from `shotIntervalMs`, or from elapsed shot times.
- Computes population standard deviation of intervals.
- Finds best frequency band from shots within 1 point of max observed score:

```text
bestBand.intervalSeconds = average interval of top shots
bestBand.shotsPerMinute = 60 / intervalSeconds
bestBand.averageScore = average score of top shots
```

Parameter inference:

1. If incomplete shot count or score ratio < 0.55 -> `BASE_REBUILD`.
2. If series total variation >= 10 -> `SERIES_STABILITY`.
3. If shot interval STD >= 1.2s -> `TIMING_CONTROL`.
4. If strongest direction cluster >= 35% of total shots -> `DIRECTIONAL_CONTROL`.
5. If score ratio >= 0.82 and X count <= 1 -> `CENTER_RETENTION`.
6. If score ratio is between 0.70 and 0.82 -> `TIMING_CONTROL`.
7. Directional sector fallback -> `DIRECTIONAL_CONTROL`.

## 9. Smart Chart

Files:

```text
src/pages/TaurusSmartChartPage.jsx
src/components/taurus/TaurusSmartChart.jsx
src/services/taurusSmartChartEngine.js
```

Access:

- FREE cannot render Smart Chart data/model.
- PREMIUM and ADMIN can render Smart Chart.

Data rule:

- Only approved TAURUS sessions are used.
- Smart Chart is a visualizer; it consumes `buildTaurusSmartChartModel()` and does not own TAURUS business rules in JSX.

Model pipeline:

```text
approved target sessions
-> filter by athlete
-> filter by active target
-> filter by selected date range
-> buildTaurusSmartChartModel()
-> visual charts + history + recommendations
```

Range options:

```text
7 days
30 days
90 days
All
```

History row algorithm:

- Sort approved sessions by `recordedAt`.
- For each session:
  - calculate target-specific index
  - calculate alpha/intermediate/peripheral percentages where applicable
  - detect dominant zone
  - detect biggest opportunity
  - compare with previous index for per-row trend

Index algorithms:

Humanoide:

```text
index = ((alpha * 1.0 + intermediate * 0.55 + peripheral * 0.2) / total) * 100
```

Color:

```text
average = total hits / number of color zones
deviation = average absolute deviation from average
balance = max(0, 1 - deviation / max(average, 1))
index = balance * 100
```

Duelo 20:

```text
index = totalScore / maxScore * 100
```

Trend algorithm:

- Uses last 5 valid history rows.
- If fewer than 3 rows -> `INSUFFICIENT_DATA`.
- If last-first >= 5 and improving steps >= declining steps -> `CONSISTENT_IMPROVEMENT`.
- If last-first <= -5 and declining steps >= improving steps -> `CONSISTENT_DECLINE`.
- If absolute delta <= 3 -> `STABLE_PATTERN`.
- Otherwise slight improvement/decline by sign.

Consistency algorithm:

- Uses last 5 valid index values.
- Requires at least 3 values.
- Calculates mean, population variance, standard deviation, and coefficient of variation.
- Classification:
  - CV < 2 -> `VERY_CONSISTENT`
  - CV < 5 -> `CONSISTENT`
  - CV < 8 -> `OSCILLATING`
  - otherwise -> `UNSTABLE`

Training level algorithm:

- `ELITE` if:
  - current index >= 80
  - at least 3 sessions
  - consistency is `VERY_CONSISTENT` or `CONSISTENT`
- Otherwise `BEGINNER`.

Time prediction:

- Uses logarithmic regression:

```text
y = intercept + slope * ln(sequence)
```

- Applied to:
  - Smart Chart session duration prediction
  - Color Cards best time prediction
  - Duelo 20 median score/time prediction by series

Duelo 20 Smart Chart:

- Uses last 4 approved Duelo 20 sessions.
- Builds median score by series.
- Builds median time by series.
- Builds logarithmic prediction series for median score and median time.

Report visibility rule:

- Smart Chart A4 report is hidden by default.
- Clicking `Generate Report / Gerar relatorio` reveals the report inside the Smart Chart area.
- PDF generation is available from the revealed report.

## 10. Reports And PDF

Files:

```text
src/components/reports/A4ReportShell.jsx
src/components/reports/PremiumLockedAction.jsx
src/pages/TaurusTargetPage.jsx
src/components/taurus/TaurusSmartChart.jsx
```

Report shell:

- Shared A4 report layout.
- Accepts translated labels through `labels`.
- Does not force Portuguese labels when UI is English.

Target output reports:

- Output tab displays detailed target report.
- Premium A4 report exists for:
  - Humanoide
  - Cartoes Coloridos
  - Duelo 20
- `Gerar relatorio PDF` prints the A4 report area with `body.taurus-print-a4`.

Smart Chart report:

- Hidden until explicitly requested.
- Uses approved-session Smart Chart model.
- Uses translation layer for visible labels.

## 11. HCI_109 Focus / Visada

Files:

```text
src/pages/LibraryPage.jsx
src/engines/HciMovingFocusTrackerEngineV1.js
src/services/hci109SessionStore.js
src/components/visualFocus/MovingFocusTrackerPanel.jsx
src/components/visualFocus/MovingFocusOverlay.jsx
src/components/visualFocus/VisualFocusMetricsCard.jsx
```

Scope:

```text
HCI_109 has no audio.
Audio belongs to TAURUS Target flows only.
```

HCI_109 owns:

- focus/visada
- fixed front-sight pointer
- eye open/closed/blinks when camera is active
- HCI - Ritmo session recording
- HCI - Visada session recording
- Admin approval/rejection/deletion
- Resumo listing
- comparative charts

Focus frame classification:

Inputs:

- `gaze`
- `phase`
- `movingObject`
- `blackCircle`
- `yAxisCorridor`
- `tolerance`

Classification order:

1. No gaze -> `NO_GAZE_DETECTED`.
2. Phase not `DESCENT` -> `IDLE`.
3. Outside Y corridor -> `ERROR_LEFT_Y_AXIS`.
4. Looking at black circle but not moving object -> `ERROR_LOOKED_AT_BLACK_CIRCLE`.
5. Looking at moving object and inside corridor -> `OK_FOLLOWING_MOVING_OBJECT`.
6. Otherwise -> `ERROR_NOT_FOLLOWING_MOVING_OBJECT`.

Moving-object detection:

- Gaze is considered on object if it is inside object bounding box plus tolerance.

Black-circle detection:

- Euclidean distance from gaze to circle center <= radius.

Y-axis corridor:

- Rectangular inclusion against `xMin`, `xMax`, `yMin`, `yMax`.

Visual metrics algorithm:

- Counts frames per status.
- Calculates duration per status using timestamp deltas capped at 250 ms per frame.
- Blink metrics use eye open/closed transitions.
- `blinkCount` increments on open-to-closed transition.
- `eyeOpenPct = eyeOpenMs / measuredMs * 100`.
- Visual discipline score:

```text
score = 100
  - blackCircleFixationPct * 1.5
  - yAxisDeviationPct * 1.2
  - lostFocusPct * 1.0
```

- Score is clamped 0-100.

Interpretation:

```text
>= 90 -> EXCELLENT_VISUAL_DISCIPLINE
>= 75 -> GOOD_VISUAL_DISCIPLINE
>= 60 -> UNSTABLE_VISUAL_DISCIPLINE
else  -> CRITICAL_VISUAL_DISCIPLINE_FAILURE
```

## 12. Library / Training

Files:

```text
src/pages/LibraryPage.jsx
src/services/trainingLibraryService.js
src/services/trainingLibraryCustomStore.js
src/services/trainingPlanEngine.js
```

Training library:

- Provides technical training entries.
- Includes HCI_109 entry.
- Supports custom training entries persisted in IndexedDB:

```text
DB: HCI_TRAINING_LIBRARY_DB
store: hci_training_library
```

Training recommendation engine:

Input:

- athlete view
- coach input
- training library

Filtering algorithm:

1. Filter by athlete level if training has `levelCode`.
2. Filter by athlete discipline if training has `discipline`.
3. If no target/opportunity filter is requested, return level/discipline matches.
4. If target/opportunity is requested, filter by:
   - `training.parameter === primaryOpportunity`
   - `training.targetType === targetType`
5. If no filtered match exists, fallback to level/discipline matches.

Output:

- engine recommendations
- coach prescriptions
- prescribed trainings
- clickable training details

Manual coach prescriptions rule:

- Coach prescriptions do not overwrite engine recommendations.
- They live separately under:
  - `trainingPlan.coachPrescriptions`
  - `physicalTraining.coachPrescriptions`

## 13. Plano

File:

```text
src/pages/PlanoPage.jsx
```

Access:

- Admin only.

Role:

- Builds and manages training plan/prescription data.
- Uses athlete identity and snapshot context.
- Works with training engine concepts but keeps manual coach prescription separate from engine recommendations.

## 14. Indices

File:

```text
src/pages/IndicesPage.jsx
```

Current state:

- Page and `App.jsx` route still exist.
- Sidebar tab is hidden.
- Access remains Admin-only if reached programmatically.

Role:

- Displays HCI indices and parameter readings from normalized snapshot/derived metrics.

## 15. SIUS / HCI IA Import

Files:

```text
src/components/ImportSiusVideoPanel.jsx
src/services/hciSiusVideoIngestEngine.js
src/services/hciSiusShotDetectionEngine.js
src/services/hciSiusFrameVisionEngine.js
src/services/hciSiusFrameReadingEngine.js
src/services/hciSiusCalibrationEngine.js
```

Role:

- Build source package for HCI IA/import workflow.
- Import returned JSON.
- Review editable Admin table.
- Save approved HCI IA session into active snapshot.

Important boundary:

- This is an Admin/import workflow.
- It is not an athlete-facing PDF report.
- It should not be treated as real-time Smart Chart logic.

## 16. Translation Layer

File:

```text
src/i18n/translations.js
```

Rules:

- Internal codes stay English.
- UI labels come from `translations`.
- Shared report shell accepts translated labels through `reportLabels`.
- Smart Chart report labels are no longer hardcoded in JSX.

Known note:

- Some older files/contracts contain historical Portuguese prose or status notes.
- This does not change the canonical code/data rule; it reflects project documentation history.

## 17. Current Product Boundaries

### TAURUS vs HCI_109

```text
TAURUS Target owns audio/timing for target result rows.
HCI_109 owns focus/visada and session governance.
HCI_109 has no audio.
```

### Admin vs Viewer

```text
Admin/source workflows write, approve, govern and export.
Viewer surfaces render normalized or approved data.
```

### Smart Chart

```text
Smart Chart consumes approved TAURUS sessions.
Smart Chart visualizes trends, consistency, recommendations and reports.
Smart Chart does not duplicate TAURUS session business logic in JSX.
```

### Report Visibility

```text
Target Output report appears in Output workflow.
Smart Chart report appears only after Generate Report / Gerar relatorio.
PDF export is premium/admin gated.
```

## 18. Main Restart Pointers

If resuming work, start from these files by topic:

| Topic | Start here |
|---|---|
| App routing/access | `src/App.jsx` |
| Sidebar visibility | `src/components/Sidebar.jsx` |
| Login/access gates | `src/services/authService.js`, `src/services/subscriptionAccess.js` |
| Active snapshot persistence | `src/services/activeSnapshotStore.js` |
| Unified schema | `src/services/unifiedSnapshotSchema.js` |
| Athlete view export/render contract | `src/services/athleteViewMapper.js`, `src/contracts/ATHLETE_VIEW_JSON_v4_1.js` |
| TAURUS entry/output/audio | `src/pages/TaurusTargetPage.jsx` |
| TAURUS persistence | `src/services/taurusTargetStore.js` |
| Humanoide engine | `src/services/taurusHumanoidIntelligence.js` |
| Color engine | `src/services/taurusColorIntelligence.js` |
| Duelo 20 engine | `src/services/taurusDuelIntelligence.js` |
| Smart Chart engine | `src/services/taurusSmartChartEngine.js` |
| Smart Chart UI/report | `src/components/taurus/TaurusSmartChart.jsx` |
| Admin TAURUS tables | `src/components/taurus/TaurusAdminResults.jsx` |
| HCI_109 focus engine | `src/engines/HciMovingFocusTrackerEngineV1.js` |
| HCI_109 store | `src/services/hci109SessionStore.js` |
| Library/training | `src/pages/LibraryPage.jsx`, `src/services/trainingLibraryService.js` |
| Reports shell | `src/components/reports/A4ReportShell.jsx` |

## 19. Build Validation

Standard validation command:

```bash
npm.cmd run build
```

Current known non-blocking warning:

```text
Vite reports some chunks larger than 500 kB after minification.
```
