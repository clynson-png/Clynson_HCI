import { getTrainingLibraryEntries } from './trainingLibraryService'
import { TAURUS_PARAMETERS, findTaurusTraining } from './taurusDecisionEngines'

const HUMANOID_TARGET_TYPE = 'DEFENSE_HUMANOID'
const HUMANOID_TRAINING_TYPE = 'TARGET_BASIC'
const HUMANOID_WEAPON_CLASS = 'HUMANOID_BASIC'
const HUMANOID_PHASE = 'GENERAL_PREPARATION'
const HUMANOID_RULE = {
  targetType: HUMANOID_TARGET_TYPE,
  trainingType: HUMANOID_TRAINING_TYPE,
  weaponClass: HUMANOID_WEAPON_CLASS,
  phase: HUMANOID_PHASE,
  category: 'HUMANOID',
}

const ZONE_LABEL_GROUPS = {
  ALPHA_HEAD: ['cabeca', 'cabeça', 'head'],
  ALPHA_TORSO: ['torax', 'tórax', 'chest', 'torso'],
  CHARLIE_LEFT: ['charlie esquerdo', 'left center'],
  CHARLIE_CENTER: ['charlie centro', 'center mass', 'abdomen', 'central'],
  DELTA_LEFT: ['delta esquerdo', 'left shoulder', 'ombro esquerdo'],
  DELTA_RIGHT: ['delta direito', 'right shoulder', 'ombro direito'],
  CHARLIE_RIGHT: ['charlie direito', 'right center'],
  DELTA_LOWER: ['delta inferior', 'pelvis', 'pelve', 'quadrante inferior'],
}

export function analyzeTaurusHumanoidSession(session, language = 'pt-BR') {
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

  const parameter = inferHumanoidTrainingParameter(percentages, zeroShots)
  const recommendedTraining = lookupHumanoidTraining(parameter, language)
  const topZones = percentages.filter((item) => item.hitCount > 0).slice(0, 3)
  const alphaHits = sumByCodes(hits, ['ALPHA_HEAD', 'ALPHA_TORSO'])
  const charlieHits = sumByCodes(hits, ['CHARLIE_LEFT', 'CHARLIE_CENTER', 'CHARLIE_RIGHT'])
  const deltaHits = sumByCodes(hits, ['DELTA_LEFT', 'DELTA_RIGHT', 'DELTA_LOWER'])

  return {
    targetType: HUMANOID_TARGET_TYPE,
    reportTitle:
      language === 'pt-BR'
        ? 'Relatório HCI de Análise de Alvo Humanoide'
        : 'HCI Humanoid Target Analysis Report',
    parameter,
    totalShots,
    maxShots,
    assignedShots,
    zeroShots,
    percentages,
    topZones,
    officialMetrics: [
      {
        label: language === 'pt-BR' ? 'Disparos registrados' : 'Registered shots',
        value: `${assignedShots}/${maxShots}`,
      },
      {
        label: language === 'pt-BR' ? 'Zona Alpha' : 'Alpha zone',
        value: `${alphaHits} (${Math.round((alphaHits * 100) / maxShots)}%)`,
      },
      {
        label: language === 'pt-BR' ? 'Zona Charlie' : 'Charlie zone',
        value: `${charlieHits} (${Math.round((charlieHits * 100) / maxShots)}%)`,
      },
      {
        label: language === 'pt-BR' ? 'Zona Delta' : 'Delta zone',
        value: `${deltaHits} (${Math.round((deltaHits * 100) / maxShots)}%)`,
      },
      {
        label: language === 'pt-BR' ? 'Disparos sem registro' : 'Unregistered shots',
        value: String(zeroShots),
      },
    ],
    insights: buildHumanoidInsights({ language, zeroShots, topZones, parameter, alphaHits, maxShots }),
    recommendedTraining,
    keyPhrase:
      language === 'pt-BR'
        ? 'O disparo só termina depois de encerrado o follow-through.'
        : 'The shot only ends after the follow-through.',
  }
}

function inferHumanoidTrainingParameter(percentages, zeroShots) {
  const activeZones = percentages.filter((item) => item.hitCount > 0)
  const topZoneCode = activeZones[0]?.zoneCode || ''

  if (zeroShots > 0) {
    return TAURUS_PARAMETERS.HUMANOID.POSITION
  }

  const isSpread = activeZones.length >= 4 && activeZones.slice(0, 4).every((item) => item.percentage <= 35)
  if (isSpread) {
    return TAURUS_PARAMETERS.HUMANOID.AIMING
  }

  const isLowRight = topZoneCode === 'DELTA_RIGHT' || topZoneCode === 'DELTA_LOWER'
  if (isLowRight) {
    return TAURUS_PARAMETERS.HUMANOID.TRIGGERING
  }

  const isLateralized = ['CHARLIE_LEFT', 'CHARLIE_RIGHT', 'DELTA_LEFT', 'DELTA_RIGHT'].includes(topZoneCode)
  if (isLateralized) {
    return TAURUS_PARAMETERS.HUMANOID.GRIP
  }

  return TAURUS_PARAMETERS.HUMANOID.AIMING
}

function lookupHumanoidTraining(parameter, language) {
  const entry = findTaurusTraining(
    getTrainingLibraryEntries(),
    HUMANOID_RULE,
    parameter,
    'HUMANOID',
    language
  )

  if (entry.title) return entry

  if (!entry) {
    return {
      title: language === 'pt-BR' ? 'Treino humanoide básico' : 'Basic humanoid drill',
      description:
        language === 'pt-BR'
          ? 'Treino corretivo humanoide liberado para a sessão TAURUS.'
          : 'Corrective humanoid drill unlocked for the TAURUS session.',
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

function buildHumanoidInsights({ language, zeroShots, topZones, parameter, alphaHits, maxShots }) {
  const insights = []

  if (zeroShots > 0) {
    insights.push(
      language === 'pt-BR'
        ? `Existem ${zeroShots} disparos sem registro em relação ao máximo previsto da sessão; a prioridade é estabilizar posição e processo antes de buscar velocidade.`
        : `${zeroShots} shots were not registered against the planned session maximum; stabilize position and process before adding speed.`
    )
  }

  if (topZones.length > 0) {
    const summary = topZones
      .map((item) => `${normalizeZoneLabel(item.zoneCode, item.zoneLabel)} ${item.hitCount}`)
      .join(' · ')
    insights.push(
      language === 'pt-BR'
        ? `Concentração principal de impactos: ${summary}.`
        : `Main impact concentration: ${summary}.`
    )
  }

  if ((alphaHits * 100) / maxShots >= 60) {
    insights.push(
      language === 'pt-BR'
        ? 'A sessão já mostra retenção na zona Alpha. O ajuste fino agora é reduzir dispersão periférica e repetir o processo bom.'
        : 'The session already shows retention inside Alpha. The fine adjustment now is reducing peripheral spread and repeating the good process.'
    )
  } else {
    insights.push(
      language === 'pt-BR'
        ? 'A densidade na zona Alpha ainda está abaixo do ideal para uma sessão tática consistente.'
        : 'Alpha-zone density is still below the ideal level for a consistent tactical session.'
    )
  }

  insights.push(parameterExplanation(parameter, language))
  return insights
}

function parameterExplanation(parameter, language) {
  const map = {
    [TAURUS_PARAMETERS.HUMANOID.POSITION]:
      language === 'pt-BR'
        ? 'Leitura do motor: a sessão pede correção prioritária de posição, base e apresentação segura da arma.'
        : 'Engine reading: the session needs priority correction in position, stance and safe presentation.',
    [TAURUS_PARAMETERS.HUMANOID.TRIGGERING]:
      language === 'pt-BR'
        ? 'Leitura do motor: o padrão mais crítico aponta para acionamento de gatilho e queda de impacto no setor inferior.'
        : 'Engine reading: the most critical pattern points to trigger actuation and impact drop to the lower sector.',
    [TAURUS_PARAMETERS.HUMANOID.GRIP]:
      language === 'pt-BR'
        ? 'Leitura do motor: a lateralização dominante indica revisão de empunhadura e pressão bilateral.'
        : 'Engine reading: dominant lateralization indicates grip and bilateral pressure review.',
    [TAURUS_PARAMETERS.HUMANOID.AIMING]:
      language === 'pt-BR'
        ? 'Leitura do motor: a distribuição sugere ajuste de visada, confirmação de imagem e repetição do alinhamento.'
        : 'Engine reading: the distribution suggests sighting adjustment, image confirmation and alignment repetition.',
  }

  return map[parameter] || map[TAURUS_PARAMETERS.HUMANOID.AIMING]
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

function sumByCodes(hits, zoneCodes) {
  return hits
    .filter((item) => zoneCodes.includes(item.zoneCode))
    .reduce((sum, item) => sum + Number(item.hitCount || 0), 0)
}

function normalizeZoneLabel(zoneCode, fallback) {
  if (fallback) return fallback
  const aliases = ZONE_LABEL_GROUPS[zoneCode]
  return aliases?.[0] || zoneCode
}
