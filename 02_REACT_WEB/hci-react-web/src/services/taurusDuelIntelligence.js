import { getTrainingLibraryEntries } from './trainingLibraryService'

const DUEL_TARGET_TYPE = 'DUEL_20'
const DUEL_TRAINING_TYPE = 'TECHNICAL'
const DUEL_WEAPON_CLASS = 'PISTOL'
const DUEL_PHASE = 'SPECIFIC_PREPARATION'

export function analyzeTaurusDuelSession(session, language = 'pt-BR') {
  const hits = Array.isArray(session?.hits) ? session.hits : []
  const maxShots = Math.max(Number(session?.maxShots || 0), Number(session?.totalShots || 0), 1)
  const totalShots = Number(session?.totalShots || 0)
  const totalScore = Number(session?.totalScore || 0)
  const scoreRatio = totalScore / Math.max(Number(session?.maxScore || 0), 1)
  const shotDetails = parseShotDetails(session?.shotDetailsJson)
  const xCount = shotDetails.filter((shot) => String(shot.score || '').toUpperCase() === 'X').length
  const topDirection = [...hits]
    .sort((left, right) => Number(right.hitCount || 0) - Number(left.hitCount || 0))[0]

  const parameter = inferDuelTrainingParameter({ totalShots, maxShots, scoreRatio, topDirection })
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
        value: `${topDirection?.zoneLabel || '-'} (${topDirection?.hitCount || 0})`,
      },
      {
        label: language === 'pt-BR' ? 'Centro X' : 'Center X',
        value: String(xCount),
      },
    ],
    insights: buildDuelInsights({ language, totalScore, scoreRatio, xCount, topDirection, parameter }),
    recommendedTraining,
    keyPhrase:
      language === 'pt-BR'
        ? 'A direção do impacto revela o padrão técnico por trás do resultado.'
        : 'Impact direction reveals the technical pattern behind the result.',
  }
}

function inferDuelTrainingParameter({ totalShots, maxShots, scoreRatio, topDirection }) {
  if (totalShots < maxShots || scoreRatio < 0.55) {
    return 'TRANSFER'
  }

  const code = topDirection?.zoneCode || ''
  if (['N', 'NE', 'NW'].includes(code)) return 'PROCESS'
  if (['E', 'SE'].includes(code)) return 'PROCESS'
  if (['W', 'SW'].includes(code)) return 'PROCESS'
  return 'PROCESS'
}

function lookupDuelTraining(parameter, language) {
  const entry = getTrainingLibraryEntries().find((item) => (
    item?.active === true &&
    item?.targetType === DUEL_TARGET_TYPE &&
    item?.trainingType === DUEL_TRAINING_TYPE &&
    item?.weaponClass === DUEL_WEAPON_CLASS &&
    item?.phase === DUEL_PHASE &&
    item?.parameter === parameter
  ))

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

function buildDuelInsights({ language, totalScore, scoreRatio, xCount, topDirection, parameter }) {
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

  insights.push(parameterExplanation(parameter, language))
  return insights
}

function parameterExplanation(parameter, language) {
  const map = {
    PROCESS:
      language === 'pt-BR'
        ? 'Leitura do motor: o Duelo 20 pede ajuste de processo, ritmo, tomada de decisão e manutenção do padrão sob tempo.'
        : 'Engine reading: Duel 20 calls for process, rhythm, decision-making and pattern retention under time.',
    TRANSFER:
      language === 'pt-BR'
        ? 'Leitura do motor: o Duelo 20 pede transferência técnica, reconstrução de base e repetição controlada antes de aumentar pressão.'
        : 'Engine reading: Duel 20 calls for technical transfer, base rebuilding and controlled repetition before increasing pressure.',
  }

  return map[parameter] || map.PROCESS
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
