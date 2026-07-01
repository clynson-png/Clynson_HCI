import { getTrainingLibraryEntries } from './trainingLibraryService'
import { analyzeTaurusHumanoidSession } from './taurusHumanoidIntelligence'
import { analyzeTaurusColorSession } from './taurusColorIntelligence'
import { analyzeTaurusDuelSession } from './taurusDuelIntelligence'
import { TAURUS_PARAMETERS, normalizeTaurusParameter } from './taurusDecisionEngines'

const HUMANOID_LIBRARY_RULE = {
  targetType: 'DEFENSE_HUMANOID',
  trainingType: 'TARGET_BASIC',
  weaponClass: 'HUMANOID_BASIC',
  phase: 'GENERAL_PREPARATION',
  category: 'HUMANOID',
}

const COLOR_LIBRARY_RULE = {
  targetType: 'PRECISION_COLOR',
  trainingType: 'TARGET_BASIC',
  weaponClass: 'COLOR_CARD_BASIC',
  phase: 'GENERAL_PREPARATION',
  category: 'COLOR_CARD',
}

const DUEL_LIBRARY_RULE = {
  targetType: 'DUEL_20',
  trainingType: 'TECHNICAL',
  weaponClass: 'PISTOL',
  phase: 'SPECIFIC_PREPARATION',
  category: 'DUEL_20',
}

export function buildTaurusSmartChartModel({
  sessions = [],
  athleteName = '',
  targetType = 'HUMANOID',
  athleteView = null,
}) {
  const approvedSessions = sessions
    .filter((session) => session.workflowStatus === 'APPROVED')
    .filter((session) => session.targetType === targetType)
    .sort((a, b) => Number(a.recordedAt || 0) - Number(b.recordedAt || 0))

  const latestSession = approvedSessions[approvedSessions.length - 1] || null
  const history = attachLogarithmicTimePrediction(
    approvedSessions.map((session, index) =>
      buildTaurusHistoryRow(session, approvedSessions[index - 1])
    )
  )

  const latest = history[history.length - 1] || null
  const best = history.reduce(
    (currentBest, item) =>
      !currentBest || item.indexValue > currentBest.indexValue ? item : currentBest,
    null
  )

  const trainingParameter = getTargetTrainingParameter(targetType, latestSession) || latest?.biggestOpportunity || 'TARGET_AIMING'
  const trainingLibrary = getTaurusTrainingLibraryForTarget(
    targetType,
    trainingParameter
  )
  const libraryTargetType = getLibraryTargetType(targetType)

  const mainTraining = selectTaurusTrainingRecommendation(trainingLibrary, {
    targetType: libraryTargetType,
    trainingParameter,
  })
  const consistency = calculateConsistency(history)

  const latestSessionReport = buildLatestSessionReport(targetType, latestSession)
  const duel20ChartData = targetType === 'DUEL20' ? buildDuel20ChartData(approvedSessions) : null
  const trainingLevel = classifyTaurusTrainingLevel({
    latest,
    history,
    consistency,
  })

  return {
    athleteName,
    targetType,
    sessions: approvedSessions,
    timeline: history.map((item) => ({
      date: item.date,
      indexValue: item.indexValue,
      durationSeconds: item.durationSeconds,
      predictedDurationSeconds: item.predictedDurationSeconds,
    })),
    summary: {
      latestDate: latest?.date || null,
      currentIndex: latest?.indexValue ?? null,
      bestIndex: best?.indexValue ?? null,
      bestDate: best?.date || null,
      trend: calculateTrendV2(history),
      consistency,
      trainingLevel,
      sessionsCount: history.length,
    },
    latestIndicators: latest,
    coachCues: buildCoachCues(latest, targetType),
    mainTrainingRecommendation: mainTraining,
    latestSessionReport,
    history,
    duel20ChartData,
  }
}

function getTaurusTrainingLibraryForTarget(targetType, opportunity) {
  const entries = getTrainingLibraryEntries()

  if (targetType === 'HUMANOID') {
    const humanoidEntries = entries.filter(isHumanoidTraining)
    const opportunityEntries = humanoidEntries.filter(
      (entry) => !opportunity || entry.parameter === opportunity
    )

    return opportunityEntries.length > 0 ? opportunityEntries : humanoidEntries
  }

  if (targetType === 'COLOR') {
    const colorEntries = entries.filter(isColorCardTraining)
    const opportunityEntries = colorEntries.filter(
      (entry) => !opportunity || entry.parameter === opportunity
    )

    return opportunityEntries.length > 0 ? opportunityEntries : colorEntries
  }

  if (targetType === 'DUEL20') {
    const duelEntries = entries.filter(isDuelTraining)
    const opportunityEntries = duelEntries.filter(
      (entry) => !opportunity || entry.parameter === opportunity
    )

    return opportunityEntries.length > 0 ? opportunityEntries : duelEntries
  }

  return entries
}

function getTargetTrainingParameter(targetType, latestSession) {
  if (!latestSession) return null

  if (targetType === 'HUMANOID') {
    const report = analyzeTaurusHumanoidSession(latestSession, 'pt-BR')
    return report.parameter || latestSession.biggestOpportunity || TAURUS_PARAMETERS.HUMANOID.AIMING
  }

  if (targetType === 'COLOR') {
    const report = analyzeTaurusColorSession(latestSession, 'pt-BR')
    return report.parameter || TAURUS_PARAMETERS.COLOR.COLOR_IDENTIFICATION
  }

  if (targetType === 'DUEL20') {
    const report = analyzeTaurusDuelSession(latestSession, 'pt-BR')
    return report.parameter || TAURUS_PARAMETERS.DUEL20.DIRECTIONAL_CONTROL
  }

  return null
}

export function classifyTaurusTrainingLevel({ latest = null, history = [], consistency = null } = {}) {
  const currentIndex = Number(latest?.indexValue ?? 0)
  const sessionsCount = history.length
  const consistencyLevel = consistency?.level || 'INSUFFICIENT_DATA'

  const hasEliteEfficiency = currentIndex >= 80
  const hasReliableHistory = sessionsCount >= 3
  const hasEliteConsistency = ['VERY_CONSISTENT', 'CONSISTENT'].includes(consistencyLevel)

  if (hasEliteEfficiency && hasReliableHistory && hasEliteConsistency) {
    return {
      code: 'ELITE',
      label: 'Elite',
      reason: 'High efficiency and stable history.',
      beginnerSafetyCues: false,
    }
  }

  return {
    code: 'BEGINNER',
    label: 'Beginner',
    reason: 'Basic technique, safety and fundamentals.',
    beginnerSafetyCues: true,
  }
}

function selectTaurusTrainingRecommendation(trainingLibrary, { targetType, trainingParameter }) {
  const taurusTargetType = getTaurusTargetTypeFromLibraryTarget(targetType)
  const normalizedParameter = normalizeTaurusParameter(trainingParameter, taurusTargetType)
  return trainingLibrary.find((training) => {
    const sameTarget = !targetType || training?.targetType === targetType
    const sameParameter =
      !normalizedParameter ||
      normalizeTaurusParameter(training?.parameter, taurusTargetType) === normalizedParameter
    return sameTarget && sameParameter
  }) || trainingLibrary[0] || null
}

function getTaurusTargetTypeFromLibraryTarget(targetType) {
  if (targetType === 'DEFENSE_HUMANOID') return 'HUMANOID'
  if (targetType === 'PRECISION_COLOR') return 'COLOR'
  if (targetType === 'DUEL_20') return 'DUEL20'
  return targetType
}

function getLibraryTargetType(targetType) {
  if (targetType === 'HUMANOID') return 'DEFENSE_HUMANOID'
  if (targetType === 'COLOR') return 'PRECISION_COLOR'
  if (targetType === 'DUEL20') return 'DUEL_20'
  return targetType
}

function buildLatestSessionReport(targetType, latestSession) {
  if (!latestSession) return null

  if (targetType === 'HUMANOID') {
    return analyzeTaurusHumanoidSession(latestSession, 'pt-BR')
  }

  if (targetType === 'COLOR') {
    return analyzeTaurusColorSession(latestSession, 'pt-BR')
  }

  if (targetType === 'DUEL20') {
    return analyzeTaurusDuelSession(latestSession, 'pt-BR')
  }

  return null
}

function isHumanoidTraining(entry) {
  return (
    entry?.active === true &&
    entry?.category === HUMANOID_LIBRARY_RULE.category &&
    entry?.targetType === HUMANOID_LIBRARY_RULE.targetType &&
    entry?.trainingType === HUMANOID_LIBRARY_RULE.trainingType &&
    entry?.weaponClass === HUMANOID_LIBRARY_RULE.weaponClass &&
    entry?.phase === HUMANOID_LIBRARY_RULE.phase
  )
}

function isColorCardTraining(entry) {
  return (
    entry?.active === true &&
    entry?.category === COLOR_LIBRARY_RULE.category &&
    entry?.targetType === COLOR_LIBRARY_RULE.targetType &&
    entry?.trainingType === COLOR_LIBRARY_RULE.trainingType &&
    entry?.weaponClass === COLOR_LIBRARY_RULE.weaponClass &&
    entry?.phase === COLOR_LIBRARY_RULE.phase
  )
}

function isDuelTraining(entry) {
  return (
    entry?.active === true &&
    entry?.category === DUEL_LIBRARY_RULE.category &&
    entry?.targetType === DUEL_LIBRARY_RULE.targetType &&
    entry?.trainingType === DUEL_LIBRARY_RULE.trainingType &&
    entry?.weaponClass === DUEL_LIBRARY_RULE.weaponClass &&
    entry?.phase === DUEL_LIBRARY_RULE.phase
  )
}

function buildTaurusHistoryRow(session, previousSession) {
  const indexValue = calculateSessionIndex(session)
  const previousIndex = previousSession ? calculateSessionIndex(previousSession) : null
  const durationSeconds = normalizeDurationSeconds(session.durationSeconds)

  return {
    sessionId: session.sessionId,
    date: formatDate(session.recordedAt),
    targetType: session.targetType,
    totalShots: session.totalShots || 0,
    durationSeconds,
    totalScore: session.totalScore ?? null,
    maxScore: session.maxScore ?? null,
    indexValue,
    alphaPercent: calculateZonePercent(session, ['ALPHA_HEAD', 'ALPHA_TORSO']),
    intermediatePercent: calculateZonePercent(session, ['CHARLIE_LEFT', 'CHARLIE_CENTER', 'CHARLIE_RIGHT']),
    peripheralPercent: calculateZonePercent(session, ['DELTA_LEFT', 'DELTA_RIGHT', 'DELTA_LOWER']),
    dominantZone: getDominantZone(session),
    biggestOpportunity: getBiggestOpportunity(session),
    trend: getTrend(indexValue, previousIndex),
  }
}

function attachLogarithmicTimePrediction(history) {
  const timedRows = history
    .map((row, index) => ({ ...row, sequence: index + 1 }))
    .filter((row) => row.durationSeconds !== null)

  if (timedRows.length < 2) {
    return history.map((row) => ({
      ...row,
      predictedDurationSeconds: row.durationSeconds,
    }))
  }

  const n = timedRows.length
  const sumX = timedRows.reduce((sum, row) => sum + Math.log(row.sequence), 0)
  const sumY = timedRows.reduce((sum, row) => sum + row.durationSeconds, 0)
  const sumXX = timedRows.reduce((sum, row) => sum + Math.log(row.sequence) ** 2, 0)
  const sumXY = timedRows.reduce(
    (sum, row) => sum + Math.log(row.sequence) * row.durationSeconds,
    0
  )
  const denominator = n * sumXX - sumX ** 2
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  return history.map((row, index) => {
    const predicted = intercept + slope * Math.log(index + 1)
    return {
      ...row,
      predictedDurationSeconds: Number.isFinite(predicted)
        ? Math.max(0, Math.round(predicted * 10) / 10)
        : row.durationSeconds,
    }
  })
}

function normalizeDurationSeconds(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null
}

function calculateSessionIndex(session) {
  if (session.targetType === 'DUEL20') {
    const totalScore = Number(session.totalScore || 0)
    const maxScore = Number(session.maxScore || 0)
    return maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0
  }

  if (session.targetType === 'COLOR') {
    const hits = session.hits || []
    const values = hits.map((hit) => Number(hit.hitCount || 0))
    const total = values.reduce((sum, value) => sum + value, 0)

    if (!total || values.length === 0) return 0

    const average = total / values.length
    const deviation = values.reduce((sum, value) => sum + Math.abs(value - average), 0) / values.length
    const balance = Math.max(0, 1 - deviation / Math.max(average, 1))

    return Math.round(balance * 100)
  }

  const alpha = getZoneCount(session, ['ALPHA_HEAD', 'ALPHA_TORSO'])
  const intermediate = getZoneCount(session, ['CHARLIE_LEFT', 'CHARLIE_CENTER', 'CHARLIE_RIGHT'])
  const peripheral = getZoneCount(session, ['DELTA_LEFT', 'DELTA_RIGHT', 'DELTA_LOWER'])
  const total = alpha + intermediate + peripheral

  if (!total) return 0

  return Math.round(((alpha * 1 + intermediate * 0.55 + peripheral * 0.2) / total) * 100)
}

function calculateZonePercent(session, zoneCodes) {
  const total = Number(session.totalShots || 0)
  if (!total) return 0

  return Math.round((getZoneCount(session, zoneCodes) / total) * 100)
}

function getZoneCount(session, zoneCodes) {
  return (session.hits || [])
    .filter((hit) => zoneCodes.includes(hit.zoneCode))
    .reduce((sum, hit) => sum + Number(hit.hitCount || 0), 0)
}

function getDominantZone(session) {
  const sortedHits = [...(session.hits || [])].sort(
    (a, b) => Number(b.hitCount || 0) - Number(a.hitCount || 0)
  )

  return sortedHits[0]?.zoneLabel || '-'
}

function getBiggestOpportunity(session) {
  if (session.targetType === 'COLOR') return 'TARGET_COLOR_IDENTIFICATION'
  if (session.targetType === 'DUEL20') return 'TARGET_TRIGGERING'

  const peripheral = getZoneCount(session, ['DELTA_LEFT', 'DELTA_RIGHT', 'DELTA_LOWER'])
  const intermediate = getZoneCount(session, ['CHARLIE_LEFT', 'CHARLIE_CENTER', 'CHARLIE_RIGHT'])

  if (peripheral > 0) return 'TARGET_AIMING'
  if (intermediate > 0) return 'TARGET_TRIGGERING'

  return 'TARGET_POSITION'
}

function getTrend(current, previous) {
  if (previous === null || previous === undefined) return 'INSUFFICIENT_DATA'
  if (current > previous + 2) return 'IMPROVING'
  if (current < previous - 2) return 'DECLINING'
  return 'STABLE'
}

function buildCoachCues(latest, targetType) {
  if (!latest) {
    return ['Sem histórico aprovado suficiente para gerar leitura consolidada.']
  }

  if (targetType === 'HUMANOID') {
    return [
      `Índice atual em ${latest.indexValue}%.`,
      `Zona dominante: ${latest.dominantZone}.`,
      `Maior oportunidade: ${latest.biggestOpportunity}.`,
    ]
  }

  if (targetType === 'COLOR') {
    return [
      `Equilíbrio atual em ${latest.indexValue}%.`,
      'Observar reconhecimento visual, transição e execução sob tempo.',
    ]
  }

  return [
    `Pontuação relativa atual em ${latest.indexValue}%.`,
    'Observar direção crítica e consistência de execução entre séries.',
  ]
}

function calculateTrendV2(history, windowSize = 5) {
  const validRows = history
    .filter((row) => Number.isFinite(Number(row.indexValue)))
    .slice(-windowSize)

  if (validRows.length < 3) return 'INSUFFICIENT_DATA'

  const first = validRows[0].indexValue
  const last = validRows[validRows.length - 1].indexValue
  const delta = last - first

  const improvingSteps = validRows.filter((row, index) => {
    if (index === 0) return false
    return row.indexValue > validRows[index - 1].indexValue
  }).length

  const decliningSteps = validRows.filter((row, index) => {
    if (index === 0) return false
    return row.indexValue < validRows[index - 1].indexValue
  }).length

  if (delta >= 5 && improvingSteps >= decliningSteps) {
    return 'CONSISTENT_IMPROVEMENT'
  }

  if (delta <= -5 && decliningSteps >= improvingSteps) {
    return 'CONSISTENT_DECLINE'
  }

  if (Math.abs(delta) <= 3) {
    return 'STABLE_PATTERN'
  }

  if (last > first) return 'SLIGHT_IMPROVEMENT'
  if (last < first) return 'SLIGHT_DECLINE'

  return 'STABLE_PATTERN'
}

function calculateConsistency(history, windowSize = 5) {
  const rows = history
    .filter((row) => Number.isFinite(Number(row.indexValue)))
    .slice(-windowSize)

  if (rows.length < 3) {
    return {
      level: 'INSUFFICIENT_DATA',
      cv: null,
      mean: null,
      stdDev: null,
    }
  }

  const values = rows.map((row) => row.indexValue)

  const mean =
    values.reduce((sum, value) => sum + value, 0) / values.length

  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length

  const stdDev = Math.sqrt(variance)

  const cv = mean === 0 ? 0 : (stdDev / mean) * 100

  let level

  if (cv < 2) level = 'VERY_CONSISTENT'
  else if (cv < 5) level = 'CONSISTENT'
  else if (cv < 8) level = 'OSCILLATING'
  else level = 'UNSTABLE'

  return {
    level,
    cv: Number(cv.toFixed(1)),
    mean: Number(mean.toFixed(1)),
    stdDev: Number(stdDev.toFixed(1)),
  }
}

function buildDuel20ChartData(sessions = []) {
  const relevantSessions = [...sessions].filter((session) => session?.targetType === 'DUEL20').slice(-4)
  const seriesCodes = ['SR1', 'SR2', 'SR3', 'SR4']
  const seriesScores = seriesCodes.map(() => [])
  const seriesTimes = seriesCodes.map(() => [])
  const totalScores = []

  relevantSessions.forEach((session) => {
    const seriesProfile = buildDuel20SeriesProfile(session)
    totalScores.push(Number(session.totalScore || 0))

    seriesCodes.forEach((seriesCode, index) => {
      const profile = seriesProfile[seriesCode] || {}
      const score = Number(profile.totalScore || 0)
      const time = Number(profile.timeSeconds || 0)

      if (Number.isFinite(score)) {
        seriesScores[index].push(score)
      }

      if (Number.isFinite(time) && time > 0) {
        seriesTimes[index].push(time)
      }
    })
  })

  const medianScoreBySeries = seriesScores.map((values) => calculateMedian(values))
  const medianStdTimeBySeries = seriesTimes.map((values) => calculateMedian(values))
  const totalScoreMedian = calculateMedian(totalScores)

  return {
    sessions: relevantSessions.map((session) => ({
      sessionId: session.sessionId || null,
      date: formatDate(session.recordedAt),
      totalScore: Number(session.totalScore || 0),
    })),
    seriesCodes,
    points: seriesCodes.map((seriesCode, index) => ({
      seriesCode,
      score: medianScoreBySeries[index],
      time: medianStdTimeBySeries[index],
      predictedScore: buildLogarithmicPredictionSeries(medianScoreBySeries)[index],
      predictedTime: buildLogarithmicPredictionSeries(medianStdTimeBySeries)[index],
    })),
    medianScoreBySeries,
    medianStdTimeBySeries,
    totalScoreMedian,
    predictedMedianStdTime: buildLogarithmicPredictionSeries(medianStdTimeBySeries),
    predictedTotalScoreMedian: buildLogarithmicPredictionSeries(medianScoreBySeries),
  }
}

function buildDuel20SeriesProfile(session) {
  const shotDetails = parseDuelShotDetails(session?.shotDetailsJson)
  const seriesProfile = {}

  shotDetails.forEach((shot) => {
    const seriesCode = normalizeDuelSeriesCode(shot)
    if (!seriesCode) return

    const current = seriesProfile[seriesCode] || {
      totalScore: 0,
      timeSeconds: null,
    }

    current.totalScore += parseDuelScoreValue(shot.score, session?.sessionMode || '25M')

    const timeValue = Number(shot.seriesTimeSeconds ?? shot.timeSeconds ?? shot.time ?? 0)
    if (Number.isFinite(timeValue) && timeValue > 0) {
      current.timeSeconds = current.timeSeconds === null ? timeValue : current.timeSeconds
    }

    seriesProfile[seriesCode] = current
  })

  return seriesProfile
}

function normalizeDuelSeriesCode(shot) {
  const direct = [shot?.seriesCode, shot?.serie, shot?.seriesCodeLabel, shot?.seriesLabel, shot?.series]
    .find((value) => typeof value === 'string' && value.trim())

  if (direct) return String(direct).trim().toUpperCase()

  const shotNumber = Number(shot?.shotNumber || 0)
  if (shotNumber > 0) {
    return `SR${Math.floor((shotNumber - 1) / 5) + 1}`
  }

  return null
}

function parseDuelShotDetails(shotDetailsJson) {
  try {
    const parsed = JSON.parse(shotDetailsJson || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseDuelScoreValue(score, duelMode = '25M') {
  const normalized = String(score || '').trim().toUpperCase()
  if (!normalized) return 0
  if (normalized === 'X') return duelMode === '10M' ? 12 : 10
  const numeric = Number(normalized)
  return Number.isNaN(numeric) ? 0 : numeric
}

function calculateMedian(values) {
  const numericValues = [...values]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0)

  if (!numericValues.length) return 0

  const sortedValues = [...numericValues].sort((left, right) => left - right)
  const middleIndex = Math.floor(sortedValues.length / 2)

  if (sortedValues.length % 2 === 0) {
    return (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2
  }

  return sortedValues[middleIndex]
}

function buildLogarithmicPredictionSeries(values) {
  const numericValues = [...values]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))

  if (numericValues.length < 2) {
    return numericValues.length ? numericValues : [0, 0, 0, 0]
  }

  const xValues = numericValues.map((_, index) => index + 1)
  const n = numericValues.length
  const sumX = xValues.reduce((sum, value) => sum + Math.log(value), 0)
  const sumY = numericValues.reduce((sum, value) => sum + value, 0)
  const sumXX = xValues.reduce((sum, value) => sum + Math.log(value) ** 2, 0)
  const sumXY = xValues.reduce((sum, value, index) => sum + Math.log(value) * numericValues[index], 0)
  const denominator = n * sumXX - sumX ** 2
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  return xValues.map((value) => Math.max(0, intercept + slope * Math.log(value)))
}

function formatDate(value) {
  if (!value) return '-'

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR')
}


