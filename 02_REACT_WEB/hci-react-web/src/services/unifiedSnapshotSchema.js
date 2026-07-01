function toTimestamp(value) {
  if (!value) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function normalizeAthleteName(value) {
  return String(value || '').trim()
}

function normalizeSessionType(value) {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'TREINO' || normalized === 'TRAINING') return 'TRAINING'
  if (normalized === 'SIMULADO' || normalized === 'SIMULATION') return 'SIMULATION'
  if (normalized === 'COMPETICAO' || normalized === 'COMPETIÇÃO' || normalized === 'COMPETITION') {
    return 'COMPETITION'
  }

  return normalized || 'TRAINING'
}

function normalizeEventStatus(value) {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'PARCIAL' || normalized === 'PARTIAL') return 'PARTIAL'
  if (normalized === 'FINAL') return 'FINAL'
  return 'PARTIAL'
}

function parseShotValues(csv) {
  return String(csv || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const numericValue = Number(String(value).replace('x', '').replace('X', ''))
  return Number.isNaN(numericValue) ? null : numericValue
}

function buildSessionKey(parts) {
  return parts.map((part) => String(part || '').trim() || '-').join('|')
}

function deriveAthletes(snapshot) {
  const athleteMap = new Map()
  const now = Date.now()

  ;(snapshot?.leads || []).forEach((lead) => {
    const athleteName = normalizeAthleteName(lead.athleteName)
    if (!athleteName) return

    athleteMap.set(athleteName, {
      athleteId: lead.leadId || athleteName,
      athleteName,
      athleteEmail: lead.athleteEmail || null,
      modality: null,
      levelCode: null,
      sourceType: lead.source || 'LOGIN_APP',
      createdAt: lead.createdAt || now,
      updatedAt: lead.updatedAt || now,
    })
  })

  ;(snapshot?.athlete360 || []).forEach((item) => {
    const athleteName = normalizeAthleteName(item.athlete)
    if (!athleteName) return

    const current = athleteMap.get(athleteName) || {
      athleteId: athleteName,
      athleteName,
      athleteEmail: null,
      modality: null,
      levelCode: null,
      sourceType: 'ATHLETE360_IMPORT',
      createdAt: now,
      updatedAt: now,
    }

    athleteMap.set(athleteName, {
      ...current,
      modality: item.prova || current.modality || null,
      levelCode: item.level || current.levelCode || null,
      updatedAt: now,
    })
  })

  return Array.from(athleteMap.values())
}

function deriveApprovedIssfEntities(snapshot) {
  const rows = snapshot?.shotSeries || []
  const grouped = new Map()

  rows.forEach((row) => {
    const sessionId =
      row.sessionId ||
      row.idBloco ||
      buildSessionKey([row.atleta, row.evento, row.sessao, row.prova])

    if (!grouped.has(sessionId)) {
      grouped.set(sessionId, [])
    }

    grouped.get(sessionId).push(row)
  })

  const sessionHeaders = []
  const sessionSeries = []
  const sessionShots = []

  grouped.forEach((seriesRows, sessionId) => {
    const orderedRows = [...seriesRows].sort((a, b) => {
      const aOrder = Number(a.hciSerieOrder || String(a.serie || '').replace(/\D/g, '')) || 0
      const bOrder = Number(b.hciSerieOrder || String(b.serie || '').replace(/\D/g, '')) || 0
      return aOrder - bOrder
    })

    const firstRow = orderedRows[0] || {}
    const athleteName = normalizeAthleteName(firstRow.atleta)
    const athleteId = athleteName
    const createdAt = toTimestamp(firstRow.createdAt) || toTimestamp(firstRow.dataColeta) || Date.now()

    let sessionTotal = 0
    let shotCount = 0

    orderedRows.forEach((row, rowIndex) => {
      const seriesCode = row.serie || `SR${rowIndex + 1}`
      const seriesId = row.chaveSerie || `${sessionId}_${seriesCode}`
      const shotValues = parseShotValues(row.tiros)
      const directions = Array.isArray(row.directions) ? row.directions : []
      const seriesTotal = shotValues.reduce((sum, value) => sum + (numberOrNull(value) || 0), 0)

      sessionTotal += seriesTotal
      shotCount += shotValues.length

      sessionSeries.push({
        seriesId,
        sessionId,
        seriesCode,
        seriesOrder: Number(row.hciSerieOrder || rowIndex + 1),
        eventStatus: normalizeEventStatus(row.statusEvento),
        seriesTotal: Number(seriesTotal.toFixed(1)),
        shotValuesCsv: shotValues.join(','),
        createdAt,
        updatedAt: createdAt,
      })

      shotValues.forEach((value, shotIndex) => {
        sessionShots.push({
          shotId: `${seriesId}_T${shotIndex + 1}`,
          sessionId,
          seriesId,
          seriesCode,
          shotNumber: shotIndex + 1,
          score: numberOrNull(value) ?? value,
          directionCode: directions[shotIndex] || null,
          xValue: null,
          yValue: null,
          innerTen: null,
          confidence: null,
          createdAt,
        })
      })
    })

    sessionHeaders.push({
      sessionId,
      athleteId,
      athleteName,
      eventCode: firstRow.evento || '',
      sessionType: normalizeSessionType(firstRow.sessao),
      modality: firstRow.prova || '',
      sessionDate: firstRow.dataColeta || '',
      sourceType: firstRow.sourceType || 'ADMIN_REACT',
      sessionStatus: 'APPROVED',
      reviewStatus: 'REVIEWED',
      seriesCount: orderedRows.length,
      shotCount,
      totalScore: Number(sessionTotal.toFixed(1)),
      notes: null,
      rawImportJson: null,
      createdAt,
      updatedAt: createdAt,
      approvedAt: toTimestamp(firstRow.reviewedAt) || createdAt,
      archivedAt: null,
    })
  })

  return { sessionHeaders, sessionSeries, sessionShots }
}

function deriveArchivedIssfHeaders(snapshot) {
  return (snapshot?.archivedIssfSessions || []).map((session) => ({
    sessionId: session.sessionKey,
    athleteId: normalizeAthleteName(session.athlete),
    athleteName: normalizeAthleteName(session.athlete),
    eventCode: session.event || '',
    sessionType: normalizeSessionType(session.session),
    modality: session.prova || '',
    sessionDate: session.seriesRows?.[0]?.dataColeta || '',
    sourceType: session.seriesRows?.[0]?.sourceType || 'ADMIN_REACT',
    sessionStatus: 'ARCHIVED',
    reviewStatus: 'REVIEWED',
    seriesCount: session.seriesCount || (session.seriesRows || []).length,
    shotCount: session.shotCount || 0,
    totalScore: Number(session.total || 0),
    notes: null,
    rawImportJson: null,
    createdAt: toTimestamp(session.seriesRows?.[0]?.createdAt) || Date.now(),
    updatedAt: toTimestamp(session.archivedAt) || Date.now(),
    approvedAt: null,
    archivedAt: toTimestamp(session.archivedAt),
  }))
}

function derivePendingIssfHeaders(snapshot) {
  return (snapshot?.pendingGroups || []).map((item) => ({
    sessionId: item.key,
    athleteId: normalizeAthleteName(item.athlete),
    athleteName: normalizeAthleteName(item.athlete),
    eventCode: item.event || '',
    sessionType: normalizeSessionType(item.session),
    modality: item.prova || '',
    sessionDate: '',
    sourceType: item.source || 'ADMIN_REACT',
    sessionStatus: 'PENDING_REVIEW',
    reviewStatus: item.complete ? 'REVIEWED' : 'PENDING',
    seriesCount: Number(item.seriesCount || 0),
    shotCount: Number(item.shotCount || 0),
    totalScore: Number(item.total || 0),
    notes: null,
    rawImportJson: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    approvedAt: null,
    archivedAt: null,
  }))
}

function deriveUnifiedTargetSessions(snapshot) {
  return []
}

function deriveUnifiedPrescriptions(snapshot) {
  return (snapshot?.prescriptions || []).map((item, index) => ({
    prescriptionId: item.prescriptionId || item.trainingId || `PRESCRIPTION_${index + 1}`,
    athleteId: normalizeAthleteName(item.athlete),
    athleteName: normalizeAthleteName(item.athlete),
    dayNumber: Number(item.day || 0),
    blockCode: item.block || '',
    trainingCode: item.code || '',
    trainingTitle: item.trainingTitle || '',
    prescribedByRole: item.prescribedByRole || '',
    sourceType: item.sourceType || 'ADMIN_REACT',
    createdAt: toTimestamp(item.createdAt) || Date.now(),
    updatedAt: toTimestamp(item.updatedAt) || Date.now(),
  }))
}

function deriveAthleteViewCache(snapshot) {
  return (snapshot?.athlete360 || []).map((item) => ({
    athleteId: normalizeAthleteName(item.athlete),
    athleteName: normalizeAthleteName(item.athlete),
    athleteEmail: null,
    modality: item.prova || null,
    levelCode: item.level || null,
    hci: item.hci ?? null,
    latestTotal: item.latestTotal ?? null,
    medianTotal: item.medianTotal ?? null,
    sessionsCount: Number(item.sessionsCount || 0),
    targetSessionsCount: 0,
    prescriptionsCount: Number(item.prescriptionCount || 0),
    parameters: item.parameters || [],
    sessions: item.sessions || [],
    prescriptions: item.prescriptions || [],
    updatedAt: Date.now(),
  }))
}

export function normalizeSnapshotToUnifiedSchema(snapshot) {
  if (!snapshot) return snapshot

  const athletes = deriveAthletes(snapshot)
  const approvedIssf = deriveApprovedIssfEntities(snapshot)
  const pendingHeaders = derivePendingIssfHeaders(snapshot)
  const archivedHeaders = deriveArchivedIssfHeaders(snapshot)

  const sessionHeaderMap = new Map()
  ;[
    ...approvedIssf.sessionHeaders,
    ...pendingHeaders,
    ...archivedHeaders,
  ].forEach((header) => {
    sessionHeaderMap.set(header.sessionId, header)
  })

  return {
    ...snapshot,
    targetSessions: [],
    approvedTargetSessions: [],
    archivedTargetSessions: [],
    athletes,
    sessionHeaders: Array.from(sessionHeaderMap.values()),
    sessionSeries: approvedIssf.sessionSeries,
    sessionShots: approvedIssf.sessionShots,
    unifiedTargetSessions: deriveUnifiedTargetSessions(snapshot),
    unifiedPrescriptions: deriveUnifiedPrescriptions(snapshot),
    athleteViewCache: deriveAthleteViewCache(snapshot),
    unifiedMetadata: {
      schemaVersion: '1.0',
      nativeLanguage: 'en',
      translationLanguages: ['pt-BR'],
      storageMode: 'UNIFIED_SQL',
      normalizedAt: Date.now(),
    },
  }
}
