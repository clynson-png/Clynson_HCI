function parseSnapshotText(text) {
  try {
    return JSON.parse(text)
  } catch {
    const normalizedText = text.replace(/\\([\[\]_])/g, '$1')
    return JSON.parse(normalizedText)
  }
}

async function readSnapshotFrom(url) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Erro ao carregar snapshot em ${url}`)
  }

  const text = await response.text()
  return parseSnapshotText(text)
}

export async function getSnapshot() {
  try {
    return await readSnapshotFrom('/hci_active_snapshot_v1.json')
  } catch {
    // Legacy backend remains as temporary fallback during the transition.
  }

  return readSnapshotFrom('/api/snapshot')
}
