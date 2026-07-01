export const TAURUS_DECISION_DOMAIN = 'HCI_TAURUS'

export const TAURUS_PARAMETERS = {
  HUMANOID: {
    POSITION: 'TAURUS_HUMANOID_POSITION',
    AIMING: 'TAURUS_HUMANOID_AIMING',
    TRIGGERING: 'TAURUS_HUMANOID_TRIGGERING',
    GRIP: 'TAURUS_HUMANOID_GRIP',
  },
  COLOR: {
    COLOR_IDENTIFICATION: 'TAURUS_COLOR_IDENTIFICATION',
    AIMING: 'TAURUS_COLOR_AIMING',
    TRIGGERING: 'TAURUS_COLOR_TRIGGERING',
    GRIP: 'TAURUS_COLOR_GRIP',
    POSITION: 'TAURUS_COLOR_POSITION',
  },
  DUEL20: {
    BASE_REBUILD: 'TAURUS_DUEL_BASE_REBUILD',
    SERIES_STABILITY: 'TAURUS_DUEL_SERIES_STABILITY',
    DIRECTIONAL_CONTROL: 'TAURUS_DUEL_DIRECTIONAL_CONTROL',
    CENTER_RETENTION: 'TAURUS_DUEL_CENTER_RETENTION',
    TIMING_CONTROL: 'TAURUS_DUEL_TIMING_CONTROL',
  },
}

const LEGACY_PARAMETER_MAP = {
  TARGET_POSITION: TAURUS_PARAMETERS.HUMANOID.POSITION,
  TARGET_AIMING: TAURUS_PARAMETERS.HUMANOID.AIMING,
  TARGET_TRIGGERING: TAURUS_PARAMETERS.HUMANOID.TRIGGERING,
  TARGET_GRIP: TAURUS_PARAMETERS.HUMANOID.GRIP,
  TARGET_COLOR_IDENTIFICATION: TAURUS_PARAMETERS.COLOR.COLOR_IDENTIFICATION,
  PROCESS: TAURUS_PARAMETERS.DUEL20.DIRECTIONAL_CONTROL,
  TRANSFER: TAURUS_PARAMETERS.DUEL20.BASE_REBUILD,
  CONSISTENCY: TAURUS_PARAMETERS.DUEL20.SERIES_STABILITY,
  OUTCOME: TAURUS_PARAMETERS.DUEL20.CENTER_RETENTION,
  RHYTHM: TAURUS_PARAMETERS.DUEL20.TIMING_CONTROL,
}

export function normalizeTaurusParameter(parameter, targetType = '') {
  const normalized = String(parameter || '').trim().toUpperCase()
  if (!normalized) return null
  if (normalized.startsWith('TAURUS_')) return normalized

  if (targetType === 'COLOR') {
    if (normalized === 'TARGET_AIMING') return TAURUS_PARAMETERS.COLOR.AIMING
    if (normalized === 'TARGET_TRIGGERING') return TAURUS_PARAMETERS.COLOR.TRIGGERING
    if (normalized === 'TARGET_GRIP') return TAURUS_PARAMETERS.COLOR.GRIP
    if (normalized === 'TARGET_POSITION') return TAURUS_PARAMETERS.COLOR.POSITION
  }

  return LEGACY_PARAMETER_MAP[normalized] || normalized
}

export function findTaurusTraining(entries, rule, parameter, targetType, fallbackLanguage = 'pt-BR') {
  const taurusParameter = normalizeTaurusParameter(parameter, targetType)
  const legacyParameters = Object.entries(LEGACY_PARAMETER_MAP)
    .filter(([, value]) => value === taurusParameter)
    .map(([key]) => key)

  return entries.find((item) => {
    if (item?.active !== true) return false
    if (item?.category !== rule.category) return false
    if (item?.targetType !== rule.targetType) return false
    if (item?.trainingType !== rule.trainingType) return false
    if (item?.weaponClass !== rule.weaponClass) return false
    if (item?.phase !== rule.phase) return false

    const itemParameter = normalizeTaurusParameter(item?.parameter, targetType)
    return itemParameter === taurusParameter || legacyParameters.includes(item?.parameter)
  }) || buildFallbackTraining(rule, taurusParameter, fallbackLanguage)
}

function buildFallbackTraining(rule, parameter, language) {
  return {
    trainingId: null,
    parameter,
    targetType: rule.targetType,
    category: rule.category,
    title: language === 'pt-BR' ? 'Treino TAURUS corretivo' : 'Corrective TAURUS drill',
    description:
      language === 'pt-BR'
        ? 'Treino corretivo TAURUS liberado pelo motor especifico do alvo.'
        : 'Corrective TAURUS drill selected by the target-specific engine.',
    objective: '',
    executionSummary: '',
    qualityFocus: '',
    loadNote: '',
    coachCues: [],
  }
}
