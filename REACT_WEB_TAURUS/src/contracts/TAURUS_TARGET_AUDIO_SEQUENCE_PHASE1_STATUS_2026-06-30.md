# Status - TAURUS Target Audio Sequence Phase 1

Date: 2026-06-30

Parent SPEC: `src/contracts/TAURUS_TARGET_AUDIO_SEQUENCE_SPEC_2026-06-30.md`

## Implemented

Phase 1 implements the timing data model inside the target result entry.

## Rules Applied

- Timing/audio does not block saving.
- Timing is filled together with result entry.
- Timing can be filled manually.
- Total time is derived from row/shot partial times whenever partial times exist.
- Direct total time remains secondary.

## Target Behavior

### Humanoide

Each result row/zone can receive a manual time in seconds.

The session total time is derived from the sum of row times.

### Cartoes Coloridos

Each color/result row can receive a manual time in seconds.

The session total time is derived from the sum of row times.

### Duelo 20

Each shot can receive its own manual time in seconds.

Series time is derived from the sum of the five shot times in that series.

Session total time is derived from the sum of all shot times.

## Button

Added command:

```text
Aprovar sequencia de audio
```

In Phase 1, the button applies/recalculates the timing sequence already present in the table.

Future phase will connect actual microphone/audio detection to suggest these row times.

## Validation

Command:

```bash
npm.cmd run build
```

Result: passed.
