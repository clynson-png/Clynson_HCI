import { useEffect, useMemo, useState } from 'react'
import {
  getTrainingLibraryEntries,
  getTrainingLibraryStats,
  getTrainingById,
} from '../services/trainingLibraryService'
import { TAURUS_PARAMETERS, normalizeTaurusParameter } from '../services/taurusDecisionEngines'
import { buildTaurusSmartChartModel } from '../services/taurusSmartChartEngine'
import { loadTaurusTargetSessions } from '../services/taurusTargetStore'
import { loadCustomTrainingEntries, saveCustomTrainingEntry } from '../services/trainingLibraryCustomStore'
import taurusLogoWordmark from '../assets/taurus-logo-wordmark.png'

const TAURUS_TARGET_OPTIONS = [
  { value: 'DEFENSE_HUMANOID', label: 'Humanoid', taurusType: 'HUMANOID' },
  { value: 'PRECISION_COLOR', label: 'Color Cards', taurusType: 'COLOR' },
  { value: 'DUEL_20', label: 'Duel 20', taurusType: 'DUEL20' },
]

const TAURUS_PHASE_OPTIONS = [
  { value: 'LEARNING', label: 'Learning', phases: ['GENERAL_PREPARATION', 'SPECIFIC_PREPARATION'] },
  { value: 'COMPETITION', label: 'Competition', phases: ['COMPETITION'] },
]

const TAURUS_LEVEL_OPTIONS = [
  { value: 'BEGINNER', label: 'Beginner', levels: ['BEGINNER', 'BEGINNER_INTERMEDIATE', 'INTERMEDIATE'] },
  { value: 'ELITE', label: 'Elite', levels: ['ELITE', 'HIGH_PERFORMANCE'] },
]

const TAURUS_PARAMETER_OPTIONS = {
  DEFENSE_HUMANOID: [
    { value: TAURUS_PARAMETERS.HUMANOID.POSITION, label: 'Position / safety base' },
    { value: TAURUS_PARAMETERS.HUMANOID.AIMING, label: 'Aiming' },
    { value: TAURUS_PARAMETERS.HUMANOID.TRIGGERING, label: 'Triggering' },
    { value: TAURUS_PARAMETERS.HUMANOID.GRIP, label: 'Grip' },
  ],
  PRECISION_COLOR: [
    { value: TAURUS_PARAMETERS.COLOR.COLOR_IDENTIFICATION, label: 'Color identification' },
    { value: TAURUS_PARAMETERS.COLOR.AIMING, label: 'Aiming' },
    { value: TAURUS_PARAMETERS.COLOR.TRIGGERING, label: 'Triggering' },
    { value: TAURUS_PARAMETERS.COLOR.GRIP, label: 'Grip' },
    { value: TAURUS_PARAMETERS.COLOR.POSITION, label: 'Position / safety base' },
  ],
  DUEL_20: [
    { value: TAURUS_PARAMETERS.DUEL20.BASE_REBUILD, label: 'Base rebuild' },
    { value: TAURUS_PARAMETERS.DUEL20.SERIES_STABILITY, label: 'Series stability' },
    { value: TAURUS_PARAMETERS.DUEL20.DIRECTIONAL_CONTROL, label: 'Directional control' },
    { value: TAURUS_PARAMETERS.DUEL20.CENTER_RETENTION, label: 'Center retention' },
    { value: TAURUS_PARAMETERS.DUEL20.TIMING_CONTROL, label: 'Timing control' },
  ],
}

function PlanoPage({
  lang = 'pt',
  athletes = [],
  selectedAthlete = '',
  onAthleteChange,
}) {
  const uiLang = lang === 'en' ? 'en-US' : 'pt-BR'
  const trainingStats = getTrainingLibraryStats()
  const [trainings, setTrainings] = useState(() => getTrainingLibraryEntries())
  const athleteOptions = athletes.length > 0 ? athletes : []
  const currentAthlete = selectedAthlete || athleteOptions[0] || ''

  const [phase, setPhase] = useState('LEARNING')
  const [parameter, setParameter] = useState(TAURUS_PARAMETERS.HUMANOID.POSITION)
  const [level, setLevel] = useState('BEGINNER')
  const [targetType, setTargetType] = useState('DEFENSE_HUMANOID')
  const [selectedTrainingId, setSelectedTrainingId] = useState(
    trainingStats.firstTraining || ''
  )
  const [manualTraining, setManualTraining] = useState({
    title: '',
    objective: '',
    description: '',
    executionSummary: '',
    loadNote: '',
    defaultTime: '60',
    defaultShots: '',
  })

  const [approvedTrainings, setApprovedTrainings] = useState([])
  const [rejectedRecommendations, setRejectedRecommendations] = useState([])
  const [taurusSessions, setTaurusSessions] = useState([])
  const currentTargetOption = TAURUS_TARGET_OPTIONS.find((option) => option.value === targetType)
  const currentParameterOptions = TAURUS_PARAMETER_OPTIONS[targetType] || []
  const smartChartModel = useMemo(() => {
    if (!currentAthlete || !currentTargetOption?.taurusType) return null

    return buildTaurusSmartChartModel({
      sessions: taurusSessions.filter((session) => session.athleteName === currentAthlete),
      athleteName: currentAthlete,
      targetType: currentTargetOption.taurusType,
    })
  }, [taurusSessions, currentAthlete, currentTargetOption])
  const smartChartLevel = smartChartModel?.summary?.trainingLevel?.code || level

  useEffect(() => {
    let cancelled = false

    async function loadSessions() {
      const [nextSessions] = await Promise.all([
        loadTaurusTargetSessions(),
        loadCustomTrainingEntries(),
      ])
      if (!cancelled) {
        setTaurusSessions(nextSessions)
        setTrainings(getTrainingLibraryEntries())
      }
    }

    loadSessions()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (smartChartLevel && smartChartLevel !== level) {
      setLevel(smartChartLevel)
      setSelectedTrainingId('')
    }
  }, [smartChartLevel, level])

  const filteredTrainings = useMemo(() => {
    return trainings.filter((training) => {
      return (
        targetMatches(training, targetType) &&
        phaseMatches(training, phase) &&
        levelMatches(training, smartChartLevel) &&
        parameterMatches(training, parameter, currentTargetOption?.taurusType)
      )
    })
  }, [trainings, phase, parameter, smartChartLevel, targetType, currentTargetOption])

  const engineRecommendations = filteredTrainings.slice(0, 3).map((training, index) => ({
    rank: index + 1,
    reason: index === 0 ? 'PRIMARY_ENGINE_MATCH' : 'SECONDARY_ENGINE_MATCH',
    training,
  }))

  const selectedTraining =
    getTrainingById(selectedTrainingId) || filteredTrainings[0]

  function handleFilterChange(setter) {
    return (event) => {
      setter(event.target.value)
      setSelectedTrainingId('')
    }
  }

  function handleTargetChange(event) {
    const nextTargetType = event.target.value
    const nextParameter = TAURUS_PARAMETER_OPTIONS[nextTargetType]?.[0]?.value || ''
    setTargetType(nextTargetType)
    setParameter(nextParameter)
    setSelectedTrainingId('')
  }

  function approveRecommendation(recommendation) {
    const exists = approvedTrainings.some(
      (item) => item.trainingId === recommendation.training.trainingId
    )

    if (!exists) {
      setApprovedTrainings([...approvedTrainings, recommendation.training])
    }
  }

  function rejectRecommendation(recommendation) {
    const exists = rejectedRecommendations.some(
      (item) => item.trainingId === recommendation.training.trainingId
    )

    if (!exists) {
      setRejectedRecommendations([
        ...rejectedRecommendations,
        {
          trainingId: recommendation.training.trainingId,
          reason: 'COACH_REJECTED',
        },
      ])
    }
  }

  function replaceRecommendation(recommendation) {
    setSelectedTrainingId(recommendation.training.trainingId)
  }

  function updateManualTraining(field) {
    return (event) => {
      setManualTraining((current) => ({
        ...current,
        [field]: event.target.value,
      }))
    }
  }

  async function saveManualTraining() {
    const title = manualTraining.title.trim()
    if (!title) return

    const entry = buildManualTrainingEntry({
      manualTraining,
      targetType,
      phase,
      level: smartChartLevel,
      parameter,
      uiLang,
    })
    const savedEntry = await saveCustomTrainingEntry(entry)

    setTrainings(getTrainingLibraryEntries())
    setSelectedTrainingId(savedEntry.trainingId)
    setManualTraining({
      title: '',
      objective: '',
      description: '',
      executionSummary: '',
      loadNote: '',
      defaultTime: '60',
      defaultShots: '',
    })
  }

  return (
    <main className="dashboard dashboard-plano">
      <header className="dashboard-header taurus-page-header">
        <div className="taurus-page-header-brand">
          <img src={taurusLogoWordmark} alt="TAURUS" />
        </div>

        <div className="taurus-page-header-title">
          <small>HCI PERFORMANCE</small>
          <h1>Training Plan</h1>
        </div>
      </header>

      <section className="cards">
        <div className="card plano-stat-card">
          <span>Athlete</span>
          <strong>{currentAthlete || '-'}</strong>
        </div>

        <div className="card plano-stat-card">
          <span>Canonical Trainings</span>
          <strong>{trainingStats.totalTrainings}</strong>
        </div>

        <div className="card plano-stat-card">
          <span>Filtered</span>
          <strong>{filteredTrainings.length}</strong>
        </div>

        <div className="card plano-stat-card">
          <span>Approved</span>
          <strong>{approvedTrainings.length}</strong>
        </div>

        <div className="card plano-stat-card">
          <span>Smart Chart Level</span>
          <strong>{smartChartModel?.summary?.trainingLevel?.label || smartChartLevel}</strong>
        </div>
      </section>

      <section className="panel selector-panel plano-panel">
        <h2>Athlete Selection</h2>

        <div className="selector-row">
          <div className="plano-filter-control">
            <select
              value={currentAthlete}
              onChange={(event) => {
                onAthleteChange?.(event.target.value)
                setApprovedTrainings([])
                setRejectedRecommendations([])
              }}
              disabled={athleteOptions.length === 0}
            >
              {athleteOptions.length === 0 ? (
                <option value="">No athletes available</option>
              ) : (
                athleteOptions.map((athlete) => (
                  <option key={athlete} value={athlete}>
                    {athlete}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </section>

      <section className="panel selector-panel plano-panel">
        <h2>Training Filters</h2>

        <p className="plano-empty-state">
          Smart Chart indication: {smartChartModel?.summary?.trainingLevel?.label || smartChartLevel}
          {' - '}
          {smartChartModel?.summary?.trainingLevel?.reason || 'No approved TAURUS sessions found for this target.'}
        </p>

        <div className="selector-row">
          <div className="plano-filter-control">
          <select value={targetType} onChange={handleTargetChange}>
            {TAURUS_TARGET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          </div>
          <div className="plano-filter-control">
          <select value={phase} onChange={handleFilterChange(setPhase)}>
            {TAURUS_PHASE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          </div>
          <div className="plano-filter-control">
          <select value={parameter} onChange={handleFilterChange(setParameter)}>
            {currentParameterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          </div>
          <div className="plano-filter-control">
          <select value={level} onChange={handleFilterChange(setLevel)}>
            {TAURUS_LEVEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          </div>
        </div>
      </section>

      <section className="panel plano-panel">
        <h2>Automatic Recommendations</h2>

        <div className="training-recommendations">
          {engineRecommendations.map((recommendation) => (
            <div className="training-card plano-recommendation-card" key={recommendation.training.trainingId}>
              <h3>Recommendation #{recommendation.rank}</h3>
              <p><strong>{recommendation.training.name?.[uiLang]}</strong></p>
              <p>{recommendation.training.objective?.[uiLang]}</p>
              <p><strong>Parameter:</strong> {recommendation.training.parameter}</p>
              <p><strong>Phase:</strong> {recommendation.training.phase}</p>
              <p><strong>Level:</strong> {recommendation.training.level}</p>
              <p><strong>Target:</strong> {recommendation.training.targetType}</p>

              <div className="admin-actions">
                <button className="plano-action-button" onClick={() => approveRecommendation(recommendation)}>
                  Approve
                </button>
                <button className="plano-action-button" onClick={() => rejectRecommendation(recommendation)}>
                  Reject
                </button>
                <button className="plano-action-button" onClick={() => replaceRecommendation(recommendation)}>
                  Replace / View
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel selector-panel">
        <h2>Replace / Manual Selection</h2>

        <div className="plano-manual-grid">
          <div className="plano-manual-block">
            <h3>Choose From Library</h3>
            <select
              value={selectedTraining?.trainingId || ''}
              onChange={(event) => setSelectedTrainingId(event.target.value)}
            >
              {filteredTrainings.map((training) => (
                <option key={training.trainingId} value={training.trainingId}>
                  {training.trainingId}
                </option>
              ))}
            </select>
          </div>

          <div className="plano-manual-block">
            <h3>Create Training</h3>
            <div className="plano-manual-form">
              <input
                value={manualTraining.title}
                onChange={updateManualTraining('title')}
                placeholder="Training title"
              />
              <textarea
                value={manualTraining.objective}
                onChange={updateManualTraining('objective')}
                placeholder="Objective"
              />
              <textarea
                value={manualTraining.description}
                onChange={updateManualTraining('description')}
                placeholder="Description"
              />
              <textarea
                value={manualTraining.executionSummary}
                onChange={updateManualTraining('executionSummary')}
                placeholder="Execution"
              />
              <textarea
                value={manualTraining.loadNote}
                onChange={updateManualTraining('loadNote')}
                placeholder="Load / coach note"
              />
              <div className="plano-manual-inline">
                <input
                  value={manualTraining.defaultTime}
                  onChange={updateManualTraining('defaultTime')}
                  placeholder="Minutes"
                  inputMode="numeric"
                />
                <input
                  value={manualTraining.defaultShots}
                  onChange={updateManualTraining('defaultShots')}
                  placeholder="Shots"
                  inputMode="numeric"
                />
              </div>
              <p className="plano-manual-context">
                {targetType} / {parameter} / {phase} / {smartChartLevel}
              </p>
              <button
                type="button"
                className="plano-action-button"
                onClick={saveManualTraining}
                disabled={!manualTraining.title.trim()}
              >
                Save To Library
              </button>
            </div>
          </div>
        </div>
      </section>

      {selectedTraining && (
        <section className="panel plano-panel">
          <h2>{selectedTraining.name?.[uiLang]}</h2>

          <div style={{ padding: 16 }}>
            <p><strong>Target Type:</strong> {selectedTraining.targetType}</p>
            <p><strong>Parameter:</strong> {selectedTraining.parameter}</p>
            <p><strong>Phase:</strong> {selectedTraining.phase}</p>
            <p><strong>Level:</strong> {selectedTraining.level}</p>
            <p><strong>Weapon:</strong> {selectedTraining.weaponClass}</p>
            <p><strong>Objective:</strong> {selectedTraining.objective?.[uiLang]}</p>
            <p><strong>Description:</strong> {selectedTraining.description?.[uiLang]}</p>
            <p><strong>Execution:</strong> {selectedTraining.executionSummary?.[uiLang]}</p>
            <p><strong>Load:</strong> {selectedTraining.loadNote?.[uiLang]}</p>

            <div className="admin-actions">
              <button className="plano-action-button" onClick={() => approveRecommendation({ training: selectedTraining })}>
                Approve Selected Training
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="panel plano-panel">
        <h2>Rejected Recommendations</h2>

        {rejectedRecommendations.length === 0 ? (
          <p className="plano-empty-state">No rejected recommendations yet.</p>
        ) : (
          <table className="plano-table">
            <thead>
              <tr>
                <th>Training ID</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {rejectedRecommendations.map((item) => (
                <tr key={item.trainingId}>
                  <td>{item.trainingId}</td>
                  <td>{item.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel plano-panel">
        <h2>Approved Plan Preview</h2>

        {approvedTrainings.length === 0 ? (
          <p className="plano-empty-state">No approved trainings yet.</p>
        ) : (
          <table className="plano-table">
            <thead>
              <tr>
                <th>Training</th>
                <th>Parameter</th>
                <th>Phase</th>
                <th>Level</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {approvedTrainings.map((training) => (
                <tr key={training.trainingId}>
                  <td>{training.name?.[uiLang]}</td>
                  <td>{training.parameter}</td>
                  <td>{training.phase}</td>
                  <td>{training.level}</td>
                  <td>{training.targetType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}

function targetMatches(training, selectedTargetType) {
  return training?.targetType === selectedTargetType
}

function phaseMatches(training, selectedPhase) {
  const option = TAURUS_PHASE_OPTIONS.find((item) => item.value === selectedPhase)
  return option?.phases.includes(training?.phase)
}

function levelMatches(training, selectedLevel) {
  const option = TAURUS_LEVEL_OPTIONS.find((item) => item.value === selectedLevel)
  return option?.levels.includes(training?.level)
}

function parameterMatches(training, selectedParameter, taurusType) {
  const trainingParameter = normalizeTaurusParameter(training?.parameter, taurusType)
  const filterParameter = normalizeTaurusParameter(selectedParameter, taurusType)
  return trainingParameter === filterParameter
}

function buildManualTrainingEntry({
  manualTraining,
  targetType,
  phase,
  level,
  parameter,
  uiLang,
}) {
  const targetRule = getTrainingRuleForTarget(targetType)
  const resolvedPhase = phase === 'COMPETITION' ? 'COMPETITION' : 'GENERAL_PREPARATION'
  const safeTitle = manualTraining.title.trim()
  const trainingId = `COACH_${targetType}_${parameter}_${Date.now()}`

  return {
    trainingId,
    code: trainingId,
    parameter,
    phase: resolvedPhase,
    trainingType: targetRule.trainingType,
    category: targetRule.category,
    weaponClass: targetRule.weaponClass,
    targetType,
    level,
    levelCode: level,
    active: true,
    defaultTime: Number(manualTraining.defaultTime || 60),
    defaultShots: Number(manualTraining.defaultShots || 0),
    name: {
      'pt-BR': safeTitle,
      'en-US': safeTitle,
      [uiLang]: safeTitle,
    },
    objective: bilingualText(manualTraining.objective),
    description: bilingualText(manualTraining.description),
    executionSummary: bilingualText(manualTraining.executionSummary),
    loadNote: bilingualText(manualTraining.loadNote),
    qualityFocus: bilingualText(manualTraining.objective),
    coachCues: {
      'pt-BR': [],
      'en-US': [],
    },
    source: 'COACH_SQL_LOCAL',
  }
}

function bilingualText(value) {
  const text = String(value || '').trim()
  return {
    'pt-BR': text,
    'en-US': text,
  }
}

function getTrainingRuleForTarget(targetType) {
  if (targetType === 'DUEL_20') {
    return {
      trainingType: 'TECHNICAL',
      category: 'DUEL_20',
      weaponClass: 'PISTOL',
    }
  }

  if (targetType === 'PRECISION_COLOR') {
    return {
      trainingType: 'TARGET_BASIC',
      category: 'COLOR_CARD',
      weaponClass: 'COLOR_CARD_BASIC',
    }
  }

  return {
    trainingType: 'TARGET_BASIC',
    category: 'HUMANOID',
    weaponClass: 'HUMANOID_BASIC',
  }
}

export default PlanoPage
