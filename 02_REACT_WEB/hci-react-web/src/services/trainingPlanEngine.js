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

    periodization: {
      mesocycleCode: coachInput.mesocycleCode || 'UNDEFINED',
      microcycleCode: coachInput.microcycleCode || 'UNDEFINED',
      phaseCode: coachInput.phaseCode || 'UNDEFINED',
      eventCode: coachInput.eventCode || 'UNDEFINED',
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

    coachPrescriptions: athleteView?.trainingPlan?.coachPrescriptions || [],
    availableTrainings: trainingLibrary,
  }
}

export function selectRecommendedTrainings(engineInput) {
  const library = engineInput.availableTrainings || []
  const athleteLevel = engineInput.athlete.levelCode
  const discipline = engineInput.athlete.discipline
  const phaseCode = engineInput.periodization.phaseCode
  const targetType = engineInput.periodization.targetType || null
  const parameterCode = engineInput.periodization.parameterCode || null

  return library.filter((training) => {
    const levelValue = training.levelCode || training.level || null
    const disciplineValue = training.discipline || training.weaponClass || null
    const phaseValue = training.phaseCode || training.phase || null
    const parameterValue = training.parameterCode || training.parameter || null
    const targetValue = training.targetType || training.category || null

    const isActive = training.active !== false
    const levelMatch = !levelValue || levelValue === athleteLevel
    const disciplineMatch = !disciplineValue || disciplineValue === discipline
    const phaseMatch = !phaseCode || phaseCode === 'UNDEFINED' || !phaseValue || phaseValue === phaseCode
    const parameterMatch =
      !parameterCode || parameterCode === 'ALL' || !parameterValue || parameterValue === parameterCode
    const targetMatch =
      !targetType || targetType === 'ALL' || !targetValue || targetValue === targetType

    return isActive && levelMatch && disciplineMatch && phaseMatch && parameterMatch && targetMatch
  })
}

function normalizeTrainingCode(training, index) {
  return training.trainingCode || training.code || training.trainingId || `TRAINING_${index + 1}`
}

function normalizeTrainingTitle(training) {
  return (
    training.trainingTitle ||
    training.title ||
    training.name?.['en-US'] ||
    training.name?.['pt-BR'] ||
    'Untitled Training'
  )
}

function normalizeTrainingDescription(training) {
  return (
    training.description?.['en-US'] ||
    training.description?.['pt-BR'] ||
    training.description ||
    null
  )
}

function normalizeCoachPrescription(item, index) {
  const trainingCode =
    item.trainingCode ||
    item.code ||
    item.trainingId ||
    item.prescriptionId ||
    `COACH_${index + 1}`

  return {
    prescriptionId: item.prescriptionId || `${trainingCode}_COACH_${index + 1}`,
    trainingId: item.trainingId || null,
    trainingCode,
    trainingTitle: item.trainingTitle || item.title || trainingCode,
    blockCode: item.blockCode || item.block || 'MAIN',
    parameterCode: item.parameterCode || item.parameter || null,
    phaseCode: item.phaseCode || item.phase || null,
    sourceType: 'COACH',
    decision: item.decision || 'ADDED',
    notes: item.notes || null,
    createdAt: item.createdAt || null,
    createdBy: item.createdBy || item.prescribedByRole || 'ADMIN_DESKTOP',
    sessionType: item.sessionType || 'TRAINING',
    status: item.status || 'ACTIVE',
  }
}

export function buildTrainingPlanOutput(engineInput) {
  const recommendedTrainings = selectRecommendedTrainings(engineInput)
  const generatedAt = new Date().toISOString()
  const athleteId = engineInput.athlete.id || 'UNDEFINED_ATHLETE'
  const athleteName = engineInput.athlete.name || athleteId
  const phaseCode = engineInput.periodization.phaseCode || 'UNDEFINED'
  const rawCoachPrescriptions = Array.isArray(engineInput.coachPrescriptions)
    ? engineInput.coachPrescriptions
    : []

  const engineRecommendations = recommendedTrainings.map((training, index) => {
    const trainingCode = normalizeTrainingCode(training, index)
    const trainingTitle = normalizeTrainingTitle(training)

    return {
      recommendationId: `${athleteId}_${trainingCode}_REC_${index + 1}`,
      trainingId: training.trainingId || training.id || trainingCode,
      trainingCode,
      trainingTitle,
      blockCode: training.blockCode || 'MAIN',
      parameterCode: training.parameter || training.parameterCode || null,
      phaseCode: training.phase || training.phaseCode || phaseCode,
      priority: index + 1,
      score: recommendedTrainings.length - index,
      reasonCodes: ['PRIMARY_ENGINE_MATCH'],
      reasonText: 'Matched available library filters for this athlete context.',
      sourceType: 'ENGINE',
      status: 'RECOMMENDED',
    }
  })

  const coachPrescriptions = rawCoachPrescriptions.map(normalizeCoachPrescription)

  const prescribedTrainings = engineRecommendations.map((item, index) => ({
    prescriptionId: `${item.recommendationId}_PRESCRIBED`,
    origin: 'ENGINE_APPROVED',
    trainingId: item.trainingId,
    trainingCode: item.trainingCode,
    trainingTitle: item.trainingTitle,
    blockCode: item.blockCode,
    parameterCode: item.parameterCode,
    phaseCode: item.phaseCode,
    sessionType: 'TRAINING',
    modality: engineInput.athlete.discipline || null,
    orderIndex: index + 1,
    prescriptionText: null,
    notes: null,
    status: 'ACTIVE',
  }))

  const prescribedByTrainingCode = new Map(
    prescribedTrainings.map((item) => [item.trainingCode, item])
  )

  const decisionTrace = engineRecommendations.map((item) => ({
    traceId: `${item.recommendationId}_TRACE`,
    trainingCode: item.trainingCode,
    action: 'APPROVED',
    actor: 'ADMIN_BACKEND',
    sourceType: 'ENGINE',
    reasonCodes: item.reasonCodes,
    notes: item.reasonText,
    timestamp: generatedAt,
  }))

  coachPrescriptions.forEach((item, index) => {
    const existingTraining = prescribedByTrainingCode.get(item.trainingCode)

    if (existingTraining) {
      existingTraining.notes = item.notes || existingTraining.notes || null
      existingTraining.status = item.status || existingTraining.status
      existingTraining.prescriptionText =
        item.notes || existingTraining.prescriptionText || null

      const matchingRecommendation = engineRecommendations.find(
        (recommendation) => recommendation.trainingCode === item.trainingCode
      )

      if (matchingRecommendation) {
        matchingRecommendation.status = 'APPROVED'
        matchingRecommendation.sourceType = 'ENGINE'
      }

      decisionTrace.push({
        traceId: `${item.prescriptionId}_TRACE`,
        trainingCode: item.trainingCode,
        action: 'APPROVED',
        actor: item.createdBy,
        sourceType: 'COACH',
        reasonCodes: ['COACH_CONFIRMED_ENGINE_RECOMMENDATION'],
        notes: item.notes,
        timestamp: item.createdAt || generatedAt,
      })

      return
    }

    const nextPrescribedTraining = {
      prescriptionId: item.prescriptionId,
      origin: 'COACH_ADDED',
      trainingId: item.trainingId,
      trainingCode: item.trainingCode,
      trainingTitle: item.trainingTitle,
      blockCode: item.blockCode,
      parameterCode: item.parameterCode,
      phaseCode: item.phaseCode || phaseCode,
      sessionType: item.sessionType,
      modality: engineInput.athlete.discipline || null,
      orderIndex: prescribedTrainings.length + 1,
      prescriptionText: item.notes,
      notes: item.notes,
      status: item.status,
    }

    prescribedTrainings.push(nextPrescribedTraining)
    prescribedByTrainingCode.set(nextPrescribedTraining.trainingCode, nextPrescribedTraining)

    decisionTrace.push({
      traceId: `${item.prescriptionId}_TRACE`,
      trainingCode: item.trainingCode,
      action: item.decision,
      actor: item.createdBy,
      sourceType: 'COACH',
      reasonCodes: ['COACH_ADDED_TO_FINAL_PLAN'],
      notes: item.notes,
      timestamp: item.createdAt || generatedAt,
    })
  })

  return {
    trainingPlan: {
      planId: `${athleteId}_${phaseCode}_PLAN`,
      athleteId,
      athleteName,
      modality: engineInput.athlete.discipline || null,
      levelCode: engineInput.athlete.levelCode || null,
      generatedAt,
      generatedBy: 'ADMIN_BACKEND',
      status: 'DRAFT',
      periodization: engineInput.periodization,
      context: {
        hciScore: engineInput.athlete.hci ?? null,
        priorityParameters: Array.from(
          new Set(
            recommendedTrainings
              .map((training) => training.parameter || training.parameterCode)
              .filter(Boolean)
          )
        ),
        criticalParameter:
          recommendedTrainings[0]?.parameter ||
          recommendedTrainings[0]?.parameterCode ||
          null,
        constraints: [],
        trelloBoardRefs: [],
      },
      engineRecommendations,
      coachPrescriptions,
      prescribedTrainings,
      decisionTrace,
      clickableTrainingDetails: recommendedTrainings.map((training, index) => ({
        trainingId: training.trainingId || training.id || normalizeTrainingCode(training, index),
        trainingCode: normalizeTrainingCode(training, index),
        title: normalizeTrainingTitle(training),
        objectiveCode: training.objectiveCode || training.parameter || null,
        description: normalizeTrainingDescription(training),
      })),
    },
  }
}
