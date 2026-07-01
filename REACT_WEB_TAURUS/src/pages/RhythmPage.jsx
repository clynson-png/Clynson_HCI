import { useMemo, useState } from 'react'
import RhythmMainChart from '../components/RhythmMainChart'
import RhythmPathChart from '../components/RhythmPathChart'
import RhythmTransferChart from '../components/RhythmTransferChart'
import FullAthleteTimelineChart from '../components/FullAthleteTimelineChart'

function RhythmPage({
  athleteView,
  athletes = [],
  selectedAthlete,
  onAthleteChange,
}) {
  const sessions = athleteView?.rhythm?.sessions || []

  const [viewMode, setViewMode] = useState('SESSION')
  const [aggregationMode, setAggregationMode] = useState('ALL_SESSIONS_MEDIAN')
  const [selectedSessionIndex, setSelectedSessionIndex] = useState(0)

  const selectedSession = sessions[selectedSessionIndex] || sessions[0] || null

  const rhythmMain = useMemo(() => {
    if (viewMode === 'SESSION') return buildSessionRhythm(selectedSession)
    return buildMedianRhythm(sessions, aggregationMode)
  }, [viewMode, selectedSession, sessions, aggregationMode])

  const transferComparison = useMemo(
    () => buildTransferComparison(sessions),
    [sessions]
  )

  const rhythmP123Comparison = useMemo(
    () => buildRhythmP123Comparison(sessions),
    [sessions]
  )

  const rhythmTransferAnalysis = useMemo(() => {
    const trainingSessions = filterSessionsByMode(
      sessions,
      'TRAINING_SIMULATION_MEDIAN'
    )

    const competitionSessions = filterSessionsByMode(
      sessions,
      'COMPETITION_MEDIAN'
    )

    return ['SR1', 'SR2', 'SR3', 'SR4', 'SR5', 'SR6'].map((serieName) => {
      const currentSerie = rhythmMain.find((item) => item.serie === serieName)

      const trainingSeries = trainingSessions
        .map((session) =>
          (session.series || []).find((serie) => serie.serie === serieName)
        )
        .filter(Boolean)

      const competitionSeries = competitionSessions
        .map((session) =>
          (session.series || []).find((serie) => serie.serie === serieName)
        )
        .filter(Boolean)

      return {
        serie: serieName,
        currentSession: currentSerie?.media ?? null,
        trainingMedian: round(median(trainingSeries.map((item) => item.media))),
        competitionMedian: round(
          median(competitionSeries.map((item) => item.media))
        ),
      }
    })
  }, [sessions, rhythmMain])

  const fullTimeline = useMemo(
    () => buildFullTimeline(sessions),
    [sessions]
  )

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <small>HCI ANALYTICS</small>
          <h1>Rhythm</h1>
        </div>
      </header>

      <section className="panel selector-panel">
        <h2>Rhythm Selectors</h2>

        <div className="selector-row">
          <select
            value={selectedAthlete || ''}
            onChange={(event) => {
              onAthleteChange(event.target.value)
              setSelectedSessionIndex(0)
            }}
          >
            {athletes.map((athlete) => (
              <option key={athlete} value={athlete}>
                {athlete}
              </option>
            ))}
          </select>

          <select value={viewMode} onChange={(event) => setViewMode(event.target.value)}>
            <option value="SESSION">Session</option>
            <option value="MEDIAN">Median</option>
          </select>

          {viewMode === 'SESSION' && (
            <select
              value={selectedSessionIndex}
              onChange={(event) => setSelectedSessionIndex(Number(event.target.value))}
            >
              {sessions.map((session, index) => (
                <option key={`${session.evento}-${index}`} value={index}>
                  {session.data || '-'} | {session.evento || '-'} | {session.sessao || '-'} | Total {session.total}
                </option>
              ))}
            </select>
          )}

          {viewMode === 'MEDIAN' && (
            <select
              value={aggregationMode}
              onChange={(event) => setAggregationMode(event.target.value)}
            >
              <option value="ALL_SESSIONS_MEDIAN">All sessions median</option>
              <option value="TRAINING_SIMULATION_MEDIAN">Training + Simulation median</option>
              <option value="COMPETITION_MEDIAN">Competition median</option>
            </select>
          )}
        </div>
      </section>

      <section className="cards">
        <div className="card">
          <span>Sessions</span>
          <strong>{sessions.length}</strong>
        </div>
        <div className="card">
          <span>Mode</span>
          <strong>{viewMode}</strong>
        </div>
        <div className="card">
          <span>Expected Next Competition</span>
          <strong>{transferComparison.expectedNext ?? '-'}</strong>
        </div>
      </section>

      <RhythmMainChart
        data={rhythmMain}
        discipline={athleteView?.athlete?.discipline}
      />

      <RhythmPathChart data={rhythmTransferAnalysis} />

      <RhythmTransferChart transferComparison={transferComparison} />

      <FullAthleteTimelineChart data={fullTimeline} />
    </main>
  )
}

function buildSessionRhythm(session) {
  if (!session?.series?.length) return []

  const rhythmPath = session.rhythmPath || []

  return session.series.map((serie) => {
    const p1 = rhythmPath.find((item) => item.label === `${serie.serie}_P1`)
    const p2 = rhythmPath.find((item) => item.label === `${serie.serie}_P2`)
    const p3 = rhythmPath.find((item) => item.label === `${serie.serie}_P3`)

    return {
      serie: serie.serie,
      total: serie.total,
      media: serie.media,
      std: serie.std,
      dropDepth: serie.mainDropDepth,
      breakCount: serie.breakCount,
      p1: p1?.val ?? null,
      p2: p2?.val ?? null,
      p3: p3?.val ?? null,
    }
  })
}

function buildMedianRhythm(sessions, aggregationMode) {
  const filteredSessions = filterSessionsByMode(sessions, aggregationMode)
  const seriesNames = ['SR1', 'SR2', 'SR3', 'SR4', 'SR5', 'SR6']

  return seriesNames.map((serieName) => {
    const matchingSeries = filteredSessions
      .map((session) => (session.series || []).find((serie) => serie.serie === serieName))
      .filter(Boolean)

    return {
      serie: serieName,
      total: round(median(matchingSeries.map((item) => item.total))),
      media: round(median(matchingSeries.map((item) => item.media))),
      std: round(median(matchingSeries.map((item) => item.std))),
      dropDepth: round(median(matchingSeries.map((item) => item.mainDropDepth))),
      breakCount: round(median(matchingSeries.map((item) => item.breakCount))),
      p1: null,
      p2: null,
      p3: null,
    }
  })
}

function buildTransferComparison(sessions) {
  const timeline = buildFullTimeline(sessions)
  const competitionValues = timeline.map((item) => item.competition).filter(isNumber)
  const trainingValues = timeline.map((item) => item.trainingSimulation).filter(isNumber)

  const transferRatio =
    median(trainingValues) && median(competitionValues)
      ? median(competitionValues) / median(trainingValues)
      : null

  const latestTraining = [...trainingValues].pop()
  const expectedNext =
    transferRatio && latestTraining ? round(latestTraining * transferRatio) : null

  const trend = logarithmicTrend(competitionValues)

  const rows = timeline.map((item, index) => ({
    ...item,
    transferTrend: trend ? round(trend(index + 1)) : null,
  }))

  if (expectedNext) {
    rows.push({
      label: 'Next',
      competition: null,
      trainingSimulation: null,
      transferTrend: expectedNext,
    })
  }

  return { rows, expectedNext }
}

function buildRhythmP123Comparison(sessions) {
  const competition = filterSessionsByMode(sessions, 'COMPETITION_MEDIAN')
  const training = filterSessionsByMode(sessions, 'TRAINING_SIMULATION_MEDIAN')

  return ['P1', 'P2', 'P3'].map((part) => ({
    part,
    competition: round(median(extractPathValues(competition, part))),
    trainingSimulation: round(median(extractPathValues(training, part))),
  }))
}

function extractPathValues(sessions, part) {
  return sessions.flatMap((session) =>
    (session.rhythmPath || [])
      .filter((item) => String(item.label || '').endsWith(`_${part}`))
      .map((item) => item.val)
  )
}

function buildFullTimeline(sessions) {
  return [...sessions]
    .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')))
    .map((session, index) => {
      const type = String(session.sessao || '').toUpperCase()
      const isCompetition = type.includes('COMPET')

      return {
        label: `${index + 1}`,
        competition: isCompetition ? session.total : null,
        trainingSimulation: isCompetition ? null : session.total,
      }
    })
}

function filterSessionsByMode(sessions, mode) {
  if (mode === 'TRAINING_SIMULATION_MEDIAN') {
    return sessions.filter((session) => {
      const type = String(session.sessao || '').toUpperCase()
      return type.includes('TREINO') || type.includes('SIMULADO')
    })
  }

  if (mode === 'COMPETITION_MEDIAN') {
    return sessions.filter((session) => {
      const type = String(session.sessao || '').toUpperCase()
      return type.includes('COMPET')
    })
  }

  return sessions
}

function median(values) {
  const clean = values.filter(isNumber).map(Number).sort((a, b) => a - b)
  if (!clean.length) return null

  const middle = Math.floor(clean.length / 2)
  return clean.length % 2
    ? clean[middle]
    : (clean[middle - 1] + clean[middle]) / 2
}

function logarithmicTrend(values) {
  const clean = values.filter(isNumber)
  if (clean.length < 2) return null

  const points = clean.map((y, index) => ({
    x: Math.log(index + 1),
    y,
  }))

  const avgX = points.reduce((sum, item) => sum + item.x, 0) / points.length
  const avgY = points.reduce((sum, item) => sum + item.y, 0) / points.length

  const numerator = points.reduce((sum, item) => sum + (item.x - avgX) * (item.y - avgY), 0)
  const denominator = points.reduce((sum, item) => sum + (item.x - avgX) ** 2, 0)

  const a = denominator ? numerator / denominator : 0
  const b = avgY - a * avgX

  return (x) => a * Math.log(x) + b
}

function SimpleMultiLineChart({ data, xKey, series }) {
  const width = 900
  const height = 280
  const padding = 40

  const values = data.flatMap((row) =>
    series.map((serie) => row[serie.key]).filter(isNumber)
  )

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  function x(index) {
    if (data.length <= 1) return padding
    return padding + (index / (data.length - 1)) * (width - padding * 2)
  }

  function y(value) {
    return height - padding - ((value - min) / range) * (height - padding * 2)
  }

  function pathFor(key) {
    return data
      .map((row, index) => {
        const value = row[key]
        if (!isNumber(value)) return null
        return `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(value)}`
      })
      .filter(Boolean)
      .join(' ')
  }

  if (!values.length) {
    return <p style={{ padding: 16 }}>No data available.</p>
  }

  return (
    <div style={{ padding: 16, overflowX: 'auto' }}>
      <svg width={width} height={height} style={{ background: '#fff' }}>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#cbd5e1" />

        {series.map((serie) => (
          <path
            key={serie.key}
            d={pathFor(serie.key)}
            fill="none"
            stroke={serie.color}
            strokeWidth="3"
          />
        ))}

        {data.map((row, index) => (
          <text key={index} x={x(index)} y={height - 12} fontSize="11" textAnchor="middle">
            {row[xKey]}
          </text>
        ))}
      </svg>

      <div style={{ display: 'flex', gap: 16, paddingTop: 8, flexWrap: 'wrap' }}>
        {series.map((serie) => (
          <span key={serie.key}>
            <strong style={{ color: serie.color }}>■</strong> {serie.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function isNumber(value) {
  return value !== null && value !== undefined && !Number.isNaN(Number(value))
}

function round(value) {
  if (!isNumber(value)) return null
  return Math.round(Number(value) * 100) / 100
}

export default RhythmPage
