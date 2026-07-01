import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getHappyExerciseById,
  getHappyPrescriptionRuleByParameter,
  getLibraryCollections,
  getTrainingById,
  getTrainingLibraryEntries,
  getTrainingLibraryStats,
} from '../services/trainingLibraryService'

function LibraryPage({ lang = 'pt' }) {
  const uiLang = lang === 'en' ? 'en-US' : 'pt-BR'
  const trainingStats = getTrainingLibraryStats()
  const trainings = getTrainingLibraryEntries()
  const collections = getLibraryCollections()

  const [collectionId, setCollectionId] = useState('TECHNICAL_LIBRARY')
  const [targetType, setTargetType] = useState('ALL')
  const [pendingAdditions] = useState([])
  const [openInteractiveId, setOpenInteractiveId] = useState('')
  const [openInteractiveMode, setOpenInteractiveMode] = useState('RHYTHM')
  const [selectedItemId, setSelectedItemId] = useState(
    trainingStats.firstTraining || ''
  )

  const activeCollection =
    collections.find((item) => item.id === collectionId) || collections[0]

  const visibleItems = useMemo(() => {
    if (collectionId !== 'TECHNICAL_LIBRARY') {
      return activeCollection?.entries || []
    }

    return trainings.filter((training) => {
      return targetType === 'ALL' || training.targetType === targetType
    })
  }, [activeCollection, collectionId, targetType, trainings])

  const selectedItem = useMemo(() => {
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
  }, [collectionId, selectedItemId, visibleItems])

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
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <small>HCI CANONICAL</small>
          <h1>Library</h1>
        </div>
      </header>

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

      {collectionId === 'TECHNICAL_LIBRARY' && (
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
        <h2>{activeCollection?.title}</h2>

        <div className="selector-row">
          <select
            value={resolveItemId(selectedItem || {})}
            onChange={(event) => setSelectedItemId(event.target.value)}
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
        <Hci109Trainer lang={lang} training={selectedItem} mode={openInteractiveMode} />
      )}

      {selectedItem && collectionId === 'HAPPY_LIBRARY' && (
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

      {selectedItem && collectionId === 'HAPPY_PRESCRIPTION' && (
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

      <section className="panel">
        <h2>HCI HAPPY Integration</h2>
        <p style={{ padding: 16 }}>
          The library now exposes the technical canonical, the HAPPY/COMANDO exercise canonical and the HAPPY prescription matrix. The next implementation step is to bind these canonicals to the new ATHLETE and CROSS ANALYSIS render blocks.
        </p>
      </section>
    </main>
  )
}

export default LibraryPage

function Hci109Trainer({ lang, training, mode = 'RHYTHM' }) {
  const isEnglish = lang === 'en'
  const [shots, setShots] = useState([])

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
  const APPROACH_DURATION_MS = 6600
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
    lastGroupYRef.current = ENTRY_START_Y
    shotTimeoutHandledRef.current = false

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
        }
        lastGroupYRef.current = groupY
      }
    }

    
    function animateSight(now) {
      const cycleElapsed = now - cycleStartRef.current
      if (mode === 'SIGHT' && !shotTimeoutHandledRef.current && cycleElapsed >= 30000) {
        shotTimeoutHandledRef.current = true
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
                },
              ]
        )
        cycleStartRef.current = now
        goStartTimeRef.current = null
        signalStateRef.current = 'RED'
        setSignalState('RED')
        randomizeMotionState()
        centerPassCountRef.current = 0
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
      frameId = window.requestAnimationFrame(animateSight)
    }

    frameId = window.requestAnimationFrame(animateSight)

    return () => window.cancelAnimationFrame(frameId)
  }, [mode])


  function startSession() {
    setShots([])
    if (signalStateRef.current === 'GREEN' && goStartTimeRef.current != null) {
      cycleStartRef.current = performance.now() - GREEN_AT_MS
    }
  }

  function addShot() {
    const sightSnapshot = { ...sightRef.current }
    const goStartTime = goStartTimeRef.current

    if (signalStateRef.current !== 'GREEN' || goStartTime == null) {
      return
    }

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
            },
          ]
    )

    cycleStartRef.current = performance.now()
    goStartTimeRef.current = null
    signalStateRef.current = 'RED'
    setSignalState('RED')
    centerPassCountRef.current = 0
    lastGroupYRef.current = ENTRY_START_Y
    shotTimeoutHandledRef.current = false
    if (mode === 'SIGHT') {
      randomizeMotionState()
    }
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
  <button
    type="button"
    onClick={handleReady}
    className={`hci-signal-button ${signalState === 'RED' ? 'is-red' : signalState === 'YELLOW' ? 'is-yellow' : 'is-green'}`}
  >
    READY
  </button>

  <button
    type="button"
    onClick={handleGo}
    className={`hci-signal-button ${signalState === 'RED' ? 'is-red' : signalState === 'YELLOW' ? 'is-yellow' : 'is-green'}`}
  >
    GO
  </button>
</div>

<div className={`hci-signal-light ${signalState.toLowerCase()}`}>
  {signalState === 'RED' && 'RED - WAIT'}
  {signalState === 'YELLOW' && 'YELLOW - READY'}
  {signalState === 'GREEN' && 'GREEN - GO'}
</div>

          <div
            className="hci-pistol-range"
            aria-label="Alvo hci 10.9 Pistola"
            role="button"
            tabIndex={0}
            onClick={addShot}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                addShot()
              }
            }}
          >
            <div className="hci-black-target">
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
              />
              <div className="hci-rear-sight hci-rear-right" />
            </div>

            <div className="hci-click-label">
              {seriesComplete ? 'SERIE COMPLETA' : 'CLIQUE PARA DISPARAR'}
            </div>
          </div>

          <p className="hci-rule-note">
            Pistola: escolha a hora do disparo pela alca e maca em movimento. A serie soma numeros inteiros: 10.9 vale 10, 10.8 vale 9, 10.7 vale 8.
          </p>

          <div className="admin-actions hci-session-actions">
            <button type="button" onClick={startSession}>
              {isEnglish ? 'New 10-shot Series' : 'Nova Serie de 10'}
            </button>
          </div>
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
                <th>{isEnglish ? 'Reaction' : 'Reação'}</th>
                <th>{isEnglish ? 'Decimal shot' : 'Disparo decimal'}</th>
                <th>{isEnglish ? 'Pistol score' : 'Ponto pistola'}</th>
            </tr>
          </thead>
          <tbody>
            {shots.map((shot) => (
              <tr key={shot.index}>
                <td>{shot.index}</td>
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
