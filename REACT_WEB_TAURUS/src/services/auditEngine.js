export function runDatabaseAudit(snapshot) {
  const athlete360 = snapshot?.athlete360 || []
  const leads = snapshot?.leads || []
  const prescriptions = snapshot?.prescriptions || []

  const sessions = athlete360.flatMap((athlete) => {
  const athleteSessions =
    athlete.rhythm?.sessions ||
    athlete.sessions ||
    athlete.athleteView?.rhythm?.sessions ||
    []

  return athleteSessions.map((session) => ({
    athlete: athlete.athlete?.name || athlete.name || athlete.athlete || '-',
    ...session,
  }))
})

  const incompleteSessions = sessions.filter((session) => {
  const series = session.series || []
  const seriesNames = series.map((serie) => serie.serie)

  const hasSixSeries = series.length === 6
  const hasExpectedSeries =
    ['SR1', 'SR2', 'SR3', 'SR4', 'SR5', 'SR6'].every((serie) =>
      seriesNames.includes(serie)
    )



  return !hasSixSeries || !hasExpectedSeries
})

  const sessionsWithoutTotal = sessions.filter(
    (session) => session.total === null || session.total === undefined
  )

  const duplicateKeys = {}
  sessions.forEach((session) => {
    const key = [
      session.athlete,
      session.evento,
      session.sessao,
      session.data,
      session.total,
    ].join('|')

    duplicateKeys[key] = (duplicateKeys[key] || 0) + 1
  })

  const duplicates = Object.entries(duplicateKeys)
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }))

  return {
    summary: {
      athletes: athlete360.length,
      leads: leads.length,
      sessions: sessions.length,
      incompleteSessions: incompleteSessions.length,
      sessionsWithoutTotal: sessionsWithoutTotal.length,
      duplicates: duplicates.length,
      prescriptions: prescriptions.length,
    },
    incompleteSessions,
    sessionsWithoutTotal,
    duplicates,
  }
}
