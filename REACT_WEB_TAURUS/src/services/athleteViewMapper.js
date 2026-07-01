import { ATHLETE_VIEW_JSON_V4_1 } from '../contracts/ATHLETE_VIEW_JSON_v4_1'
import { materializeSnapshotDerivedMetrics } from './hciDerivedMetricsEngine'

export function mapSnapshotToAthleteView(snapshot, athleteName) {
  const derivedMetrics = materializeSnapshotDerivedMetrics(snapshot)
  const canonicalAthleteNames = Object.keys(derivedMetrics.athleteMetricsByName || {})
  const fallbackAthletes = snapshot?.athlete360 || []
  const resolvedAthleteName =
    athleteName ||
    canonicalAthleteNames[0] ||
    fallbackAthletes[0]?.athlete ||
    null

  if (!resolvedAthleteName) {
    return null
  }

  const athlete360 =
    fallbackAthletes.find((item) => item.athlete === resolvedAthleteName) || null
  const sessions = buildRenderableSessions(snapshot, resolvedAthleteName)
  const canonicalIndices = derivedMetrics.athleteMetricsByName?.[resolvedAthleteName] || null
  const parameters =
    canonicalIndices?.parameters?.length > 0
      ? canonicalIndices.parameters
      : athlete360?.parameters || []
  const normalizedParameters = parameters.map(normalizeParameterItem)
  const snapshotPrescriptions = (snapshot?.prescriptions || []).filter(
    (item) => item.athlete === resolvedAthleteName || item.athleteName === resolvedAthleteName
  )
  const prescriptions = [
    ...(athlete360?.prescriptions || []),
    ...snapshotPrescriptions,
  ]

  const latestSession = sessions[0] || null

  return {
    ...ATHLETE_VIEW_JSON_V4_1,

    metadata: {
      ...ATHLETE_VIEW_JSON_V4_1.metadata,
      generatedAt: Date.now(),
      sourceSnapshotVersion: 'admin_v3_4_1_snapshot',
      appRenderVersion: 'react_web_spec_v4_1',
    },

    athlete: {
      id: resolvedAthleteName,
      name: resolvedAthleteName,
      email: findAthleteEmail(snapshot, resolvedAthleteName),
      discipline: canonicalIndices?.discipline || athlete360?.prova || null,
      levelCode: normalizeLevelCode(canonicalIndices?.level || athlete360?.level),
    },

    summary: {
      hci: canonicalIndices?.overallHci ?? athlete360?.hci ?? null,
      levelCode: normalizeLevelCode(canonicalIndices?.level || athlete360?.level),
      latestTotal: latestSession?.total ?? canonicalIndices?.latestTotal ?? athlete360?.latestTotal,
      medianTotal:
        calculateMedianTotal(sessions) ?? canonicalIndices?.medianTotal ?? athlete360?.medianTotal,
      sessionsCount: sessions.length || canonicalIndices?.sessionsCount || athlete360?.sessionsCount || 0,
      targetSessionsCount: 0,
      prescriptionsCount: athlete360?.prescriptionCount || prescriptions.length,
    },

    indices: {
      overallHci: canonicalIndices?.overallHci ?? athlete360?.hci ?? null,
      targets: normalizedParameters.filter(
        (item) => item.reportProfileCode === 'TARGETS'
      ),
      structure: normalizedParameters.filter(
        (item) => item.reportProfileCode === 'STRUCTURE'
      ),
      allParameters: normalizedParameters,
    },

    rhythm: {
      latestSession,
      sessions,
      rhythmMain: buildRhythmMain(latestSession),
      rhythmPath: latestSession?.rhythmPath || [],
      stdBySeries: buildStdBySeries(latestSession),
      comparison: buildRhythmComparison(sessions),
    },

    targetIntelligence: {
      sessions: [],
      selectedSession: null,
      dominantDirection: null,
      secondaryDirection: null,
      zones: [],
      idd: null,
      recommendedTraining: null,
    },

    trainingPlan: {
      ...ATHLETE_VIEW_JSON_V4_1.trainingPlan,
      engineRecommendations: [],
      coachPrescriptions: prescriptions.filter(
        (item) => item.prescribedByRole === 'ADMIN_DESKTOP' || item.prescribedByRole === 'ADMIN_REACT'
      ),
      prescribedTrainings: prescriptions,
      clickableTrainingDetails: prescriptions.map((item) => ({
        id: item.trainingId,
        title: item.trainingTitle,
        code: item.code,
        block: item.block,
        source: item.prescribedByRole,
      })),
    },

    physicalTraining: {
      ...ATHLETE_VIEW_JSON_V4_1.physicalTraining,
    },

    reports: {
      ...ATHLETE_VIEW_JSON_V4_1.reports,
      athleteSummary: {
        hci: canonicalIndices?.overallHci ?? athlete360?.hci ?? null,
        levelCode: normalizeLevelCode(canonicalIndices?.level || athlete360?.level),
        latestTotal: latestSession?.total ?? canonicalIndices?.latestTotal ?? athlete360?.latestTotal,
      },
      coachSummary: {
        sessionsCount: sessions.length || canonicalIndices?.sessionsCount || athlete360?.sessionsCount || 0,
        targetSessionsCount: 0,
        prescriptionsCount: athlete360?.prescriptionCount || prescriptions.length,
      },
      recommendations: [],
    },

    exportPackage: {
      ...ATHLETE_VIEW_JSON_V4_1.exportPackage,
      appRenderBlocks: [
        'summary',
        'indices',
        'rhythm',
        'targetIntelligence',
        'trainingPlan',
        'physicalTraining',
        'reports',
      ],
      downloadableFiles: [],
      syncStatus: {
        readyToExport: true,
        generatedAt: Date.now(),
      },
    },
  }
}

function findAthleteEmail(snapshot, athleteName) {
  const lead = (snapshot?.leads || []).find(
    (item) => item.athleteName === athleteName
  )

  return lead?.athleteEmail || null
}

function normalizeLevelCode(level) {
  const value = String(level || '').toUpperCase()

  if (value.includes('ELITE')) return 'ELITE'
  if (value.includes('ALTO') || value.includes('HIGH')) return 'HIGH_PERFORMANCE'
  if (value.includes('INTER')) return 'INTERMEDIATE'
  if (value.includes('INICIANTE') || value.includes('BEGINNER')) return 'BEGINNER'
  if (value.includes('SEM BASELINE')) return 'NO_BASELINE'

  return 'UNKNOWN'
}

function buildRhythmMain(session) {
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

function buildStdBySeries(session) {
  if (!session?.series?.length) return []

  return session.series.map((serie) => ({
    serie: serie.serie,
    std: serie.std,
  }))
}

function buildRhythmComparison(sessions) {
  return (sessions || []).map((session) => ({
    event: session.evento,
    session: session.sessao,
    discipline: session.prova,
    date: session.data,
    total: session.total,
    media: session.media,
    std: session.std,
    seriesCount: session.seriesCount,
  }))
}

function normalizeReadingCode(parameter) {
  const map = {
    OUTCOME: 'OUTCOME_COMPETITIVE_OUTPUT',
    PROCESS: 'PROCESS_ACCEPTABLE_SHOTS',
    RHYTHM: 'RHYTHM_TEMPORAL_STABILITY',
    DEEPENING: 'DEEPENING_MAX_DEEP_SHOT_SEQUENCE',
    CONSISTENCY: 'CONSISTENCY_SERIES_TOTAL_REPEATABILITY',
    TRANSFER: 'TRANSFER_COMPETITIVE_ENVIRONMENT',
    RESILIENCE: 'RESILIENCE_RECOVERY_AFTER_LOW_SHOTS',
    PRESSURE: 'PRESSURE_RHYTHM_AND_BREAK_LOAD',
    EMOTIONAL: 'EMOTIONAL_RECURRENT_DROPS',
    PHYSICAL: 'PHYSICAL_DEGRADATION_BETWEEN_HALVES',
  }

  return map[parameter] || 'UNKNOWN_READING'
}

function normalizeParameter(parameter) {
  return String(parameter || '').toUpperCase()
}

function normalizeParameterItem(item) {
  const parameterCode = normalizeParameter(item.parameter)

  return {
    displayOrder: item.displayOrder,
    parameterCode,
    score: roundNumber(item.score),
    levelCode: normalizeLevelCode(item.level),
    readingCode: normalizeReadingCode(parameterCode),
    reportProfileCode: normalizeParameter(item.reportProfile),
  }
}

function buildRenderableSessions(snapshot, athleteName) {
  const canonicalSessions = buildRenderableSessionsFromCanonical(snapshot, athleteName)

  if (canonicalSessions.length > 0) {
    return canonicalSessions
  }

  const athlete360 = (snapshot?.athlete360 || []).find((item) => item.athlete === athleteName)
  return athlete360?.sessions || []
}

function buildRenderableSessionsFromCanonical(snapshot, athleteName) {
  const headers = (snapshot?.sessionHeaders || [])
    .filter((item) => item.athleteName === athleteName && item.sessionStatus === 'APPROVED')
    .sort((a, b) => {
      const aTime = Number(a.sessionDate || 0) || Number(a.createdAt || 0)
      const bTime = Number(b.sessionDate || 0) || Number(b.createdAt || 0)
      return bTime - aTime
    })

  return headers
    .map((header) => {
      const series = buildRenderableSeriesList(snapshot, header.sessionId)

      if (series.length === 0) {
        return null
      }

      const total = roundNumber(series.reduce((sum, item) => sum + Number(item.total || 0), 0))
      const shotScores = series.flatMap((item) => item.shots || [])

      return {
        evento: header.eventCode || '',
        sessao: denormalizeSessionType(header.sessionType),
        prova: header.modality || '',
        data: header.sessionDate || header.createdAt || '',
        total,
        media: roundNumber(calculateMedian(shotScores)),
        std: roundNumber(calculateStdFromMedian(shotScores)),
        seriesCount: series.length,
        series,
        rhythmPath: buildRhythmPath(series),
      }
    })
    .filter(Boolean)
}

function buildRenderableSeriesList(snapshot, sessionId) {
  const orderedSeries = (snapshot?.sessionSeries || [])
    .filter((item) => item.sessionId === sessionId)
    .sort((a, b) => Number(a.seriesOrder || 0) - Number(b.seriesOrder || 0))

  const result = []
  let previousMedian = null

  orderedSeries.forEach((serie) => {
    const shots = resolveSeriesShots(snapshot, serie)

    if (!shots.length) {
      return
    }

    const currentMedian = calculateMedian(shots)
    const drop =
      previousMedian !== null && previousMedian > currentMedian
        ? previousMedian - currentMedian
        : 0

    result.push({
      serie: serie.seriesCode,
      media: roundNumber(currentMedian),
      std: roundNumber(calculateStdFromMedian(shots)),
      total: roundNumber(shots.reduce((sum, value) => sum + value, 0)),
      mainDropDepth: roundNumber(drop),
      breakCount: drop > 0 ? 1 : 0,
      shots,
    })

    previousMedian = currentMedian
  })

  return result
}

function resolveSeriesShots(snapshot, serie) {
  const shots = (snapshot?.sessionShots || [])
    .filter((item) => item.seriesId === serie.seriesId)
    .sort((a, b) => Number(a.shotNumber || 0) - Number(b.shotNumber || 0))
    .map((item) => Number(item.score))
    .filter((value) => !Number.isNaN(value))

  if (shots.length > 0) {
    return shots
  }

  return String(serie.shotValuesCsv || '')
    .split(',')
    .map((value) => Number(String(value).trim()))
    .filter((value) => !Number.isNaN(value))
}

function buildRhythmPath(series) {
  return series.flatMap((serie) => {
    const chunks = [
      serie.shots.slice(0, 3),
      serie.shots.slice(3, 7),
      serie.shots.slice(7, 10),
    ]

    return chunks.map((chunk, index) => ({
      label: `${serie.serie}_P${index + 1}`,
      val: roundNumber(calculateMedian(chunk)),
    }))
  })
}

function roundNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null
  return Math.round(Number(value) * 100) / 100
}

function calculateMedian(values) {
  const clean = (values || [])
    .map((value) => Number(value))
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => a - b)

  if (!clean.length) return 0

  const middle = Math.floor(clean.length / 2)
  return clean.length % 2
    ? clean[middle]
    : (clean[middle - 1] + clean[middle]) / 2
}

function calculateStdFromMedian(values) {
  const clean = (values || [])
    .map((value) => Number(value))
    .filter((value) => !Number.isNaN(value))

  if (clean.length < 2) return 0

  const baseline = calculateMedian(clean)
  const variance =
    clean.reduce((sum, value) => sum + (value - baseline) ** 2, 0) / clean.length

  return Math.sqrt(variance)
}

function calculateMedianTotal(sessions) {
  const totals = (sessions || [])
    .map((item) => Number(item.total))
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => a - b)

  if (!totals.length) return null

  const middle = Math.floor(totals.length / 2)
  return totals.length % 2
    ? totals[middle]
    : roundNumber((totals[middle - 1] + totals[middle]) / 2)
}

function denormalizeSessionType(value) {
  const normalizedValue = String(value || '').trim().toUpperCase()
  if (normalizedValue === 'TRAINING') return 'TREINO'
  if (normalizedValue === 'SIMULATION') return 'SIMULADO'
  if (normalizedValue === 'COMPETITION') return 'COMPETICAO'
  return normalizedValue || 'TREINO'
}
