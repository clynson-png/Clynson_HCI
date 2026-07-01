 import { useMemo, useState } from 'react'
 import NewManualSessionPanel from '../components/NewManualSessionPanel'
 import ImportSiusVideoPanel from '../components/ImportSiusVideoPanel'
import HappyAdminEntryPanel from '../components/HappyAdminEntryPanel'
import { mapSnapshotToAthleteView } from '../services/athleteViewMapper'
import { runDatabaseAudit } from '../services/auditEngine'
import { getTrainingLibraryEntries } from '../services/trainingLibraryService'
import {
  approvePendingIssfSession,
  appendPendingIssfSessionToSnapshot,
  archiveIssfSession,
  deleteIssfSession,
 restoreArchivedIssfSession,
 } from '../services/activeSnapshotMutations'
 import { importSnapshotV341ToCanonical } from '../services/hciDataRepository'
 import {
  athleteNamesMatch,
  buildAthleteLookupKey,
  normalizeAthleteName,
  resolveExistingAthleteName,
 } from '../services/athleteIdentity'

 function AdminPage({
  activeSnapshot,
  onSnapshotImported,
  onActiveSnapshotChange,
  onGenerateReport,
  selectedAthlete: selectedAthleteProp,
  onAthleteChange,
}) {
const [selectedAthleteName, setSelectedAthleteName] = useState('')
const trainingLibraryEntries = getTrainingLibraryEntries()
const athleteRows = activeSnapshot?.athlete360 || []
const athleteOptions = useMemo(() => {
    return Array.from(
      new Set(
        [
          ...(activeSnapshot?.leads || []).map((item) => normalizeAthleteName(item.athleteName)),
          ...athleteRows.map((item) => normalizeAthleteName(item.athlete)),
          ...(activeSnapshot?.sessionHeaders || []).map((item) => normalizeAthleteName(item.athleteName)),
        ]
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b))
  }, [activeSnapshot, athleteRows])
 const selectedAthlete =
    selectedAthleteName || selectedAthleteProp || athleteOptions[0] || ''
 const leads = (activeSnapshot?.leads || []).filter(
    (item) => athleteNamesMatch(item.athleteName, selectedAthlete)
  )
  const pendingGroups = buildPendingApprovalGroups(activeSnapshot, selectedAthlete)
  const issfSessions = buildIssfSessions(activeSnapshot, selectedAthlete)
  const archivedIssfSessions = buildArchivedIssfSessions(activeSnapshot, selectedAthlete)
  const prescriptions = (activeSnapshot?.prescriptions || []).filter(
    (item) => athleteNamesMatch(item.athlete, selectedAthlete)
  )
  const currentHappyEntry = resolveHappyEntry(activeSnapshot, selectedAthlete)
  const [importedAthleteView, setImportedAthleteView] = useState(null)
  const [importError, setImportError] = useState(null)
  const [adminDataEntryMessage, setAdminDataEntryMessage] = useState('')
  const [newLeadName, setNewLeadName] = useState('')
  const [newLeadEmail, setNewLeadEmail] = useState('')
  const [showArchivedIssfSessions, setShowArchivedIssfSessions] = useState(false)
  const [manualEntryOpen, setManualEntryOpen] = useState(false)
  const [pendingApprovalDraft, setPendingApprovalDraft] = useState(null)
  const [siusImportOpen, setSiusImportOpen] = useState(false)
  const [happyEntryOpen, setHappyEntryOpen] = useState(false)
  const [happyEntryDraft, setHappyEntryDraft] = useState(null)
  const [reportFilterMode, setReportFilterMode] = useState('SELECTED_EVENT')
  const [selectedReportEvent, setSelectedReportEvent] = useState('')
  const [selectedPrescriptionTrainingId, setSelectedPrescriptionTrainingId] = useState('')
  const [prescriptionBlockCode, setPrescriptionBlockCode] = useState('MAIN')
  const [prescriptionNotes, setPrescriptionNotes] = useState('')
  const athleteEventOptions = useMemo(() => {
    return Array.from(
     	 new Set(
      	  [
       		   ...(activeSnapshot?.sessionHeaders || [])
          	  .filter((item) => athleteNamesMatch(item.athleteName, selectedAthlete))
          	  .map((item) => item.eventCode),
         	 ...(activeSnapshot?.shotSeries || [])
          	  .filter((item) => athleteNamesMatch(item.atleta, selectedAthlete))
          	  .map((item) => item.evento),
        	].filter(Boolean)
      		)
   	 ).sort((a, b) => a.localeCompare(b))
  	}, [activeSnapshot, selectedAthlete])
  const selectedPrescriptionTraining =trainingLibraryEntries.find((item) => item.trainingId === selectedPrescriptionTrainingId) ||
    null
  
  function handleExportAthleteViewJson() {
    const athleteView = mapSnapshotToAthleteView(activeSnapshot, selectedAthlete)

    if (!athleteView) {
      alert('No athlete data available to export.')
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
        throw new Error('Invalid ATHLETE_VIEW_JSON schema version.')
      }

      const resolvedAthleteName = resolveExistingAthleteName(
        activeSnapshot,
        parsedJson?.athlete?.name
      )
      const normalizedJson = {
        ...parsedJson,
        athlete: {
          ...(parsedJson?.athlete || {}),
          name: resolvedAthleteName,
        },
      }
      const nextSnapshot = mergeAthleteViewJsonIntoSnapshot(activeSnapshot, normalizedJson)
      setImportedAthleteView(normalizedJson)
      setImportError(null)
      onActiveSnapshotChange?.(nextSnapshot)
      setSelectedAthleteName(resolvedAthleteName || selectedAthlete)
      onAthleteChange?.(resolvedAthleteName || selectedAthlete)
      setAdminDataEntryMessage('ATHLETE_VIEW_JSON IMPORTED INTO ADMIN SNAPSHOT.')
    } catch (error) {
      setImportedAthleteView(null)
      setImportError(error.message)
    }
  }

  reader.readAsText(file)
}

function handleSaveHappyEntry(happyPayload) {
  const resolvedAthleteName = resolveExistingAthleteName(activeSnapshot, happyPayload.athlete)
  const nextSnapshot = mergeHappyEntryIntoSnapshot(activeSnapshot, {
    ...happyPayload,
    athlete: resolvedAthleteName,
    athleteName: resolvedAthleteName,
  })

  onActiveSnapshotChange?.(nextSnapshot)
  setSelectedAthleteName(resolvedAthleteName)
  onAthleteChange?.(resolvedAthleteName)
  setAdminDataEntryMessage('HAPPY ENTRY SAVED INTO ACTIVE SNAPSHOT.')
  setHappyEntryOpen(false)
  setHappyEntryDraft(null)
}

function handleSavePrescription() {
  if (!selectedAthlete) {
    setAdminDataEntryMessage('SELECT AN ATHLETE BEFORE SAVING A PRESCRIPTION.')
    return
  }

  if (!selectedPrescriptionTraining) {
    setAdminDataEntryMessage('SELECT A TRAINING BEFORE SAVING A PRESCRIPTION.')
    return
  }

  const now = Date.now()
  const trainingTitle =
    selectedPrescriptionTraining.name?.['en-US'] ||
    selectedPrescriptionTraining.name?.['pt-BR'] ||
    selectedPrescriptionTraining.trainingId

  const nextPrescription = {
    prescriptionId: `${selectedAthlete}_${selectedPrescriptionTraining.trainingId}_${now}`,
    athlete: selectedAthlete,
    athleteName: selectedAthlete,
    athleteId: selectedAthlete,
    trainingId: selectedPrescriptionTraining.trainingId,
    trainingCode: selectedPrescriptionTraining.trainingId,
    code: selectedPrescriptionTraining.trainingId,
    trainingTitle,
    block: prescriptionBlockCode,
    blockCode: prescriptionBlockCode,
    parameter: selectedPrescriptionTraining.parameter || null,
    parameterCode: selectedPrescriptionTraining.parameter || null,
    phase: selectedPrescriptionTraining.phase || null,
    phaseCode: selectedPrescriptionTraining.phase || null,
    targetType: selectedPrescriptionTraining.targetType || null,
    sessionType: 'TRAINING',
    prescribedByRole: 'ADMIN_DESKTOP',
    sourceType: 'ADMIN_REACT',
    createdBy: 'ADMIN_DESKTOP',
    decision: 'ADDED',
    notes: String(prescriptionNotes || '').trim() || null,
    createdAt: now,
    updatedAt: now,
  }

  const nextPrescriptions = [...(activeSnapshot?.prescriptions || []), nextPrescription]
  const nextAthlete360 = upsertAthlete360Prescription(
    activeSnapshot?.athlete360 || [],
    selectedAthlete,
    nextPrescription,
    now
  )

  onActiveSnapshotChange?.({
    ...activeSnapshot,
    prescriptions: nextPrescriptions,
    athlete360: nextAthlete360,
  })

  setSelectedPrescriptionTrainingId('')
  setPrescriptionBlockCode('MAIN')
  setPrescriptionNotes('')
  setAdminDataEntryMessage('PRESCRIPTION SAVED INTO ACTIVE SNAPSHOT.')
}

 function handleImportSnapshot() {
  if (!activeSnapshot) {
    setAdminDataEntryMessage('SNAPSHOT 3.4.1 NOT LOADED.')
    return
  }

  const result = importSnapshotV341ToCanonical(activeSnapshot)

  setAdminDataEntryMessage(
    `SNAPSHOT 3.4.1 IMPORTED: ${result.sessions} SESSIONS, ${result.series} SERIES, ${result.shots} SHOTS`
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
  setAdminDataEntryMessage('ISSF SESSION SENT TO PENDING APPROVAL.')
  setManualEntryOpen(false)
  setPendingApprovalDraft(null)
}

function handleCreateLead() {
  const athleteName = resolveExistingAthleteName(activeSnapshot, newLeadName)
  const athleteEmail = String(newLeadEmail || '').trim()

  if (!athleteName || !athleteEmail) {
    setAdminDataEntryMessage('LEAD NAME AND EMAIL ARE REQUIRED.')
    return
  }

  const nextSnapshot = {
    ...activeSnapshot,
    leads: upsertLeadByAthleteName(activeSnapshot?.leads || [], {
      leadId: athleteEmail,
      athleteName,
      athleteEmail,
      source: 'ADMIN_REACT',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  }

  onActiveSnapshotChange?.(nextSnapshot)
  setSelectedAthleteName(athleteName)
  onAthleteChange?.(athleteName)
  setNewLeadName('')
  setNewLeadEmail('')
  setAdminDataEntryMessage('LEAD CREATED IN ADMIN.')
 }

function handleSaveLead(leadId, athleteName, athleteEmail) {
  const resolvedAthleteName = resolveExistingAthleteName(activeSnapshot, athleteName)
  const nextSnapshot = {
    ...activeSnapshot,
    leads: (activeSnapshot?.leads || []).map((item) => {
      if (item.leadId !== leadId) return item

      return {
        ...item,
        athleteName: resolvedAthleteName || item.athleteName,
        athleteEmail: String(athleteEmail || '').trim() || item.athleteEmail,
        updatedAt: Date.now(),
      }
    }),
  }

  onActiveSnapshotChange?.(nextSnapshot)
  setAdminDataEntryMessage('LEAD SAVED.')
 }

 function handleDeleteLead(leadId) {
  const confirmed = window.confirm('Delete lead?')

  if (!confirmed) return

  const deletedLead = (activeSnapshot?.leads || []).find((item) => item.leadId === leadId)

  const nextSnapshot = {
    ...activeSnapshot,
    leads: (activeSnapshot?.leads || []).filter((item) => item.leadId !== leadId),
  }

  onActiveSnapshotChange?.(nextSnapshot)

  if (athleteNamesMatch(deletedLead?.athleteName, selectedAthlete)) {
    const nextAthlete = (nextSnapshot.leads || [])
      .map((item) => normalizeAthleteName(item.athleteName))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))[0] || ''

    setSelectedAthleteName(nextAthlete)
    onAthleteChange?.(nextAthlete)
  }

  setAdminDataEntryMessage('LEAD DELETED.')
 }

function handleDeleteIssfSession(sessionKey) {
  const confirmed = window.confirm(
    'Confirm delete of this ISSF session? This action removes it from the active repository.'
  )

  if (!confirmed) return

  const nextSnapshot = deleteIssfSession(activeSnapshot, sessionKey)
  onActiveSnapshotChange?.(nextSnapshot)
  setAdminDataEntryMessage('ISSF SESSION DELETED FROM ACTIVE REPOSITORY.')
 }

 function handleArchiveIssfSession(sessionKey) {
  const sessionToArchive = issfSessions.find((item) => item.sessionKey === sessionKey)

  if (!sessionToArchive) return

  const confirmed = window.confirm(
    'Archive this ISSF session? It will leave the active flow and remain stored outside the graph pipeline.'
  )

  if (!confirmed) return

  const nextSnapshot = archiveIssfSession(activeSnapshot, sessionToArchive)

  onActiveSnapshotChange?.(nextSnapshot)
  setAdminDataEntryMessage('ISSF SESSION ARCHIVED OUT OF ACTIVE GRAPH FLOW.')
 }

 function handleRestoreArchivedIssfSession(sessionKey) {
  const sessionToRestore = archivedIssfSessions.find((item) => item.sessionKey === sessionKey)

  if (!sessionToRestore) return

  const confirmed = window.confirm(
    'Restore this archived ISSF session to the active graph flow?'
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
  setAdminDataEntryMessage('ISSF SESSION RESTORED TO ACTIVE GRAPH FLOW.')
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
  setAdminDataEntryMessage('PENDING ISSF APPROVAL OPENED FOR MANUAL COMPLETION.')
}

 function handleApprovePendingApproval(pendingKey) {
  const pendingItem = pendingGroups.find((item) => item.key === pendingKey)

  if (!pendingItem) return

  const confirmed = window.confirm(
    'Approve this pending ISSF session and remove it from the pending approvals list?'
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
  setAdminDataEntryMessage('PENDING ISSF SESSION APPROVED AND MOVED TO ISSF SESSIONS.')
}

 function handleDeletePendingApproval(pendingKey) {
  const pendingItem = pendingGroups.find((item) => item.key === pendingKey)

  if (!pendingItem) return

  const confirmed = window.confirm(
    'Confirm delete of this pending ISSF approval? This removes the item from the pending approvals list.'
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
  setAdminDataEntryMessage('PENDING ISSF APPROVAL DELETED FROM PENDING LIST.')
}

function handleCopyLastSession() {
  const rows = (activeSnapshot?.shotSeries || []).filter(
    (row) => athleteNamesMatch(row.atleta, selectedAthlete)
  )

  if (!rows.length) {
    setAdminDataEntryMessage('NO APPROVED ISSF SESSION FOUND FOR THIS ATHLETE.')
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
    setAdminDataEntryMessage('LAST SESSION FOUND, BUT NO SHOTS WERE AVAILABLE TO COPY.')
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
  setAdminDataEntryMessage('LAST APPROVED ISSF SESSION COPIED AS NEW PENDING DRAFT.')
}

function handleGenerateDirectionalReport() {
  onGenerateReport?.({
    athleteName: selectedAthlete,
    filterMode: reportFilterMode,
    selectedEventCode: selectedReportEvent || athleteEventOptions[0] || '',
  })
  setAdminDataEntryMessage('DIRECTIONAL REPORT SENT TO RELATORIO TAB.')
}





  
  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <small>HCI PERFORMANCE</small>
          <h1>Admin Center</h1>
        </div>
      </header>

      <section className="cards">
        <div className="card">
          <span>Leads</span>
          <strong>{leads.length}</strong>
        </div>

        <div className="card">
          <span>Pending ISSF</span>
          <strong>{pendingGroups.length}</strong>
        </div>

        <div className="card">
          <span>Prescriptions</span>
          <strong>{prescriptions.length}</strong>
        </div>

        <div className="card">
          <span>Export Package</span>
          <strong>JSON</strong>
        </div>
      </section>
	
      <section className="panel selector-panel">
        <h2>Select athlete for export</h2>

        <div className="selector-row">
          <select
            value={selectedAthlete}
            onChange={(event) => {
              setSelectedAthleteName(event.target.value)
              onAthleteChange?.(event.target.value)
            }}
          >
            {athleteOptions.map((athleteName) => (
              <option key={athleteName} value={athleteName}>
                {athleteName}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="panel">
        <h2>Lead Management</h2>

        <div style={{ display: 'flex', gap: 10, marginBottom: 15, flexWrap: 'wrap' }}>
          <input
            value={newLeadName}
            onChange={(event) => setNewLeadName(event.target.value)}
            placeholder="Athlete name"
            style={{ flex: '1 1 240px' }}
          />
          <input
            value={newLeadEmail}
            onChange={(event) => setNewLeadEmail(event.target.value)}
            placeholder="Email"
            style={{ flex: '1 1 220px' }}
          />
       </div>

        <table>
          <thead>
            <tr>
              <th>Athlete</th>
              <th>Email</th>
              <th>Action</th>
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
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="admin-action-button"
                      onClick={() =>
                        handleSaveLead(
                          lead.leadId,
                          document.getElementById(`ln_${index}`)?.value,
                          document.getElementById(`le_${index}`)?.value
                        )
                      }
                    >
                      SAVE
                    </button>
                    <button
                      type="button"
                      className="admin-action-button"
                      onClick={() => handleDeleteLead(lead.leadId)}
                    >
                      DELETE
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Prescription Write</h2>

        <div style={{ display: 'grid', gap: 12, padding: 16 }}>
          <select
            value={selectedPrescriptionTrainingId}
            onChange={(event) => setSelectedPrescriptionTrainingId(event.target.value)}
          >
            <option value="">Select canonical training</option>
            {trainingLibraryEntries.map((training) => (
              <option key={training.trainingId} value={training.trainingId}>
                {training.trainingId} | {training.name?.['pt-BR'] || training.name?.['en-US']}
              </option>
            ))}
          </select>

          <select
            value={prescriptionBlockCode}
            onChange={(event) => setPrescriptionBlockCode(event.target.value)}
          >
            <option value="WARMUP">WARMUP</option>
            <option value="TECHNICAL">TECHNICAL</option>
            <option value="MAIN">MAIN</option>
            <option value="MENTAL">MENTAL</option>
            <option value="TARGET">TARGET</option>
            <option value="COOLDOWN">COOLDOWN</option>
          </select>

          <textarea
            value={prescriptionNotes}
            onChange={(event) => setPrescriptionNotes(event.target.value)}
            placeholder="Coach note / prescription note"
            rows={4}
          />

          {selectedPrescriptionTraining ? (
            <div style={{ fontSize: 14, opacity: 0.85 }}>
              <strong>{selectedPrescriptionTraining.name?.['pt-BR'] || selectedPrescriptionTraining.name?.['en-US']}</strong>
              <br />
              Param: {selectedPrescriptionTraining.parameter || '-'} | Phase: {selectedPrescriptionTraining.phase || '-'} | Target: {selectedPrescriptionTraining.targetType || '-'}
            </div>
          ) : null}

          <div className="admin-actions">
            <button type="button" onClick={handleSavePrescription}>
              Save Prescription
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Import / Export Hub</h2>
        <div className="admin-actions">
         <label className="admin-upload-button">
         Import ATHLETE_VIEW_JSON
        <input
         type="file"
         accept=".json,application/json"
         onChange={handleImportAthleteViewJson}
         hidden
       />
          </label>
          <button onClick={handleExportAthleteViewJson}> Export ATHLETE_VIEW_JSON</button>
          <button>Export report package</button>
        </div>
      </section>

      <section className="panel">
        <h2>Directional Reports</h2>
        <div style={{ padding: 16, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <select value={reportFilterMode} onChange={(event) => setReportFilterMode(event.target.value)}>
            <option value="SELECTED_EVENT">Por evento selecionado</option>
            <option value="ALL_EVENTS">Todos os eventos</option>
            <option value="TRAINING_SIMULATION">Só treinos e simulados</option>
            <option value="COMPETITION_ONLY">Só competições</option>
          </select>

          <select
            value={selectedReportEvent || athleteEventOptions[0] || ''}
            onChange={(event) => setSelectedReportEvent(event.target.value)}
            disabled={reportFilterMode !== 'SELECTED_EVENT'}
          >
            {athleteEventOptions.length === 0 ? (
              <option value="">Sem eventos</option>
            ) : (
              athleteEventOptions.map((eventCode) => (
                <option key={eventCode} value={eventCode}>
                  {eventCode}
                </option>
              ))
            )}
          </select>

          <button
            type="button"
            className="admin-action-button"
            onClick={handleGenerateDirectionalReport}
            disabled={!selectedAthlete}
          >
            GERAR RELATÓRIO
          </button>
        </div>
      </section>

{importError && (
  <section className="panel">
    <h2>Import error</h2>
    <p className="error">{importError}</p>
  </section>
)}

{importedAthleteView && (
  <section className="panel">
    <h2>Imported ATHLETE_VIEW_JSON preview</h2>

    <table>
      <tbody>
        <tr>
          <th>Athlete</th>
          <td>{importedAthleteView.athlete?.name}</td>
        </tr>
        <tr>
          <th>Discipline</th>
          <td>{importedAthleteView.athlete?.discipline}</td>
        </tr>
        <tr>
          <th>HCI</th>
          <td>{importedAthleteView.summary?.hci}</td>
        </tr>
        <tr>
          <th>Level Code</th>
          <td>{importedAthleteView.summary?.levelCode}</td>
        </tr>
        <tr>
          <th>Schema</th>
          <td>{importedAthleteView.metadata?.schemaVersion}</td>
        </tr>
        <tr>
          <th>Generated At</th>
          <td>{formatDate(importedAthleteView.metadata?.generatedAt)}</td>
        </tr>
      </tbody>
    </table>

    <pre className="json-preview">
      {JSON.stringify(importedAthleteView, null, 2)}
    </pre>
  </section>
)}





<section className="panel">
  <h2>ADMIN DATA ENTRY</h2>

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
      NEW MANUAL SESSION
    </button>

    <button
      className="admin-action-button"
      type="button"
      onClick={handleCopyLastSession}
    >
      COPY LAST SESSION
    </button>

    <button className="admin-action-button" type="button" onClick={() => setSiusImportOpen(true)}>
      AUTO IMPORT SIUS VIDEO
    </button>

    <button
      className="admin-action-button"
      type="button"
      onClick={() => {
        setHappyEntryDraft({
          athlete: selectedAthlete,
          date: new Date().toISOString().slice(0, 10),
          event: athleteEventOptions[0] || '',
          responses: buildInitialHappyResponses(activeSnapshot, selectedAthlete),
          athleteMessage: '',
          coachNote: '',
        })
        setHappyEntryOpen(true)
      }}
    >
      NEW HAPPY ENTRY
    </button>

    <button
      className="admin-action-button"
      type="button"
      disabled={!currentHappyEntry}
      onClick={() => {
        setHappyEntryDraft({
          athlete: currentHappyEntry?.athlete || selectedAthlete,
          date: currentHappyEntry?.date || new Date().toISOString().slice(0, 10),
          event: currentHappyEntry?.event || athleteEventOptions[0] || '',
          responses: buildInitialHappyResponses(activeSnapshot, selectedAthlete),
          athleteMessage: currentHappyEntry?.athleteMessage || '',
          coachNote: currentHappyEntry?.coachNote || '',
        })
        setHappyEntryOpen(true)
      }}
    >
      EDIT HAPPY ENTRY
    </button>

    <button className="admin-action-button" type="button" onClick={handleImportSnapshot}>
      IMPORT SNAPSHOT 3.4.1
    </button>
  </div>

  {adminDataEntryMessage && (
    <div style={{ padding: '0 18px 18px', fontWeight: 700 }}>
      {adminDataEntryMessage}
    </div>
  )}
</section>

<section className="panel">
  <h2>Athlete HAPPY Communication</h2>

  <div className="admin-action-grid">
    <label className="admin-upload-button">
      IMPORT APP HAPPY JSON
      <input
        type="file"
        accept=".json,application/json"
        onChange={handleImportAthleteViewJson}
        hidden
      />
    </label>

    <button
      className="admin-action-button"
      type="button"
      onClick={() => {
        setHappyEntryDraft({
          athlete: selectedAthlete,
          date: new Date().toISOString().slice(0, 10),
          event: athleteEventOptions[0] || '',
          responses: buildInitialHappyResponses(activeSnapshot, selectedAthlete),
          athleteMessage: currentHappyEntry?.athleteMessage || '',
          coachNote: currentHappyEntry?.coachNote || '',
        })
        setHappyEntryOpen(true)
      }}
    >
      OPEN ATHLETE CARD
    </button>
  </div>

  {!currentHappyEntry ? (
    <p style={{ padding: 16, margin: 0 }}>
      NO HAPPY ENTRY SAVED FOR THIS ATHLETE YET.
    </p>
  ) : (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div className="cards">
        <div className="card">
          <span>Date</span>
          <strong>{currentHappyEntry.date || '-'}</strong>
        </div>
        <div className="card">
          <span>Event</span>
          <strong>{currentHappyEntry.event || '-'}</strong>
        </div>
        <div className="card">
          <span>Source</span>
          <strong className="small-value">{currentHappyEntry.sourceType || currentHappyEntry.importedFrom || '-'}</strong>
        </div>
        <div className="card">
          <span>Updated</span>
          <strong className="small-value">{currentHappyEntry.updatedAt ? formatDate(currentHappyEntry.updatedAt) : '-'}</strong>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Confidence</th>
            <th>Organization</th>
            <th>Management</th>
            <th>Analysis</th>
            <th>Nerve</th>
            <th>Discipline</th>
            <th>Opportunity</th>
            <th>Heed</th>
            <th>Alignment</th>
            <th>Plan</th>
            <th>Powering</th>
            <th>Yearn</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{currentHappyEntry.CONFIDENCE ?? '-'}</td>
            <td>{currentHappyEntry.ORGANIZATION ?? '-'}</td>
            <td>{currentHappyEntry.MANAGEMENT ?? '-'}</td>
            <td>{currentHappyEntry.ANALYSIS ?? '-'}</td>
            <td>{currentHappyEntry.NERVE ?? '-'}</td>
            <td>{currentHappyEntry.DISCIPLINE ?? '-'}</td>
            <td>{currentHappyEntry.OPPORTUNITY ?? '-'}</td>
            <td>{currentHappyEntry.HEED ?? '-'}</td>
            <td>{currentHappyEntry.ALIGNMENT ?? '-'}</td>
            <td>{currentHappyEntry.PLAN ?? '-'}</td>
            <td>{currentHappyEntry.POWERING ?? '-'}</td>
            <td>{currentHappyEntry.YEARN ?? '-'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )}
</section>

{manualEntryOpen && (
  <NewManualSessionPanel
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
    onSaveSession={handleSaveIssfSession}
    onClose={() => setSiusImportOpen(false)}
  />
)}

{happyEntryOpen && (
  <HappyAdminEntryPanel
    initialDraft={happyEntryDraft}
    athleteOptions={athleteOptions}
    onAutoFillAthlete={(value) => resolveExistingAthleteName(activeSnapshot, value)}
    onSaveEntry={handleSaveHappyEntry}
    onClose={() => {
      setHappyEntryOpen(false)
      setHappyEntryDraft(null)
    }}
  />
)}

  <section className="panel">
        <h2>Pending ISSF approvals</h2>
        
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
              <th>Action</th>
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
                      onClick={() => handleModifyPendingApproval(item.key)}
                    >
                      MODIFY
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprovePendingApproval(item.key)}
                    >
                      APPROVE
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePendingApproval(item.key)}
                    >
                      DELETE
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>ISSF Sessions</h2>

        {issfSessions.length === 0 ? (
          <p style={{ padding: 16 }}>NO ISSF SESSIONS FOR THIS ATHLETE.</p>
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
                <th>Action</th>
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
                      ARCHIVE
                    </button>
                    <button
                      type="button"
                      className="admin-action-button"
                      onClick={() => handleDeleteIssfSession(item.sessionKey)}
                    >
                      DELETE
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <div
          style={{
            padding: '14px 18px',
            background: '#f8fafc',
            borderBottom: '1px solid #dcdde1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <strong style={{ color: '#123f9f', fontSize: 15 }}>
            ARCHIVED ISSF SESSIONS
          </strong>

          <button
            type="button"
            className="admin-action-button"
            onClick={() => setShowArchivedIssfSessions((current) => !current)}
          >
            {showArchivedIssfSessions ? 'HIDE' : 'SHOW'}
          </button>
        </div>

        {showArchivedIssfSessions && (
          archivedIssfSessions.length === 0 ? (
            <p style={{ padding: 16 }}>NO ARCHIVED ISSF SESSIONS FOR THIS ATHLETE.</p>
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
                  <th>Archived At</th>
                  <th>Action</th>
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
                        RESTORE ARCHIVE
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
    (item) => athleteNamesMatch(item.athleteName, athleteName) && item.sessionStatus === 'APPROVED'
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
    (item) => athleteNamesMatch(item.athleteName, athleteName) && item.sessionStatus === 'ARCHIVED'
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

  return (snapshot?.archivedIssfSessions || []).filter((item) => athleteNamesMatch(item.athlete, athleteName))
}

function buildLegacyIssfSessions(snapshot, athleteName) {
  const rows = (snapshot?.shotSeries || []).filter((item) => athleteNamesMatch(item.atleta, athleteName))
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
    .filter((session) => athleteNamesMatch(session.athlete, athleteName))
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
      athleteNamesMatch(row.atleta, pendingItem.athlete) &&
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
  const parsedDate =
    typeof value === 'number' && Number.isFinite(value)
      ? new Date(value)
      : new Date(value)

  return Number.isNaN(parsedDate.getTime())
    ? String(value)
    : parsedDate.toLocaleString('pt-BR')
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

function buildInitialHappyResponses(snapshot, athleteName) {
  const existingEntry = resolveHappyEntry(snapshot, athleteName)

  return {
    CONFIDENCE: existingEntry?.CONFIDENCE ?? '',
    ORGANIZATION: existingEntry?.ORGANIZATION ?? '',
    MANAGEMENT: existingEntry?.MANAGEMENT ?? '',
    ANALYSIS: existingEntry?.ANALYSIS ?? '',
    NERVE: existingEntry?.NERVE ?? '',
    DISCIPLINE: existingEntry?.DISCIPLINE ?? '',
    OPPORTUNITY: existingEntry?.OPPORTUNITY ?? '',
    HEED: existingEntry?.HEED ?? '',
    ALIGNMENT: existingEntry?.ALIGNMENT ?? '',
    PLAN: existingEntry?.PLAN ?? '',
    POWERING: existingEntry?.POWERING ?? '',
    YEARN: existingEntry?.YEARN ?? '',
  }
}

function resolveHappyEntry(snapshot, athleteName) {
  const normalizedAthlete = buildAthleteLookupKey(athleteName)

  return (
    (snapshot?.happyStates || []).find(
      (item) => buildAthleteLookupKey(item.athlete || item.athleteName) === normalizedAthlete
    ) ||
    (snapshot?.athlete360 || []).find(
      (item) => buildAthleteLookupKey(item.athlete) === normalizedAthlete
    )?.happyState ||
    null
  )
}

function mergeAthleteViewJsonIntoSnapshot(snapshot, athleteViewJson) {
  const athleteName = normalizeAthleteName(athleteViewJson?.athlete?.name)
  const importedAt = Date.now()
  const generatedTimestamp = toDateTimestamp(athleteViewJson?.metadata?.generatedAt)

  if (!athleteName) {
    return snapshot
  }

  const selfAnalysis = athleteViewJson?.athleteSelfAnalysis || {}
  const responses = Object.fromEntries(
    (selfAnalysis.responses || []).map((item) => [item.code, item.value])
  )

  const happyEntry = {
    athlete: athleteName,
    athleteName,
    importedFrom: 'ATHLETE_VIEW_JSON',
    importedAt,
    date:
      generatedTimestamp
        ? new Date(generatedTimestamp).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    event: '',
    athleteMessage: '',
    coachNote: '',
    ...responses,
    athleteSelfAnalysis: selfAnalysis,
    crossAnalysis: athleteViewJson?.crossAnalysis || {},
    rawAthleteViewJson: athleteViewJson,
  }

  return mergeHappyEntryIntoSnapshot(snapshot, happyEntry)
}

function mergeHappyEntryIntoSnapshot(snapshot, happyEntry) {
  const athleteName = normalizeAthleteName(happyEntry?.athlete || happyEntry?.athleteName)
  const now = Date.now()

  if (!athleteName) {
    return snapshot
  }

  const normalizedEntry = {
    athlete: athleteName,
    athleteName,
    date: happyEntry.date || new Date().toISOString().slice(0, 10),
    event: happyEntry.event || '',
    athleteMessage: happyEntry.athleteMessage || '',
    coachNote: happyEntry.coachNote || '',
    CONFIDENCE: numberOrNull(happyEntry.CONFIDENCE ?? happyEntry.responses?.CONFIDENCE),
    ORGANIZATION: numberOrNull(happyEntry.ORGANIZATION ?? happyEntry.responses?.ORGANIZATION),
    MANAGEMENT: numberOrNull(happyEntry.MANAGEMENT ?? happyEntry.responses?.MANAGEMENT),
    ANALYSIS: numberOrNull(happyEntry.ANALYSIS ?? happyEntry.responses?.ANALYSIS),
    NERVE: numberOrNull(happyEntry.NERVE ?? happyEntry.responses?.NERVE),
    DISCIPLINE: numberOrNull(happyEntry.DISCIPLINE ?? happyEntry.responses?.DISCIPLINE),
    OPPORTUNITY: numberOrNull(happyEntry.OPPORTUNITY ?? happyEntry.responses?.OPPORTUNITY),
    HEED: numberOrNull(happyEntry.HEED ?? happyEntry.responses?.HEED),
    ALIGNMENT: numberOrNull(happyEntry.ALIGNMENT ?? happyEntry.responses?.ALIGNMENT),
    PLAN: numberOrNull(happyEntry.PLAN ?? happyEntry.responses?.PLAN),
    POWERING: numberOrNull(happyEntry.POWERING ?? happyEntry.responses?.POWERING),
    YEARN: numberOrNull(happyEntry.YEARN ?? happyEntry.responses?.YEARN),
    athleteSelfAnalysis: happyEntry.athleteSelfAnalysis || null,
    crossAnalysis: happyEntry.crossAnalysis || null,
    importedFrom: happyEntry.importedFrom || null,
    importedAt: happyEntry.importedAt || null,
    sourceType: happyEntry.sourceType || 'ADMIN_HAPPY_MANUAL_ENTRY',
    createdAt: happyEntry.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const nextHappyStates = upsertByAthlete(
    snapshot?.happyStates || [],
    normalizedEntry,
    athleteName
  )

  const nextAthlete360 = upsertAthlete360HappyState(
    snapshot?.athlete360 || [],
    athleteName,
    normalizedEntry,
    now
  )

  return {
    ...snapshot,
    happyStates: nextHappyStates,
    athlete360: nextAthlete360,
  }
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const numericValue = Number(String(value).replace('x', '').replace('X', ''))
  return Number.isNaN(numericValue) ? null : numericValue
}

function toDateTimestamp(value) {
  if (!value) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value

  const parsedValue = Date.parse(value)
  return Number.isNaN(parsedValue) ? null : parsedValue
}

function upsertByAthlete(items, nextItem, athleteName) {
  const nextItems = [...(items || [])]
  const existingIndex = nextItems.findIndex(
    (item) => buildAthleteLookupKey(item.athlete || item.athleteName) === buildAthleteLookupKey(athleteName)
  )

  if (existingIndex >= 0) {
    nextItems[existingIndex] = {
      ...nextItems[existingIndex],
      ...nextItem,
    }
    return nextItems
  }

  nextItems.push(nextItem)
  return nextItems
}

function upsertLeadByAthleteName(leads, nextLead) {
  const nextLeads = [...(leads || [])]
  const athleteName = normalizeAthleteName(nextLead.athleteName)
  const existingIndex = nextLeads.findIndex(
    (item) => buildAthleteLookupKey(item.athleteName) === buildAthleteLookupKey(athleteName)
  )

  if (existingIndex >= 0) {
    nextLeads[existingIndex] = {
      ...nextLeads[existingIndex],
      ...nextLead,
      athleteName,
      leadId: nextLeads[existingIndex].leadId || nextLead.leadId,
      createdAt: nextLeads[existingIndex].createdAt || nextLead.createdAt,
    }
    return nextLeads
  }

  nextLeads.push({
    ...nextLead,
    athleteName,
  })
  return nextLeads
}

function upsertAthlete360HappyState(athlete360, athleteName, happyEntry, now) {
  const nextAthlete360 = [...(athlete360 || [])]
  const existingIndex = nextAthlete360.findIndex(
    (item) => buildAthleteLookupKey(item.athlete) === buildAthleteLookupKey(athleteName)
  )

  if (existingIndex >= 0) {
    nextAthlete360[existingIndex] = {
      ...nextAthlete360[existingIndex],
      happyState: happyEntry,
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
    prescriptionCount: 0,
    parameters: [],
    sessions: [],
    prescriptions: [],
    happyState: happyEntry,
    createdAt: now,
    updatedAt: now,
  })

  return nextAthlete360
}

function upsertAthlete360Prescription(athlete360, athleteName, prescription, now) {
  const nextAthlete360 = [...(athlete360 || [])]
  const existingIndex = nextAthlete360.findIndex(
    (item) => buildAthleteLookupKey(item.athlete) === buildAthleteLookupKey(athleteName)
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

export default AdminPage
