import { athleteNamesMatch, buildAthleteLookupKey } from './athleteIdentity'

export function materializeSnapshotDerivedMetrics(snapshot) {
  const athleteNames = resolveAthleteNames(snapshot)
  const athletes = athleteNames
    .map((athleteName) => buildCanonicalIndicesFromSnapshot(snapshot, athleteName))
    .filter(Boolean)

  return {
    athleteMetricsCurrent: athletes.map((item) => ({
      athleteName: item.athleteName,
      discipline: item.discipline,
      overallHci: item.overallHci,
      level: item.level,
      latestTotal: item.latestTotal,
      medianTotal: item.medianTotal,
      sessionsCount: item.sessionsCount,
    })),
    athleteIndicesCurrent: athletes.map((item) => ({
      athleteName: item.athleteName,
      updatedAt: Date.now(),
      parameters: item.parameters,
    })),
    athleteMetricsByName: Object.fromEntries(
      athletes.map((item) => [item.athleteName, item])
    ),
  }
}

export function buildCanonicalIndicesFromSnapshot(snapshot, athleteName) {
  const sessions = buildRenderableSessionsFromCanonical(snapshot, athleteName)
  return buildCanonicalIndicesFromSessions(sessions, athleteName)
}

export function buildCanonicalIndicesFromSessions(sessions, athleteName) {
  if (!sessions?.length) return null

  const latestSession = sessions[0]
  if (!latestSession?.series?.length) return null

  const athleteSessions = sessions.filter((session) => session?.series?.length)
  const latestRows = latestSession.series.map((serie) => ({
    serie: serie.serie,
    tiros: serie.shots || [],
    prova: latestSession.prova,
    statusEvento: 'QUALIFICATION',
  }))

  const athleteRows = athleteSessions.flatMap((session) =>
    (session.series || []).map((serie) => ({
      atleta: athleteName,
      evento: session.evento,
      sessao: session.sessao,
      serie: serie.serie,
      tiros: serie.shots || [],
      prova: session.prova,
      statusEvento: 'QUALIFICATION',
    }))
  )

  const scores = calculateCanonicalHciScores(latestRows, athleteRows)
  const parameters = buildCanonicalParameters(scores)

  return {
    athleteName,
    discipline: latestSession.prova || '',
    overallHci: scores.overall,
    level: scoreLevel(scores.overall),
    latestTotal: latestSession.total,
    medianTotal: calculateMedianTotal(athleteSessions),
    sessionsCount: athleteSessions.length,
    parameters,
  }
}

function resolveAthleteNames(snapshot) {
  const athleteMap = new Map()

  ;[
    ...((snapshot?.leads || []).map((item) => item.athleteName).filter(Boolean)),
    ...((snapshot?.athlete360 || []).map((item) => item.athlete).filter(Boolean)),
    ...((snapshot?.sessionHeaders || []).map((item) => item.athleteName).filter(Boolean)),
  ].forEach((athleteName) => {
    const lookupKey = buildAthleteLookupKey(athleteName)
    if (!lookupKey || athleteMap.has(lookupKey)) return
    athleteMap.set(lookupKey, athleteName)
  })

  return Array.from(athleteMap.values())
}

function buildRenderableSessionsFromCanonical(snapshot, athleteName) {
  const headers = (snapshot?.sessionHeaders || [])
    .filter((item) => athleteNamesMatch(item.athleteName, athleteName) && item.sessionStatus === 'APPROVED')
    .sort((a, b) => {
      const aTime = Number(a.sessionDate || 0) || Number(a.createdAt || 0)
      const bTime = Number(b.sessionDate || 0) || Number(b.createdAt || 0)
      return bTime - aTime
    })

  return headers
    .map((header) => {
      const series = buildRenderableSeriesList(snapshot, header.sessionId)
      if (!series.length) return null

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
    if (!shots.length) return

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

  if (shots.length) return shots

  return String(serie.shotValuesCsv || '')
    .split(',')
    .map((value) => Number(String(value).trim()))
    .filter((value) => !Number.isNaN(value))
}

function calculateCanonicalHciScores(rows, athleteRows) {
  const sortedRows = [...rows].sort((a, b) => seriesOrder(a.serie) - seriesOrder(b.serie))
  const allShots = sortedRows.flatMap((row) => splitNumbers(row.tiros))
  const seriesTotals = sortedRows.map((row) =>
    splitNumbers(row.tiros).reduce((sum, value) => sum + value, 0)
  )
  const prova = sortedRows[0]?.prova || 'PISTOL'
  const isRifle =
    String(prova).toUpperCase().includes('RIFLE') ||
    String(prova).toUpperCase().includes('CARABINA')

  const seq910 = sequenceStats(allShots, (shot) => shot >= 9.0)
  const seq10 = sequenceStats(allShots, (shot) => shot >= 10.0)
  const processScore = limit010(((seq910.maxLen * Math.min(seq910.count, 2)) / 60.0) * 10.0)
  const deepeningScore = limit010((seq10.maxLen / 7.0) * 10.0)
  const amplitude = seriesTotals.length ? Math.max(...seriesTotals) - Math.min(...seriesTotals) : 0
  const consistencyScore = limit010(10.0 - amplitude * 0.7)

  const rhythmStd = calculateStdFromMedian(allShots)
  const rhythmBaseline = calculateMedian(allShots)
  const dropCount = allShots.filter((shot) => shot < rhythmBaseline - 1.5).length
  const rhythmScore = limit010(rhythmScoreFromStd(rhythmStd))
  const totalEvento = roundNumber(seriesTotals.reduce((sum, value) => sum + Number(value || 0), 0))
  const outcomeReference = isRifle ? 632.0 : 578.0

  const athleteComp = athleteRows.filter((row) =>
    String(row.sessao || '').toUpperCase().includes('COMPET')
  )
  const athleteSim = athleteRows.filter((row) =>
    String(row.sessao || '').toUpperCase().includes('SIMULADO')
  )
  const athleteTraining = athleteRows.filter((row) =>
    String(row.sessao || '').toUpperCase().includes('TREINO')
  )

  const medCompeticoes = athleteComp.length ? calculateMedian(groupedEventTotals(athleteComp)) : null
  const medSimulados = athleteSim.length ? calculateMedian(groupedEventTotals(athleteSim)) : null
  const medTiroSimTreino = allShots.length ? calculateMedian(allShots) : isRifle ? 10.0 : 9.0
  const pressureLoadReferencia = calculateMedian(
    groupedEventPressureLoads([...athleteSim, ...athleteTraining])
  )

  const outcomeScore =
    medCompeticoes !== null
      ? limit010(((medCompeticoes / outcomeReference) * 10.0 - 9.0) * 10.0)
      : limit010(((totalEvento / outcomeReference) * 10.0 - 9.0) * 10.0)
  const transferScore =
    medSimulados && medSimulados > 0
      ? limit010((totalEvento / medSimulados) * 10.0)
      : 0.0
  const resilienceScore = calculateResilience(seriesTotals)
  const pressureLoadEvento = rhythmStd + dropCount * 0.1
  const pressureScore =
    pressureLoadReferencia > 0
      ? pressureLoadEvento <= pressureLoadReferencia
        ? limit010(7.0 + Math.abs(pressureLoadEvento - pressureLoadReferencia) * 3.0)
        : limit010(7.0 - (pressureLoadEvento - pressureLoadReferencia) * 3.0)
      : 7.0
  const emotionalScore = calculateEmotionalScore(allShots, medTiroSimTreino, isRifle)
  const physicalScore = limit010(10.0 - calculatePhysicalDegradation(allShots))

  const overall = roundNumber(
    outcomeScore * 0.4 +
      processScore * 0.1 +
      rhythmScore * 0.1 +
      deepeningScore * 0.05 +
      consistencyScore * 0.1 +
      transferScore * 0.05 +
      resilienceScore * 0.05 +
      pressureScore * 0.05 +
      physicalScore * 0.05 +
      (emotionalScore / 10.0) * 0.05
  )

  const scoreValues = {
    OUTCOME: outcomeScore,
    PROCESS: processScore,
    RHYTHM: rhythmScore,
    DEEPENING: deepeningScore,
    CONSISTENCY: consistencyScore,
    TRANSFER: transferScore,
    RESILIENCE: resilienceScore,
    PRESSURE: pressureScore,
    EMOTIONAL: emotionalScore,
    PHYSICAL: physicalScore,
  }

  const levels = Object.fromEntries(
    Object.entries(scoreValues).map(([parameter, value]) => [
      parameter,
      hciLevelForParameter(parameter, value, parameter === 'RHYTHM' ? rhythmStd : null),
    ])
  )

  return {
    ...scoreValues,
    overall,
    rhythmStd,
    levels,
  }
}

function buildCanonicalParameters(scores) {
  const targetOrder = ['OUTCOME', 'PROCESS', 'RHYTHM', 'DEEPENING', 'CONSISTENCY']
  const structureOrder = ['TRANSFER', 'RESILIENCE', 'PRESSURE', 'EMOTIONAL', 'PHYSICAL']
  const readings = {
    OUTCOME: 'Entrega competitiva na regua OUTPUT.',
    PROCESS: 'Continuidade de tiros aceitaveis.',
    RHYTHM: 'Estabilidade temporal entre series; score convertido do STD para base 10.',
    DEEPENING: 'Sequencia maxima de tiros profundos.',
    CONSISTENCY: 'Repetibilidade dos totais por serie.',
    TRANSFER: 'Transferencia para ambiente competitivo.',
    RESILIENCE: 'Recuperacao depois de tiros abaixo do padrao.',
    PRESSURE: 'Carga de pressao combinando ritmo e quebras.',
    EMOTIONAL: 'Controle emocional inferido por quedas recorrentes.',
    PHYSICAL: 'Degradacao fisica entre metades da prova.',
  }

  return [...targetOrder, ...structureOrder].map((name, index) => ({
    displayOrder: index + 1,
    parameter: name,
    score: roundNumber(scores[name]),
    level: scores.levels?.[name] || hciLevelForParameter(name, scores[name], name === 'RHYTHM' ? scores.rhythmStd : null),
    reading: readings[name],
    reportProfile: targetOrder.includes(name) ? 'TARGETS' : 'STRUCTURE',
  }))
}

function calculateMedianTotal(sessions) {
  const totals = (sessions || [])
    .map((item) => Number(item.total))
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => a - b)

  if (!totals.length) return null

  const middle = Math.floor(totals.length / 2)
  return totals.length % 2 ? totals[middle] : roundNumber((totals[middle - 1] + totals[middle]) / 2)
}

function denormalizeSessionType(value) {
  const normalizedValue = String(value || '').trim().toUpperCase()
  if (normalizedValue === 'TRAINING') return 'TREINO'
  if (normalizedValue === 'SIMULATION') return 'SIMULADO'
  if (normalizedValue === 'COMPETITION') return 'COMPETICAO'
  return normalizedValue || 'TREINO'
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
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2
}

function calculateStdFromMedian(values) {
  const clean = (values || []).map(Number).filter((value) => !Number.isNaN(value))
  if (clean.length < 2) return 0
  const baseline = calculateMedian(clean)
  const variance = clean.reduce((sum, value) => sum + (value - baseline) ** 2, 0) / clean.length
  return Math.sqrt(variance)
}

function splitNumbers(value) {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item)).filter((item) => !Number.isNaN(item))
  }

  return String(value || '')
    .split(',')
    .map((item) => Number(String(item).trim()))
    .filter((item) => !Number.isNaN(item))
}

function seriesOrder(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return Number(digits || 0)
}

function sequenceStats(shots, predicate) {
  let maxLen = 0
  let count = 0
  let current = 0

  shots.forEach((shot) => {
    if (predicate(shot)) {
      current += 1
      maxLen = Math.max(maxLen, current)
    } else {
      if (current >= 3) count += 1
      current = 0
    }
  })

  if (current >= 3) count += 1
  return { count, maxLen }
}

function calculateResilience(seriesTotals) {
  if (seriesTotals.length < 2) return 7.0

  const improvements = seriesTotals.reduce((sum, total, index) => {
    if (index === 0) return sum
    return sum + (total > seriesTotals[index - 1] ? 1 : 0)
  }, 0)

  return limit010(5.0 + improvements)
}

function calculateGroupPenalty(group) {
  const size = group.length
  const hasError = group.includes('ERRO')
  if (size >= 3) return hasError ? 2.0 : 1.2
  if (size === 2) return hasError ? 1.0 : 0.6
  return hasError ? 0.5 : 0.2
}

function calculateEmotionalScore(shots, medTiro, isRifle) {
  const base = medTiro ?? (isRifle ? 10.0 : 9.0)
  let penalty = 0
  let group = []

  shots.forEach((shot) => {
    const label = isRifle
      ? shot >= base
        ? 'LIMPO'
        : shot >= base - 0.2
          ? 'ALERTA'
          : 'ERRO'
      : shot >= base
        ? 'LIMPO'
        : shot >= base - 1.0
          ? 'ALERTA'
          : 'ERRO'

    if (label === 'LIMPO') {
      if (group.length) {
        penalty += calculateGroupPenalty(group)
        group = []
      }
      return
    }

    group.push(label)
  })

  if (group.length) penalty += calculateGroupPenalty(group)
  return Math.max(3.0, limit010(10.0 - penalty))
}

function calculatePhysicalDegradation(shots) {
  if (shots.length < 40) return 0
  const half = Math.floor(shots.length / 2)
  return calculateMedian(shots.slice(half)) < calculateMedian(shots.slice(0, half)) - 0.2 ? 2 : 0
}

function rhythmScoreFromStd(stdValue) {
  const safeValue = Math.max(0, Number(stdValue || 0))
  return limit010(10.0 - safeValue * 2.5)
}

function hciLevelForParameter(parameter, score, rhythmStd = null) {
  const normalized = String(parameter || '').toUpperCase()

  if (normalized === 'RHYTHM' && rhythmStd !== null) {
    if (rhythmStd <= 0.42) return 'ELITE'
    if (rhythmStd <= 0.5) return 'ALTO RENDIMENTO'
    if (rhythmStd <= 0.9) return 'INTERMEDIARIO'
    return 'INICIANTE'
  }

  if (normalized === 'TRANSFER' && Number(score) <= 0) return 'SEM BASELINE'
  if (Number(score) >= 8.5) return 'ELITE'
  if (Number(score) >= 6.0) return 'ALTO RENDIMENTO'
  if (Number(score) >= 3.0) return 'INTERMEDIARIO'
  return 'INICIANTE'
}

function scoreLevel(score) {
  if (Number(score) >= 10) return 'ELITE'
  if (Number(score) >= 7.4) return 'HIGH PERFORMANCE'
  return 'DEVELOPMENT'
}

function groupedEventTotals(items) {
  const grouped = new Map()
  items.forEach((item) => {
    const key = `${item.evento || ''}|${item.atleta || ''}`
    const total = splitNumbers(item.tiros).reduce((sum, value) => sum + value, 0)
    grouped.set(key, (grouped.get(key) || 0) + total)
  })
  return Array.from(grouped.values())
}

function groupedEventPressureLoads(items) {
  const grouped = new Map()
  items.forEach((item) => {
    const key = `${item.evento || ''}|${item.atleta || ''}`
    const current = grouped.get(key) || []
    grouped.set(key, [...current, ...splitNumbers(item.tiros)])
  })

  return Array.from(grouped.values())
    .map((shots) => {
      const rhythmStd = calculateStdFromMedian(shots)
      const baseline = calculateMedian(shots)
      const dropCount = shots.filter((shot) => shot < baseline - 1.5).length
      return rhythmStd + dropCount * 0.1
    })
    .filter((value) => !Number.isNaN(value))
}

function limit010(value) {
  return Math.max(0, Math.min(10, Number(value || 0)))
}
