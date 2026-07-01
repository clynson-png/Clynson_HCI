import { useEffect, useMemo, useState } from 'react'
import TaurusSmartChart from '../components/taurus/TaurusSmartChart'
import PremiumLockedAction from '../components/reports/PremiumLockedAction'
import { loadTaurusTargetSessions } from '../services/taurusTargetStore'

function TaurusSmartChartPage({ athletes = [], selectedAthlete, onAthleteChange, lang = 'pt', subscriptionAccess = {} }) {
  const [sessions, setSessions] = useState([])
  const canViewSmartChart = !!subscriptionAccess.canViewSmartChart

  useEffect(() => {
    if (!canViewSmartChart) {
      setSessions([])
      return undefined
    }

    let cancelled = false

    async function loadSessions() {
      const nextSessions = await loadTaurusTargetSessions()

      if (!cancelled) {
        setSessions(nextSessions)
      }
    }

    loadSessions()

    return () => {
      cancelled = true
    }
  }, [canViewSmartChart])

  const athleteOptions = useMemo(() => {
    const fromSessions = sessions
      .map((session) => session.athleteName)
      .filter(Boolean)

    return Array.from(new Set([...athletes, ...fromSessions])).sort((a, b) =>
      a.localeCompare(b)
    )
  }, [athletes, sessions])

  const currentAthlete = selectedAthlete || athleteOptions[0] || ''

  const approvedSessions = useMemo(() => {
    if (!canViewSmartChart) return []

    return sessions.filter(
      (session) =>
        session.athleteName === currentAthlete &&
        session.workflowStatus === 'APPROVED'
    )
  }, [sessions, currentAthlete, canViewSmartChart])

  if (!canViewSmartChart) {
    return (
      <main className="dashboard taurus-page">
        <section className="smart-chart-locked-state">
          <div>
            <span>Smart Chart Premium</span>
            <h1>Smart Chart</h1>
            <p>
              A visualizacao Smart Chart e exclusiva para atletas com plano premium.
            </p>
          </div>
          <PremiumLockedAction
            lockedLabel="Smart Chart"
            description="Smart Chart e um recurso premium."
            allowed={false}
          />
        </section>
      </main>
    )
  }

  return (
    <main className="dashboard taurus-page">
      <TaurusSmartChart
        sessions={approvedSessions}
        athleteName={currentAthlete}
        lang={lang}
        subscriptionAccess={subscriptionAccess}
      />
    </main>
  )
}

export default TaurusSmartChartPage
