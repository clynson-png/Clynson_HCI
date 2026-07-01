# Status: Lead-Based Athlete Login

Date: 2026-06-29

Parent SPEC: `src/contracts/REACT_REPORTS_PREMIUM_ATHLETE_PORTAL_SPEC_2026-06-28.md`

Status: implemented, pending user approval

## Implemented

Changed login from local user/password accounts to lead-based athlete access.

Files:

```text
src/services/authService.js
src/pages/AthleteLoginPage.jsx
src/App.jsx
src/index.css
```

## Behavior

The login screen now connects to the app lead/athlete list.

The athlete logs in using only:

```text
athleteName
```

No password is required.

The login validates the typed/selected name against:

```text
activeSnapshot.leads
activeSnapshot.athletes
```

After login:

- the active athlete is set to the logged-in name
- the athlete selector is limited to that athlete
- the athlete sees only their own area/data paths
- PDF premium gate still reads the logged-in session

## Current Premium Behavior

Lead login defaults to:

```text
FREE
```

If future lead records include:

```text
subscriptionTier
role
```

the login service will use them automatically.

## Removed From Login

Removed:

```text
password field
free/free demo
premium/premium demo
admin/admin demo
```

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
