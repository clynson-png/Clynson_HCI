import http from 'node:http'
import { URL } from 'node:url'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { normalizeSnapshotToUnifiedSchema } from '../src/services/unifiedSnapshotSchema.js'
import {
  buildTrainingPlanEngineInput,
  buildTrainingPlanOutput,
} from '../src/services/trainingPlanEngine.js'

const PORT = Number(process.env.ADMIN_BACKEND_PORT || 8787)
const TRELLO_API_BASE_URL = 'https://api.trello.com/1'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..')
const PUBLIC_SNAPSHOT_PATH = path.join(PROJECT_ROOT, 'public', 'hci_active_snapshot_v1.json')
const FALLBACK_SNAPSHOT_PATH = path.join(PROJECT_ROOT, 'public', 'snapshot_v3_4_1.json')
const TRAINING_LIBRARY_PATH = path.join(
  PROJECT_ROOT,
  'src',
  'data',
  'training_library_canonical.json'
)
const PLAN_TRELLO_BOARDS = [
  { boardKey: 'primary-plan', boardShortLink: '7vcK08LX', boardName: 'Plan Board' },
  { boardKey: 'screen-a', boardShortLink: 'a82EffpE', boardName: 'Tela 2' },
  { boardKey: 'screen-b', boardShortLink: 'eMMWHI3J', boardName: 'Tela 3' },
  { boardKey: 'training-sessions', boardShortLink: 'eO9qGgSd', boardName: 'Training Sessions' },
]

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  })
  response.end(JSON.stringify(payload))
}

function getTrelloCredentials() {
  return {
    key: process.env.TRELLO_KEY || '',
    token: process.env.TRELLO_TOKEN || '',
  }
}

function buildTrelloAuthQuery() {
  const { key, token } = getTrelloCredentials()

  if (!key || !token) {
    return null
  }

  return new URLSearchParams({ key, token }).toString()
}

function parseSnapshotText(text) {
  try {
    return JSON.parse(text)
  } catch {
    const normalizedText = text.replace(/\\([\[\]_])/g, '$1')
    return JSON.parse(normalizedText)
  }
}

async function readJsonFile(filePath, parser = JSON.parse) {
  const text = await readFile(filePath, 'utf-8')
  return parser(text)
}

async function loadSnapshotFromDisk() {
  try {
    const snapshot = await readJsonFile(PUBLIC_SNAPSHOT_PATH, parseSnapshotText)
    return normalizeSnapshotToUnifiedSchema(snapshot)
  } catch {
    const snapshot = await readJsonFile(FALLBACK_SNAPSHOT_PATH, parseSnapshotText)
    return normalizeSnapshotToUnifiedSchema(snapshot)
  }
}

async function loadTrainingLibraryEntries() {
  const trainingLibrary = await readJsonFile(TRAINING_LIBRARY_PATH)
  return trainingLibrary?.entries || []
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeName(value) {
  return String(value || '').trim()
}

function resolveAthleteIdentity(snapshot, url) {
  const requestedEmail = normalizeEmail(url.searchParams.get('athleteEmail'))
  const requestedName =
    normalizeName(url.searchParams.get('athleteName')) ||
    normalizeName(url.searchParams.get('athleteId'))

  const leadByEmail = requestedEmail
    ? (snapshot?.leads || []).find(
        (item) => normalizeEmail(item.athleteEmail) === requestedEmail
      ) || null
    : null

  const athleteByEmail = requestedEmail
    ? (snapshot?.athletes || []).find(
        (item) => normalizeEmail(item.athleteEmail) === requestedEmail
      ) || null
    : null

  const athleteName =
    leadByEmail?.athleteName ||
    athleteByEmail?.athleteName ||
    requestedName ||
    snapshot?.athletes?.[0]?.athleteName ||
    snapshot?.athlete360?.[0]?.athlete ||
    snapshot?.leads?.[0]?.athleteName ||
    'UNDEFINED_ATHLETE'

  const athleteEmail =
    requestedEmail ||
    normalizeEmail(leadByEmail?.athleteEmail) ||
    normalizeEmail(athleteByEmail?.athleteEmail) ||
    null

  return {
    athleteName,
    athleteEmail,
  }
}

function normalizeLevelCode(level) {
  const value = String(level || '').toUpperCase()

  if (value.includes('ELITE')) return 'ELITE'
  if (value.includes('HIGH PERFORMANCE')) return 'HIGH_PERFORMANCE'
  if (value.includes('ALTO') || value.includes('HIGH')) return 'HIGH_PERFORMANCE'
  if (value.includes('COMPETITIVE')) return 'INTERMEDIATE'
  if (value.includes('DEVELOPMENT')) return 'BEGINNER'
  if (value.includes('INTER')) return 'INTERMEDIATE'
  if (value.includes('INICIANTE') || value.includes('BEGINNER')) return 'BEGINNER'
  if (value.includes('SEM BASELINE')) return 'NO_BASELINE'

  return 'UNKNOWN'
}

function buildBackendAthleteView(snapshot, athleteName, athleteEmail = null) {
  const athlete360 =
    (snapshot?.athlete360 || []).find((item) => normalizeName(item.athlete) === normalizeName(athleteName)) ||
    null
  const athleteRecord =
    (snapshot?.athletes || []).find((item) => normalizeName(item.athleteName) === normalizeName(athleteName)) ||
    null
  const leadRecord =
    (snapshot?.leads || []).find((item) => normalizeName(item.athleteName) === normalizeName(athleteName)) ||
    (athleteEmail
      ? (snapshot?.leads || []).find((item) => normalizeEmail(item.athleteEmail) === normalizeEmail(athleteEmail))
      : null) ||
    null

  if (!athlete360 && !athleteRecord && !leadRecord) {
    return null
  }

  const discipline =
    athlete360?.prova ||
    athleteRecord?.modality ||
    snapshot?.sessionHeaders?.find((item) => item.athleteName === athleteName)?.modality ||
    null

  const levelCode =
    normalizeLevelCode(athlete360?.level || athleteRecord?.levelCode || null)

  const parameters = athlete360?.parameters || []
  const prescriptions = athlete360?.prescriptions || []
  const criticalParameter = [...parameters]
    .sort((a, b) => Number(a.score || 0) - Number(b.score || 0))[0]?.parameter || null

  return {
    athlete: {
      id: athleteRecord?.athleteId || leadRecord?.leadId || athleteName,
      name: athleteName,
      email: athleteEmail || leadRecord?.athleteEmail || athleteRecord?.athleteEmail || null,
      discipline,
      levelCode,
    },
    summary: {
      hci: athlete360?.hci ?? null,
      levelCode,
    },
    indices: {
      allParameters: parameters.map((item) => ({
        parameterCode: item.parameter,
        score: item.score,
      })),
    },
    athleteSelfAnalysis: {
      criticalParameter: criticalParameter ? { code: criticalParameter } : null,
    },
    trainingPlan: {
      coachPrescriptions: prescriptions,
    },
  }
}

async function readTrelloJson(path, authQuery) {
  const separator = path.includes('?') ? '&' : '?'
  const response = await fetch(
    `${TRELLO_API_BASE_URL}${path}${authQuery ? `${separator}${authQuery}` : ''}`
  )

  if (!response.ok) {
    throw new Error(`Trello API returned ${response.status}`)
  }

  return response.json()
}

function extractEmailFromText(value) {
  const text = String(value || '')
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return match ? normalizeEmail(match[0]) : null
}

function buildCustomFieldValueMap(card, customFields) {
  const items = Array.isArray(card.customFieldItems) ? card.customFieldItems : []
  const fieldMap = new Map(customFields.map((field) => [field.id, field]))

  return items.reduce((accumulator, item) => {
    const field = fieldMap.get(item.idCustomField)

    if (!field) {
      return accumulator
    }

    const fieldName = String(field.name || '').trim()
    const textValue =
      item.value?.text ||
      item.value?.date ||
      item.value?.number ||
      item.value?.checked ||
      (item.idValue
        ? field.options?.find((option) => option.id === item.idValue)?.value?.text
        : null) ||
      ''

    if (fieldName) {
      accumulator[fieldName] = String(textValue || '').trim()
    }

    return accumulator
  }, {})
}

function resolveCardAthleteIdentity(card, customFields, snapshot) {
  const customFieldValues = buildCustomFieldValueMap(card, customFields)
  const normalizedFieldEntries = Object.entries(customFieldValues).map(([key, value]) => ({
    key: String(key || '').trim().toLowerCase(),
    value: String(value || '').trim(),
  }))

  const customFieldEmail =
    normalizedFieldEntries.find((entry) =>
      ['athleteemail', 'athlete email', 'email', 'e-mail'].includes(entry.key)
    )?.value || ''

  const customFieldName =
    normalizedFieldEntries.find((entry) =>
      ['athletename', 'athlete name', 'athlete', 'nome', 'nome atleta'].includes(entry.key)
    )?.value || ''

  const athleteEmailResolved =
    normalizeEmail(customFieldEmail) ||
    extractEmailFromText(card.desc) ||
    extractEmailFromText(card.name) ||
    null

  const leadRecord = athleteEmailResolved
    ? (snapshot?.leads || []).find(
        (item) => normalizeEmail(item.athleteEmail) === athleteEmailResolved
      ) || null
    : null

  const athleteNameResolved =
    leadRecord?.athleteName ||
    normalizeName(customFieldName) ||
    null

  return {
    athleteEmailResolved,
    athleteNameResolved,
    customFieldValues,
  }
}

function normalizeTrelloCard(card, customFields, snapshot, requestedAthleteEmail) {
  const identity = resolveCardAthleteIdentity(card, customFields, snapshot)
  const requestedEmailNormalized = normalizeEmail(requestedAthleteEmail)
  const hasRequiredEmail = Boolean(identity.athleteEmailResolved)
  const emailMatches =
    !requestedEmailNormalized ||
    (identity.athleteEmailResolved &&
      identity.athleteEmailResolved === requestedEmailNormalized)

  return {
    id: card.id,
    idList: card.idList,
    name: card.name,
    desc: card.desc,
    shortUrl: card.shortUrl,
    due: card.due || null,
    start: card.start || null,
    labels: card.labels || [],
    athleteEmailResolved: identity.athleteEmailResolved,
    athleteNameResolved: identity.athleteNameResolved,
    customFieldValues: identity.customFieldValues,
    integration: {
      hasRequiredAthleteEmail: hasRequiredEmail,
      emailMatchesRequestedAthlete: Boolean(emailMatches),
      matchStatus: !hasRequiredEmail
        ? 'MISSING_ATHLETE_EMAIL'
        : emailMatches
          ? 'MATCHED'
          : 'OTHER_ATHLETE',
    },
  }
}

async function loadTrelloBoardSnapshot(shortLink, requestedAthleteEmail = '') {
  const authQuery = buildTrelloAuthQuery()

  if (!authQuery) {
    return { error: 'TRELLO_NOT_CONFIGURED' }
  }

  const [snapshot, board, lists, cards, customFields] = await Promise.all([
    loadSnapshotFromDisk(),
    readTrelloJson(
      `/boards/${shortLink}?fields=name,desc,url,shortLink`,
      authQuery
    ),
    readTrelloJson(
      `/boards/${shortLink}/lists?fields=name,pos,closed`,
      authQuery
    ),
    readTrelloJson(
      `/boards/${shortLink}/cards?fields=name,desc,idList,labels,due,start,closed,shortUrl&members=false&customFieldItems=true`,
      authQuery
    ),
    readTrelloJson(
      `/boards/${shortLink}/customFields`,
      authQuery
    ),
  ])

  const openLists = lists.filter((item) => !item.closed)
  const openCards = cards
    .filter((item) => !item.closed)
    .map((card) => normalizeTrelloCard(card, customFields, snapshot, requestedAthleteEmail))

  return {
    board,
    integration: {
      requestedAthleteEmail: normalizeEmail(requestedAthleteEmail) || null,
      requiredKey: 'athleteEmail',
    },
    lists: openLists
      .sort((a, b) => a.pos - b.pos)
      .map((list) => ({
        ...list,
        cards: openCards.filter((card) => card.idList === list.id),
      })),
    totals: {
      lists: openLists.length,
      cards: openCards.length,
      cardsMissingAthleteEmail: openCards.filter(
        (card) => !card.integration.hasRequiredAthleteEmail
      ).length,
    },
  }
}

function buildTrainingPlanPayload(url) {
  return { trainingPlan: { planId: `PLACEHOLDER_${url.searchParams.get('phaseCode') || 'UNDEFINED'}` } }
}

async function buildRealTrainingPlanPayload(url) {
  const snapshot = await loadSnapshotFromDisk()
  const identity = resolveAthleteIdentity(snapshot, url)
  const athleteName = identity.athleteName
  const athleteEmail = identity.athleteEmail
  const athleteView = buildBackendAthleteView(snapshot, athleteName, athleteEmail)
  const trainingLibrary = await loadTrainingLibraryEntries()

  if (!athleteView) {
    return {
      trainingPlan: {
        planId: 'UNDEFINED_PLAN',
        athleteId: athleteName,
        athleteName,
        athleteEmail,
        modality: null,
        levelCode: null,
        generatedAt: new Date().toISOString(),
        generatedBy: 'ADMIN_BACKEND',
        status: 'DRAFT',
        periodization: {
          mesocycleCode: url.searchParams.get('mesocycleCode') || 'UNDEFINED',
          microcycleCode: url.searchParams.get('microcycleCode') || 'UNDEFINED',
          phaseCode: url.searchParams.get('phaseCode') || 'UNDEFINED',
          eventCode: url.searchParams.get('eventCode') || 'UNDEFINED',
          targetType: url.searchParams.get('targetType') || 'ALL',
          parameterCode: url.searchParams.get('parameterCode') || 'ALL',
        },
        context: {
          hciScore: null,
          priorityParameters: [],
          criticalParameter: null,
          constraints: [],
          trelloBoardRefs: PLAN_TRELLO_BOARDS,
        },
        engineRecommendations: [],
        coachPrescriptions: [],
        prescribedTrainings: [],
        decisionTrace: [],
        clickableTrainingDetails: [],
      },
      debug: {
        athleteFound: false,
      },
    }
  }

  const coachInput = {
    mesocycleCode: url.searchParams.get('mesocycleCode') || 'UNDEFINED',
    microcycleCode: url.searchParams.get('microcycleCode') || 'UNDEFINED',
    phaseCode: url.searchParams.get('phaseCode') || 'UNDEFINED',
    eventCode: url.searchParams.get('eventCode') || 'UNDEFINED',
    targetType: url.searchParams.get('targetType') || 'ALL',
    parameterCode: url.searchParams.get('parameterCode') || 'ALL',
  }

  const engineInput = buildTrainingPlanEngineInput({
    athleteView,
    coachInput,
    trainingLibrary,
  })

  const output = buildTrainingPlanOutput(engineInput)
  const trainingPlan = output.trainingPlan
  trainingPlan.athleteEmail = athleteEmail || athleteView.athlete?.email || null

  trainingPlan.context = {
    ...trainingPlan.context,
    hciScore: athleteView.summary?.hci ?? null,
    priorityParameters:
      trainingPlan.context.priorityParameters?.length > 0
        ? trainingPlan.context.priorityParameters
        : (athleteView.indices?.allParameters || []).slice(0, 3).map((item) => item.parameterCode),
    criticalParameter:
      trainingPlan.context.criticalParameter ||
      athleteView.athleteSelfAnalysis?.criticalParameter?.code ||
      null,
    constraints: trainingPlan.context.constraints || [],
    trelloBoardRefs: PLAN_TRELLO_BOARDS,
  }

  return {
    ...output,
    debug: {
      athleteFound: true,
      athleteEmail,
      athleteName,
      libraryEntries: trainingLibrary.length,
      engineRecommendations: trainingPlan.engineRecommendations.length,
    },
  }
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    writeJson(response, 400, { error: 'BAD_REQUEST' })
    return
  }

  const url = new URL(request.url, `http://${request.headers.host}`)

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    response.end()
    return
  }

  if (url.pathname === '/health') {
    writeJson(response, 200, { ok: true, service: 'admin-backend' })
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/trello/board') {
    const shortLink = url.searchParams.get('shortLink') || ''
    const athleteEmail = url.searchParams.get('athleteEmail') || ''

    if (!shortLink) {
      writeJson(response, 400, { error: 'SHORT_LINK_REQUIRED' })
      return
    }

    try {
      const snapshot = await loadTrelloBoardSnapshot(shortLink, athleteEmail)

      if (snapshot.error === 'TRELLO_NOT_CONFIGURED') {
        writeJson(response, 503, snapshot)
        return
      }

      writeJson(response, 200, snapshot)
    } catch (error) {
      writeJson(response, 502, {
        error: 'ADMIN_BACKEND_TRELLO_FAILED',
        message: error instanceof Error ? error.message : 'Unknown admin backend error',
      })
    }
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/plan') {
    try {
      const payload = await buildRealTrainingPlanPayload(url)
      writeJson(response, 200, payload)
    } catch (error) {
      writeJson(response, 500, {
        error: 'ADMIN_BACKEND_PLAN_FAILED',
        message: error instanceof Error ? error.message : 'Unknown plan backend error',
      })
    }
    return
  }

  writeJson(response, 404, { error: 'NOT_FOUND' })
})

server.listen(PORT, () => {
  console.log(`Admin backend listening on http://localhost:${PORT}`)
})
