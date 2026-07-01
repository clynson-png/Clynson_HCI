# HCI HAPPY Athlete + Cross Spec

Native system language: English. Portuguese is the UI translation layer.

## Purpose

Define the integrated `ATHLETE` tab and the `CROSS ANALYSIS` tab for the React Web athlete viewer, based on the HAPPY/COMANDO sources in `00_FONTES/000_CROSS_HCI`.

This spec does not move engine execution into the athlete app. It extends the exported `ATHLETE_VIEW_JSON` so Admin remains the engine and the athlete-facing app remains the renderer.

## Source Basis

- `HAPPY SYSTEM CROSS HCI.docx`
- `HCI_HAPPY_SELF_ANALYSIS_METHODOLOGY_V2.md`
- `HCI_HAPPY_CROSS_ANALYSIS_SPEC_V1.md`
- `HCI_HAPPY_LIBRARY_CANONICAL_V1.md`
- `HCI_HAPPY_PRESCRIPTION_CANONICAL_V1.md`

## Product Rule

- `ATHLETE` is the athlete self-analysis surface.
- `CROSS ANALYSIS` is the coach intelligence surface.
- `LIBRARY` must expose the HAPPY/COMANDO canonical library and the canonical prescription matrix beside the current technical training library.
- The dashboard displays. The engine decides. The library prescribes.

## ATHLETE Tab

### Input

The athlete answers 12 subjective indicators on a 1 to 5 scale:

- `CONFIDENCE`
- `ORGANIZATION`
- `MANAGEMENT`
- `ANALYSIS`
- `NERVE`
- `DISCIPLINE`
- `OPPORTUNITY`
- `HEED`
- `ALIGNMENT`
- `PLAN`
- `POWERING`
- `YEARN`

### Engine Output

Admin calculates and exports:

- 5 dimensions: `SELF_LEADERSHIP`, `TEAM_LEADERSHIP`, `WISDOM`, `MANAGEMENT`, `ENVIRONMENT`
- top 3 dimensional gaps
- critical parameter
- severity band
- developmental recommendations

### Visual Blocks

- Level 1: radar chart with the 5 dimensions
- Level 2: parameter gauges grouped by dimension
- Level 3: diagnostic table with dimension, score, critical parameter, description and expected impact
- Level 4: athlete-safe development plan with recommended exercises and reassessment window

### Messaging Rule

- Athlete-facing output must use developmental language.
- Do not expose deficit-heavy labels to the athlete.

## CROSS ANALYSIS Tab

### Purpose

Cross athlete perception with HCI evidence and surface the gap to the coach.

### Layers

- Layer 1: what the athlete feels
- Layer 2: what the HCI data shows
- Layer 3: where perception and reality diverge

### Canonical Crossings

- `CONFIDENCE x OUTCOME`
- `CONFIDENCE x CONSISTENCY`
- `NERVE x PRESSURE`
- `HEED x RHYTHM`
- `HEED x EMOTIONAL`
- `PLAN x PROCESS`
- `ALIGNMENT x TRANSFER`
- `POWERING x PHYSICAL`
- `YEARN x TRAINING_FREQUENCY`
- `ORGANIZATION x SESSION_VARIABILITY`
- `ANALYSIS x DEEPENING`
- `OPPORTUNITY x TRAINING_UTILIZATION`

### Coach Output

Each insight must answer:

- what the athlete feels
- what is actually happening
- what is causing the gap
- what intervention is most likely to reduce it

## Library Integration

`Library` must now expose 3 canonical collections:

1. `TECHNICAL_LIBRARY`
2. `HAPPY_LIBRARY`
3. `HAPPY_PRESCRIPTION`

### HAPPY_LIBRARY

Contains the canonical developmental exercises for all 12 HAPPY/COMANDO parameters with:

- `exerciseId`
- `parameter`
- `sourceSystem`
- bilingual `name`
- bilingual `objective`
- bilingual `howToDo`

### HAPPY_PRESCRIPTION

Contains the canonical matrix that connects:

- parameter gap
- primary and secondary HCI evidence
- severity band
- prescribed exercise IDs

## ATHLETE_VIEW_JSON Extension

Add these top-level blocks:

```json
{
  "athleteSelfAnalysis": {
    "responses": [],
    "dimensions": [],
    "topGaps": [],
    "criticalParameter": null,
    "severityBand": null,
    "radar": [],
    "developmentPlan": []
  },
  "crossAnalysis": {
    "perceptionReadings": [],
    "objectiveEvidence": [],
    "insights": [],
    "coachActions": []
  }
}
```

## Responsibility Split

- Admin Web: collect, calculate, persist and export HAPPY/CROSS data
- React Web Athlete View: render `ATHLETE_VIEW_JSON`
- Library: expose technical and HAPPY canonicals for consultation and prescription traceability

## Implementation Order

1. Add canonical HAPPY library and prescription data inside `src/data`
2. Extend `ATHLETE_VIEW_JSON` contract
3. Extend `Library` page to browse the new canonical collections
4. Add `ATHLETE` tab renderer
5. Add `CROSS ANALYSIS` tab renderer
6. Materialize Admin export for both new blocks
