 import { useEffect, useMemo, useState } from 'react'
import NewManualSessionPanel from '../components/NewManualSessionPanel'
import ImportSiusVideoPanel from '../components/ImportSiusVideoPanel'
import { mapSnapshotToAthleteView } from '../services/athleteViewMapper'
import { runDatabaseAudit } from '../services/auditEngine'
import { getTrainingById } from '../services/trainingLibraryService'
import {
  approvePendingIssfSession,
  appendPendingIssfSessionToSnapshot,
  archiveIssfSession,
  deleteIssfSession,
  restoreArchivedIssfSession,
 } from '../services/activeSnapshotMutations'
 import { importSnapshotV341ToCanonical } from '../services/hciDataRepository'
 import TaurusAdminResults from '../components/taurus/TaurusAdminResults'
 import {loadTaurusTargetSessions, updateTaurusTargetSessionWorkflow, deleteTaurusTargetSession,
} from '../services/taurusTargetStore'
import {
  deleteHci109Session,
  loadHci109Sessions,
  updateHci109SessionWorkflow,
} from '../services/hci109SessionStore'
import { translations } from '../i18n/translations'
import taurusLogoWordmark from '../assets/taurus-logo-wordmark.png'
import { SUBSCRIPTION_TIERS, normalizeSubscriptionTier } from '../services/subscriptionAccess'
 
 function AdminPage({
  activeSnapshot,
  onSnapshotImported,
  onActiveSnapshotChange,
  lang = 'pt',
  selectedAthlete: selectedAthleteProp,
  onAthleteChange,
 }) {
 const t = translations[lang] || translations.pt

 const [selectedAthleteName, setSelectedAthleteName] = useState('')
 const [taurusSessions, setTaurusSessions] = useState([])
 const [hci109Sessions, setHci109Sessions] = useState([])
 const [hci109StatusFilter, setHci109StatusFilter] = useState('ALL')
 const athleteRows = activeSnapshot?.athlete360 || []
 const athleteOptions = useMemo(() => {
 const normalizedLeadNames = Array.from(new Set((activeSnapshot?.leads || [])
  .map((item) => normalizeAthleteName(item.athleteName)).filter(Boolean) )).sort((a, b) => a.localeCompare(b))
  if (normalizedLeadNames.length > 0) {return normalizedLeadNames} 
  return Array.from(new Set(athleteRows.map((item) => normalizeAthleteName(item.athlete))
  .filter(Boolean) )).sort((a, b) => a.localeCompare(b)) }, [activeSnapshot, athleteRows])
  const selectedAthlete = selectedAthleteName || selectedAthleteProp || athleteOptions[0] || ''
  const leads = (activeSnapshot?.leads || []).filter( (item) => item.athleteName === selectedAthlete
  )
  const pendingGroups = buildPendingApprovalGroups(activeSnapshot, selectedAthlete)
  const issfSessions = buildIssfSessions(activeSnapshot, selectedAthlete)
  const pendingTaurusResults = taurusSessions.filter((item) => item.athleteName === selectedAthlete &&
    item.workflowStatus === 'PENDING'
)
  const approvedTaurusResults = taurusSessions.filter((item) =>
    item.athleteName === selectedAthlete &&
    item.workflowStatus === 'APPROVED'
)
  const selectedHci109Sessions = hci109Sessions.filter((item) => {
    const sameAthlete = normalizeAthleteName(item.athleteName) === normalizeAthleteName(selectedAthlete)
    const sameStatus = hci109StatusFilter === 'ALL' || item.workflowStatus === hci109StatusFilter
    return sameAthlete && sameStatus
  })

  const archivedTaurusResults = taurusSessions.filter((item) =>
    item.athleteName === selectedAthlete &&
    item.workflowStatus === 'ARCHIVED'
)
  const archivedIssfSessions = buildArchivedIssfSessions(activeSnapshot, selectedAthlete)
  const prescriptions = (activeSnapshot?.prescriptions || []).filter(
    (item) => item.athlete === selectedAthlete
  )
  const hci109Training = getTrainingById('HCI_109_SIGHT_RHYTHM_CORE')
  const [importedAthleteView, setImportedAthleteView] = useState(null)
  const [importError, setImportError] = useState(null)
  const [adminDataEntryMessage, setAdminDataEntryMessage] = useState('')
  const [newLeadName, setNewLeadName] = useState('')
  const [newLeadEmail, setNewLeadEmail] = useState('')
  const [showArchivedIssfSessions, setShowArchivedIssfSessions] = useState(false)
  const [manualEntryOpen, setManualEntryOpen] = useState(false)
  const [pendingApprovalDraft, setPendingApprovalDraft] = useState(null)
  const [siusImportOpen, setSiusImportOpen] = useState(false)

  useEffect(() => { let cancelled = false

  async function loadAdminSessions() {
    const nextSessions = await loadTaurusTargetSessions()
    const nextHci109Sessions = await loadHci109Sessions()
    if (!cancelled) {
      setTaurusSessions(nextSessions)
      setHci109Sessions(nextHci109Sessions)
    }
  }

    loadAdminSessions()

    return () => {
    cancelled = true
  }
}, [])

  async function refreshHci109Sessions() {
    setHci109Sessions(await loadHci109Sessions())
  }

  async function handleApproveHci109Session(sessionId) {
    await updateHci109SessionWorkflow(sessionId, 'APPROVED', {
      approvedAt: Date.now(),
      approvedBy: 'ADMIN_PORTAL',
    })
    await refreshHci109Sessions()
  }

  async function handleRejectHci109Session(sessionId) {
    await updateHci109SessionWorkflow(sessionId, 'REJECTED', {
      rejectedAt: Date.now(),
      rejectedBy: 'ADMIN_PORTAL',
    })
    await refreshHci109Sessions()
  }

  async function handleDeleteHci109Session(sessionId) {
    await deleteHci109Session(sessionId)
    await refreshHci109Sessions()
  }


  function handleExportAthleteViewJson() {
    const athleteView = mapSnapshotToAthleteView(activeSnapshot, selectedAthlete)

    if (!athleteView) {
      alert(t.admin.messages.noAthleteExport)
      return
    }

    const jsonContent = JSON.stringify(athleteView, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const safeName = selectedAthlete
      .replaceAll(' ', '_')
      .replaceAll(',', '')
      .toLowerCase()

    const link = document.createElement('a')
    link.href = url
    link.download = `athlete_view_${safeName}_v4_1.json`
    link.click()

    URL.revokeObjectURL(url)
  }

  function handleImportAthleteViewJson(event) {
  const file = event.target.files?.[0]

  if (!file) return

  const reader = new FileReader()

  reader.onload = () => {
    try {
      const parsedJson = JSON.parse(reader.result)

      if (parsedJson?.metadata?.schemaVersion !== '4.1') {
        throw new Error(t.admin.messages.invalidAthleteView)
      }

      setImportedAthleteView(parsedJson)
      setImportError(null)
    } catch (error) {
      setImportedAthleteView(null)
      setImportError(error.message)
    }
  }

  reader.readAsText(file)
}

 function handleImportSnapshot() {
  if (!activeSnapshot) {
    setAdminDataEntryMessage(t.admin.messages.snapshotNotLoaded)
    return
  }

  const result = importSnapshotV341ToCanonical(activeSnapshot)

  setAdminDataEntryMessage(
    t.admin.messages.snapshotImported(result.sessions, result.series, result.shots)
  )

  if (result.canonicalSnapshot && onSnapshotImported) {
    onSnapshotImported(result.canonicalSnapshot)
  }
}

 function getNextEventCode() {
  const existingEvents = [
    ...(activeSnapshot?.shotSeries || []).map((row) => row.evento),
    ...(activeSnapshot?.pendingGroups || []).map((row) => row.event),
    ...(activeSnapshot?.sessionHeaders || []).map((row) => row.eventCode),
  ]

  const maxNumber = existingEvents.reduce((max, eventCode) => {
    const match = String(eventCode || '').match(/^EV_(\d+)$/)
    if (!match) return max
    return Math.max(max, Number(match[1]))
  }, 0)

  return `EV_${String(maxNumber + 1).padStart(4, '0')}`
}

function handleSaveIssfSession(sessionPayload) {
  const payload = {
    ...sessionPayload,
    athlete: selectedAthlete,
    date: sessionPayload.date || new Date().toISOString().slice(0, 10),
    event: sessionPayload.event || getNextEventCode(),
    sourceType: 'ADMIN_MANUAL_DATA_ENTRY',
    status: 'PENDING_COACH_REVIEW',
    reviewFlag: 'PENDING_REVIEW',
  }

  const nextSnapshot = appendPendingIssfSessionToSnapshot(activeSnapshot, payload)

  onActiveSnapshotChange?.(nextSnapshot)
  setSelectedAthleteName(selectedAthlete)
  onAthleteChange?.(selectedAthlete)
  setAdminDataEntryMessage(t.admin.messages.issfSentPending)
  setManualEntryOpen(false)
  setPendingApprovalDraft(null)
}

function handleCreateLead() {
  const athleteName = normalizeAthleteName(newLeadName)
  const athleteEmail = String(newLeadEmail || '').trim()

  if (!athleteName || !athleteEmail) {
    setAdminDataEntryMessage(t.admin.messages.leadRequired)
    return
  }

  const nextSnapshot = {
    ...activeSnapshot,
    leads: [
      ...(activeSnapshot?.leads || []),
      {
        leadId: athleteEmail,
        athleteName,
        athleteEmail,
        subscriptionTier: SUBSCRIPTION_TIERS.FREE,
        role: 'ATHLETE',
        source: 'ADMIN_REACT',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
  }

  onActiveSnapshotChange?.(nextSnapshot)
  setSelectedAthleteName(athleteName)
  onAthleteChange?.(athleteName)
  setNewLeadName('')
  setNewLeadEmail('')
  setAdminDataEntryMessage(t.admin.messages.leadCreated)
 }

 function handleSaveLead(leadId, athleteName, athleteEmail, subscriptionTier) {
  const normalizedTier = normalizeSubscriptionTier(subscriptionTier)

  const nextSnapshot = {
    ...activeSnapshot,
    leads: (activeSnapshot?.leads || []).map((item) => {
      if (item.leadId !== leadId) return item

      return {
        ...item,
        athleteName: normalizeAthleteName(athleteName) || item.athleteName,
        athleteEmail: String(athleteEmail || '').trim() || item.athleteEmail,
        subscriptionTier: normalizedTier,
        role: normalizedTier === SUBSCRIPTION_TIERS.ADMIN ? 'ADMIN' : 'ATHLETE',
        updatedAt: Date.now(),
      }
    }),
  }

  onActiveSnapshotChange?.(nextSnapshot)
  setAdminDataEntryMessage(t.admin.messages.leadSaved)
 }

 function handleDeleteLead(leadId) {
  const confirmed = window.confirm(t.admin.confirms.deleteLead)

  if (!confirmed) return

  const deletedLead = (activeSnapshot?.leads || []).find((item) => item.leadId === leadId)

  const nextSnapshot = {
    ...activeSnapshot,
    leads: (activeSnapshot?.leads || []).filter((item) => item.leadId !== leadId),
  }

  onActiveSnapshotChange?.(nextSnapshot)

  if (deletedLead?.athleteName === selectedAthlete) {
    const nextAthlete = (nextSnapshot.leads || [])
      .map((item) => normalizeAthleteName(item.athleteName))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))[0] || ''

    setSelectedAthleteName(nextAthlete)
    onAthleteChange?.(nextAthlete)
  }

  setAdminDataEntryMessage(t.admin.messages.leadDeleted)
 }

function handleDeleteIssfSession(sessionKey) {
  const confirmed = window.confirm(
    t.admin.confirms.deleteIssf
  )

  if (!confirmed) return

  const nextSnapshot = deleteIssfSession(activeSnapshot, sessionKey)
  onActiveSnapshotChange?.(nextSnapshot)
  setAdminDataEntryMessage(t.admin.messages.issfDeleted)
 }

 function handleArchiveIssfSession(sessionKey) {
  const sessionToArchive = issfSessions.find((item) => item.sessionKey === sessionKey)

  if (!sessionToArchive) return

  const confirmed = window.confirm(
    t.admin.confirms.archiveIssf
  )

  if (!confirmed) return

  const nextSnapshot = archiveIssfSession(activeSnapshot, sessionToArchive)

  onActiveSnapshotChange?.(nextSnapshot)
  setAdminDataEntryMessage(t.admin.messages.issfArchived)
 }

 function handleRestoreArchivedIssfSession(sessionKey) {
  const sessionToRestore = archivedIssfSessions.find((item) => item.sessionKey === sessionKey)

  if (!sessionToRestore) return

  const confirmed = window.confirm(
    t.admin.confirms.restoreIssf
  )

  if (!confirmed) return

  const restoredPayload = buildIssfPayloadFromSeriesRows(sessionToRestore.seriesRows || [], {
    sessionId: sessionToRestore.sessionKey,
    athlete: sessionToRestore.athlete,
    event: sessionToRestore.event,
    sessionType: sessionToRestore.session,
    modality: sessionToRestore.prova,
    date: sessionToRestore.seriesRows?.[0]?.dataColeta || '',
    sourceType: sessionToRestore.seriesRows?.[0]?.sourceType || 'ADMIN_REACT',
    status: 'ADMIN_APPROVED',
    reviewFlag: 'ADMIN_REVIEWED',
  })

  const nextSnapshot = restoreArchivedIssfSession(activeSnapshot, restoredPayload)

  onActiveSnapshotChange?.(nextSnapshot)
  setAdminDataEntryMessage(t.admin.messages.issfRestored)
 }

 function handleModifyPendingApproval(pendingKey) {
  const pendingItem = pendingGroups.find((item) => item.key === pendingKey)

  if (!pendingItem) return

  const seriesRows = pendingItem.seriesRows || []
  const scores = []
  const directions = []

  seriesRows.forEach((row) => {
    const rowScores = String(row.tiros || row.shots || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    rowScores.forEach((score) => scores.push(score))

    const rowDirections = Array.isArray(row.directions) ? row.directions : []
    rowDirections.forEach((direction) => directions.push(direction))
  })

  setPendingApprovalDraft({
    draftKey: pendingItem.key,
    sessionId: pendingItem.sessionId || pendingItem.key,
    athlete: pendingItem.athlete || '',
    date: pendingItem.date || '',
    event: pendingItem.event || '',
    sessionType: pendingItem.session || 'TREINO',
    modality: pendingItem.prova || '',
    scores,
    directions,
    seriesRows,
  })

  setManualEntryOpen(true)
  setAdminDataEntryMessage(t.admin.messages.pendingOpened)
}

 function handleApprovePendingApproval(pendingKey) {
  const pendingItem = pendingGroups.find((item) => item.key === pendingKey)

  if (!pendingItem) return

  const confirmed = window.confirm(
    t.admin.confirms.approvePendingIssf
  )

  if (!confirmed) return

  const sessionId = pendingItem.sessionId || pendingItem.key

  const approvalPayload = buildIssfPayloadFromSeriesRows(pendingItem.seriesRows || [], {
    sessionId,
    athlete: pendingItem.athlete,
    event: pendingItem.event,
    sessionType: pendingItem.session,
    modality: pendingItem.prova,
    date: pendingItem.date || '',
    sourceType: pendingItem.source || 'ADMIN_MANUAL_DATA_ENTRY',
    status: 'ADMIN_APPROVED',
    reviewFlag: 'ADMIN_REVIEWED',
  })

  const nextSnapshot = approvePendingIssfSession(activeSnapshot, approvalPayload)

  onActiveSnapshotChange?.(nextSnapshot)
  setAdminDataEntryMessage(t.admin.messages.pendingApproved)
}

 function handleDeletePendingApproval(pendingKey) {
  const pendingItem = pendingGroups.find((item) => item.key === pendingKey)

  if (!pendingItem) return

  const confirmed = window.confirm(
    t.admin.confirms.deletePendingIssf
  )

  if (!confirmed) return

  const withoutPendingGroup = {
    ...activeSnapshot,
    pendingGroups: (activeSnapshot?.pendingGroups || []).filter(
      (item) => item.key !== pendingKey
    ),
  }

  const nextSnapshot = dismissPendingApproval(withoutPendingGroup, pendingKey)

  onActiveSnapshotChange?.(nextSnapshot)
  setAdminDataEntryMessage(t.admin.messages.pendingDeleted)
}

function handleCopyLastSession() {
  const rows = (activeSnapshot?.shotSeries || []).filter(
    (row) => row.atleta === selectedAthlete
  )

  if (!rows.length) {
    setAdminDataEntryMessage(t.admin.messages.noApprovedIssf)
    return
  }

  const grouped = new Map()

  rows.forEach((row) => {
    const sessionKey =
      row.idBloco ||
      row.sessionId ||
      [row.atleta || '-', row.evento || '-', row.sessao || '-', row.prova || '-'].join('|')

    if (!grouped.has(sessionKey)) {
      grouped.set(sessionKey, [])
    }

    grouped.get(sessionKey).push(row)
  })

  const sessions = Array.from(grouped.entries()).map(([sessionKey, seriesRows]) => {
    const orderedRows = [...seriesRows].sort((a, b) => {
      const aOrder = Number(a.hciSerieOrder || String(a.serie || '').replace(/\D/g, '')) || 0
      const bOrder = Number(b.hciSerieOrder || String(b.serie || '').replace(/\D/g, '')) || 0
      return aOrder - bOrder
    })

    const firstRow = orderedRows[0] || {}

    return {
      sessionKey,
      seriesRows: orderedRows,
      dateValue:
        Number(firstRow.createdAt) ||
        Date.parse(firstRow.createdAt || '') ||
        Date.parse(firstRow.dataColeta || '') ||
        Number(firstRow.submittedAt) ||
        0,
      modality: firstRow.prova || 'PISTOL',
      sessionType: firstRow.sessao || 'TREINO',
    }
  })

  const lastSession = sessions.sort((a, b) => b.dateValue - a.dateValue)[0]

  const scores = []
  const directions = []

  lastSession.seriesRows.forEach((row) => {
    const shotText = row.tiros || row.shots || row.shotValuesCsv || ''

    String(shotText)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((score) => scores.push(score))

    const rowDirections = Array.isArray(row.directions) ? row.directions : []
    rowDirections.forEach((direction) => directions.push(direction))
  })

  if (!scores.length) {
    setAdminDataEntryMessage(t.admin.messages.noShotsToCopy)
    return
  }

  setPendingApprovalDraft({
    draftKey: `COPY_LAST_${Date.now()}`,
    sessionId: `COPY_LAST_${Date.now()}`,
    athlete: selectedAthlete,
    date: new Date().toISOString().slice(0, 10),
    event: getNextEventCode(),
    sessionType: lastSession.sessionType,
    modality: lastSession.modality,
    scores,
    directions,
    seriesRows: lastSession.seriesRows,
  })

  setManualEntryOpen(true)
  setAdminDataEntryMessage(t.admin.messages.copiedLastSession)
}

async function reloadTaurusSessions() {
  const nextSessions = await loadTaurusTargetSessions()
  setTaurusSessions(nextSessions)
}

async function handleApprovePendingTaurus(sessionId) {
  const confirmed = window.confirm(t.admin.confirms.approveTaurus)
  if (!confirmed) return

  await updateTaurusTargetSessionWorkflow(sessionId, 'APPROVED', {
    approvedAt: new Date().toISOString(),
    approvedBy: 'ADMIN',
  })

  await reloadTaurusSessions()
  setAdminDataEntryMessage(t.admin.messages.taurusApproved)
}

async function handleDeletePendingTaurus(sessionId) {
  const confirmed = window.confirm(t.admin.confirms.deletePendingTaurus)
  if (!confirmed) return

  await deleteTaurusTargetSession(sessionId)
  await reloadTaurusSessions()
  setAdminDataEntryMessage(t.admin.messages.taurusPendingDeleted)
}

function handleModifyPendingTaurus(sessionId) {
  setAdminDataEntryMessage(t.admin.messages.taurusModifyRequested(sessionId))
}

async function handleArchiveApprovedTaurus(sessionId) {
  const confirmed = window.confirm(t.admin.confirms.archiveTaurus)
  if (!confirmed) return

  await updateTaurusTargetSessionWorkflow(sessionId, 'ARCHIVED', {
    archivedAt: new Date().toISOString(),
    archivedBy: 'ADMIN',
  })

  await reloadTaurusSessions()
  setAdminDataEntryMessage(t.admin.messages.taurusArchived)
}

async function handleDeleteApprovedTaurus(sessionId) {
  const confirmed = window.confirm(t.admin.confirms.deleteApprovedTaurus)
  if (!confirmed) return

  await deleteTaurusTargetSession(sessionId)
  await reloadTaurusSessions()
  setAdminDataEntryMessage(t.admin.messages.taurusApprovedDeleted)
}

async function handleRestoreArchivedTaurus(sessionId) {
  const confirmed = window.confirm(t.admin.confirms.restoreTaurus)
  if (!confirmed) return

  await updateTaurusTargetSessionWorkflow(sessionId, 'APPROVED', {
    archivedAt: null,
    archivedBy: null,
  })

  await reloadTaurusSessions()
  setAdminDataEntryMessage(t.admin.messages.taurusRestored)
}

async function handleDeleteArchivedTaurus(sessionId) {
  const confirmed = window.confirm(t.admin.confirms.deleteArchivedTaurus)
  if (!confirmed) return

  await deleteTaurusTargetSession(sessionId)
  await reloadTaurusSessions()
  setAdminDataEntryMessage(t.admin.messages.taurusArchivedDeleted)
}

function handlePrescribeHci109(mode = 'RHYTHM') {
  if (!selectedAthlete || !hci109Training) {
    setAdminDataEntryMessage(t.admin.messages.selectAthlete)
    return
  }

  const now = Date.now()
  const trainingTitle =
    mode === 'SIGHT'
      ? 'HCI 10.9 - Visada'
      : 'HCI 10.9 - Ritmo'
  const nextPrescription = {
    prescriptionId: `HCI109_${mode}_${selectedAthlete}_${now}`,
    athlete: selectedAthlete,
    athleteName: selectedAthlete,
    athleteId: selectedAthlete,
    trainingId: hci109Training.trainingId,
    trainingCode: hci109Training.trainingId,
    code: hci109Training.trainingId,
    trainingTitle,
    block: 'MAIN',
    blockCode: 'MAIN',
    parameter: hci109Training.parameter,
    parameterCode: hci109Training.parameter,
    phase: hci109Training.phase,
    phaseCode: hci109Training.phase,
    targetType: hci109Training.targetType,
    sessionType: 'TRAINING',
    prescribedByRole: 'ADMIN_REACT',
    sourceType: 'TAURUS_ADMIN',
    createdBy: 'TAURUS_ADMIN',
    decision: 'ADDED',
    notes: `HCI 10.9 connection from Library/Admin bridge (${mode}).`,
    createdAt: now,
    updatedAt: now,
  }

  const nextSnapshot = {
    ...activeSnapshot,
    prescriptions: [...(activeSnapshot?.prescriptions || []), nextPrescription],
  }

  onActiveSnapshotChange?.(nextSnapshot)
  setAdminDataEntryMessage(t.admin.messages.prescriptionSaved)
  localStorage.setItem('HCI109_OPEN_TRAINING_ID', hci109Training.trainingId)
  localStorage.setItem('HCI109_OPEN_MODE', mode)
}







  
  return (
    <main className="dashboard dashboard-admin">
      <header className="dashboard-header dashboard-header-dark taurus-page-header">
        <div className="taurus-page-header-brand">
          <img src={taurusLogoWordmark} alt="TAURUS" />
        </div>

        <div className="taurus-page-header-title">
          <small>HCI PERFORMANCE</small>
          <h1>{t.admin.title}</h1>
        </div>
      </header>

      <section className="dashboard-metrics">
        <div className="metric-card">
          <span>{t.admin.metrics.leads}</span>
          <strong>{leads.length}</strong>
        </div>

        <div className="metric-card">
          <span>{t.admin.metrics.pendingIssf}</span>
          <strong>{pendingGroups.length}</strong>
        </div>

        <div className="metric-card">
          <span>{t.admin.metrics.prescriptions}</span>
          <strong>{prescriptions.length}</strong>
        </div>

        <div className="metric-card">
          <span>{t.admin.metrics.exportPackage}</span>
          <strong>JSON</strong>
        </div>
      </section>
	
      <section className="dashboard-panel selector-panel dashboard-panel-summary">
        <div className="dashboard-panel-header">
          <div>
            <h2>{t.admin.athleteExportTitle}</h2>
            <div className="dashboard-panel-subtitle">{t.admin.athleteExportSubtitle}</div>
          </div>
        </div>

        <AdminAthleteSelector
          selectedAthlete={selectedAthlete}
          athleteOptions={athleteOptions}
          onChange={(athleteName) => {
            setSelectedAthleteName(athleteName)
            onAthleteChange?.(athleteName)
          }}
        />
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel-header">
          <div>
            <h2>{t.admin.leadManagement}</h2>
          </div>
        </div>

        <div className="dashboard-admin-form-row">
          <input
            value={newLeadName}
            onChange={(event) => setNewLeadName(event.target.value)}
            placeholder={t.admin.athleteNamePlaceholder}
          />
          <input
            value={newLeadEmail}
            onChange={(event) => setNewLeadEmail(event.target.value)}
            placeholder="Email"
          />
        </div>

        <table>
          <thead>
            <tr>
              <th>{t.common.athlete}</th>
              <th>{t.common.email}</th>
              <th>Plano</th>
              <th>{t.common.action}</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, index) => (
              <tr key={lead.leadId}>
                <td>
                  <input
                    id={`ln_${index}`}
                    defaultValue={lead.athleteName}
                  />
                </td>
                <td>
                  <input
                    id={`le_${index}`}
                    defaultValue={lead.athleteEmail}
                  />
                </td>
                <td>
                  <select
                    id={`lt_${index}`}
                    defaultValue={normalizeSubscriptionTier(lead.subscriptionTier)}
                    aria-label={`Plano de ${lead.athleteName}`}
                  >
                    <option value={SUBSCRIPTION_TIERS.FREE}>FREE</option>
                    <option value={SUBSCRIPTION_TIERS.PREMIUM}>PREMIUM</option>
                    <option value={SUBSCRIPTION_TIERS.ADMIN}>ADMIN</option>
                  </select>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="admin-action-button"
                      onClick={() =>
                        handleSaveLead(
                          lead.leadId,
                          document.getElementById(`ln_${index}`)?.value,
                          document.getElementById(`le_${index}`)?.value,
                          document.getElementById(`lt_${index}`)?.value
                        )
                      }
                    >
                      {t.common.save}
                    </button>
                    <button
                      type="button"
                      className="admin-action-button"
                      onClick={() => handleDeleteLead(lead.leadId)}
                    >
                      {t.common.delete}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="dashboard-panel dashboard-panel-summary">
        <div className="dashboard-panel-header">
          <div>
            <h2>{t.admin.importExportHub}</h2>
          </div>
        </div>
        <div className="admin-actions">
         <label className="admin-upload-button">
          {t.admin.importAthleteView}
        <input
         type="file"
         accept=".json,application/json"
         onChange={handleImportAthleteViewJson}
         hidden
       />
          </label>
           <button onClick={handleExportAthleteViewJson}>{t.admin.exportAthleteView}</button>
           <button>{t.admin.exportReportPackage}</button>
        </div>
      </section>

{importError && (
  <section className="dashboard-panel dashboard-panel-summary">
    <div className="dashboard-panel-header">
      <div>
        <h2>{t.admin.importError}</h2>
      </div>
    </div>
    <p className="error">{importError}</p>
  </section>
)}

{importedAthleteView && (
  <section className="dashboard-panel dashboard-panel-summary">
    <div className="dashboard-panel-header">
      <div>
        <h2>{t.admin.importedPreview}</h2>
      </div>
    </div>

    <table>
      <tbody>
        <tr>
          <th>{t.common.athlete}</th>
          <td>{importedAthleteView.athlete?.name}</td>
        </tr>
        <tr>
          <th>{t.common.discipline}</th>
          <td>{importedAthleteView.athlete?.discipline}</td>
        </tr>
        <tr>
          <th>HCI</th>
          <td>{importedAthleteView.summary?.hci}</td>
        </tr>
        <tr>
          <th>{t.admin.levelCode}</th>
          <td>{importedAthleteView.summary?.levelCode}</td>
        </tr>
        <tr>
          <th>{t.admin.schema}</th>
          <td>{importedAthleteView.metadata?.schemaVersion}</td>
        </tr>
        <tr>
          <th>{t.admin.generatedAt}</th>
          <td>{formatDate(importedAthleteView.metadata?.generatedAt)}</td>
        </tr>
      </tbody>
    </table>

    <pre className="json-preview">
      {JSON.stringify(importedAthleteView, null, 2)}
    </pre>
  </section>
)}





<section className="dashboard-panel dashboard-panel-summary">
  <div className="dashboard-panel-header">
    <div>
      <h2>{t.admin.dataEntry}</h2>
    </div>
  </div>

  <div className="admin-action-grid">
    <button
      className="admin-action-button"
      type="button"
      onClick={() => {
        setPendingApprovalDraft({
          draftKey: `MANUAL_${Date.now()}`,
          athlete: selectedAthlete,
          date: new Date().toISOString().slice(0, 10),
          event: getNextEventCode(),
          sessionType: 'TREINO',
          modality: 'PISTOL',
        })
        setManualEntryOpen(true)
      }}
    >
      {t.admin.newManualSession}
    </button>

    <button
      className="admin-action-button"
      type="button"
      onClick={handleCopyLastSession}
    >
      {t.admin.copyLastSession}
    </button>

    <button className="admin-action-button" type="button" onClick={() => setSiusImportOpen(true)}>
      {t.admin.importSiusVideo}
    </button>

    <button className="admin-action-button" type="button" onClick={handleImportSnapshot}>
      {t.admin.importSnapshot}
    </button>
  </div>

  {adminDataEntryMessage && (
    <div style={{ padding: '0 18px 18px', fontWeight: 700 }}>
      {adminDataEntryMessage}
    </div>
  )}
</section>

{manualEntryOpen && (
  <NewManualSessionPanel
    lang={lang}
    key={pendingApprovalDraft?.draftKey || 'new-manual-session'}
    initialDraft={pendingApprovalDraft}
    selectedAthlete={selectedAthlete}
    athleteOptions={athleteOptions}
    onSaveSession={handleSaveIssfSession}
    onClose={() => {
      setManualEntryOpen(false)
      setPendingApprovalDraft(null)
    }}
  />
)}

{siusImportOpen && (
  <ImportSiusVideoPanel
    lang={lang}
    onSaveSession={handleSaveIssfSession}
    onClose={() => setSiusImportOpen(false)}
  />
)}

<TaurusAdminResults
  lang={lang}
  pendingItems={pendingTaurusResults}
  approvedItems={approvedTaurusResults}
  archivedItems={archivedTaurusResults}
  onModifyPending={handleModifyPendingTaurus}
  onApprovePending={handleApprovePendingTaurus}
  onDeletePending={handleDeletePendingTaurus}
  onArchiveApproved={handleArchiveApprovedTaurus}
  onDeleteApproved={handleDeleteApprovedTaurus}
  onRestoreArchived={handleRestoreArchivedTaurus}
  onDeleteArchived={handleDeleteArchivedTaurus}
/>

      <section className="dashboard-panel dashboard-panel-summary">
        <div className="dashboard-panel-header">
          <div>
            <h2>{t.admin.pendingIssfApprovals}</h2>
            <div className="dashboard-panel-subtitle">{t.admin.pendingIssfSubtitle}</div>
          </div>
        </div>

        <table className="dashboard-admin-table">
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
              <th>{t.common.action}</th>
            </tr>
          </thead>

          <tbody>
            {pendingGroups.map((item) => (
              <tr key={item.key}>
                <td>{item.athlete}</td>
                <td>{item.event}</td>
                <td>{item.session}</td>
                <td>{item.prova}</td>
                <td>{item.seriesCount}</td>
                <td>{item.shotCount}</td>
                <td>{item.total}</td>
                <td>{item.complete ? 'READY' : 'INCOMPLETE'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="admin-action-button"
                      onClick={() => handleModifyPendingApproval(item.key)}
                    >
                      {t.common.modify}
                    </button>
                    <button
                      type="button"
                      className="admin-action-button"
                      onClick={() => handleApprovePendingApproval(item.key)}
                    >
                      {t.common.approve}
                    </button>
                    <button
                      type="button"
                      className="admin-action-button"
                      onClick={() => handleDeletePendingApproval(item.key)}
                    >
                      {t.common.delete}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {hci109Training && (
        <section className="dashboard-panel dashboard-panel-summary">
          <div className="dashboard-panel-header">
            <div>
            <h2>{t.admin.hci109Reference}</h2>
            </div>
          </div>

          <div className="dashboard-admin-info-block">
            <p><strong>{t.admin.trainingId}:</strong> {hci109Training.trainingId}</p>
            <p><strong>{t.admin.targetType}:</strong> {hci109Training.targetType}</p>
            <p><strong>{t.admin.parameter}:</strong> {hci109Training.parameter}</p>
            <p><strong>{t.admin.phase}:</strong> {hci109Training.phase}</p>
            <p><strong>{t.admin.level}:</strong> {hci109Training.level}</p>
            <p><strong>{t.admin.weapon}:</strong> {hci109Training.weaponClass}</p>
            <p><strong>{t.admin.objective}:</strong> {hci109Training.objective?.[lang === 'en' ? 'en-US' : 'pt-BR'] || hci109Training.objective?.['pt-BR']}</p>
            <p><strong>{t.admin.description}:</strong> {hci109Training.description?.[lang === 'en' ? 'en-US' : 'pt-BR'] || hci109Training.description?.['pt-BR']}</p>
            <p><strong>{t.admin.execution}:</strong> {hci109Training.executionSummary?.[lang === 'en' ? 'en-US' : 'pt-BR'] || hci109Training.executionSummary?.['pt-BR']}</p>
            <div className="admin-actions" style={{ paddingTop: 12 }}>
              <button type="button" onClick={() => handlePrescribeHci109('RHYTHM')}>
                {t.admin.prescribeRhythm}
              </button>
              <button type="button" onClick={() => handlePrescribeHci109('SIGHT')}>
                {t.admin.prescribeSight}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="dashboard-panel">
        <div className="dashboard-panel-header">
          <div>
            <h2>Administracao HCI_109</h2>
            <div className="dashboard-panel-subtitle">
              Aprovar, rejeitar ou deletar sessoes gravadas pelo atleta.
            </div>
          </div>
        </div>

        <AdminAthleteSelector
          selectedAthlete={selectedAthlete}
          athleteOptions={athleteOptions}
          label="Atleta para administrar HCI_109"
          onChange={(athleteName) => {
            setSelectedAthleteName(athleteName)
            onAthleteChange?.(athleteName)
          }}
        />

        <div className="selector-row" style={{ marginTop: 12 }}>
          <label>
            <span>Status HCI_109</span>
            <select
              value={hci109StatusFilter}
              onChange={(event) => setHci109StatusFilter(event.target.value)}
            >
              <option value="ALL">Todos</option>
              <option value="PENDING_REVIEW">Pendentes</option>
              <option value="APPROVED">Aprovados</option>
              <option value="REJECTED">Rejeitados</option>
            </select>
          </label>
        </div>

        {selectedHci109Sessions.length === 0 ? (
          <p className="taurus-admin-empty-state">Nenhuma sessao HCI_109 gravada para este atleta.</p>
        ) : (
          <table className="dashboard-admin-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Modo</th>
                <th>Total</th>
                <th>Status</th>
                <th>Visual</th>
                <th>Olho no objeto</th>
                <th>Fonte</th>
                <th>Disparos</th>
                <th>Acao</th>
              </tr>
            </thead>
            <tbody>
              {selectedHci109Sessions.map((session) => (
                <tr key={session.sessionId}>
                  <td>{formatAdminDateTime(session.recordedAt)}</td>
                  <td>{session.sessionType}</td>
                  <td>{session.seriesTotal ?? '-'}</td>
                  <td>{session.workflowStatus || '-'}</td>
                  <td>{session.visualFocusMetrics?.visualDisciplineScore ?? '-'}</td>
                  <td>{formatAdminSeconds(session.visualFocusMetrics?.followingMovingObjectMs)}</td>
                  <td>{formatAdminVisualSource(session.visualTrackingSource || session.visualFocusMetrics?.visualTrackingSource)}</td>
                  <td>
                    {formatHci109ShotSummary(session.shots)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="admin-action-button"
                        onClick={() => handleApproveHci109Session(session.sessionId)}
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        className="admin-action-button"
                        onClick={() => handleRejectHci109Session(session.sessionId)}
                      >
                        Rejeitar
                      </button>
                      <button
                        type="button"
                        className="admin-action-button"
                        onClick={() => handleDeleteHci109Session(session.sessionId)}
                      >
                        Deletar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel-header">
          <div>
            <h2>{t.admin.issfSessions}</h2>
          </div>
        </div>

        {issfSessions.length === 0 ? (
          <p className="taurus-admin-empty-state">{t.admin.noIssfSessions}</p>
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
                <th>{t.common.action}</th>
              </tr>
            </thead>

            <tbody>
              {issfSessions.map((item) => (
                <tr key={item.sessionKey}>
                  <td>{item.athlete}</td>
                  <td>{item.event}</td>
                  <td>{item.session}</td>
                  <td>{item.prova}</td>
                  <td>{item.seriesCount}</td>
                  <td>{item.shotCount}</td>
                  <td>{item.total}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-action-button"
                      onClick={() => handleArchiveIssfSession(item.sessionKey)}
                      style={{ marginRight: 8 }}
                    >
                      {t.common.archive}
                    </button>
                    <button
                      type="button"
                      className="admin-action-button"
                      onClick={() => handleDeleteIssfSession(item.sessionKey)}
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

      <section className="dashboard-panel dashboard-panel-summary">
        <div className="dashboard-panel-header dashboard-panel-toggle">
          <strong style={{ color: '#123f9f', fontSize: 15 }}>
            {t.admin.archivedIssfSessions}
          </strong>

          <button
            type="button"
            className="admin-action-button"
            onClick={() => setShowArchivedIssfSessions((current) => !current)}
          >
            {showArchivedIssfSessions ? t.common.hide : t.common.show}
          </button>
        </div>

        {showArchivedIssfSessions && (
          archivedIssfSessions.length === 0 ? (
            <p className="taurus-admin-empty-state">{t.admin.noArchivedIssfSessions}</p>
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
                  <th>{t.admin.archivedAt}</th>
                  <th>{t.common.action}</th>
                </tr>
              </thead>

              <tbody>
                {archivedIssfSessions.map((item) => (
                  <tr key={item.sessionKey}>
                    <td>{item.athlete}</td>
                    <td>{item.event}</td>
                    <td>{item.session}</td>
                    <td>{item.prova}</td>
                    <td>{item.seriesCount}</td>
                    <td>{item.shotCount}</td>
                    <td>{item.total}</td>
                    <td>{formatDate(item.archivedAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-action-button"
                        onClick={() => handleRestoreArchivedIssfSession(item.sessionKey)}
                      >
                        {t.common.restore}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </section>
    </main>
  )
}

function buildIssfSessions(snapshot, athleteName) {
  const approvedHeaders = (snapshot?.sessionHeaders || []).filter(
    (item) => item.athleteName === athleteName && item.sessionStatus === 'APPROVED'
  )

  if (approvedHeaders.length > 0) {
    return approvedHeaders.map((header) => {
      const seriesRows = buildCompatibilityShotSeriesFromCanonical(snapshot, header.sessionId)

      return {
        sessionKey: header.sessionId,
        athlete: header.athleteName || '-',
        event: header.eventCode || '-',
        session: denormalizeSessionType(header.sessionType),
        prova: header.modality || '-',
        seriesRows,
        seriesCount: header.seriesCount || seriesRows.length,
        shotCount: header.shotCount || countShotsFromSeriesRows(seriesRows),
        total: Number((header.totalScore || sumSeriesRowsTotal(seriesRows)).toFixed(1)),
      }
    })
  }

  return buildLegacyIssfSessions(snapshot, athleteName)
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

  return effectivePendingItems.map((item) => {
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
  }).filter((item) => !dismissedKeys.has(item.key))
}

function buildArchivedIssfSessions(snapshot, athleteName) {
  const archivedHeaders = (snapshot?.sessionHeaders || []).filter(
    (item) => item.athleteName === athleteName && item.sessionStatus === 'ARCHIVED'
  )

  if (archivedHeaders.length > 0) {
    return archivedHeaders.map((header) => {
      const legacyMatch = (snapshot?.archivedIssfSessions || []).find(
        (item) => item.sessionKey === header.sessionId
      )
      const seriesRows =
        legacyMatch?.seriesRows || buildCompatibilityShotSeriesFromCanonical(snapshot, header.sessionId)

      return {
        sessionKey: header.sessionId,
        athlete: header.athleteName || '-',
        event: header.eventCode || '-',
        session: denormalizeSessionType(header.sessionType),
        prova: header.modality || '-',
        seriesRows,
        seriesCount: header.seriesCount || seriesRows.length,
        shotCount: header.shotCount || countShotsFromSeriesRows(seriesRows),
        total: Number((header.totalScore || sumSeriesRowsTotal(seriesRows)).toFixed(1)),
        archivedAt: header.archivedAt || legacyMatch?.archivedAt || null,
      }
    })
  }

  return (snapshot?.archivedIssfSessions || []).filter((item) => item.athlete === athleteName)
}

function buildLegacyIssfSessions(snapshot, athleteName) {
  const rows = (snapshot?.shotSeries || []).filter((item) => item.atleta === athleteName)
  const grouped = new Map()

  rows.forEach((row) => {
    const sessionKey =
      row.idBloco ||
      [row.atleta || '-', row.evento || '-', row.sessao || '-', row.prova || '-'].join('|')

    if (!grouped.has(sessionKey)) {
      grouped.set(sessionKey, {
        sessionKey,
        athlete: row.atleta || '-',
        event: row.evento || '-',
        session: row.sessao || '-',
        prova: row.prova || '-',
        seriesRows: [],
      })
    }

    grouped.get(sessionKey).seriesRows.push(row)
  })

  return Array.from(grouped.values()).map((group) => ({
    ...group,
    seriesCount: group.seriesRows.length,
    shotCount: countShotsFromSeriesRows(group.seriesRows),
    total: Number(sumSeriesRowsTotal(group.seriesRows).toFixed(1)),
  }))
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

function buildAuditPendingApprovalGroups(snapshot, athleteName) {
  const audit = runDatabaseAudit(snapshot)

  return audit.incompleteSessions
    .filter((session) => session.athlete === athleteName)
    .map((session) => {
      const normalizedSeries = (session.series || []).map((serie, index, allSeries) => ({
        dataColeta: session.data || '',
        prova: session.prova || '',
        atleta: session.athlete || '',
        evento: session.evento || '',
        sessao: session.sessao || '',
        idBloco: `${session.athlete || 'ATHLETE'}_${session.evento || 'EVENT'}_${session.sessao || 'SESSION'}_AUDIT`,
        statusEvento: index === allSeries.length - 1 ? 'FINAL' : 'PARCIAL',
        serie: serie.serie || `SR${index + 1}`,
        tiros: '',
        hciSerieOrder: Number(String(serie.serie || '').replace(/\D/g, '')) || index + 1,
        hciEventRowValid: 0,
        sourceType: 'AUDIT_INCOMPLETE',
      }))

      return {
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
        seriesCount: normalizedSeries.length,
        shotCount: 0,
        complete: false,
        total: Number(session.total || 0),
        date: session.data || '',
        seriesRows: normalizedSeries,
      }
    })
}

function dismissPendingApproval(snapshot, pendingKey) {
  const existingDismissedKeys = snapshot?.dismissedPendingApprovalKeys || []

  if (existingDismissedKeys.includes(pendingKey)) {
    return snapshot
  }

  return {
    ...snapshot,
    dismissedPendingApprovalKeys: [...existingDismissedKeys, pendingKey],
  }
}

function resolvePendingSeriesRows(snapshot, pendingItem) {
  const embeddedRows = normalizePendingSeriesRows(
    pendingItem.seriesRows || pendingItem.rows || [],
    pendingItem
  )

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

  if (matchingShotSeries.length > 0) {
    return matchingShotSeries
  }

  const matchingApprovedSubmissions = (snapshot?.approvedSubmissions || []).filter((row) => {
    return (
      row.athlete === pendingItem.athlete &&
      row.event === pendingItem.event &&
      row.session === pendingItem.session &&
      row.prova === pendingItem.prova
    )
  })

  if (matchingApprovedSubmissions.length > 0) {
    return matchingApprovedSubmissions.map((row, index) => ({
      dataColeta: row.submittedAt || '',
      prova: row.prova || '',
      atleta: row.athlete || '',
      evento: row.event || '',
      sessao: row.session || '',
      idBloco: `${row.athlete || 'ATHLETE'}_${row.event || 'EVENT'}_${row.session || 'SESSION'}`,
      statusEvento: index === matchingApprovedSubmissions.length - 1 ? 'FINAL' : 'PARCIAL',
      serie: row.serie || `SR${index + 1}`,
      tiros: row.shots || '',
      hciSerieOrder: Number(String(row.serie || '').replace(/\D/g, '')) || index + 1,
      hciEventRowValid: 1,
    }))
  }

  return []
}

function normalizePendingSeriesRows(rows, pendingItem) {
  return (rows || []).map((row, index, allRows) => ({
    ...row,
    dataColeta: row.dataColeta || pendingItem.date || '',
    prova: row.prova || pendingItem.prova || '',
    atleta: row.atleta || row.athlete || pendingItem.athlete || '',
    evento: row.evento || row.event || pendingItem.event || '',
    sessao: row.sessao || row.session || pendingItem.session || '',
    idBloco:
      row.idBloco ||
      row.sessionId ||
      pendingItem.sessionId ||
      pendingItem.key ||
      [
        pendingItem.athlete || 'ATHLETE',
        pendingItem.event || 'EVENT',
        pendingItem.session || 'SESSION',
        pendingItem.prova || 'MODALITY',
      ].join('|'),
    statusEvento:
      row.statusEvento || (index === allRows.length - 1 ? 'FINAL' : 'PARCIAL'),
    serie: row.serie || `SR${index + 1}`,
    tiros: row.tiros || row.shots || '',
    directions: Array.isArray(row.directions) ? row.directions : [],
    hciSerieOrder:
      row.hciSerieOrder || Number(String(row.serie || '').replace(/\D/g, '')) || index + 1,
    hciEventRowValid: row.hciEventRowValid ?? 1,
    sourceType: row.sourceType || row.source || pendingItem.source || 'ADMIN_MANUAL_DATA_ENTRY',
  }))
}

function buildIssfPayloadFromSeriesRows(seriesRows, metadata) {
  const orderedRows = [...(seriesRows || [])].sort((a, b) => {
    const aOrder = Number(a.hciSerieOrder || String(a.serie || '').replace(/\D/g, '')) || 0
    const bOrder = Number(b.hciSerieOrder || String(b.serie || '').replace(/\D/g, '')) || 0
    return aOrder - bOrder
  })

  const scores = orderedRows.flatMap((row) =>
    String(row.tiros || row.shots || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  )
  const directions = orderedRows.flatMap((row) => {
    if (Array.isArray(row.directions) && row.directions.length > 0) {
      return row.directions.map((value) => String(value || '').trim())
    }

    return Array.from({ length: 10 }, () => '')
  })

  return {
    ...metadata,
    scores,
    directions,
    createdAt: new Date().toISOString(),
  }
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(Number(value)).toLocaleString('pt-BR')
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

function normalizeAthleteName(value) {
  const normalizedValue = String(value || '').trim()

  if (!normalizedValue) return ''
  if (normalizedValue === '-') return ''
  if (normalizedValue.length < 3) return ''

  return normalizedValue
}

function formatAdminDateTime(value) {
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

function formatAdminSeconds(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return '-'
  return `${(numericValue / 1000).toFixed(2)}s`
}

function formatHci109ShotSummary(shots = []) {
  if (!shots.length) return '-'

  return shots
    .slice(0, 10)
    .map((shot) => {
      const visualScore = shot.visualFocusMetrics?.visualDisciplineScore
      const score = visualScore == null ? '-' : visualScore
      const source = formatAdminVisualSource(shot.visualTrackingSource || shot.visualFocusMetrics?.visualTrackingSource)
      return `${shot.shotIndex || shot.index}:${score}/${source}`
    })
    .join(' | ')
}

function formatAdminVisualSource(value) {
  const source = String(value || '').trim().toUpperCase()
  if (source === 'POINTER_OBJECT') return 'POINTER'
  if (source === 'CAMERA_IRIS_EXPERIMENTAL') return 'IRIS EXP.'
  if (source === 'CAMERA_FACE_ONLY') return 'FACE'
  if (source === 'CAMERA_EYE_STATE_ONLY') return 'OLHO'
  if (source === 'NO_VISUAL_TRACKING') return 'SEM LEITURA'
  return source || '-'
}

function AdminAthleteSelector({
  selectedAthlete,
  athleteOptions = [],
  onChange,
  label = 'Atleta ativo',
}) {
  return (
    <div className="selector-row">
      <label>
        <span>{label}</span>
        <select
          value={selectedAthlete}
          onChange={(event) => onChange?.(event.target.value)}
        >
          {athleteOptions.map((athleteName) => (
            <option key={athleteName} value={athleteName}>
              {athleteName}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

export default AdminPage
