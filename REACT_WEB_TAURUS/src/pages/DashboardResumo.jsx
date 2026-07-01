import { useEffect, useMemo, useState } from 'react'
import { runDatabaseAudit } from '../services/auditEngine'
import { loadHci109Sessions } from '../services/hci109SessionStore'
import { translations } from '../i18n/translations'
import taurusLogoWordmark from '../assets/taurus-logo-wordmark.png'

function DashboardResumo({ snapshot, lang = 'pt', selectedAthlete = '' }) {
  const t = translations[lang] || translations.pt
  const [showIncomplete, setShowIncomplete] = useState(true)
  const [showLeads, setShowLeads] = useState(true)
  const [showPendingIssf, setShowPendingIssf] = useState(true)
  const [hci109Sessions, setHci109Sessions] = useState([])

  const leads = snapshot?.leads || []
  const canonicalSeriesCount =
    (snapshot?.sessionSeries || []).length || (snapshot?.shotSeries || []).length
  const athlete360 = snapshot?.athlete360 || []
  const pendingIssfRows = useMemo(() => buildAllPendingApprovalGroups(snapshot), [snapshot])
  const selectedHci109Sessions = useMemo(
    () => hci109Sessions.filter((session) => {
      if (!selectedAthlete) return true
      return normalizeAthleteName(session.athleteName) === normalizeAthleteName(selectedAthlete)
    }),
    [hci109Sessions, selectedAthlete]
  )
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

  useEffect(() => {
    let cancelled = false

    async function loadSessions() {
      const sessions = await loadHci109Sessions()
      if (!cancelled) setHci109Sessions(sessions)
    }

    loadSessions()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="dashboard dashboard-resumo">
      <header className="dashboard-header dashboard-header-dark taurus-page-header">
        <div className="taurus-page-header-brand">
          <img src={taurusLogoWordmark} alt="TAURUS" />
        </div>

        <div className="taurus-page-header-title">
          <small>HCI PERFORMANCE</small>
          <h1>{t.dashboard.title}</h1>
        </div>
      </header>

      <section className="dashboard-metrics">
        <div className="metric-card"><span>{t.admin.metrics.leads}</span><strong>{leads.length}</strong></div>
        <div className="metric-card"><span>{t.dashboard.pendingIssf}</span><strong>{pendingIssfRows.length}</strong></div>
        <div className="metric-card"><span>{t.dashboard.recordedSeries}</span><strong>{canonicalSeriesCount}</strong></div>
        <div className="metric-card"><span>{t.dashboard.athletes360}</span><strong>{athlete360.length}</strong></div>
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel-header">
          <div>
            <h2>Treinos HCI_109 do atleta</h2>
            <div className="dashboard-panel-subtitle">
              Sessoes gravadas na Library, aguardando ou liberadas pelo Admin.
            </div>
          </div>
        </div>

        {selectedHci109Sessions.length === 0 ? (
          <p style={{ margin: 0 }}>Nenhum treino HCI_109 gravado para este atleta.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 920, width: '100%' }}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Modo</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Visual</th>
                  <th>Olho no objeto</th>
                  <th>Olho aberto</th>
                  <th>Fonte</th>
                </tr>
              </thead>
              <tbody>
                {selectedHci109Sessions.map((session) => (
                  <tr key={session.sessionId}>
                    <td>{formatResumoDateTime(session.recordedAt)}</td>
                    <td>{session.sessionType}</td>
                    <td>{session.seriesTotal ?? '-'}</td>
                    <td>{session.workflowStatus || '-'}</td>
                    <td>{session.visualFocusMetrics?.visualDisciplineScore ?? '-'}</td>
                    <td>{formatResumoSeconds(session.visualFocusMetrics?.followingMovingObjectMs)}</td>
                    <td>{formatResumoSeconds(session.visualFocusMetrics?.eyeOpenMs)}</td>
                    <td>{formatResumoVisualSource(session.visualTrackingSource || session.visualFocusMetrics?.visualTrackingSource)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel-header">
          <div>
            <h2>{t.dashboard.databaseAudit}</h2>
            <div className="dashboard-panel-subtitle">{t.dashboard.auditSubtitle}</div>
          </div>
        </div>

        <div className="dashboard-panel-grid">
          <div className="metric-card"><span>{t.dashboard.athletes}</span><strong>{audit.summary.athletes}</strong></div>
          <div className="metric-card"><span>{t.dashboard.sessions}</span><strong>{audit.summary.sessions}</strong></div>
          <div className="metric-card"><span>{t.dashboard.incompleteSessions}</span><strong>{audit.incompleteSessions.length}</strong></div>
          <div className="metric-card"><span>{t.dashboard.duplicates}</span><strong>{audit.summary.duplicates}</strong></div>
        </div>
      </section>

      <section className="dashboard-panel dashboard-panel-summary">
        <div className="dashboard-panel-header">
          <div>
            <h2>{t.dashboard.viewerTitle}</h2>
            <div className="dashboard-panel-subtitle">{t.dashboard.viewerSubtitle}</div>
          </div>
        </div>

        <div className="dashboard-panel-summary-grid">
          <ViewerBlock
            title={t.dashboard.incompleteBlock}
            open={showIncomplete}
            onToggle={() => setShowIncomplete((current) => !current)}
            t={t}
          >
            {audit.incompleteSessions.length === 0 ? (
              <p style={{ margin: 0 }}>{t.dashboard.noIncomplete}</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: 920, width: '100%' }}>
                  <thead>
                    <tr>
                      <th>{t.common.athlete}</th>
                      <th>{t.dashboard.date}</th>
                      <th>{t.common.event}</th>
                      <th>{t.common.session}</th>
                      <th>{t.common.total}</th>
                      <th>{t.dashboard.seriesCount}</th>
                      <th>{t.common.series}</th>
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
            title={t.dashboard.leadsBlock}
            open={showLeads}
            onToggle={() => setShowLeads((current) => !current)}
            t={t}
          >
            {leads.length === 0 ? (
              <p style={{ margin: 0 }}>{t.dashboard.noLeads}</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{t.common.athlete}</th>
                    <th>{t.common.email}</th>
                    <th>{t.dashboard.source}</th>
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
            title={t.dashboard.pendingApprovalsBlock}
            open={showPendingIssf}
            onToggle={() => setShowPendingIssf((current) => !current)}
            t={t}
          >
            {pendingIssfRows.length === 0 ? (
              <p style={{ margin: 0 }}>{t.dashboard.noPendingApprovals}</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{t.common.athlete}</th>
                    <th>{t.common.event}</th>
                    <th>{t.common.session}</th>
                    <th>{t.common.discipline}</th>
                    <th>{t.common.series}</th>
                    <th>{t.common.shots}</th>
                    <th>{t.common.total}</th>
                    <th>{t.common.status}</th>
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

function ViewerBlock({ title, open, onToggle, children, t }) {
  return (
    <section className="viewer-block">
      <div className="viewer-header">
        <strong>{title}</strong>
        <button type="button" className="dashboard-action-button" onClick={onToggle}>
          {open ? t.dashboard.close : t.dashboard.open}
        </button>
      </div>

      {open && (
        <div className="viewer-body">
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
    .filter((item) => item.athleteName === athleteName && item.sessionStatus === 'PENDING_REVIEW')
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

  const pendingItems = (snapshot?.pendingGroups || []).filter((item) => item.athlete === athleteName)
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
    .filter((session) => session.athlete === athleteName)
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
      row.atleta === pendingItem.athlete &&
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

function formatResumoDateTime(value) {
  if (!value) return '-'
  const date = new Date(Number(value))
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatResumoSeconds(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return '-'
  return `${(numericValue / 1000).toFixed(2)}s`
}

function normalizeAthleteName(value) {
  return String(value || '').trim()
}

function formatResumoVisualSource(value) {
  const source = String(value || '').trim().toUpperCase()
  if (source === 'POINTER_OBJECT') return 'POINTER'
  if (source === 'CAMERA_IRIS_EXPERIMENTAL') return 'IRIS EXP.'
  if (source === 'CAMERA_FACE_ONLY') return 'FACE'
  if (source === 'CAMERA_EYE_STATE_ONLY') return 'OLHO'
  if (source === 'NO_VISUAL_TRACKING') return 'SEM LEITURA'
  return source || '-'
}

export default DashboardResumo
