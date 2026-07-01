# Status - Identity Gate and HCI_109 Governance

Date: 2026-06-30

Parent SPEC: `src/contracts/REACT_REPORTS_PREMIUM_ATHLETE_PORTAL_SPEC_2026-06-28.md`

## Step 1 - Identity By Plan

Implemented.

Rules:

- `FREE` and `PREMIUM` use the athlete identity from the login session.
- `FREE` and `PREMIUM` cannot change active athlete through app selectors.
- `ADMIN` keeps athlete selection capability.
- The central gate is in `src/App.jsx`.

## Step 2 - HCI_109 Governance Flow

Implemented.

Flow:

1. Athlete records HCI_109 session in Library.
2. Session is saved as `PENDING_REVIEW`.
3. Admin opens `Administracao HCI_109`.
4. Admin selects athlete.
5. Admin filters by status:
   - all
   - pending
   - approved
   - rejected
6. Admin can approve, reject, or delete.
7. Resumo shows HCI_109 sessions for the active athlete with status.

## Admin Detail

The Admin HCI_109 table now shows a compact per-shot visual summary:

```text
shotIndex:visualScore
```

This keeps approval visible without opening a separate modal yet.

## Next Pending Work

- Add expanded per-shot detail modal if needed.
- Route final comparative charts to approved sessions only where the screen is athlete-facing final output.
