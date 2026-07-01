# SPEC - New Chat Continuation: TAURUS Audio, HCI_109 Focus, Premium Portal

Date: 2026-07-01

Project root:

```text
C:\HCI_REACT_WEB\REACT_WEB_TAURUS
```

## Purpose

Continuation handoff for a new chat.

This file records the approved state and the remaining implementation steps after:

- Premium athlete portal and login gating;
- HCI_109 focus/visada session recording;
- HCI_109 Admin review/governance;
- TAURUS Target audio-sequence Phase 1 and Duelo 20 Phase 2.

## Approved Architecture Rules

### Athlete Identity

For responsive/mobile/app-like athlete usage:

- `FREE` and `PREMIUM` athletes must use only the athlete identity from login.
- `FREE` and `PREMIUM` must not choose another athlete by selector.
- `ADMIN` may select athletes in Admin workflows.

### Access Rules

- `FREE`: Taurus/Target allowed, SmartChart locked, Library locked except allowed surfaces already defined by product rules.
- `PREMIUM`: SmartChart allowed, PDF allowed, approved HCI_109 technical Library area allowed.
- `ADMIN`: full access, athlete selector, approval/deletion/governance.

### HCI_109 Scope

HCI_109 does **not** own audio.

HCI_109 owns:

- focus/visada;
- fixed front-sight pointer;
- eye open/closed/blinks when camera is active;
- HCI - Ritmo session recording;
- HCI - Visada session recording;
- Admin approval/rejection/deletion;
- Resumo listing;
- comparative charts.

### TAURUS Audio Scope

Audio belongs only to TAURUS target flows:

```text
Humanoide
Cartoes Coloridos
Duelo 20
```

Audio/tempo must be attached to result-entry rows/disparos.

Audio must never block recording.

Manual timing must always remain allowed.

## Current Implemented State

### Premium Portal

Implemented:

- real login by lead/athlete name;
- no password;
- Clynson/Admin bootstrap already handled in app data;
- login sets active athlete;
- `FREE`/`PREMIUM` identity locked to login;
- `ADMIN` keeps athlete selector;
- PDF and SmartChart are premium-gated;
- Admin-only areas remain gated.

Key files:

```text
src/App.jsx
src/services/authService.js
src/services/subscriptionAccess.js
src/pages/AthleteLoginPage.jsx
```

### HCI_109 Focus And Recording

Implemented:

- HCI_109 trainer in Library;
- mode Ritmo and Visada;
- fixed pointer at top-center of front sight/maça;
- visual pointer displayed as subtle faded triangle inside maça;
- red circular trigger button labeled `GATILHO`;
- target area no longer fires on click/touch;
- trigger is enabled from green signal onward;
- 3 crossings at `-505` remain informational/guarantee-of-dynamics only, not a trigger block;
- eye open time = measured shot time minus `blinkCount * 0.35s`;
- blink count based on open-to-closed transitions;
- camera adds eye open/closed/blink support;
- iris tracking is experimental only.

Key files:

```text
src/pages/LibraryPage.jsx
src/engines/HciMovingFocusTrackerEngineV1.js
src/services/hci109SessionStore.js
```

### HCI_109 Governance

Implemented:

- sessions save as `PENDING_REVIEW`;
- Admin area `Administracao HCI_109`;
- Admin can select athlete;
- Admin can filter by status;
- Admin can approve, reject, delete;
- Resumo shows athlete HCI_109 sessions;
- Library comparison panel reads stored sessions.

Key files:

```text
src/pages/AdminPage.jsx
src/pages/DashboardResumo.jsx
src/services/hci109SessionStore.js
```

### TAURUS Target Timing / Audio Phase 1

Implemented:

- Humanoide: row/zone manual time input;
- Cartoes Coloridos: row/color manual time input;
- Duelo 20: per-shot manual time input;
- total time derived from partial row/shot times when present;
- direct total is secondary/legacy;
- saving works without timing;
- button `Aprovar sequencia de audio` exists.

Key file:

```text
src/pages/TaurusTargetPage.jsx
```

### TAURUS Duelo 20 Audio Phase 2

Implemented:

- `Audio Duelo 20` panel;
- `Iniciar audio`;
- `Parar audio`;
- Web Audio API microphone capture;
- fixed-threshold peak detection;
- echo/retrigger suppression at 260 ms;
- up to 20 suggested shots;
- audio does not auto-write table;
- `Aprovar sequencia de audio` applies suggested partial times to Duelo 20 shot table;
- shot payload can save:

```text
shotTimeSeconds
shotIntervalMs
audioSequenceIndex
audioSequenceStatus
audioPeak
```

Key files:

```text
src/pages/TaurusTargetPage.jsx
src/contracts/TAURUS_TARGET_AUDIO_SEQUENCE_PHASE2_DUEL20_STATUS_2026-06-30.md
```

### Taurus Target Layout

Implemented:

- Taurus Target cards adjusted so labels occupy top band horizontally;
- color dot anchored left;
- impact/time inputs below;
- Duelo 20 table gains horizontal scroll and compact cells;
- buttons and long labels wrap inside cards.

Key file:

```text
src/index.css
```

## Remaining Work

## Phase A - Validate Duelo 20 Audio V1

Goal:

Validate the current Duelo 20 microphone detection in-browser.

Tasks:

1. Open Taurus Target > Entrada > Duelo 20.
2. Click `Iniciar audio`.
3. Produce dry-fire/click/shot-like sounds.
4. Confirm the panel counts detected shots.
5. Click `Parar audio`.
6. Click `Aprovar sequencia de audio`.
7. Confirm shot times fill the Duelo 20 table.
8. Save session.
9. Confirm output/report still renders.

Likely tuning parameters:

```text
peak threshold: currently 0.24
minimum peak gap: currently 260 ms
maximum sequence length: 20
```

Acceptance:

- false positives are tolerable only if easy to clear/edit manually;
- manual edits always remain possible;
- save is not blocked by missing audio.

## Phase B - Add Clear/Reset Audio Sequence

Need:

Add a button near audio panel:

```text
Limpar sequencia de audio
```

Behavior:

- clears suggested audio sequence;
- does not clear manually typed shot scores/directions;
- optionally clears only timing fields if user confirms.

Acceptance:

- user can retry audio detection without rebuilding the entire Duelo table.

## Phase C - Make Audio Sensitivity Adjustable

Need:

Expose simple controls for Duelo 20 audio detection:

```text
Sensibilidade
Intervalo minimo entre disparos
```

Suggested initial UI:

- slider or numeric input for sensitivity;
- numeric input for min gap in ms;
- defaults remain current values.

Acceptance:

- noisy rooms can reduce sensitivity;
- quiet microphones can increase sensitivity.

## Phase D - Apply Audio Workflow To Humanoide

Need:

Implement audio suggestion for Humanoide result-entry rows.

Important:

Humanoide entry currently records counts by zone, not individual shot rows.

Therefore Phase D must decide one of two models:

1. **Row time model**: audio sequence suggests time per zone/row.
2. **Expanded shot table model**: Humanoide gets individual shot rows, then derives zone counts.

Recommended next step:

Start with row time model because it matches current UI and is less disruptive.

Acceptance:

- audio timing attaches only to Humanoide;
- manual timing remains allowed;
- total time derives from row times;
- recording is not blocked by missing audio.

## Phase E - Apply Audio Workflow To Cartoes Coloridos

Need:

Implement audio suggestion for Cartoes Coloridos result-entry rows.

Current model:

- row/card color count;
- row/color time input already exists.

Acceptance:

- audio sequence suggests row/card timing;
- manual timing remains allowed;
- total time derives from row times;
- no cross-target contamination.

## Phase F - Admin Audio Governance

Need:

Admin must be able to inspect audio/timing status for TAURUS target sessions.

Admin should show:

```text
targetType
audioSequenceStatus
durationSource
row/shot timing present
total time
```

Actions:

- approve target session as already exists;
- optionally reject timing sequence without deleting target result;
- delete/retry timing if needed.

Acceptance:

- Admin can distinguish manual timing from audio-suggested timing.

## Phase G - Output/Report Timing Display

Need:

Show derived timing in TAURUS output/report surfaces.

For Duelo 20:

- per-series time from sum of five shot times;
- total time from all shot times;
- per-shot time visible in table or detail view if space allows.

For Humanoide/Coloridos:

- row time;
- total time;
- duration source.

Acceptance:

- A4 PDF still fits one page;
- timing does not overflow report cards;
- no color-only meaning.

## Phase H - Smart Chart / Comparative Use Of Timing

Need:

Use approved timing fields in Smart Chart only after session approval.

Metrics:

```text
total time
time per shot
time consistency
timing trend by session
```

Acceptance:

- Smart Chart remains a visualizer;
- no duplicated TAURUS business logic in JSX.

## Phase I - Documentation Cleanup

Need:

Update or mark older HCI_109 docs that mention audio as a later phase.

Canonical rule:

```text
HCI_109 has no audio.
Audio belongs to Humanoide, Cartoes Coloridos, and Duelo 20.
```

Files to review:

```text
src/contracts/HCI_109_FOCUS_RECORDING_BEFORE_AUDIO_SPEC_2026-06-29.md
src/contracts/HCI_109_COMPARATIVE_CHARTS_STATUS_2026-06-29.md
src/contracts/HCI_MOVING_FOCUS_TRACKER_V1_STATUS_2026-06-29.md
```

## Validation Command

After each implementation slice:

```bash
npm.cmd run build
```

## Suggested First Prompt For New Chat

```text
Continuar a partir de:
C:\HCI_REACT_WEB\REACT_WEB_TAURUS\src\contracts\NEW_CHAT_CONTINUATION_SPEC_TAURUS_AUDIO_AND_HCI109_2026-07-01.md

Executar a Phase A: validar e ajustar o Duelo 20 Audio V1, mantendo audio como sugestao, sem bloquear gravacao, e sem tocar no HCI_109.
```

