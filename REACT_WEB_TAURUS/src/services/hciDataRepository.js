function buildSessionId(row) {
  return (
    row.idBloco ||
    [
      row.atleta || 'UNKNOWN',
      row.evento || 'EV',
      row.sessao || 'SESSION',
      row.prova || 'MODALITY',
    ].join('_')
  )
}

function parseShots(tiros) {
  return String(tiros || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function calculateTotalFromShots(shots) {
  const total = shots.reduce((sum, value) => {
    const numericValue = Number(value)
    return sum + (Number.isNaN(numericValue) ? 0 : numericValue)
  }, 0)

  return Number(total.toFixed(1))
}

export function importSnapshotV341ToCanonical(snapshot) {
  const shotSeries = snapshot?.shotSeries || []
  const groupedSessions = new Map()

  for (const row of shotSeries) {
    const sessionId = buildSessionId(row)

    if (!groupedSessions.has(sessionId)) {
      groupedSessions.set(sessionId, [])
    }

    groupedSessions.get(sessionId).push(row)
  }

  const normalizedShotSeries = []
  const sessionsByAthlete = new Map()

  for (const [sessionId, rows] of groupedSessions.entries()) {
    const orderedRows = [...rows].sort((a, b) => {
      const aOrder = Number(a.hciSerieOrder || String(a.serie || '').replace('SR', '')) || 0
      const bOrder = Number(b.hciSerieOrder || String(b.serie || '').replace('SR', '')) || 0
      return aOrder - bOrder
    })

    const firstRow = orderedRows[0]
    const athleteName = firstRow?.atleta || '-'

    const normalizedRows = orderedRows.map((row, index) => {
      const shots = parseShots(row.tiros)

      return {
        sessionId,
        chaveSerie: row.chaveSerie || `${sessionId}_${row.serie || `SR${index + 1}`}`,
        idBloco: sessionId,
        atleta: row.atleta || '',
        dataColeta: row.dataColeta || '',
        evento: row.evento || '',
        sessao: row.sessao || '',
        prova: row.prova || '',
        serie: row.serie || `SR${index + 1}`,
        statusEvento: row.statusEvento || (index === orderedRows.length - 1 ? 'FINAL' : 'PARCIAL'),
        tiros: shots.join(','),
        total: row.total ?? calculateTotalFromShots(shots),
        hciSerieOrder: row.hciSerieOrder || index + 1,
        hciEventRowValid: row.hciEventRowValid ?? 1,
      }
    })

    normalizedShotSeries.push(...normalizedRows)

    if (!sessionsByAthlete.has(athleteName)) {
      sessionsByAthlete.set(athleteName, {
        athlete: athleteName,
        name: athleteName,
        sessions: [],
      })
    }

    sessionsByAthlete.get(athleteName).sessions.push({
      sessionId,
      athlete: athleteName,
      data: firstRow?.dataColeta || '',
      evento: firstRow?.evento || '',
      sessao: firstRow?.sessao || '',
      prova: firstRow?.prova || '',
      total: normalizedRows.reduce((sum, row) => sum + Number(row.total || 0), 0),
      series: normalizedRows.map((row) => ({
        serie: row.serie,
        total: Number(row.total || 0),
      })),
    })
  }

  return {
    sessions: groupedSessions.size,
    series: normalizedShotSeries.length,
    shots: normalizedShotSeries.reduce((sum, row) => sum + parseShots(row.tiros).length, 0),
    canonicalSnapshot: {
      ...snapshot,
      athlete360: Array.from(sessionsByAthlete.values()),
      shotSeries: normalizedShotSeries,
    },
  }
}
