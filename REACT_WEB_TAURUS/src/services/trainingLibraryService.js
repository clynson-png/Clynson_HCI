import trainingLibrary from '../data/training_library_canonical.json'
import { getCachedCustomTrainingEntries } from './trainingLibraryCustomStore'

const HCI_109_ENTRY = {
  trainingId: 'HCI_109_SIGHT_RHYTHM_CORE',
  targetType: 'HCI_109',
  category: 'HCI_109',
  parameter: 'HCI_109',
  phase: 'SPECIFIC_PREPARATION',
  level: 'INTERMEDIATE',
  weaponClass: 'PISTOL',
  name: {
    'pt-BR': 'HCI_109 - Estrutura Base',
    'en-US': 'HCI_109 - Core Structure',
  },
  objective: {
    'pt-BR': 'Abrir a simulação HCI_109 dentro da Library.',
    'en-US': 'Open the HCI_109 simulation inside the Library.',
  },
  description: {
    'pt-BR': 'Treino HCI_109 com modo Ritmo e Visada.',
    'en-US': 'HCI_109 training with Rhythm and Sight modes.',
  },
  executionSummary: {
    'pt-BR': 'Selecione HCI_109 e abra Ritmo ou Visada.',
    'en-US': 'Select HCI_109 and open Rhythm or Sight.',
  },
  loadNote: {
    'pt-BR': 'Carga visual e técnica definida pelo treino.',
    'en-US': 'Visual and technical load defined by the training.',
  },
}

export function getTrainingLibraryEntries() {
  return [
    HCI_109_ENTRY,
    ...(trainingLibrary?.entries || []),
    ...getCachedCustomTrainingEntries(),
  ]
}

export function getLibraryCollections() {
  return [
    {
      id: 'TECHNICAL_LIBRARY',
      title: 'Technical Library',
      itemLabel: 'trainings',
      entries: getTrainingLibraryEntries(),
    },
  ]
}

export function getTrainingLibraryStats() {
  const technicalEntries = getTrainingLibraryEntries()

  return {
    totalTrainings: technicalEntries.length,
    firstTraining: technicalEntries[0]?.trainingId || null,
    totalHappyExercises: 0,
    firstHappyExercise: null,
    totalHappyRules: 0,
    firstHappyRule: null,
  }
}

export function getTrainingById(trainingId) {
  return getTrainingLibraryEntries().find(
    (item) => item.trainingId === trainingId
  )
}

export function getHappyExerciseById() {
  return null
}

export function getHappyPrescriptionRuleByParameter() {
  return null
}
