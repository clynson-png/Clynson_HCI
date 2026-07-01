export const LEVEL_CODES = {
  ELITE: {
    en: 'Elite',
    pt: 'Elite',
  },
  HIGH_PERFORMANCE: {
    en: 'High Performance',
    pt: 'Alto Rendimento',
  },
  INTERMEDIATE: {
    en: 'Intermediate',
    pt: 'Intermediário',
  },
  BEGINNER: {
    en: 'Beginner',
    pt: 'Iniciante',
  },
  NO_BASELINE: {
    en: 'No Baseline',
    pt: 'Sem Linha de Base',
  },
  UNKNOWN: {
    en: 'Unknown',
    pt: 'Desconhecido',
  },
}

export const PARAMETER_CODES = {
  OUTCOME: {
    en: 'Outcome',
    pt: 'Resultado',
  },
  PROCESS: {
    en: 'Process',
    pt: 'Processo',
  },
  RHYTHM: {
    en: 'Rhythm',
    pt: 'Ritmo',
  },
  DEEPENING: {
    en: 'Deepening',
    pt: 'Persistência',
  },
  CONSISTENCY: {
    en: 'Consistency',
    pt: 'Consistência',
  },
  TRANSFER: {
    en: 'Transfer',
    pt: 'Transferência',
  },
  RESILIENCE: {
    en: 'Resilience',
    pt: 'Resiliência',
  },
  PRESSURE: {
    en: 'Pressure',
    pt: 'Pressão',
  },
  EMOTIONAL: {
    en: 'Emotional',
    pt: 'Controle Emocional',
  },
  PHYSICAL: {
    en: 'Physical',
    pt: 'Físico',
  },
}

export const REPORT_PROFILE_CODES = {
  TARGETS: {
    en: 'Targets',
    pt: 'Metas',
  },
  STRUCTURE: {
    en: 'Structure',
    pt: 'Fundamentos',
  },
}

export const READING_CODES = {
  OUTCOME_COMPETITIVE_OUTPUT: {
    en: 'Competitive delivery on the OUTPUT benchmark.',
    pt: 'Atitude competitiva nível elite.',
  },
  PROCESS_ACCEPTABLE_SHOTS: {
    en: 'Acceptable shot continuity.',
    pt: 'Persistência sequencial de tiros de alto valor - aceitável.',
  },
  RHYTHM_TEMPORAL_STABILITY: {
    en: 'STD stability between series.',
    pt: 'Estabilidade do desvio padrão entre séries.',
  },
  DEEPENING_MAX_DEEP_SHOT_SEQUENCE: {
    en: 'Maximum sequence of high value shots.',
    pt: 'Sequência máxima de tiros de alto valor.',
  },
  CONSISTENCY_SERIES_TOTAL_REPEATABILITY: {
    en: 'Repeatability of series totals.',
    pt: 'Repetibilidade dos totais por série.',
  },
  TRANSFER_COMPETITIVE_ENVIRONMENT: {
    en: 'Transfer structure to competitive environment.',
    pt: 'Transferência de fundamentos para ambiente competitivo.',
  },
  RESILIENCE_RECOVERY_AFTER_LOW_SHOTS: {
    en: 'Performance recovery after shots below standard.',
    pt: 'Recuperação de performance depois de tiros abaixo do padrão.',
  },
  PRESSURE_RHYTHM_AND_BREAK_LOAD: {
    en: 'Pressure load combining rhythm and breaks high value shots.',
    pt: 'Carga de pressão combinando ritmo e quebras de sequência de tiros de alto valor.',
  },
  EMOTIONAL_RECURRENT_DROPS: {
    en: 'Emotional control inferred from recurrent drops.',
    pt: 'Controle emocional inferido por quedas recorrentes.',
  },
  PHYSICAL_DEGRADATION_BETWEEN_HALVES: {
    en: 'Physical degradation between test halves.',
    pt: 'Degradação física entre metades da prova.',
  },
  UNKNOWN_READING: {
    en: 'No reading available.',
    pt: 'Leitura não disponível.',
  },
}

export function translateCode(dictionary, code, lang = 'pt') {
  return dictionary?.[code]?.[lang] || dictionary?.[code]?.en || code
}