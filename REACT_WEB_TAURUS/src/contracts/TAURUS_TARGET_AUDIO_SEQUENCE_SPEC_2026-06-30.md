# SPEC - TAURUS Target Audio Sequence

Date: 2026-06-30

Status: next implementation phase after HCI_109 focus/recording approval

## Scope Correction

Audio does not belong to `HCI_109`.

Audio belongs to the TAURUS target flows:

```text
Humanoide
Cartoes Coloridos
Duelo 20
```

## Objective

Create an audio sequence workflow for TAURUS target results so the app can:

1. capture or import timing/audio sequence data;
2. present the detected timing in the target result table;
3. let Admin review the sequence;
4. apply the sequence to the official result table only through an explicit button command.

## Core Data Rule - Audio Belongs To Shot Entry

Audio/timing data must be filled together with shot entry, and only in that context.

This means:

- audio timing does not exist as an isolated official result;
- audio timing must attach to the target shot/result rows;
- manual shot entry remains valid even when audio/timing is absent;
- missing audio/timing must not block session recording;
- whenever timing exists, the table must show the time for each shot/result row.

Manual timing is allowed.

If audio detection is not available or is wrong, the coach/Admin may fill timing by hand in the same result-entry table.

## Required Button

Each supported TAURUS target must expose an audio command in its target workflow:

```text
Aprovar sequencia de audio
```

This button must not auto-approve.

It applies reviewed audio timing into the target result table only after the user/Admin confirms the sequence.

## Supported Targets

### Humanoide

Audio timing must attach to Humanoide result rows without crossing into other targets.

### Cartoes Coloridos

Audio timing must attach to Cartoes Coloridos result rows without crossing into other targets.

### Duelo 20

Audio timing must attach to Duelo 20 result rows without crossing into other targets.

## Data Rules

Audio sequence data must be target-specific.

Do not use:

- Duelo 20 audio for Humanoide;
- Humanoide audio for Cartoes Coloridos;
- Cartoes Coloridos audio for Duelo 20.

## Result Table Behavior

The timing marks detected/approved by audio must appear in the target result table.

Expected fields may include:

```text
shotTimeMs
shotIntervalMs
audioSequenceIndex
audioSequenceStatus
audioApprovedAt
audioApprovedBy
```

Exact field names may follow the existing TAURUS session payload.

## Series Total Time Rule

The total series time must be calculated from partial shot/result timings.

Do not rely only on a direct manually typed total.

Official rule:

```text
seriesTotalTime = sum(row.shotTimeMs or row.shotIntervalMs)
```

The UI may still display a suggested total from audio, but that total must be derived from row-level partial times.

If the user edits a row time manually, the total series time must update from the row sum.

If audio is activated, it should suggest:

- each shot/result row time;
- the total series time as the sum of those partial times.

The direct total field, if kept for legacy compatibility, must be treated as derived/secondary and not as the only source of truth.

## Governance

Official flow:

```text
TARGET SHOT ENTRY -> OPTIONAL AUDIO CAPTURE/IMPORT -> REVIEW AUDIO SEQUENCE -> APPROVE AUDIO SEQUENCE -> LOAD TIMING INTO RESULT TABLE ROWS -> RECALCULATE SERIES TOTAL FROM ROWS -> SAVE/APPROVE SESSION
```

Audio timing does not become official by capture alone.

Shot/result entry may be saved without audio timing.

## Admin Requirement

Admin must have a clear area to:

- inspect the audio sequence;
- approve the sequence;
- reject/delete the sequence if wrong;
- confirm that timing has loaded into the target result table.

## Acceptance Criteria

- HCI_109 has no audio button or audio engine.
- Humanoide exposes the audio sequence workflow.
- Cartoes Coloridos exposes the audio sequence workflow.
- Duelo 20 exposes the audio sequence workflow.
- `Aprovar sequencia de audio` loads timing into the visible target result table.
- Timing stays target-specific.
- Build passes.
