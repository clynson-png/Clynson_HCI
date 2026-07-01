const DB_NAME = 'HCI_UNIFIED_DB_V1'
const DB_VERSION = 3
const META_STORE = 'meta'
const TABLE_STORES = [
  'leads',
  'pendingGroups',
  'approvedSubmissions',
  'shotSeries',
  'archivedIssfSessions',
  'prescriptions',
  'athlete360',
  'athletes',
  'sessionHeaders',
  'sessionSeries',
  'sessionShots',
  'unifiedPrescriptions',
  'athleteViewCache',
]
const LEGACY_REMOVED_STORES = [
  'targetSessions',
  'approvedTargetSessions',
  'archivedTargetSessions',
  'unifiedTargetSessions',
]

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result

      LEGACY_REMOVED_STORES.forEach((storeName) => {
        if (database.objectStoreNames.contains(storeName)) {
          database.deleteObjectStore(storeName)
        }
      })

      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: 'key' })
      }

      TABLE_STORES.forEach((storeName) => {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath: '__id' })
        }
      })
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function clearStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

function putRecord(store, record) {
  return new Promise((resolve, reject) => {
    const request = store.put(record)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

function getRecord(store, key) {
  return new Promise((resolve, reject) => {
    const request = store.get(key)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

function getAllRecords(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

function closeDatabase(database) {
  if (database) {
    database.close()
  }
}

function withIdentity(rows, prefix) {
  return (rows || []).map((row, index) => ({
    __id:
      row?.leadId ||
      row?.key ||
      row?.submissionId ||
      row?.chaveSerie ||
      row?.sessionId ||
      row?.sessionKey ||
      row?.trainingId ||
      row?.athleteId ||
      row?.seriesId ||
      row?.shotId ||
      row?.targetSessionId ||
      row?.prescriptionId ||
      row?.athlete ||
      `${prefix}_${index}`,
    ...row,
  }))
}

function stripIdentity(rows) {
  return (rows || []).map(({ __id, ...row }) => row)
}

export async function loadActiveSnapshotFromDatabase() {
  const database = await openDatabase()

  try {
    const transaction = database.transaction([META_STORE, ...TABLE_STORES], 'readonly')
    const metaStore = transaction.objectStore(META_STORE)
    const collectionsRecord = await getRecord(metaStore, 'collections')

    if (!collectionsRecord?.value) {
      return null
    }

    const readableCollections = collectionsRecord.value.filter((storeName) =>
      TABLE_STORES.includes(storeName)
    )

    const snapshot = {}

    await Promise.all(
      readableCollections.map(async (storeName) => {
        const rows = await getAllRecords(transaction.objectStore(storeName))
        snapshot[storeName] = stripIdentity(rows)
      })
    )

    const dismissedPendingApprovalKeysRecord = await getRecord(metaStore, 'dismissedPendingApprovalKeys')
    const migratedAtRecord = await getRecord(metaStore, 'migratedAt')

    if (dismissedPendingApprovalKeysRecord?.value) {
      snapshot.dismissedPendingApprovalKeys = dismissedPendingApprovalKeysRecord.value
    }

    if (migratedAtRecord?.value) {
      snapshot._storage = {
        type: 'indexeddb',
        migratedAt: migratedAtRecord.value,
      }
    }

    return snapshot
  } finally {
    closeDatabase(database)
  }
}

export async function saveActiveSnapshotToDatabase(snapshot) {
  const database = await openDatabase()

  try {
    const transaction = database.transaction([META_STORE, ...TABLE_STORES], 'readwrite')

    await Promise.all(
      TABLE_STORES.map(async (storeName) => {
        const store = transaction.objectStore(storeName)
        await clearStore(store)
        const rows = withIdentity(snapshot?.[storeName] || [], storeName)

        for (const row of rows) {
          await putRecord(store, row)
        }
      })
    )

    const metaStore = transaction.objectStore(META_STORE)
    await putRecord(metaStore, { key: 'collections', value: TABLE_STORES })
    await putRecord(metaStore, {
      key: 'dismissedPendingApprovalKeys',
      value: snapshot?.dismissedPendingApprovalKeys || [],
    })
    await putRecord(metaStore, { key: 'migratedAt', value: Date.now() })
  } finally {
    closeDatabase(database)
  }
}
