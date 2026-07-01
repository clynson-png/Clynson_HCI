export function buildTrainingPlanEngineInput({
  athleteView,
  coachInput = {},
  trainingLibrary = [],
}) {
  return {
    athlete: {
      id: athleteView?.athlete?.id,
      name: athleteView?.athlete?.name,
      discipline: athleteView?.athlete?.discipline,
      levelCode: athleteView?.summary?.levelCode,
      hci: athleteView?.summary?.hci,
    },

    coachInput: {
      mesocycleCode: coachInput.mesocycleCode || 'UNDEFINED',
      microcycleCode: coachInput.microcycleCode || 'UNDEFINED',
      phaseCode: coachInput.phaseCode || 'UNDEFINED',
      eventCode: coachInput.eventCode || 'UNDEFINED',
      targetType: coachInput.targetType || null,
      primaryOpportunity: coachInput.primaryOpportunity || null,
    },

    loadDistribution: {
      AT: Number(coachInput.AT || 0),
      PT: Number(coachInput.PT || 0),
      P: Number(coachInput.P || 0),
      Q: Number(coachInput.Q || 0),
      W: Number(coachInput.W || 0),
      COM: Number(coachInput.COM || 0),
      SC: Number(coachInput.SC || 0),
      RT: Number(coachInput.RT || 0),
    },

    availableTrainings: trainingLibrary,
  }
}

export function selectRecommendedTrainings(engineInput) {
  const library = engineInput.availableTrainings || []
  const athleteLevel = engineInput.athlete.levelCode
  const discipline = engineInput.athlete.discipline
  const targetType = engineInput.coachInput?.targetType
  const primaryOpportunity = engineInput.coachInput?.primaryOpportunity

  const filteredByLevelAndDiscipline = library.filter((training) => {
    const levelMatch =
      !training.levelCode || training.levelCode === athleteLevel

    const disciplineMatch =
      !training.discipline || training.discipline === discipline

    return levelMatch && disciplineMatch
  })

  if (!primaryOpportunity && !targetType) {
    return filteredByLevelAndDiscipline
  }

  const filteredByOpportunity = filteredByLevelAndDiscipline.filter((training) => {
    const parameterMatch =
      !primaryOpportunity || training.parameter === primaryOpportunity
    const targetMatch =
      !targetType || training.targetType === targetType
    return parameterMatch && targetMatch
  })

  return filteredByOpportunity.length > 0
    ? filteredByOpportunity
    : filteredByLevelAndDiscipline
}

export function buildTrainingPlanOutput(engineInput) {
  const recommendedTrainings = selectRecommendedTrainings(engineInput)

  return {
    mesocycle: engineInput.periodization,
    microcycle: {},
    engineRecommendations: recommendedTrainings,
    coachPrescriptions: [],
    prescribedTrainings: recommendedTrainings,
    clickableTrainingDetails: recommendedTrainings.map((training) => ({
      id: training.id,
      title: training.title,
      code: training.code,
      objectiveCode: training.objectiveCode,
      description: training.description,
    })),
  }
}