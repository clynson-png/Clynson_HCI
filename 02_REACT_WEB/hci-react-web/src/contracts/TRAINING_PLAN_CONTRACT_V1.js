export const TRAINING_PLAN_CONTRACT_V1 = {
  trainingPlan: {
    planId: 'string',
    athleteId: 'string',
    athleteName: 'string',
    athleteEmail: 'string|null',
    modality: 'PISTOL|RIFLE|null',
    levelCode: 'string|null',
    generatedAt: 'timestamp',
    generatedBy: 'ADMIN_BACKEND',
    status: 'DRAFT|APPROVED|ARCHIVED',

    periodization: {
      mesocycleCode: 'string',
      microcycleCode: 'string',
      phaseCode: 'string',
      eventCode: 'string',
    },

    context: {
      hciScore: 'number|null',
      priorityParameters: 'string[]',
      criticalParameter: 'string|null',
      constraints: 'array',
      trelloBoardRefs: 'array',
    },

    engineRecommendations: [
      {
        recommendationId: 'string',
        trainingId: 'string',
        trainingCode: 'string',
        trainingTitle: 'string',
        blockCode: 'string',
        parameterCode: 'string|null',
        phaseCode: 'string|null',
        priority: 'number',
        score: 'number|null',
        reasonCodes: 'string[]',
        reasonText: 'string|null',
        sourceType: 'ENGINE',
        status: 'RECOMMENDED|BLOCKED|APPROVED|REJECTED|REPLACED',
      },
    ],

    coachPrescriptions: [
      {
        prescriptionId: 'string',
        trainingId: 'string|null',
        trainingCode: 'string',
        trainingTitle: 'string',
        blockCode: 'string',
        parameterCode: 'string|null',
        sourceType: 'COACH',
        decision: 'ADDED|APPROVED|REJECTED|REPLACED|REMOVED',
        notes: 'string|null',
        createdAt: 'timestamp',
        createdBy: 'string',
      },
    ],

    prescribedTrainings: [
      {
        prescriptionId: 'string',
        origin: 'ENGINE_APPROVED|COACH_ADDED|ENGINE_REPLACED',
        trainingId: 'string|null',
        trainingCode: 'string',
        trainingTitle: 'string',
        blockCode: 'string',
        parameterCode: 'string|null',
        phaseCode: 'string|null',
        sessionType: 'TRAINING|SIMULATION|COMPETITION|null',
        modality: 'PISTOL|RIFLE|null',
        orderIndex: 'number',
        prescriptionText: 'string|null',
        notes: 'string|null',
        status: 'ACTIVE|ARCHIVED|REMOVED',
      },
    ],

    decisionTrace: [
      {
        traceId: 'string',
        trainingCode: 'string',
        action: 'ADDED|APPROVED|REJECTED|REPLACED|REMOVED',
        actor: 'string',
        sourceType: 'ENGINE|COACH',
        reasonCodes: 'string[]',
        notes: 'string|null',
        timestamp: 'timestamp',
      },
    ],

    clickableTrainingDetails: [
      {
        trainingId: 'string|null',
        trainingCode: 'string',
        title: 'string',
        objectiveCode: 'string|null',
        description: 'string|null',
      },
    ],
  },

  dictionaries: {
    trainingPlanStatus: ['DRAFT', 'APPROVED', 'ARCHIVED'],
    trainingPlanSourceType: ['ENGINE', 'COACH'],
    trainingPlanOrigin: ['ENGINE_APPROVED', 'COACH_ADDED', 'ENGINE_REPLACED'],
    trainingPlanDecision: ['ADDED', 'APPROVED', 'REJECTED', 'REPLACED', 'REMOVED'],
    trainingPlanItemStatus: ['ACTIVE', 'ARCHIVED', 'REMOVED'],
    trainingPlanRecommendationStatus: [
      'RECOMMENDED',
      'BLOCKED',
      'APPROVED',
      'REJECTED',
      'REPLACED',
    ],
    trainingPlanBlockCode: [
      'WARMUP',
      'TECHNICAL',
      'MAIN',
      'MENTAL',
      'TARGET',
      'COOLDOWN',
    ],
  },
}
