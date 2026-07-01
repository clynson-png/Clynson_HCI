import { TAURUS_TARGET_SCHEMA_V1 } from './taurusTargetSchema'

const DB_NAME = TAURUS_TARGET_SCHEMA_V1.database.name
const DB_VERSION = TAURUS_TARGET_SCHEMA_V1.database.version
const META_STORE = 'meta'
const SESSION_STORE = 'taurus_target_session'
const HIT_STORE = 'taurus_target_hit'

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: 'key' })
      }

      if (!database.objectStoreNames.contains(SESSION_STORE)) {
        database.createObjectStore(SESSION_STORE, { keyPath: 'sessionId' })
      }

      if (!database.objectStoreNames.contains(HIT_STORE)) {
        database.createObjectStore(HIT_STORE, { keyPath: 'hitId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function closeDatabase(database) {
  if (database) database.close()
}

export async function loadTaurusTargetSessions() {
  const database = await openDatabase()

  try {
    const transaction = database.transaction([SESSION_STORE, HIT_STORE], 'readonly')
    const sessions = await requestToPromise(transaction.objectStore(SESSION_STORE).getAll())
    const hits = await requestToPromise(transaction.objectStore(HIT_STORE).getAll())

    return sessions
      .map((session) => ({
        ...session,
        workflowStatus: session.workflowStatus || 'PENDING',
        hits: hits
          .filter((hit) => hit.sessionId === session.sessionId)
          .sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0)),
      }))
      .sort((a, b) => Number(b.recordedAt || 0) - Number(a.recordedAt || 0))
  } finally {
    closeDatabase(database)
  }
}

export async function saveTaurusTargetSession(session) {
  const database = await openDatabase()

  try {
    const transaction = database.transaction([SESSION_STORE, HIT_STORE], 'readwrite')
    const sessionStore = transaction.objectStore(SESSION_STORE)
    const hitStore = transaction.objectStore(HIT_STORE)

    await requestToPromise(
      sessionStore.put({
        sessionId: session.sessionId,
        athleteName: session.athleteName,
        targetType: session.targetType,
        sessionMode: session.sessionMode || null,
        sessionLabel: session.sessionLabel,
        notes: session.notes,
        maxShots: session.maxShots,
        maxScore: session.maxScore || null,
        totalShots: session.totalShots,
        durationSeconds: session.durationSeconds ?? null,
        durationSource: session.durationSource || null,
        totalScore: session.totalScore ?? null,
        shotDetailsJson: session.shotDetailsJson || null,
        recordedAt: session.recordedAt,
        updatedAt: session.updatedAt,

        workflowStatus: session.workflowStatus || 'PENDING',
        createdAt: session.createdAt || session.recordedAt,
        createdBy: session.createdBy || 'TAURUS',
        approvedAt: session.approvedAt || null,
        approvedBy: session.approvedBy || null,
        archivedAt: session.archivedAt || null,
        archivedBy: session.archivedBy || null,
      })
    )

    const existingHits = await requestToPromise(hitStore.getAll())
    const staleHits = existingHits.filter((item) => item.sessionId === session.sessionId)

    for (const hit of staleHits) {
      await requestToPromise(hitStore.delete(hit.hitId))
    }

    for (const hit of session.hits || []) {
      await requestToPromise(
        hitStore.put({
          hitId: `${session.sessionId}_${hit.zoneCode}`,
          sessionId: session.sessionId,
          zoneCode: hit.zoneCode,
          zoneLabel: hit.zoneLabel,
          hitCount: hit.hitCount,
          displayOrder: hit.displayOrder,
          metaJson: hit.metaJson || null,
        })
      )
    }
  } finally {
    closeDatabase(database)
  }
}

export async function updateTaurusTargetSessionWorkflow(sessionId, workflowStatus, metadata = {}) {
  const database = await openDatabase()

  try {
    const transaction = database.transaction([SESSION_STORE], 'readwrite')
    const sessionStore = transaction.objectStore(SESSION_STORE)
    const session = await requestToPromise(sessionStore.get(sessionId))

    if (!session) return null

    const nextSession = {
      ...session,
      workflowStatus,
      updatedAt: Date.now(),
      ...metadata,
    }

    await requestToPromise(sessionStore.put(nextSession))

    return nextSession
  } finally {
    closeDatabase(database)
  }
}

export async function deleteTaurusTargetSession(sessionId) {
  const database = await openDatabase()

  try {
    const transaction = database.transaction([SESSION_STORE, HIT_STORE], 'readwrite')
    const sessionStore = transaction.objectStore(SESSION_STORE)
    const hitStore = transaction.objectStore(HIT_STORE)

    await requestToPromise(sessionStore.delete(sessionId))

    const hits = await requestToPromise(hitStore.getAll())
    const staleHits = hits.filter((hit) => hit.sessionId === sessionId)

    for (const hit of staleHits) {
      await requestToPromise(hitStore.delete(hit.hitId))
    }
  } finally {
    closeDatabase(database)
  }
}
