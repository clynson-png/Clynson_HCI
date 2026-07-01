# Status - Duelo 20 Audio Series Rule

Date: 2026-07-01

Parent SPEC: `src/contracts/NEW_CHAT_CONTINUATION_SPEC_TAURUS_AUDIO_AND_HCI109_2026-07-01.md`

## Product Rule

Duelo 20 audio timing is captured by series, not as one continuous 20-shot clock.

## Sequence

```text
SR1 = T1, T2, T3, T4, T5
SR2 = T6, T7, T8, T9, T10
SR3 = T11, T12, T13, T14, T15
SR4 = T16, T17, T18, T19, T20
```

Each series has:

```text
5 shots
maximum time = 20 seconds
audio clock starts when Iniciar audio is pressed
audio clock ends at the fifth shot of that series
next series starts only after pressing Iniciar audio again
```

## Implemented

- Duelo 20 audio capture now detects up to 5 shots per capture.
- First approval fills SR1 / T1-T5.
- Second approval fills SR2 / T6-T10.
- Third approval fills SR3 / T11-T15.
- Fourth approval fills SR4 / T16-T20.
- The UI indicates the next series range before capture.
- Duelo 20 total time is the sum of each approved series final elapsed time.
- Manual timing remains editable.
- Saving remains allowed without audio.

## Technical Validation

Build command:

```bash
npm.cmd run build
```

Result:

```text
passed
```

## Browser Test Checklist

1. Open `http://127.0.0.1:5173/`.
2. Go to `Taurus Target`.
3. Open `Entrada`.
4. Select `Duelo 20`.
5. Click `Iniciar audio`.
6. Produce 5 sound marks.
7. Click `Parar audio`.
8. Click `Aprovar sequencia de audio`.
9. Confirm SR1 / T1-T5 receives times.
10. Repeat for SR2, SR3, and SR4.
11. Confirm total time is the sum of the four series final elapsed times.
