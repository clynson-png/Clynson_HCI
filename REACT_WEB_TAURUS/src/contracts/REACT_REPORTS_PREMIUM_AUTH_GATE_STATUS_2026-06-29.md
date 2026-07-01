# Status: Login Gate Before Next Phase

Date: 2026-06-29

Parent SPEC: `src/contracts/REACT_REPORTS_PREMIUM_ATHLETE_PORTAL_SPEC_2026-06-28.md`

Status: implemented, pending user approval

## Implemented

Created a real app-level login gate before continuing to the next phase.

Files:

```text
src/services/authService.js
src/pages/AthleteLoginPage.jsx
src/App.jsx
src/layouts/MainLayout.jsx
src/index.css
```

## Behavior

The app now starts at a TAURUS login screen.

Before login:

- dashboards are not visible
- athlete data is not visible
- snapshot/data loading does not run

After login:

- app loads normally
- user identity appears in the top bar
- subscription tier appears in the top bar
- logout is available
- premium PDF permission is fed by the logged-in session

## Local Login Accounts

Until backend authentication exists, these local accounts are available:

```text
free / free       -> FREE athlete
premium / premium -> PREMIUM athlete
admin / admin     -> ADMIN user
```

The session is persisted in:

```text
TAURUS_AUTH_SESSION_V1
```

The premium gate also receives:

```text
TAURUS_SUBSCRIPTION_TIER
TAURUS_USER_ROLE
```

## Next Replacement Point

When a backend/auth API is ready, replace only:

```text
src/services/authService.js
```

The login page, app gate, and premium permissions can remain.

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
