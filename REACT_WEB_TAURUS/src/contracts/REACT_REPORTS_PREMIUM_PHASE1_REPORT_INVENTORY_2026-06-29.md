# Phase 1 Inventory: React Reports, PDF, and Export Surfaces

Date: 2026-06-29

Parent SPEC: `src/contracts/REACT_REPORTS_PREMIUM_ATHLETE_PORTAL_SPEC_2026-06-28.md`

Project root: `C:\HCI_REACT_WEB\REACT_WEB_TAURUS`

Status: pending user approval before Phase 2

## Objective

Inventory every visible React report, PDF, print, or export surface before changing layout or access rules.

This file is the Phase 1 deliverable. It does not implement the A4 report model, login, premium gate, or Smart Chart lock.

## Inventory Summary

| ID | Surface | File | Current status | Classification | Required action |
| --- | --- | --- | --- | --- | --- |
| RPT-01 | TAURUS Target output report wrapper | `src/pages/TaurusTargetPage.jsx` | Output tab renders the latest session for Humanoide, Cartoes Coloridos, or Duelo 20 and exposes `Gerar relatorio PDF` through `window.print()` | Printable through browser print; not real PDF export; not premium-gated | Convert to shared A4 one-page report preview; keep output screen visible; gate print/PDF action behind premium |
| RPT-02 | Humanoide technical report | `src/pages/TaurusTargetPage.jsx` | `HumanoidRadialChart` renders target visual, metrics, insight cards, and recommended training inside `.taurus-report-card` | Screen report included in Target print | Compact into A4 section; gray print typography; ensure chart and recommendation fit one page |
| RPT-03 | Cartoes Coloridos technical report | `src/pages/TaurusTargetPage.jsx` | `ColorPiePerformance` renders color chart, time/evolution chart, metrics, insights, and recommended training inside `.taurus-report-card` | Screen report included in Target print | Compact into A4 section; validate charts fit one page; avoid color-only meaning in print |
| RPT-04 | Duelo 20 technical report | `src/pages/TaurusTargetPage.jsx` | `DuelOctagonChart` renders target image, octagon/directional chart, IDD/time metrics, insights, and recommended training inside `.taurus-report-card` | Screen report included in Target print | Compact into A4 section; preserve Duelo 20 target evidence; ensure IDD/time metrics survive grayscale print |
| RPT-05 | Smart Chart page/report surface | `src/pages/TaurusSmartChartPage.jsx`, `src/components/taurus/TaurusSmartChart.jsx` | Standalone page renders premium visualizer from approved sessions; sidebar has a PDF-looking button with no handler | Screen-only; PDF action is visual/incomplete; not premium-gated | Gate Smart Chart view behind premium; either wire premium PDF export later or convert button to locked/inactive until Phase 4 |
| RPT-06 | Smart Chart embedded in TAURUS Target | `src/pages/TaurusTargetPage.jsx` | Target page has internal `SMART_CHART` area rendering approved sessions for the selected athlete | Screen-only; not premium-gated | Apply the same premium gate as standalone Smart Chart; prevent model rendering for non-premium users |
| RPT-07 | Admin ATHLETE_VIEW_JSON export | `src/pages/AdminPage.jsx` | `handleExportAthleteViewJson()` downloads JSON via Blob as `athlete_view_*_v4_1.json` | Data export, not PDF report | Keep as Admin data export; no A4 formatting; not part of athlete PDF gate unless later exposed to athlete portal |
| RPT-08 | Admin report package button | `src/pages/AdminPage.jsx` | Button label exists for export report package, but no handler is attached | Missing export implementation | Mark as future Admin package export; do not treat as working PDF until implemented |
| RPT-09 | SIUS/TargetScan extraction package export | `src/components/ImportSiusVideoPanel.jsx` | Downloads JSON extraction package for AI/import workflow | Data/debug export, not athlete PDF report | Leave outside A4 report work; avoid exposing in athlete portal |
| RPT-10 | HCI/ISSF report-like CSS surfaces | `src/index.css` report classes, current pages | CSS contains `.report-*` blocks and print rules for report panels, but no direct PDF action found in the audited React page set | Potential screen/report styling | Keep in audit watchlist; do not migrate until a concrete rendered report/export surface is confirmed |

## Current PDF/Print Reality

Current actual PDF-like behavior:

- `src/pages/TaurusTargetPage.jsx` calls `window.print()` through `handleGeneratePdfReport()`.
- The print action is available whenever `currentOutputSession` exists.
- There is no subscription or premium permission check.
- The current print target is the whole browser page, not a dedicated one-page A4 report component.

Current incomplete PDF behavior:

- `src/components/taurus/TaurusSmartChart.jsx` renders a PDF button visually.
- The button has no `onClick` handler.
- It is not permission-gated.

Current export behavior that is not a report:

- `src/pages/AdminPage.jsx` exports `ATHLETE_VIEW_JSON`.
- `src/components/ImportSiusVideoPanel.jsx` exports an extraction package JSON.

## Files Confirmed In Scope For Phase 2 And Later

Primary report implementation files:

```text
src/pages/TaurusTargetPage.jsx
src/components/taurus/TaurusSmartChart.jsx
src/pages/TaurusSmartChartPage.jsx
src/index.css
src/i18n/translations.js
```

Likely new shared files for Phase 2:

```text
src/components/reports/A4ReportShell.jsx
src/components/reports/PremiumLockedAction.jsx
src/services/subscriptionAccess.js
```

Potential later portal files:

```text
src/pages/AthleteLoginPage.jsx
src/pages/AthletePortalPage.jsx
src/App.jsx
src/components/Sidebar.jsx
```

## Risks Found

1. The Target PDF button currently prints the whole page. This will not reliably fit one A4 page.
2. Humanoide, Cartoes Coloridos, and Duelo 20 report cards contain many insights and cue cards, so they need a compact print summary rather than raw full-screen content.
3. Smart Chart has a PDF button that looks active but does nothing.
4. Smart Chart is accessible without a premium check in both standalone and embedded routes.
5. There is no shared subscription/permission model in the audited React files.
6. Several visible Portuguese strings still show encoding corruption, which affects premium presentation quality.

## Phase 2 Recommendation

Approve this inventory, then execute Phase 2 with a narrow first implementation:

1. Create a shared A4 report shell and print CSS.
2. Apply it first only to TAURUS Target output reports.
3. Keep report preview on screen and make `window.print()` print only the A4 report area.
4. Do not implement the full login portal yet.
5. Do not gate premium yet except for preparing the permission hook/interface if needed.

Reason: the A4 template is the foundation. Once the Target report prints correctly in one page, the same layout can be reused for Smart Chart/PDF and then locked behind premium.

## Approval Request

Please approve one of these paths:

```text
APPROVE PHASE 1 - continue to Phase 2 A4 report template
ADJUST INVENTORY - revise the report list before code
```

Recommended next step: `APPROVE PHASE 1`.
