# ChatGPT Migration Spec - Next 5 Hours

Date: 2026-06-23  
Project: `C:\HCI_REACT_WEB\02_REACT_WEB\hci-react-web`

## Mission

Continue the React migration with one rule above all:

The React Admin must become the data engine.  
The React Resumo/App side must become the viewer.  
Android Studio is legacy and must stop being a runtime dependency as soon as the React flow is stable.

## Non-Negotiable Rules

1. Do not rebuild from zero.
2. Preserve all approved React structures already working.
3. Change one thing at a time.
4. After each change, report exactly what changed so the user can test.
5. Native data language is English.
6. Portuguese must be developed together as UI/documentation translation layer.
7. SQL must be single-source-of-truth per license/tenant.
8. No license may read another license's SQL data.

## Current Confirmed State

### Working

- Admin is below Resumo in the sidebar.
- Lead Management exists in Admin.
- `CREATE LEAD`, `SAVE`, and `DELETE` work again.
- Lead updates now appear immediately without page refresh.
- Resumo and Admin are reading the same active React source.
- IndexedDB local unified storage is active as temporary single local DB layer.
- Snapshot persistence no longer depends on old `HCI_ACTIVE_SNAPSHOT_V1` localStorage flow.
- A unified schema contract now exists:
  - `src/contracts/UNIFIED_SCHEMA_MASTER_V1.md`
  - `src/contracts/HCI_UNIFIED_SCHEMA_V1.js`
- The app now normalizes snapshots into unified canonical entities:
  - `athletes`
  - `sessionHeaders`
  - `sessionSeries`
  - `sessionShots`
  - `unifiedTargetSessions`
  - `unifiedPrescriptions`
  - `athleteViewCache`
  - `unifiedMetadata`

### Just Fixed

- IndexedDB migration break caused by missing object stores.
- Lead create/delete immediate update behavior.
- Sidebar mixed English and Portuguese labels on the same line.

## Current Architecture Decision

For now, the project is in transition mode:

- Legacy compatibility arrays still exist:
  - `leads`
  - `pendingGroups`
  - `approvedSubmissions`
  - `shotSeries`
  - `targetSessions`
  - `approvedTargetSessions`
  - `archivedTargetSessions`
  - `archivedIssfSessions`
  - `prescriptions`
  - `athlete360`
- Unified canonical entities now coexist beside them.

This is intentional.  
Do not remove compatibility structures until the screens are switched safely.

## Main Goal For The Next 5 Hours

Move the React project from compatibility-first storage to canonical-first reading/writing, without breaking the approved UI.

In practical terms:

1. New data must be born in the unified schema first.
2. Compatibility arrays must become derived outputs, not the primary truth.
3. Admin, Resumo and viewer surfaces must progressively read from canonical entities.
4. The app must get closer to the future single SQL repository model.

## Exact Priority Order

### Hour 1 - Stabilization and Translation Cleanup

Objective:
- remove remaining mixed-language UI labels
- check sidebar, top labels, cards, section titles, buttons
- keep one visible language at a time

Do:
- audit `translations.js`
- audit `Sidebar.jsx`
- audit visible Admin/Resumo labels
- fix encoding leftovers like broken `Índices`

Do not:
- rename stored data keys
- refactor unrelated components

Done means:
- no label rendered as English + Portuguese together
- no broken encoded text in the main navigation

### Hour 2 - Canonical Lead Path

Objective:
- make lead flow canonical-first

Do:
- when creating/saving/deleting leads, update canonical `athletes` alongside compatibility `leads`
- use canonical `athletes` as the preferred source for athlete selectors
- keep `leads` alive only for compatibility until screens are migrated

Done means:
- selector lists can be built from canonical `athletes`
- Resumo/Admin remain visually correct

### Hour 3 - Canonical ISSF Session Path

Objective:
- make manual ISSF and HCI IA saves become canonical session records first

Do:
- write to:
  - `sessionHeaders`
  - `sessionSeries`
  - `sessionShots`
- derive `shotSeries` from those entities for compatibility

Keep:
- approved UI behavior unchanged
- existing tables still rendering

Do not:
- break manual save
- break import save

Done means:
- a new ISSF session is representable fully from canonical entities even if compatibility output is still generated

### Hour 4 - Canonical Pending/Approved/Archived Session States

Objective:
- replace separate ISSF state logic with stateful canonical records

Do:
- treat pending/approved/archived as `sessionStatus`
- reduce logic that depends on separate disconnected containers
- keep archive/restore/delete working

Important:
- this is behavior-sensitive
- do not change all screens at once
- switch one read path at a time

Done means:
- pending vs approved vs archived is a state model, not just a different array location

### Hour 5 - Canonical Target Session Path

Objective:
- bring HCI target sessions to the same model quality

Do:
- prefer `unifiedTargetSessions`
- keep pending/approved/archived target state in canonical status field
- derive current screen arrays from canonical target entities if needed

Done means:
- target sessions follow the same migration logic as ISSF sessions

## Files That Matter First

- `src/App.jsx`
- `src/pages/AdminPage.jsx`
- `src/pages/DashboardResumo.jsx`
- `src/components/Sidebar.jsx`
- `src/i18n/translations.js`
- `src/services/activeSnapshotStore.js`
- `src/services/unifiedSnapshotSchema.js`
- `src/services/activeSnapshotMutations.js`
- `src/services/athleteViewMapper.js`
- `src/contracts/UNIFIED_SCHEMA_MASTER_V1.md`
- `src/contracts/HCI_UNIFIED_SCHEMA_V1.js`

## Required Working Method

For every change:

1. inspect current behavior
2. patch only one focused area
3. build
4. tell the user exactly what changed
5. wait for user test/confirmation before the next behavioral step when the change is user-visible

## Dangerous Areas

Treat these with care:

- any code that builds athlete selector lists
- any code that filters by athlete name
- pending approval generation
- ISSF modify/approve/archive/delete flows
- target pending/approve/archive/delete flows
- anything that writes IndexedDB store names or DB versions

## Hard Do-Not-Do List

Do not:

- remove approved UI blocks
- replace the app with a new architecture all at once
- delete compatibility arrays before their readers are migrated
- assume Android data is still the primary operational source
- mix Portuguese and English field keys in new canonical entities
- invent cross-license data sharing

## End Condition For This 5-Hour Block

This block is successful if:

1. the UI is stable
2. labels are clean
3. canonical `athletes` is operational
4. new ISSF saves are canonical-first
5. target sessions are closer to canonical state handling
6. no approved screen regresses

## Short Instruction To Start The Next Chat

Start by reading:

- `src/contracts/CHATGPT_MIGRATION_SPEC_NEXT_5_HOURS_2026-06-23.md`
- `src/contracts/UNIFIED_SCHEMA_MASTER_V1.md`
- `src/services/unifiedSnapshotSchema.js`

Then continue in this order:

1. translation cleanup
2. canonical lead path
3. canonical ISSF save path
4. canonical session state path
5. canonical target path

Always report one change at a time before moving on.
