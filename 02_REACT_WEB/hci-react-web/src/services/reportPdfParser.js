import * as pdfjsLib from 'pdfjs-dist'
import Tesseract from 'tesseract.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

export async function parseReportPdf(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const loadingTask = pdfjsLib.getDocument({ data: bytes })
  const pdf = await loadingTask.promise

  let fullText = ''

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = buildStructuredPageText(content.items)

    fullText += `${pageText}\n`
  }

  let text = normalizeExtractedText(fullText)

  if (shouldRunOcrFallback(text)) {
    const ocrText = await extractPdfTextWithOcr(pdf)
    text = [text, ocrText].filter(Boolean).join('\n').replace(/[ \t]+/g, ' ').trim()
  }
  const athleteName = extractAthleteName(text)
  const modality = extractModality(text)
  const sessionDate = extractSessionDate(text)
  const sessionType = extractSessionType(text)
  const sourceLabel = extractSourceLabel(text, file.name)
  const eventLabel = extractEventLabel(text, modality)
  const scores = extractShotScores(text)
  const directions = extractShotDirections(text, modality, scores.length)
  const seriesTotals = buildSeriesTotals(scores, text)
  const officialMetrics = extractOfficialMetrics(text)
  const directionalRows = extractDirectionalRows(text, modality)
  const insights = extractEnumeratedParagraphs(text, ['Insight 1.', 'Insight 2.'])
  const correction = extractNamedParagraph(text, [
    'Correcao principal.',
    'Correção principal.',
    'Main exercise.',
  ])
  const trainingProposal = extractNamedParagraph(text, [
    'Proposta de treino.',
    'Suggested volume:',
  ])
  const keyPhrase = extractNamedParagraph(text, ['Key phrase:'])
  const evidenceNote = extractNamedParagraph(text, ['Evidence note:', 'Evidence note.'])

  return {
    athleteName,
    modality,
    sessionDate,
    sessionType,
    sourceLabel,
    eventLabel,
    scores,
    directions,
    canPrefillAdmin: scores.length === 60,
    report: {
      reportTitle: detectReportTitle(text),
      subtitle: `${sourceLabel} • ${eventLabel}`,
      seriesTotals,
      officialMetrics,
      directionalRows,
      insights,
      correction,
      trainingProposal,
      keyPhrase,
      evidenceNote,
    },
    rawText: text,
  }
}

function detectReportTitle(text) {
  if (/lovelesh methodology report/i.test(text)) return 'Lovelesh Methodology Report'
  if (/analysis direcional/i.test(text)) return 'Relatório HCI Sports Performance'
  if (/target analysis report/i.test(text)) return 'HCI Target Analysis Report'
  return 'Relatório HCI'
}

function shouldRunOcrFallback(text) {
  const hasEnoughText = String(text || '').length > 800
  const hasShotRows = extractShotScores(text).length === 60
  return !hasEnoughText || !hasShotRows
}

function buildStructuredPageText(items) {
  const rows = []
  let currentRow = []
  let currentY = null

  items.forEach((item) => {
    if (!('str' in item)) return
    const value = String(item.str || '').trim()
    if (!value) return

    const y = typeof item.transform?.[5] === 'number' ? item.transform[5] : currentY

    if (currentY !== null && y !== null && Math.abs(y - currentY) > 4) {
      rows.push(currentRow.join(' ').trim())
      currentRow = []
    }

    currentRow.push(value)
    currentY = y
  })

  if (currentRow.length > 0) {
    rows.push(currentRow.join(' ').trim())
  }

  return rows.join('\n')
}

function normalizeExtractedText(text) {
  return String(text || '')
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

async function extractPdfTextWithOcr(pdf) {
  let ocrText = ''
  const maxPages = Math.min(pdf.numPages, 3)

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })

    if (!context) continue

    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)

    await page.render({
      canvasContext: context,
      viewport,
    }).promise

    const result = await Tesseract.recognize(canvas, 'eng+por')
    ocrText += ` ${result?.data?.text || ''}`
  }

  return ocrText
}

function extractAthleteName(text) {
  const athleteMatch =
    text.match(/Atleta:\s*([A-Za-zÀ-ÿ.'\-\s]+?)(?:\s+BRA|\s+\||\s+Data\/hora:|$)/i) ||
    text.match(/Athlete:\s*([A-Za-zÀ-ÿ.'\-\s]+?)(?:\.\s+Source set:|\s+\|\s+Date|$)/i)

  return sanitizeLabel(athleteMatch?.[1]) || 'ATLETA_RELATORIO'
}

function extractModality(text) {
  if (/air rifle|rifle 60/i.test(text)) return 'RIFLE'
  if (/air pistol|pistol 60|pistol target/i.test(text)) return 'PISTOL'
  return 'PISTOL'
}

function extractSessionDate(text) {
  const brMatch = text.match(/Data\/hora:\s*(\d{2})\.(\d{2})\.(\d{4})/i)
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`
  }

  const isoLike = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (isoLike) {
    return `${isoLike[1]}-${isoLike[2]}-${isoLike[3]}`
  }

  return new Date().toISOString().slice(0, 10)
}

function extractSessionType(text) {
  if (/competition|match|qualification/i.test(text)) return 'COMPETICAO'
  if (/simulation|simulado/i.test(text)) return 'SIMULADO'
  return 'TREINO'
}

function extractSourceLabel(text, fallbackName) {
  const sourceMatch = text.match(/Source:\s*([^\.]+)\./i)
  if (sourceMatch) return sanitizeLabel(sourceMatch[1])

  const methodMatch = text.match(/R\d+\s*-\s*([^|]+)\|/i)
  if (methodMatch) return sanitizeLabel(methodMatch[1])

  return fallbackName
}

function extractEventLabel(text, modality) {
  const directMatch =
    text.match(/Air Rifle 60/i) ||
    text.match(/Air Pistol 60/i) ||
    text.match(/Rifle 60/i) ||
    text.match(/Pistol 60/i)

  if (directMatch) return directMatch[0]
  return modality === 'RIFLE' ? 'Air Rifle 60' : 'Air Pistol 60'
}

function extractShotScores(text) {
  const lineScores = extractShotScoresFromSeriesLines(text)
  if (lineScores.length === 60) return lineScores

  const siusScores = extractShotScoresFromSiusTable(text)
  if (siusScores.length === 60) return siusScores

  return []
}

function extractShotDirections(text, modality, scoreCount) {
  const lineDirections = extractShotDirectionsFromSiusTable(text, modality)
  if (lineDirections.length === scoreCount && scoreCount > 0) {
    return lineDirections
  }

  const rawDirections = [...text.matchAll(/\b\d+\s+(?:[0-9]+(?:\.[0-9])?[xX*]?)\s+([A-Z]{1,2})\s+/g)]
    .map((match) => normalizeDirectionToken(match[1], modality))

  if (rawDirections.length === scoreCount && scoreCount > 0) {
    return rawDirections
  }

  return Array.from({ length: scoreCount }, () => '')
}

function extractShotScoresFromSeriesLines(text) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const seriesMap = new Map()

  lines.forEach((line) => {
    const match = line.match(/^SR([1-6])\s+(.*)$/i)
    if (!match) return

    const seriesCode = `SR${match[1]}`
    const tokens = tokenizeScoreLine(match[2])
    if (tokens.length >= 10) {
      seriesMap.set(seriesCode, tokens.slice(0, 10).map(normalizeScoreToken))
    }
  })

  if (seriesMap.size !== 6) return []

  return ['SR1', 'SR2', 'SR3', 'SR4', 'SR5', 'SR6'].flatMap((seriesCode) => seriesMap.get(seriesCode) || [])
}

function extractShotScoresFromSiusTable(text) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const startIndex = lines.findIndex((line) => /Tabela SIUS do match/i.test(line))
  if (startIndex < 0) return []

  const shots = []

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    const match = line.match(/^(\d{1,2})\s+([0-9]+(?:\.[0-9])?[xX*]?)\s+([A-Z]{1,2})\b/)
    if (match) {
      shots.push(normalizeScoreToken(match[2]))
    }
  }

  return shots.length >= 60 ? shots.slice(0, 60) : []
}

function extractShotDirectionsFromSiusTable(text, modality) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const startIndex = lines.findIndex((line) => /Tabela SIUS do match/i.test(line))
  if (startIndex < 0) return []

  const directions = []

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    const match = line.match(/^(\d{1,2})\s+([0-9]+(?:\.[0-9])?[xX*]?)\s+([A-Z]{1,2})\b/)
    if (match) {
      directions.push(normalizeDirectionToken(match[3], modality))
    }
  }

  return directions.length >= 60 ? directions.slice(0, 60) : []
}

function buildSeriesTotals(scores, text) {
  if (scores.length === 60) {
    return Array.from({ length: 6 }, (_, index) => {
      const seriesScores = scores.slice(index * 10, index * 10 + 10)
      const total = seriesScores.reduce((sum, value) => sum + normalizeNumericShot(value), 0)
      return {
        seriesCode: `SR${index + 1}`,
        total: Number(total.toFixed(1)),
      }
    })
  }

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const totals = []

  lines.forEach((line) => {
    const match = line.match(/^SR([1-6])\s+([0-9]+(?:\.[0-9])?)(?:\s+[0-9]+)?$/i)
    if (match) {
      totals.push({
        seriesCode: `SR${match[1]}`,
        total: Number(match[2]),
      })
      return
    }

    const scoreMatch = line.match(/^SR([1-6])\s+(.*)$/i)
    if (scoreMatch) {
      const tokens = tokenizeScoreLine(scoreMatch[2])
      if (tokens.length >= 11) {
        totals.push({
          seriesCode: `SR${scoreMatch[1]}`,
          total: Number(tokens[10].replace(/[xX*]/g, '')),
        })
      }
    }
  })

  return totals.slice(0, 6)
}

function extractOfficialMetrics(text) {
  const metrics = []
  const metricMatchers = [
    ['Total', /TOTAL\s+([0-9]+(?:\.[0-9])?)/i],
    ['Decimal total', /Decimal total\s+([0-9]+(?:\.[0-9])?)/i],
    ['Inner tens', /Inner tens\s+([0-9]+)/i],
    ['Centros', /TOTAL\s+[0-9]+(?:\.[0-9])?\s+([0-9]+)\s+Metrica/i],
    ['MPI X', /MPI X\s+(-?[0-9]+(?:\.[0-9])?\s*mm)/i],
    ['MPI Y', /MPI Y\s+(-?[0-9]+(?:\.[0-9])?\s*mm)/i],
    ['Group size', /Group size\s+([0-9]+(?:\.[0-9])?\s*mm)/i],
    ['Direção dominante', /Direcao dominante\s+([A-Za-zÀ-ÿ]+)/i],
    ['Tempo total', /Tempo total do match\s+([0-9:.]+)/i],
    ['Intervalo médio', /Intervalo medio\s+([0-9.]+s)/i],
  ]

  metricMatchers.forEach(([label, pattern]) => {
    const match = text.match(pattern)
    if (match) {
      metrics.push({ label, value: sanitizeLabel(match[1]) })
    }
  })

  return metrics
}

function extractDirectionalRows(text, modality) {
  if (modality === 'RIFLE') {
    const quadrants = [...text.matchAll(/\b(Esquerda|Alto|Baixo|Direita)\s+([0-9]+(?:\.[0-9])?)%/gi)]
    return quadrants.map((match) => ({
      label: sanitizeLabel(match[1]),
      value: `${match[2]}%`,
    }))
  }

  const sectors = [...text.matchAll(/\b(0°|45°|90°|135°|180°|225°|270°|315°)\s+([A-Za-z ]+?)\s+([0-9]+(?:\.[0-9])?)%/g)]
  return sectors.map((match) => ({
    label: `${match[1]} ${sanitizeLabel(match[2])}`,
    value: `${match[3]}%`,
  }))
}

function extractEnumeratedParagraphs(text, markers) {
  return markers
    .map((marker) => extractNamedParagraph(text, [marker]))
    .filter(Boolean)
}

function extractNamedParagraph(text, labels) {
  for (const label of labels) {
    const escapedLabel = escapeRegExp(label)
    const match = text.match(
      new RegExp(`${escapedLabel}\\s*([^]+?)(?=(Insight \\d\\.|Key phrase:|Evidence note:|Proposta de treino\\.|Main exercise\\.|$))`, 'i')
    )

    if (match) {
      return sanitizeLabel(match[1])
    }
  }

  return ''
}

function normalizeScoreToken(value) {
  const clean = String(value || '').trim().replace(/\*/g, '')
  if (/^[0-9]+[xX]$/.test(clean)) {
    return clean.toUpperCase()
  }
  return clean
}

function tokenizeScoreLine(value) {
  return String(value || '')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => /^[0-9]+(?:\.[0-9])?[xX*]?$/.test(token))
}

function normalizeNumericShot(value) {
  const clean = String(value || '')
    .replace(/[xX]/g, '')
    .trim()
  const numeric = Number(clean)
  return Number.isNaN(numeric) ? 0 : numeric
}

function normalizeDirectionToken(value, modality) {
  const clean = String(value || '').trim().toUpperCase()

  if (modality === 'RIFLE') {
    const rifleMap = {
      N: 'Q1',
      NE: 'Q1',
      E: 'Q1',
      NW: 'Q2',
      W: 'Q2',
      SW: 'Q3',
      S: 'Q3',
      SE: 'Q4',
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
  }
  return pistolMap[clean] || clean
}

function sanitizeLabel(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s([,.:;])/g, '$1')
    .trim()
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
