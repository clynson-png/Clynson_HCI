# Status - Phase C: Adjustable Audio Sensitivity

Date: 2026-07-01

Parent SPEC: `src/contracts/NEW_CHAT_CONTINUATION_SPEC_TAURUS_AUDIO_AND_HCI109_2026-07-01.md`

## Scope

Expose Duelo 20 audio detection controls in the entry UI.

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

- `Indicador de disparo (dB)` remains editable in the audio panel.
- Default peak threshold remains `80 dB`.
- Maximum displayed peak remains `200 dB`.
- Added `Intervalo minimo (ms)` to the audio panel.
- Default minimum peak gap is `350 ms`.
- Minimum peak gap can be adjusted from `100 ms` to `2000 ms`.
- Detection uses the current UI values during capture.
- Manual timing remains editable.
- Saving remains allowed without audio.

## Browser Test Checklist

1. Open `http://127.0.0.1:5173/`.
2. Go to `Taurus Target`.
3. Open `Entrada`.
4. Select `Duelo 20`.
5. Set `Indicador de disparo (dB)` for the room/microphone.
6. Set `Intervalo minimo (ms)` for the expected shot cadence.
7. Click `Iniciar audio`.
8. Produce sound marks.
9. Confirm false positives reduce when threshold or interval increases.
10. Confirm missed shots reduce when threshold or interval decreases.

## Next Phase

Phase D: apply the audio workflow to Humanoide using the row time model, unless the product direction changes.
