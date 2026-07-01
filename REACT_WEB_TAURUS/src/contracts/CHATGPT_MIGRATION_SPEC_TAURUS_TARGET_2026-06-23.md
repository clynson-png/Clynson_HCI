# ChatGPT Migration SPEC: Taurus Target

Date: 2026-06-23  
Project root: `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web`

## Mission

Continue the TAURUS Target module without Codex, using ChatGPT as the next operator.

This SPEC is for the React app only.

The goal is to keep moving the TAURUS target front with:
- separate TAURUS storage
- manual target entry
- target-specific output charts
- no dependency on the old mock HCI Target flow

## Non-Negotiable Rules

1. Everything old from mock `HCI Target` is deprecated and must stay removed.
2. TAURUS is a separate module from the old ISSF/mock target logic.
3. TAURUS storage must stay isolated from legacy target arrays.
4. The SQL/storage idea for TAURUS is separate because later TAURUS will carry only this SQL.
5. Change one thing at a time.
6. Do not rebuild the app from zero.
7. Preserve the working React navigation and current TAURUS page entry point.
8. Prefer surgical edits in existing files.

## Current Confirmed State

### Navigation and app wiring

TAURUS is already reachable in the React app.

Main files:
- `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\App.jsx`
- `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\components\Sidebar.jsx`
- `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\i18n\translations.js`

### Old mock target removal already done

The previous mock target path was removed/neutralized from the main React flow.

Files already touched for that cleanup:
- `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\pages\DashboardResumo.jsx`
- `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\pages\AdminPage.jsx`
- `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\services\athleteViewMapper.js`
- `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\services\unifiedSnapshotSchema.js`
- `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\services\activeSnapshotStore.js`

### TAURUS storage already exists

TAURUS has its own local IndexedDB structure.

Files:
- `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\services\taurusTargetSchema.js`
- `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\services\taurusTargetStore.js`

Current header/session fields already include:
- `sessionId`
- `athleteName`
- `targetType`
- `sessionMode`
- `sessionLabel`
- `notes`
- `maxShots`
- `maxScore`
- `totalShots`
- `totalScore`
- `shotDetailsJson`
- `recordedAt`
- `updatedAt`

### TAURUS page already exists

Main page:
- `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\pages\TaurusTargetPage.jsx`

Style file:
- `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\index.css`

Current page areas:
- `Entrada de Dados`
- `Saída`

Current target types:
- `Humanoide`
- `Cartões Coloridos`
- `Duelo 20`

## Current TAURUS Behavior

### Humanoide

The humanoid image was replaced with a real cropped asset and is now the active visual base.

Current humanoid asset:
- `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\assets\taurus-humanoid-real.png`

Current humanoid logic in `TaurusTargetPage.jsx`:
- target zones are currently mapped to:
  - `ALPHA_HEAD`
  - `ALPHA_TORSO`
  - `CHARLIE_LEFT`
  - `CHARLIE_CENTER`
  - `CHARLIE_RIGHT`
  - `DELTA_LEFT`
  - `DELTA_RIGHT`
  - `DELTA_LOWER`
- overlay markers are active again on top of the real asset
- zone meaning shown in UI:
  - `Alpha`: head and central lethal torso
  - `Charlie`: torso surround / intermediate
  - `Delta`: peripheral / lowest

Important:
- user repeatedly rejected fake or redrawn humanoids
- keep using the real asset approach, not a custom SVG redraw

### Cartões Coloridos

Color target is manual entry and output pie chart.

Rule already inserted in UI:
- LINADE 4 colors
- 2 series of 15 seconds
- 4 shots per series
- 1 shot per color
- total default shots = 8
- total max score = 40

### Duelo 20

Rule already partially implemented:
- `25m` and `10m` modes
- `20` shots
- `4` series of `5`
- center `X`
- `10m`: `X = 12`
- `25m`: `X = 10`
- max score:
  - `240` for `10m`
  - `200` for `25m`

Current duel target board already exists and center white logic for `10m` was implemented.

Current duel point-by-point support is partially present:
- `duelShots` local state exists
- `totalScore` exists in session payload
- `shotDetailsJson` exists in storage payload
- helper functions for duel shots and score parsing exist in `TaurusTargetPage.jsx`

Important warning:
- the `Duelo 20` entry area was under active refactor during the last work
- visually it may still need cleanup to fully match the ISSF-style data-entry table

## Files You Must Inspect First

Before any TAURUS change, inspect these files in this order:

1. `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\pages\TaurusTargetPage.jsx`
2. `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\index.css`
3. `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\services\taurusTargetStore.js`
4. `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\services\taurusTargetSchema.js`
5. `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\App.jsx`
6. `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\components\Sidebar.jsx`
7. `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\i18n\translations.js`

For historical safety, also know these files were already changed in the target cleanup:
- `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\pages\DashboardResumo.jsx`
- `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\pages\AdminPage.jsx`
- `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\services\athleteViewMapper.js`
- `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\services\unifiedSnapshotSchema.js`
- `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web\src\services\activeSnapshotStore.js`

## Current Stop Point

The current stop point is:

1. Humanoid now uses a real cropped image asset.
2. The user wants the humanoid to stay image-based, not mock-like.
3. Humanoid zone reading must respect `Alpha / Charlie / Delta`.
4. Duel 20 must support zone plus point-by-point scoring input and session total.
5. Color target rule is already documented in the screen.

## What ChatGPT Should Do Next

### Priority 1 - Stabilize Humanoide

Objective:
- keep the real humanoid asset
- refine zone overlay positions on top of the real image
- do not reintroduce SVG mock bodies

Do:
- inspect `HUMANOID_LAYOUT` in `TaurusTargetPage.jsx`
- adjust overlay marker positions only
- keep the image in `src/assets/taurus-humanoid-real.png`

Do not:
- replace the real asset with another custom SVG
- move humanoid logic back into old HCI target paths

Done means:
- markers sit on the correct real target zones
- the humanoid looks like a real target, not a dashboard mock

### Priority 2 - Finish Duelo 20 Table

Objective:
- make Duelo 20 entry look and behave like an ISSF-style manual shot table

Do:
- keep `4 series x 5 shots`
- each cell must capture:
  - score
  - direction/zone
- keep per-series total
- keep session total score
- save full shot detail into `shotDetailsJson`

Done means:
- the coach can manually enter all 20 shots
- total score is visible before save
- saved session preserves shot-by-shot detail

### Priority 3 - Improve Output Readability

Objective:
- keep TAURUS output charts usable without making the target visuals noisy

Do:
- keep radial/pie/octagon output
- keep total shots
- keep total score where applicable
- avoid overly decorative overlays over the real target image

## Validation Checklist

After every change, validate:

1. `TAURUS` still appears in the sidebar.
2. App still opens `TaurusTargetPage`.
3. `Humanoide`, `Cartões Coloridos`, and `Duelo 20` tabs still switch correctly.
4. Manual save still works.
5. Build passes with:
   - `npm run build`
6. No old `HCI Target` mock block reappears in `Resumo` or `Admin`.

## Required Working Method For ChatGPT

For each future step:

1. read the files listed above
2. patch one area only
3. run build
4. describe exactly what changed
5. stop after each user-visible change

## Hard Do-Not-Do List

Do not:

- rebuild TAURUS from zero
- move TAURUS data back into legacy target arrays
- use the old removed mock target path
- replace the real humanoid image with another invented drawing
- mix TAURUS persistence into generic ISSF session storage
- make large unrelated UI refactors while finishing targets

## One-Paragraph Handoff Prompt For ChatGPT

Use this if starting a new ChatGPT thread:

`Continue the React TAURUS Target migration in C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web. The TAURUS page already exists in src/pages/TaurusTargetPage.jsx with separate storage in src/services/taurusTargetSchema.js and src/services/taurusTargetStore.js. Old mock HCI Target logic is deprecated and must stay removed. The humanoid must keep using the real asset src/assets/taurus-humanoid-real.png and only marker positions/zones should be refined. Duel 20 must be finalized as 4 series of 5 shots with point-by-point score plus direction entry and visible total score. Build after each change and do not rebuild the module from zero.`
