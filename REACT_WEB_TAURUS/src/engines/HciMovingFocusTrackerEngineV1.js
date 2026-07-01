export const FOCUS_STATUS = {
  OK_FOLLOWING_MOVING_OBJECT: 'OK_FOLLOWING_MOVING_OBJECT',
  ERROR_LEFT_Y_AXIS: 'ERROR_LEFT_Y_AXIS',
  ERROR_LOOKED_AT_BLACK_CIRCLE: 'ERROR_LOOKED_AT_BLACK_CIRCLE',
  ERROR_NOT_FOLLOWING_MOVING_OBJECT: 'ERROR_NOT_FOLLOWING_MOVING_OBJECT',
  NO_GAZE_DETECTED: 'NO_GAZE_DETECTED',
  IDLE: 'IDLE',
}

export function isLookingAtMovingObject(gaze, movingObject, tolerance = 20) {
  if (!gaze || !movingObject) return false

  return (
    gaze.x >= movingObject.x - tolerance &&
    gaze.x <= movingObject.x + movingObject.width + tolerance &&
    gaze.y >= movingObject.y - tolerance &&
    gaze.y <= movingObject.y + movingObject.height + tolerance
  )
}

export function isLookingAtBlackCircle(gaze, blackCircle) {
  if (!gaze || !blackCircle) return false

  const dx = gaze.x - blackCircle.x
  const dy = gaze.y - blackCircle.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  return distance <= blackCircle.radius
}

export function isInsideYAxisCorridor(gaze, corridor) {
  if (!gaze || !corridor) return false

  return (
    gaze.x >= corridor.xMin &&
    gaze.x <= corridor.xMax &&
    gaze.y >= corridor.yMin &&
    gaze.y <= corridor.yMax
  )
}

export function classifyMovingFocusFrame({
  gaze,
  phase,
  movingObject,
  blackCircle,
  yAxisCorridor,
  tolerance = 20,
}) {
  if (!gaze) {
    return FOCUS_STATUS.NO_GAZE_DETECTED
  }

  if (phase !== 'DESCENT') {
    return FOCUS_STATUS.IDLE
  }

  const insideYAxis = isInsideYAxisCorridor(gaze, yAxisCorridor)
  const lookingAtMovingObject = isLookingAtMovingObject(gaze, movingObject, tolerance)
  const lookingAtBlackCircle = isLookingAtBlackCircle(gaze, blackCircle)

  if (!insideYAxis) {
    return FOCUS_STATUS.ERROR_LEFT_Y_AXIS
  }

  if (lookingAtBlackCircle && !lookingAtMovingObject) {
    return FOCUS_STATUS.ERROR_LOOKED_AT_BLACK_CIRCLE
  }

  if (lookingAtMovingObject && insideYAxis) {
    return FOCUS_STATUS.OK_FOLLOWING_MOVING_OBJECT
  }

  return FOCUS_STATUS.ERROR_NOT_FOLLOWING_MOVING_OBJECT
}

export function calculateMovingFocusMetrics(frames = [], options = {}) {
  const totalFrames = frames.length
  const count = (status) => frames.filter((frame) => frame.status === status).length
  const durationByStatus = calculateDurationByStatus(frames, options)
  const blinkMetrics = calculateBlinkMetrics(frames, options)
  const validGazeFrames = totalFrames - count(FOCUS_STATUS.NO_GAZE_DETECTED)
  const followingMovingObjectFrames = count(FOCUS_STATUS.OK_FOLLOWING_MOVING_OBJECT)
  const blackCircleErrorFrames = count(FOCUS_STATUS.ERROR_LOOKED_AT_BLACK_CIRCLE)
  const yAxisErrorFrames = count(FOCUS_STATUS.ERROR_LEFT_Y_AXIS)
  const notFollowingObjectFrames = count(FOCUS_STATUS.ERROR_NOT_FOLLOWING_MOVING_OBJECT)
  const noGazeDetectedFrames = count(FOCUS_STATUS.NO_GAZE_DETECTED)
  const divisor = totalFrames || 1

  const followingMovingObjectPct = roundPct((followingMovingObjectFrames / divisor) * 100)
  const blackCircleFixationPct = roundPct((blackCircleErrorFrames / divisor) * 100)
  const yAxisDeviationPct = roundPct((yAxisErrorFrames / divisor) * 100)
  const lostFocusPct = roundPct((notFollowingObjectFrames / divisor) * 100)
  const visualDisciplineScore = clampScore(
    100 -
      blackCircleFixationPct * 1.5 -
      yAxisDeviationPct * 1.2 -
      lostFocusPct * 1.0
  )

  return {
    totalFrames,
    validGazeFrames,
    followingMovingObjectFrames,
    blackCircleErrorFrames,
    yAxisErrorFrames,
    notFollowingObjectFrames,
    noGazeDetectedFrames,
    followingMovingObjectMs: durationByStatus[FOCUS_STATUS.OK_FOLLOWING_MOVING_OBJECT],
    blackCircleFixationMs: durationByStatus[FOCUS_STATUS.ERROR_LOOKED_AT_BLACK_CIRCLE],
    yAxisDeviationMs: durationByStatus[FOCUS_STATUS.ERROR_LEFT_Y_AXIS],
    lostFocusMs: durationByStatus[FOCUS_STATUS.ERROR_NOT_FOLLOWING_MOVING_OBJECT],
    noGazeDetectedMs: durationByStatus[FOCUS_STATUS.NO_GAZE_DETECTED],
    measuredMs: Object.values(durationByStatus).reduce((sum, value) => sum + value, 0),
    blinkCount: blinkMetrics.blinkCount,
    eyeOpenMs: blinkMetrics.eyeOpenMs,
    eyeClosedMs: blinkMetrics.eyeClosedMs,
    eyeOpenPct: blinkMetrics.eyeOpenPct,
    followingMovingObjectPct,
    blackCircleFixationPct,
    yAxisDeviationPct,
    lostFocusPct,
    visualDisciplineScore,
    interpretation: interpretVisualDiscipline(visualDisciplineScore),
  }
}

export function calculateBlinkMetrics(frames = [], options = {}) {
  const sortedFrames = [...frames]
    .filter((frame) => Number.isFinite(Number(frame.timestamp)) && frame.eyeState)
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))

  let eyeOpenMs = 0
  let eyeClosedMs = 0
  let blinkCount = 0
  let wasClosed = false

  sortedFrames.forEach((frame, index) => {
    const nextFrame = sortedFrames[index + 1]
    const rawDuration = getFrameDuration(frame, nextFrame, options)
    const duration = Math.max(0, Math.min(250, rawDuration))
    const isClosed = !!frame.eyeState.isClosed

    if (isClosed) {
      eyeClosedMs += duration
      if (!wasClosed) blinkCount += 1
    } else {
      eyeOpenMs += duration
    }

    wasClosed = isClosed
  })

  const measuredMs = eyeOpenMs + eyeClosedMs

  return {
    blinkCount,
    eyeOpenMs: Math.round(eyeOpenMs),
    eyeClosedMs: Math.round(eyeClosedMs),
    eyeOpenPct: measuredMs ? roundPct((eyeOpenMs / measuredMs) * 100) : 0,
  }
}

export function interpretVisualDiscipline(score) {
  if (score >= 90) return 'EXCELLENT_VISUAL_DISCIPLINE'
  if (score >= 75) return 'GOOD_VISUAL_DISCIPLINE'
  if (score >= 60) return 'UNSTABLE_VISUAL_DISCIPLINE'
  return 'CRITICAL_VISUAL_DISCIPLINE_FAILURE'
}

function clampScore(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return 0
  return Math.max(0, Math.min(100, Math.round(numericValue)))
}

function roundPct(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return 0
  return Math.round(numericValue)
}

function calculateDurationByStatus(frames = [], options = {}) {
  const durations = Object.values(FOCUS_STATUS).reduce((acc, status) => {
    acc[status] = 0
    return acc
  }, {})

  const sortedFrames = [...frames]
    .filter((frame) => Number.isFinite(Number(frame.timestamp)))
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))

  sortedFrames.forEach((frame, index) => {
    const nextFrame = sortedFrames[index + 1]
    const rawDuration = getFrameDuration(frame, nextFrame, options)
    const duration = Math.max(0, Math.min(250, rawDuration))
    durations[frame.status] = (durations[frame.status] || 0) + duration
  })

  return Object.fromEntries(
    Object.entries(durations).map(([status, value]) => [status, Math.round(value)])
  )
}

function getFrameDuration(frame, nextFrame, options = {}) {
  if (nextFrame) {
    return Number(nextFrame.timestamp) - Number(frame.timestamp)
  }

  const endAt = Number(options.endAt)
  const frameTimestamp = Number(frame.timestamp)
  if (Number.isFinite(endAt) && Number.isFinite(frameTimestamp) && endAt > frameTimestamp) {
    return endAt - frameTimestamp
  }

  return 0
}
