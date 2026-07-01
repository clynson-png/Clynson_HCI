# HCI HAPPY PRESCRIPTION CANONICAL V1

## Purpose

Canonical prescription matrix for the HAPPY Engine. It connects HAPPY/COMANDO gaps to the HAPPY exercise library and cross-validates prescription using HCI performance evidence.

## Engine Principle

The engine prescribes by GAP, not by absolute score. Lowest dimension -> critical parameter -> cross-evidence -> exercise prescription -> reassessment.

## Selection Flow
- Calculate 5 HAPPY dimensions from subjective indicators.
- Identify the lowest dimension and Top 3 dimensional gaps.
- Open the lowest dimension and identify the parameter with the largest negative contribution.
- Cross-check the parameter with HCI evidence: TARGETS, STRUCTURE, RHYTHM, RESULT.
- Classify severity.
- Select exercises from hci_happy_library_canonical.json.
- Generate coach prescription and athlete-safe development plan.
- Reassess after the prescribed block.

## Severity Bands

| Level | Range | Meaning |
|---|---:|---|
| CRITICAL | < 2.0 | Immediate development priority |
| ATTENTION | 2.0 - 2.99 | Needs focused intervention |
| STABLE | 3.0 - 3.99 | Monitor and consolidate |
| HIGH_PERFORMANCE | 4.0 - 4.49 | Maintain and refine |
| ELITE | 4.5 - 5.0 | Reference behavior |

## Official Prescription Matrix

| Parameter | Primary HCI Evidence | Secondary Evidence | Critical Prescription | Attention Prescription | Monitor Prescription |
|---|---|---|---|---|---|
| CONFIDENCE | OUTCOME | CONSISTENCY, PRESSURE | HAPPY_CONFIDENCE_001, HAPPY_CONFIDENCE_002, HAPPY_CONFIDENCE_003 | HAPPY_CONFIDENCE_001, HAPPY_CONFIDENCE_002 | HAPPY_CONFIDENCE_001 |
| ORGANIZATION | CONSISTENCY | RHYTHM, PHYSICAL | HAPPY_ORGANIZATION_001, HAPPY_ORGANIZATION_002, HAPPY_ORGANIZATION_003 | HAPPY_ORGANIZATION_001, HAPPY_ORGANIZATION_002 | HAPPY_ORGANIZATION_001 |
| MANAGEMENT | PROCESS | TRANSFER, CONSISTENCY | HAPPY_MANAGEMENT_001, HAPPY_MANAGEMENT_002, HAPPY_MANAGEMENT_003 | HAPPY_MANAGEMENT_001, HAPPY_MANAGEMENT_002 | HAPPY_MANAGEMENT_001 |
| ANALYSIS | DEEPENING | PROCESS, RHYTHM | HAPPY_ANALYSIS_001, HAPPY_ANALYSIS_002, HAPPY_ANALYSIS_003 | HAPPY_ANALYSIS_001, HAPPY_ANALYSIS_002 | HAPPY_ANALYSIS_001 |
| NERVE | PRESSURE | EMOTIONAL, RHYTHM | HAPPY_NERVE_001, HAPPY_NERVE_002, HAPPY_NERVE_003 | HAPPY_NERVE_001, HAPPY_NERVE_002 | HAPPY_NERVE_001 |
| DISCIPLINE | CONSISTENCY | PROCESS, PHYSICAL | HAPPY_DISCIPLINE_001, HAPPY_DISCIPLINE_002, HAPPY_DISCIPLINE_003 | HAPPY_DISCIPLINE_001, HAPPY_DISCIPLINE_002 | HAPPY_DISCIPLINE_001 |
| OPPORTUNITY | TRANSFER | DEEPENING, OUTCOME | HAPPY_OPPORTUNITY_001, HAPPY_OPPORTUNITY_002, HAPPY_OPPORTUNITY_003 | HAPPY_OPPORTUNITY_001, HAPPY_OPPORTUNITY_002 | HAPPY_OPPORTUNITY_001 |
| HEED | RHYTHM | EMOTIONAL, PRESSURE | HAPPY_HEED_001, HAPPY_HEED_002, HAPPY_HEED_003 | HAPPY_HEED_001, HAPPY_HEED_002 | HAPPY_HEED_001 |
| ALIGNMENT | TRANSFER | PROCESS, OUTCOME | HAPPY_ALIGNMENT_001, HAPPY_ALIGNMENT_002, HAPPY_ALIGNMENT_003 | HAPPY_ALIGNMENT_001, HAPPY_ALIGNMENT_002 | HAPPY_ALIGNMENT_001 |
| PLAN | PROCESS | CONSISTENCY, TRANSFER | HAPPY_PLAN_001, HAPPY_PLAN_002, HAPPY_PLAN_003 | HAPPY_PLAN_001, HAPPY_PLAN_002 | HAPPY_PLAN_001 |
| POWERING | PHYSICAL | RHYTHM, PRESSURE | HAPPY_POWERING_001, HAPPY_POWERING_002, HAPPY_POWERING_003 | HAPPY_POWERING_001, HAPPY_POWERING_002 | HAPPY_POWERING_001 |
| YEARN | CONSISTENCY | OUTCOME, PHYSICAL | HAPPY_YEARN_001, HAPPY_YEARN_002, HAPPY_YEARN_003 | HAPPY_YEARN_001, HAPPY_YEARN_002 | HAPPY_YEARN_001 |

## Parameter Rules

### CONFIDENCE

**Reading:** Confidence is real when it is supported by score, repetition, and pressure stability.

**Primary HCI evidence:** OUTCOME

**Secondary HCI evidence:** CONSISTENCY, PRESSURE

**Critical:** HAPPY_CONFIDENCE_001, HAPPY_CONFIDENCE_002, HAPPY_CONFIDENCE_003
**Attention:** HAPPY_CONFIDENCE_001, HAPPY_CONFIDENCE_002
**Monitor:** HAPPY_CONFIDENCE_001

### ORGANIZATION

**Reading:** Routine quality appears as stable repetition, rhythm, and physical availability.

**Primary HCI evidence:** CONSISTENCY

**Secondary HCI evidence:** RHYTHM, PHYSICAL

**Critical:** HAPPY_ORGANIZATION_001, HAPPY_ORGANIZATION_002, HAPPY_ORGANIZATION_003
**Attention:** HAPPY_ORGANIZATION_001, HAPPY_ORGANIZATION_002
**Monitor:** HAPPY_ORGANIZATION_001

### MANAGEMENT

**Reading:** The plan becomes performance when the athlete executes the technical process repeatedly.

**Primary HCI evidence:** PROCESS

**Secondary HCI evidence:** TRANSFER, CONSISTENCY

**Critical:** HAPPY_MANAGEMENT_001, HAPPY_MANAGEMENT_002, HAPPY_MANAGEMENT_003
**Attention:** HAPPY_MANAGEMENT_001, HAPPY_MANAGEMENT_002
**Monitor:** HAPPY_MANAGEMENT_001

### ANALYSIS

**Reading:** Learning is present when the athlete turns data and sensations into process adjustments.

**Primary HCI evidence:** DEEPENING

**Secondary HCI evidence:** PROCESS, RHYTHM

**Critical:** HAPPY_ANALYSIS_001, HAPPY_ANALYSIS_002, HAPPY_ANALYSIS_003
**Attention:** HAPPY_ANALYSIS_001, HAPPY_ANALYSIS_002
**Monitor:** HAPPY_ANALYSIS_001

### NERVE

**Reading:** Pressure control is validated when emotional stability and rhythm hold under demand.

**Primary HCI evidence:** PRESSURE

**Secondary HCI evidence:** EMOTIONAL, RHYTHM

**Critical:** HAPPY_NERVE_001, HAPPY_NERVE_002, HAPPY_NERVE_003
**Attention:** HAPPY_NERVE_001, HAPPY_NERVE_002
**Monitor:** HAPPY_NERVE_001

### DISCIPLINE

**Reading:** Discipline shows up as repeated process quality, not as intention alone.

**Primary HCI evidence:** CONSISTENCY

**Secondary HCI evidence:** PROCESS, PHYSICAL

**Critical:** HAPPY_DISCIPLINE_001, HAPPY_DISCIPLINE_002, HAPPY_DISCIPLINE_003
**Attention:** HAPPY_DISCIPLINE_001, HAPPY_DISCIPLINE_002
**Monitor:** HAPPY_DISCIPLINE_001

### OPPORTUNITY

**Reading:** Opportunity is used when prescribed training transfers into actual performance.

**Primary HCI evidence:** TRANSFER

**Secondary HCI evidence:** DEEPENING, OUTCOME

**Critical:** HAPPY_OPPORTUNITY_001, HAPPY_OPPORTUNITY_002, HAPPY_OPPORTUNITY_003
**Attention:** HAPPY_OPPORTUNITY_001, HAPPY_OPPORTUNITY_002
**Monitor:** HAPPY_OPPORTUNITY_001

### HEED

**Reading:** Arousal awareness is validated when rhythm and emotional behavior remain regulated.

**Primary HCI evidence:** RHYTHM

**Secondary HCI evidence:** EMOTIONAL, PRESSURE

**Critical:** HAPPY_HEED_001, HAPPY_HEED_002, HAPPY_HEED_003
**Attention:** HAPPY_HEED_001, HAPPY_HEED_002
**Monitor:** HAPPY_HEED_001

### ALIGNMENT

**Reading:** Coach-athlete clarity is validated when training direction transfers to execution and score.

**Primary HCI evidence:** TRANSFER

**Secondary HCI evidence:** PROCESS, OUTCOME

**Critical:** HAPPY_ALIGNMENT_001, HAPPY_ALIGNMENT_002, HAPPY_ALIGNMENT_003
**Attention:** HAPPY_ALIGNMENT_001, HAPPY_ALIGNMENT_002
**Monitor:** HAPPY_ALIGNMENT_001

### PLAN

**Reading:** Plan fit is validated by adherence, process execution, and transfer.

**Primary HCI evidence:** PROCESS

**Secondary HCI evidence:** CONSISTENCY, TRANSFER

**Critical:** HAPPY_PLAN_001, HAPPY_PLAN_002, HAPPY_PLAN_003
**Attention:** HAPPY_PLAN_001, HAPPY_PLAN_002
**Monitor:** HAPPY_PLAN_001

### POWERING

**Reading:** Energy investment is useful only when it sustains rhythm, body quality, and pressure behavior.

**Primary HCI evidence:** PHYSICAL

**Secondary HCI evidence:** RHYTHM, PRESSURE

**Critical:** HAPPY_POWERING_001, HAPPY_POWERING_002, HAPPY_POWERING_003
**Attention:** HAPPY_POWERING_001, HAPPY_POWERING_002
**Monitor:** HAPPY_POWERING_001

### YEARN

**Reading:** Long-term desire is validated by consistency, frequency, and sustained physical availability.

**Primary HCI evidence:** CONSISTENCY

**Secondary HCI evidence:** OUTCOME, PHYSICAL

**Critical:** HAPPY_YEARN_001, HAPPY_YEARN_002, HAPPY_YEARN_003
**Attention:** HAPPY_YEARN_001, HAPPY_YEARN_002
**Monitor:** HAPPY_YEARN_001

## Output Rule

Coach output may use severity labels. Athlete output must use developmental language and avoid deficit-focused labels.

## Integration Note

Prescription must always come from the canonical HAPPY library. The dashboard only displays. The engine decides. The library prescribes.