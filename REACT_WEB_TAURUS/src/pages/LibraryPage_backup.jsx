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

  const isIpponTraining =
    selectedItem?.trainingId === 'IPPON109_PRESSURE_SPECIFIC_PREPARATION_PISTOL_RIFLE'

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
              <option value="IPPON_109">IPPON 10.9</option>
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

            {isIpponTraining && (
              <div className="admin-actions ippon-open-actions">
                <button
                  type="button"
                  onClick={() =>
                    setOpenInteractiveId((current) =>
                      current === selectedItem.trainingId ? '' : selectedItem.trainingId
                    )
                  }
                >
                  {openInteractiveId === selectedItem.trainingId
                    ? 'Fechar Treino IPPON'
                    : 'Abrir Treino IPPON'}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {isIpponTraining && openInteractiveId === selectedItem.trainingId && (
        <Ippon109Trainer lang={lang} training={selectedItem} />
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

function Ippon109Trainer({ lang, training }) {
  const isEnglish = lang === 'en'
  const [shots, setShots] = useState([])
  const sightRef = useRef({
    groupX: 0,
    groupY: -635,
    frontX: 0,
    frontY: 0,
    speed: 1,
  })
  const sightGroupRef = useRef(null)
  const frontSightRef = useRef(null)
  const targetRef = useRef(null)

  const isPistol = true
  const seriesComplete = shots.length === 10
  const decimalTotal = shots.reduce((sum, shot) => sum + shot.decimalScore, 0)
  const pistolTotal = shots.reduce((sum, shot) => sum + shot.pistolScore, 0)
  const seriesTotal = isPistol ? pistolTotal : decimalTotal
  const averageRadius = shots.length
    ? shots.reduce((sum, shot) => sum + shot.radius, 0) / shots.length
    : 0
  const prescription = seriesComplete
    ? buildIpponPrescription({ isEnglish, isPistol, total: seriesTotal, averageRadius })
    : null

  useEffect(() => {
    let frameId
    const ideal = { groupX: 0, groupY: -380, frontX: 0, frontY: 0 }
    const start = performance.now()
    let driftX = -20
    let driftY = 20
    let frontDriftX = 1.4
    let frontDriftY = 0.2
    let driftTarget = { groupX: 18, groupY: -16, frontX: -1.2, frontY: -0.2 }
    let driftStart = start
    let driftDuration = 420

    function retarget(now, closeToIdeal = false) {
      driftStart = now
      const speedFactor = 0.5 + Math.random() * 0.8
      driftDuration = (260 + Math.random() * 260) / speedFactor
      driftTarget = closeToIdeal
        ? {
            groupX: (Math.random() - 0.5) * 3.0,
            groupY: (Math.random() - 0.5) * 2.2,
            frontX: (Math.random() - 0.5) * 0.75,
            frontY: (Math.random() - 0.5) * 0.55,
          }
        : {
            groupX: (Math.random() - 0.5) * 108,
            groupY: -44 + Math.random() * 88,
            frontX: (Math.random() - 0.5) * 5.6,
            frontY: -2.4 + Math.random() * 4.8,
          }
    }

    function animateSight(now) {
      if (now - driftStart >= driftDuration) {
        driftX = driftTarget.groupX
        driftY = driftTarget.groupY
        frontDriftX = driftTarget.frontX
        frontDriftY = driftTarget.frontY
        retarget(now, Math.random() < 0.34)
      }

      const rawProgress = Math.min(1, (now - driftStart) / driftDuration)
      const fade = rawProgress * rawProgress * (3 - 2 * rawProgress)
      const nextX = driftX + (driftTarget.groupX - driftX) * fade
      const nextY = driftY + (driftTarget.groupY - driftY) * fade
      const nextFrontX = frontDriftX + (driftTarget.frontX - frontDriftX) * fade
      const nextFrontY = frontDriftY + (driftTarget.frontY - frontDriftY) * fade
      const seconds = (now - start) / 1000
      const nearCenter = Math.max(
        0,
        1 - Math.hypot(nextX, nextY) / 18
      )
      const centerEase = 1 - nearCenter * 0.60
      const breathX = (
        Math.sin(seconds * Math.PI * 1.12 + 0.4) * 40
        + Math.sin(seconds * Math.PI * 2.36 + 1.8) * 20
      ) * centerEase
      const breathY = (
        Math.cos(seconds * Math.PI * 1.12 + 0.4) * 24
        + Math.sin(seconds * Math.PI * 2.05) * 10.4
        + Math.sin(seconds * Math.PI * 3.2 + 1.1) * 3.8
      ) * centerEase
      const pulse = Math.sin(seconds * Math.PI * 5.4 + 0.8) * 1.2
        + Math.sin(seconds * Math.PI * 9.7 + 2.3) * 0.34
      const correctionX = Math.sin(seconds * Math.PI * 1.37 + 0.5) * 4.2
      const correctionY = Math.sin(seconds * Math.PI * 1.71 + 2.1) * 3.4

      sightRef.current = {
        groupX: ideal.groupX + nextX + breathX + pulse + correctionX,
        groupY: ideal.groupY + nextY + breathY + correctionY,
        frontX: ideal.frontX + nextFrontX,
        frontY: ideal.frontY + nextFrontY,
        speed: 1,
      }

      const current = sightRef.current
      if (sightGroupRef.current) {
        ssightGroupRef.current.style.transform =
  `translate3d(${current.groupX}px, ${current.groupY}px, 0)`
      }
      if (frontSightRef.current) {
        frontSightRef.current.style.transform =
  `translate3d(${current.frontX}px, ${current.frontY}px, 0)`
      }

      frameId = window.requestAnimationFrame(animateSight)
    }

    retarget(performance.now(), true)
    frameId = window.requestAnimationFrame(animateSight)
    return () => window.cancelAnimationFrame(frameId)
  }, [])

  function startSession() {
    setShots([])
  }

 function addShot() {
  setShots((current) => {
    if (current.length >= 10) return current

    const shot = generateIpponPistolShot({
      index: current.length + 1,
      targetElement: targetRef.current,
      frontElement: frontSightRef.current,
    })

    console.log('SHOT', shot)

    return [...current, shot]
  })
}

  return (
    <section className="panel ippon-trainer-panel">
      <h2>{isEnglish ? 'IPPON 10.9 Interactive Training' : 'Treino Interativo IPPON 10.9'}</h2>

      <div className="ippon-trainer">
        <div className="ippon-stage">
          <div className="ippon-stage-header">
            <span>{training.trainingId}</span>
            <strong>
              {isEnglish ? 'Series' : 'Serie'} {shots.length} / 10
            </strong>
          </div>

          <div className="ippon-discipline-row" role="group" aria-label="Disciplina">
            <button type="button" className="active">
              Pistola
            </button>
          </div>

          <div
            className="ippon-pistol-range"
            aria-label="Alvo IPPON 10.9 Pistola"
            role="button"
            tabIndex={0}
            
		onPointerDown={(event) => {
  		event.preventDefault()
  		addShot()
		}}


            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                addShot()
              }
            }}
          >

            <div className="ippon-black-target" ref={targetRef}>
              <div className="ippon-score-rings" />
              {shots.map((shot) => (
                

		<div
                  key={shot.index}
                  className="ippon-shot-dot"
                  style={{



                    left: `calc(50% + ${shot.x}px)`,
		    top: `calc(50% + ${shot.y}px)`,
                  }}





                  title={`${shot.index}: ${shot.decimalScore.toFixed(1)}`}
                >
                  {shot.index}
                </div>
              ))}
            </div>

            <div
              className="ippon-sight-picture"
              ref={sightGroupRef}
              aria-hidden="true"
            >
		<div className="ippon-impact-arrow" />

              <div className="ippon-rear-sight ippon-rear-left" />
              <div
                className="ippon-front-sight"
                ref={frontSightRef}
              />
              <div className="ippon-rear-sight ippon-rear-right" />
            </div>

            <div className="ippon-click-label">
              {seriesComplete ? 'SERIE COMPLETA' : 'CLIQUE PARA DISPARAR'}
            </div>
          </div>

          <p className="ippon-rule-note">
            Pistola: escolha a hora do disparo pela alca e maca em movimento. A serie soma numeros inteiros: 10.9 vale 10, 10.8 vale 9, 10.7 vale 8.
          </p>

          <div className="admin-actions ippon-session-actions">
            <button type="button" onClick={startSession}>
              {isEnglish ? 'New 10-shot Series' : 'Nova Serie de 10'}
            </button>
          </div>
        </div>

        <div className="ippon-metrics">
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

      <div className="ippon-shot-table">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>{isEnglish ? 'Decimal shot' : 'Disparo decimal'}</th>
              <th>{isEnglish ? 'Pistol score' : 'Ponto pistola'}</th>
            </tr>
          </thead>
          <tbody>
            {shots.map((shot) => (
              <tr key={shot.index}>
                <td>{shot.index}</td>
                <td>{shot.decimalScore.toFixed(1)}</td>
                <td>{shot.pistolScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ippon-prescription">
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

function generateIpponPistolShot({
  index,
  targetElement,
  frontElement,
}) {
  let x = 0
  let y = 0

  if (targetElement && frontElement) {
    const targetRect = targetElement.getBoundingClientRect()
    const frontRect = frontElement.getBoundingClientRect()

    const targetCenterX = targetRect.left + targetRect.width / 2
    const targetCenterY = targetRect.top + targetRect.height / 2

    // Centro horizontal da maça.
    const frontAimX = frontRect.left + frontRect.width / 2

    // Ponta superior da maça.
    // Se no seu desenho a referência visual for o meio da maça,
    // troque por: frontRect.top + frontRect.height / 2
    const frontAimY = frontRect.top

    x = frontAimX - targetCenterX
    y = frontAimY - targetCenterY
  }

  const distance = Math.hypot(x, y)

  const decimalScore = Math.max(
    0,
    Math.round((10.9 - distance * 0.1) * 10) / 10
  )

  const pistolScore = convertDecimalToPistolScore(decimalScore)

  const radius = Math.min(1, distance / 109)

  return {
    index,
    x,
    y,
    radius,
    decimalScore,
    pistolScore,
  }
}




function mapScoreToTargetPosition({ score, decimalScore, aimX, aimY }) {
  const angle = Math.atan2(aimY, aimX) || Math.random() * Math.PI * 2
  const decimalInsideBand = Math.max(0, Math.min(0.9, decimalScore - Math.floor(decimalScore)))
  const bandCenter = score >= 1 ? 4 + (10 - score) * 4.3 : 47
  const bandOffset = score >= 1 ? (0.5 - decimalInsideBand) * 2.4 : 0
  const targetRadius = Math.max(1.2, Math.min(47, bandCenter + bandOffset))

  return {
    x: Math.cos(angle) * targetRadius,
    y: Math.sin(angle) * targetRadius,
  }
}

function convertDecimalToPistolScore(decimalScore) {
  if (decimalScore >= 10) {
    return Math.max(0, Math.min(10, Math.round((decimalScore - 10) * 10) + 1))
  }

  return Math.max(0, Math.floor(decimalScore))
}

function buildIpponPrescription({ isEnglish, isPistol, total, averageRadius }) {
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
