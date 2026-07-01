import { useMemo, useState } from 'react'
import { runDatabaseAudit } from '../services/auditEngine'

function DashboardResumo({ snapshot }) {
  const [showIncomplete, setShowIncomplete] = useState(true)
  const [showLeads, setShowLeads] = useState(true)
  const [showPendingIssf, setShowPendingIssf] = useState(true)

  const leads = snapshot?.leads || []
  const canonicalSeriesCount =
    (snapshot?.sessionSeries || []).length || (snapshot?.shotSeries || []).length
  const athlete360 = snapshot?.athlete360 || []
  const pendingIssfRows = useMemo(() => buildAllPendingApprovalGroups(snapshot), [snapshot])
  const dismissedPendingKeys = useMemo(
    () => new Set(snapshot?.dismissedPendingApprovalKeys || []),
    [snapshot]
  )
  const audit = useMemo(() => {
    const rawAudit = runDatabaseAudit(snapshot)

    return {
      ...rawAudit,
      incompleteSessions: rawAudit.incompleteSessions.filter((session) => {
        const sessionKey = [
          session.athlete || 'ATHLETE',
          session.evento || 'EVENT',
          session.sessao || 'SESSION',
          session.prova || 'MODALITY',
          'AUDIT_INCOMPLETE',
        ].join('|')

        return !dismissedPendingKeys.has(sessionKey)
      }),
    }
  }, [snapshot, dismissedPendingKeys])

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <small>HCI PERFORMANCE</small>
          <h1>Coach Planner Framework</h1>
        </div>
      </header>

      <section className="cards">
        <div className="card"><span>Leads</span><strong>{leads.length}</strong></div>
        <div className="card"><span>Pending ISSF</span><strong>{pendingIssfRows.length}</strong></div>
        <div className="card"><span>Recorded Series</span><strong>{canonicalSeriesCount}</strong></div>
        <div className="card"><span>Athletes 360</span><strong>{athlete360.length}</strong></div>
      </section>

      <section className="panel">
        <h2>Database Audit</h2>

        <div className="cards">
          <div className="card"><span>Athletes</span><strong>{audit.summary.athletes}</strong></div>
          <div className="card"><span>Sessions</span><strong>{audit.summary.sessions}</strong></div>
          <div className="card"><span>Incomplete Sessions</span><strong>{audit.incompleteSessions.length}</strong></div>
          <div className="card"><span>Duplicates</span><strong>{audit.summary.duplicates}</strong></div>
        </div>
      </section>

      <section className="panel">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <h2 style={{ margin: 0 }}>Resumo Visualizador</h2>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Same active source as Admin
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            maxHeight: '65vh',
            overflowY: 'auto',
            paddingRight: 8,
            display: 'grid',
            gap: 16,
          }}
        >
          <ViewerBlock
            title="INCOMPLETE / IRREGULAR SESSIONS"
            open={showIncomplete}
            onToggle={() => setShowIncomplete((current) => !current)}
          >
            {audit.incompleteSessions.length === 0 ? (
              <p style={{ margin: 0 }}>NO INCOMPLETE SESSIONS.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: 920, width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Athlete</th>
                      <th>Date</th>
                      <th>Event</th>
                      <th>Session</th>
                      <th>Total</th>
                      <th>Series Count</th>
                      <th>Series</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.incompleteSessions.map((session, index) => (
                      <tr key={`${session.athlete}-${session.evento}-${index}`}>
                        <td>{session.athlete}</td>
                        <td>{formatDate(session.data)}</td>
                        <td>{session.evento || '-'}</td>
                        <td>{session.sessao || '-'}</td>
                        <td>{session.total ?? '-'}</td>
                        <td>{session.series?.length || 0}</td>
                        <td>{(session.series || []).map((serie) => serie.serie).join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ViewerBlock>

          <ViewerBlock
            title="LEADS"
            open={showLeads}
            onToggle={() => setShowLeads((current) => !current)}
          >
            {leads.length === 0 ? (
              <p style={{ margin: 0 }}>NO LEADS.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Athlete</th>
                    <th>Email</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.leadId}>
                      <td>{lead.athleteName}</td>
                      <td>{lead.athleteEmail}</td>
                      <td>{lead.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ViewerBlock>

          <ViewerBlock
            title="PENDING ISSF APPROVALS"
            open={showPendingIssf}
            onToggle={() => setShowPendingIssf((current) => !current)}
          >
            {pendingIssfRows.length === 0 ? (
              <p style={{ margin: 0 }}>NO PENDING ISSF APPROVALS.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Athlete</th>
                    <th>Event</th>
                    <th>Session</th>
                    <th>Discipline</th>
                    <th>Series</th>
                    <th>Shots</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingIssfRows.map((item) => (
                    <tr key={item.key}>
                      <td>{item.athlete}</td>
                      <td>{item.event}</td>
                      <td>{item.session}</td>
                      <td>{item.prova}</td>
                      <td>{item.seriesCount}</td>
                      <td>{item.shotCount}</td>
                      <td>{item.total}</td>
                      <td>{item.complete ? 'READY' : 'INCOMPLETE'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ViewerBlock>

        </div>
      </section>
    </main>
  )
}

function ViewerBlock({ title, open, onToggle, children }) {
  return (
    <section
      style={{
        border: '1px solid #dcdde1',
        borderRadius: 10,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      <div
        style={{
          padding: '14px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          background: '#f8fafc',
          borderBottom: open ? '1px solid #dcdde1' : 'none',
        }}
      >
        <strong style={{ color: '#123f9f' }}>{title}</strong>
        <button type="button" className="admin-action-button" onClick={onToggle}>
          {open ? 'CLOSE' : 'OPEN'}
        </button>
      </div>

      {open && (
        <div style={{ padding: 16 }}>
          {children}
        </div>
      )}
    </section>
  )
}

function buildAllPendingApprovalGroups(snapshot) {
  const athleteNames = new Set()
  ;(snapshot?.athlete360 || []).forEach((item) => athleteNames.add(item.athlete))
  ;(snapshot?.sessionHeaders || [])
    .filter((item) => item.sessionStatus === 'PENDING_REVIEW')
    .forEach((item) => athleteNames.add(item.athleteName))
  ;(snapshot?.pendingGroups || []).forEach((item) => athleteNames.add(item.athlete))

  return Array.from(athleteNames)
    .flatMap((athleteName) => buildPendingApprovalGroups(snapshot, athleteName))
    .sort((a, b) => {
      const athleteCompare = String(a.athlete || '').localeCompare(String(b.athlete || ''))
      if (athleteCompare !== 0) return athleteCompare
      return String(a.event || '').localeCompare(String(b.event || ''))
    })
}

function buildPendingApprovalGroups(snapshot, athleteName) {
  const canonicalPendingItems = (snapshot?.sessionHeaders || [])
    .filter((item) => athleteNamesMatch(item.athleteName, athleteName) && item.sessionStatus === 'PENDING_REVIEW')
    .map((header) => {
      const legacyMatch = (snapshot?.pendingGroups || []).find((item) => item.key === header.sessionId)
      const seriesRows = legacyMatch
        ? resolvePendingSeriesRows(snapshot, legacyMatch)
        : buildCompatibilityShotSeriesFromCanonical(snapshot, header.sessionId)

      return {
        key: header.sessionId,
        sessionId: header.sessionId,
        athlete: header.athleteName || '',
        event: header.eventCode || '',
        session: denormalizeSessionType(header.sessionType),
        prova: header.modality || '',
        source: header.sourceType || 'ADMIN_MANUAL_DATA_ENTRY',
        date: header.sessionDate || '',
        seriesCount: header.seriesCount || seriesRows.length,
        shotCount: header.shotCount || countShotsFromSeriesRows(seriesRows),
        complete: !!legacyMatch?.complete || (header.shotCount || 0) === 60,
        total: Number((header.totalScore || sumSeriesRowsTotal(seriesRows)).toFixed(1)),
        seriesRows,
      }
    })
    .filter((item) => item.seriesRows.length > 0)

  if (canonicalPendingItems.length > 0) {
    const dismissedKeys = new Set(snapshot?.dismissedPendingApprovalKeys || [])
    return canonicalPendingItems.filter((item) => !dismissedKeys.has(item.key))
  }

  const pendingItems = (snapshot?.pendingGroups || []).filter((item) => athleteNamesMatch(item.athlete, athleteName))
  const auditFallbackItems =
    pendingItems.length > 0 ? [] : buildAuditPendingApprovalGroups(snapshot, athleteName)
  const effectivePendingItems = pendingItems.length > 0 ? pendingItems : auditFallbackItems
  const dismissedKeys = new Set(snapshot?.dismissedPendingApprovalKeys || [])

  return effectivePendingItems
    .map((item) => {
      const seriesRows = resolvePendingSeriesRows(snapshot, item)
      const sortedRows = [...seriesRows].sort((a, b) => {
        const aOrder = Number(a.hciSerieOrder || String(a.serie || '').replace(/\D/g, '')) || 0
        const bOrder = Number(b.hciSerieOrder || String(b.serie || '').replace(/\D/g, '')) || 0
        return aOrder - bOrder
      })
      const resolvedShotCount = sortedRows.reduce((sum, row) => {
        const shots = String(row.tiros || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
        return sum + shots.length
      }, 0)
      const resolvedTotal = sortedRows.reduce((sum, row) => {
        const shotTotal = String(row.tiros || '')
          .split(',')
          .map((value) => Number(String(value).trim()))
          .filter((value) => !Number.isNaN(value))
          .reduce((acc, value) => acc + value, 0)
        return sum + shotTotal
      }, 0)

      return {
        ...item,
        date: sortedRows[0]?.dataColeta || '',
        seriesCount: sortedRows.length || item.seriesCount || 0,
        shotCount: resolvedShotCount || item.shotCount || 0,
        total: Number((resolvedTotal || item.total || 0).toFixed(1)),
        seriesRows: sortedRows,
      }
    })
    .filter((item) => !dismissedKeys.has(item.key))
}

function buildAuditPendingApprovalGroups(snapshot, athleteName) {
  const audit = runDatabaseAudit(snapshot)

  return audit.incompleteSessions
    .filter((session) => athleteNamesMatch(session.athlete, athleteName))
    .map((session) => ({
      key: [
        session.athlete || 'ATHLETE',
        session.evento || 'EVENT',
        session.sessao || 'SESSION',
        session.prova || 'MODALITY',
        'AUDIT_INCOMPLETE',
      ].join('|'),
      athlete: session.athlete || '',
      event: session.evento || '',
      session: session.sessao || '',
      prova: session.prova || '',
      source: 'AUDIT_INCOMPLETE',
      seriesCount: (session.series || []).length,
      shotCount: 0,
      complete: false,
      total: Number(session.total || 0),
    }))
}

function resolvePendingSeriesRows(snapshot, pendingItem) {
  const embeddedRows = pendingItem.seriesRows || pendingItem.rows || []

  if (embeddedRows.length > 0) {
    return embeddedRows
  }

  const matchingShotSeries = (snapshot?.shotSeries || []).filter((row) => {
    return (
      athleteNamesMatch(row.atleta, pendingItem.athlete) &&
      row.evento === pendingItem.event &&
      row.sessao === pendingItem.session &&
      row.prova === pendingItem.prova
    )
  })

  return matchingShotSeries
}

function buildCompatibilityShotSeriesFromCanonical(snapshot, sessionId) {
  const header = (snapshot?.sessionHeaders || []).find((item) => item.sessionId === sessionId)
  const series = (snapshot?.sessionSeries || [])
    .filter((item) => item.sessionId === sessionId)
    .sort((a, b) => Number(a.seriesOrder || 0) - Number(b.seriesOrder || 0))

  return series.map((item) => ({
    chaveSerie: item.seriesId,
    sessionId,
    dataColeta: header?.sessionDate || '',
    prova: header?.modality || '',
    atleta: header?.athleteName || '',
    evento: header?.eventCode || '',
    sessao: denormalizeSessionType(header?.sessionType),
    idBloco: sessionId,
    statusEvento: denormalizeEventStatus(item.eventStatus),
    serie: item.seriesCode,
    tiros: item.shotValuesCsv || '',
    directions: buildDirectionsFromCanonical(snapshot, item.seriesId),
    sourceType: header?.sourceType || 'ADMIN_REACT',
    hciSerieOrder: item.seriesOrder || 0,
    hciEventRowValid: 1,
  }))
}

function buildDirectionsFromCanonical(snapshot, seriesId) {
  return (snapshot?.sessionShots || [])
    .filter((item) => item.seriesId === seriesId)
    .sort((a, b) => Number(a.shotNumber || 0) - Number(b.shotNumber || 0))
    .map((item) => item.directionCode || '')
}

function countShotsFromSeriesRows(seriesRows) {
  return (seriesRows || []).reduce((sum, row) => {
    const shots = String(row.tiros || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    return sum + shots.length
  }, 0)
}

function sumSeriesRowsTotal(seriesRows) {
  return (seriesRows || []).reduce((sum, row) => {
    const shotTotal = String(row.tiros || '')
      .split(',')
      .map((value) => Number(String(value).trim()))
      .filter((value) => !Number.isNaN(value))
      .reduce((acc, value) => acc + value, 0)
    return sum + shotTotal
  }, 0)
}

function denormalizeSessionType(value) {
  const normalizedValue = String(value || '').trim().toUpperCase()
  if (normalizedValue === 'TRAINING') return 'TREINO'
  if (normalizedValue === 'SIMULATION') return 'SIMULADO'
  if (normalizedValue === 'COMPETITION') return 'COMPETICAO'
  return normalizedValue || 'TREINO'
}

function denormalizeEventStatus(value) {
  const normalizedValue = String(value || '').trim().toUpperCase()
  if (normalizedValue === 'FINAL') return 'FINAL'
  return 'PARCIAL'
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-US')
}

export default DashboardResumo
import { athleteNamesMatch } from '../services/athleteIdentity'
