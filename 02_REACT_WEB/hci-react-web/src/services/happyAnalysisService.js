import happyLibrary from '../data/hci_happy_library_canonical.json'
import happyPrescription from '../data/hci_happy_prescription_canonical.json'
import { athleteNamesMatch } from './athleteIdentity'

const HAPPY_DIMENSIONS = {
  SELF_LEADERSHIP: [
    ['CONFIDENCE', 0.25],
    ['DISCIPLINE', 0.25],
    ['NERVE', 0.2],
    ['POWERING', 0.15],
    ['YEARN', 0.15],
  ],
  TEAM_LEADERSHIP: [
    ['ALIGNMENT', 0.35],
    ['PLAN', 0.25],
    ['ANALYSIS', 0.15],
    ['OPPORTUNITY', 0.15],
    ['ORGANIZATION', 0.1],
  ],
  WISDOM: [
    ['ANALYSIS', 0.35],
    ['HEED', 0.25],
    ['ALIGNMENT', 0.15],
    ['OPPORTUNITY', 0.15],
    ['CONFIDENCE', 0.1],
  ],
  MANAGEMENT: [
    ['MANAGEMENT', 0.3],
    ['ORGANIZATION', 0.25],
    ['PLAN', 0.2],
    ['DISCIPLINE', 0.15],
    ['POWERING', 0.1],
  ],
  ENVIRONMENT: [
    ['NERVE', 0.25],
    ['HEED', 0.2],
    ['CONFIDENCE', 0.15],
    ['ALIGNMENT', 0.15],
    ['POWERING', 0.15],
    ['OPPORTUNITY', 0.1],
  ],
}

const CROSS_MAPPINGS = [
  ['CONFIDENCE', 'OUTCOME', 'Confidence supported by score evidence?'],
  ['CONFIDENCE', 'CONSISTENCY', 'Can confidence survive repetition?'],
  ['NERVE', 'PRESSURE', 'Does perceived pressure match performance degradation?'],
  ['HEED', 'RHYTHM', 'Does arousal affect rhythm stability?'],
  ['HEED', 'EMOTIONAL', 'Does the athlete perceive emotional instability?'],
  ['PLAN', 'PROCESS', 'Is the coach plan becoming execution?'],
  ['ALIGNMENT', 'TRANSFER', 'Does training direction transfer into performance?'],
  ['POWERING', 'PHYSICAL', 'Does perceived energy match physical evidence?'],
  ['YEARN', 'CONSISTENCY', 'Does ambition match commitment and continuity?'],
  ['ORGANIZATION', 'CONSISTENCY', 'Does poor organization create inconsistency?'],
  ['ANALYSIS', 'DEEPENING', 'Is the athlete learning or just repeating?'],
  ['OPPORTUNITY', 'TRANSFER', 'Is the athlete using the opportunities created by the coach?'],
]

export function buildHappyBlocks({ snapshot, athleteName, athlete360, normalizedParameters }) {
  const source =
    athlete360?.happyState ||
    athlete360?.happySelfAnalysis ||
    athlete360?.athleteSelfAnalysis ||
    findSnapshotHappyState(snapshot, athleteName) ||
    null

  const responses = normalizeResponses(source)
  const hasResponses = responses.some((item) => item.value !== null)
  const dimensions = hasResponses ? buildDimensions(responses) : []
  const topGaps = hasResponses ? buildTopGaps(dimensions) : []
  const criticalParameter = hasResponses ? resolveCriticalParameter(topGaps, responses) : null
  const severityBand = criticalParameter ? resolveSeverityBand(criticalParameter.value) : null
  const developmentPlan = criticalParameter
    ? buildDevelopmentPlan(criticalParameter.code, severityBand)
    : []

  const athleteSelfAnalysis = {
    responses,
    dimensions,
    topGaps,
    criticalParameter: criticalParameter
      ? {
          code: criticalParameter.code,
          value: criticalParameter.value,
          sourceSystem: criticalParameter.sourceSystem,
        }
      : null,
    severityBand,
    radar: dimensions.map((item) => ({
      dimensionCode: item.dimensionCode,
      score: item.score,
    })),
    developmentPlan,
    athleteMessage: source?.athleteMessage || '',
    coachNote: source?.coachNote || '',
    sourceStatus: hasResponses ? 'READY' : 'PENDING_ATHLETE_INPUT',
  }

  const crossAnalysis = buildCrossAnalysis({
    responses,
    dimensions,
    normalizedParameters,
    hasResponses,
    criticalParameter,
    severityBand,
  })

  return { athleteSelfAnalysis, crossAnalysis }
}

function findSnapshotHappyState(snapshot, athleteName) {
  const candidates = [
    ...(snapshot?.happyStates || []),
    ...(snapshot?.athleteHappyStates || []),
    ...(snapshot?.athleteSelfAnalyses || []),
  ]

  return candidates.find((item) => {
    const candidateName =
      item?.athlete ||
      item?.athleteName ||
      item?.name ||
      item?.athleteId

    return athleteNamesMatch(candidateName, athleteName)
  }) || null
}

function normalizeResponses(source) {
  const definitions = [
    ['CONFIDENCE', 'COMANDO'],
    ['ORGANIZATION', 'COMANDO'],
    ['MANAGEMENT', 'COMANDO'],
    ['ANALYSIS', 'COMANDO'],
    ['NERVE', 'COMANDO'],
    ['DISCIPLINE', 'COMANDO'],
    ['OPPORTUNITY', 'COMANDO'],
    ['HEED', 'HAPPY'],
    ['ALIGNMENT', 'HAPPY'],
    ['PLAN', 'HAPPY'],
    ['POWERING', 'HAPPY'],
    ['YEARN', 'HAPPY'],
  ]

  return definitions.map(([code, sourceSystem]) => ({
    code,
    sourceSystem,
    value: normalizeScaleValue(
      source?.[code] ??
        source?.[code.toLowerCase()] ??
        source?.responses?.[code] ??
        source?.responses?.[code.toLowerCase()] ??
        null
    ),
  }))
}

function buildDimensions(responses) {
  return Object.entries(HAPPY_DIMENSIONS).map(([dimensionCode, weights]) => {
    const contributors = weights.map(([parameterCode, weight]) => {
      const response = responses.find((item) => item.code === parameterCode)
      return {
        parameterCode,
        weight,
        value: response?.value ?? null,
        contribution: response?.value === null ? null : roundNumber(response.value * weight),
      }
    })

    const validContributors = contributors.filter((item) => item.value !== null)
    const score = validContributors.length
      ? roundNumber(
          validContributors.reduce((sum, item) => sum + item.value * item.weight, 0)
        )
      : null

    return {
      dimensionCode,
      score,
      contributors,
    }
  })
}

function buildTopGaps(dimensions) {
  return [...dimensions]
    .filter((item) => item.score !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
}

function resolveCriticalParameter(topGaps, responses) {
  const primaryDimension = topGaps[0]
  if (!primaryDimension) return null

  const ranked = [...(primaryDimension.contributors || [])]
    .filter((item) => item.value !== null)
    .sort((a, b) => a.value - b.value)

  const selected = ranked[0]
  if (!selected) return null

  const response = responses.find((item) => item.code === selected.parameterCode)

  return {
    code: selected.parameterCode,
    value: selected.value,
    sourceSystem: response?.sourceSystem || null,
  }
}

function resolveSeverityBand(value) {
  if (value === null) return null
  if (value < 2) return 'CRITICAL'
  if (value < 3) return 'ATTENTION'
  if (value < 4) return 'STABLE'
  if (value < 4.5) return 'HIGH_PERFORMANCE'
  return 'ELITE'
}

function buildDevelopmentPlan(parameterCode, severityBand) {
  const rule = (happyPrescription?.rules || []).find(
    (item) => item.parameter === parameterCode
  )

  if (!rule || !severityBand) return []

  const selectedIds =
    severityBand === 'CRITICAL'
      ? rule.criticalExercises
      : severityBand === 'ATTENTION'
        ? rule.attentionExercises
        : rule.monitorExercises

  return selectedIds
    .map((exerciseId) =>
      (happyLibrary?.entries || []).find((entry) => entry.exerciseId === exerciseId)
    )
    .filter(Boolean)
    .map((entry) => ({
      exerciseId: entry.exerciseId,
      parameter: entry.parameter,
      sourceSystem: entry.sourceSystem,
      name: entry.name,
      objective: entry.objective,
      howToDo: entry.howToDo,
      severityBand,
    }))
}

function buildCrossAnalysis({
  responses,
  dimensions,
  normalizedParameters,
  hasResponses,
  criticalParameter,
  severityBand,
}) {
  const perceptionReadings = responses
    .filter((item) => item.value !== null)
    .map((item) => ({
      parameterCode: item.code,
      value: item.value,
      sourceSystem: item.sourceSystem,
    }))

  const objectiveEvidenceFromHci = (normalizedParameters || []).map((item) => ({
    parameterCode: item.parameterCode,
    score10: item.score,
    score5: normalizeObjectiveToFiveScale(item.score),
    levelCode: item.levelCode,
    reportProfileCode: item.reportProfileCode,
  }))

  const objectiveEvidence =
    objectiveEvidenceFromHci.length > 0
      ? objectiveEvidenceFromHci
      : buildHappyObjectiveEvidenceFallback(dimensions, criticalParameter, severityBand)

  const insights = hasResponses
    ? CROSS_MAPPINGS.map(([perceptionCode, objectiveCode, question]) => {
        const perception = perceptionReadings.find((item) => item.parameterCode === perceptionCode)
        const evidence = objectiveEvidence.find((item) => item.parameterCode === objectiveCode)

        if (!perception || !evidence) {
          return null
        }

        const gap = roundNumber(perception.value - evidence.score5)
        return {
          perceptionCode,
          objectiveCode,
          question,
          athleteFeels: perception.value,
          dataShows: evidence.score5,
          gap,
          divergenceLevel: classifyGap(gap),
        }
      }).filter(Boolean)
    : []

  const coachActions = hasResponses
    ? buildCoachActions(insights, criticalParameter, severityBand)
    : [
        {
          type: 'PENDING_ATHLETE_INPUT',
          message:
            'Athlete self-analysis has not been exported yet. The page is live and ready for the Admin HAPPY payload.',
        },
      ]

  return {
    perceptionReadings,
    objectiveEvidence,
    insights,
    coachActions,
    sourceStatus: hasResponses ? 'READY' : 'PENDING_ATHLETE_INPUT',
  }
}

function buildCoachActions(insights, criticalParameter, severityBand) {
  const topDivergence = [...insights]
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 3)

  const actions = topDivergence.map((item) => ({
    type: 'PERCEPTION_GAP',
    message: `${item.perceptionCode} vs ${item.objectiveCode}: ${item.divergenceLevel}`,
    gap: item.gap,
  }))

  if (criticalParameter && severityBand) {
    actions.unshift({
      type: 'CRITICAL_PARAMETER',
      message: `Primary intervention target: ${criticalParameter.code} (${severityBand}).`,
      parameterCode: criticalParameter.code,
    })
  }

  return actions
}

function buildHappyObjectiveEvidenceFallback(dimensions, criticalParameter, severityBand) {
  const dimensionRows = (dimensions || [])
    .filter((item) => item.score !== null)
    .map((item) => ({
      parameterCode: item.dimensionCode,
      score10: item.score === null ? null : roundNumber(item.score * 2),
      score5: item.score,
      levelCode: 'HAPPY_DIMENSION',
      reportProfileCode: 'HAPPY_INTERNAL',
    }))

  const summaryRows = []

  if (criticalParameter?.code) {
    summaryRows.push({
      parameterCode: `CRITICAL_${criticalParameter.code}`,
      score10: criticalParameter.value === null ? null : roundNumber(criticalParameter.value * 2),
      score5: criticalParameter.value,
      levelCode: severityBand || 'HAPPY_INTERNAL',
      reportProfileCode: 'HAPPY_CRITICAL_PARAMETER',
    })
  }

  return [...summaryRows, ...dimensionRows]
}

function classifyGap(gap) {
  const absoluteGap = Math.abs(Number(gap || 0))
  if (absoluteGap >= 2) return 'HIGH_DIVERGENCE'
  if (absoluteGap >= 1) return 'MODERATE_DIVERGENCE'
  return 'LOW_DIVERGENCE'
}

function normalizeObjectiveToFiveScale(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) return null
  return roundNumber(Math.max(1, Math.min(5, Number(score) / 2)))
}

function normalizeScaleValue(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return null
  return roundNumber(Math.max(1, Math.min(5, numeric)))
}

function roundNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null
  return Math.round(Number(value) * 100) / 100
}
