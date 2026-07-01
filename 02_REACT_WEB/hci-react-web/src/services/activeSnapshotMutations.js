function buildSessionId(payload) {
  return (
    payload.sessionId ||
    payload.blockId ||
    [
      payload.athlete || 'UNKNOWN',
      payload.event || 'EV',
      payload.sessionType || 'TREINO',
      payload.modality || 'MODALITY',
      Date.now(),
    ].join('_')
  )
}

function normalizeScore(value) {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

function calculateSeriesTotal(scores) {
  const total = scores.reduce((sum, value) => {
    const cleanValue = String(value || '').replace('x', '').replace('X', '')
    const numericValue = Number(cleanValue)
    return sum + (Number.isNaN(numericValue) ? 0 : numericValue)
  }, 0)

  return Number(total.toFixed(1))
}

function normalizeSessionType(value) {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'TREINO' || normalized === 'TRAINING') return 'TRAINING'
  if (normalized === 'SIMULADO' || normalized === 'SIMULATION') return 'SIMULATION'
  if (normalized === 'COMPETICAO' || normalized === 'COMPETITION') return 'COMPETITION'
  return normalized || 'TRAINING'
}

function normalizeEventStatus(value) {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'FINAL') return 'FINAL'
  return 'PARTIAL'
}

function normalizeNumericScore(value) {
  const cleanValue = String(value || '').replace('x', '').replace('X', '')
  const numericValue = Number(cleanValue)
  return Number.isNaN(numericValue) ? value : numericValue
}

function buildCompatibilityShotSeriesRows(payload, sessionId) {
  const scores = payload.scores || []
  const directions = payload.directions || []
  const sourceType = payload.sourceType || 'ADMIN_REACT'
  const status = payload.status || 'ADMIN_APPROVED'
  const reviewFlag = payload.reviewFlag || 'ADMIN_REVIEWED'

  return Array.from({ length: 6 }).map((_, serieIndex) => {
    const start = serieIndex * 10
    const serieScores = scores.slice(start, start + 10).map(normalizeScore)
    const serieDirections = directions
      .slice(start, start + 10)
      .map((value) => String(value || '').trim())

    return {
      sessionId,
      chaveSerie: `${sessionId}_SR${serieIndex + 1}`,
      dataColeta: payload.date || '',
      prova: payload.modality || '',
      atleta: payload.athlete || '',
      evento: payload.event || '',
      sessao: payload.sessionType || '',
      idBloco: sessionId,
      statusEvento: serieIndex === 5 ? 'FINAL' : 'PARCIAL',
      serie: `SR${serieIndex + 1}`,
      tiros: serieScores.join(','),
      directions: serieDirections,
      sourceType,
      status,
      reviewFlag,
      createdAt: payload.createdAt || new Date().toISOString(),
      hciSerieOrder: serieIndex + 1,
      hciEventRowValid: 1,
      total: calculateSeriesTotal(serieScores),
    }
  })
}

function buildCanonicalIssfState(payload, sessionId) {
  const createdAtMs = Date.parse(payload.createdAt || '') || Date.now()
  const shotSeriesRows = buildCompatibilityShotSeriesRows(payload, sessionId)

  const sessionHeader = {
    sessionId,
    athleteId: payload.athlete || '',
    athleteName: payload.athlete || '',
    eventCode: payload.event || '',
    sessionType: normalizeSessionType(payload.sessionType),
    modality: payload.modality || '',
    sessionDate: payload.date || '',
    sourceType: payload.sourceType || 'ADMIN_REACT',
    sessionStatus: payload.sessionStatus || 'APPROVED',
    reviewStatus: payload.reviewStatus || 'REVIEWED',
    seriesCount: shotSeriesRows.length,
    shotCount: (payload.scores || []).filter((value) => String(value || '').trim() !== '').length,
    totalScore: shotSeriesRows.reduce((sum, row) => sum + Number(row.total || 0), 0),
    notes: payload.notes || null,
    rawImportJson: payload.rawImportJson || null,
    createdAt: createdAtMs,
    updatedAt: createdAtMs,
    approvedAt: payload.sessionStatus === 'PENDING_REVIEW' ? null : createdAtMs,
    archivedAt: payload.sessionStatus === 'ARCHIVED' ? createdAtMs : null,
  }

  const canonicalSeries = shotSeriesRows.map((row, index) => ({
    seriesId: row.chaveSerie,
    sessionId,
    seriesCode: row.serie,
    seriesOrder: index + 1,
    eventStatus: normalizeEventStatus(row.statusEvento),
    seriesTotal: Number(row.total || 0),
    shotValuesCsv: row.tiros,
    createdAt: createdAtMs,
    updatedAt: createdAtMs,
  }))

  const canonicalShots = shotSeriesRows.flatMap((row) => {
    const values = String(row.tiros || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    return values.map((value, shotIndex) => ({
      shotId: `${row.chaveSerie}_T${shotIndex + 1}`,
      sessionId,
      seriesId: row.chaveSerie,
      seriesCode: row.serie,
      shotNumber: shotIndex + 1,
      score: normalizeNumericScore(value),
      directionCode: row.directions?.[shotIndex] || null,
      xValue: null,
      yValue: null,
      innerTen: null,
      confidence: null,
      createdAt: createdAtMs,
    }))
  })

  return { shotSeriesRows, sessionHeader, canonicalSeries, canonicalShots }
}

function removeSessionEntities(snapshot, sessionId) {
  return {
    ...snapshot,
    pendingGroups: (snapshot?.pendingGroups || []).filter((item) => {
      const itemId = item.key || item.sessionId || item.idBloco
      return itemId !== sessionId
    }),
    archivedIssfSessions: (snapshot?.archivedIssfSessions || []).filter(
      (item) => item.sessionKey !== sessionId
    ),
    shotSeries: (snapshot?.shotSeries || []).filter((row) => {
      const rowSessionId = row.sessionId || row.idBloco
      return rowSessionId !== sessionId
    }),
    sessionHeaders: (snapshot?.sessionHeaders || []).filter((item) => item.sessionId !== sessionId),
    sessionSeries: (snapshot?.sessionSeries || []).filter((item) => item.sessionId !== sessionId),
    sessionShots: (snapshot?.sessionShots || []).filter((item) => item.sessionId !== sessionId),
  }
}

function buildPendingSeriesRows(payload) {
  const sessionId = buildSessionId(payload)
  const scores = payload.scores || []
  const directions = payload.directions || []
  const now = payload.createdAt || new Date().toISOString()

  return Array.from({ length: 6 }).map((_, serieIndex) => {
    const start = serieIndex * 10
    const serieScores = scores.slice(start, start + 10).map(normalizeScore)
    const serieDirections = directions
      .slice(start, start + 10)
      .map((value) => String(value || '').trim())

    return {
      submissionId: `${sessionId}_SR${serieIndex + 1}`,
      sessionId,
      chaveSerie: `${sessionId}_SR${serieIndex + 1}`,
      dataColeta: payload.date || '',
      athlete: payload.athlete || '',
      event: payload.event || '',
      session: payload.sessionType || '',
      prova: payload.modality || '',
      serie: `SR${serieIndex + 1}`,
      shots: serieScores.join(','),
      tiros: serieScores.join(','),
      directions: serieDirections,
      source: payload.sourceType || 'ADMIN_MANUAL_DATA_ENTRY',
      sourceType: payload.sourceType || 'ADMIN_MANUAL_DATA_ENTRY',
      notes: payload.notes || 'Entrada manual criada no Admin para revisão.',
      status: 'PENDING_COACH_REVIEW',
      reviewFlag: 'PENDING_REVIEW',
      submittedAt: Date.now() + serieIndex,
      createdAt: now,
      total: calculateSeriesTotal(serieScores),
    }
  })
}

export function appendPendingIssfSessionToSnapshot(snapshot, payload) {
  const sessionId = buildSessionId(payload)
  const pendingRows = buildPendingSeriesRows({ ...payload, sessionId })
  const createdAtMs = Date.parse(payload.createdAt || '') || Date.now()

  const existingPendingGroups = snapshot?.pendingGroups || []

  const preservedPendingGroups = existingPendingGroups.filter((group) => {
    const groupId = group.key || group.sessionId || group.idBloco
    return groupId !== sessionId
  })

  const pendingGroup = {
    key: sessionId,
    sessionId,
    athlete: payload.athlete || '',
    event: payload.event || '',
    session: payload.sessionType || '',
    prova: payload.modality || '',
    source: payload.sourceType || 'ADMIN_MANUAL_DATA_ENTRY',
    seriesCount: pendingRows.length,
    shotCount: pendingRows.reduce((sum, row) => {
      return sum + String(row.shots || '').split(',').filter(Boolean).length
    }, 0),
    complete: pendingRows.length === 6,
    total: pendingRows.reduce((sum, row) => sum + Number(row.total || 0), 0),
    rows: pendingRows,
    seriesRows: pendingRows,
    status: 'PENDING_COACH_REVIEW',
    reviewFlag: 'PENDING_REVIEW',
    createdAt: payload.createdAt || new Date().toISOString(),
  }

  const pendingHeader = {
    sessionId,
    athleteId: payload.athlete || '',
    athleteName: payload.athlete || '',
    eventCode: payload.event || '',
    sessionType: normalizeSessionType(payload.sessionType),
    modality: payload.modality || '',
    sessionDate: payload.date || '',
    sourceType: payload.sourceType || 'ADMIN_MANUAL_DATA_ENTRY',
    sessionStatus: 'PENDING_REVIEW',
    reviewStatus: 'PENDING',
    seriesCount: pendingRows.length,
    shotCount: pendingRows.reduce((sum, row) => {
      return sum + String(row.shots || '').split(',').filter(Boolean).length
    }, 0),
    totalScore: pendingRows.reduce((sum, row) => sum + Number(row.total || 0), 0),
    notes: payload.notes || null,
    rawImportJson: null,
    createdAt: createdAtMs,
    updatedAt: createdAtMs,
    approvedAt: null,
    archivedAt: null,
  }

  const preservedHeaders = (snapshot?.sessionHeaders || []).filter(
    (item) => item.sessionId !== sessionId
  )

  return {
    ...snapshot,
    sessionHeaders: [...preservedHeaders, pendingHeader],
    pendingGroups: [...preservedPendingGroups, pendingGroup],
  }
}

export function appendIssfSessionToSnapshot(snapshot, payload) {
  const sessionId = buildSessionId(payload)
  const { shotSeriesRows, sessionHeader, canonicalSeries, canonicalShots } =
    buildCanonicalIssfState(payload, sessionId)
  const reducedSnapshot = removeSessionEntities(snapshot, sessionId)

  return {
    ...reducedSnapshot,
    sessionHeaders: [...(reducedSnapshot?.sessionHeaders || []), sessionHeader],
    sessionSeries: [...(reducedSnapshot?.sessionSeries || []), ...canonicalSeries],
    sessionShots: [...(reducedSnapshot?.sessionShots || []), ...canonicalShots],
    shotSeries: [...(reducedSnapshot?.shotSeries || []), ...shotSeriesRows],
  }
}

export function approvePendingIssfSession(snapshot, payload) {
  const approvedSnapshot = appendIssfSessionToSnapshot(snapshot, {
    ...payload,
    sessionStatus: 'APPROVED',
    reviewStatus: 'REVIEWED',
  })

  return {
    ...approvedSnapshot,
    pendingGroups: (approvedSnapshot?.pendingGroups || []).filter((item) => {
      const itemId = item.key || item.sessionId || item.idBloco
      return itemId !== payload.sessionId
    }),
  }
}

export function archiveIssfSession(snapshot, sessionRecord) {
  const archivedPayload = {
    sessionId: sessionRecord.sessionKey || sessionRecord.sessionId,
    athlete: sessionRecord.athlete,
    event: sessionRecord.event,
    sessionType: sessionRecord.session,
    modality: sessionRecord.prova,
    date: sessionRecord.seriesRows?.[0]?.dataColeta || '',
    scores: (sessionRecord.seriesRows || []).flatMap((row) =>
      String(row.tiros || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    ),
    directions: (sessionRecord.seriesRows || []).flatMap((row) => {
      if (Array.isArray(row.directions) && row.directions.length > 0) {
        return row.directions.map((value) => String(value || '').trim())
      }

      return Array.from({ length: 10 }, () => '')
    }),
    sourceType: sessionRecord.seriesRows?.[0]?.sourceType || 'ADMIN_REACT',
    status: 'ADMIN_APPROVED',
    reviewFlag: 'ADMIN_REVIEWED',
    sessionStatus: 'ARCHIVED',
    reviewStatus: 'REVIEWED',
    createdAt: new Date().toISOString(),
  }

  const archivedSnapshot = appendIssfSessionToSnapshot(snapshot, archivedPayload)
  return {
    ...archivedSnapshot,
    archivedIssfSessions: [
      ...(archivedSnapshot?.archivedIssfSessions || []).filter(
        (item) => item.sessionKey !== archivedPayload.sessionId
      ),
      {
        ...sessionRecord,
        sessionKey: archivedPayload.sessionId,
        archivedAt: Date.now(),
      },
    ],
    shotSeries: (archivedSnapshot?.shotSeries || []).filter((row) => {
      const rowSessionId = row.sessionId || row.idBloco
      return rowSessionId !== archivedPayload.sessionId
    }),
  }
}

export function restoreArchivedIssfSession(snapshot, payload) {
  const restoredSnapshot = appendIssfSessionToSnapshot(snapshot, {
    ...payload,
    sessionStatus: 'APPROVED',
    reviewStatus: 'REVIEWED',
  })

  return {
    ...restoredSnapshot,
    archivedIssfSessions: (restoredSnapshot?.archivedIssfSessions || []).filter(
      (item) => item.sessionKey !== payload.sessionId
    ),
  }
}

export function deleteIssfSession(snapshot, sessionId) {
  return removeSessionEntities(snapshot, sessionId)
}
