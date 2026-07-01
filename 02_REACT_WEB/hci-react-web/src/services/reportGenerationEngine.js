import { mapSnapshotToAthleteView } from './athleteViewMapper'
import { athleteNamesMatch, resolveExistingAthleteName } from './athleteIdentity'

export function buildDirectionalReportFromSnapshot(snapshot, options = {}) {
  const athleteName = resolveExistingAthleteName(snapshot, options.athleteName)
  if (!athleteName) return null
  const athleteView = mapSnapshotToAthleteView(snapshot, athleteName)

  const approvedSessions = collectApprovedSessions(snapshot, athleteName)
  const filteredSessions = approvedSessions.filter((session) =>
    matchesReportFilter(session, options)
  )
  const directionalSessions = filteredSessions.filter((session) =>
    session.directions.some(Boolean)
  )

  if (directionalSessions.length === 0) {
    return {
      reportType: 'GENERATED_DIRECTIONAL_REPORT',
      athleteName,
      filterMode: options.filterMode || 'SELECTED_EVENT',
      filterLabel: buildFilterLabel(options),
      sessions: [],
      aggregate: null,
      athleteView,
      generatedAt: Date.now(),
    }
  }

  const eventReports = directionalSessions.map((session) => buildEventDirectionalReport(session))
  const aggregate = buildAggregateDirectionalReport(eventReports, athleteName, options)

  return {
    reportType: 'GENERATED_DIRECTIONAL_REPORT',
    athleteName,
    filterMode: options.filterMode || 'SELECTED_EVENT',
    filterLabel: buildFilterLabel(options),
    sessions: eventReports,
    aggregate,
    athleteView,
    generatedAt: Date.now(),
  }
}

function collectApprovedSessions(snapshot, athleteName) {
  const headers = (snapshot?.sessionHeaders || []).filter(
    (item) => athleteNamesMatch(item.athleteName, athleteName) && item.sessionStatus === 'APPROVED'
  )

  if (headers.length > 0) {
    return headers.map((header) => {
      const series = (snapshot?.sessionSeries || [])
        .filter((item) => item.sessionId === header.sessionId)
        .sort((a, b) => Number(a.seriesOrder || 0) - Number(b.seriesOrder || 0))

      const seriesRows = series.map((item) => ({
        serie: item.seriesCode,
        tiros: item.shotValuesCsv || '',
        total: Number(item.seriesTotal || 0),
        directions: (snapshot?.sessionShots || [])
          .filter((shot) => shot.seriesId === item.seriesId)
          .sort((a, b) => Number(a.shotNumber || 0) - Number(b.shotNumber || 0))
          .map((shot) => String(shot.directionCode || '').trim()),
      }))

      const scores = seriesRows.flatMap((row) =>
        String(row.tiros || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      )

      const directions = seriesRows.flatMap((row) => row.directions || [])

      return {
        sessionId: header.sessionId,
        athleteName: header.athleteName || '',
        eventCode: header.eventCode || '',
        sessionType: denormalizeSessionType(header.sessionType),
        modality: header.modality || '',
        sessionDate: header.sessionDate || '',
        totalScore: Number(header.totalScore || sumScores(scores)),
        shotCount: Number(header.shotCount || scores.length),
        seriesRows,
        scores,
        directions,
      }
    })
  }

  const legacyRows = (snapshot?.shotSeries || []).filter((item) => athleteNamesMatch(item.atleta, athleteName))
  const grouped = new Map()

  legacyRows.forEach((row) => {
    const sessionId =
      row.sessionId || row.idBloco || `${row.atleta}|${row.evento}|${row.sessao}|${row.prova}`
    if (!grouped.has(sessionId)) {
      grouped.set(sessionId, {
        sessionId,
        athleteName: row.atleta || '',
        eventCode: row.evento || '',
        sessionType: row.sessao || 'TREINO',
        modality: row.prova || '',
        sessionDate: row.dataColeta || '',
        seriesRows: [],
      })
    }

    grouped.get(sessionId).seriesRows.push({
      serie: row.serie,
      tiros: row.tiros || '',
      total: sumScores(
        String(row.tiros || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      ),
      directions: Array.isArray(row.directions) ? row.directions : [],
    })
  })

  return Array.from(grouped.values()).map((session) => {
    const orderedSeries = [...session.seriesRows].sort((a, b) => {
      const aOrder = Number(String(a.serie || '').replace(/\D/g, '')) || 0
      const bOrder = Number(String(b.serie || '').replace(/\D/g, '')) || 0
      return aOrder - bOrder
    })
    const scores = orderedSeries.flatMap((row) =>
      String(row.tiros || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    )
    const directions = orderedSeries.flatMap((row) => row.directions || [])

    return {
      ...session,
      totalScore: sumScores(scores),
      shotCount: scores.length,
      seriesRows: orderedSeries,
      scores,
      directions,
    }
  })
}

function matchesReportFilter(session, options) {
  const mode = options.filterMode || 'SELECTED_EVENT'
  if (mode === 'ALL_EVENTS') return true
  if (mode === 'TRAINING_SIMULATION') {
    return ['TREINO', 'SIMULADO'].includes(String(session.sessionType || '').toUpperCase())
  }
  if (mode === 'COMPETITION_ONLY') {
    return String(session.sessionType || '').toUpperCase() === 'COMPETICAO'
  }
  return session.eventCode === options.selectedEventCode
}

function buildFilterLabel(options) {
  const mode = options.filterMode || 'SELECTED_EVENT'
  if (mode === 'ALL_EVENTS') return 'Todos os eventos'
  if (mode === 'TRAINING_SIMULATION') return 'Só treinos e simulados'
  if (mode === 'COMPETITION_ONLY') return 'Só competições'
  return `Evento selecionado: ${options.selectedEventCode || '-'}`
}

function buildEventDirectionalReport(session) {
  const directionalBreakdown = buildDirectionalBreakdown(
    session.modality,
    session.directions,
    session.scores
  )
  const dominant = directionalBreakdown.primaryRows[0]
  const weakestSeries = [...session.seriesRows].sort((a, b) => Number(a.total || 0) - Number(b.total || 0))[0]

  return {
    sessionId: session.sessionId,
    athleteName: session.athleteName,
    eventLabel: session.eventCode,
    sessionType: session.sessionType,
    modality: session.modality,
    sessionDate: session.sessionDate,
    scores: session.scores,
    directions: session.directions,
    report: {
      reportTitle: 'HCI Premium Directional Report',
      subtitle: `${session.eventCode} • ${session.sessionType} • ${session.modality}`,
      seriesTotals: session.seriesRows.map((row) => ({
        seriesCode: row.serie,
        total: Number(row.total || 0),
      })),
      officialMetrics: [
        { label: 'Total', value: Number(session.totalScore || 0).toFixed(session.modality === 'RIFLE' ? 1 : 0) },
        { label: 'Shots', value: String(session.shotCount || 0) },
        { label: 'Dominante', value: dominant?.label || '-' },
      ],
      directionalRows: directionalBreakdown.primaryRows,
      secondaryDirectionalRows: directionalBreakdown.secondaryRows,
      insights: [
        dominant
          ? `A direção dominante do evento ficou em ${dominant.label}, concentrando ${dominant.value} do peso direcional.`
          : 'Sem direção dominante consolidada.',
        weakestSeries
          ? `A série mais fraca foi ${weakestSeries.serie} com ${Number(weakestSeries.total || 0).toFixed(session.modality === 'RIFLE' ? 1 : 0)}.`
          : 'Não foi possível determinar a série mais fraca.',
      ],
      correction: dominant
        ? `Priorizar correção técnica na faixa ${dominant.label} e revisar o processo de ruptura nas séries com maior dispersão.`
        : '',
      trainingProposal: `Montar bloco específico de ${session.sessionType === 'COMPETICAO' ? 'transferência competitiva' : 'controle técnico'} com chamada direcional antes da leitura do resultado.`,
      keyPhrase: dominant
        ? `A direção crítica está em ${dominant.label}; o treino precisa proteger a repetibilidade do processo.`
        : 'Relatório direcional disponível para revisão.',
      evidenceNote: `${session.shotCount || 0} tiros com direção disponível neste evento.`,
    },
  }
}

function buildAggregateDirectionalReport(eventReports, athleteName, options) {
  const modality = eventReports[0]?.modality || 'PISTOL'
  const allDirections = eventReports.flatMap((item) => item.directions || [])
  const allScores = eventReports.flatMap((item) => item.scores || [])
  const directionalBreakdown = buildDirectionalBreakdown(modality, allDirections, allScores)
  const dominant = directionalBreakdown.primaryRows[0]

  return {
    athleteName,
    eventLabel: buildFilterLabel(options),
    sessionType: 'AGRUPADO',
    modality,
    sessionDate: '',
    scores: allScores,
    directions: allDirections,
    report: {
      reportTitle: 'HCI Premium Aggregate Directional Report',
      subtitle: `${buildFilterLabel(options)} • ${eventReports.length} evento(s)`,
      seriesTotals: [],
      officialMetrics: [
        { label: 'Eventos', value: String(eventReports.length) },
        { label: 'Tiros com direção', value: String(allDirections.filter(Boolean).length) },
        { label: 'Dominante', value: dominant?.label || '-' },
      ],
      directionalRows: directionalBreakdown.primaryRows,
      secondaryDirectionalRows: directionalBreakdown.secondaryRows,
      insights: [
        dominant
          ? `No agrupado do atleta ${athleteName}, a direção dominante ficou em ${dominant.label}.`
          : `No agrupado do atleta ${athleteName}, não houve direção dominante clara.`,
        `O relatório consolida ${eventReports.length} evento(s) com leitura direcional disponível.`,
      ],
      correction: dominant
        ? `Usar ${dominant.label} como foco principal de ajuste técnico e comparar sua incidência entre os eventos.`
        : '',
      trainingProposal: 'Distribuir sessões de revisão técnica, transferência e competição conforme o filtro selecionado.',
      keyPhrase: 'O padrão direcional consolidado precisa dialogar com o contexto dos eventos.',
      evidenceNote: 'Relatório gerado a partir do snapshot ativo do Admin.',
    },
  }
}

function buildDirectionalBreakdown(modality, directions, scores) {
  const normalizedDirections = directions.map((value, index) => ({
    code: normalizeDirectionCode(value, modality),
    score: scores[index] || '',
  })).filter((item) => item.code)

  if (String(modality || '').toUpperCase() === 'RIFLE') {
    const quadrantMap = {
      Q1: 'Direita',
      Q2: 'Alto',
      Q3: 'Baixo',
      Q4: 'Esquerda',
      N: 'Alto',
      NE: 'Direita',
      E: 'Direita',
      SE: 'Baixo',
      S: 'Baixo',
      SW: 'Esquerda',
      W: 'Esquerda',
      NW: 'Alto',
    }

    const primaryRows = buildPercentageRows(
      normalizedDirections,
      ['Alto', 'Direita', 'Baixo', 'Esquerda'],
      (item) => quadrantMap[item.code] || item.code
    )
    const secondaryRows = buildPercentageRows(
      normalizedDirections,
      ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
      (item) => compassFromRifleCode(item.code)
    )

    return { primaryRows, secondaryRows }
  }

  const pistolOrder = ['UP', 'UPPER_RIGHT', 'RIGHT', 'LOWER_RIGHT', 'DOWN', 'LOWER_LEFT', 'LEFT', 'UPPER_LEFT']
  const pistolLabels = {
    UP: 'Superior',
    UPPER_RIGHT: 'Superior direita',
    RIGHT: 'Direita',
    LOWER_RIGHT: 'Inferior direita',
    DOWN: 'Inferior',
    LOWER_LEFT: 'Inferior esquerda',
    LEFT: 'Esquerda',
    UPPER_LEFT: 'Superior esquerda',
  }

  return {
    primaryRows: buildPercentageRows(
      normalizedDirections,
      pistolOrder,
      (item) => item.code,
      pistolLabels
    ),
    secondaryRows: [],
  }
}

function buildPercentageRows(items, order, resolver, labels = {}) {
  const total = items.length || 1
  const counts = new Map(order.map((key) => [key, 0]))

  items.forEach((item) => {
    const key = resolver(item)
    if (counts.has(key)) {
      counts.set(key, counts.get(key) + 1)
    }
  })

  return order
    .map((key) => ({
      code: key,
      label: labels[key] || key,
      numericValue: (counts.get(key) / total) * 100,
      value: `${((counts.get(key) / total) * 100).toFixed(1)}%`,
      hits: counts.get(key),
    }))
    .sort((a, b) => b.numericValue - a.numericValue)
}

function normalizeDirectionCode(value, modality) {
  const clean = String(value || '').trim().toUpperCase()
  if (!clean) return ''

  if (String(modality || '').toUpperCase() === 'RIFLE') {
    const rifleMap = {
      CENTER: '',
      UP: 'N',
      RIGHT: 'E',
      DOWN: 'S',
      LEFT: 'W',
      UPPER_RIGHT: 'NE',
      LOWER_RIGHT: 'SE',
      LOWER_LEFT: 'SW',
      UPPER_LEFT: 'NW',
      Q1: 'Q1',
      Q2: 'Q2',
      Q3: 'Q3',
      Q4: 'Q4',
    }
    return rifleMap[clean] || clean
  }

  return clean
}

function compassFromRifleCode(code) {
  const map = {
    Q1: 'NE',
    Q2: 'NW',
    Q3: 'S',
    Q4: 'SW',
    N: 'N',
    NE: 'NE',
    E: 'E',
    SE: 'SE',
    S: 'S',
    SW: 'SW',
    W: 'W',
    NW: 'NW',
  }
  return map[code] || code
}

function sumScores(scores) {
  return (scores || []).reduce((sum, value) => {
    const numeric = Number(String(value || '').replace(/[xX]/g, '').trim())
    return sum + (Number.isNaN(numeric) ? 0 : numeric)
  }, 0)
}

function denormalizeSessionType(value) {
  const normalizedValue = String(value || '').trim().toUpperCase()
  if (normalizedValue === 'TRAINING') return 'TREINO'
  if (normalizedValue === 'SIMULATION') return 'SIMULADO'
  if (normalizedValue === 'COMPETITION') return 'COMPETICAO'
  return normalizedValue || 'TREINO'
}
