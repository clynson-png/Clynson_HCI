import { useEffect, useState } from 'react'
import HappySelfAnalysisCard from './HappySelfAnalysisCard'

const INITIAL_RESPONSES = {
  CONFIDENCE: '',
  ORGANIZATION: '',
  MANAGEMENT: '',
  ANALYSIS: '',
  NERVE: '',
  DISCIPLINE: '',
  OPPORTUNITY: '',
  HEED: '',
  ALIGNMENT: '',
  PLAN: '',
  POWERING: '',
  YEARN: '',
}

function HappyAdminEntryPanel({
  initialDraft,
  athleteOptions = [],
  onAutoFillAthlete,
  onSaveEntry,
  onClose,
}) {
  const [athlete, setAthlete] = useState('')
  const [date, setDate] = useState('')
  const [event, setEvent] = useState('')
  const [athleteMessage, setAthleteMessage] = useState('')
  const [coachNote, setCoachNote] = useState('')
  const [responses, setResponses] = useState(INITIAL_RESPONSES)
  const [validationMessage, setValidationMessage] = useState('')

  useEffect(() => {
    if (!initialDraft) {
      setAthlete('')
      setDate('')
      setEvent('')
      setAthleteMessage('')
      setCoachNote('')
      setResponses(INITIAL_RESPONSES)
      setValidationMessage('')
      return
    }

    setAthlete(initialDraft.athlete || '')
    setDate(initialDraft.date || '')
    setEvent(initialDraft.event || '')
    setAthleteMessage(initialDraft.athleteMessage || '')
    setCoachNote(initialDraft.coachNote || '')
    setResponses({
      ...INITIAL_RESPONSES,
      ...(initialDraft.responses || {}),
    })
    setValidationMessage('')
  }, [initialDraft])

  function handleResponseChange(code, value) {
    setResponses((current) => ({
      ...current,
      [code]: value,
    }))
  }

  function validateEntry() {
    const invalidFields = Object.entries(responses).filter(([, value]) => {
      if (value === '') return true
      const numeric = Number(value)
      return Number.isNaN(numeric) || numeric < 1 || numeric > 5
    })

    if (!athlete.trim()) {
      setValidationMessage('ATHLETE IS REQUIRED.')
      return false
    }

    if (!date) {
      setValidationMessage('DATE IS REQUIRED.')
      return false
    }

    if (invalidFields.length > 0) {
      setValidationMessage(
        `INVALID HAPPY INPUT: ${invalidFields.length} FIELD(S) MUST BE BETWEEN 1 AND 5.`
      )
      return false
    }

    setValidationMessage('VALID HAPPY ENTRY.')
    return true
  }

  function handleSave() {
    if (!validateEntry()) {
      return
    }

    onSaveEntry?.({
      athlete: athlete.trim(),
      date,
      event: event.trim(),
      athleteMessage: athleteMessage.trim(),
      coachNote: coachNote.trim(),
      responses: Object.fromEntries(
        Object.entries(responses).map(([code, value]) => [code, Number(value)])
      ),
      sourceType: 'ADMIN_HAPPY_MANUAL_ENTRY',
      createdAt: new Date().toISOString(),
    })

    setValidationMessage('SAVED: HAPPY ENTRY SENT TO ACTIVE SNAPSHOT')
  }

  function handleAthleteBlur() {
    const resolvedAthlete = onAutoFillAthlete?.(athlete)
    if (resolvedAthlete && resolvedAthlete !== athlete) {
      setAthlete(resolvedAthlete)
    }
  }

  return (
    <section className="panel" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <h2>New HAPPY Entry</h2>
          <p style={{ marginTop: 4, opacity: 0.75 }}>
            Admin manual input for athlete self analysis and coach communication
          </p>
        </div>

        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      {validationMessage && (
        <div style={{ marginTop: 16, fontWeight: 700 }}>
          {validationMessage}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr',
          gap: 12,
          marginTop: 16,
          alignItems: 'end',
        }}
      >
        <input
          list="happy-athlete-options"
          value={athlete}
          onChange={(event) => setAthlete(event.target.value)}
          onBlur={handleAthleteBlur}
          placeholder="Athlete"
        />
        <datalist id="happy-athlete-options">
          {athleteOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <input
          value={event}
          onChange={(event) => setEvent(event.target.value)}
          placeholder="Event"
        />
      </div>

      <HappySelfAnalysisCard
        title="Athlete input card"
        responses={responses}
        athleteMessage={athleteMessage}
        coachNote={coachNote}
        editable
        onResponseChange={handleResponseChange}
        onAthleteMessageChange={setAthleteMessage}
        onCoachNoteChange={setCoachNote}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          marginTop: 16,
        }}
      >
        <button type="button" onClick={validateEntry}>
          Validate HAPPY Entry
        </button>
        <button type="button" onClick={handleSave}>
          Save
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </section>
  )
}

export default HappyAdminEntryPanel
