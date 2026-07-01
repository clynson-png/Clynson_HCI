import { useEffect, useState } from 'react'
import { translations } from '../i18n/translations'

function NewManualSessionPanel({ initialDraft, onSaveSession, onClose, lang = 'pt' }) {
  const t = translations[lang] || translations.pt
  const [validationMessage, setValidationMessage] = useState('')

  const [athlete, setAthlete] = useState('')
  const [date, setDate] = useState('')
  const [event, setEvent] = useState('')
  const [sessionType, setSessionType] = useState('TREINO')
  const [modality, setModality] = useState('PISTOL')
  const [loadedSeriesRows, setLoadedSeriesRows] = useState([])
  const [scoreValues, setScoreValues] = useState(Array.from({ length: 60 }, () => ''))
  const [directionValues, setDirectionValues] = useState(Array.from({ length: 60 }, () => ''))

  const pistolDirections = [
    'CENTER',
    'RIGHT',
    'UPPER_RIGHT',
    'UP',
    'UPPER_LEFT',
    'LEFT',
    'LOWER_LEFT',
    'DOWN',
    'LOWER_RIGHT',
  ]
  const seriesLabels = buildSeriesLabels(loadedSeriesRows)

  useEffect(() => {
    if (!initialDraft) {
      setLoadedSeriesRows([])
      setScoreValues(Array.from({ length: 60 }, () => ''))
      setDirectionValues(Array.from({ length: 60 }, () => ''))
      return
    }

    setAthlete(initialDraft.athlete || '')
    setDate(initialDraft.date || '')
    setEvent(initialDraft.event || '')
    setSessionType(initialDraft.sessionType || 'TREINO')
    setModality(initialDraft.modality || 'PISTOL')
    setLoadedSeriesRows(initialDraft.seriesRows || [])
    setScoreValues(normalizeGridValues(buildInitialScores(initialDraft.seriesRows || [])))
    setDirectionValues(normalizeGridValues(buildInitialDirections(initialDraft.seriesRows || [])))
  }, [initialDraft])


function validateManualSession() {
  const filledScores = scoreValues.filter((value) => value.trim() !== '').length
  const filledDirections = directionValues.filter((value) => value.trim() !== '').length
  let invalidScores = 0

  scoreValues.forEach((value) => {
    const trimmedValue = value.trim()
    if (value !== '') {
      const numericValue = Number(trimmedValue.replace('x', '').replace('X', ''))

      if (Number.isNaN(numericValue) || numericValue < 0 || numericValue > 10.9) {
        invalidScores += 1
      }
    }
  })

  if (filledScores !== 60) {
    setValidationMessage(t.manualSession.missingScores(filledScores))
    return
  }

  if (filledDirections !== 60) {
    setValidationMessage(t.manualSession.missingDirections(filledDirections))
    return
  }

  if (invalidScores > 0) {
    setValidationMessage(t.manualSession.invalidScores(invalidScores))
    return
  }

  setValidationMessage(t.manualSession.valid)
}

function saveManualSession() {
  validateManualSession()

  const session = {
  athlete,
  date,
  event,
  sessionType,
  modality,

  sourceType: 'MANUAL_ADMIN',
  status: 'ADMIN_SAVED',

  scores: scoreValues.map((value) => value.trim()),
  directions: directionValues.map((value) => value.trim()),

  createdAt: new Date().toISOString(),
}

  onSaveSession?.(session)

  setValidationMessage(t.manualSession.saved)
}




  return (
    <section className="panel" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <h2>{t.manualSession.title}</h2>
          <p style={{ marginTop: 4, opacity: 0.75 }}>
            {t.manualSession.subtitle}
          </p>
        </div>


	{validationMessage && (
  	<div style={{ marginTop: 16, fontWeight: 700 }}>
    	{validationMessage}
  	</div>
	)}

        <button type="button" onClick={onClose}>
          {t.common.close}
        </button>
      </div>


      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
          gap: 12,
          marginTop: 16,
          alignItems: 'end',
        }}
      >
        <input
  value={athlete}
  onChange={(e) => setAthlete(e.target.value)}
  placeholder={t.manualSession.athletePlaceholder}
/>
        <input
  type="date"
  value={date}
  onChange={(e) => setDate(e.target.value)}
/>
        <input
  value={event}
  onChange={(e) => setEvent(e.target.value)}
  placeholder={t.manualSession.eventPlaceholder}
/>

        <select
  value={sessionType}
  onChange={(e) => setSessionType(e.target.value)}
>
  <option value="TREINO">TREINO</option>
  <option value="SIMULADO">SIMULADO</option>
  <option value="COMPETICAO">COMPETICAO</option>
</select>

        <select
  value={modality}
  onChange={(e) => setModality(e.target.value)}
>
  <option value="">{t.manualSession.selectModality}</option>
  <option value="PISTOL">PISTOL</option>
  <option value="RIFLE">RIFLE</option>
</select>

</div>

<div style={{ overflowX: 'auto', marginTop: 18, paddingBottom: 8 }}>
        <table style={{ minWidth: 1320, width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 70 }}>{t.manualSession.tableSeries}</th>
              {Array.from({ length: 10 }).map((_, index) => (
                <th key={index}>T{index + 1}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {seriesLabels.map((serieName, serieIndex) => (
              <tr key={serieName}>
                <td style={{ fontWeight: 700 }}>{serieName}</td>

                {Array.from({ length: 10 }).map((_, index) => (
                  <td key={index}>
                    <div style={{ display: 'flex', gap: 6, minWidth: 118 }}>
                      <input
                        data-shot-score="true"
                        placeholder={t.common.score}
                        value={scoreValues[serieIndex * 10 + index] || ''}
                        onChange={(event) => {
                          const nextValues = [...scoreValues]
                          nextValues[serieIndex * 10 + index] = event.target.value
                          setScoreValues(nextValues)
                        }}
                        style={{ width: 50 }}
                      />

                      <select
                        data-shot-direction="true"
                        value={directionValues[serieIndex * 10 + index] || ''}
                        onChange={(event) => {
                          const nextValues = [...directionValues]
                          nextValues[serieIndex * 10 + index] = event.target.value
                          setDirectionValues(nextValues)
                        }}
                        style={{ width: 68 }}
                      >
                        <option value="">{t.common.direction}</option>
                        {pistolDirections.map((direction) => (
                          <option key={direction} value={direction}>
                            {direction}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          marginTop: 16,
        }}
      >
        <button type="button" onClick={validateManualSession}>
  	  {t.manualSession.validate}
	</button>
        <button type="button" onClick={saveManualSession}>{t.common.save}</button>
        <button type="button" onClick={onClose}>
          {t.common.cancel}
        </button>
      </div>
        </section>
  )
}

function buildInitialScores(seriesRows) {
  const sortedRows = [...seriesRows].sort((a, b) => {
    const aOrder = Number(a.hciSerieOrder || String(a.serie || '').replace(/\D/g, '')) || 0
    const bOrder = Number(b.hciSerieOrder || String(b.serie || '').replace(/\D/g, '')) || 0
    return aOrder - bOrder
  })

  return sortedRows.flatMap((row) =>
    String(row.tiros || '')
      .split(',')
      .map((value) => value.trim())
  )
}

function buildInitialDirections(seriesRows) {
  const sortedRows = [...seriesRows].sort((a, b) => {
    const aOrder = Number(a.hciSerieOrder || String(a.serie || '').replace(/\D/g, '')) || 0
    const bOrder = Number(b.hciSerieOrder || String(b.serie || '').replace(/\D/g, '')) || 0
    return aOrder - bOrder
  })

  return sortedRows.flatMap((row) => {
    if (Array.isArray(row.directions)) {
      return row.directions.map((value) => String(value || '').trim())
    }

    return Array.from({ length: 10 }).map(() => '')
  })
}

function buildSeriesLabels(seriesRows) {
  const sortedRows = [...seriesRows].sort((a, b) => {
    const aOrder = Number(a.hciSerieOrder || String(a.serie || '').replace(/\D/g, '')) || 0
    const bOrder = Number(b.hciSerieOrder || String(b.serie || '').replace(/\D/g, '')) || 0
    return aOrder - bOrder
  })

  if (sortedRows.length > 0) {
    return sortedRows.slice(0, 6).map((row, index) => row.serie || `SR${index + 1}`)
  }

  return ['SR1', 'SR2', 'SR3', 'SR4', 'SR5', 'SR6']
}

function normalizeGridValues(values) {
  const normalized = Array.from({ length: 60 }, (_, index) => values[index] || '')
  return normalized
}

export default NewManualSessionPanel
