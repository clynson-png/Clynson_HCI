import { useState } from 'react'
import { translations } from '../i18n/translations'

function ImportSiusVideoPanel({ onSaveSession, onClose, lang = 'pt' }) {
  const t = translations[lang] || translations.pt
  const [sourceFile, setSourceFile] = useState(null)
  const [error, setError] = useState('')
  const [athlete, setAthlete] = useState('')
  const [date, setDate] = useState('')
  const [event, setEvent] = useState('')
  const [sessionType, setSessionType] = useState('TREINO')
  const [modality, setModality] = useState('PISTOL')
  const [saveMessage, setSaveMessage] = useState('')
  const [extractedSession, setExtractedSession] = useState(null)


function normalizeDirection(value, weaponClass = modality) {
    if (!value) return ''

    const clean = String(value).trim().toUpperCase()
    const mode = String(weaponClass || modality).toUpperCase()

    if (mode === 'RIFLE') {
      const rifleMap = {
        N: 'Q1',
        NE: 'Q1',
        E: 'Q1',
        RIGHT_UP: 'Q1',
        UP_RIGHT: 'Q1',
        RIGHT: 'Q1',
        UP: 'Q1',
        NW: 'Q2',
        W: 'Q2',
        LEFT_UP: 'Q2',
        UP_LEFT: 'Q2',
        LEFT: 'Q2',
        SW: 'Q3',
        S: 'Q3',
        LEFT_DOWN: 'Q3',
        DOWN_LEFT: 'Q3',
        DOWN: 'Q3',
        SE: 'Q4',
        RIGHT_DOWN: 'Q4',
        DOWN_RIGHT: 'Q4',
        Q1: 'Q1',
        Q2: 'Q2',
        Q3: 'Q3',
        Q4: 'Q4',
        CENTER: 'CENTER',
      }

      return rifleMap[clean] || clean
    }

    const pistolMap = {
      N: 'UP',
      NE: 'UPPER_RIGHT',
      E: 'RIGHT',
      SE: 'LOWER_RIGHT',
      S: 'DOWN',
      SW: 'LOWER_LEFT',
      W: 'LEFT',
      NW: 'UPPER_LEFT',
      UP_RIGHT: 'UPPER_RIGHT',
      RIGHT_UP: 'UPPER_RIGHT',
      DOWN_RIGHT: 'LOWER_RIGHT',
      RIGHT_DOWN: 'LOWER_RIGHT',
      DOWN_LEFT: 'LOWER_LEFT',
      LEFT_DOWN: 'LOWER_LEFT',
      UP_LEFT: 'UPPER_LEFT',
      LEFT_UP: 'UPPER_LEFT',
      CENTER: 'CENTER',
      UP: 'UP',
      UPPER_RIGHT: 'UPPER_RIGHT',
      RIGHT: 'RIGHT',
      LOWER_RIGHT: 'LOWER_RIGHT',
      DOWN: 'DOWN',
      LOWER_LEFT: 'LOWER_LEFT',
      LEFT: 'LEFT',
      UPPER_LEFT: 'UPPER_LEFT',
    }

    return pistolMap[clean] || clean
  }

  function formatScore(value) {
    if (value === undefined || value === null || value === '') return ''

    const numberValue = Number(value)
    if (Number.isNaN(numberValue)) return String(value)

    return numberValue.toFixed(1)
  }

  function normalizeJsonDate(value) {
    if (!value) return ''

    const clean = String(value).trim()

    const dotDate = clean.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
    if (dotDate) {
      return dotDate[3] + '-' + dotDate[2].padStart(2, '0') + '-' + dotDate[1].padStart(2, '0')
    }

    const slashDate = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (slashDate) {
      return slashDate[3] + '-' + slashDate[2].padStart(2, '0') + '-' + slashDate[1].padStart(2, '0')
    }

    return clean
  }

  function normalizeHciIaShot(item, shotIndex, importedModality) {
    if (item === undefined || item === null || item === '') {
      return {
        shot: 'T' + (shotIndex + 1),
        score: '',
        direction: '',
        source: 'HCI_IA_IMPORTED_EMPTY',
        confidence: 'LOW',
      }
    }

    if (typeof item === 'number' || typeof item === 'string') {
      return {
        shot: 'T' + (shotIndex + 1),
        score: formatScore(item),
        direction: '',
        source: 'HCI_IA_IMPORTED',
        confidence: 'HIGH',
      }
    }

    return {
      shot: 'T' + (shotIndex + 1),
      score: formatScore(item.score),
      direction: normalizeDirection(
        item.direction ||
          item.direction_8 ||
          item.direcao ||
          item.quadrant ||
          '',
        importedModality
      ),
      x: item.x ?? '',
      y: item.y ?? '',
      innerTen: item.innerTen ?? false,
      source: 'HCI_IA_IMPORTED',
      confidence: item.confidence || 'HIGH',
    }
  }

  function importHciIaResult(file) {
    if (!file) return

    const reader = new FileReader()

    reader.onload = function (event) {
      try {
        const data = JSON.parse(event.target.result)
        const importedModality = String(data.modality || modality || 'PISTOL').toUpperCase()

        if (data.athlete) setAthlete(data.athlete)
        if (data.event) setEvent(data.event)
        if (data.date) setDate(normalizeJsonDate(data.date))
        if (data.modality) setModality(importedModality)

        if (!Array.isArray(data.series_table)) {
          setError(t.siusImport.seriesTableMissing)
          return
        }

        const rows = data.series_table.map((serieRow, serieIndex) => ({
          serie: serieRow.serie || 'SR' + (serieIndex + 1),
          shots: Array.from({ length: 10 }, (_, shotIndex) => {
            const key = 'T' + (shotIndex + 1)
            return normalizeHciIaShot(serieRow[key], shotIndex, importedModality)
          }),
        }))

        setExtractedSession(rows)
        setSaveMessage(t.siusImport.imported)
        setError('')
      } catch (err) {
        console.error(err)
        setError(t.siusImport.invalidJson)
      }
    }

    reader.readAsText(file)
  }

  function handleGenerateHciIaPackage() {
    if (!sourceFile) {
      setError(t.siusImport.selectSource)
      return
    }

    const packageData = {
      sourceType: 'HCI_IA_EXTRACTION_PACKAGE',
      requestedOutput: 'UNIVERSAL_HCI_JSON',
      athlete,
      date,
      event,
      sessionType,
      modality,
      fileName: sourceFile.name,
      fileType: sourceFile.type,
      expectedShots: 60,
      instruction: {
        ptBR:
          'Ler o arquivo enviado como fonte HCI IA. Pode ser vídeo SIUS, recibo SIUS, TargetScan, imagem ou PDF. Extrair tiros em ordem, preservar decimais para RIFLE, usar inteiros para PISTOL quando aplicável, extrair direção quando houver seta/coordenadas, agrupar em SR1-SR6, T1-T10. Devolver somente JSON válido no schema universal HCI, sem markdown.',
      },
      requiredSchema: {
        sourceType: 'HCI_IA_RESULT',
        modality: 'RIFLE_OR_PISTOL',
        athlete: '',
        event: '',
        date: '',
        total: '',
        series_table: [
          {
            serie: 'SR1',
            T1: {
              score: '',
              innerTen: false,
              x: '',
              y: '',
              direction: '',
              confidence: '',
            },
          },
        ],
      },
      createdAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(packageData, null, 2)], {
      type: 'application/json',
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'hci-ia-extraction-package-' + Date.now() + '.json'
    a.click()
    URL.revokeObjectURL(url)

    setSaveMessage(t.siusImport.packageGenerated)
    setError('')
  }

  function saveReviewedSiusSession() {
  const scoreInputs = document.querySelectorAll('[data-sius-score="true"]')
  const directionInputs = document.querySelectorAll('[data-sius-direction="true"]')

  const scores = Array.from(scoreInputs).map((input) => input.value.trim())
  const directions = Array.from(directionInputs).map((input) => input.value.trim())

  onSaveSession?.({
    athlete,
    date,
    event,
    sessionType,
    modality,
    sourceType: 'HCI_IA_IMPORTED_REVIEW',
    status: 'ADMIN_APPROVED',
    scores,
    directions,
  })

  setSaveMessage(t.siusImport.saved)
}

  function getShotScoreValue(score) {
    const cleanScore = String(score || '').replace('x', '').replace('X', '')
    const value = Number(cleanScore)
    return Number.isNaN(value) ? 0 : value
  }

  function getSeriesSum(row) {
    const total = row.shots.reduce((sum, shot) => sum + getShotScoreValue(shot.score), 0)
    return total.toFixed(1)
  }

  function getTotalSum() {
    if (!extractedSession) return '0.0'

    const total = extractedSession.reduce((sum, row) => {
      return sum + Number(getSeriesSum(row))
    }, 0)

    return total.toFixed(1)
  }

  return (
    <section className="panel" style={{ width: '100%' }}>
      <h2>{t.siusImport.title}</h2>
      <p>{t.siusImport.subtitle}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
        <input value={athlete} onChange={(e) => setAthlete(e.target.value)} placeholder={t.common.athlete} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input value={event} onChange={(e) => setEvent(e.target.value)} placeholder={t.common.event} />

        <select value={sessionType} onChange={(e) => setSessionType(e.target.value)}>
          <option value="TREINO">TREINO</option>
          <option value="SIMULADO">SIMULADO</option>
          <option value="COMPETICAO">COMPETICAO</option>
        </select>

        <select value={modality} onChange={(e) => setModality(e.target.value)}>
          <option value="PISTOL">PISTOL</option>
          <option value="RIFLE">RIFLE</option>
        </select>
      </div>

      <div style={{ marginTop: 16 }}>
        <strong>{t.siusImport.sourceFile}</strong>
        <input
          type="file"
          accept="video/*,image/*,.pdf,.json,application/pdf,application/json"
          onChange={(e) => {
            setSourceFile(e.target.files?.[0] || null)
            setExtractedSession(null)
            setSaveMessage('')
            setError('')
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button type="button" onClick={handleGenerateHciIaPackage}>
          {t.siusImport.runPackage}
        </button>

        <label style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer' }}>
          {t.siusImport.importResult}
          <input
            type="file"
            accept=".json,application/json,text/plain"
            style={{ display: 'none' }}
            onChange={(e) => {
              importHciIaResult(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>

        <button type="button" onClick={onClose}>{t.common.cancel}</button>
      </div>

      {error && <div style={{ marginTop: 16, fontWeight: 700 }}>{error}</div>}
      {saveMessage && <div style={{ marginTop: 16, fontWeight: 700 }}>{saveMessage}</div>}

      {extractedSession && (
        <div style={{ marginTop: 24 }}>
          <h3>{t.siusImport.reviewTitle}</h3>
          <p style={{ fontWeight: 700 }}>{t.siusImport.reviewFlag}</p>

          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ minWidth: 1320, width: '100%' }}>
              <thead>
                <tr>
                  <th>{t.common.series}</th>
                  {Array.from({ length: 10 }).map((_, index) => <th key={index}>T{index + 1}</th>)}
                  <th>{t.common.sum}</th>
                </tr>
              </thead>

              <tbody>
                {extractedSession.map((row) => (
                  <tr key={row.serie}>
                    <td style={{ fontWeight: 700 }}>{row.serie}</td>

                    {row.shots.map((shot) => (
                      <td key={row.serie + '-' + shot.shot}>
                        <input data-sius-score="true" defaultValue={shot.score} style={{ width: 50 }} />
                        <select data-sius-direction="true" defaultValue={shot.direction} style={{ width: 120 }}>
                          <option value=""></option>
                          <option value="CENTER">CENTER</option>
                          <option value="UP">UP</option>
                          <option value="UPPER_RIGHT">UPPER_RIGHT</option>
                          <option value="RIGHT">RIGHT</option>
                          <option value="LOWER_RIGHT">LOWER_RIGHT</option>
                          <option value="DOWN">DOWN</option>
                          <option value="LOWER_LEFT">LOWER_LEFT</option>
                          <option value="LEFT">LEFT</option>
                          <option value="UPPER_LEFT">UPPER_LEFT</option>
                          <option value="Q1">Q1</option>
                          <option value="Q2">Q2</option>
                          <option value="Q3">Q3</option>
                          <option value="Q4">Q4</option>
                        </select>
                      </td>
                    ))}

                    <td style={{ fontWeight: 700 }}>{getSeriesSum(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 700 }}>
              {t.common.total.toUpperCase()}: {getTotalSum()}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" onClick={saveReviewedSiusSession}>
              {t.siusImport.approveAndSave}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export default ImportSiusVideoPanel
