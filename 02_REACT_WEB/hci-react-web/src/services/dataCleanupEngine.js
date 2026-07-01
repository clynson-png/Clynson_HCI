export function runDataCleanupPlan(snapshot) {
  const shotSeries = snapshot?.shotSeries || []

  const grouped = {}

  shotSeries.forEach((row) => {
    const key = [
      row.atleta,
      row.prova,
      row.evento,
      row.sessao,
      row.idBloco,
    ].join('|')

    if (!grouped[key]) {
      grouped[key] = []
    }

    grouped[key].push(row)
  })

  const cleanupItems = []

  Object.entries(grouped).forEach(([key, rows]) => {
    const sortedRows = [...rows].sort((a, b) => {
      const aOrder = Number(String(a.serie || '').replace(/\D/g, '')) || 0
      const bOrder = Number(String(b.serie || '').replace(/\D/g, '')) || 0
      return aOrder - bOrder
    })

    const finalIndex = sortedRows.findIndex(
      (row) => String(row.statusEvento || '').toUpperCase() === 'FINAL'
    )

    if (finalIndex >= 0 && sortedRows.length > finalIndex + 1) {
      cleanupItems.push({
        type: 'SERIES_AFTER_FINAL',
        severity: 'HIGH',
        key,
        athlete: sortedRows[0]?.atleta,
        event: sortedRows[0]?.evento,
        session: sortedRows[0]?.sessao,
        message: 'Series found after FINAL status',
        affectedRows: sortedRows.slice(finalIndex + 1),
      })
    }

    if (sortedRows.length < 6) {
      cleanupItems.push({
        type: 'INCOMPLETE_SESSION',
        severity: 'MEDIUM',
        key,
        athlete: sortedRows[0]?.atleta,
        event: sortedRows[0]?.evento,
        session: sortedRows[0]?.sessao,
        message: 'Session has fewer than 6 series',
        affectedRows: sortedRows,
      })
    }

    sortedRows.forEach((row) => {
      const tiros = String(row.tiros || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)

      if (tiros.length !== 10) {
        cleanupItems.push({
          type: 'INVALID_SHOT_COUNT',
          severity: 'HIGH',
          key,
          athlete: row.atleta,
          event: row.evento,
          session: row.sessao,
          serie: row.serie,
          message: 'Series does not contain exactly 10 shots',
          affectedRows: [row],
        })
      }
    })
  })

  return {
    summary: {
      cleanupItems: cleanupItems.length,
      highSeverity: cleanupItems.filter((item) => item.severity === 'HIGH').length,
      mediumSeverity: cleanupItems.filter((item) => item.severity === 'MEDIUM').length,
    },
    cleanupItems,
  }
}