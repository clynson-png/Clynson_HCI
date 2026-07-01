# PLAN Prescription Audit SPEC

## Goal

Close the PLAN prescription workflow one audit issue at a time, without changing Rhythm or rebuilding PLAN from zero.

## Product Boundary

- Admin/backend is the calculation and contract source.
- PLAN is the coach decision surface.
- Active snapshot is the immediate persistence surface.
- Relatorio is the export/share surface for approved prescriptions.
- Trello is read-only operational context, not final prescription truth.

## Canonical Vocabulary

Use the existing `TRAINING_PLAN_CONTRACT_V1` vocabulary:

- `engineRecommendations`
- `coachPrescriptions`
- `prescribedTrainings`
- `decisionTrace`

PLAN writes must keep active snapshot aligned:

- `snapshot.prescriptions`
- current `athlete360.prescriptions`
- current `athlete360.prescriptionCount`

## Audit Statuses

### BLOCKED

The plan cannot be closed.

Examples:

- no selected athlete
- training plan contract not loaded
- no final active prescription item

### REVIEW

The coach must decide before closing.

Examples:

- engine recommendation pending approve/reject/replace
- duplicated active prescription for the same training

### CHECK

The plan can continue, but the coach must confirm context.

Examples:

- phase mismatch with current PLAN filter
- parameter mismatch with current PLAN filter
- target type mismatch with current PLAN filter
- replacement without clear trace

### OK

The current athlete/filter has no visible audit issue.

## Resolution Order

1. Resolve `BLOCKED` issues first.
2. Resolve `REVIEW` issues one by one.
3. Resolve or consciously accept `CHECK` issues.
4. Confirm final prescription table reflects active decisions.
5. Confirm Relatorio can consume approved/replaced rows.

## One-by-One Workflow

For each audit issue:

1. Identify the issue code and item.
2. Decide the action: approve, reject, replace, remove duplicate, or accept exception.
3. Apply the action in PLAN.
4. Verify the audit count changes immediately.
5. Verify `Coach Prescriptions` and `Final Prescription` agree.

## Acceptance Criteria

- Audit status reaches `OK`, or remaining `CHECK` items are explicit coach exceptions.
- No `BLOCKED` item remains.
- No unresolved `REVIEW` item remains.
- Approved/replaced prescriptions persist in active snapshot.
- Rejected recommendations do not appear as final active prescribed trainings.
- Duplicate active prescriptions are visible and removable or avoidable.
- Build passes after every code change.

## Current Implementation Notes

- Audit UI lives in `src/pages/PlanoPage.jsx`.
- Contract anchor is `src/contracts/TRAINING_PLAN_CONTRACT_V1.js`.
- Report export surface is `src/pages/ReportPage.jsx`.
- Current audit is read-only except for existing PLAN actions.

## Next Implementation Step

Make each audit row more actionable in PLAN:

- show stable issue code
- group by severity
- expose the exact matching training/recommendation
- for duplicate active prescriptions, add a safe remove/archive action instead of leaving the coach stuck

Status:

- stable issue code: implemented
- severity ordering: implemented
- pending recommendation actions: implemented
- duplicate archive action: implemented
- CHECK exception acceptance: implemented

CHECK acceptance behavior:

- accepted checks are stored in `snapshot.planAuditAcceptedChecks`
- accepted checks are filtered out of active audit issues for that athlete
- accepted checks remain counted as explicit exceptions
