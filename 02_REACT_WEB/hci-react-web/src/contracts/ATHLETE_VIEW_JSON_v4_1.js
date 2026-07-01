export const ATHLETE_VIEW_JSON_V4_1 = {
  metadata: {
    schemaVersion: '4.1',
    nativeLanguage: 'en',
    generatedAt: null,
    generatedBy: 'ADMIN_WEB',
    sourceSnapshotVersion: null,
    appRenderVersion: null,
  },

  athlete: {
    id: null,
    name: null,
    email: null,
    discipline: null,
    levelCode: null,
  },

  summary: {
    hci: null,
    levelCode: null,
    latestTotal: null,
    medianTotal: null,
    sessionsCount: 0,
    targetSessionsCount: 0,
    prescriptionsCount: 0,
  },

  indices: {
    overallHci: null,
    targets: [],
    structure: [],
    allParameters: [],
  },

  rhythm: {
    latestSession: null,
    sessions: [],
    rhythmMain: [],
    rhythmPath: [],
    stdBySeries: [],
    comparison: [],
  },

  targetIntelligence: {
    sessions: [],
    selectedSession: null,
    dominantDirection: null,
    secondaryDirection: null,
    zones: [],
    idd: null,
    recommendedTraining: null,
  },

  athleteSelfAnalysis: {
    responses: [],
    dimensions: [],
    topGaps: [],
    criticalParameter: null,
    severityBand: null,
    radar: [],
    developmentPlan: [],
  },

  crossAnalysis: {
    perceptionReadings: [],
    objectiveEvidence: [],
    insights: [],
    coachActions: [],
  },

  trainingPlan: {
    mesocycle: {},
    microcycle: {},
    engineRecommendations: [],
    coachPrescriptions: [],
    prescribedTrainings: [],
    clickableTrainingDetails: [],
  },

  physicalTraining: {
    profile: {},
    engineRecommendations: [],
    coachPrescriptions: [],
    prescribedSessions: [],
    clickableExerciseDetails: [],
  },

  reports: {
    athleteSummary: {},
    coachSummary: {},
    recommendations: [],
  },

  exportPackage: {
    appRenderBlocks: [],
    downloadableFiles: [],
    syncStatus: {},
  },
}
