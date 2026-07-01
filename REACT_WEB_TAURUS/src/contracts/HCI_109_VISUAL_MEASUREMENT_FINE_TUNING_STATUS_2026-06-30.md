# Status - HCI_109 Visual Measurement Fine Tuning

Date: 2026-06-30

Parent SPEC: `src/contracts/HCI_109_FOCUS_RECORDING_BEFORE_AUDIO_SPEC_2026-06-29.md`

## Decision

Camera-based eye displacement is allowed only as an experimental source.

## Implemented Sources

```text
POINTER_OBJECT
CAMERA_IRIS_EXPERIMENTAL
CAMERA_FACE_ONLY
CAMERA_EYE_STATE_ONLY
NO_VISUAL_TRACKING
```

## Reliability Labels

```text
HIGH_FOR_OBJECT_FOCUS
EXPERIMENTAL_EYE_DISPLACEMENT
LOW_FOR_EYE_DISPLACEMENT
VALID_FOR_BLINK_OPEN_CLOSED_ONLY
NO_SAMPLE
```

## Behavior

- Pointer remains the reliable source for object/maçã focus.
- Camera records eye open, eye closed, and blinks.
- Iris displacement is saved only when MediaPipe returns usable iris landmarks.
- Face-only camera tracking is marked as low reliability for eye displacement.
- Every HCI_109 shot can now carry:
  - visualTrackingSource
  - visualReliability
  - visualFocusMetrics
  - visualFocusSourceType

## UI

Library, Admin, and Resumo expose the visual source so the coach can distinguish pointer focus from experimental iris tracking.
