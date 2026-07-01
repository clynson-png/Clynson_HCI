import { getTrainingLibraryEntries } from './trainingLibraryService'
import { TAURUS_PARAMETERS, findTaurusTraining } from './taurusDecisionEngines'

const DUEL_TARGET_TYPE = 'DUEL_20'
const DUEL_TRAINING_TYPE = 'TECHNICAL'
const DUEL_WEAPON_CLASS = 'PISTOL'
const DUEL_PHASE = 'SPECIFIC_PREPARATION'
const DUEL_RULE = {
  targetType: DUEL_TARGET_TYPE,
  trainingType: DUEL_TRAINING_TYPE,
  weaponClass: DUEL_WEAPON_CLASS,
  phase: DUEL_PHASE,
  category: 'DUEL_20',
}

export function analyzeTaurusDuelSession(session, language = 'pt-BR') {
  const hits = Array.isArray(session?.hits) ? session.hits : []
  const maxShots = Math.max(Number(session?.maxShots || 0), Number(session?.totalShots || 0), 1)
  const totalShots = Number(session?.totalShots || 0)
  const totalScore = Number(session?.totalScore || 0)
  const scoreRatio = totalScore / Math.max(Number(session?.maxScore || 0), 1)
  const shotDetails = parseShotDetails(session?.shotDetailsJson)
  const xCount = shotDetails.filter((shot) => String(shot.score || '').toUpperCase() === 'X').length
  const seriesProfile = buildSeriesProfile(shotDetails, session?.sessionMode || '25M')
  const directionProfile = buildDirectionProfile(shotDetails, session?.sessionMode || '25M')
  const rhythmProfile = buildShotRhythmProfile(shotDetails, session?.sessionMode || '25M')
  const topDirection = directionProfile[0] || [...hits]
    .sort((left, right) => Number(right.hitCount || 0) - Number(left.hitCount || 0))[0]
  const totalIdd = directionProfile.reduce((sum, direction) => sum + Number(direction.idd || 0), 0)

  const parameter = inferDuelTrainingParameter({
    totalShots,
    maxShots,
    scoreRatio,
    xCount,
    topDirection,
    seriesProfile,
    directionProfile,
    rhythmProfile,
  })
  const recommendedTraining = lookupDuelTraining(parameter, language)

  return {
    reportTitle:
      language === 'pt-BR'
        ? 'Relatório HCI de Análise Duelo 20'
        : 'HCI Duel 20 Target Analysis Report',
    parameter,
    totalShots,
    totalScore,
    scoreRatio,
    xCount,
    topDirection,
    seriesProfile,
    directionProfile,
    rhythmProfile,
    officialMetrics: [
      {
        label: language === 'pt-BR' ? 'Pontuação total' : 'Total score',
        value: `${totalScore}/${session?.maxScore || 0}`,
      },
      {
        label: language === 'pt-BR' ? 'Impactos lançados' : 'Registered impacts',
        value: `${totalShots}/${maxShots}`,
      },
      {
        label: language === 'pt-BR' ? 'Setor dominante' : 'Dominant sector',
        value: `${topDirection?.zoneLabel || topDirection?.directionLabel || '-'} (${Number(topDirection?.idd || 0).toFixed(1)} IDD)`,
      },
      {
        label: language === 'pt-BR' ? 'Centro X' : 'Center X',
        value: String(xCount),
      },
      {
        label: language === 'pt-BR' ? 'IDD direcional' : 'Directional IDD',
        value: totalIdd.toFixed(1),
      },
      {
        label: language === 'pt-BR' ? 'Variação entre séries' : 'Series variation',
        value: formatSeriesVariation(seriesProfile),
      },
      {
        label: language === 'pt-BR' ? 'Tempo por série' : 'Series time',
        value: formatSeriesTimes(seriesProfile),
      },
      {
        label: language === 'pt-BR' ? 'STD frequencia disparos' : 'Shot frequency STD',
        value: formatRhythmStd(rhythmProfile),
      },
      {
        label: language === 'pt-BR' ? 'Melhor frequencia' : 'Best frequency',
        value: formatBestFrequency(rhythmProfile, language),
      },
    ],
    insights: buildDuelInsights({
      language,
      totalScore,
      scoreRatio,
      xCount,
      topDirection,
      parameter,
      seriesProfile,
      directionProfile,
      rhythmProfile,
    }),
    recommendedTraining,
    keyPhrase:
      language === 'pt-BR'
        ? 'A direção do impacto revela o padrão técnico por trás do resultado.'
        : 'Impact direction reveals the technical pattern behind the result.',
  }
}

function inferDuelTrainingParameter({
  totalShots,
  maxShots,
  scoreRatio,
  xCount,
  topDirection,
  seriesProfile,
  directionProfile,
  rhythmProfile,
}) {
  if (totalShots < maxShots || scoreRatio < 0.55) {
    return TAURUS_PARAMETERS.DUEL20.BASE_REBUILD
  }

  if (hasHighSeriesVariation(seriesProfile)) {
    return TAURUS_PARAMETERS.DUEL20.SERIES_STABILITY
  }

  if (rhythmProfile?.stdSeconds >= 1.2) {
    return TAURUS_PARAMETERS.DUEL20.TIMING_CONTROL
  }

  if (hasStrongDirectionCluster(directionProfile, totalShots)) {
    return TAURUS_PARAMETERS.DUEL20.DIRECTIONAL_CONTROL
  }

  if (scoreRatio >= 0.82 && xCount <= 1) {
    return TAURUS_PARAMETERS.DUEL20.CENTER_RETENTION
  }

  if (scoreRatio >= 0.7 && scoreRatio < 0.82) {
    return TAURUS_PARAMETERS.DUEL20.TIMING_CONTROL
  }

  const code = topDirection?.zoneCode || ''
  if (['N', 'NE', 'NW', 'E', 'SE', 'W', 'SW'].includes(code)) {
    return TAURUS_PARAMETERS.DUEL20.DIRECTIONAL_CONTROL
  }
  return TAURUS_PARAMETERS.DUEL20.DIRECTIONAL_CONTROL
}

function lookupDuelTraining(parameter, language) {
  const entry = findTaurusTraining(
    getTrainingLibraryEntries(),
    DUEL_RULE,
    parameter,
    'DUEL20',
    language
  )

  if (entry.title) return entry

  if (!entry) {
    return {
      title: language === 'pt-BR' ? 'Treino básico de Duelo 20' : 'Basic Duel 20 drill',
      description:
        language === 'pt-BR'
          ? 'Treino corretivo de Duelo 20 liberado para a sessão TAURUS.'
          : 'Corrective Duel 20 drill unlocked for the TAURUS session.',
      objective: '',
      executionSummary: '',
      qualityFocus: '',
      loadNote: '',
      coachCues: [],
    }
  }

  return {
    trainingId: entry.trainingId,
    title: localizedField(entry.name, language),
    description: localizedField(entry.description, language),
    objective: localizedField(entry.objective, language),
    executionSummary: localizedField(entry.executionSummary, language),
    qualityFocus: localizedField(entry.qualityFocus, language),
    loadNote: localizedField(entry.loadNote, language),
    coachCues: localizedList(entry.coachCues, language),
  }
}

function buildDuelInsights({
  language,
  totalScore,
  scoreRatio,
  xCount,
  topDirection,
  parameter,
  seriesProfile,
  directionProfile,
  rhythmProfile,
}) {
  const insights = []

  insights.push(
    language === 'pt-BR'
      ? `Pontuação consolidada da sessão: ${totalScore}. O setor dominante foi ${topDirection?.zoneLabel || '-'}, com ${topDirection?.hitCount || 0} impactos.`
      : `Session consolidated score: ${totalScore}. Dominant sector was ${topDirection?.zoneLabel || '-'}, with ${topDirection?.hitCount || 0} impacts.`
  )

  insights.push(
    language === 'pt-BR'
      ? `Centros X registrados: ${xCount}. A taxa geral da sessão ficou em ${Math.round(scoreRatio * 100)}% do máximo previsto.`
      : `Registered X centers: ${xCount}. Overall session rate reached ${Math.round(scoreRatio * 100)}% of the planned maximum.`
  )

  if (seriesProfile.length > 0) {
    insights.push(
      language === 'pt-BR'
        ? `Séries: ${seriesProfile.map((series) => `${series.seriesCode} ${series.totalScore}`).join(' · ')}.`
        : `Series: ${seriesProfile.map((series) => `${series.seriesCode} ${series.totalScore}`).join(' · ')}.`
    )
  }

  if (directionProfile.length > 0) {
    const top = directionProfile[0]
    insights.push(
      language === 'pt-BR'
        ? `Agrupamento direcional principal: ${top.directionCode || '-'} com ${top.hitCount} impactos.`
        : `Main direction cluster: ${top.directionCode || '-'} with ${top.hitCount} impacts.`
    )
  }

  if (rhythmProfile?.intervals?.length > 0) {
    insights.push(
      language === 'pt-BR'
        ? `Ritmo entre disparos: STD ${formatSeconds(rhythmProfile.stdSeconds)}. Melhor faixa observada: ${formatBestFrequency(rhythmProfile, language)}.`
        : `Shot rhythm: STD ${formatSeconds(rhythmProfile.stdSeconds)}. Best observed band: ${formatBestFrequency(rhythmProfile, language)}.`
    )
  }

  insights.push(parameterExplanation(parameter, language))
  return insights
}

function parameterExplanation(parameter, language) {
  const map = {
    [TAURUS_PARAMETERS.DUEL20.DIRECTIONAL_CONTROL]:
      language === 'pt-BR'
        ? 'Leitura do motor: o Duelo 20 pede ajuste de processo, ritmo, tomada de decisão e manutenção do padrão sob tempo.'
        : 'Engine reading: Duel 20 calls for process, rhythm, decision-making and pattern retention under time.',
    [TAURUS_PARAMETERS.DUEL20.BASE_REBUILD]:
      language === 'pt-BR'
        ? 'Leitura do motor: o Duelo 20 pede transferência técnica, reconstrução de base e repetição controlada antes de aumentar pressão.'
        : 'Engine reading: Duel 20 calls for technical transfer, base rebuilding and controlled repetition before increasing pressure.',
    [TAURUS_PARAMETERS.DUEL20.SERIES_STABILITY]:
      language === 'pt-BR'
        ? 'Leitura do motor: o Duelo 20 pede consistência entre séries, com repetição do mesmo setup e queda menor entre blocos de 5 tiros.'
        : 'Engine reading: Duel 20 calls for consistency between series, repeating the same setup and reducing drop-off between 5-shot blocks.',
    [TAURUS_PARAMETERS.DUEL20.CENTER_RETENTION]:
      language === 'pt-BR'
        ? 'Leitura do motor: o resultado já aparece, mas falta transformar pontuação em centro X e fechamento mais preciso.'
        : 'Engine reading: the result is present, but score still needs to become center-X retention and cleaner closure.',
    [TAURUS_PARAMETERS.DUEL20.TIMING_CONTROL]:
      language === 'pt-BR'
        ? 'Leitura do motor: o Duelo 20 pede ritmo de série, manutenção do processo e repetição do tempo interno entre os disparos.'
        : 'Engine reading: Duel 20 calls for series rhythm, process retention and repeated internal timing between shots.',
  }

  return map[parameter] || map[TAURUS_PARAMETERS.DUEL20.DIRECTIONAL_CONTROL]
}

function buildSeriesProfile(shotDetails, duelMode) {
  const seriesMap = new Map()

  shotDetails.forEach((shot) => {
    const seriesCode = shot.seriesCode || `SR${Math.floor((Number(shot.shotNumber || 1) - 1) / 5) + 1}`
    const current = seriesMap.get(seriesCode) || {
      seriesCode,
      totalScore: 0,
      shotCount: 0,
      xCount: 0,
      timeSeconds: null,
    }

    current.totalScore += parseDuelScoreValue(shot.score, duelMode)
    current.shotCount += String(shot.score || '').trim() ? 1 : 0
    current.xCount += String(shot.score || '').trim().toUpperCase() === 'X' ? 1 : 0
    const seriesTime = Number(shot.seriesTimeSeconds)
    if (Number.isFinite(seriesTime) && seriesTime > 0) {
      current.timeSeconds = seriesTime
    }
    seriesMap.set(seriesCode, current)
  })

  return Array.from(seriesMap.values()).sort((left, right) =>
    left.seriesCode.localeCompare(right.seriesCode)
  )
}

function buildDirectionProfile(shotDetails, duelMode) {
  const directionMap = new Map()

  shotDetails.forEach((shot) => {
    const directionCode = shot.directionCode || ''
    if (!directionCode) return
    const current = directionMap.get(directionCode) || {
      directionCode,
      directionLabel: shot.directionLabel || directionCode,
      hitCount: 0,
      distanceSumMm: 0,
      averageDistanceMm: 0,
      idd: 0,
    }

    current.hitCount += 1
    current.distanceSumMm += estimateDuelDistanceMm(shot.score, duelMode)
    current.averageDistanceMm = current.hitCount > 0 ? current.distanceSumMm / current.hitCount : 0
    current.idd = current.hitCount * current.averageDistanceMm
    directionMap.set(directionCode, current)
  })

  return Array.from(directionMap.values()).sort((left, right) => right.idd - left.idd)
}

function buildShotRhythmProfile(shotDetails, duelMode) {
  const timedShots = shotDetails
    .map((shot, index) => ({
      shotNumber: Number(shot.shotNumber || index + 1),
      score: parseDuelScoreValue(shot.score, duelMode),
      intervalSeconds: resolveShotIntervalSeconds(shot, shotDetails[index - 1]),
    }))
    .filter((shot) => Number.isFinite(shot.intervalSeconds) && shot.intervalSeconds > 0)

  const intervals = timedShots.map((shot) => shot.intervalSeconds)

  return {
    intervals,
    stdSeconds: calculatePopulationStd(intervals),
    bestBand: findBestFrequencyBand(timedShots),
  }
}

function resolveShotIntervalSeconds(shot, previousShot) {
  const intervalMs = Number(shot.shotIntervalMs)
  if (Number.isFinite(intervalMs) && intervalMs > 0) {
    return intervalMs / 1000
  }

  const elapsed = Number(shot.audioElapsedSeconds || shot.shotTimeSeconds)
  const previousElapsed = Number(previousShot?.audioElapsedSeconds || previousShot?.shotTimeSeconds)
  if (Number.isFinite(elapsed) && elapsed > 0) {
    if (Number.isFinite(previousElapsed) && previousElapsed > 0) {
      return Math.max(0, elapsed - previousElapsed)
    }
    return elapsed
  }

  return null
}

function calculatePopulationStd(values) {
  if (!values.length) return null
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length
  return Math.sqrt(variance)
}

function findBestFrequencyBand(timedShots) {
  const scoredShots = timedShots.filter((shot) => shot.score > 0)
  if (!scoredShots.length) return null

  const maxScore = Math.max(...scoredShots.map((shot) => shot.score))
  const topShots = scoredShots.filter((shot) => shot.score >= maxScore - 1)
  const intervalSeconds = topShots.reduce((sum, shot) => sum + shot.intervalSeconds, 0) / topShots.length
  const averageScore = topShots.reduce((sum, shot) => sum + shot.score, 0) / topShots.length

  return {
    intervalSeconds,
    shotsPerMinute: intervalSeconds > 0 ? 60 / intervalSeconds : null,
    averageScore,
    sampleSize: topShots.length,
  }
}

function hasHighSeriesVariation(seriesProfile) {
  if (seriesProfile.length < 2) return false
  const totals = seriesProfile
    .filter((series) => series.shotCount > 0)
    .map((series) => series.totalScore)

  if (totals.length < 2) return false
  return Math.max(...totals) - Math.min(...totals) >= 10
}

function hasStrongDirectionCluster(directionProfile, totalShots) {
  if (!directionProfile.length || totalShots <= 0) return false
  return directionProfile[0].hitCount / totalShots >= 0.35
}

function formatSeriesVariation(seriesProfile) {
  if (!seriesProfile.length) return '-'
  const totals = seriesProfile
    .filter((series) => series.shotCount > 0)
    .map((series) => series.totalScore)

  if (!totals.length) return '-'
  return String(Math.max(...totals) - Math.min(...totals))
}

function formatSeriesTimes(seriesProfile) {
  const timedSeries = seriesProfile.filter((series) => Number(series.timeSeconds) > 0)
  if (!timedSeries.length) return '-'

  return timedSeries
    .map((series) => `${series.seriesCode} ${Number(series.timeSeconds).toFixed(1).replace('.0', '')}s`)
    .join(' · ')
}

function formatRhythmStd(rhythmProfile) {
  if (!rhythmProfile?.intervals?.length || rhythmProfile.stdSeconds === null) return '-'
  return formatSeconds(rhythmProfile.stdSeconds)
}

function formatBestFrequency(rhythmProfile, language) {
  const bestBand = rhythmProfile?.bestBand
  if (!bestBand?.intervalSeconds) return '-'

  const interval = formatSeconds(bestBand.intervalSeconds)
  const shotsPerMinute = Number(bestBand.shotsPerMinute || 0).toFixed(1).replace('.0', '')
  const averageScore = Number(bestBand.averageScore || 0).toFixed(1).replace('.0', '')

  return language === 'pt-BR'
    ? `${interval} entre disparos (${shotsPerMinute} disp/min, media ${averageScore})`
    : `${interval} between shots (${shotsPerMinute} shots/min, avg ${averageScore})`
}

function formatSeconds(value) {
  if (!Number.isFinite(Number(value))) return '-'
  return `${Number(value).toFixed(1).replace('.0', '')}s`
}

function parseDuelScoreValue(score, duelMode = '25M') {
  const normalized = String(score || '').trim().toUpperCase()
  if (!normalized) return 0
  if (normalized === 'X') return duelMode === '10M' ? 12 : 10
  const numeric = Number(normalized)
  return Number.isNaN(numeric) ? 0 : numeric
}

function estimateDuelDistanceMm(score, duelMode = '25M') {
  const maxShotScore = duelMode === '10M' ? 12 : 10
  const scoreValue = parseDuelScoreValue(score, duelMode)
  return Math.max(0, maxShotScore - scoreValue) * 10
}

function parseShotDetails(shotDetailsJson) {
  try {
    const parsed = JSON.parse(shotDetailsJson || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function localizedField(field, language) {
  if (!field) return ''
  if (typeof field === 'string') return field
  return field[language] || field['pt-BR'] || field['en-US'] || ''
}

function localizedList(field, language) {
  if (!field) return []
  if (Array.isArray(field)) return field
  const value = field[language] || field['pt-BR'] || field['en-US'] || []
  return Array.isArray(value) ? value : []
}
