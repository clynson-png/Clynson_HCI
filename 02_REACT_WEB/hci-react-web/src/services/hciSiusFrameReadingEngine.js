import { createWorker } from 'tesseract.js'

export async function readSiusFrames(
  frames = [],
  modality = 'PISTOL',
  sourceType = 'VIDEO_FRAME'
) {
  const worker = await createWorker('eng')

  await worker.setParameters({
    tessedit_char_whitelist: '0123456789.,xXPp- ',
    tessedit_pageseg_mode: '6',
  })

  if (sourceType === 'RECEIPT') {
    const result = await readSiusReceiptFrames(worker, frames, modality)
    await worker.terminate()
    return result
  }

  const readings = []

  for (const frame of frames) {
    const crops = await makeSiusCrops(frame.imageUrl)

    let score = ''
    let rawScoreText = ''

    for (const scoreCrop of crops.scoreCrops) {
      const result = await worker.recognize(scoreCrop)
      const text = result?.data?.text || ''
      const extracted = extractScore(text, modality)

      console.log('SIUS OCR TRY:', frame.timeSeconds, text, extracted)

      if (isValidScore(extracted, modality)) {
        score = extracted
        rawScoreText = text
        break
      }
    }

    readings.push({
      timeSeconds: frame.timeSeconds,
      score,
      direction: '',
      rawScoreText,
      scoreCrop: crops.scoreCrops[0],
      confidence: score ? 'MEDIUM' : 'LOW',
    })
  }

  await worker.terminate()
  return readings
}

async function readSiusReceiptFrames(worker, frames, modality) {
  const allShots = []
  let fullRawText = ''

  for (const frame of frames) {
    const receiptCrop = await prepareReceiptForOcr(frame.imageUrl)
    const result = await worker.recognize(receiptCrop)
    const rawText = result?.data?.text || ''

    console.log('SIUS RECEIPT OCR RAW:', rawText)

    fullRawText += '\n' + rawText
    allShots.push(...extractReceiptShots(rawText, modality))
  }

  const uniqueShots = dedupeShots(allShots)
  const rows = buildFixedSiusRows(uniqueShots, modality)

  return rows.map((row, index) => ({
    timeSeconds: index,
    serie: row.serie,
    score: '',
    direction: '',
    shots: row.shots,
    row,
    rawScoreText: fullRawText,
    confidence: uniqueShots.length >= 60 ? 'HIGH' : uniqueShots.length ? 'MEDIUM' : 'LOW',
    sourceType: 'SIUS_RECEIPT_OCR',
  }))
}

async function prepareReceiptForOcr(imageUrl) {
  const img = await loadImage(imageUrl)

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  const scale = 2.5
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    const v = gray > 165 ? 255 : 0

    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
  }

  ctx.putImageData(imageData, 0, 0)

  return canvas.toDataURL('image/png')
}

function extractReceiptShots(text, modality) {
  const clean = String(text || '')
    .replace(/,/g, '.')
    .replace(/[|]/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase()

  const patterns = [
    /(\d{1,2})\s*P\s*(10X|10\.\d|[0-9]\.\d|10|[0-9])/g,
    /(\d{1,2})\s*[-:]\s*(10X|10\.\d|[0-9]\.\d|10|[0-9])/g,
    /(\d{1,2})\s+(10X|10\.\d|[0-9]\.\d|10|[0-9])/g,
  ]

  const shots = []

  for (const regex of patterns) {
    let match

    while ((match = regex.exec(clean)) !== null) {
      const shotNumber = Number(match[1])
      const rawScore = match[2]

      if (shotNumber >= 1 && shotNumber <= 60) {
        shots.push({
          shotNumber,
          rawScore,
          score: normalizeReceiptScore(rawScore, modality),
          direction: '',
        })
      }
    }
  }

  return shots.sort((a, b) => a.shotNumber - b.shotNumber)
}

function normalizeReceiptScore(value, modality) {
  const clean = String(value || '').trim().toUpperCase()

  if (clean === '10X') {
    return modality === 'PISTOL' ? '10x' : '10.9'
  }

  const number = Number(clean)
  if (Number.isNaN(number)) return ''

  if (modality === 'RIFLE') {
    return number.toFixed(1)
  }

  return String(Math.floor(number))
}

function dedupeShots(shots) {
  const map = new Map()

  for (const shot of shots) {
    if (!map.has(shot.shotNumber)) {
      map.set(shot.shotNumber, shot)
    }
  }

  return Array.from(map.values()).sort((a, b) => a.shotNumber - b.shotNumber)
}

function buildFixedSiusRows(shots, modality) {
  const byNumber = new Map(shots.map((shot) => [shot.shotNumber, shot]))
  const rows = []

  for (let serieIndex = 0; serieIndex < 6; serieIndex += 1) {
    const row = {
      serie: `SR${serieIndex + 1}`,
      shots: [],
    }

    for (let shotIndex = 0; shotIndex < 10; shotIndex += 1) {
      const absoluteShot = serieIndex * 10 + shotIndex + 1
      const shot = byNumber.get(absoluteShot)

      const score = shot?.score || ''
      const direction = shot?.direction || ''

      row[`T${shotIndex + 1}`] = score
      row[`D${shotIndex + 1}`] = direction

      row.shots.push({
        shot: `T${shotIndex + 1}`,
        absoluteShot,
        score,
        direction,
        source: score ? 'SIUS_RECEIPT_OCR' : 'MANUAL_REVIEW_REQUIRED',
        confidence: score ? 'OCR' : 'MANUAL',
      })
    }

    row.soma = sumReceiptSeries(row.shots, modality)
    rows.push(row)
  }

  return rows
}

function sumReceiptSeries(group, modality) {
  const total = group.reduce((sum, shot) => {
    const value =
      String(shot.score).toLowerCase() === '10x'
        ? 10
        : Number(shot.score)

    return sum + (Number.isNaN(value) ? 0 : value)
  }, 0)

  return modality === 'RIFLE' ? Number(total.toFixed(1)) : total
}

async function makeSiusCrops(imageUrl) {
  const img = await loadImage(imageUrl)

  const monitor = cropRaw(img, {
    x: img.width * 0.08,
    y: img.height * 0.18,
    w: img.width * 0.78,
    h: img.height * 0.38,
  })

  const monitorImg = await loadImage(monitor)

  const scoreBoxes = [
    { x: 0.73, y: 0.38, w: 0.22, h: 0.32 },
    { x: 0.70, y: 0.34, w: 0.26, h: 0.38 },
    { x: 0.76, y: 0.42, w: 0.18, h: 0.25 },
    { x: 0.68, y: 0.28, w: 0.30, h: 0.45 },
  ]

  return {
    scoreCrops: scoreBoxes.map((box) =>
      cropForOcr(monitorImg, {
        x: monitorImg.width * box.x,
        y: monitorImg.height * box.y,
        w: monitorImg.width * box.w,
        h: monitorImg.height * box.h,
      })
    ),
  }
}

function extractScore(text, modality) {
  const clean = String(text || '')
    .replace(',', '.')
    .replace(/\s+/g, '')
    .toUpperCase()

  if (clean.includes('10X')) {
    return modality === 'PISTOL' ? '10x' : '10.9'
  }

  const decimal = clean.match(/10\.[0-9]|[0-9]\.[0-9]/)
  const integer = clean.match(/\b10\b|\b[0-9]\b/)

  if (modality === 'PISTOL') {
    if (decimal) return String(Math.floor(Number(decimal[0])))
    if (integer) return integer[0]
    return ''
  }

  if (decimal) return decimal[0]
  if (integer) return `${integer[0]}.0`

  return ''
}

function isValidScore(score, modality) {
  if (!score) return false

  if (modality === 'RIFLE') {
    return /^([6-9]\.[0-9]|10\.[0-9])$/.test(score)
  }

  return /^(10x|10|[6-9])$/i.test(score)
}

function cropRaw(img, box) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  canvas.width = Math.round(box.w)
  canvas.height = Math.round(box.h)

  ctx.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, canvas.width, canvas.height)

  return canvas.toDataURL('image/png')
}

function cropForOcr(img, box) {
  const scale = 8

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  canvas.width = Math.round(box.w * scale)
  canvas.height = Math.round(box.h * scale)

  ctx.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, canvas.width, canvas.height)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    const v = gray > 120 ? 0 : 255

    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
  }

  ctx.putImageData(imageData, 0, 0)

  return canvas.toDataURL('image/png')
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}