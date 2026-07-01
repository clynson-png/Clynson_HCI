# Status - TAURUS Target Audio Sequence Phase 2 Duelo 20

Date: 2026-06-30

Parent SPEC: `src/contracts/TAURUS_TARGET_AUDIO_SEQUENCE_SPEC_2026-06-30.md`

## Implemented

Initial microphone capture for `Duelo 20`.

## Behavior

- Audio capture is available only in the Duelo 20 entry flow.
- `Iniciar audio` starts microphone listening.
- `Parar audio` stops microphone listening.
- Detected peaks generate a suggested audio sequence.
- The sequence does not write into the table automatically.
- `Aprovar sequencia de audio` applies suggested partial times into the Duelo 20 shot table.
- Manual shot times remain editable.
- Saving remains allowed without audio.

## Detection V1

The V1 detector:

- reads microphone waveform with Web Audio API;
- detects peaks above a fixed threshold;
- ignores peaks closer than 260 ms to reduce duplicate echoes;
- creates up to 20 suggested shot intervals.

## Persisted Per Shot

When applied, each Duelo 20 shot can carry:

```text
shotTimeSeconds
shotIntervalMs
audioSequenceIndex
audioSequenceStatus
audioPeak
```

## Validation

Command:

```bash
npm.cmd run build
```

Result: passed.
