const DB_NAME = 'HCI_TRAINING_LIBRARY_DB'
const DB_VERSION = 1
const STORE_NAME = 'hci_training_library'

let cachedCustomEntries = []

export function getCachedCustomTrainingEntries() {
  return cachedCustomEntries
}

export async function loadCustomTrainingEntries() {
  const database = await openDatabase()

  try {
    const entries = await new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : [])
      request.onerror = () => reject(request.error)
    })

    cachedCustomEntries = entries
    return entries
  } finally {
    database.close()
  }
}

export async function saveCustomTrainingEntry(entry) {
  const database = await openDatabase()
  const normalizedEntry = {
    ...entry,
    active: true,
    isCustom: true,
    updatedAt: Date.now(),
    createdAt: entry.createdAt || Date.now(),
  }

  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(normalizedEntry)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    cachedCustomEntries = [
      ...cachedCustomEntries.filter((item) => item.trainingId !== normalizedEntry.trainingId),
      normalizedEntry,
    ]
    return normalizedEntry
  } finally {
    database.close()
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'trainingId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
