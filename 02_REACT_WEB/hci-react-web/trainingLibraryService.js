import trainingLibrary from '../data/training_library_canonical.json'

export function getTrainingLibraryEntries() {
  return trainingLibrary?.entries || []
}

export function getTrainingLibraryStats() {
  const entries = getTrainingLibraryEntries()

  return {
    totalTrainings: entries.length,
    firstTraining: entries[0]?.trainingId || null,
  }
}

export function getTrainingById(trainingId) {
  return getTrainingLibraryEntries().find(
    (item) => item.trainingId === trainingId
  )
}
