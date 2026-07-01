const DB_NAME = 'HCI_109_SESSION_DB_V1'
const DB_VERSION = 1
const SESSION_STORE = 'hci109_session'

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(SESSION_STORE)) {
        database.createObjectStore(SESSION_STORE, { keyPath: 'sessionId' })
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

export async function saveHci109Session(session) {
  const database = await openDatabase()

  try {
    const transaction = database.transaction([SESSION_STORE], 'readwrite')
    await requestToPromise(transaction.objectStore(SESSION_STORE).put(session))
  } finally {
    closeDatabase(database)
  }
}

export async function updateHci109SessionWorkflow(sessionId, workflowStatus, extraFields = {}) {
  const database = await openDatabase()

  try {
    const transaction = database.transaction([SESSION_STORE], 'readwrite')
    const store = transaction.objectStore(SESSION_STORE)
    const currentSession = await requestToPromise(store.get(sessionId))

    if (!currentSession) return null

    const updatedSession = {
      ...currentSession,
      ...extraFields,
      workflowStatus,
      reviewFlag: workflowStatus === 'APPROVED'
        ? 'ADMIN_APPROVED'
        : workflowStatus === 'REJECTED'
          ? 'ADMIN_REJECTED'
          : currentSession.reviewFlag,
      updatedAt: Date.now(),
    }

    await requestToPromise(store.put(updatedSession))
    return updatedSession
  } finally {
    closeDatabase(database)
  }
}

export async function deleteHci109Session(sessionId) {
  const database = await openDatabase()

  try {
    const transaction = database.transaction([SESSION_STORE], 'readwrite')
    await requestToPromise(transaction.objectStore(SESSION_STORE).delete(sessionId))
  } finally {
    closeDatabase(database)
  }
}

export async function loadHci109Sessions() {
  const database = await openDatabase()

  try {
    const transaction = database.transaction([SESSION_STORE], 'readonly')
    const sessions = await requestToPromise(transaction.objectStore(SESSION_STORE).getAll())

    return sessions.sort((a, b) => Number(b.recordedAt || 0) - Number(a.recordedAt || 0))
  } finally {
    closeDatabase(database)
  }
}
