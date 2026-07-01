import trainingLibrary from '../data/training_library_canonical.json'
import happyLibrary from '../data/hci_happy_library_canonical.json'
import happyPrescription from '../data/hci_happy_prescription_canonical.json'

export function getTrainingLibraryEntries() {
  return trainingLibrary?.entries || []
}

export function getHappyLibraryEntries() {
  return happyLibrary?.entries || []
}

export function getHappyPrescriptionRules() {
  return happyPrescription?.rules || []
}

export function getLibraryCollections() {
  return [
    {
      id: 'TECHNICAL_LIBRARY',
      title: 'Technical Library',
      itemLabel: 'trainings',
      entries: getTrainingLibraryEntries(),
    },
    {
      id: 'HAPPY_LIBRARY',
      title: 'HAPPY / COMANDO Library',
      itemLabel: 'exercises',
      entries: getHappyLibraryEntries(),
    },
    {
      id: 'HAPPY_PRESCRIPTION',
      title: 'HAPPY Prescription Matrix',
      itemLabel: 'rules',
      entries: getHappyPrescriptionRules(),
    },
  ]
}

export function getTrainingLibraryStats() {
  const technicalEntries = getTrainingLibraryEntries()
  const happyEntries = getHappyLibraryEntries()
  const prescriptionRules = getHappyPrescriptionRules()

  return {
    totalTrainings: technicalEntries.length,
    firstTraining: technicalEntries[0]?.trainingId || null,
    totalHappyExercises: happyEntries.length,
    firstHappyExercise: happyEntries[0]?.exerciseId || null,
    totalHappyRules: prescriptionRules.length,
    firstHappyRule: prescriptionRules[0]?.parameter || null,
  }
}

export function getTrainingById(trainingId) {
  return getTrainingLibraryEntries().find(
    (item) => item.trainingId === trainingId
  )
}

export function getHappyExerciseById(exerciseId) {
  return getHappyLibraryEntries().find((item) => item.exerciseId === exerciseId)
}

export function getHappyPrescriptionRuleByParameter(parameter) {
  return getHappyPrescriptionRules().find((item) => item.parameter === parameter)
}
