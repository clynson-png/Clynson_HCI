import { useEffect, useState } from 'react'
import { mapSnapshotToAthleteView } from './services/athleteViewMapper'
import { getSnapshot } from './services/api'
import { loadActiveSnapshotFromDatabase, saveActiveSnapshotToDatabase, } from './services/activeSnapshotStore'
import { normalizeSnapshotToUnifiedSchema } from './services/unifiedSnapshotSchema'
import DashboardResumo from './pages/DashboardResumo'
import IndicesPage from './pages/IndicesPage'
import PlanoPage from './pages/PlanoPage'
import MainLayout from './layouts/MainLayout'
import AdminPage from './pages/AdminPage'
import LibraryPage from './pages/LibraryPage'
import RhythmPage from './pages/RhythmPage'
import TaurusTargetPage from './pages/TaurusTargetPage'
import TaurusSmartChartPage from './pages/TaurusSmartChartPage'
import AthleteLoginPage from './pages/AthleteLoginPage'
import { translations } from './i18n/translations'
import { getStoredAuthSession, loginWithLeadName, logoutAuthSession } from './services/authService'
import PremiumLockedAction from './components/reports/PremiumLockedAction'

function App() {
  const isMobilePortal = typeof window !== 'undefined' && (
    window.location.search.includes('mobile=1') ||
    window.location.pathname.toLowerCase().includes('mobile')
  )
  const [snapshot, setSnapshot] = useState(null)
  const [activeSnapshot, setActiveSnapshot] = useState(null)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(isMobilePortal ? 'Taurus' : 'Resumo')
  const [selectedAthlete, setSelectedAthlete] = useState('')
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('hci_lang') || 'pt'
  })
  const [authSession, setAuthSession] = useState(() => getStoredAuthSession())

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

  function handleToggleLang() {
    setLang((current) => {
      const nextLang = current === 'pt' ? 'en' : 'pt'
      localStorage.setItem('hci_lang', nextLang)
      return nextLang
    })
  }

  function handleLogin(credentials) {
    const nextSession = loginWithLeadName({
      ...credentials,
      snapshot: activeSnapshot,
    })
    setAuthSession(nextSession)
    setSelectedAthlete(nextSession.athleteName)
  }

  function handleLogout() {
    logoutAuthSession()
    setAuthSession(null)
  }

  if (error) return <p className="error">{translations[lang].errorPrefix}: {error}</p>
  if (!snapshot || !activeSnapshot) return <p>{translations[lang].loadingSnapshot}</p>

  const allAthletes = Array.from(
    new Set([
      ...((activeSnapshot?.leads || []).map((item) => item.athleteName).filter(Boolean)),
      ...((activeSnapshot?.athlete360 || []).map((item) => item.athlete).filter(Boolean)),
    ])
  ).sort((a, b) => a.localeCompare(b))

  if (!authSession) {
    return <AthleteLoginPage onLogin={handleLogin} leadOptions={allAthletes} />
  }

  const isAdminSession = !!authSession.access?.canViewLibrary
  const loginAthleteName = authSession.athleteName || null
  const athletes = isAdminSession
    ? allAthletes
    : allAthletes.filter((athleteName) => athleteName === loginAthleteName)
  const activeAthlete = isAdminSession
    ? selectedAthlete || loginAthleteName || athletes[0] || null
    : loginAthleteName
  const handleAthleteChange = isAdminSession ? setSelectedAthlete : () => {}

  const athleteView = activeAthlete
    ? mapSnapshotToAthleteView(activeSnapshot, activeAthlete)
    : null
  const navigationItems = isMobilePortal
    ? [
        { id: 'Resumo', label: 'Entrada' },
        { id: 'Taurus', label: translations[lang].sidebar.taurusTarget },
        { id: 'SmartChart', label: translations[lang].sidebar.smartChart },
        { id: 'Library', label: translations[lang].sidebar.library },
      ]
    : undefined

  function handleChangePage(nextPage) {
    if (isMobilePortal && nextPage === 'Admin') {
      setCurrentPage('Taurus')
      return
    }

    setCurrentPage(nextPage)
  }

  return (
    <MainLayout
      currentPage={currentPage}
      onChangePage={handleChangePage}
      lang={lang}
      onToggleLang={handleToggleLang}
      authSession={authSession}
      onLogout={handleLogout}
      navigationItems={navigationItems}
      mobileMode={isMobilePortal}
    >
      {currentPage === 'Resumo' && (
        <DashboardResumo
          snapshot={activeSnapshot}
          lang={lang}
          athletes={athletes}
          selectedAthlete={activeAthlete}
          onAthleteChange={handleAthleteChange}
        />
      )}

      {(currentPage === 'Ãndices' || currentPage === 'Indices') && (
        authSession.access?.canViewIndices ? (
          <IndicesPage
            activeSnapshot={activeSnapshot}
            lang={lang}
            athletes={athletes}
            selectedAthlete={activeAthlete}
            onAthleteChange={handleAthleteChange}
          />
        ) : (
          <AdminFeatureLocked title="Indices" />
        )
      )}

      {currentPage === 'Plano' && (
        authSession.access?.canViewPlan ? (
          <PlanoPage
            snapshot={activeSnapshot}
            lang={lang}
            athletes={athletes}
            selectedAthlete={activeAthlete}
            onAthleteChange={handleAthleteChange}
          />
        ) : (
          <AdminFeatureLocked title="Plano" />
        )
      )}

      {currentPage === 'Admin' && !isMobilePortal && authSession.access?.role === 'ADMIN' && (
        <AdminPage
          activeSnapshot={activeSnapshot}
          onSnapshotImported={handleSnapshotImported}
          onActiveSnapshotChange={handleActiveSnapshotChange}
          lang={lang}
          athletes={athletes}
          selectedAthlete={activeAthlete}
          onAthleteChange={handleAthleteChange}
        />
      )}

      {currentPage === 'Taurus' && (
        <TaurusTargetPage
          lang={lang}
          athletes={athletes}
          selectedAthlete={activeAthlete}
          onAthleteChange={handleAthleteChange}
          subscriptionAccess={authSession.access}
        />
      )}

{currentPage === 'SmartChart' && (
  <TaurusSmartChartPage
    lang={lang}
    athletes={athletes}
    selectedAthlete={activeAthlete}
    onAthleteChange={handleAthleteChange}
    subscriptionAccess={authSession.access}
  />
)}



      {currentPage === 'Library' && (
        authSession.access?.canViewLibrary || authSession.access?.canViewLibraryHci109 || authSession.access?.canViewMobileLibrary ? (
          <LibraryPage
            snapshot={activeSnapshot}
            lang={lang}
            athletes={athletes}
            selectedAthlete={activeAthlete}
            onAthleteChange={handleAthleteChange}
            subscriptionAccess={authSession.access}
          />
        ) : (
          <AdminFeatureLocked title="Biblioteca" />
        )
      )}

      {currentPage === 'Ritmo' && (
        <RhythmPage
          athleteView={athleteView}
          lang={lang}
          athletes={athletes}
          selectedAthlete={activeAthlete}
          onAthleteChange={handleAthleteChange}
        />
      )}
    </MainLayout>
  )
}

function AdminFeatureLocked({ title }) {
  return (
    <main className="dashboard taurus-page">
      <section className="smart-chart-locked-state">
        <div>
          <span>Acesso Admin</span>
          <h1>{title}</h1>
          <p>
            Esta aba e exclusiva para o perfil Admin.
          </p>
        </div>
        <PremiumLockedAction
          lockedLabel={title}
          description={`${title} e uma area exclusiva do Admin.`}
          allowed={false}
        />
      </section>
    </main>
  )
}

export default App

