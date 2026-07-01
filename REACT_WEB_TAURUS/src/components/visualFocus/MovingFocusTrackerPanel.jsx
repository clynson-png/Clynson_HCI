import { useEffect, useMemo, useRef, useState } from 'react'
import {
  calculateMovingFocusMetrics,
  classifyMovingFocusFrame,
} from '../../engines/HciMovingFocusTrackerEngineV1'
import MovingFocusOverlay from './MovingFocusOverlay'
import VisualFocusMetricsCard from './VisualFocusMetricsCard'

const DEFAULT_MOVING_FOCUS_SESSION = {
  athleteId: 'local_athlete',
  sessionId: 'moving_focus_live_v1',
  drillCode: 'MOVING_FOCUS_DESCENT_V1',
  durationMs: 9000,
  targetBox: {
    width: 320,
    height: 320,
  },
  movingObject: {
    width: 34,
    height: 34,
    startY: 28,
    endY: 236,
    x: 143,
  },
  blackCircle: {
    x: 160,
    y: 160,
    radius: 68,
  },
  yAxisCorridor: {
    xMin: 118,
    xMax: 202,
    yMin: 24,
    yMax: 270,
  },
}

function MovingFocusTrackerPanel({ session = DEFAULT_MOVING_FOCUS_SESSION, onMetricsChange }) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [gaze, setGaze] = useState(null)
  const [status, setStatus] = useState('IDLE')
  const [frames, setFrames] = useState([])
  const frameRef = useRef(0)
  const startedAtRef = useRef(0)
  const gazeRef = useRef(null)

  const movingObject = useMemo(() => {
    const y =
      session.movingObject.startY +
      (session.movingObject.endY - session.movingObject.startY) * progress

    return {
      x: session.movingObject.x,
      y,
      width: session.movingObject.width,
      height: session.movingObject.height,
    }
  }, [progress, session])

  const metrics = useMemo(() => {
    if (running || frames.length === 0) return null
    return calculateMovingFocusMetrics(frames)
  }, [frames, running])

  useEffect(() => {
    onMetricsChange?.(metrics)
  }, [metrics, onMetricsChange])

  function startCalibration() {
    window.cancelAnimationFrame(frameRef.current)
    setRunning(true)
    setProgress(0)
    setGaze(null)
    gazeRef.current = null
    setFrames([])
    setStatus('IDLE')
    startedAtRef.current = performance.now()
    frameRef.current = window.requestAnimationFrame(runFrame)
  }

  function runFrame(now) {
    const elapsed = now - startedAtRef.current
    const nextProgress = Math.min(1, elapsed / session.durationMs)
    const nextMovingObject = {
      x: session.movingObject.x,
      y:
        session.movingObject.startY +
        (session.movingObject.endY - session.movingObject.startY) * nextProgress,
      width: session.movingObject.width,
      height: session.movingObject.height,
    }
    const nextGaze = gazeRef.current
      ? {
          ...gazeRef.current,
          timestamp: now,
        }
      : null
    const nextStatus = classifyMovingFocusFrame({
      gaze: nextGaze,
      phase: 'DESCENT',
      movingObject: nextMovingObject,
      blackCircle: session.blackCircle,
      yAxisCorridor: session.yAxisCorridor,
      tolerance: 22,
    })

    setProgress(nextProgress)
    setGaze(nextGaze)
    setStatus(nextStatus)
    setFrames((current) => [
      ...current,
      {
        timestamp: now,
        gaze: nextGaze,
        status: nextStatus,
      },
    ])

    if (nextProgress < 1) {
      frameRef.current = window.requestAnimationFrame(runFrame)
      return
    }

    setRunning(false)
  }

  return (
    <section className="visual-focus-panel">
      <div className="visual-focus-head">
        <div>
          <span>HCI Moving Focus Tracker V1</span>
          <h3>Visual Focus Drill</h3>
          <p>Analise funcional do foco na maca durante a descida.</p>
        </div>
        <button type="button" onClick={startCalibration}>
          {running ? 'Rodando' : 'Iniciar calibracao'}
        </button>
      </div>

      <div className="visual-focus-layout">
        <MovingFocusOverlay
          session={session}
          movingObject={movingObject}
          gaze={gaze}
          status={status}
          onPointerGaze={(nextGaze) => {
            gazeRef.current = nextGaze
            setGaze(nextGaze)
          }}
        />
        <div className="visual-focus-side">
          <div className={`visual-focus-status ${status.toLowerCase()}`}>
            <small>Status</small>
            <strong>{status}</strong>
          </div>
          <VisualFocusMetricsCard metrics={metrics} />
        </div>
      </div>
    </section>
  )
}

export default MovingFocusTrackerPanel
