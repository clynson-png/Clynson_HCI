# Status - Phase B: Clear/Reset Audio Sequence

Date: 2026-07-01

Parent SPEC: `src/contracts/NEW_CHAT_CONTINUATION_SPEC_TAURUS_AUDIO_AND_HCI109_2026-07-01.md`

## Scope

Add a safe reset action for the Duelo 20 audio sequence.

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

- Added `Limpar sequencia de audio` in the Duelo 20 audio panel.
- The button clears the suggested audio sequence.
- It clears current/max peak readings and audio error text.
- It does not clear shot scores.
- It does not clear shot directions.
- If audio timing has already been applied to the table, the app asks before clearing those timing fields.
- When confirmed, only audio-applied timing fields and audio metadata are cleared.
- Manual timing remains editable.
- Saving remains allowed without audio.

## Browser Test Checklist

1. Open `http://127.0.0.1:5173/`.
2. Go to `Taurus Target`.
3. Open `Entrada`.
4. Select `Duelo 20`.
5. Fill at least one score and direction manually.
6. Click `Iniciar audio`.
7. Produce sound marks.
8. Click `Parar audio`.
9. Confirm suggested sequence appears.
10. Click `Limpar sequencia de audio`.
11. Confirm the suggested sequence disappears.
12. Confirm scores and directions remain.
13. If timing had already been approved, confirm the prompt can clear only audio timing.

## Next Phase

Phase C: make audio sensitivity and minimum peak gap adjustable from the UI.
