import { FOCUS_STATUS } from '../../engines/HciMovingFocusTrackerEngineV1'

function MovingFocusOverlay({ session, movingObject, gaze, status, onPointerGaze }) {
  const statusClass = resolveStatusClass(status)

  return (
    <div
      className="moving-focus-overlay"
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect()
        const scaleX = session.targetBox.width / bounds.width
        const scaleY = session.targetBox.height / bounds.height

        onPointerGaze?.({
          x: (event.clientX - bounds.left) * scaleX,
          y: (event.clientY - bounds.top) * scaleY,
          timestamp: performance.now(),
        })
      }}
      onPointerLeave={() => onPointerGaze?.(null)}
      style={{
        width: session.targetBox.width,
        height: session.targetBox.height,
      }}
    >
      <div
        className="moving-focus-corridor"
        style={{
          left: session.yAxisCorridor.xMin,
          top: session.yAxisCorridor.yMin,
          width: session.yAxisCorridor.xMax - session.yAxisCorridor.xMin,
          height: session.yAxisCorridor.yMax - session.yAxisCorridor.yMin,
        }}
      />
      <div
        className="moving-focus-black-circle"
        style={{
          left: session.blackCircle.x - session.blackCircle.radius,
          top: session.blackCircle.y - session.blackCircle.radius,
          width: session.blackCircle.radius * 2,
          height: session.blackCircle.radius * 2,
        }}
      />
      <div
        className={`moving-focus-object ${statusClass}`}
        style={{
          left: movingObject.x,
          top: movingObject.y,
          width: movingObject.width,
          height: movingObject.height,
        }}
      />
      {gaze && (
        <div
          className={`moving-focus-gaze ${statusClass}`}
          style={{
            left: gaze.x,
            top: gaze.y,
          }}
        />
      )}
    </div>
  )
}

function resolveStatusClass(status) {
  if (status === FOCUS_STATUS.OK_FOLLOWING_MOVING_OBJECT) return 'ok'
  if (status === FOCUS_STATUS.ERROR_LOOKED_AT_BLACK_CIRCLE) return 'black'
  if (status === FOCUS_STATUS.ERROR_LEFT_Y_AXIS) return 'axis'
  if (status === FOCUS_STATUS.ERROR_NOT_FOLLOWING_MOVING_OBJECT) return 'lost'
  return 'idle'
}

export default MovingFocusOverlay
