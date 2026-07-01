# Status - Phase F: Admin Audio Governance

Date: 2026-07-01

Parent SPEC: `src/contracts/NEW_CHAT_CONTINUATION_SPEC_TAURUS_AUDIO_AND_HCI109_2026-07-01.md`

## Scope

Allow Admin to inspect timing/audio state for TAURUS target sessions.

## Technical Validation

Build command:

```bash
npm.cmd run build
```

Result:

```text
passed
```

## Implemented

- TAURUS Admin pending table shows a `Timing/audio` column.
- TAURUS Admin approved table shows a `Timing/audio` column.
- TAURUS Admin archived table shows a `Timing/audio` column.
- The column shows:
  - timing source;
  - total time;
  - timed rows/shots present;
  - audio mark count or manual timing status.
- New sessions persist `durationSource`.
- `durationSource` can be:
  - `AUDIO_SEQUENCE`;
  - `ROW_SUM`;
  - `MANUAL_TOTAL`;
  - `null`.
- Existing sessions without `durationSource` still get a fallback summary from `shotDetailsJson` and `durationSeconds`.

## Preserved

- Existing TAURUS approve/archive/delete/restore actions remain unchanged.
- Admin can still approve target sessions exactly as before.
- No timing rejection workflow was added yet.

## Browser Test Checklist

1. Open `http://127.0.0.1:5173/`.
2. Login as Admin.
3. Go to Admin.
4. Select an athlete with TAURUS sessions.
5. Confirm pending TAURUS rows show `Timing/audio`.
6. Confirm approved TAURUS rows show `Timing/audio`.
7. Save a new audio-timed Duelo 20 or Cartoes Coloridos session.
8. Confirm Admin shows `Audio sugerido`.
9. Save a manual-timed session.
10. Confirm Admin shows manual/source fallback instead of audio.

## Next

Optional future slice: add a specific Admin action to reject or clear timing without deleting the target result.
