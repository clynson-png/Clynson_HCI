import { getTrainingLibraryEntries } from './trainingLibraryService'
import { TAURUS_PARAMETERS, findTaurusTraining } from './taurusDecisionEngines'

const COLOR_TARGET_TYPE = 'PRECISION_COLOR'
const COLOR_TRAINING_TYPE = 'TARGET_BASIC'
const COLOR_WEAPON_CLASS = 'COLOR_CARD_BASIC'
const COLOR_PHASE = 'GENERAL_PREPARATION'
const COLOR_RULE = {
  targetType: COLOR_TARGET_TYPE,
  trainingType: COLOR_TRAINING_TYPE,
  weaponClass: COLOR_WEAPON_CLASS,
  phase: COLOR_PHASE,
  category: 'COLOR_CARD',
}

const COLOR_LABELS = {
  YELLOW: 'Amarelo',
  GREEN: 'Verde',
  RED: 'Vermelho',
  BLUE: 'Azul',
}

export function analyzeTaurusColorSession(session, language = 'pt-BR') {
  const hits = Array.isArray(session?.hits) ? session.hits : []
  const totalShots = Number(session?.totalShots || 0)
  const maxShots = Math.max(Number(session?.maxShots || 0), totalShots, 1)
  const assignedShots = hits.reduce((sum, item) => sum + Number(item.hitCount || 0), 0)
  const zeroShots = Math.max(0, maxShots - assignedShots)

  const percentages = hits
    .map((hit) => ({
      zoneCode: hit.zoneCode,
      zoneLabel: hit.zoneLabel,
      hitCount: Number(hit.hitCount || 0),
      percentage: Math.round((Number(hit.hitCount || 0) * 100) / maxShots),
    }))
    .sort((left, right) => right.percentage - left.percentage)

  const parameter = inferColorTrainingParameter(percentages, zeroShots)
  const recommendedTraining = lookupColorTraining(parameter, language)
  const topColors = percentages.filter((item) => item.hitCount > 0).slice(0, 3)

  return {
    reportTitle:
      language === 'pt-BR'
        ? 'Relatório HCI de Análise de Cartões Coloridos'
        : 'HCI Color Cards Analysis Report',
    parameter,
    totalShots,
    maxShots,
    assignedShots,
    zeroShots,
    percentages,
    topColors,
    officialMetrics: [
      {
        label: language === 'pt-BR' ? 'Impactos lançados' : 'Registered impacts',
        value: `${assignedShots}/${maxShots}`,
      },
      {
        label: language === 'pt-BR' ? 'Cor dominante' : 'Dominant color',
        value: `${normalizeColorLabel(topColors[0]?.zoneCode, topColors[0]?.zoneLabel)} (${topColors[0]?.percentage || 0}%)`,
      },
      {
        label: language === 'pt-BR' ? 'Segunda leitura' : 'Secondary reading',
        value: `${normalizeColorLabel(topColors[1]?.zoneCode, topColors[1]?.zoneLabel)} (${topColors[1]?.percentage || 0}%)`,
      },
      {
        label: language === 'pt-BR' ? 'Disparos sem registro' : 'Unregistered shots',
        value: String(zeroShots),
      },
    ],
    insights: buildColorInsights({ language, zeroShots, topColors, parameter }),
    recommendedTraining,
    keyPhrase:
      language === 'pt-BR'
        ? 'Reconheça a cor, organize o processo e só então execute.'
        : 'Recognize the color, organize the process, and only then execute.',
  }
}

export function buildTaurusColorChartModel(sessionsInput) {
  const sessions = (Array.isArray(sessionsInput) ? sessionsInput : [sessionsInput])
    .filter(Boolean)
    .filter((session) => session.targetType === 'COLOR')
    .sort((left, right) => Number(left.recordedAt || 0) - Number(right.recordedAt || 0))

  const predictedTimes = calculateLogarithmicBestTimes(
    sessions.map((session) => normalizePositiveNumber(session.durationSeconds))
  )

  return sessions.map((session, index) => {
    const impactCount = Array.isArray(session.hits)
      ? session.hits.reduce((sum, hit) => sum + Number(hit.hitCount || 0), 0)
      : Number(session.totalShots || 0)
    const maxShots = Math.max(Number(session.maxShots || 0), 8)

    return {
      sessionId: session.sessionId,
      name: formatShortDate(session.recordedAt),
      impactCount,
      impactPercent: maxShots > 0 ? Math.round((impactCount * 100) / maxShots) : 0,
      measuredTimeSeconds: normalizePositiveNumber(session.durationSeconds),
      predictedBestTimeSeconds: predictedTimes[index],
    }
  })
}

function inferColorTrainingParameter(percentages, zeroShots) {
  const topZoneCode = percentages.find((item) => item.hitCount > 0)?.zoneCode || ''

  if (zeroShots > 1) return TAURUS_PARAMETERS.COLOR.COLOR_IDENTIFICATION
  if (topZoneCode === 'GREEN') return TAURUS_PARAMETERS.COLOR.AIMING
  if (topZoneCode === 'BLUE') return TAURUS_PARAMETERS.COLOR.TRIGGERING
  if (topZoneCode === 'RED') return TAURUS_PARAMETERS.COLOR.GRIP
  if (topZoneCode === 'YELLOW') return TAURUS_PARAMETERS.COLOR.POSITION
  return TAURUS_PARAMETERS.COLOR.AIMING
}

function lookupColorTraining(parameter, language) {
  const entry = findTaurusTraining(
    getTrainingLibraryEntries(),
    COLOR_RULE,
    parameter,
    'COLOR',
    language
  )

  if (entry.title) return entry

  if (!entry) {
    return {
      title: language === 'pt-BR' ? 'Treino básico de cartões coloridos' : 'Basic color card drill',
      description:
        language === 'pt-BR'
          ? 'Treino corretivo de cartões coloridos liberado para a sessão TAURUS.'
          : 'Corrective color card drill unlocked for the TAURUS session.',
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

function buildColorInsights({ language, zeroShots, topColors, parameter }) {
  const insights = []

  if (zeroShots > 1) {
    insights.push(
      language === 'pt-BR'
        ? `Há ${zeroShots} disparos sem registro dentro do máximo da sessão, indicando quebra de reconhecimento visual ou troca tardia de referência de cor.`
        : `There are ${zeroShots} unregistered shots inside the planned session maximum, indicating visual recognition breakdown or late color-reference switching.`
    )
  }

  if (topColors.length > 0) {
    const summary = topColors
      .map((item) => `${normalizeColorLabel(item.zoneCode, item.zoneLabel)} ${item.hitCount}`)
      .join(' · ')
    insights.push(
      language === 'pt-BR'
        ? `Leitura dominante por cor: ${summary}.`
        : `Dominant color reading: ${summary}.`
    )
  }

  insights.push(parameterExplanation(parameter, language))
  return insights
}

function parameterExplanation(parameter, language) {
  const map = {
    [TAURUS_PARAMETERS.COLOR.COLOR_IDENTIFICATION]:
      language === 'pt-BR'
        ? 'Leitura do motor: a prioridade é reconhecimento de cor, confirmação visual e tomada de decisão antes do disparo.'
        : 'Engine reading: priority is color recognition, visual confirmation and decision before the shot.',
    [TAURUS_PARAMETERS.COLOR.AIMING]:
      language === 'pt-BR'
        ? 'Leitura do motor: o padrão pede ajuste de visada e manutenção da imagem de mira ao trocar de cor.'
        : 'Engine reading: the pattern calls for aiming adjustment and sight image maintenance during color switches.',
    [TAURUS_PARAMETERS.COLOR.TRIGGERING]:
      language === 'pt-BR'
        ? 'Leitura do motor: o agrupamento sugere revisão de gatilho e controle de pressão no momento da execução.'
        : 'Engine reading: the grouping suggests trigger review and pressure control during execution.',
    [TAURUS_PARAMETERS.COLOR.GRIP]:
      language === 'pt-BR'
        ? 'Leitura do motor: a distribuição indica revisão de empunhadura e estabilidade bilateral na transição entre cores.'
        : 'Engine reading: the distribution indicates grip review and bilateral stability through color transitions.',
    [TAURUS_PARAMETERS.COLOR.POSITION]:
      language === 'pt-BR'
        ? 'Leitura do motor: a sessão pede correção de posição, preparação corporal e entrada mais estável na cor.'
        : 'Engine reading: the session asks for position correction, body preparation and a more stable color entry.',
  }

  return map[parameter] || map[TAURUS_PARAMETERS.COLOR.AIMING]
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

function normalizeColorLabel(zoneCode, fallback) {
  if (fallback) return fallback
  return COLOR_LABELS[zoneCode] || '-'
}

function normalizePositiveNumber(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null
}

function calculateLogarithmicBestTimes(values) {
  const timedValues = values
    .map((value, index) => ({
      sequence: index + 1,
      value: normalizePositiveNumber(value),
    }))
    .filter((item) => item.value !== null)

  if (timedValues.length === 0) return values.map(() => null)
  if (timedValues.length === 1) {
    return values.map((value) => (normalizePositiveNumber(value) === null ? null : timedValues[0].value))
  }

  const n = timedValues.length
  const sumX = timedValues.reduce((sum, item) => sum + Math.log(item.sequence), 0)
  const sumY = timedValues.reduce((sum, item) => sum + item.value, 0)
  const sumXX = timedValues.reduce((sum, item) => sum + Math.log(item.sequence) ** 2, 0)
  const sumXY = timedValues.reduce(
    (sum, item) => sum + Math.log(item.sequence) * item.value,
    0
  )
  const denominator = n * sumXX - sumX ** 2
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n
  return values.map((value, index) => {
    if (normalizePositiveNumber(value) === null) return null
    const predicted = intercept + slope * Math.log(index + 1)
    return Number.isFinite(predicted) ? Math.max(0, Math.round(predicted * 10) / 10) : null
  })
}

function formatShortDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
