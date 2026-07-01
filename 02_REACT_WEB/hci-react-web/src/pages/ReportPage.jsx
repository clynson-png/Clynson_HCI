import { useMemo, useState } from 'react'
import {
  FaArrowTrendUp,
  FaArrowRightArrowLeft,
  FaArrowsDownToLine,
  FaBolt,
  FaBullseye,
  FaCheck,
  FaChartLine,
  FaCrosshairs,
  FaDumbbell,
  FaFilePdf,
  FaGaugeHigh,
  FaHeartPulse,
  FaMedal,
  FaPenToSquare,
  FaSignal,
  FaShieldHeart,
  FaTrash,
  FaUpload,
} from 'react-icons/fa6'
import { LEVEL_CODES, PARAMETER_CODES, translateCode } from '../i18n/codes'
import {
  appendIssfSessionToSnapshot,
  appendPendingIssfSessionToSnapshot,
} from '../services/activeSnapshotMutations'
import { athleteNamesMatch, resolveExistingAthleteName } from '../services/athleteIdentity'
import { parseReportPdf } from '../services/reportPdfParser'
import { getTrainingLibraryEntries } from '../services/trainingLibraryService'

function ReportPage({
  activeSnapshot,
  onActiveSnapshotChange,
  generatedReport,
  selectedAthlete,
  onAthleteChange,
}) {
  const [activeTab, setActiveTab] = useState('pdf-import')
  const [selectedFileName, setSelectedFileName] = useState('')
  const [parseResult, setParseResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [pendingDraft, setPendingDraft] = useState(null)
  const [pendingEditMode, setPendingEditMode] = useState(false)
  const [processingMessage, setProcessingMessage] = useState('')
  const [editableAthleteName, setEditableAthleteName] = useState('')
  const [editableEventName, setEditableEventName] = useState('')

  const summaryCards = useMemo(() => {
    if (!parseResult) return []

    return [
      { label: 'Atleta', value: parseResult.athleteName || '-' },
      { label: 'Prova', value: parseResult.eventLabel || '-' },
      { label: 'Modalidade', value: parseResult.modality || '-' },
      { label: 'Data', value: parseResult.sessionDate || '-' },
      { label: 'Disparos', value: String(parseResult.scores.length || 0) },
    ]
  }, [parseResult])

  const athleteContext = pendingDraft?.athleteName || parseResult?.athleteName || selectedAthlete || ''
  const realIssfSessions = useMemo(
    () => buildApprovedIssfSessions(activeSnapshot, athleteContext),
    [activeSnapshot, athleteContext]
  )
  const approvedTrainingPlanRows = useMemo(
    () => buildApprovedTrainingPlanRows(activeSnapshot, selectedAthlete),
    [activeSnapshot, selectedAthlete]
  )

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    setSelectedFileName(file.name)
    setLoading(true)
    setError('')
    setSaveMessage('')
    setProcessingMessage('Lendo PDF, extraindo texto e preparando contrato do relatório...')
    setPendingDraft(null)
    setEditableAthleteName('')
    setEditableEventName('')

    try {
      const result = await parseReportPdf(file)
      setParseResult(result)
      setEditableAthleteName(result?.athleteName || '')
      setEditableEventName(result?.eventLabel || '')
      setProcessingMessage(
        result?.canPrefillAdmin
          ? 'Leitura concluída. Relatório pronto para gerar pending local e JSON compatível.'
          : 'Leitura concluída parcialmente. Relatório aberto, mas ainda sem 60 disparos completos.'
      )
    } catch (err) {
      console.error(err)
      setParseResult(null)
      setError('Não foi possível ler este PDF ainda.')
      setProcessingMessage('')
    } finally {
      setLoading(false)
    }
  }

  function handleCreateLocalPending() {
    if (!parseResult?.canPrefillAdmin) {
      setError('Este relatório ainda não trouxe os 60 disparos completos para montar o pending local.')
      return
    }

    const athleteName = editableAthleteName || parseResult.athleteName || selectedAthlete || 'ATLETA_RELATORIO'
    const eventCode = editableEventName || getNextEventCode(activeSnapshot)

    setPendingDraft({
      athleteName,
      eventCode,
      sessionDate: parseResult.sessionDate,
      sessionType: parseResult.sessionType || 'COMPETICAO',
      modality: parseResult.modality || 'PISTOL',
      scores: [...parseResult.scores],
      directions: [...parseResult.directions],
      reportMeta: {
        reportTitle: parseResult.report.reportTitle,
        sourceLabel: parseResult.sourceLabel,
        eventLabel: parseResult.eventLabel,
        importedFromPdf: selectedFileName,
      },
    })
    setPendingEditMode(false)

    onAthleteChange?.(athleteName)
    setSaveMessage('Pending local criado na aba Relatório.')
    setError('')
  }

  function handlePendingCellChange(index, value) {
    if (!pendingEditMode) return
    setPendingDraft((current) => {
      if (!current) return current
      const nextScores = [...current.scores]
      nextScores[index] = value
      return { ...current, scores: nextScores }
    })
  }

  function handlePendingDirectionChange(index, value) {
    if (!pendingEditMode) return
    setPendingDraft((current) => {
      if (!current) return current
      const nextDirections = [...current.directions]
      nextDirections[index] = value
      return { ...current, directions: nextDirections }
    })
  }

  function handleSendPendingToAdmin() {
    if (!pendingDraft) return

    const nextSnapshot = appendPendingIssfSessionToSnapshot(activeSnapshot, {
      athlete: pendingDraft.athleteName,
      date: pendingDraft.sessionDate,
      event: pendingDraft.eventCode,
      sessionType: pendingDraft.sessionType,
      modality: pendingDraft.modality,
      sourceType: 'REPORT_PDF_IMPORT',
      status: 'PENDING_COACH_REVIEW',
      reviewFlag: 'PENDING_REVIEW',
      notes: JSON.stringify(pendingDraft.reportMeta, null, 2),
      scores: pendingDraft.scores,
      directions: pendingDraft.directions,
    })

    const snapshotWithLead = ensureLeadForAthlete(nextSnapshot, pendingDraft.athleteName)
    onActiveSnapshotChange?.(snapshotWithLead)
    onAthleteChange?.(pendingDraft.athleteName)
    setSaveMessage('Pending local espelhado no fluxo Pending ISSF do Admin.')
    setError('')
  }

  function handleApproveToRealIssf() {
    if (!pendingDraft) return

    const nextSnapshot = appendIssfSessionToSnapshot(activeSnapshot, {
      athlete: pendingDraft.athleteName,
      date: pendingDraft.sessionDate,
      event: pendingDraft.eventCode,
      sessionType: pendingDraft.sessionType,
      modality: pendingDraft.modality,
      sourceType: 'REPORT_PDF_IMPORT',
      status: 'ADMIN_APPROVED',
      reviewFlag: 'ADMIN_REVIEWED',
      sessionStatus: 'APPROVED',
      reviewStatus: 'REVIEWED',
      notes: JSON.stringify(pendingDraft.reportMeta, null, 2),
      scores: pendingDraft.scores,
      directions: pendingDraft.directions,
    })

    const snapshotWithLead = ensureLeadForAthlete(nextSnapshot, pendingDraft.athleteName)
    onActiveSnapshotChange?.(snapshotWithLead)
    onAthleteChange?.(pendingDraft.athleteName)
    setSaveMessage('Sessão aprovada na aba Relatório e enviada para o painel ISSF real.')
    setPendingDraft(null)
    setPendingEditMode(false)
    setError('')
  }

  function handleDeletePending() {
    setPendingDraft(null)
    setPendingEditMode(false)
    setSaveMessage('Pending local removido da aba Relatório.')
    setError('')
  }

  function handleExportCompatibleJson() {
    if (!parseResult?.canPrefillAdmin) {
      setError('Este relatório ainda não gerou 60 disparos completos para exportar JSON compatível.')
      return
    }

    const payload = buildCompatibleImportJson(
      parseResult,
      selectedFileName,
      editableAthleteName || parseResult.athleteName || selectedAthlete || 'ATLETA_RELATORIO',
      editableEventName || parseResult.eventLabel || ''
    )
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })

    const url = URL.createObjectURL(blob)
    const safeName = String(parseResult.athleteName || 'relatorio')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

    const link = document.createElement('a')
    link.href = url
    link.download = `report-to-hci-ia-${safeName || 'athlete'}.json`
    link.click()
    URL.revokeObjectURL(url)

    const shouldImportDirectly = window.confirm(
      'JSON compatível baixado em Downloads. Deseja importar agora para o Admin / Athlete View também?'
    )

    if (shouldImportDirectly) {
      const nextSnapshot = appendPendingIssfSessionToSnapshot(activeSnapshot, {
        athlete: payload.athlete,
        date: payload.date,
        event: getNextEventCode(activeSnapshot),
        sessionType: parseResult.sessionType || 'COMPETICAO',
        modality: payload.modality,
        sourceType: 'REPORT_JSON_COMPAT_IMPORT',
        status: 'PENDING_COACH_REVIEW',
        reviewFlag: 'PENDING_REVIEW',
        notes: JSON.stringify(payload.report_metadata || {}, null, 2),
        scores: flattenSeriesTableScores(payload.series_table),
        directions: flattenSeriesTableDirections(payload.series_table),
      })

      const snapshotWithLead = ensureLeadForAthlete(
        nextSnapshot,
        payload.athlete || parseResult.athleteName || selectedAthlete || 'ATLETA_RELATORIO'
      )

      onActiveSnapshotChange?.(snapshotWithLead)
      onAthleteChange?.(payload.athlete || parseResult.athleteName || selectedAthlete || '')
      setSaveMessage('JSON compatível baixado e importado direto para o Admin.')
      setError('')
      return
    }

    setSaveMessage('JSON compatível baixado em Downloads para uso manual.')
    setError('')
  }

  function handleGeneratePdf() {
    window.print()
  }

  const showingGeneratedReport = !parseResult && generatedReport?.sessions?.length >= 0

  return (
    <main className="dashboard report-page">
      <header className="dashboard-header">
        <div>
          <small>HCI PERFORMANCE</small>
          <h1>Relatório</h1>
        </div>
      </header>

      <section className="panel selector-panel">
        <h2>Abas do relatório</h2>

        <div className="admin-actions">
          <button
            type="button"
            onClick={() => setActiveTab('pdf-import')}
            style={{ opacity: activeTab === 'pdf-import' ? 1 : 0.7 }}
          >
            PDF Import
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('training-plan')}
            style={{ opacity: activeTab === 'training-plan' ? 1 : 0.7 }}
          >
            Training Plan
          </button>
        </div>
      </section>

      {activeTab === 'training-plan' ? (
        <TrainingPlanReportTab
          athleteName={selectedAthlete}
          approvedTrainingPlanRows={approvedTrainingPlanRows}
          onGeneratePdf={handleGeneratePdf}
        />
      ) : null}

      {activeTab === 'pdf-import' ? (
        <>
      <section className="panel report-upload-panel">
        <div className="report-upload-copy">
          <span className="report-upload-kicker">LEITURA REVERSA DE PDF</span>
          <h2>Upload do relatório modelo para preencher o Admin</h2>
          <p>
            O fluxo desta aba lê o PDF, extrai o contrato técnico, monta um pending
            local com tabela ISSF e, daqui mesmo, aprova e envia para o painel ISSF real.
          </p>
        </div>

        <label className="report-upload-cta">
          <FaUpload size={18} />
          <span>Selecionar PDF</span>
          <input
            type="file"
            accept=".pdf,application/pdf"
            hidden
            onChange={handleFileChange}
          />
        </label>
      </section>

      {(selectedFileName || loading || error || saveMessage || processingMessage) && (
        <section className="panel">
          <div className="report-status-row">
            <div className="report-status-pill">
              <FaFilePdf size={16} />
              <span>{selectedFileName || 'Nenhum arquivo selecionado'}</span>
            </div>
            {loading ? <strong>Lendo PDF...</strong> : null}
            {processingMessage ? <strong>{processingMessage}</strong> : null}
            {saveMessage ? <strong>{saveMessage}</strong> : null}
            {error ? <strong className="error">{error}</strong> : null}
          </div>
        </section>
      )}

      {showingGeneratedReport && generatedReport ? (
        <GeneratedDirectionalReportView
          report={generatedReport}
          onGeneratePdf={handleGeneratePdf}
        />
      ) : null}

      {parseResult ? (
        <>
          <section className="cards">
      {summaryCards.map((card) => (
        <div key={card.label} className="card">
          <span>{card.label}</span>
          <strong className="small-value">{card.value}</strong>
        </div>
      ))}
    </section>

          <section className="panel">
            <h2>Compatibilização</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 460px)', gap: 10 }}>
              <input
                value={editableAthleteName}
                onChange={(event) => setEditableAthleteName(event.target.value)}
                placeholder="Nome do atleta para compatibilizar com entradas anteriores"
              />
              <input
                value={editableEventName}
                onChange={(event) => setEditableEventName(event.target.value)}
                placeholder="Evento / prova para compatibilizar com o histórico"
              />
              <p style={{ margin: 0, color: '#475569' }}>
                Ajuste aqui o nome do atleta e o evento antes de gerar pending, exportar JSON ou aprovar para o ISSF real.
              </p>
            </div>
          </section>

          <section className="panel report-grid">
            <div className="panel taurus-panel">
              <h2>Contrato extraído</h2>
              <div className="taurus-report-card">
                <div className="taurus-report-head">
                  <div>
                    <small>{parseResult.report.reportTitle}</small>
                    <h3>{parseResult.report.subtitle}</h3>
                  </div>
                  <span className="taurus-report-pill">{parseResult.modality}</span>
                </div>

                <div className="taurus-report-flow">
                  <div className="taurus-premium-card taurus-premium-card-hero">
                    <p className="taurus-report-keyphrase">
                      {parseResult.report.keyPhrase || 'Contrato do relatório identificado.'}
                    </p>
                    <p className="taurus-report-description">
                      Fonte: {parseResult.sourceLabel}
                    </p>
                  </div>

                  <div className="taurus-report-metrics">
                    {parseResult.report.officialMetrics.map((metric) => (
                      <div key={metric.label} className="taurus-report-metric">
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="taurus-report-summary-grid">
                    <div className="taurus-report-summary-card">
                      <span>Séries</span>
                      <strong>
                        {parseResult.report.seriesTotals
                          .map((item) => `${item.seriesCode} ${item.total}`)
                          .join(' • ')}
                      </strong>
                    </div>
                    <div className="taurus-report-summary-card">
                      <span>Direções extraídas</span>
                      <strong>{parseResult.directions.filter(Boolean).length}</strong>
                    </div>
                    <div className="taurus-report-summary-card">
                      <span>Status do pending local</span>
                      <strong>{pendingDraft ? pendingEditMode ? 'Modify ativo' : 'Pending pronto' : parseResult.canPrefillAdmin ? 'Pronto' : 'Parcial'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel taurus-panel">
              <h2>Análise premium</h2>
              <div className="taurus-report-card">
                <div className="taurus-report-head">
                  <div>
                    <small>RELATÓRIO DIRECIONAL</small>
                    <h3>Leituras e treino sugerido</h3>
                  </div>
                  <span className="taurus-report-pill">
                    <FaArrowTrendUp size={14} /> Importado
                  </span>
                </div>

                <div className="taurus-report-flow">
                  {parseResult.report.insights.map((insight, index) => (
                    <div key={index} className="taurus-premium-card taurus-premium-card-insight">
                      <strong>Leitura técnica {index + 1}</strong>
                      <p>{insight}</p>
                    </div>
                  ))}

                  {parseResult.report.correction ? (
                    <div className="taurus-premium-card taurus-premium-card-section">
                      <strong>Correção principal</strong>
                      <p>{parseResult.report.correction}</p>
                    </div>
                  ) : null}

                  {parseResult.report.trainingProposal ? (
                    <div className="taurus-premium-card taurus-premium-card-section">
                      <strong>Proposta de treino</strong>
                      <p>{parseResult.report.trainingProposal}</p>
                    </div>
                  ) : null}

                  {parseResult.report.evidenceNote ? (
                    <div className="taurus-premium-card taurus-premium-card-cue">
                      <strong>Nota de evidência</strong>
                      <p>{parseResult.report.evidenceNote}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="panel report-grid">
            <div className="panel taurus-panel">
              <h2>Perfil direcional</h2>
              <DirectionalRadar rows={parseResult.report.directionalRows} />
            </div>

            <div className="panel taurus-panel">
              <h2>Pending local</h2>
              <p className="report-admin-note">
                Aqui você prepara a revisão, mantém o gráfico do relatório e decide se
                quer só espelhar em <strong>Pending ISSF</strong> ou aprovar direto para a
                base real de sessões ISSF.
              </p>
              <div className="admin-actions">
                <button type="button" onClick={handleCreateLocalPending}>
                  Criar pending local
                </button>
                <button type="button" onClick={handleExportCompatibleJson}>
                  Exportar JSON compatível
                </button>
                {pendingDraft ? (
                  <>
                    <button type="button" onClick={() => setPendingEditMode((current) => !current)}>
                      <FaPenToSquare size={14} /> {pendingEditMode ? 'Fechar modify' : 'Modify'}
                    </button>
                    <button type="button" onClick={handleDeletePending}>
                      <FaTrash size={14} /> Delete
                    </button>
                    <button type="button" onClick={handleSendPendingToAdmin}>
                      Enviar para Pending ISSF
                    </button>
                    <button type="button" onClick={handleApproveToRealIssf}>
                      <FaCheck size={14} /> Approve
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </section>

          {pendingDraft ? (
            <section className="panel">
              <h2>Tabela ISSF do pending local</h2>
              <ReportPendingTable
                draft={pendingDraft}
                editMode={pendingEditMode}
                onScoreChange={handlePendingCellChange}
                onDirectionChange={handlePendingDirectionChange}
              />
            </section>
          ) : null}

          <section className="panel">
            <h2>Painel ISSF real</h2>
            {realIssfSessions.length === 0 ? (
              <p style={{ padding: 16 }}>Nenhuma sessão ISSF aprovada para este atleta.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Atleta</th>
                    <th>Evento</th>
                    <th>Sessão</th>
                    <th>Prova</th>
                    <th>Séries</th>
                    <th>Tiros</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {realIssfSessions.map((item) => (
                    <tr key={item.sessionKey}>
                      <td>{item.athlete}</td>
                      <td>{item.event}</td>
                      <td>{item.session}</td>
                      <td>{item.prova}</td>
                      <td>{item.seriesCount}</td>
                      <td>{item.shotCount}</td>
                      <td>{item.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : null}
        </>
      ) : null}
    </main>
  )
}

function ReportPendingTable({ draft, editMode, onScoreChange, onDirectionChange }) {
  const directionOptions =
    draft.modality === 'RIFLE'
      ? ['Q1', 'Q2', 'Q3', 'Q4', 'CENTER']
      : ['UP', 'UPPER_RIGHT', 'RIGHT', 'LOWER_RIGHT', 'DOWN', 'LOWER_LEFT', 'LEFT', 'UPPER_LEFT', 'CENTER']

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="report-issf-table">
        <thead>
          <tr>
            <th>Série</th>
            {Array.from({ length: 10 }).map((_, index) => (
              <th key={index}>T{index + 1}</th>
            ))}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }).map((_, seriesIndex) => {
            const start = seriesIndex * 10
            const scores = draft.scores.slice(start, start + 10)
            return (
              <tr key={seriesIndex}>
                <td>SR{seriesIndex + 1}</td>
                {scores.map((score, shotOffset) => {
                  const shotIndex = start + shotOffset
                  return (
                    <td key={shotIndex}>
                      <div className="report-shot-cell">
                        <input
                          value={score || ''}
                          disabled={!editMode}
                          onChange={(event) => onScoreChange(shotIndex, event.target.value)}
                        />
                        <select
                          value={draft.directions[shotIndex] || ''}
                          disabled={!editMode}
                          onChange={(event) => onDirectionChange(shotIndex, event.target.value)}
                        >
                          <option value=""></option>
                          {directionOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  )
                })}
                <td>{sumScoreSlice(scores)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TrainingPlanReportTab({
  athleteName,
  approvedTrainingPlanRows,
  onGeneratePdf,
}) {
  return (
    <>
      <section className="panel report-premium-hero">
        <div className="report-premium-hero-copy">
          <small>TRAINING PLAN REPORT</small>
          <h2>{athleteName || 'Atleta'}</h2>
          <p>
            Aba dedicada aos treinos aprovados e substituições vindas da PLAN,
            pronta para exportação em PDF e futura entrega ao atleta.
          </p>
        </div>

        <div className="report-premium-hero-badges">
          <div className="report-premium-badge">
            <span>Treinos aprovados</span>
            <strong>{approvedTrainingPlanRows.length}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="report-toolbar">
          <strong>RELATÓRIO DE PRESCRIÇÃO</strong>
          <button type="button" onClick={onGeneratePdf}>
            Exportar PDF
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Treinos aprovados</h2>

        {approvedTrainingPlanRows.length === 0 ? (
          <p style={{ padding: 16, margin: 0 }}>
            Nenhum treino aprovado ainda para este atleta.
          </p>
        ) : (
          <div className="report-prescription-grid">
            {approvedTrainingPlanRows.map((item) => (
              <div key={item.prescriptionId} className="taurus-report-card report-prescription-card">
                <div className="taurus-report-head">
                  <div>
                    <small>{item.trainingCode || item.trainingId || 'TREINO'}</small>
                    <h3>{item.trainingTitle}</h3>
                  </div>
                  <span className="taurus-report-pill">
                    <FaDumbbell size={14} /> {item.decision}
                  </span>
                </div>

                <div className="taurus-report-flow">
                  <div className="taurus-report-summary-grid">
                    <div className="taurus-report-summary-card">
                      <span>Bloco</span>
                      <strong>{item.blockCode || '-'}</strong>
                    </div>
                    <div className="taurus-report-summary-card">
                      <span>Parâmetro</span>
                      <strong>{item.parameterCode || '-'}</strong>
                    </div>
                    <div className="taurus-report-summary-card">
                      <span>Fase</span>
                      <strong>{item.phaseCode || '-'}</strong>
                    </div>
                    <div className="taurus-report-summary-card">
                      <span>Origem</span>
                      <strong>{item.origin || '-'}</strong>
                    </div>
                  </div>

                  <div className="taurus-premium-card taurus-premium-card-section">
                    <strong>Observação</strong>
                    <p>{item.notes || item.prescriptionText || 'Sem observação adicional.'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function DirectionalRadar({ rows }) {
  if (!rows?.length) {
    return <p style={{ padding: 16 }}>Sem perfil direcional.</p>
  }

  const normalizedRows = rows.map((row, index) => ({
    ...row,
    numericValue: Number(String(row.value || '').replace('%', '').replace(',', '.')) || 0,
    index,
  }))

  const maxValue = Math.max(...normalizedRows.map((row) => row.numericValue), 1)
  const size = 320
  const center = size / 2
  const radius = 112
  const angleStep = (Math.PI * 2) / normalizedRows.length
  const points = normalizedRows
    .map((row, index) => {
      const ratio = row.numericValue / maxValue
      const angle = index * angleStep - Math.PI / 2
      const x = center + Math.cos(angle) * radius * ratio
      const y = center + Math.sin(angle) * radius * ratio
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="report-directional-shell">
      <svg viewBox={`0 0 ${size} ${size}`} className="report-directional-svg">
        {[0.25, 0.5, 0.75, 1].map((step) => (
          <circle
            key={step}
            cx={center}
            cy={center}
            r={radius * step}
            fill="none"
            stroke="#dbe3ef"
          />
        ))}

        {normalizedRows.map((row, index) => {
          const angle = index * angleStep - Math.PI / 2
          const x = center + Math.cos(angle) * radius
          const y = center + Math.sin(angle) * radius
          const labelX = center + Math.cos(angle) * (radius + 28)
          const labelY = center + Math.sin(angle) * (radius + 28)

          return (
            <g key={row.label}>
              <line x1={center} y1={center} x2={x} y2={y} stroke="#dbe3ef" />
              <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="700" fill="#334155">
                {row.label}
              </text>
            </g>
          )
        })}

        <polygon points={points} fill="rgba(37,99,235,0.18)" stroke="#2563eb" strokeWidth="3" />
      </svg>

      <div className="report-directional-list">
        {normalizedRows.map((row) => (
          <div key={row.label} className="report-directional-item">
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function IndicesRadar({ rows, accent = '#2563eb' }) {
  if (!rows?.length) {
    return <p style={{ padding: 16 }}>Sem índices disponíveis.</p>
  }

  const normalizedRows = rows.map((row, index) => ({
    ...row,
    numericValue: Number(row.numericValue ?? row.score ?? row.value ?? 0) || 0,
    displayValue: row.score ?? row.value ?? row.numericValue ?? '-',
    index,
  }))

  const size = 320
  const center = size / 2
  const radius = 112
  const angleStep = (Math.PI * 2) / normalizedRows.length
  const points = normalizedRows
    .map((row, index) => {
      const ratio = Math.max(0, Math.min(1, row.numericValue / 10))
      const angle = index * angleStep - Math.PI / 2
      const x = center + Math.cos(angle) * radius * ratio
      const y = center + Math.sin(angle) * radius * ratio
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="report-directional-shell report-indices-shell">
      <svg viewBox={`0 0 ${size} ${size}`} className="report-directional-svg">
        {[0.2, 0.4, 0.6, 0.8, 1].map((step) => (
          <circle
            key={step}
            cx={center}
            cy={center}
            r={radius * step}
            fill="none"
            stroke="#dbe3ef"
          />
        ))}

        {normalizedRows.map((row, index) => {
          const angle = index * angleStep - Math.PI / 2
          const x = center + Math.cos(angle) * radius
          const y = center + Math.sin(angle) * radius
          const labelX = center + Math.cos(angle) * (radius + 28)
          const labelY = center + Math.sin(angle) * (radius + 28)
          const glyphX = center + Math.cos(angle) * (radius + 16)
          const glyphY = center + Math.sin(angle) * (radius + 16)

          return (
            <g key={row.code || row.label}>
              <line x1={center} y1={center} x2={x} y2={y} stroke="#dbe3ef" />
              <foreignObject x={glyphX - 10} y={glyphY - 10} width="20" height="20">
                <div className="report-radar-glyph">
                  <ParameterGlyph parameterCode={row.parameterCode} />
                </div>
              </foreignObject>
              <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="700" fill="#334155">
                {translateCode(PARAMETER_CODES, row.parameterCode, 'pt')}
              </text>
            </g>
          )
        })}

        <polygon points={points} fill={`${accent}2a`} stroke={accent} strokeWidth="3" />
      </svg>

      <div className="report-directional-list report-index-list">
        {normalizedRows.map((row) => (
          <div key={row.code || row.label} className="report-directional-item">
            <span>{row.label}</span>
            <strong>{row.displayValue}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function ParameterGlyph({ parameterCode }) {
  const iconMap = {
    OUTCOME: FaBullseye,
    PROCESS: FaCrosshairs,
    RHYTHM: FaSignal,
    DEEPENING: FaChartLine,
    CONSISTENCY: FaGaugeHigh,
    TRANSFER: FaArrowRightArrowLeft,
    RESILIENCE: FaShieldHeart,
    PRESSURE: FaBolt,
    EMOTIONAL: FaArrowsDownToLine,
    PHYSICAL: FaHeartPulse,
  }

  const Icon = iconMap[parameterCode] || FaBullseye
  return <Icon size={16} strokeWidth={2.1} />
}

function GeneratedDirectionalReportView({ report, onGeneratePdf }) {
  const aggregate = report.aggregate
  const athleteView = report.athleteView
  const targetRows = athleteView?.indices?.targets || []
  const structureRows = athleteView?.indices?.structure || []
  const prescribedTrainings = athleteView?.trainingPlan?.prescribedTrainings || []
  const coachPrescriptions = athleteView?.trainingPlan?.coachPrescriptions || []
  const connectedRecommendations = buildConnectedTrainingRecommendations({
    athleteView,
    targetRows,
    structureRows,
  })
  const cards = [
    { label: 'Atleta', value: report.athleteName || '-' },
    { label: 'Filtro', value: report.filterLabel || '-' },
    { label: 'Eventos com direção', value: String(report.sessions?.length || 0) },
    {
      label: 'Tiros com direção',
      value: String(aggregate?.directions?.filter?.(Boolean)?.length || aggregate?.report?.officialMetrics?.find((item) => item.label === 'Tiros com direção')?.value || 0),
    },
  ]

  return (
    <>
      <section className="panel report-premium-hero">
        <div className="report-premium-hero-copy">
          <small>HCI PREMIUM REPORT</small>
          <h2>{report.athleteName || 'Atleta'}</h2>
          <p>
            {report.filterLabel || '-'} • Relatório direcional premium gerado a partir
            do snapshot do Admin, com visão consolidada e comparação entre eventos.
          </p>
        </div>

        <div className="report-premium-hero-badges">
          <div className="report-premium-badge">
            <span>Filtro</span>
            <strong>{report.filterLabel || '-'}</strong>
          </div>
          <div className="report-premium-badge">
            <span>Eventos</span>
            <strong>{report.sessions?.length || 0}</strong>
          </div>
        </div>
      </section>

      <section className="cards">
        {cards.map((card) => (
          <div key={card.label} className="card">
            <span>{card.label}</span>
            <strong className="small-value">{card.value}</strong>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="report-toolbar">
          <strong>RELATÓRIO PREMIUM GERADO PELO ADMIN</strong>
          <button type="button" onClick={onGeneratePdf}>
            Gerar PDF
          </button>
        </div>
      </section>

      {aggregate ? (
        <section className="panel report-grid report-print-block">
          <div className="panel taurus-panel">
            <h2>Visão consolidada</h2>
            <div className="taurus-report-card">
              <div className="taurus-report-head">
                <div>
                  <small>{aggregate.report.reportTitle}</small>
                  <h3>{aggregate.report.subtitle}</h3>
                </div>
                <span className="taurus-report-pill">{aggregate.modality}</span>
              </div>

              <div className="taurus-report-flow">
                <div className="taurus-premium-card taurus-premium-card-hero">
                  <p className="taurus-report-keyphrase">{aggregate.report.keyPhrase}</p>
                  <p className="taurus-report-description">{aggregate.report.trainingProposal}</p>
                </div>

                <div className="taurus-report-metrics">
                  {aggregate.report.officialMetrics.map((metric) => (
                    <div key={metric.label} className="taurus-report-metric">
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </div>
                  ))}
                </div>

                <div className="taurus-report-insights">
                  {aggregate.report.insights.map((insight, index) => (
                    <div key={index} className="taurus-premium-card taurus-premium-card-insight">
                      <strong>Leitura técnica {index + 1}</strong>
                      <p>{insight}</p>
                    </div>
                  ))}
                </div>

                {aggregate.report.correction ? (
                  <div className="taurus-premium-card taurus-premium-card-section">
                    <strong>Correção principal</strong>
                    <p>{aggregate.report.correction}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="panel taurus-panel">
            <h2>Gráfico direcional consolidado</h2>
            <DirectionalRadar rows={aggregate.report.directionalRows} />
            {aggregate.report.secondaryDirectionalRows?.length > 0 ? (
              <div className="report-secondary-grid">
                {aggregate.report.secondaryDirectionalRows.map((row) => (
                  <div key={row.code || row.label} className="taurus-report-summary-card">
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="panel">
          <h2>Visão consolidada</h2>
          <p style={{ padding: 16 }}>Nenhum evento com direção disponível para este filtro.</p>
        </section>
      )}

      <section className="panel report-grid report-print-block">
        <div className="panel taurus-panel">
          <h2>Targets</h2>
          <div className="taurus-report-card">
            <div className="taurus-report-head">
              <div>
                <small>PERFIL DE METAS</small>
                <h3>Leitura dos parâmetros de resultado e processo</h3>
              </div>
              <span className="taurus-report-pill">
                <FaBullseye size={14} /> Targets
              </span>
            </div>

            <div className="taurus-report-flow">
              <IndicesRadar rows={targetRows} accent="#2563eb" />
              <div className="report-parameter-grid">
                {targetRows.length > 0 ? (
                  targetRows.map((item) => (
                    <div key={item.code || item.label} className="report-parameter-card report-parameter-card-target">
                      <div className="report-parameter-head">
                        <span className="parameter-icon" aria-hidden="true">
                          <ParameterGlyph parameterCode={item.parameterCode} />
                        </span>
                        <strong>{translateCode(PARAMETER_CODES, item.parameterCode, 'pt')}</strong>
                      </div>
                      <span>{item.levelLabel || translateCode(LEVEL_CODES, item.levelCode, 'pt') || 'Sem nível'}</span>
                      <b>{item.score ?? item.numericValue ?? '-'}</b>
                    </div>
                  ))
                ) : (
                  <div className="taurus-premium-card taurus-premium-card-section">
                    <strong>Sem dados</strong>
                    <p>O snapshot atual ainda não trouxe parâmetros em Targets para este atleta.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="panel taurus-panel">
          <h2>Structure</h2>
          <div className="taurus-report-card">
            <div className="taurus-report-head">
              <div>
                <small>PERFIL DE FUNDAMENTOS</small>
                <h3>Base estrutural e estabilidade de sustentação</h3>
              </div>
              <span className="taurus-report-pill">
                <FaShieldHeart size={14} /> Structure
              </span>
            </div>

            <div className="taurus-report-flow">
              <IndicesRadar rows={structureRows} accent="#0f766e" />
              <div className="report-parameter-grid">
                {structureRows.length > 0 ? (
                  structureRows.map((item) => (
                    <div key={item.code || item.label} className="report-parameter-card report-parameter-card-structure">
                      <div className="report-parameter-head">
                        <span className="parameter-icon" aria-hidden="true">
                          <ParameterGlyph parameterCode={item.parameterCode} />
                        </span>
                        <strong>{translateCode(PARAMETER_CODES, item.parameterCode, 'pt')}</strong>
                      </div>
                      <span>{item.levelLabel || translateCode(LEVEL_CODES, item.levelCode, 'pt') || 'Sem nível'}</span>
                      <b>{item.score ?? item.numericValue ?? '-'}</b>
                    </div>
                  ))
                ) : (
                  <div className="taurus-premium-card taurus-premium-card-section">
                    <strong>Sem dados</strong>
                    <p>O snapshot atual ainda não trouxe parâmetros em Structure para este atleta.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel report-print-block">
        <h2>Prescrições de treino</h2>
        <div className="report-prescription-grid">
          {connectedRecommendations.length > 0 ? (
            connectedRecommendations.map((item, index) => (
              <div key={`${item.training.trainingId}-${item.parameter.parameterCode}-${index}`} className="taurus-report-card report-prescription-card">
                <div className="taurus-report-head">
                  <div>
                    <small>{item.training.trainingId}</small>
                    <h3>{item.training.name?.['pt-BR'] || item.training.name?.['en-US'] || 'Treino conectado'}</h3>
                  </div>
                  <span className="taurus-report-pill">
                    <FaDumbbell size={14} /> Motor
                  </span>
                </div>

                <div className="taurus-report-flow">
                  <div className="report-prescription-parameter-strip">
                    <div className="report-prescription-parameter-chip">
                      <span className="parameter-icon" aria-hidden="true">
                        <ParameterGlyph parameterCode={item.parameter.parameterCode} />
                      </span>
                      <div className="report-prescription-parameter-copy">
                        <strong>{translateCode(PARAMETER_CODES, item.parameter.parameterCode, 'pt')}</strong>
                        <small>{translateCode(LEVEL_CODES, item.parameter.levelCode, 'pt')} • {item.parameter.score}</small>
                      </div>
                    </div>
                  </div>

                  <div className="report-prescription-meta-grid">
                    <div className="report-parameter-card report-parameter-card-target">
                      <strong>Objetivo</strong>
                      <span>{item.training.objective?.['pt-BR'] || item.training.objective?.['en-US'] || '-'}</span>
                      <b>{item.training.phase || '-'}</b>
                    </div>
                  </div>

                  <div className="taurus-premium-card taurus-premium-card-section">
                    <strong>Execução</strong>
                    <p>{item.training.description?.['pt-BR'] || item.training.description?.['en-US'] || 'Sem descrição detalhada.'}</p>
                  </div>

                  <div className="taurus-premium-card taurus-premium-card-section">
                    <strong>Como fazer</strong>
                    <p>{formatTrainingBulletList(item.training.howToDo?.['pt-BR'] || item.training.howToDo?.['en-US'])}</p>
                  </div>
                </div>
              </div>
            ))
          ) : prescribedTrainings.length > 0 ? (
            prescribedTrainings.map((item, index) => (
              <div key={`${item.trainingId || item.code || 'training'}-${index}`} className="taurus-report-card report-prescription-card">
                <div className="taurus-report-head">
                  <div>
                    <small>{item.code || `TREINO ${index + 1}`}</small>
                    <h3>{item.trainingTitle || item.title || 'Treino prescrito'}</h3>
                  </div>
                  <span className="taurus-report-pill">
                    <FaDumbbell size={14} /> {item.block || 'TRAINING'}
                  </span>
                </div>

                <div className="taurus-report-flow">
                  <div className="taurus-report-summary-grid">
                    <div className="taurus-report-summary-card">
                      <span>Bloco</span>
                      <strong>{item.block || '-'}</strong>
                    </div>
                    <div className="taurus-report-summary-card">
                      <span>Origem</span>
                      <strong>{item.prescribedByRole || item.source || '-'}</strong>
                    </div>
                    <div className="taurus-report-summary-card">
                      <span>Status</span>
                      <strong>{item.status || 'ACTIVE'}</strong>
                    </div>
                  </div>

                  {item.prescriptionText || item.description || item.notes ? (
                    <div className="taurus-premium-card taurus-premium-card-section">
                      <strong>Prescrição</strong>
                      <p>{item.prescriptionText || item.description || item.notes}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          ) : coachPrescriptions.length > 0 ? (
            coachPrescriptions.map((item, index) => (
              <div key={`${item.trainingId || item.code || 'coach'}-${index}`} className="taurus-report-card report-prescription-card">
                <div className="taurus-report-head">
                  <div>
                    <small>{item.code || `PRESCRIÇÃO ${index + 1}`}</small>
                    <h3>{item.trainingTitle || item.title || 'Prescrição do coach'}</h3>
                  </div>
                  <span className="taurus-report-pill">
                    <FaMedal size={14} /> Coach
                  </span>
                </div>

                <div className="taurus-report-flow">
                  <div className="taurus-premium-card taurus-premium-card-section">
                    <strong>Prescrição</strong>
                    <p>{item.prescriptionText || item.description || item.notes || 'Sem texto detalhado.'}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="taurus-report-card report-prescription-card">
              <div className="taurus-report-head">
                <div>
                  <small>PLANO DE TREINO</small>
                  <h3>Nenhuma prescrição disponível</h3>
                </div>
              </div>

              <div className="taurus-report-flow">
                <div className="taurus-premium-card taurus-premium-card-section">
                  <strong>Sem prescrições</strong>
                  <p>O relatório já mostra os gráficos e o target direcional, mas este atleta ainda não tem prescrições de treino registradas no snapshot atual.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {report.sessions?.length > 0 ? (
        <section className="panel">
          <h2>Eventos direcionais</h2>
          <div className="report-events-grid">
            {report.sessions.map((session) => (
              <div key={session.sessionId} className="panel taurus-panel report-event-card">
                <h2>{session.eventLabel}</h2>
                <div className="taurus-report-card">
                  <div className="taurus-report-head">
                    <div>
                      <small>{session.report.reportTitle}</small>
                      <h3>{session.report.subtitle}</h3>
                    </div>
                    <span className="taurus-report-pill">{session.modality}</span>
                  </div>

                  <div className="taurus-report-flow">
                    <DirectionalRadar rows={session.report.directionalRows} />

                    <div className="taurus-report-summary-grid">
                      <div className="taurus-report-summary-card">
                        <span>Tipo</span>
                        <strong>{session.sessionType}</strong>
                      </div>
                      <div className="taurus-report-summary-card">
                        <span>Data</span>
                        <strong>{session.sessionDate || '-'}</strong>
                      </div>
                      {session.report.seriesTotals.map((item) => (
                        <div key={item.seriesCode} className="taurus-report-summary-card">
                          <span>{item.seriesCode}</span>
                          <strong>{item.total}</strong>
                        </div>
                      ))}
                    </div>

                    <div className="taurus-report-insights">
                      {session.report.insights.map((insight, index) => (
                        <div key={index} className="taurus-premium-card taurus-premium-card-insight">
                          <strong>Leitura técnica {index + 1}</strong>
                          <p>{insight}</p>
                        </div>
                      ))}
                    </div>

                    {session.report.correction ? (
                      <div className="taurus-premium-card taurus-premium-card-section">
                        <strong>Correção principal</strong>
                        <p>{session.report.correction}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}

function getNextEventCode(snapshot) {
  const existingEvents = [
    ...((snapshot?.shotSeries || []).map((row) => row.evento)),
    ...((snapshot?.pendingGroups || []).map((row) => row.event)),
    ...((snapshot?.sessionHeaders || []).map((row) => row.eventCode)),
  ]

  const maxNumber = existingEvents.reduce((max, eventCode) => {
    const match = String(eventCode || '').match(/^EV_(\d+)$/)
    if (!match) return max
    return Math.max(max, Number(match[1]))
  }, 0)

  return `EV_${String(maxNumber + 1).padStart(4, '0')}`
}

function ensureLeadForAthlete(snapshot, athleteName) {
  const resolvedAthleteName = resolveExistingAthleteName(snapshot, athleteName)
  const exists = (snapshot?.leads || []).some((item) => athleteNamesMatch(item.athleteName, resolvedAthleteName))
  if (exists) return snapshot

  return {
    ...snapshot,
    leads: [
      ...(snapshot?.leads || []),
      {
        leadId: `report_${resolvedAthleteName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        athleteName: resolvedAthleteName,
        athleteEmail: '',
        source: 'REPORT_PDF_IMPORT',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
  }
}

function buildCompatibleImportJson(parseResult, selectedFileName, athleteNameOverride, eventNameOverride) {
  const scores = parseResult.scores || []
  const directions = parseResult.directions || []
  const seriesTable = Array.from({ length: 6 }, (_, seriesIndex) => {
    const row = { serie: `SR${seriesIndex + 1}` }

    Array.from({ length: 10 }, (_, shotIndex) => {
      const absoluteIndex = seriesIndex * 10 + shotIndex
      row[`T${shotIndex + 1}`] = {
        score: scores[absoluteIndex] || '',
        direction: directions[absoluteIndex] || '',
        innerTen: /x/i.test(String(scores[absoluteIndex] || '')),
        x: '',
        y: '',
        confidence: 'HIGH',
      }
      return null
    })

    return row
  })

  return {
    sourceType: 'HCI_IA_RESULT',
    sourceOrigin: 'REPORT_PDF_IMPORT',
    sourceFileName: selectedFileName || '',
    modality: parseResult.modality || 'PISTOL',
    athlete: athleteNameOverride || parseResult.athleteName || '',
    event: eventNameOverride || parseResult.eventLabel || '',
    date: parseResult.sessionDate || '',
    total:
      parseResult.report?.officialMetrics?.find((item) => item.label === 'Total')?.value ||
      String(sumScoreSlice(scores)),
    series_table: seriesTable,
    report_metadata: {
      reportTitle: parseResult.report?.reportTitle || '',
      sourceLabel: parseResult.sourceLabel || '',
      eventLabel: parseResult.eventLabel || '',
    },
    createdAt: new Date().toISOString(),
  }
}

function flattenSeriesTableScores(seriesTable) {
  return (seriesTable || []).flatMap((row) =>
    Array.from({ length: 10 }, (_, index) => row?.[`T${index + 1}`]?.score || '')
  )
}

function flattenSeriesTableDirections(seriesTable) {
  return (seriesTable || []).flatMap((row) =>
    Array.from({ length: 10 }, (_, index) => row?.[`T${index + 1}`]?.direction || '')
  )
}

function buildApprovedIssfSessions(snapshot, athleteName) {
  if (!athleteName) return []

  const approvedHeaders = (snapshot?.sessionHeaders || []).filter(
    (item) => athleteNamesMatch(item.athleteName, athleteName) && item.sessionStatus === 'APPROVED'
  )

  if (approvedHeaders.length > 0) {
    return approvedHeaders.map((header) => ({
      sessionKey: header.sessionId,
      athlete: header.athleteName || '-',
      event: header.eventCode || '-',
      session: denormalizeSessionType(header.sessionType),
      prova: header.modality || '-',
      seriesCount: header.seriesCount || 0,
      shotCount: header.shotCount || 0,
      total: Number((header.totalScore || 0).toFixed(1)),
    }))
  }

  const rows = (snapshot?.shotSeries || []).filter((item) => athleteNamesMatch(item.atleta, athleteName))
  const grouped = new Map()

  rows.forEach((row) => {
    const sessionKey = row.sessionId || row.idBloco || `${row.atleta}|${row.evento}|${row.sessao}|${row.prova}`
    if (!grouped.has(sessionKey)) {
      grouped.set(sessionKey, {
        sessionKey,
        athlete: row.atleta || '-',
        event: row.evento || '-',
        session: row.sessao || '-',
        prova: row.prova || '-',
        seriesCount: 0,
        shotCount: 0,
        total: 0,
      })
    }

    const current = grouped.get(sessionKey)
    const shots = String(row.tiros || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    current.seriesCount += 1
    current.shotCount += shots.length
    current.total += sumScoreSlice(shots)
  })

  return Array.from(grouped.values()).map((item) => ({
    ...item,
    total: Number(item.total.toFixed(1)),
  }))
}

function buildApprovedTrainingPlanRows(snapshot, athleteName) {
  if (!athleteName) return []

  return (snapshot?.prescriptions || [])
    .filter((item) => athleteNamesMatch(item.athlete || item.athleteName, athleteName))
    .filter((item) => item.decision === 'APPROVED' || item.decision === 'REPLACED')
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
}

function sumScoreSlice(scores) {
  const total = (scores || []).reduce((sum, value) => {
    const clean = String(value || '').replace(/[xX]/g, '').trim()
    const numeric = Number(clean)
    return sum + (Number.isNaN(numeric) ? 0 : numeric)
  }, 0)

  return Number(total.toFixed(1))
}

function denormalizeSessionType(value) {
  const normalizedValue = String(value || '').trim().toUpperCase()
  if (normalizedValue === 'TRAINING') return 'TREINO'
  if (normalizedValue === 'SIMULATION') return 'SIMULADO'
  if (normalizedValue === 'COMPETITION') return 'COMPETICAO'
  return normalizedValue || 'TREINO'
}

function buildConnectedTrainingRecommendations({ athleteView, targetRows, structureRows }) {
  const discipline = String(athleteView?.athlete?.discipline || '').toUpperCase()
  const levelCode = String(athleteView?.summary?.levelCode || '').toUpperCase()
  const library = getTrainingLibraryEntries().filter((item) => item?.active !== false)
  const rankedParameters = [...(targetRows || []), ...(structureRows || [])]
    .map((item) => ({
      ...item,
      numericScore: Number(item.score ?? item.numericValue ?? 0) || 0,
    }))
    .sort((a, b) => a.numericScore - b.numericScore)
    .slice(0, 4)

  return rankedParameters
    .map((parameter) => {
      const training = selectLibraryTrainingForParameter({
        library,
        parameterCode: parameter.parameterCode,
        discipline,
        levelCode,
      })

      if (!training) return null

      return {
        parameter,
        training,
        reason: buildMotorReason(parameter, training),
      }
    })
    .filter(Boolean)
}

function selectLibraryTrainingForParameter({ library, parameterCode, discipline, levelCode }) {
  const matches = library.filter((item) => {
    const parameterMatch = String(item.parameter || '').toUpperCase() === String(parameterCode || '').toUpperCase()
    const weaponClass = String(item.weaponClass || '').toUpperCase()
    const level = String(item.level || '').toUpperCase()
    const disciplineMatch =
      !discipline ||
      !weaponClass ||
      weaponClass === discipline ||
      weaponClass === 'PISTOL/RIFLE'
    const levelMatch =
      !levelCode ||
      !level ||
      level === levelCode ||
      level.includes(levelCode) ||
      levelCode.includes(level)

    return parameterMatch && disciplineMatch && levelMatch
  })

  const ordered = matches.sort((a, b) => {
    const phaseRankA = getPhaseRank(a.phase)
    const phaseRankB = getPhaseRank(b.phase)
    if (phaseRankA !== phaseRankB) return phaseRankA - phaseRankB
    return String(a.trainingId || '').localeCompare(String(b.trainingId || ''))
  })

  return ordered[0] || null
}

function getPhaseRank(phase) {
  const value = String(phase || '').toUpperCase()
  if (value === 'SPECIFIC_PREPARATION') return 1
  if (value === 'GENERAL_PREPARATION') return 2
  if (value === 'PRE_COMPETITION') return 3
  if (value === 'COMPETITION') return 4
  return 9
}

function buildMotorReason(parameter, training) {
  const parameterLabel = translateCode(PARAMETER_CODES, parameter.parameterCode, 'pt')
  const levelLabel = translateCode(LEVEL_CODES, parameter.levelCode, 'pt')
  return `${parameterLabel} entrou na prioridade do motor com score ${parameter.score}. A Library conectou o treino ${training.trainingId} por parâmetro, nível e disciplina. Nível atual: ${levelLabel}.`
}

function formatTrainingBulletList(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(' | ')
  }
  return value || 'Sem passo a passo detalhado.'
}

export default ReportPage
