# HCI Derived Metrics Architecture

## Decision

The system must keep SQL as the single source of truth for raw session data.

Canonical raw entities:
- `sessionHeaders`
- `sessionSeries`
- `sessionShots`
- `targetSessions`
- `prescriptions`

Derived entities:
- `athlete_metrics_current`
- `athlete_session_metrics`
- `athlete_indices_current`

Compatibility outputs:
- `shotSeries`
- `athlete360`

## Rule

Raw data must exist only once.

Derived data may exist only as official ETL or materialized cache produced by the motors.

The UI must not own formulas that redefine the stored meaning of HCI indicators.

## Engine Flow

1. SQL canonical entities receive insert, update, approve, archive, restore or delete events.
2. The recalculation scope is reduced to the affected athlete and affected session set.
3. The HCI motors read canonical SQL data only.
4. The motors produce derived metrics and cache outputs.
5. The viewer contract reads the derived outputs.

## Recalculation Rule

Default rule:
- session write changes only recalculate the affected athlete
- target write changes only recalculate target intelligence and affected athlete aggregates
- formula changes trigger full ETL rebuild

Operational rule:
- mark athlete or session as dirty
- recalculate only the dirty scope
- persist derived outputs

## Performance Rule

Preferred read order:
1. read derived metrics cache
2. if cache is missing, materialize from canonical session tables
3. never use repeated parallel truths

## Current React Implementation

In this React migration:
- canonical session entities are the preferred source
- `athlete360` is treated as compatibility fallback
- `athleteViewMapper` consumes derived metrics produced by the HCI motor
- `IndicesPage` reads the existing `ATHLETE_VIEW_JSON_V4_1` contract without redefining formulas

## Anti-duplication Rule

Allowed:
- raw SQL once
- derived ETL once
- compatibility adapters

Not allowed:
- same HCI metric recalculated independently in multiple screens
- screen-local truth overriding motor truth
- duplicated storage of raw and pseudo-raw variants
