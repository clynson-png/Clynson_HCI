import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  getHappyExerciseById,
  getHappyPrescriptionRuleByParameter,
  getLibraryCollections,
  getTrainingById,
  getTrainingLibraryEntries,
  getTrainingLibraryStats,
} from '../services/trainingLibraryService'
import { loadCustomTrainingEntries } from '../services/trainingLibraryCustomStore'
import { loadHci109Sessions, saveHci109Session } from '../services/hci109SessionStore'
import {
  calculateMovingFocusMetrics,
  classifyMovingFocusFrame,
} from '../engines/HciMovingFocusTrackerEngineV1'
import taurusLogoWordmark from '../assets/taurus-logo-wordmark.png'

const MEDIAPIPE_TASKS_VERSION = '0.10.35'
const MEDIAPIPE_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VERSION}/wasm`
const MEDIAPIPE_FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'
const ESTIMATED_BLINK_DURATION_MS = 350

function LibraryPage({ lang = 'pt', subscriptionAccess = {}, selectedAthlete = '' }) {
  const uiLang = lang === 'en' ? 'en-US' : 'pt-BR'
  const trainingStats = getTrainingLibraryStats()
  const isAdminLibrary = !!subscriptionAccess.canViewLibrary
  const isPremiumHci109Only = !isAdminLibrary && !!subscriptionAccess.canViewLibraryHci109
  const [trainings, setTrainings] = useState(() => getTrainingLibraryEntries())
  const [collections, setCollections] = useState(() => getLibraryCollections())

  const [collectionId, setCollectionId] = useState('TECHNICAL_LIBRARY')
  const [targetType, setTargetType] = useState('ALL')
  const [pendingAdditions] = useState([])
  const [openInteractiveId, setOpenInteractiveId] = useState('')
  const [openInteractiveMode, setOpenInteractiveMode] = useState('RHYTHM')
  const [selectedItemId, setSelectedItemId] = useState(
    trainingStats.firstTraining || ''
  )
  const [hci109Sessions, setHci109Sessions] = useState([])

  useEffect(() => {
    let cancelled = false

    async function loadCustomLibrary() {
      await loadCustomTrainingEntries()
      const savedHci109Sessions = await loadHci109Sessions()
      if (!cancelled) {
        setTrainings(getTrainingLibraryEntries())
        setCollections(getLibraryCollections())
        setHci109Sessions(savedHci109Sessions)
      }
    }

    loadCustomLibrary()

    return () => {
      cancelled = true
    }
  }, [])

  async function refreshHci109Sessions() {
    const savedHci109Sessions = await loadHci109Sessions()
    setHci109Sessions(savedHci109Sessions)
  }

  const activeCollection =
    collections.find((item) => item.id === collectionId) || collections[0]

  const visibleItems = useMemo(() => {
    if (isPremiumHci109Only) {
      return trainings.filter((training) => {
        return targetType === 'ALL' || training.targetType === targetType
      })
    }

    if (collectionId !== 'TECHNICAL_LIBRARY') {
      return activeCollection?.entries || []
    }

    return trainings.filter((training) => {
      return targetType === 'ALL' || training.targetType === targetType
    })
  }, [activeCollection, collectionId, isPremiumHci109Only, targetType, trainings])

  const selectedItem = useMemo(() => {
    if (isPremiumHci109Only) {
      return getTrainingById(selectedItemId) || visibleItems[0] || null
    }

    if (collectionId === 'HAPPY_LIBRARY') {
      return (
        getHappyExerciseById(selectedItemId) ||
        visibleItems[0] ||
        null
      )
    }

    if (collectionId === 'HAPPY_PRESCRIPTION') {
      return (
        getHappyPrescriptionRuleByParameter(selectedItemId) ||
        visibleItems[0] ||
        null
      )
    }

    return getTrainingById(selectedItemId) || visibleItems[0] || null
  }, [collectionId, isPremiumHci109Only, selectedItemId, visibleItems])

  function exportUpdatedCanonicalJson() {
    const updatedCanonical = {
      version: '4_1_react_web_updated',
      updatedAt: new Date().toISOString(),
      designRule: {
        'pt-BR':
          'Biblioteca canonical atualizada pelo React Web Library Module V4.1-A.',
        'en-US':
          'Canonical library updated by React Web Library Module V4.1-A.',
      },
      entries: [...trainings, ...pendingAdditions],
    }

    const jsonContent = JSON.stringify(updatedCanonical, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = 'training_library_canonical_updated.json'
    link.click()

    URL.revokeObjectURL(url)
  }

  function resolveItemId(item) {
    return item.trainingId || item.exerciseId || item.parameter || ''
  }

  function resolveItemLabel(item) {
    if (item.trainingId) {
      return item.trainingId
    }

    if (item.exerciseId) {
      return `${item.parameter} - ${item.name?.[uiLang] || item.exerciseId}`
    }

    return item.parameter
  }

  function handleCollectionChange(nextCollectionId) {
    if (isPremiumHci109Only) return

    const nextCollection =
      collections.find((item) => item.id === nextCollectionId) || collections[0]

    setCollectionId(nextCollectionId)
    setTargetType('ALL')
    setSelectedItemId(resolveItemId(nextCollection.entries?.[0] || {}))
  }

  const isHciTraining =
  selectedItem?.trainingId?.includes('HCI_109') ||
  selectedItem?.targetType === 'HCI_109'

  return (
    <main className="dashboard dashboard-library">
      <header className="dashboard-header taurus-page-header">
        <div className="taurus-page-header-brand">
          <img src={taurusLogoWordmark} alt="TAURUS" />
        </div>

        <div className="taurus-page-header-title">
          <small>HCI PERFORMANCE</small>
          <h1>Library</h1>
        </div>
      </header>

      {isAdminLibrary && (
        <>
          <section className="cards">
            <div className="card">
              <span>Technical Trainings</span>
              <strong>{trainingStats.totalTrainings}</strong>
            </div>

            <div className="card">
              <span>HAPPY Exercises</span>
              <strong>{trainingStats.totalHappyExercises}</strong>
            </div>

            <div className="card">
              <span>Prescription Rules</span>
              <strong>{trainingStats.totalHappyRules}</strong>
            </div>

            <div className="card">
              <span>Visible Items</span>
              <strong>{visibleItems.length}</strong>
            </div>
          </section>

          <section className="panel">
            <h2>Canonical Export</h2>

            <div className="admin-actions" style={{ padding: 16 }}>
              <button onClick={exportUpdatedCanonicalJson}>
                Export Updated Canonical JSON
              </button>
            </div>

            <p style={{ padding: '0 16px 16px' }}>
              Exports the current technical canonical library plus pending additions as
              training_library_canonical_updated.json.
            </p>
          </section>

          <section className="panel selector-panel">
            <h2>Library Collection</h2>

            <div className="selector-row">
              <select
                value={collectionId}
                onChange={(event) => handleCollectionChange(event.target.value)}
              >
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.title}
                  </option>
                ))}
              </select>
            </div>
          </section>
        </>
      )}

      {collectionId === 'TECHNICAL_LIBRARY' && (isAdminLibrary || isPremiumHci109Only) && (
        <section className="panel selector-panel">
          <h2>Library Filters</h2>

          <div className="selector-row">
            <select
              value={targetType}
              onChange={(event) => {
                setTargetType(event.target.value)
                setSelectedItemId('')
              }}
            >
              <option value="ALL">All Target Types</option>
              <option value="DUEL_20">Duel 20</option>
              <option value="DEFENSE_HUMANOID">Humanoid</option>
              <option value="PRECISION_COLOR">Color Cards</option>
              <option value="HCI_109">HCI 10.9</option>
            </select>
          </div>
        </section>
      )}

      <section className="panel selector-panel">
        <h2>{isPremiumHci109Only ? 'Technical Library' : activeCollection?.title}</h2>

        <div className="selector-row">
          <select
            value={resolveItemId(selectedItem || {})}
            onChange={(event) => {
              setSelectedItemId(event.target.value)
            }}
          >
            {visibleItems.map((item) => (
              <option key={resolveItemId(item)} value={resolveItemId(item)}>
                {resolveItemLabel(item)}
              </option>
            ))}
          </select>
        </div>
      </section>

      {selectedItem && collectionId === 'TECHNICAL_LIBRARY' && (
        <section className="panel">
          <h2>{selectedItem.name?.[uiLang]}</h2>

          <div style={{ padding: 16 }}>
            <p><strong>Training ID:</strong> {selectedItem.trainingId}</p>
            <p><strong>Target Type:</strong> {selectedItem.targetType}</p>
            <p><strong>Parameter:</strong> {selectedItem.parameter}</p>
            <p><strong>Phase:</strong> {selectedItem.phase}</p>
            <p><strong>Level:</strong> {selectedItem.level}</p>
            <p><strong>Weapon:</strong> {selectedItem.weaponClass}</p>
            <p><strong>Objective:</strong> {selectedItem.objective?.[uiLang]}</p>
            <p><strong>Description:</strong> {selectedItem.description?.[uiLang]}</p>
            <p><strong>Execution:</strong> {selectedItem.executionSummary?.[uiLang]}</p>
            <p><strong>Load:</strong> {selectedItem.loadNote?.[uiLang]}</p>

            {isHciTraining && (
              <div className="admin-actions hci-open-actions">
                <button
                  type="button"
                  onClick={() => {
                    setOpenInteractiveMode('RHYTHM')
                    setOpenInteractiveId((current) =>
                      current === selectedItem.trainingId &&
                      openInteractiveMode === 'RHYTHM'
                        ? ''
                        : selectedItem.trainingId
                    )
                  }}
                >
                  {openInteractiveId === selectedItem.trainingId && openInteractiveMode === 'RHYTHM'
                    ? 'Fechar Ritmo'
                    : 'Abrir Ritmo'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenInteractiveMode('SIGHT')
                    setOpenInteractiveId((current) =>
                      current === selectedItem.trainingId &&
                      openInteractiveMode === 'SIGHT'
                        ? ''
                        : selectedItem.trainingId
                    )
                  }}
                >
                  {openInteractiveId === selectedItem.trainingId && openInteractiveMode === 'SIGHT'
                    ? 'Fechar Visada'
                    : 'Abrir Visada'}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {isHciTraining && openInteractiveId === selectedItem.trainingId && (
        <Hci109Trainer
          lang={lang}
          training={selectedItem}
          mode={openInteractiveMode}
          athleteName={selectedAthlete}
          onSessionSaved={refreshHci109Sessions}
        />
      )}

      {isHciTraining && (
        <Hci109ComparisonPanel
          sessions={hci109Sessions.filter((session) =>
            !selectedAthlete || session.athleteName === selectedAthlete
          )}
          lang={lang}
        />
      )}

      {isAdminLibrary && selectedItem && collectionId === 'HAPPY_LIBRARY' && (
        <section className="panel">
          <h2>{selectedItem.name?.[uiLang]}</h2>

          <div style={{ padding: 16 }}>
            <p><strong>Exercise ID:</strong> {selectedItem.exerciseId}</p>
            <p><strong>Parameter:</strong> {selectedItem.parameter}</p>
            <p><strong>Source System:</strong> {selectedItem.sourceSystem}</p>
            <p><strong>Objective:</strong> {selectedItem.objective?.[uiLang]}</p>
            <p><strong>How to do:</strong> {selectedItem.howToDo?.[uiLang]}</p>
          </div>
        </section>
      )}

      {isAdminLibrary && selectedItem && collectionId === 'HAPPY_PRESCRIPTION' && (
        <section className="panel">
          <h2>{selectedItem.parameter}</h2>

          <div style={{ padding: 16 }}>
            <p><strong>Source System:</strong> {selectedItem.sourceSystem}</p>
            <p><strong>Primary HCI Evidence:</strong> {selectedItem.primaryHciEvidence}</p>
            <p><strong>Secondary HCI Evidence:</strong> {selectedItem.secondaryHciEvidence?.join(', ')}</p>
            <p><strong>Critical:</strong> {selectedItem.criticalExercises?.join(', ')}</p>
            <p><strong>Attention:</strong> {selectedItem.attentionExercises?.join(', ')}</p>
            <p><strong>Monitor:</strong> {selectedItem.monitorExercises?.join(', ')}</p>
          </div>
        </section>
      )}

      {isAdminLibrary && (
        <section className="panel">
          <h2>HCI HAPPY Integration</h2>
          <p style={{ padding: 16 }}>
            The library now exposes the technical canonical, the HAPPY/COMANDO exercise canonical and the HAPPY prescription matrix. The next implementation step is to bind these canonicals to the new ATHLETE and CROSS ANALYSIS render blocks.
          </p>
        </section>
      )}
    </main>
  )
}

export default LibraryPage

function Hci109ComparisonPanel({ sessions = [], lang = 'pt' }) {
  const isEnglish = lang === 'en'
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => Number(a.recordedAt || 0) - Number(b.recordedAt || 0)),
    [sessions]
  )
  const rhythmRows = sortedSessions
    .filter((session) => session.sessionType === 'RHYTHM')
    .map((session, index) => ({
      label: `${index + 1}`,
      total: session.seriesTotal,
      reactionAvgSec: averageReactionSec(session.shots),
      dispersion: Number(session.averageRadius || 0),
      date: formatDateTime(session.recordedAt),
    }))
  const sightRows = sortedSessions
    .filter((session) => session.sessionType === 'SIGHT')
    .map((session, index) => ({
      label: `${index + 1}`,
      visualScore: session.visualFocusMetrics?.visualDisciplineScore ?? null,
      following: session.visualFocusMetrics?.followingMovingObjectPct ?? null,
      blackCircle: session.visualFocusMetrics?.blackCircleFixationPct ?? null,
      yAxis: session.visualFocusMetrics?.yAxisDeviationPct ?? null,
      lostFocus: session.visualFocusMetrics?.lostFocusPct ?? null,
      date: formatDateTime(session.recordedAt),
    }))

  return (
    <section className="panel hci109-comparison-panel">
      <div className="hci109-comparison-head">
        <div>
          <span>HCI_109</span>
          <h2>{isEnglish ? 'Recorded Sessions Comparison' : 'Comparativo de sessoes gravadas'}</h2>
          <p>
            {isEnglish
              ? 'Local sessions recorded from Rhythm and Sight drills. They remain pending review.'
              : 'Sessoes locais gravadas em Ritmo e Visada. Permanecem pendentes de revisao.'}
          </p>
        </div>
        <strong>{sessions.length}</strong>
      </div>

      <div className="hci109-comparison-cards">
        <MetricCard label="Ritmo" value={rhythmRows.length} />
        <MetricCard label="Visada" value={sightRows.length} />
        <MetricCard label="Ultimo total" value={lastValue(rhythmRows, 'total') ?? '-'} />
        <MetricCard label="Visual score" value={lastValue(sightRows, 'visualScore') ?? '-'} />
      </div>

      <div className="hci109-chart-grid">
        <div className="hci109-chart-card">
          <h3>{isEnglish ? 'Rhythm Evolution' : 'Evolucao de Ritmo'}</h3>
          {rhythmRows.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={rhythmRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="label" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="total" name="Total" stroke="#f97316" strokeWidth={3} />
                <Line yAxisId="right" type="monotone" dataKey="reactionAvgSec" name="Reaction avg s" stroke="#38bdf8" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="dispersion" name="Dispersion" stroke="#a78bfa" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p>{isEnglish ? 'No Rhythm sessions recorded yet.' : 'Nenhuma sessao de Ritmo gravada ainda.'}</p>
          )}
        </div>

        <div className="hci109-chart-card">
          <h3>{isEnglish ? 'Sight Evolution' : 'Evolucao de Visada'}</h3>
          {sightRows.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={sightRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="label" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="visualScore" name="Visual score" stroke="#22c55e" strokeWidth={3} />
                <Line type="monotone" dataKey="blackCircle" name="Black circle %" stroke="#ef4444" strokeWidth={2} />
                <Line type="monotone" dataKey="yAxis" name="Y axis %" stroke="#facc15" strokeWidth={2} />
                <Line type="monotone" dataKey="lostFocus" name="Lost focus %" stroke="#94a3b8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p>{isEnglish ? 'No Sight sessions recorded yet.' : 'Nenhuma sessao de Visada gravada ainda.'}</p>
          )}
        </div>
      </div>

      <div className="hci109-session-table">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Modo</th>
              <th>Total</th>
              <th>Status</th>
              <th>Visual</th>
            </tr>
          </thead>
          <tbody>
            {[...sessions].slice(0, 8).map((session) => (
              <tr key={session.sessionId}>
                <td>{formatDateTime(session.recordedAt)}</td>
                <td>{session.sessionType}</td>
                <td>{session.seriesTotal}</td>
                <td>{session.workflowStatus}</td>
                <td>{session.visualFocusMetrics?.visualDisciplineScore ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function MetricCard({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function averageReactionSec(shots = []) {
  const values = shots
    .map((shot) => shot.reactionTimeMs)
    .filter((value) => Number.isFinite(Number(value)))

  if (!values.length) return null

  const avg = values.reduce((sum, value) => sum + Number(value), 0) / values.length
  return Math.round((avg / 1000) * 100) / 100
}

function lastValue(rows, key) {
  const clean = rows.map((row) => row[key]).filter((value) => value !== null && value !== undefined)
  return clean.length ? clean[clean.length - 1] : null
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSecondsFromMs(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return '-'
  return `${(numericValue / 1000).toFixed(2)}s`
}

function formatVisualTrackingSource(value) {
  const source = String(value || '').trim().toUpperCase()
  if (source === 'POINTER_OBJECT') return 'POINTER'
  if (source === 'CAMERA_IRIS_EXPERIMENTAL') return 'IRIS EXP.'
  if (source === 'CAMERA_FACE_ONLY') return 'FACE'
  if (source === 'CAMERA_EYE_STATE_ONLY') return 'OLHO'
  if (source === 'NO_VISUAL_TRACKING') return 'SEM LEITURA'
  return source || '-'
}

function averageLandmarkPoints(points) {
  const validPoints = points.filter(Boolean)
  if (!validPoints.length) return null

  return validPoints.reduce(
    (sum, point) => ({
      x: sum.x + point.x / validPoints.length,
      y: sum.y + point.y / validPoints.length,
    }),
    { x: 0, y: 0 }
  )
}

function mapFaceLandmarksToTargetGaze(landmarks, rangeElement) {
  if (!landmarks?.length || !rangeElement) return null

  const irisGaze = mapIrisLandmarksToTargetGaze(landmarks, rangeElement)
  if (irisGaze) return irisGaze

  const leftEye = averageLandmarkPoints([landmarks[33], landmarks[133]])
  const rightEye = averageLandmarkPoints([landmarks[362], landmarks[263]])
  const nose = landmarks[1]
  const faceAnchor = averageLandmarkPoints([leftEye, rightEye, nose])
  if (!faceAnchor) return null

  const rangeBox = rangeElement.getBoundingClientRect()

  return {
    x: (1 - faceAnchor.x) * rangeBox.width,
    y: faceAnchor.y * rangeBox.height,
    timestamp: performance.now(),
    trackingSource: 'FACE_CENTER',
  }
}

function mapIrisLandmarksToTargetGaze(landmarks, rangeElement) {
  const leftIris = averageLandmarkPoints([landmarks[468], landmarks[469], landmarks[470], landmarks[471], landmarks[472]])
  const rightIris = averageLandmarkPoints([landmarks[473], landmarks[474], landmarks[475], landmarks[476], landmarks[477]])
  const leftCenter = estimateEyeGazeRatio({
    iris: leftIris,
    inner: landmarks[133],
    outer: landmarks[33],
    upper: landmarks[159],
    lower: landmarks[145],
  })
  const rightCenter = estimateEyeGazeRatio({
    iris: rightIris,
    inner: landmarks[362],
    outer: landmarks[263],
    upper: landmarks[386],
    lower: landmarks[374],
  })
  const gazeRatio = averageLandmarkPoints([leftCenter, rightCenter])
  if (!gazeRatio) return null

  const rangeBox = rangeElement.getBoundingClientRect()
  const xOffset = clamp((gazeRatio.x - 0.5) * 2.6, -1, 1)
  const yOffset = clamp((gazeRatio.y - 0.5) * 3.2, -1, 1)

  return {
    x: rangeBox.width / 2 + xOffset * rangeBox.width * 0.35,
    y: rangeBox.height / 2 + yOffset * rangeBox.height * 0.35,
    timestamp: performance.now(),
    trackingSource: 'IRIS',
  }
}

function estimateEyeGazeRatio({ iris, inner, outer, upper, lower }) {
  if (!iris || !inner || !outer || !upper || !lower) return null

  const minX = Math.min(inner.x, outer.x)
  const maxX = Math.max(inner.x, outer.x)
  const minY = Math.min(upper.y, lower.y)
  const maxY = Math.max(upper.y, lower.y)
  const width = maxX - minX
  const height = maxY - minY

  if (width <= 0 || height <= 0) return null

  return {
    x: clamp((iris.x - minX) / width, 0, 1),
    y: clamp((iris.y - minY) / height, 0, 1),
  }
}

function getEyeStateFromBlendshapes(faceBlendshapes) {
  const categories = faceBlendshapes?.categories || []
  const scoreByName = Object.fromEntries(
    categories.map((category) => [category.categoryName, Number(category.score) || 0])
  )
  const leftBlink = scoreByName.eyeBlinkLeft || 0
  const rightBlink = scoreByName.eyeBlinkRight || 0
  const blinkScore = Math.max(leftBlink, rightBlink)

  return {
    blinkScore: Math.round(blinkScore * 100) / 100,
    leftBlinkScore: Math.round(leftBlink * 100) / 100,
    rightBlinkScore: Math.round(rightBlink * 100) / 100,
    isClosed: blinkScore >= 0.45,
    source: 'BLENDSHAPE',
  }
}

function getEyeStateFromLandmarks(landmarks) {
  if (!landmarks?.length) return null

  const leftVertical = normalizedDistance(landmarks[159], landmarks[145])
  const leftHorizontal = normalizedDistance(landmarks[33], landmarks[133])
  const rightVertical = normalizedDistance(landmarks[386], landmarks[374])
  const rightHorizontal = normalizedDistance(landmarks[362], landmarks[263])
  const leftOpenRatio = leftHorizontal ? leftVertical / leftHorizontal : 0
  const rightOpenRatio = rightHorizontal ? rightVertical / rightHorizontal : 0
  const openRatio = Math.max(leftOpenRatio, rightOpenRatio)

  return {
    blinkScore: Math.round(Math.max(0, 1 - openRatio / 0.23) * 100) / 100,
    leftOpenRatio: Math.round(leftOpenRatio * 100) / 100,
    rightOpenRatio: Math.round(rightOpenRatio * 100) / 100,
    isClosed: openRatio < 0.14,
    source: 'LANDMARKS',
  }
}

function mergeEyeStates(blendshapeEyeState, landmarkEyeState) {
  if (!blendshapeEyeState && !landmarkEyeState) return null
  if (!blendshapeEyeState) return landmarkEyeState
  if (!landmarkEyeState) return blendshapeEyeState

  return {
    ...landmarkEyeState,
    ...blendshapeEyeState,
    isClosed: blendshapeEyeState.isClosed || landmarkEyeState.isClosed,
    source: 'BLENDSHAPE_LANDMARKS',
  }
}

function normalizedDistance(pointA, pointB) {
  if (!pointA || !pointB) return 0

  const dx = pointA.x - pointB.x
  const dy = pointA.y - pointB.y
  return Math.sqrt(dx * dx + dy * dy)
}

function clamp(value, min, max) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return min
  return Math.max(min, Math.min(max, numericValue))
}

function classifyVisualTrackingSource(frames = [], inputMode = 'POINTER') {
  const trackingSources = frames.map((frame) => frame.trackingSource).filter(Boolean)

  if (
    inputMode === 'POINTER' ||
    trackingSources.includes('FIXED_FRONT_SIGHT_POINTER')
  ) {
    return {
      visualTrackingSource: 'FIXED_FRONT_SIGHT_POINTER',
      visualReliability: 'HIGH_FOR_OBJECT_FOCUS',
    }
  }

  const hasIris = trackingSources.includes('IRIS')
  const hasFaceCenter = trackingSources.includes('FACE_CENTER')
  const hasEyeState = frames.some((frame) => !!frame.eyeState)

  if (hasIris) {
    return {
      visualTrackingSource: 'CAMERA_IRIS_EXPERIMENTAL',
      visualReliability: 'EXPERIMENTAL_EYE_DISPLACEMENT',
    }
  }

  if (hasFaceCenter) {
    return {
      visualTrackingSource: 'CAMERA_FACE_ONLY',
      visualReliability: 'LOW_FOR_EYE_DISPLACEMENT',
    }
  }

  if (hasEyeState) {
    return {
      visualTrackingSource: 'CAMERA_EYE_STATE_ONLY',
      visualReliability: 'VALID_FOR_BLINK_OPEN_CLOSED_ONLY',
    }
  }

  return {
    visualTrackingSource: 'NO_VISUAL_TRACKING',
    visualReliability: 'NO_SAMPLE',
  }
}

function Hci109Trainer({ lang, training, mode = 'RHYTHM', athleteName = '', onSessionSaved }) {
  const isEnglish = lang === 'en'
  const [shots, setShots] = useState([])
  const [visualFocusMetrics, setVisualFocusMetrics] = useState(null)
  const [saveMessage, setSaveMessage] = useState('')

  const [signalState, setSignalState] = useState('RED')
  const goStartTimeRef = useRef(null)
  const cycleStartRef = useRef(performance.now())
  const signalStateRef = useRef('RED')
  const ENTRY_START_Y = -800
  const CENTER_Y = -505
  const CENTER_X = 0

  const YELLOW_AT_MS = 7000
  const GREEN_AT_MS = 12000
  const DESCENT_AT_MS = 14000
  const NON_VISIBLE_SIGHT_TIME_MS = DESCENT_AT_MS - GREEN_AT_MS
  const DESCENT_CYCLE_MS = 13500
  const APPROACH_DURATION_MS = 160
  const motionProfiles = {
    RHYTHM: [
      { xAmp: 18, yAmp: 28, xFreq: 0.92, yFreq: 1, phase: 0 },
      { xAmp: 20, yAmp: 24, xFreq: 1.1, yFreq: 0.85, phase: Math.PI / 2 },
      { xAmp: 16, yAmp: 30, xFreq: 0.78, yFreq: 1.25, phase: Math.PI },
    ],
    SIGHT: [
      { xAmp: 10, yAmp: 34, xFreq: 0.7, yFreq: 1.35, phase: 0 },
      { xAmp: 34, yAmp: 12, xFreq: 1.45, yFreq: 0.68, phase: Math.PI / 4 },
      { xAmp: 26, yAmp: 22, xFreq: 1.05, yFreq: 1.05, phase: Math.PI / 2 },
      { xAmp: 22, yAmp: 22, xFreq: 0.95, yFreq: 0.95, phase: -Math.PI / 4 },
    ],
  }
  const descentProfiles = {
    SIGHT: [
      { startX: -240, startY: -820, midX: -92, midY: -640, turnX: -12, turnY: -505, entryX: 0, entryY: -505 },
      { startX: 240, startY: -820, midX: 92, midY: -640, turnX: 12, turnY: -505, entryX: 0, entryY: -505 },
      { startX: -220, startY: -760, midX: 0, midY: -620, turnX: 118, turnY: -560, entryX: 0, entryY: -505 },
      { startX: 220, startY: -760, midX: 0, midY: -620, turnX: -118, turnY: -560, entryX: 0, entryY: -505 },
    ],
    RHYTHM: [
      { startX: 0, startY: -800, midX: 0, midY: -640, turnX: 0, turnY: -505, entryX: 0, entryY: -505 },
    ],
  }
  const speedProfiles = mode === 'SIGHT' ? [2, 4, 6] : [1.0, 1.4, 1.8]
  const selectedMotionProfile = useRef(null)
  const selectedSpeedProfile = useRef(null)
  const selectedDescentProfile = useRef(null)
  const centerPassCountRef = useRef(0)
  const lastGroupYRef = useRef(ENTRY_START_Y)
  const shotTimeoutHandledRef = useRef(false)
  const rangeRef = useRef(null)
  const blackTargetRef = useRef(null)
  const gazeRef = useRef(null)
  const cameraGazeRef = useRef(null)
  const cameraEyeStateRef = useRef(null)
  const cameraBlinkCountRef = useRef(0)
  const cameraLastEyeClosedRef = useRef(false)
  const shotBlinkStartRef = useRef(0)
  const videoRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const cameraFrameRef = useRef(0)
  const cameraRunIdRef = useRef(0)
  const faceLandmarkerRef = useRef(null)
  const focusFramesRef = useRef([])
  const shotFocusStartIndexRef = useRef(0)
  const lastFocusSampleAtRef = useRef(0)
  const [focusStatus, setFocusStatus] = useState('IDLE')
  const [focusInputMode, setFocusInputMode] = useState('POINTER')
  const [cameraStatus, setCameraStatus] = useState('OFF')
  const [cameraError, setCameraError] = useState('')
  const [cameraReadout, setCameraReadout] = useState('SEM LEITURA')
  const [centerPassCount, setCenterPassCount] = useState(0)

  function randomizeMotionState() {
    const profileList = motionProfiles[mode]
    const descentList = descentProfiles[mode]
    selectedMotionProfile.current =
      profileList[Math.floor(Math.random() * profileList.length)]
    selectedSpeedProfile.current =
      speedProfiles[Math.floor(Math.random() * speedProfiles.length)]
    selectedDescentProfile.current =
      descentList[Math.floor(Math.random() * descentList.length)]
  }

  function captureIntegratedFocusFrame(now, options = {}) {
    if (mode !== 'SIGHT') return
    if (!rangeRef.current || !sightGroupRef.current || !blackTargetRef.current) return
    if (!options.force && now - lastFocusSampleAtRef.current < 120) return

    const rangeBox = rangeRef.current.getBoundingClientRect()
    const sightBox = sightGroupRef.current.getBoundingClientRect()
    const blackBox = blackTargetRef.current.getBoundingClientRect()
    const frontSightBox = frontSightRef.current?.getBoundingClientRect()
    const movingObject = frontSightBox
      ? {
          x: frontSightBox.left - rangeBox.left + frontSightBox.width / 2 - 22,
          y: frontSightBox.top - rangeBox.top - 22,
          width: 44,
          height: 44,
        }
      : {
          x: sightBox.left - rangeBox.left + sightBox.width / 2 - 22,
          y: sightBox.top - rangeBox.top - 22,
          width: 44,
          height: 44,
        }
    const blackCircle = {
      x: blackBox.left - rangeBox.left + blackBox.width / 2,
      y: blackBox.top - rangeBox.top + blackBox.height / 2,
      radius: blackBox.width / 2,
    }
    const corridor = {
      xMin: rangeBox.width / 2 - 70,
      xMax: rangeBox.width / 2 + 70,
      yMin: 0,
      yMax: rangeBox.height,
    }
    const fixedPointerGaze = getFixedFrontSightPointerGaze(now)
    const activeCameraGaze =
      cameraGazeRef.current?.trackingSource === 'IRIS'
        ? cameraGazeRef.current
        : null
    const activeGaze = activeCameraGaze || fixedPointerGaze || gazeRef.current
    const activeEyeState = focusInputMode === 'CAMERA' ? cameraEyeStateRef.current : null
    const status = classifyMovingFocusFrame({
      gaze: activeGaze,
      phase: 'DESCENT',
      movingObject,
      blackCircle,
      yAxisCorridor: corridor,
      tolerance: 24,
    })

    lastFocusSampleAtRef.current = now
    focusFramesRef.current = [
      ...focusFramesRef.current,
      {
        timestamp: now,
        gaze: activeGaze,
        status,
        sourceType: activeCameraGaze ? 'CAMERA' : 'FIXED_POINTER',
        eyeState: activeEyeState,
        trackingSource: activeCameraGaze?.trackingSource || activeGaze?.trackingSource || 'FIXED_FRONT_SIGHT_POINTER',
      },
    ]
    setFocusStatus(status)
    setVisualFocusMetrics({
      ...calculateMovingFocusMetrics(focusFramesRef.current),
      ...classifyVisualTrackingSource(focusFramesRef.current, focusInputMode),
    })
  }

  function getFixedFrontSightPointerGaze(now = performance.now()) {
    if (!rangeRef.current || !frontSightRef.current) return null

    const rangeBox = rangeRef.current.getBoundingClientRect()
    const frontSightBox = frontSightRef.current.getBoundingClientRect()

    return {
      x: frontSightBox.left - rangeBox.left + frontSightBox.width / 2,
      y: frontSightBox.top - rangeBox.top,
      timestamp: now,
      trackingSource: 'FIXED_FRONT_SIGHT_POINTER',
    }
  }
  
  const sightRef = useRef({
    groupX: CENTER_X,
    groupY: ENTRY_START_Y,
    frontX: 0,
    frontY: 0,
    speed: 1,
  })


  const sightGroupRef = useRef(null)
  const frontSightRef = useRef(null)

  const isPistol = true
  const seriesComplete = shots.length === 10
  const triggerReady = signalState === 'GREEN' && goStartTimeRef.current != null
  const decimalTotal = shots.reduce((sum, shot) => sum + shot.decimalScore, 0)
  const pistolTotal = shots.reduce((sum, shot) => sum + shot.pistolScore, 0)
  const seriesTotal = isPistol ? pistolTotal : decimalTotal
  const averageRadius = shots.length
    ? shots.reduce((sum, shot) => sum + shot.radius, 0) / shots.length
    : 0
  const prescription = seriesComplete
    ? buildHciPrescription({ isEnglish, isPistol, total: seriesTotal, averageRadius })
    : null

  useEffect(() => {
    let frameId = 0
    let lastSignalState = signalStateRef.current

    randomizeMotionState()
    centerPassCountRef.current = 0
    setCenterPassCount(0)
    lastGroupYRef.current = ENTRY_START_Y
    shotTimeoutHandledRef.current = false
    focusFramesRef.current = []
    shotFocusStartIndexRef.current = 0
    lastFocusSampleAtRef.current = 0
    setFocusStatus('IDLE')
    setVisualFocusMetrics(null)

    function syncSightTransforms(groupX, groupY, frontX, frontY) {
      sightRef.current = {
        groupX,
        groupY,
        frontX,
        frontY,
        speed: 1,
      }

      if (sightGroupRef.current) {
        sightGroupRef.current.style.transform =
          `translate3d(${groupX}px, ${groupY}px, 0)`
      }

      if (frontSightRef.current) {
        frontSightRef.current.style.transform =
          `translate3d(${frontX}px, ${frontY}px, 0)`
      }

      if (mode === 'SIGHT') {
        const crossedCenter =
          (lastGroupYRef.current < CENTER_Y && groupY >= CENTER_Y) ||
          (lastGroupYRef.current > CENTER_Y && groupY <= CENTER_Y)
        if (crossedCenter) {
          centerPassCountRef.current += 1
          setCenterPassCount(centerPassCountRef.current)
        }
        lastGroupYRef.current = groupY
      }
    }

    
    function animateSight(now) {
      const cycleElapsed = now - cycleStartRef.current
      if (mode === 'SIGHT' && !shotTimeoutHandledRef.current && cycleElapsed >= 30000) {
        shotTimeoutHandledRef.current = true
        captureIntegratedFocusFrame(now, { force: true })
        const timeoutVisualFocusMetrics = buildShotVisualFocusMetrics({
          startAt: cycleStartRef.current,
          endAt: now,
        })
        setShots((current) =>
          current.length >= 10
            ? current
            : [
                ...current,
                {
                  ...generateHciPistolShot(current.length + 1, sightRef.current),
                  decimalScore: 0,
                  pistolScore: 0,
                  reactionTimeMs: null,
                  visualFocusMetrics: timeoutVisualFocusMetrics,
                  visualFocusSourceType: focusInputMode,
                  visualTrackingSource: timeoutVisualFocusMetrics?.visualTrackingSource || null,
                  visualReliability: timeoutVisualFocusMetrics?.visualReliability || null,
                },
              ]
        )
        cycleStartRef.current = now
        goStartTimeRef.current = null
        signalStateRef.current = 'RED'
        setSignalState('RED')
        randomizeMotionState()
        centerPassCountRef.current = 0
        setCenterPassCount(0)
        lastGroupYRef.current = ENTRY_START_Y
        frameId = window.requestAnimationFrame(animateSight)
        return
      }
      const nextSignalState =
        cycleElapsed >= GREEN_AT_MS
          ? 'GREEN'
          : cycleElapsed >= YELLOW_AT_MS
            ? 'YELLOW'
            : 'RED'

      if (nextSignalState !== lastSignalState) {
        lastSignalState = nextSignalState
        signalStateRef.current = nextSignalState
        setSignalState(nextSignalState)
      }

      if (nextSignalState === 'GREEN' && goStartTimeRef.current == null) {
        goStartTimeRef.current = cycleStartRef.current + GREEN_AT_MS
      }

      if (cycleElapsed < DESCENT_AT_MS) {
        const descent = selectedDescentProfile.current
        const descentElapsed = cycleElapsed / DESCENT_AT_MS
        let groupX
        let groupY

        if (descentElapsed < 0.5) {
          const t = descentElapsed / 0.5
          groupX = descent.startX + (descent.midX - descent.startX) * t
          groupY = descent.startY + (descent.midY - descent.startY) * t
        } else {
          const t = (descentElapsed - 0.5) / 0.5
          groupX = descent.midX + (descent.turnX - descent.midX) * t
          groupY = descent.midY + (descent.turnY - descent.midY) * t
        }
        syncSightTransforms(groupX, groupY, 0, 0)
        captureIntegratedFocusFrame(now)
        frameId = window.requestAnimationFrame(animateSight)
        return
      }

      const approachElapsed = cycleElapsed - DESCENT_AT_MS

      const easeInOut = (t) =>
        t < 0.5
          ? 2 * t * t
          : 1 - Math.pow(-2 * t + 2, 2) / 2

      if (approachElapsed < APPROACH_DURATION_MS) {
        const t = Math.min(1, approachElapsed / APPROACH_DURATION_MS)
        const eased = easeInOut(t)

        const groupY =
          selectedDescentProfile.current.turnY +
          (selectedDescentProfile.current.entryY - selectedDescentProfile.current.turnY) * eased
        const groupX =
          selectedDescentProfile.current.turnX +
          (selectedDescentProfile.current.entryX - selectedDescentProfile.current.turnX) * eased

        syncSightTransforms(groupX, groupY, 0, 0)
        captureIntegratedFocusFrame(now)
        frameId = window.requestAnimationFrame(animateSight)
        return
      }

      const runElapsed = approachElapsed - APPROACH_DURATION_MS
      const angle =
        (runElapsed / (DESCENT_CYCLE_MS / selectedSpeedProfile.current)) * Math.PI * 2
      const profile = selectedMotionProfile.current

      const groupX =
        CENTER_X +
        Math.sin(angle * profile.xFreq + profile.phase) * profile.xAmp +
        Math.sin(runElapsed * 0.0037) * 1.8 +
        Math.sin(runElapsed * 0.0019) * 1.2 +
        Math.sin(runElapsed * 0.0061) * 0.6

      const groupY =
        CENTER_Y +
        Math.sin(angle * profile.yFreq) * profile.yAmp +
        Math.sin(angle * 1.7) * 1.8

      const frontX = Math.sin(runElapsed * 0.004) * 0.5
      const frontY = Math.sin(runElapsed * 0.003) * 0.25

      syncSightTransforms(groupX, groupY, frontX, frontY)
      captureIntegratedFocusFrame(now)
      frameId = window.requestAnimationFrame(animateSight)
    }

    frameId = window.requestAnimationFrame(animateSight)

    return () => window.cancelAnimationFrame(frameId)
  }, [mode])

  useEffect(() => {
    return () => {
      stopCameraTracking()
    }
  }, [])

  async function startCameraTracking() {
    setCameraError('')
    const runId = cameraRunIdRef.current + 1
    cameraRunIdRef.current = runId

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('UNAVAILABLE')
      setCameraError('Camera indisponivel neste navegador.')
      return
    }

    try {
      setCameraStatus('LOADING')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      })

      cameraStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      if (cameraRunIdRef.current !== runId) return

      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL)
      faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MEDIAPIPE_FACE_MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
      })
      if (cameraRunIdRef.current !== runId) {
        if (faceLandmarkerRef.current?.close) {
          faceLandmarkerRef.current.close()
        }
        faceLandmarkerRef.current = null
        return
      }

      setFocusInputMode('CAMERA')
      setCameraStatus('ON')
      runCameraDetectionLoop()
    } catch (error) {
      setCameraStatus('ERROR')
      setCameraError(
        `${error?.message || 'Nao foi possivel iniciar o MediaPipe.'} Analise voltou para ponteiro.`
      )
      setFocusInputMode('POINTER')
      cameraGazeRef.current = null
      cameraEyeStateRef.current = null
      cameraBlinkCountRef.current = 0
      cameraLastEyeClosedRef.current = false
      stopCameraTracks()
    }
  }

  function stopCameraTracks() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  function stopCameraTracking() {
    cameraRunIdRef.current += 1
    window.cancelAnimationFrame(cameraFrameRef.current)
    cameraFrameRef.current = 0
    cameraGazeRef.current = null
    cameraEyeStateRef.current = null
    cameraBlinkCountRef.current = 0
    cameraLastEyeClosedRef.current = false

    if (faceLandmarkerRef.current?.close) {
      faceLandmarkerRef.current.close()
    }
    faceLandmarkerRef.current = null

    stopCameraTracks()

    setCameraStatus('OFF')
    setFocusInputMode('POINTER')
  }

  function runCameraDetectionLoop() {
    let detecting = false

    function detectFrame(now) {
      const video = videoRef.current
      const faceLandmarker = faceLandmarkerRef.current

      if (!video || !cameraStreamRef.current || !faceLandmarker) {
        return
      }

      if (!detecting && video.readyState >= 2) {
        detecting = true

        try {
          const result = faceLandmarker.detectForVideo(video, now)
          const landmarks = result?.faceLandmarks?.[0]
          const eyeState = mergeEyeStates(
            getEyeStateFromBlendshapes(result?.faceBlendshapes?.[0]),
            getEyeStateFromLandmarks(landmarks)
          )
          cameraEyeStateRef.current = eyeState
          updateCameraBlinkCounter(eyeState)

          if (landmarks && rangeRef.current) {
            const mappedGaze = mapFaceLandmarksToTargetGaze(landmarks, rangeRef.current)
            cameraGazeRef.current = mappedGaze
              ? {
                  ...mappedGaze,
                }
              : null
            setCameraReadout(
              eyeState
                ? `FACE OK - ${eyeState.isClosed ? 'OLHO FECHADO' : 'OLHO ABERTO'} - ${mappedGaze?.trackingSource || 'SEM IRIS'}`
                : 'FACE OK - OLHO SEM LEITURA'
            )
          } else {
            cameraGazeRef.current = null
            cameraEyeStateRef.current = null
            cameraLastEyeClosedRef.current = false
            setCameraReadout('SEM FACE')
          }
        } catch (error) {
          setCameraStatus('ERROR')
          setCameraError(
            `${error?.message || 'Erro na leitura da camera.'} Analise voltou para ponteiro.`
          )
          setFocusInputMode('POINTER')
          cameraGazeRef.current = null
          cameraEyeStateRef.current = null
          cameraLastEyeClosedRef.current = false
          window.cancelAnimationFrame(cameraFrameRef.current)
          cameraFrameRef.current = 0
          if (faceLandmarkerRef.current?.close) {
            faceLandmarkerRef.current.close()
          }
          faceLandmarkerRef.current = null
          detecting = false
          return
        } finally {
          detecting = false
        }
      }

      cameraFrameRef.current = window.requestAnimationFrame(detectFrame)
    }

    cameraFrameRef.current = window.requestAnimationFrame(detectFrame)
  }


  function startSession() {
    setShots([])
    setVisualFocusMetrics(null)
    setSaveMessage('')
    setCameraReadout(cameraStatus === 'ON' ? 'AGUARDANDO FACE' : 'SEM LEITURA')
    focusFramesRef.current = []
    shotFocusStartIndexRef.current = 0
    gazeRef.current = null
    cameraGazeRef.current = null
    cameraEyeStateRef.current = null
    cameraBlinkCountRef.current = 0
    cameraLastEyeClosedRef.current = false
    shotBlinkStartRef.current = 0
    lastFocusSampleAtRef.current = 0
    setFocusStatus('IDLE')
    if (signalStateRef.current === 'GREEN' && goStartTimeRef.current != null) {
      cycleStartRef.current = performance.now() - GREEN_AT_MS
    }
  }

  async function handleSaveHci109Session() {
    const now = Date.now()
    const sessionId = `HCI109_${mode}_${String(athleteName || 'ATHLETE').replace(/\W+/g, '_')}_${now}`

    const session = {
      sessionId,
      athleteName: athleteName || 'ATLETA_HCI',
      trainingId: training.trainingId,
      drillCode: mode === 'SIGHT' ? 'HCI_109_SIGHT' : 'HCI_109_RHYTHM',
      sessionType: mode,
      sourceType: 'HCI_109_LIBRARY_TRAINER',
      workflowStatus: 'PENDING_REVIEW',
      reviewFlag: 'ADMIN_REVIEW_REQUIRED',
      totalShots: shots.length,
      decimalTotal: Number(decimalTotal.toFixed(1)),
      pistolTotal,
      seriesTotal: isPistol ? pistolTotal : Number(decimalTotal.toFixed(1)),
      averageRadius: Number(averageRadius.toFixed(3)),
      visualFocusMetrics: mode === 'SIGHT' ? visualFocusMetrics : null,
      visualFocusSourceType: mode === 'SIGHT' ? focusInputMode : null,
      visualTrackingSource: mode === 'SIGHT' ? visualFocusMetrics?.visualTrackingSource || null : null,
      visualReliability: mode === 'SIGHT' ? visualFocusMetrics?.visualReliability || null : null,
      shots: shots.map((shot) => ({
        shotIndex: shot.index,
        x: shot.x,
        y: shot.y,
        radius: shot.radius,
        decimalScore: shot.decimalScore,
        pistolScore: shot.pistolScore,
        reactionTimeMs: shot.reactionTimeMs,
        visualFocusMetrics: shot.visualFocusMetrics || null,
        visualFocusSourceType: shot.visualFocusSourceType || null,
        visualTrackingSource: shot.visualTrackingSource || shot.visualFocusMetrics?.visualTrackingSource || null,
        visualReliability: shot.visualReliability || shot.visualFocusMetrics?.visualReliability || null,
      })),
      recordedAt: now,
      updatedAt: now,
      createdAt: now,
      createdBy: 'ATHLETE_PORTAL',
    }

    await saveHci109Session(session)
    await onSessionSaved?.()
    setSaveMessage(isEnglish ? 'HCI session saved for review.' : 'Sessao HCI gravada para revisao.')
  }

  function addShot() {
    const sightSnapshot = { ...sightRef.current }
    const goStartTime = goStartTimeRef.current

    if (signalStateRef.current !== 'GREEN' || goStartTime == null) {
      return
    }

    const shotAt = performance.now()
    captureIntegratedFocusFrame(shotAt, { force: true })
    const shotVisualFocusMetrics = buildShotVisualFocusMetrics({
      startAt: cycleStartRef.current,
      endAt: shotAt,
    })

    setShots((current) =>
      current.length >= 10
        ? current
        : [
            ...current,
            {
              ...generateHciPistolShot(current.length + 1, sightSnapshot),
              reactionTimeMs: goStartTime != null
                ? Math.max(
                    0,
                    Math.round(
                      performance.now() -
                        goStartTime -
                        NON_VISIBLE_SIGHT_TIME_MS
                    )
                  )
                : null,
              visualFocusMetrics: shotVisualFocusMetrics,
              visualFocusSourceType: mode === 'SIGHT' ? focusInputMode : null,
              visualTrackingSource: shotVisualFocusMetrics?.visualTrackingSource || null,
              visualReliability: shotVisualFocusMetrics?.visualReliability || null,
            },
          ]
    )

    cycleStartRef.current = performance.now()
    goStartTimeRef.current = null
    signalStateRef.current = 'RED'
    setSignalState('RED')
    centerPassCountRef.current = 0
    setCenterPassCount(0)
    lastGroupYRef.current = ENTRY_START_Y
    shotTimeoutHandledRef.current = false
    if (mode === 'SIGHT') {
      randomizeMotionState()
    }
  }

  function buildShotVisualFocusMetrics({ startAt = null, endAt = performance.now() } = {}) {
    if (mode !== 'SIGHT') return null
    const blinkDelta = Math.max(0, cameraBlinkCountRef.current - shotBlinkStartRef.current)
    shotBlinkStartRef.current = cameraBlinkCountRef.current

    const timeWindowFrames = focusFramesRef.current.filter((frame) => {
      const timestamp = Number(frame.timestamp)
      if (!Number.isFinite(timestamp)) return false
      if (Number.isFinite(Number(startAt)) && timestamp < Number(startAt)) return false
      return timestamp <= Number(endAt)
    })
    const indexWindowFrames = focusFramesRef.current.slice(shotFocusStartIndexRef.current)
    const recentFallbackFrames = focusFramesRef.current.filter((frame) => {
      const timestamp = Number(frame.timestamp)
      return Number.isFinite(timestamp) && timestamp >= Number(endAt) - 3500 && timestamp <= Number(endAt)
    })
    const shotFrames = timeWindowFrames.length
      ? timeWindowFrames
      : indexWindowFrames.length
        ? indexWindowFrames
        : recentFallbackFrames

    shotFocusStartIndexRef.current = focusFramesRef.current.length

    if (!shotFrames.length) {
      const fallbackEyeTiming = deriveEyeTimingFromBlinkCount({
        blinkCount: blinkDelta,
        startAt,
        endAt,
        measuredMs: 0,
      })
      return {
        totalFrames: 0,
        validGazeFrames: 0,
        followingMovingObjectMs: 0,
        blinkCount: blinkDelta,
        eyeOpenMs: fallbackEyeTiming.eyeOpenMs,
        eyeClosedMs: fallbackEyeTiming.eyeClosedMs,
        eyeOpenPct: fallbackEyeTiming.eyeOpenPct,
        measuredMs: fallbackEyeTiming.measuredMs,
        followingMovingObjectPct: 0,
        blackCircleFixationPct: 0,
        yAxisDeviationPct: 0,
        lostFocusPct: 0,
        visualDisciplineScore: 0,
        interpretation: 'NO_VISUAL_SAMPLE_FOR_SHOT',
        visualTrackingSource: 'NO_VISUAL_TRACKING',
        visualReliability: 'NO_SAMPLE',
      }
    }

    const calculatedMetrics = calculateMovingFocusMetrics(shotFrames, { endAt })
    const blinkCount = blinkDelta || calculatedMetrics.blinkCount
    const eyeTiming = deriveEyeTimingFromBlinkCount({
      blinkCount,
      startAt,
      endAt,
      measuredMs: calculatedMetrics.measuredMs,
    })

    return {
      ...calculatedMetrics,
      ...classifyVisualTrackingSource(shotFrames, focusInputMode),
      blinkCount,
      eyeOpenMs: eyeTiming.eyeOpenMs,
      eyeClosedMs: eyeTiming.eyeClosedMs,
      eyeOpenPct: eyeTiming.eyeOpenPct,
      measuredMs: eyeTiming.measuredMs,
    }
  }

  function deriveEyeTimingFromBlinkCount({ blinkCount = 0, startAt = null, endAt = null, measuredMs = 0 }) {
    const measuredValue = Number(measuredMs)
    const windowMs = Number.isFinite(Number(startAt)) && Number.isFinite(Number(endAt))
      ? Math.max(0, Number(endAt) - Number(startAt))
      : 0
    const totalMs = measuredValue > 0 ? measuredValue : windowMs
    const eyeClosedMs = Math.min(totalMs, Math.max(0, blinkCount) * ESTIMATED_BLINK_DURATION_MS)
    const eyeOpenMs = Math.max(0, totalMs - eyeClosedMs)

    return {
      measuredMs: Math.round(totalMs),
      eyeClosedMs: Math.round(eyeClosedMs),
      eyeOpenMs: Math.round(eyeOpenMs),
      eyeOpenPct: totalMs ? Math.round((eyeOpenMs / totalMs) * 100) : 0,
    }
  }

  function updateCameraBlinkCounter(eyeState) {
    if (!eyeState) return

    const isClosed = !!eyeState.isClosed
    if (isClosed && !cameraLastEyeClosedRef.current) {
      cameraBlinkCountRef.current += 1
    }
    cameraLastEyeClosedRef.current = isClosed
  }

  function handleReady() {
    const now = performance.now()
    cycleStartRef.current = now - YELLOW_AT_MS
    goStartTimeRef.current = null
    signalStateRef.current = 'YELLOW'
    setSignalState('YELLOW')
  }

  function handleGo() {
    const now = performance.now()
    cycleStartRef.current = now - GREEN_AT_MS
    goStartTimeRef.current = now
    signalStateRef.current = 'GREEN'
    setSignalState('GREEN')
  }





  return (
    <section className="panel hci-trainer-panel">
      <h2>
        {mode === 'SIGHT'
          ? (isEnglish ? 'hci 10.9 Sight Training' : 'Treino de Visada hci 10.9')
          : (isEnglish ? 'hci 10.9 Interactive Training' : 'Treino Interativo hci 10.9')}
      </h2>

      <div className="hci-trainer">
        <div className="hci-stage">
          <div className="hci-stage-header">
            <span>{training.trainingId}</span>
            <strong>
              {isEnglish ? 'Series' : 'Serie'} {shots.length} / 10
            </strong>
          </div>

<div className="hci-discipline-row" role="group" aria-label="Controle do disparo">
  <div className={`hci-signal-line ${signalState === 'RED' ? 'is-active' : ''}`}>
    <button type="button" onClick={handleReady} className="hci-signal-button">
      R
    </button>
    <div className="hci-starting-lights hci-starting-lights-red" aria-label="Vermelho">
      <i /><i /><i />
    </div>
  </div>

  <div className={`hci-signal-line ${signalState === 'YELLOW' ? 'is-active' : ''}`}>
    <button type="button" className="hci-signal-button hci-signal-button-static" disabled>
      S
    </button>
    <div className="hci-starting-lights hci-starting-lights-yellow" aria-label="Amarelo">
      <i /><i /><i />
    </div>
  </div>

  <div className={`hci-signal-line ${signalState === 'GREEN' ? 'is-active' : ''}`}>
    <button type="button" onClick={handleGo} className="hci-signal-button">
      G
    </button>
    <div className="hci-starting-lights hci-starting-lights-green" aria-label="Verde">
      <i /><i /><i />
    </div>
  </div>
</div>

<div className={`hci-signal-status ${signalState.toLowerCase()}`} aria-live="polite">
  <div className="hci-signal-status-lights" aria-hidden="true">
    <i className={signalState === 'RED' ? 'active' : ''} />
    <i className={signalState === 'YELLOW' ? 'active' : ''} />
    <i className={signalState === 'GREEN' ? 'active' : ''} />
  </div>
  <strong>
    {signalState === 'RED' && 'WAIT'}
    {signalState === 'YELLOW' && 'READY'}
    {signalState === 'GREEN' && 'GO'}
  </strong>
</div>

<button
  type="button"
  className="hci-trigger-button"
  onClick={addShot}
  disabled={!triggerReady || seriesComplete}
  aria-label="Gatilho de disparo"
>
  <span>GATILHO</span>
</button>
{mode === 'SIGHT' && (
  <div className="hci-trigger-helper">
    Passagens no ponto -505: {Math.min(centerPassCount, 3)}/3
  </div>
)}

          <div
            className="hci-pistol-range"
            ref={rangeRef}
            aria-label="Alvo hci 10.9 Pistola"
            role="img"
            onPointerMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect()
              gazeRef.current = {
                x: event.clientX - bounds.left,
                y: event.clientY - bounds.top,
                timestamp: performance.now(),
              }
            }}
            onPointerLeave={() => {
              gazeRef.current = null
            }}
          >
            <div className="hci-black-target" ref={blackTargetRef}>
              <div className="hci-score-rings" />
              {shots.map((shot) => (
                <div
                  key={shot.index}
                  className="hci-shot-dot"
                 
                    style={{
                   left: `calc(50% + ${shot.x + 12}px)`,
                  top: `calc(50% + ${shot.y + 12}px)`, 
}}


                  title={`${shot.index}: ${shot.decimalScore.toFixed(1)}`}
                >
                  {shot.index}
                </div>
              ))}
            </div>

            <div
              className="hci-sight-picture"
              ref={sightGroupRef}
              aria-hidden="true"
            >           
	<div className="hci-rear-sight hci-rear-left" />
              <div
                className="hci-front-sight"
                ref={frontSightRef}
              >
                <span className="hci-fixed-pointer-marker" aria-hidden="true" />
              </div>
              <div className="hci-rear-sight hci-rear-right" />
            </div>

            <div className="hci-click-label">
              {seriesComplete ? 'SERIE COMPLETA' : 'DISPARE PELO GATILHO'}
            </div>
          </div>

          {mode === 'SIGHT' && (
            <div className="hci-focus-inline-status">
              <span>Focus Drill integrado</span>
              <strong>{focusStatus}</strong>
              <small>
                {visualFocusMetrics
                  ? `Score visual ${visualFocusMetrics.visualDisciplineScore} · fonte ${focusInputMode}`
                  : `Acompanhe a maca com ${focusInputMode === 'CAMERA' ? 'a camera' : 'o ponteiro'} apos a calibracao.`}
              </small>
            </div>
          )}

          {mode === 'SIGHT' && (
            <div className="hci-camera-focus-panel">
              <div>
                <span>Camera Focus</span>
                <strong>{cameraStatus}</strong>
                <small>{cameraReadout}</small>
                {cameraError && <small>{cameraError}</small>}
              </div>
              <video ref={videoRef} muted playsInline aria-label="Camera focus preview" />
              <div className="hci-camera-actions">
                <button
                  type="button"
                  onClick={startCameraTracking}
                  disabled={cameraStatus === 'ON' || cameraStatus === 'LOADING'}
                >
                  {cameraStatus === 'LOADING'
                    ? 'Carregando'
                    : cameraStatus === 'ERROR'
                      ? 'Tentar novamente'
                      : 'Ligar camera'}
                </button>
                <button
                  type="button"
                  onClick={stopCameraTracking}
                  disabled={cameraStatus !== 'ON' && cameraStatus !== 'LOADING'}
                >
                  Desligar
                </button>
              </div>
            </div>
          )}

          <p className="hci-rule-note">
            Pistola: escolha a hora do disparo pela alca e maca em movimento. A serie soma numeros inteiros: 10.9 vale 10, 10.8 vale 9, 10.7 vale 8.
          </p>

          <div className="admin-actions hci-session-actions">
            <button type="button" onClick={startSession}>
              {isEnglish ? 'New 10-shot Series' : 'Nova Serie de 10'}
            </button>
            <button type="button" onClick={handleSaveHci109Session} disabled={!seriesComplete}>
              {mode === 'SIGHT'
                ? (isEnglish ? 'Record HCI Sight Session' : 'Gravar sessao HCI - Visada')
                : (isEnglish ? 'Record HCI Rhythm Session' : 'Gravar sessao HCI - Ritmo')}
            </button>
          </div>
          {saveMessage && <p className="hci-save-message">{saveMessage}</p>}
        </div>

        <div className="hci-metrics">
          <div>
            <span>{isEnglish ? 'Shots' : 'Disparos'}</span>
            <strong>{shots.length}/10</strong>
          </div>
          <div>
            <span>{isEnglish ? 'Series total' : 'Total da serie'}</span>
            <strong>{isPistol ? seriesTotal : seriesTotal.toFixed(1)}</strong>
          </div>
          {mode === 'SIGHT' && (
            <div>
              <span>{isEnglish ? 'Eye on object' : 'Olho no objeto'}</span>
              <strong>{formatSecondsFromMs(visualFocusMetrics?.followingMovingObjectMs)}</strong>
            </div>
          )}
          {mode === 'SIGHT' && (
            <div>
              <span>{isEnglish ? 'Eye open' : 'Olho aberto'}</span>
              <strong>{formatSecondsFromMs(visualFocusMetrics?.eyeOpenMs)}</strong>
            </div>
          )}
          {mode === 'SIGHT' && (
            <div>
              <span>{isEnglish ? 'Blinks' : 'Piscadas'}</span>
              <strong>{visualFocusMetrics?.blinkCount ?? '-'}</strong>
            </div>
          )}
          <div>
            <span>{isEnglish ? 'Decimal raw' : 'Decimal bruto'}</span>
            <strong>{decimalTotal.toFixed(1)}</strong>
          </div>
          <div>
            <span>{isEnglish ? 'Status' : 'Status'}</span>
            <strong>{seriesComplete ? 'OK' : '10'}</strong>
          </div>
        </div>
      </div>

      <div className="hci-shot-table">
        <table>
          <thead>
            <tr>
              <th>#</th>
                {mode === 'SIGHT' && <th>{isEnglish ? 'Visual score' : 'Nota visual'}</th>}
                {mode === 'SIGHT' && <th>{isEnglish ? 'Eye on object' : 'Olho no objeto'}</th>}
                {mode === 'SIGHT' && <th>{isEnglish ? 'Eye open' : 'Olho aberto'}</th>}
                {mode === 'SIGHT' && <th>{isEnglish ? 'Blinks' : 'Piscadas'}</th>}
                {mode === 'SIGHT' && <th>{isEnglish ? 'Source' : 'Fonte'}</th>}
                <th>{isEnglish ? 'Reaction' : 'Reação'}</th>
                <th>{isEnglish ? 'Decimal shot' : 'Disparo decimal'}</th>
                <th>{isEnglish ? 'Pistol score' : 'Ponto pistola'}</th>
            </tr>
          </thead>
          <tbody>
            {shots.map((shot) => (
              <tr key={shot.index}>
                <td>{shot.index}</td>
                {mode === 'SIGHT' && (
                  <td>{shot.visualFocusMetrics?.visualDisciplineScore ?? '-'}</td>
                )}
                {mode === 'SIGHT' && (
                  <td>{formatSecondsFromMs(shot.visualFocusMetrics?.followingMovingObjectMs)}</td>
                )}
                {mode === 'SIGHT' && (
                  <td>
                    {shot.visualFocusSourceType === 'CAMERA'
                      ? formatSecondsFromMs(shot.visualFocusMetrics?.eyeOpenMs)
                      : '-'}
                  </td>
                )}
                {mode === 'SIGHT' && (
                  <td>{shot.visualFocusMetrics?.blinkCount ?? '-'}</td>
                )}
                {mode === 'SIGHT' && (
                  <td>
                    {formatVisualTrackingSource(
                      shot.visualTrackingSource || shot.visualFocusMetrics?.visualTrackingSource
                    )}
                  </td>
                )}
                <td>
                  {shot.reactionTimeMs != null
                    ? `${(shot.reactionTimeMs / 1000).toFixed(2)}s`
                    : '-'}
                </td>
                <td>{shot.decimalScore.toFixed(1)}</td>
                <td>{shot.pistolScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="hci-prescription">
        <h3>{isEnglish ? 'Prescription after 10 shots' : 'Prescricao apos 10 disparos'}</h3>
        {prescription ? (
          <p>{prescription}</p>
        ) : (
          <p>
            {isEnglish
              ? 'Complete the 10-shot series to generate the prescription.'
              : 'Complete a serie de 10 disparos para gerar a prescricao.'}
          </p>
        )}
      </div>

    </section>
  )
}



function generateHciPistolShot(index, sight) {
  const CENTER_X = 0
  const CENTER_Y = -505

  // Cálculo técnico do erro da mira
  const GROUP_GAIN = 0.45
  const FRONT_GAIN = 8

  const aimX =
    (sight.groupX - CENTER_X) * GROUP_GAIN +
    sight.frontX * FRONT_GAIN

  const aimY =
    (sight.groupY - CENTER_Y) * GROUP_GAIN +
    sight.frontY * FRONT_GAIN

  // Amplificação visual: o ponto aparece mais aberto no alvo
  const VISUAL_GAIN = 3.6

  const visualX = aimX * VISUAL_GAIN
  const visualY = aimY * VISUAL_GAIN

  const x = Math.max(-47, Math.min(47, visualX))
  const y = Math.max(-47, Math.min(47, visualY))

  // Pontuação usa o erro técnico, não o visual amplificado
  const technicalDistance = Math.hypot(aimX, aimY)

  const decimalScore = Math.max(
    0,
    Math.round((10.9 - technicalDistance * 0.32) * 10) / 10
  )

  const pistolScore = convertDecimalToPistolScore(decimalScore)

  return {
    index,
    x,
    y,
    radius: Math.min(1, technicalDistance / 25),
    decimalScore,
    pistolScore,
  }
}

function convertDecimalToPistolScore(decimalScore) {
  if (decimalScore >= 10) {
    return Math.max(0, Math.min(10, Math.round((decimalScore - 10) * 10) + 1))
  }

  return Math.max(0, Math.floor(decimalScore))
}

function buildHciPrescription ({ isEnglish, isPistol, total, averageRadius }) {
  const strong = isPistol ? total >= 92 : total >= 102
  const stable = isPistol ? total >= 84 : total >= 96
  const dispersionNote =
    averageRadius > 0.58
      ? isEnglish
        ? ' Dispersion is high: prioritize sight return and trigger continuity.'
        : ' Dispersao alta: priorizar retorno da mira e continuidade do gatilho.'
      : ''

  if (strong) {
    return (
      (isEnglish
        ? 'Series accepted for pressure progression. Keep the same process and add one controlled pressure block.'
        : 'Serie aceita para progressao de pressao. Manter o mesmo processo e adicionar um bloco controlado de pressao.') +
      dispersionNote
    )
  }

  if (stable) {
    return (
      (isEnglish
        ? 'Series stable but not ready for pressure increase. Repeat one 10-shot series with the same rhythm.'
        : 'Serie estavel, mas ainda sem aumento de pressao. Repetir uma serie de 10 com o mesmo ritmo.') +
      dispersionNote
    )
  }

  return (
    (isEnglish
      ? 'Do not prescribe pressure progression. Return to technical control, sight picture and release quality.'
      : 'Nao prescrever progressao de pressao. Voltar para controle tecnico, imagem de mira e qualidade do disparo.') +
    dispersionNote
  )
}
