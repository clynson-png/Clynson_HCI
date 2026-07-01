import { useEffect, useMemo, useState } from 'react'
import {
  getTrainingLibraryEntries,
  getTrainingLibraryStats,
  getTrainingById,
} from '../services/trainingLibraryService'
import {
  fetchTrelloBoardSnapshot,
  getPlanTrelloBoards,
  isTrelloConfigured,
} from '../services/trelloService'
import { getTrainingPlan } from '../services/planApi'
import { athleteNamesMatch } from '../services/athleteIdentity'

function PlanoPage({
  snapshot,
  onActiveSnapshotChange,
  lang = 'pt',
  athletes = [],
  selectedAthlete = '',
  onAthleteChange,
}) {
  const uiLang = lang === 'en' ? 'en-US' : 'pt-BR'
  const trainingStats = getTrainingLibraryStats()
  const trainings = useMemo(() => getTrainingLibraryEntries(), [])
  const trelloBoards = useMemo(() => getPlanTrelloBoards(), [])
  const trelloReady = isTrelloConfigured()

  const [phase, setPhase] = useState('ALL')
  const [parameter, setParameter] = useState('ALL')
  const [level, setLevel] = useState('ALL')
  const [targetType, setTargetType] = useState('ALL')
  const [selectedTrainingId, setSelectedTrainingId] = useState(
    trainingStats.firstTraining || ''
  )
  const [selectedBoardId, setSelectedBoardId] = useState(trelloBoards[0]?.id || '')
  const [boardSnapshot, setBoardSnapshot] = useState(null)
  const [boardLoading, setBoardLoading] = useState(false)
  const [boardError, setBoardError] = useState('')
  const [planPayload, setPlanPayload] = useState(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState('')
  const [replaceMode, setReplaceMode] = useState(null)

  const filteredTrainings = useMemo(() => {
    return trainings.filter((training) => {
      return (
        (phase === 'ALL' || training.phase === phase) &&
        (parameter === 'ALL' || training.parameter === parameter) &&
        (level === 'ALL' || training.level === level) &&
        (targetType === 'ALL' || training.targetType === targetType)
      )
    })
  }, [trainings, phase, parameter, level, targetType])

  const selectedTraining =
    getTrainingById(selectedTrainingId) || filteredTrainings[0]
  const selectedBoard =
    trelloBoards.find((board) => board.id === selectedBoardId) || trelloBoards[0] || null
  const selectedAthleteName = selectedAthlete || athletes[0] || ''
  const localAthletePrescriptions = useMemo(() => {
    return (snapshot?.prescriptions || []).filter((item) =>
      athleteNamesMatch(item.athlete || item.athleteName, selectedAthleteName)
    )
  }, [snapshot, selectedAthleteName])
  const trainingPlan = useMemo(() => {
    const apiPlan = planPayload?.trainingPlan || null

    if (!apiPlan) {
      return null
    }

    const localCoachPrescriptions = localAthletePrescriptions.filter(
      (item) => item.prescribedByRole === 'ADMIN_DESKTOP'
    )
    const localPrescribedTrainings = localAthletePrescriptions
      .filter((item) => item.decision !== 'REJECTED' && item.status !== 'REMOVED')
      .map((item, index) => ({
        prescriptionId: item.prescriptionId,
        origin: item.origin || 'COACH_ADDED',
        trainingId: item.trainingId || null,
        trainingCode: item.trainingCode || item.code || item.trainingId || `TRAINING_${index + 1}`,
        trainingTitle: item.trainingTitle || item.title || item.trainingCode || item.trainingId || '-',
        blockCode: item.blockCode || item.block || 'MAIN',
        parameterCode: item.parameterCode || item.parameter || null,
        phaseCode: item.phaseCode || item.phase || null,
        sessionType: item.sessionType || 'TRAINING',
        modality: item.modality || apiPlan.modality || null,
        orderIndex: index + 1,
        prescriptionText: item.notes || null,
        notes: item.notes || null,
        status: item.status || 'ACTIVE',
      }))

    return {
      ...apiPlan,
      coachPrescriptions:
        localCoachPrescriptions.length > 0
          ? localCoachPrescriptions
          : apiPlan.coachPrescriptions || [],
      prescribedTrainings:
        localPrescribedTrainings.length > 0
          ? localPrescribedTrainings
          : apiPlan.prescribedTrainings || [],
    }
  }, [planPayload, localAthletePrescriptions])
  const engineRecommendations = trainingPlan?.engineRecommendations || []
  const coachPrescriptions = trainingPlan?.coachPrescriptions || []
  const prescribedTrainings = trainingPlan?.prescribedTrainings || []
  const persistedRejectedRecommendations = coachPrescriptions.filter(
    (item) => item.decision === 'REJECTED'
  )
  const prescriptionAudit = useMemo(() => {
    return buildPrescriptionAudit({
      trainingPlan,
      localPrescriptions: localAthletePrescriptions,
      selectedAthleteName,
      phase,
      parameter,
      targetType,
      acceptedChecks: snapshot?.planAuditAcceptedChecks || [],
    })
  }, [
    trainingPlan,
    localAthletePrescriptions,
    selectedAthleteName,
    phase,
    parameter,
    targetType,
    snapshot?.planAuditAcceptedChecks,
  ])
  const selectedLead =
    (snapshot?.leads || []).find((item) => item.athleteName === selectedAthleteName) || null
  const athleteEmail = selectedLead?.athleteEmail || trainingPlan?.athleteEmail || ''

  useEffect(() => {
    let cancelled = false

    async function loadBoardSnapshot() {
      if (!selectedBoard || !trelloReady) {
        setBoardSnapshot(null)
        setBoardError('')
        return
      }

      setBoardLoading(true)
      setBoardError('')

      try {
        const snapshot = await fetchTrelloBoardSnapshot(selectedBoard.shortLink, {
          athleteEmail,
        })

        if (!cancelled) {
          setBoardSnapshot(snapshot)
        }
      } catch {
        if (!cancelled) {
          setBoardSnapshot(null)
          setBoardError(
            lang === 'en'
              ? 'Could not load Trello board data right now.'
              : 'Nao foi possivel carregar os dados do quadro Trello agora.'
          )
        }
      } finally {
        if (!cancelled) {
          setBoardLoading(false)
        }
      }
    }

    loadBoardSnapshot()

    return () => {
      cancelled = true
    }
  }, [selectedBoard, trelloReady, lang, athleteEmail])

  useEffect(() => {
    let cancelled = false

    async function loadTrainingPlan() {
      setPlanLoading(true)
      setPlanError('')

      try {
        const nextPlan = await getTrainingPlan({
          athleteId: selectedAthleteName || 'UNDEFINED_ATHLETE',
          athleteName: selectedAthleteName || 'UNDEFINED_ATHLETE',
          athleteEmail,
          modality: selectedTraining?.weaponClass || 'PISTOL',
          levelCode: level === 'ALL' ? 'INTERMEDIATE' : level,
          phaseCode: phase === 'ALL' ? 'UNDEFINED' : phase,
          targetType,
          parameterCode: parameter,
        })

        if (!cancelled) {
          setPlanPayload(nextPlan)
        }
      } catch {
        if (!cancelled) {
          setPlanPayload(null)
          setPlanError(
            lang === 'en'
              ? 'Could not load training plan contract from admin backend.'
              : 'Nao foi possivel carregar o contrato do training plan pelo admin backend.'
          )
        }
      } finally {
        if (!cancelled) {
          setPlanLoading(false)
        }
      }
    }

    loadTrainingPlan()

    return () => {
      cancelled = true
    }
  }, [lang, level, phase, selectedTraining, selectedAthleteName, athleteEmail, targetType, parameter])

  function handleFilterChange(setter) {
    return (event) => {
      setter(event.target.value)
      setSelectedTrainingId('')
    }
  }

  function persistPlanDecision({
    recommendation,
    decision,
    replacementTraining = null,
  }) {
    if (!snapshot || !selectedAthleteName || !recommendation) {
      return
    }

    const now = Date.now()
    const resolvedTraining = replacementTraining || recommendation
    const trainingId = resolvedTraining.trainingId
    const trainingCode = resolvedTraining.trainingCode || resolvedTraining.trainingId
    const trainingTitle =
      resolvedTraining.trainingTitle ||
      resolvedTraining.name?.[uiLang] ||
      resolvedTraining.name?.['pt-BR'] ||
      resolvedTraining.name?.['en-US'] ||
      trainingCode
    const parameterCode = resolvedTraining.parameterCode || resolvedTraining.parameter || null
    const phaseCode = resolvedTraining.phaseCode || resolvedTraining.phase || null
    const targetTypeValue = resolvedTraining.targetType || targetType || null
    const origin =
      decision === 'REPLACED'
        ? 'ENGINE_REPLACED'
        : decision === 'APPROVED'
          ? 'ENGINE_APPROVED'
          : 'COACH_ADDED'

    const nextPrescription = {
      prescriptionId: `${selectedAthleteName}_${trainingCode}_${decision}_${now}`,
      athlete: selectedAthleteName,
      athleteName: selectedAthleteName,
      athleteId: selectedAthleteName,
      trainingId,
      trainingCode,
      code: trainingCode,
      trainingTitle,
      block: resolvedTraining.blockCode || recommendation.blockCode || 'MAIN',
      blockCode: resolvedTraining.blockCode || recommendation.blockCode || 'MAIN',
      parameter: parameterCode,
      parameterCode,
      phase: phaseCode,
      phaseCode,
      targetType: targetTypeValue,
      sessionType: 'TRAINING',
      prescribedByRole: 'ADMIN_DESKTOP',
      sourceType: 'ADMIN_REACT',
      createdBy: 'ADMIN_DESKTOP',
      decision,
      origin,
      notes:
        decision === 'REJECTED'
          ? 'Rejected in PLAN by coach.'
          : decision === 'REPLACED'
            ? `Replaced engine recommendation ${recommendation.trainingCode} inside PLAN.`
            : 'Approved in PLAN by coach.',
      createdAt: now,
      updatedAt: now,
      replacedTrainingCode:
        decision === 'REPLACED' ? recommendation.trainingCode : null,
      recommendationId: recommendation.recommendationId || null,
    }

    const nextSnapshot = appendPrescriptionToSnapshot(
      snapshot,
      selectedAthleteName,
      nextPrescription,
      now
    )

    onActiveSnapshotChange?.(nextSnapshot)
  }

  function approveRecommendation(recommendation) {
    persistPlanDecision({
      recommendation,
      decision: 'APPROVED',
    })
  }

  function rejectRecommendation(recommendation) {
    persistPlanDecision({
      recommendation,
      decision: 'REJECTED',
    })
  }

  function replaceRecommendation(recommendation) {
    setSelectedTrainingId(recommendation.trainingId)
    setReplaceMode(recommendation)
  }

  function archivePrescriptions(prescriptionIds) {
    if (!snapshot || !prescriptionIds.length) {
      return
    }

    const now = Date.now()
    const nextSnapshot = archivePrescriptionsInSnapshot(snapshot, prescriptionIds, now)
    onActiveSnapshotChange?.(nextSnapshot)
  }

  function archiveExtraDuplicatePrescriptions(issue) {
    const duplicateIds = issue.prescriptionIdsToArchive || []
    archivePrescriptions(duplicateIds)
  }

  function acceptAuditCheck(issue) {
    if (!snapshot || issue.severity !== 'CHECK') {
      return
    }

    const now = Date.now()
    const nextSnapshot = acceptPlanAuditCheckInSnapshot(
      snapshot,
      selectedAthleteName,
      issue,
      now
    )

    onActiveSnapshotChange?.(nextSnapshot)
  }

  function renderAuditIssueAction(issue) {
    if (issue.recommendationId) {
      const recommendation = engineRecommendations.find(
        (item) => item.recommendationId === issue.recommendationId
      )

      if (recommendation) {
        return (
          <div className="admin-actions">
            <button type="button" onClick={() => approveRecommendation(recommendation)}>
              {lang === 'en' ? 'Approve' : 'Aprovar'}
            </button>
            <button type="button" onClick={() => rejectRecommendation(recommendation)}>
              {lang === 'en' ? 'Reject' : 'Rejeitar'}
            </button>
            <button type="button" onClick={() => replaceRecommendation(recommendation)}>
              {lang === 'en' ? 'Replace' : 'Substituir'}
            </button>
          </div>
        )
      }
    }

    if (issue.prescriptionIdsToArchive?.length) {
      return (
        <button type="button" onClick={() => archiveExtraDuplicatePrescriptions(issue)}>
          {lang === 'en' ? 'Archive extras' : 'Arquivar extras'}
        </button>
      )
    }

    if (issue.severity === 'CHECK') {
      return (
        <button type="button" onClick={() => acceptAuditCheck(issue)}>
          {lang === 'en' ? 'Accept exception' : 'Aceitar excecao'}
        </button>
      )
    }

    return lang === 'en' ? issue.actionEn : issue.actionPt
  }

  function approveSelectedTraining() {
    if (replaceMode && selectedTraining) {
      persistPlanDecision({
        recommendation: replaceMode,
        decision: 'REPLACED',
        replacementTraining: selectedTraining,
      })
      setReplaceMode(null)
      return
    }

    if (!selectedTraining) {
      return
    }

    persistPlanDecision({
      recommendation: {
        recommendationId: `MANUAL_${selectedTraining.trainingId}`,
        trainingId: selectedTraining.trainingId,
        trainingCode: selectedTraining.trainingId,
        trainingTitle:
          selectedTraining.name?.[uiLang] ||
          selectedTraining.name?.['pt-BR'] ||
          selectedTraining.name?.['en-US'] ||
          selectedTraining.trainingId,
        parameterCode: selectedTraining.parameter,
        phaseCode: selectedTraining.phase,
        blockCode: 'MAIN',
      },
      decision: 'APPROVED',
      replacementTraining: selectedTraining,
    })
  }

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <small>HCI PERFORMANCE</small>
          <h1>Training Plan</h1>
        </div>
      </header>

      <section className="panel selector-panel">
        <h2>{lang === 'en' ? 'Select Athlete' : 'Selecionar atleta'}</h2>

        <div className="selector-row">
          <select
            value={selectedAthleteName || ''}
            onChange={(event) => onAthleteChange?.(event.target.value)}
          >
            {athletes.map((athlete) => (
              <option key={athlete} value={athlete}>
                {athlete}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="cards">
        <div className="card">
          <span>Canonical Trainings</span>
          <strong>{trainingStats.totalTrainings}</strong>
        </div>

        <div className="card">
          <span>Filtered</span>
          <strong>{filteredTrainings.length}</strong>
        </div>

        <div className="card">
          <span>Approved</span>
          <strong>{prescribedTrainings.length}</strong>
        </div>

        <div className="card">
          <span>{lang === 'en' ? 'Contract Plan' : 'Plano contrato'}</span>
          <strong>{trainingPlan?.status || '-'}</strong>
        </div>

        <div className="card">
          <span>{lang === 'en' ? 'Prescription Audit' : 'Auditoria'}</span>
          <strong>{prescriptionAudit.status}</strong>
        </div>
      </section>

      <section className="panel">
        <h2>{lang === 'en' ? 'Training Plan Contract' : 'Contrato do Training Plan'}</h2>

        <div style={{ padding: 16 }}>
          {planLoading ? (
            <p style={{ margin: 0 }}>
              {lang === 'en' ? 'Loading plan contract...' : 'Carregando contrato do plano...'}
            </p>
          ) : planError ? (
            <p style={{ margin: 0 }}>{planError}</p>
          ) : trainingPlan ? (
            <>
              <p style={{ marginTop: 0 }}>
                <strong>ID:</strong> {trainingPlan.planId}
              </p>
              <p>
                <strong>{lang === 'en' ? 'Generated by' : 'Gerado por'}:</strong> {trainingPlan.generatedBy}
              </p>
              <p>
                <strong>Email:</strong> {trainingPlan.athleteEmail || '-'}
              </p>
              <p>
                <strong>{lang === 'en' ? 'Phase' : 'Fase'}:</strong> {trainingPlan.periodization.phaseCode}
              </p>
              <p>
                <strong>{lang === 'en' ? 'Recommendations' : 'Recomendacoes'}:</strong> {trainingPlan.engineRecommendations.length}
              </p>
              <p>
                <strong>{lang === 'en' ? 'Coach prescriptions' : 'Prescricoes do coach'}:</strong> {trainingPlan.coachPrescriptions.length}
              </p>
              <p>
                <strong>{lang === 'en' ? 'Final prescribed trainings' : 'Treinos prescritos finais'}:</strong> {trainingPlan.prescribedTrainings.length}
              </p>
            </>
          ) : (
            <p style={{ margin: 0 }}>
              {lang === 'en' ? 'No plan contract returned yet.' : 'Nenhum contrato de plano retornado ainda.'}
            </p>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>{lang === 'en' ? 'Prescription Audit' : 'Auditoria de Prescricao'}</h2>

        <div className="cards" style={{ padding: 16, margin: 0 }}>
          <div className="card">
            <span>{lang === 'en' ? 'Pending engine items' : 'Pendencias do motor'}</span>
            <strong>{prescriptionAudit.summary.pendingRecommendations}</strong>
          </div>

          <div className="card">
            <span>{lang === 'en' ? 'Approved / replaced' : 'Aprovados / substituidos'}</span>
            <strong>{prescriptionAudit.summary.approvedOrReplaced}</strong>
          </div>

          <div className="card">
            <span>{lang === 'en' ? 'Rejected' : 'Rejeitados'}</span>
            <strong>{prescriptionAudit.summary.rejected}</strong>
          </div>

          <div className="card">
            <span>{lang === 'en' ? 'Final active items' : 'Itens finais ativos'}</span>
            <strong>{prescriptionAudit.summary.finalActiveTrainings}</strong>
          </div>

          <div className="card">
            <span>{lang === 'en' ? 'Accepted checks' : 'Checks aceitos'}</span>
            <strong>{prescriptionAudit.summary.acceptedChecks}</strong>
          </div>
        </div>

        {prescriptionAudit.issues.length === 0 ? (
          <p style={{ padding: 16, margin: 0 }}>
            {lang === 'en'
              ? 'No prescription audit issues for the current athlete and filters.'
              : 'Nenhuma pendencia de auditoria para o atleta e filtros atuais.'}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{lang === 'en' ? 'Code' : 'Codigo'}</th>
                <th>{lang === 'en' ? 'Severity' : 'Gravidade'}</th>
                <th>{lang === 'en' ? 'Item' : 'Item'}</th>
                <th>{lang === 'en' ? 'Audit finding' : 'Achado da auditoria'}</th>
                <th>{lang === 'en' ? 'Action' : 'Acao'}</th>
              </tr>
            </thead>
            <tbody>
              {prescriptionAudit.issues.map((issue) => (
                <tr key={issue.issueId}>
                  <td>{issue.code}</td>
                  <td>{issue.severity}</td>
                  <td>{issue.itemLabel}</td>
                  <td>{lang === 'en' ? issue.messageEn : issue.messagePt}</td>
                  <td>{renderAuditIssueAction(issue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>{lang === 'en' ? 'Trello Boards' : 'Quadros Trello'}</h2>

        <div style={{ padding: 16 }}>
          <p style={{ marginTop: 0 }}>
            {lang === 'en'
              ? 'Open each board or load it directly inside PLAN.'
              : 'Abra cada quadro ou carregue-o diretamente dentro do PLAN.'}
          </p>

          <div className="training-recommendations">
            {trelloBoards.map((board) => (
              <div className="training-card" key={board.id}>
                <h3>{board.title}</h3>
                <p>{board.description}</p>

                <div className="admin-actions">
                  <button type="button" onClick={() => setSelectedBoardId(board.id)}>
                    {lang === 'en' ? 'Load in Plan' : 'Carregar no Plan'}
                  </button>
                  <a href={board.url} target="_blank" rel="noreferrer">
                    <button type="button">
                      {lang === 'en' ? 'Open Trello' : 'Abrir Trello'}
                    </button>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>{lang === 'en' ? 'Live Trello View' : 'Visualizacao ao vivo do Trello'}</h2>

        <div style={{ padding: 16 }}>
          {!trelloReady ? (
            <p style={{ margin: 0 }}>
              {lang === 'en'
                ? 'Start the Trello proxy backend and set TRELLO_KEY plus TRELLO_TOKEN in .env.local.'
                : 'Inicie o proxy backend do Trello e preencha TRELLO_KEY e TRELLO_TOKEN no .env.local.'}
            </p>
          ) : boardLoading ? (
            <p style={{ margin: 0 }}>
              {lang === 'en' ? 'Loading Trello board...' : 'Carregando quadro Trello...'}
            </p>
          ) : boardError ? (
            <p style={{ margin: 0 }}>{boardError}</p>
          ) : boardSnapshot ? (
            <>
              <div className="cards" style={{ marginBottom: 16 }}>
                <div className="card">
                  <span>{lang === 'en' ? 'Board' : 'Quadro'}</span>
                  <strong>{boardSnapshot.board.name}</strong>
                </div>

                <div className="card">
                  <span>{lang === 'en' ? 'Lists' : 'Listas'}</span>
                  <strong>{boardSnapshot.totals.lists}</strong>
                </div>

                <div className="card">
                  <span>{lang === 'en' ? 'Open Cards' : 'Cards abertos'}</span>
                  <strong>{boardSnapshot.totals.cards}</strong>
                </div>

                <div className="card">
                  <span>{lang === 'en' ? 'Missing Email' : 'Sem email'}</span>
                  <strong>{boardSnapshot.totals.cardsMissingAthleteEmail || 0}</strong>
                </div>
              </div>

              <div className="training-recommendations">
                {boardSnapshot.lists.map((list) => (
                  <div className="training-card" key={list.id}>
                    <h3>{list.name}</h3>
                    <p>
                      {lang === 'en' ? 'Cards' : 'Cards'}: {list.cards.length}
                    </p>

                    {list.cards.length === 0 ? (
                      <p>
                        {lang === 'en'
                          ? 'No open cards in this list.'
                          : 'Nenhum card aberto nesta lista.'}
                      </p>
                    ) : (
                      <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
                        {list.cards.slice(0, 8).map((card) => (
                          <li key={card.id} style={{ marginBottom: 8 }}>
                            <a href={card.shortUrl} target="_blank" rel="noreferrer">
                              {card.name}
                            </a>
                            <div style={{ fontSize: 12, opacity: 0.75 }}>
                              {(card.athleteNameResolved || card.athleteEmailResolved) ? (
                                <>
                                  {card.athleteNameResolved || '-'} / {card.athleteEmailResolved || '-'}
                                </>
                              ) : (
                                lang === 'en'
                                  ? 'Missing athleteEmail integration key'
                                  : 'Falta a chave de integracao athleteEmail'
                              )}
                              {' - '}
                              {card.integration?.matchStatus || '-'}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ margin: 0 }}>
              {lang === 'en'
                ? 'Select a board to load its data.'
                : 'Selecione um quadro para carregar seus dados.'}
            </p>
          )}
        </div>
      </section>

      <section className="panel selector-panel">
        <h2>Training Filters</h2>

        <div className="selector-row">
          <select value={targetType} onChange={handleFilterChange(setTargetType)}>
            <option value="ALL">All Target Types</option>
            <option value="DUEL_20">Duel 20</option>
            <option value="DEFENSE_HUMANOID">Humanoid</option>
            <option value="PRECISION_COLOR">Color Cards</option>
          </select>

          <select value={phase} onChange={handleFilterChange(setPhase)}>
            <option value="ALL">All Phases</option>
            <option value="GENERAL_PREPARATION">General Preparation</option>
            <option value="SPECIFIC_PREPARATION">Specific Preparation</option>
            <option value="PRE_COMPETITION">Pre Competition</option>
            <option value="COMPETITION">Competition</option>
          </select>

          <select value={parameter} onChange={handleFilterChange(setParameter)}>
            <option value="ALL">All Parameters</option>
            <option value="OUTCOME">Outcome</option>
            <option value="PROCESS">Process</option>
            <option value="RHYTHM">Rhythm</option>
            <option value="DEEPENING">Deepening</option>
            <option value="CONSISTENCY">Consistency</option>
            <option value="TRANSFER">Transfer</option>
            <option value="RESILIENCE">Resilience</option>
            <option value="PRESSURE">Pressure</option>
            <option value="EMOTIONAL">Emotional</option>
            <option value="PHYSICAL">Physical</option>
            <option value="TARGET_AIMING">Target Aiming</option>
            <option value="TARGET_TRIGGERING">Target Triggering</option>
            <option value="TARGET_POSITION">Target Position</option>
            <option value="TARGET_GRIP">Target Grip</option>
            <option value="TARGET_COLOR_IDENTIFICATION">Target Color Identification</option>
          </select>

          <select value={level} onChange={handleFilterChange(setLevel)}>
            <option value="ALL">All Levels</option>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="BEGINNER_INTERMEDIATE">Beginner / Intermediate</option>
            <option value="HIGH_PERFORMANCE">High Performance</option>
            <option value="ELITE">Elite</option>
          </select>
        </div>
      </section>

      <section className="panel">
        <h2>{lang === 'en' ? 'Engine Recommendations' : 'Recomendacoes do motor'}</h2>

        <div className="training-recommendations">
          {engineRecommendations.length === 0 ? (
            <p style={{ padding: 16, margin: 0 }}>
              {lang === 'en'
                ? 'Admin backend contract is connected, but no engine recommendations were returned yet.'
                : 'O contrato do admin backend ja esta conectado, mas ainda nao retornou recomendacoes do motor.'}
            </p>
          ) : engineRecommendations.map((recommendation) => (
            <div className="training-card" key={recommendation.recommendationId}>
              <h3>Recommendation #{recommendation.priority}</h3>
              <p><strong>{recommendation.trainingTitle}</strong></p>
              <p>{recommendation.reasonText}</p>
              <p><strong>Parameter:</strong> {recommendation.parameterCode || '-'}</p>
              <p><strong>Phase:</strong> {recommendation.phaseCode || '-'}</p>
              <p><strong>Block:</strong> {recommendation.blockCode}</p>
              <p><strong>Status:</strong> {recommendation.status}</p>

              <div className="admin-actions">
                <button onClick={() => approveRecommendation(recommendation)}>
                  Approve
                </button>
                <button onClick={() => rejectRecommendation(recommendation)}>
                  Reject
                </button>
                <button onClick={() => replaceRecommendation(recommendation)}>
                  Replace / View
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>{lang === 'en' ? 'Coach Prescriptions' : 'Prescricoes do coach'}</h2>

        {coachPrescriptions.length === 0 ? (
          <p style={{ padding: 16, margin: 0 }}>
            {lang === 'en'
              ? 'No manual/admin prescription has been attached to this athlete yet.'
              : 'Ainda nao existe prescricao manual/admin anexada a este atleta.'}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{lang === 'en' ? 'Training' : 'Treino'}</th>
                <th>{lang === 'en' ? 'Decision' : 'Decisao'}</th>
                <th>{lang === 'en' ? 'Block' : 'Bloco'}</th>
                <th>{lang === 'en' ? 'Parameter' : 'Parametro'}</th>
                <th>{lang === 'en' ? 'Notes' : 'Notas'}</th>
              </tr>
            </thead>
            <tbody>
              {coachPrescriptions.map((item) => (
                <tr key={item.prescriptionId}>
                  <td>{item.trainingTitle}</td>
                  <td>{item.decision}</td>
                  <td>{item.blockCode}</td>
                  <td>{item.parameterCode || '-'}</td>
                  <td>{item.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>{lang === 'en' ? 'Final Prescription' : 'Prescricao final'}</h2>

        {prescribedTrainings.length === 0 ? (
          <p style={{ padding: 16, margin: 0 }}>
            {lang === 'en'
              ? 'The engine is connected, but no final prescribed package was produced yet.'
              : 'O motor ja esta ligado, mas ainda nao produziu um pacote final prescrito.'}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{lang === 'en' ? 'Training' : 'Treino'}</th>
                <th>{lang === 'en' ? 'Origin' : 'Origem'}</th>
                <th>{lang === 'en' ? 'Block' : 'Bloco'}</th>
                <th>{lang === 'en' ? 'Parameter' : 'Parametro'}</th>
                <th>{lang === 'en' ? 'Phase' : 'Fase'}</th>
                <th>{lang === 'en' ? 'Notes' : 'Notas'}</th>
              </tr>
            </thead>
            <tbody>
              {prescribedTrainings.map((item) => (
                <tr key={item.prescriptionId}>
                  <td>{item.orderIndex}</td>
                  <td>{item.trainingTitle}</td>
                  <td>{item.origin}</td>
                  <td>{item.blockCode}</td>
                  <td>{item.parameterCode || '-'}</td>
                  <td>{item.phaseCode || '-'}</td>
                  <td>{item.notes || item.prescriptionText || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel selector-panel">
        <h2>Replace / Manual Selection</h2>

        {replaceMode ? (
          <p style={{ margin: '0 0 12px 0', padding: '0 16px' }}>
            {lang === 'en'
              ? `Replacing engine recommendation: ${replaceMode.trainingTitle}`
              : `Substituindo recomendacao do motor: ${replaceMode.trainingTitle}`}
          </p>
        ) : null}

        <div className="selector-row">
          <select
            value={selectedTraining?.trainingId || ''}
            onChange={(event) => setSelectedTrainingId(event.target.value)}
          >
            {filteredTrainings.map((training) => (
              <option key={training.trainingId} value={training.trainingId}>
                {training.trainingId}
              </option>
            ))}
          </select>
        </div>
      </section>

      {selectedTraining && (
        <section className="panel">
          <h2>{selectedTraining.name?.[uiLang]}</h2>

          <div style={{ padding: 16 }}>
            <p><strong>Target Type:</strong> {selectedTraining.targetType}</p>
            <p><strong>Parameter:</strong> {selectedTraining.parameter}</p>
            <p><strong>Phase:</strong> {selectedTraining.phase}</p>
            <p><strong>Level:</strong> {selectedTraining.level}</p>
            <p><strong>Weapon:</strong> {selectedTraining.weaponClass}</p>
            <p><strong>Objective:</strong> {selectedTraining.objective?.[uiLang]}</p>
            <p><strong>Description:</strong> {selectedTraining.description?.[uiLang]}</p>
            <p><strong>Execution:</strong> {selectedTraining.executionSummary?.[uiLang]}</p>
            <p><strong>Load:</strong> {selectedTraining.loadNote?.[uiLang]}</p>

            <div className="admin-actions">
              <button onClick={approveSelectedTraining}>
                {replaceMode
                  ? 'Confirm Replace'
                  : 'Approve Selected Training'}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <h2>Rejected Recommendations</h2>

        {persistedRejectedRecommendations.length === 0 ? (
          <p style={{ padding: 16 }}>No rejected recommendations yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Training</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {persistedRejectedRecommendations.map((item) => (
                <tr key={item.prescriptionId}>
                  <td>{item.trainingTitle}</td>
                  <td>{item.notes || item.decision}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>Approved Plan Preview</h2>

        {prescribedTrainings.length === 0 ? (
          <p style={{ padding: 16 }}>No approved trainings yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Training</th>
                <th>Parameter</th>
                <th>Phase</th>
                <th>Block</th>
                <th>Origin</th>
              </tr>
            </thead>
            <tbody>
              {prescribedTrainings.map((training) => (
                <tr key={training.prescriptionId}>
                  <td>{training.trainingTitle}</td>
                  <td>{training.parameterCode || '-'}</td>
                  <td>{training.phaseCode || '-'}</td>
                  <td>{training.blockCode || '-'}</td>
                  <td>{training.origin || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}

function appendPrescriptionToSnapshot(snapshot, athleteName, prescription, now) {
  const nextPrescriptions = [...(snapshot?.prescriptions || []), prescription]
  const nextAthlete360 = upsertAthlete360Prescription(
    snapshot?.athlete360 || [],
    athleteName,
    prescription,
    now
  )

  return {
    ...snapshot,
    prescriptions: nextPrescriptions,
    athlete360: nextAthlete360,
  }
}

function archivePrescriptionsInSnapshot(snapshot, prescriptionIds, now) {
  const idsToArchive = new Set(prescriptionIds)

  const archiveRow = (item) => {
    if (!idsToArchive.has(item.prescriptionId)) {
      return item
    }

    return {
      ...item,
      status: 'REMOVED',
      decision: item.decision === 'REJECTED' ? item.decision : 'REMOVED',
      updatedAt: now,
      notes: item.notes || 'Archived by PLAN prescription audit.',
    }
  }

  const nextPrescriptions = (snapshot?.prescriptions || []).map(archiveRow)
  const nextAthlete360 = (snapshot?.athlete360 || []).map((athlete) => {
    const nextAthletePrescriptions = (athlete.prescriptions || []).map(archiveRow)

    return {
      ...athlete,
      prescriptions: nextAthletePrescriptions,
      prescriptionCount: nextAthletePrescriptions.filter(
        (item) => item.status !== 'REMOVED' && item.decision !== 'REJECTED'
      ).length,
      updatedAt: now,
    }
  })

  return {
    ...snapshot,
    prescriptions: nextPrescriptions,
    athlete360: nextAthlete360,
  }
}

function acceptPlanAuditCheckInSnapshot(snapshot, athleteName, issue, now) {
  const acceptedCheck = {
    acceptedCheckId: `${athleteName || 'UNDEFINED'}_${issue.code}_${now}`,
    athlete: athleteName || null,
    issueCode: issue.code,
    itemLabel: issue.itemLabel,
    severity: issue.severity,
    acceptedBy: 'ADMIN_DESKTOP',
    acceptedAt: now,
    message: issue.messageEn,
    note: 'Accepted as conscious PLAN prescription exception.',
  }

  const existingChecks = snapshot?.planAuditAcceptedChecks || []
  const nextChecks = [
    ...existingChecks.filter(
      (item) =>
        !(
          item.issueCode === acceptedCheck.issueCode &&
          item.athlete === acceptedCheck.athlete
        )
    ),
    acceptedCheck,
  ]

  return {
    ...snapshot,
    planAuditAcceptedChecks: nextChecks,
  }
}

function upsertAthlete360Prescription(athlete360, athleteName, prescription, now) {
  const nextAthlete360 = [...(athlete360 || [])]
  const existingIndex = nextAthlete360.findIndex(
    (item) => String(item.athlete || '').trim() === String(athleteName || '').trim()
  )

  if (existingIndex >= 0) {
    const currentItem = nextAthlete360[existingIndex]
    const nextPrescriptions = [...(currentItem.prescriptions || []), prescription]

    nextAthlete360[existingIndex] = {
      ...currentItem,
      prescriptions: nextPrescriptions,
      prescriptionCount: nextPrescriptions.length,
      updatedAt: now,
    }

    return nextAthlete360
  }

  nextAthlete360.push({
    athlete: athleteName,
    prova: null,
    level: null,
    hci: null,
    latestTotal: null,
    medianTotal: null,
    sessionsCount: 0,
    prescriptionCount: 1,
    parameters: [],
    sessions: [],
    prescriptions: [prescription],
    createdAt: now,
    updatedAt: now,
  })

  return nextAthlete360
}

function buildPrescriptionAudit({
  trainingPlan,
  localPrescriptions,
  selectedAthleteName,
  phase,
  parameter,
  targetType,
  acceptedChecks = [],
}) {
  const engineRecommendations = trainingPlan?.engineRecommendations || []
  const coachPrescriptions = trainingPlan?.coachPrescriptions || []
  const prescribedTrainings = trainingPlan?.prescribedTrainings || []
  const localRows = Array.isArray(localPrescriptions) ? localPrescriptions : []
  const issues = []

  const localByRecommendationId = new Map()
  const localByTrainingCode = new Map()

  localRows.forEach((item) => {
    if (item.recommendationId) {
      localByRecommendationId.set(item.recommendationId, item)
    }

    const trainingCode = item.trainingCode || item.code || item.trainingId
    if (trainingCode) {
      const rows = localByTrainingCode.get(trainingCode) || []
      rows.push(item)
      localByTrainingCode.set(trainingCode, rows)
    }
  })

  if (!selectedAthleteName) {
    issues.push(makePrescriptionAuditIssue({
      code: 'NO_ATHLETE',
      severity: 'BLOCKER',
      itemLabel: '-',
      messageEn: 'No athlete is selected for prescription review.',
      messagePt: 'Nenhum atleta selecionado para revisar a prescricao.',
      actionEn: 'Select an athlete before approving the final plan.',
      actionPt: 'Selecione um atleta antes de aprovar o plano final.',
    }))
  }

  if (!trainingPlan) {
    issues.push(makePrescriptionAuditIssue({
      code: 'NO_PLAN',
      severity: 'BLOCKER',
      itemLabel: selectedAthleteName || '-',
      messageEn: 'Training plan contract is not loaded.',
      messagePt: 'Contrato do Training Plan nao carregado.',
      actionEn: 'Load the plan contract or start the admin backend.',
      actionPt: 'Carregue o contrato do plano ou inicie o admin backend.',
    }))
  }

  if (trainingPlan && prescribedTrainings.length === 0 && localRows.length === 0) {
    issues.push(makePrescriptionAuditIssue({
      code: 'NO_FINAL_ITEMS',
      severity: 'BLOCKER',
      itemLabel: trainingPlan.planId || selectedAthleteName || '-',
      messageEn: 'There are no final prescription items for this athlete.',
      messagePt: 'Nao ha itens finais de prescricao para este atleta.',
      actionEn: 'Approve, replace, or manually add at least one training.',
      actionPt: 'Aprove, substitua ou adicione manualmente pelo menos um treino.',
    }))
  }

  engineRecommendations.forEach((recommendation) => {
    const decision = localByRecommendationId.get(recommendation.recommendationId)
    const status = decision?.decision || recommendation.status

    if (!decision && recommendation.status === 'RECOMMENDED') {
      issues.push(makePrescriptionAuditIssue({
        code: `PENDING_${recommendation.recommendationId}`,
        severity: 'REVIEW',
        itemLabel: recommendation.trainingCode,
        recommendationId: recommendation.recommendationId,
        messageEn: 'Engine recommendation has not been approved, rejected, or replaced by the coach.',
        messagePt: 'Recomendacao do motor ainda nao foi aprovada, rejeitada ou substituida pelo coach.',
        actionEn: 'Use Approve, Reject, or Replace / View.',
        actionPt: 'Use Aprovar, Rejeitar ou Substituir / Ver.',
      }))
    }

    if (status === 'REJECTED') {
      return
    }

    if (phase !== 'ALL' && recommendation.phaseCode && recommendation.phaseCode !== phase) {
      issues.push(makePrescriptionAuditIssue({
        code: `PHASE_${recommendation.recommendationId}`,
        severity: 'CHECK',
        itemLabel: recommendation.trainingCode,
        messageEn: 'Recommendation phase does not match the current Plan filter.',
        messagePt: 'A fase da recomendacao nao combina com o filtro atual da Plan.',
        actionEn: 'Confirm whether this is an intentional exception.',
        actionPt: 'Confirme se isto e uma excecao intencional.',
      }))
    }

    if (parameter !== 'ALL' && recommendation.parameterCode && recommendation.parameterCode !== parameter) {
      issues.push(makePrescriptionAuditIssue({
        code: `PARAMETER_${recommendation.recommendationId}`,
        severity: 'CHECK',
        itemLabel: recommendation.trainingCode,
        messageEn: 'Recommendation parameter does not match the current Plan filter.',
        messagePt: 'O parametro da recomendacao nao combina com o filtro atual da Plan.',
        actionEn: 'Confirm the HCI target before final prescription.',
        actionPt: 'Confirme o alvo HCI antes da prescricao final.',
      }))
    }
  })

  localRows.forEach((item) => {
    const decision = item.decision || 'ADDED'
    const trainingCode = item.trainingCode || item.code || item.trainingId || item.prescriptionId

    if (decision === 'REPLACED' && !item.replacedTrainingCode) {
      issues.push(makePrescriptionAuditIssue({
        code: `REPLACED_WITHOUT_ORIGIN_${item.prescriptionId}`,
        severity: 'CHECK',
        itemLabel: trainingCode,
        messageEn: 'Replacement row is missing the replaced engine training code.',
        messagePt: 'Linha de substituicao sem o codigo do treino do motor substituido.',
        actionEn: 'Review replacement trace before closing the plan.',
        actionPt: 'Revise o rastro da substituicao antes de fechar o plano.',
      }))
    }

    if (decision !== 'REJECTED' && targetType !== 'ALL' && item.targetType && item.targetType !== targetType) {
      issues.push(makePrescriptionAuditIssue({
        code: `TARGET_${item.prescriptionId}`,
        severity: 'CHECK',
        itemLabel: trainingCode,
        messageEn: 'Prescription target type does not match the current Plan filter.',
        messagePt: 'O tipo de alvo da prescricao nao combina com o filtro atual da Plan.',
        actionEn: 'Confirm target context or adjust the filter.',
        actionPt: 'Confirme o contexto do alvo ou ajuste o filtro.',
      }))
    }
  })

  localByTrainingCode.forEach((rows, trainingCode) => {
    const activeRows = rows.filter((item) => item.decision !== 'REJECTED' && item.status !== 'REMOVED')

    if (activeRows.length > 1) {
      const prescriptionIdsToArchive = activeRows
        .slice(1)
        .map((item) => item.prescriptionId)
        .filter(Boolean)

      issues.push(makePrescriptionAuditIssue({
        code: `DUPLICATE_${trainingCode}`,
        severity: 'REVIEW',
        itemLabel: trainingCode,
        prescriptionIdsToArchive,
        messageEn: 'The same training appears more than once as an active prescription.',
        messagePt: 'O mesmo treino aparece mais de uma vez como prescricao ativa.',
        actionEn: 'Keep only the intended prescription entry.',
        actionPt: 'Mantenha apenas a entrada de prescricao desejada.',
      }))
    }
  })

  const summary = {
    pendingRecommendations: issues.filter((item) => item.code.startsWith('PENDING_')).length,
    approvedOrReplaced: localRows.filter((item) =>
      ['APPROVED', 'REPLACED', 'ADDED'].includes(item.decision || 'ADDED')
    ).length,
    rejected: localRows.filter((item) => item.decision === 'REJECTED').length,
    finalActiveTrainings: prescribedTrainings.filter((item) => item.status !== 'REMOVED').length,
    coachPrescriptions: coachPrescriptions.length,
    acceptedChecks: acceptedChecks.filter((item) => item.athlete === selectedAthleteName).length,
  }

  const visibleIssues = sortPrescriptionAuditIssues(
    issues.filter((issue) => !isAcceptedPlanAuditCheck(issue, acceptedChecks, selectedAthleteName))
  )

  return {
    status: visibleIssues.some((item) => item.severity === 'BLOCKER')
      ? 'BLOCKED'
      : visibleIssues.some((item) => item.severity === 'REVIEW')
        ? 'REVIEW'
        : 'OK',
    summary,
    acceptedChecks: acceptedChecks.filter((item) => item.athlete === selectedAthleteName),
    issues: visibleIssues,
  }
}

function isAcceptedPlanAuditCheck(issue, acceptedChecks, athleteName) {
  if (issue.severity !== 'CHECK') {
    return false
  }

  return acceptedChecks.some(
    (item) => item.issueCode === issue.code && item.athlete === athleteName
  )
}

function sortPrescriptionAuditIssues(issues) {
  const severityOrder = {
    BLOCKER: 0,
    REVIEW: 1,
    CHECK: 2,
  }

  return [...issues].sort((a, b) => {
    const severityDiff =
      (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99)

    if (severityDiff !== 0) {
      return severityDiff
    }

    return String(a.code).localeCompare(String(b.code))
  })
}

function makePrescriptionAuditIssue({
  code,
  severity,
  itemLabel,
  recommendationId = null,
  prescriptionIdsToArchive = [],
  messageEn,
  messagePt,
  actionEn,
  actionPt,
}) {
  return {
    issueId: code,
    code,
    severity,
    itemLabel,
    recommendationId,
    prescriptionIdsToArchive,
    messageEn,
    messagePt,
    actionEn,
    actionPt,
  }
}

export default PlanoPage
