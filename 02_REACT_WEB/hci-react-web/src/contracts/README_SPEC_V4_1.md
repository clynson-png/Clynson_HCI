# SPEC V4.1 - ATHLETE_VIEW_JSON

Native system language: English.

All engines, APIs, JSON keys, database fields, internal codes, levels, parameters and training codes must use English.

Portuguese and other languages are visual translation layers only.

## Architecture

Admin Web calculates all engines and exports ATHLETE_VIEW_JSON.

Athlete App and React Web Athlete View only render this JSON.

## Rule

No HCI engine should run inside the Athlete App.

The Athlete App must receive:
- summary
- indices
- rhythm data
- target intelligence
- training plan
- physical training
- reports
- clickable training details
- export package metadata

## Manual coach prescriptions

Coach prescriptions must not overwrite engine recommendations.

They must be stored separately in:

trainingPlan.coachPrescriptions

and, for physical sessions:

physicalTraining.coachPrescriptions