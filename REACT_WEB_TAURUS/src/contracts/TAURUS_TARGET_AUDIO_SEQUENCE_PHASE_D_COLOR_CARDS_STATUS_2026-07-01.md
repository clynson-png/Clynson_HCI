# Status - Phase D Revised: Color Cards Audio Sequence

Date: 2026-07-01

Parent SPEC: `src/contracts/NEW_CHAT_CONTINUATION_SPEC_TAURUS_AUDIO_AND_HCI109_2026-07-01.md`

## Scope

Skip Humanoide audio timing and implement audio timing for Cartoes Coloridos.

## Product Decision

Humanoide audio timing is not implemented because audio alone cannot identify which impact landed in which humanoid zone.

Cartoes Coloridos can receive audio timing because the shot number maps to a fixed card color.

## Fixed Color Sequence

Two series of four shots:

```text
T1 / T5 = Yellow
T2 / T6 = Green
T3 / T7 = Red
T4 / T8 = Blue
```

Series rule:

```text
SR1 = T1, T2, T3, T4
SR2 = T5, T6, T7, T8
Max time per series = 15 seconds
```

Audio timing rule:

```text
First audio capture starts on Iniciar audio and ends at T4.
Second audio capture starts only after pressing Iniciar audio again and ends at T8.
The clock restarts for SR2.
```

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

- Cartoes Coloridos entry now uses a fixed 2x4 shot table.
- Each shot has a fixed color based on shot number.
- Each shot can be marked as impact/no-impact.
- Each shot has an editable time field.
- Audio capture is available for Cartoes Coloridos in 4-shot series blocks.
- `Aprovar sequencia de audio` fills the fixed color shot table by shot number.
- First approval fills SR1 / T1-T4.
- Second approval fills SR2 / T5-T8.
- Session payload stores `shotDetailsJson` for Cartoes Coloridos.
- Color hit totals are derived from the fixed shot table.
- Humanoide remains manual only.

## Browser Test Checklist

1. Open `http://127.0.0.1:5173/`.
2. Go to `Taurus Target`.
3. Open `Entrada`.
4. Select `Cartoes Coloridos`.
5. Confirm fixed sequence:
   - `T1/T5` yellow.
   - `T2/T6` green.
   - `T3/T7` red.
   - `T4/T8` blue.
6. Click `Iniciar audio`.
7. Produce 4 sound marks.
8. Click `Parar audio`.
9. Click `Aprovar sequencia de audio`.
10. Confirm times fill SR1 / T1-T4.
11. Click `Iniciar audio` again.
12. Produce 4 sound marks.
13. Click `Parar audio`.
14. Click `Aprovar sequencia de audio`.
15. Confirm times fill SR2 / T5-T8.
16. Save session.
17. Confirm output/report still renders.

## Next

Review whether Cartoes Coloridos report should display per-shot timing details or only the derived color totals and total session time.
