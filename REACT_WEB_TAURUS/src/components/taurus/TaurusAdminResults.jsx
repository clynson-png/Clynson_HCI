import { translations } from '../../i18n/translations'

function TaurusAdminResults({
  lang = 'pt',
  pendingItems = [],
  approvedItems = [],
  archivedItems = [],
  onModifyPending,
  onApprovePending,
  onDeletePending,
  onArchiveApproved,
  onDeleteApproved,
  onRestoreArchived,
  onDeleteArchived,
}) {
  const t = translations[lang] || translations.pt

  return (
    <>
      <section className="panel">
        <h2>{t.taurusAdmin.pendingTitle}</h2>

        {pendingItems.length === 0 ? (
          <p className="taurus-admin-empty-state">{t.taurusAdmin.noPending}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t.common.athlete}</th>
                <th>{t.taurusAdmin.target}</th>
                <th>{t.common.session}</th>
                <th>{t.common.shots}</th>
                <th>{t.common.total}</th>
                <th>Timing/audio</th>
                <th>{t.common.status}</th>
                <th>{t.common.action}</th>
              </tr>
            </thead>

            <tbody>
              {pendingItems.map((item) => (
                <tr key={item.sessionId}>
                  <td>{item.athleteName}</td>
                  <td>{item.targetLabel}</td>
                  <td>{item.sessionLabel}</td>
                  <td>{item.totalShots}</td>
                  <td>{item.totalScore ?? '-'}</td>
                  <td><TimingSummary session={item} /></td>
                  <td>{item.status || 'PENDING_COACH_REVIEW'}</td>
                  <td>
                    <div className="taurus-admin-action-row">
                      <button
                        type="button"
                        className="admin-action-button"
                        onClick={() => onModifyPending?.(item.sessionId)}
                      >
                        {t.common.modify}
                      </button>
                      <button
                        type="button"
                        className="admin-action-button"
                        onClick={() => onApprovePending?.(item.sessionId)}
                      >
                        {t.common.approve}
                      </button>
                      <button
                        type="button"
                        className="admin-action-button"
                        onClick={() => onDeletePending?.(item.sessionId)}
                      >
                        {t.common.delete}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>{t.taurusAdmin.approvedTitle}</h2>

        {approvedItems.length === 0 ? (
          <p className="taurus-admin-empty-state">{t.taurusAdmin.noApproved}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t.common.athlete}</th>
                <th>{t.taurusAdmin.target}</th>
                <th>{t.common.session}</th>
                <th>{t.common.shots}</th>
                <th>{t.common.total}</th>
                <th>Timing/audio</th>
                <th>{t.taurusAdmin.approvedAt}</th>
                <th>{t.common.action}</th>
              </tr>
            </thead>

            <tbody>
              {approvedItems.map((item) => (
                <tr key={item.sessionId}>
                  <td>{item.athleteName}</td>
                  <td>{item.targetLabel}</td>
                  <td>{item.sessionLabel}</td>
                  <td>{item.totalShots}</td>
                  <td>{item.totalScore ?? '-'}</td>
                  <td><TimingSummary session={item} /></td>
                  <td>{formatDate(item.approvedAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-action-button"
                      onClick={() => onArchiveApproved?.(item.sessionId)}
                      style={{ marginRight: 8 }}
                    >
                      {t.common.archive}
                    </button>
                    <button
                      type="button"
                      className="admin-action-button"
                      onClick={() => onDeleteApproved?.(item.sessionId)}
                    >
                      {t.common.delete}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>{t.taurusAdmin.archivedTitle}</h2>

        {archivedItems.length === 0 ? (
          <p className="taurus-admin-empty-state">{t.taurusAdmin.noArchived}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t.common.athlete}</th>
                <th>{t.taurusAdmin.target}</th>
                <th>{t.common.session}</th>
                <th>{t.common.shots}</th>
                <th>{t.common.total}</th>
                <th>Timing/audio</th>
                <th>{t.taurusAdmin.archivedAt}</th>
                <th>{t.common.action}</th>
              </tr>
            </thead>

            <tbody>
              {archivedItems.map((item) => (
                <tr key={item.sessionId}>
                  <td>{item.athleteName}</td>
                  <td>{item.targetLabel}</td>
                  <td>{item.sessionLabel}</td>
                  <td>{item.totalShots}</td>
                  <td>{item.totalScore ?? '-'}</td>
                  <td><TimingSummary session={item} /></td>
                  <td>{formatDate(item.archivedAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-action-button"
                      onClick={() => onRestoreArchived?.(item.sessionId)}
                      style={{ marginRight: 8 }}
                    >
                      {t.common.restore}
                    </button>
                    <button
                      type="button"
                      className="admin-action-button"
                      onClick={() => onDeleteArchived?.(item.sessionId)}
                    >
                      {t.common.delete}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}

function TimingSummary({ session }) {
  const summary = buildTimingSummary(session)

  return (
    <div className="taurus-admin-timing-summary">
      <strong>{summary.source}</strong>
      <span>Total: {summary.total}</span>
      <span>{summary.present}</span>
      <span>{summary.status}</span>
    </div>
  )
}

function buildTimingSummary(session) {
  const shots = parseShotDetails(session?.shotDetailsJson)
  const timedShots = shots.filter((shot) => Number(shot.shotTimeSeconds || shot.audioElapsedSeconds || 0) > 0)
  const audioShots = shots.filter((shot) => shot.audioSequenceStatus === 'SUGGESTED')
  const hasSessionDuration = Number(session?.durationSeconds || 0) > 0

  if (!shots.length && !hasSessionDuration) {
    return {
      source: 'Sem timing',
      total: '-',
      present: '0 linhas',
      status: 'Sem audio',
    }
  }

  const source = formatDurationSource(session?.durationSource, audioShots.length > 0, timedShots.length > 0 || hasSessionDuration)
  const total = hasSessionDuration ? `${formatNumber(session.durationSeconds)}s` : '-'
  const present = shots.length > 0 ? `${timedShots.length}/${shots.length} linhas com tempo` : 'Tempo total direto'
  const status = audioShots.length > 0
    ? `${audioShots.length} marcas de audio`
    : timedShots.length > 0
      ? 'Timing manual'
      : 'Sem audio'

  return { source, total, present, status }
}

function parseShotDetails(value) {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function formatDurationSource(durationSource, hasAudio, hasTiming) {
  if (durationSource === 'AUDIO_SEQUENCE' || hasAudio) return 'Audio sugerido'
  if (durationSource === 'ROW_SUM') return 'Soma por linha'
  if (durationSource === 'MANUAL_TOTAL') return 'Total manual'
  if (hasTiming) return 'Manual'
  return 'Sem timing'
}

function formatNumber(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return '-'
  return Number(numberValue.toFixed(1)).toString()
}

function formatDate(value) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleDateString('pt-BR')
}

export default TaurusAdminResults
