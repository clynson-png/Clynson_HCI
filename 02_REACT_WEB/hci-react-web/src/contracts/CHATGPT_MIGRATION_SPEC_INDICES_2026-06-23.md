# ChatGPT Migration SPEC: Indices

## Goal

Migrate the HCI Indices screen to canonical React behavior without rebuilding the screen from zero.

## Locked rules

1. Do not change Rhythm while migrating Indices.
2. The Indices UI must keep using the `ATHLETE_VIEW_JSON_V4_1` contract.
3. Raw truth must come from canonical session SQL entities.
4. `athlete360` is compatibility fallback only.
5. Formula ownership belongs to the motor layer, not the JSX layer.

## Canonical source

Preferred source order:
1. `sessionHeaders`
2. `sessionSeries`
3. `sessionShots`
4. derived metrics engine output
5. `athlete360` only as fallback

## Current implementation target

The React Indices screen must render:
- athlete identification cards
- two radar charts below athlete information
- quick guide table
- `Targets` analysis block with table plus right-side mini radar
- `Structure` analysis block with table plus right-side mini radar
- contract preview block

## Derived engine responsibility

The HCI motor must produce:
- overall HCI
- parameter scores
- parameter levels
- parameter readings
- sessions count
- latest total
- median total

The motor output is materialized through:
- `materializeSnapshotDerivedMetrics`
- `buildCanonicalIndicesFromSnapshot`

## UI responsibility

The JSX layer may:
- choose layout
- render icons
- render radar charts
- localize labels

The JSX layer may not:
- redefine formulas
- create parallel metric truth
- mix Portuguese and English in the same UI block

## Translation rule

Use project translation documents to decide the current display language.

One language at a time:
- Portuguese UI when `lang = pt`
- English UI when `lang = en`

Do not use mixed labels like:
- `METAS (TARGETS)`
- `FUNDAMENTOS (STRUCTURE)`

## Visual rule

The analysis miniatures must appear:
- in the `Targets` analysis panel
- in the `Structure` analysis panel

They must not appear in the quick guide summary panel.

## Validation checklist

1. Sidebar reaches `Índices` correctly.
2. Screen renders even when `athlete360` is empty.
3. Athlete selector can come from canonical entities.
4. Targets rows render.
5. Structure rows render.
6. Right-side miniature radar appears in both analysis panels.
7. Main radar charts still appear below athlete cards.
8. Build passes.
