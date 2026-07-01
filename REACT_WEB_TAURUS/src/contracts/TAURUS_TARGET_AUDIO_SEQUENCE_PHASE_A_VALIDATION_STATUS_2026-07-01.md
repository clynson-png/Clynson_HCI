# Status - Phase A Validation: Duelo 20 Audio V1

Date: 2026-07-01

Parent SPEC: `src/contracts/NEW_CHAT_CONTINUATION_SPEC_TAURUS_AUDIO_AND_HCI109_2026-07-01.md`

## Scope

Validate the current Duelo 20 Audio V1 implementation.

## Technical Validation

Build command:

```bash
npm.cmd run build
```

Result:

```text
passed
```

Development server:

```text
http://127.0.0.1:5173/
```

## Implemented Duelo 20 Audio V1

Current behavior:

- `Iniciar audio` starts microphone capture.
- `Parar audio` stops microphone capture.
- Sound peaks are detected as suggested shots.
- Suggested sequence does not auto-write to the table.
- `Aprovar sequencia de audio` applies suggested elapsed shot times to the Duelo 20 shot table.
- Each Duelo 20 shot time field receives the detected elapsed time for that shot.
- The interval between shots remains visible in the audio panel as an auxiliary rhythm readout.
- For Duelo 20 audio sequences, capture is by series: 5 shots per capture, up to 20 seconds per series.
- For Duelo 20, total time is the sum of the final elapsed time of each approved series, not the approval button time.
- Manual timing remains editable.
- Saving remains allowed without audio.
- Duelo 20 reports include shot-frequency STD based on time between shots.
- Duelo 20 reports estimate the best observed frequency by comparing shot interval with shot score.

## Browser Test Checklist

1. Open `http://127.0.0.1:5173/`.
2. Login.
3. Go to `Taurus Target`.
4. Open `Entrada`.
5. Select `Duelo 20`.
6. Click `Iniciar audio`.
7. Allow microphone permission.
8. Produce distinct dry-fire/click/shot-like sounds.
9. Confirm the panel count increases.
10. Click `Parar audio`.
11. Click `Aprovar sequencia de audio`.
12. Confirm the Duelo 20 table receives per-shot times.
13. Edit times manually if needed.
14. Save session.

## Current Tuning Values

```text
peak threshold: 80 dB
maximum displayed peak: 200 dB
minimum peak gap: 350 ms
maximum detected shots per Duelo 20 series: 5
```

## Next If Test Fails

- If too many false positives: raise threshold above the loading peak or increase minimum gap.
- If shots are missed: lower threshold below the real shot peak or reduce minimum gap.
- If echoes duplicate shots: increase minimum gap.
