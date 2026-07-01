import { getTrainingLibraryEntries } from './trainingLibraryService'

const COLOR_TARGET_TYPE = 'PRECISION_COLOR'
const COLOR_TRAINING_TYPE = 'TARGET_BASIC'
const COLOR_WEAPON_CLASS = 'COLOR_CARD_BASIC'
const COLOR_PHASE = 'GENERAL_PREPARATION'

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

function inferColorTrainingParameter(percentages, zeroShots) {
  const topZoneCode = percentages.find((item) => item.hitCount > 0)?.zoneCode || ''

  if (zeroShots > 1) return 'TARGET_COLOR_IDENTIFICATION'
  if (topZoneCode === 'GREEN') return 'TARGET_AIMING'
  if (topZoneCode === 'BLUE') return 'TARGET_TRIGGERING'
  if (topZoneCode === 'RED') return 'TARGET_GRIP'
  if (topZoneCode === 'YELLOW') return 'TARGET_POSITION'
  return 'TARGET_AIMING'
}

function lookupColorTraining(parameter, language) {
  const entry = getTrainingLibraryEntries().find((item) => (
    item?.active === true &&
    item?.targetType === COLOR_TARGET_TYPE &&
    item?.trainingType === COLOR_TRAINING_TYPE &&
    item?.weaponClass === COLOR_WEAPON_CLASS &&
    item?.phase === COLOR_PHASE &&
    item?.parameter === parameter
  ))

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
    TARGET_COLOR_IDENTIFICATION:
      language === 'pt-BR'
        ? 'Leitura do motor: a prioridade é reconhecimento de cor, confirmação visual e tomada de decisão antes do disparo.'
        : 'Engine reading: priority is color recognition, visual confirmation and decision before the shot.',
    TARGET_AIMING:
      language === 'pt-BR'
        ? 'Leitura do motor: o padrão pede ajuste de visada e manutenção da imagem de mira ao trocar de cor.'
        : 'Engine reading: the pattern calls for aiming adjustment and sight image maintenance during color switches.',
    TARGET_TRIGGERING:
      language === 'pt-BR'
        ? 'Leitura do motor: o agrupamento sugere revisão de gatilho e controle de pressão no momento da execução.'
        : 'Engine reading: the grouping suggests trigger review and pressure control during execution.',
    TARGET_GRIP:
      language === 'pt-BR'
        ? 'Leitura do motor: a distribuição indica revisão de empunhadura e estabilidade bilateral na transição entre cores.'
        : 'Engine reading: the distribution indicates grip review and bilateral stability through color transitions.',
    TARGET_POSITION:
      language === 'pt-BR'
        ? 'Leitura do motor: a sessão pede correção de posição, preparação corporal e entrada mais estável na cor.'
        : 'Engine reading: the session asks for position correction, body preparation and a more stable color entry.',
  }

  return map[parameter] || map.TARGET_AIMING
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
