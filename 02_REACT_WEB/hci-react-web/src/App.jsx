import { useEffect, useState } from 'react'
import { mapSnapshotToAthleteView } from './services/athleteViewMapper'
import { getSnapshot } from './services/api'
import {
  loadActiveSnapshotFromDatabase,
  saveActiveSnapshotToDatabase,
} from './services/activeSnapshotStore'
import { normalizeSnapshotToUnifiedSchema } from './services/unifiedSnapshotSchema'
import DashboardResumo from './pages/DashboardResumo'
import IndicesPage from './pages/IndicesPage'
import PlanoPage from './pages/PlanoPage'
import MainLayout from './layouts/MainLayout'
import AdminPage from './pages/AdminPage'
import LibraryPage from './pages/LibraryPage'
import RhythmPage from './pages/RhythmPage'
import TaurusTargetPage from './pages/TaurusTargetPage'
import ReportPage from './pages/ReportPage'
import AthletePage from './pages/AthletePage'
import CrossAnalysisPage from './pages/CrossAnalysisPage'
import { buildDirectionalReportFromSnapshot } from './services/reportGenerationEngine'

function App() {
  const [snapshot, setSnapshot] = useState(null)
  const [activeSnapshot, setActiveSnapshot] = useState(null)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState('Resumo')
  const [selectedAthlete, setSelectedAthlete] = useState('')
  const [generatedReport, setGeneratedReport] = useState(null)
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('hci_lang') || 'pt'
  })

  useEffect(() => {
    let cancelled = false

    async function loadApplicationState() {
      try {
        const [baseSnapshot, databaseSnapshot] = await Promise.all([
          getSnapshot(),
          loadActiveSnapshotFromDatabase(),
        ])

        if (cancelled) {
          return
        }

        setSnapshot(baseSnapshot)

        if (databaseSnapshot) {
          setActiveSnapshot(normalizeSnapshotToUnifiedSchema(databaseSnapshot))
          return
        }

        let migratedSnapshot = null

        try {
          const saved = localStorage.getItem('HCI_ACTIVE_SNAPSHOT_V1')
          migratedSnapshot = saved ? JSON.parse(saved) : null
        } catch {
          migratedSnapshot = null
        }

        const initialSnapshot = normalizeSnapshotToUnifiedSchema(migratedSnapshot || baseSnapshot)

        setActiveSnapshot(initialSnapshot)
        await saveActiveSnapshotToDatabase(initialSnapshot)

        if (migratedSnapshot) {
          localStorage.removeItem('HCI_ACTIVE_SNAPSHOT_V1')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
        }
      }
    }

    loadApplicationState()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleSnapshotImported(nextSnapshot) {
    const normalizedSnapshot = normalizeSnapshotToUnifiedSchema(nextSnapshot)
    await saveActiveSnapshotToDatabase(normalizedSnapshot)
    setActiveSnapshot(normalizedSnapshot)
  }

  async function handleActiveSnapshotChange(nextSnapshot) {
    const normalizedSnapshot = normalizeSnapshotToUnifiedSchema(nextSnapshot)
    await saveActiveSnapshotToDatabase(normalizedSnapshot)
    setActiveSnapshot(normalizedSnapshot)
  }

  function handleGenerateReportFromAdmin(options) {
    const report = buildDirectionalReportFromSnapshot(activeSnapshot, options)
    setGeneratedReport(report)
    setCurrentPage('Relatorio')
  }

  function handleToggleLang() {
    setLang((current) => {
      const nextLang = current === 'pt' ? 'en' : 'pt'
      localStorage.setItem('hci_lang', nextLang)
      return nextLang
    })
  }

  if (error) return <p className="error">Erro: {error}</p>
  if (!snapshot || !activeSnapshot) return <p>Carregando snapshot...</p>

  const athletes = Array.from(
    new Set([
      ...((activeSnapshot?.leads || []).map((item) => item.athleteName).filter(Boolean)),
      ...((activeSnapshot?.athlete360 || []).map((item) => item.athlete).filter(Boolean)),
    ])
  ).sort((a, b) => a.localeCompare(b))
  const activeAthlete = selectedAthlete || athletes[0] || null

  const athleteView = activeAthlete
    ? mapSnapshotToAthleteView(activeSnapshot, activeAthlete)
    : null

  return (
    <MainLayout
      currentPage={currentPage}
      onChangePage={setCurrentPage}
      lang={lang}
      onToggleLang={handleToggleLang}
    >
      {currentPage === 'Resumo' && (
        <DashboardResumo
          snapshot={activeSnapshot}
          lang={lang}
          athletes={athletes}
          selectedAthlete={activeAthlete}
          onAthleteChange={setSelectedAthlete}
        />
      )}

      {currentPage === 'Indices' && (
        <IndicesPage
          activeSnapshot={activeSnapshot}
          lang={lang}
          athletes={athletes}
          selectedAthlete={activeAthlete}
          onAthleteChange={setSelectedAthlete}
        />
      )}

      {currentPage === 'Plano' && (
        <PlanoPage
          snapshot={activeSnapshot}
          onActiveSnapshotChange={handleActiveSnapshotChange}
          lang={lang}
          athletes={athletes}
          selectedAthlete={activeAthlete}
          onAthleteChange={setSelectedAthlete}
        />
      )}

      {currentPage === 'Athlete' && (
        <AthletePage
          athleteView={athleteView}
          lang={lang}
          athletes={athletes}
          selectedAthlete={activeAthlete}
          onAthleteChange={setSelectedAthlete}
        />
      )}

      {currentPage === 'CrossAnalysis' && (
        <CrossAnalysisPage
          athleteView={athleteView}
          lang={lang}
          athletes={athletes}
          selectedAthlete={activeAthlete}
          onAthleteChange={setSelectedAthlete}
        />
      )}

      {currentPage === 'Admin' && (
        <AdminPage
          activeSnapshot={activeSnapshot}
          onSnapshotImported={handleSnapshotImported}
          onActiveSnapshotChange={handleActiveSnapshotChange}
          onGenerateReport={handleGenerateReportFromAdmin}
          lang={lang}
          athletes={athletes}
          selectedAthlete={activeAthlete}
          onAthleteChange={setSelectedAthlete}
        />
      )}

      {currentPage === 'Taurus' && (
        <TaurusTargetPage
          athletes={athletes}
          selectedAthlete={activeAthlete}
          onAthleteChange={setSelectedAthlete}
        />
      )}

      {currentPage === 'Relatorio' && (
        <ReportPage
          activeSnapshot={activeSnapshot}
          onActiveSnapshotChange={handleActiveSnapshotChange}
          generatedReport={generatedReport}
          selectedAthlete={activeAthlete}
          onAthleteChange={setSelectedAthlete}
        />
      )}

      {currentPage === 'Library' && (
        <LibraryPage
          snapshot={activeSnapshot}
          lang={lang}
          athletes={athletes}
          selectedAthlete={activeAthlete}
          onAthleteChange={setSelectedAthlete}
        />
      )}

      {currentPage === 'Ritmo' && (
        <RhythmPage
          athleteView={athleteView}
          lang={lang}
          athletes={athletes}
          selectedAthlete={activeAthlete}
          onAthleteChange={setSelectedAthlete}
        />
      )}
    </MainLayout>
  )
}

export default App
