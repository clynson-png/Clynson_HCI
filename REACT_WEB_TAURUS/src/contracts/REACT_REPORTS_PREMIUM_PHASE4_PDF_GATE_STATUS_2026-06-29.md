# Phase 4 Status: PDF Premium Gate

Date: 2026-06-29

Parent SPEC: `src/contracts/REACT_REPORTS_PREMIUM_ATHLETE_PORTAL_SPEC_2026-06-28.md`

Status: implemented, pending user approval

## Implemented

Created a centralized subscription access contract:

```text
src/services/subscriptionAccess.js
```

Created a reusable locked premium action:

```text
src/components/reports/PremiumLockedAction.jsx
```

Applied PDF export gating to:

```text
src/pages/TaurusTargetPage.jsx
src/components/taurus/TaurusSmartChart.jsx
src/pages/TaurusSmartChartPage.jsx
src/App.jsx
src/index.css
```

## Current Behavior

PDF generation is now guarded by:

```text
subscriptionAccess.canExportPdf
```

When the user is not premium:

- PDF buttons show locked premium state.
- Clicking the button shows a premium warning.
- The print/export handler refuses to call `window.print()`.

When the user is premium or admin:

- PDF buttons remain active.
- The approved A4 report flow prints normally.

## Temporary Subscription Source

Until the real login/athlete portal exists, subscription is read from browser local storage:

```text
TAURUS_SUBSCRIPTION_TIER = FREE | PREMIUM | ADMIN
TAURUS_USER_ROLE = ATHLETE | ADMIN
```

Default:

```text
FREE
```

This is intentionally isolated so Phase 5 can replace it with real login/session data.

## Not Implemented Yet

These remain for later phases:

- Full login screen.
- Athlete portal shell.
- Smart Chart view lock for non-premium.
- Real subscription persistence from backend/auth.

## Validation

Build command:

```text
npm.cmd run build
```

Result:

```text
passed
```

Vite emitted only the existing large chunk warning.

## Approval Request

Please approve:

```text
APPROVE PHASE 4 - continue to login and athlete portal
ADJUST PHASE 4 - revise PDF premium gate
```
