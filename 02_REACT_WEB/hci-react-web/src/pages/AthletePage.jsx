import HappySelfAnalysisCard, {
  mapResponsesArrayToObject,
} from '../components/HappySelfAnalysisCard'

function AthletePage({
  athleteView,
  athletes = [],
  selectedAthlete,
  onAthleteChange,
  lang = 'pt',
}) {
  const t = getAthleteTranslations(lang)
  const selfAnalysis = athleteView?.athleteSelfAnalysis || {}
  const dimensions = selfAnalysis.dimensions || []
  const responses = selfAnalysis.responses || []
  const developmentPlan = selfAnalysis.developmentPlan || []
  const topGaps = selfAnalysis.topGaps || []
  const responseMap = mapResponsesArrayToObject(responses)
  const athleteMessage = athleteView?.athleteSelfAnalysis?.athleteMessage || ''
  const coachNote = athleteView?.athleteSelfAnalysis?.coachNote || ''

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <small>HCI HAPPY</small>
          <h1>{t.pageTitle}</h1>
        </div>
      </header>

      <section className="panel selector-panel">
        <h2>{t.selectAthlete}</h2>

        <div className="selector-row">
          <select
            value={selectedAthlete || ''}
            onChange={(event) => onAthleteChange?.(event.target.value)}
          >
            {athletes.map((athlete) => (
              <option key={athlete} value={athlete}>
                {athlete}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="cards">
        <div className="card">
          <span>{t.athlete}</span>
          <strong className="small-value">{athleteView?.athlete?.name || '-'}</strong>
        </div>
        <div className="card">
          <span>{t.status}</span>
          <strong className="small-value">{selfAnalysis.sourceStatus || '-'}</strong>
        </div>
        <div className="card">
          <span>{t.primaryGap}</span>
          <strong>{selfAnalysis.criticalParameter?.code || '-'}</strong>
        </div>
        <div className="card">
          <span>{t.severity}</span>
          <strong>{selfAnalysis.severityBand || '-'}</strong>
        </div>
      </section>

      <section className="panel">
        <h2>{t.overview}</h2>

        {selfAnalysis.sourceStatus !== 'READY' ? (
          <p style={{ padding: 16, margin: 0 }}>{t.pendingMessage}</p>
        ) : (
          <div className="happy-two-column">
            <HappyRadarCard dimensions={dimensions} />
            <div className="happy-summary-stack">
              <HappyTopGapPanel topGaps={topGaps} lang={lang} />
              <HappyCriticalCard selfAnalysis={selfAnalysis} lang={lang} />
            </div>
          </div>
        )}
      </section>

      <HappySelfAnalysisCard
        title={t.responses}
        responses={responseMap}
        athleteMessage={athleteMessage}
        coachNote={coachNote}
      />

      <section className="panel">
        <h2>{t.dimensionDetails}</h2>

        {dimensions.length === 0 ? (
          <p style={{ padding: 16, margin: 0 }}>{t.pendingMessage}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t.dimension}</th>
                <th>{t.score}</th>
                <th>{t.mainContributors}</th>
              </tr>
            </thead>
            <tbody>
              {dimensions.map((dimension) => (
                <tr key={dimension.dimensionCode}>
                  <td>{dimension.dimensionCode}</td>
                  <td>{dimension.score}</td>
                  <td>
                    {(dimension.contributors || [])
                      .map((item) => `${item.parameterCode} ${item.value ?? '-'}`)
                      .join(' | ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>{t.developmentPlan}</h2>

        {developmentPlan.length === 0 ? (
          <p style={{ padding: 16, margin: 0 }}>{t.noPlan}</p>
        ) : (
          <div className="happy-plan-grid">
            {developmentPlan.map((item) => (
              <article key={item.exerciseId} className="happy-plan-card">
                <small>{item.exerciseId}</small>
                <h3>{item.name?.[lang === 'en' ? 'en-US' : 'pt-BR']}</h3>
                <p><strong>{t.objective}:</strong> {item.objective?.[lang === 'en' ? 'en-US' : 'pt-BR']}</p>
                <p><strong>{t.howToDo}:</strong> {item.howToDo?.[lang === 'en' ? 'en-US' : 'pt-BR']}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function HappyRadarCard({ dimensions }) {
  if (!dimensions.length) return null

  const size = 360
  const center = size / 2
  const radius = 120
  const angleStep = (Math.PI * 2) / dimensions.length
  const polygonPoints = dimensions
    .map((dimension, index) => {
      const valueRadius = ((Number(dimension.score || 0) || 0) / 5) * radius
      const angle = index * angleStep - Math.PI / 2
      const x = center + valueRadius * Math.cos(angle)
      const y = center + valueRadius * Math.sin(angle)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="happy-chart-card">
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="320">
        {[1, 2, 3, 4, 5].map((step) => (
          <circle
            key={step}
            cx={center}
            cy={center}
            r={(step / 5) * radius}
            fill="none"
            stroke="#dbe3ef"
          />
        ))}

        {dimensions.map((_, index) => {
          const angle = index * angleStep - Math.PI / 2
          const x = center + radius * Math.cos(angle)
          const y = center + radius * Math.sin(angle)

          return (
            <line
              key={index}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="#dbe3ef"
            />
          )
        })}

        <polygon
          points={polygonPoints}
          fill="#0f766e"
          fillOpacity="0.18"
          stroke="#0f766e"
          strokeWidth="3"
        />

        {dimensions.map((dimension, index) => {
          const angle = index * angleStep - Math.PI / 2
          const labelX = center + (radius + 26) * Math.cos(angle)
          const labelY = center + (radius + 26) * Math.sin(angle)
          const pointRadius = ((Number(dimension.score || 0) || 0) / 5) * radius
          const pointX = center + pointRadius * Math.cos(angle)
          const pointY = center + pointRadius * Math.sin(angle)

          return (
            <g key={dimension.dimensionCode}>
              <circle cx={pointX} cy={pointY} r="4.5" fill="#0f766e" />
              <text
                x={labelX}
                y={labelY}
                fontSize="10"
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#334155"
              >
                {dimension.dimensionCode}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function HappyTopGapPanel({ topGaps, lang }) {
  const title = lang === 'en' ? 'Top gaps' : 'Top gaps'
  if (!topGaps.length) {
    return null
  }

  return (
    <div className="happy-side-card">
      <h3>{title}</h3>
      <div className="happy-tag-list">
        {topGaps.map((gap) => (
          <span key={gap.dimensionCode} className="happy-tag">
            {gap.dimensionCode} {gap.score}
          </span>
        ))}
      </div>
    </div>
  )
}

function HappyCriticalCard({ selfAnalysis, lang }) {
  const t = getAthleteTranslations(lang)

  return (
    <div className="happy-side-card">
      <h3>{t.primaryGap}</h3>
      <p style={{ margin: 0 }}>
        <strong>{selfAnalysis.criticalParameter?.code || '-'}</strong>
      </p>
      <p style={{ margin: '8px 0 0' }}>
        {t.severity}: {selfAnalysis.severityBand || '-'}
      </p>
    </div>
  )
}

function getAthleteTranslations(lang) {
  if (lang === 'en') {
    return {
      pageTitle: 'Athlete Self Analysis',
      selectAthlete: 'Select athlete',
      athlete: 'Athlete',
      status: 'Status',
      primaryGap: 'Primary gap',
      severity: 'Severity',
      overview: 'HAPPY overview',
      responses: 'Athlete responses',
      dimensionDetails: 'Dimension details',
      developmentPlan: 'Development plan',
      pendingMessage:
        'Athlete self-analysis has not been exported yet. This page is live and waiting for the Admin HAPPY payload.',
      noPlan: 'No development plan available yet.',
      objective: 'Objective',
      howToDo: 'How to do',
      dimension: 'Dimension',
      score: 'Score',
      mainContributors: 'Main contributors',
    }
  }

  return {
    pageTitle: 'Auto Analise do Atleta',
    selectAthlete: 'Selecionar atleta',
    athlete: 'Atleta',
    status: 'Status',
    primaryGap: 'Gap principal',
    severity: 'Severidade',
    overview: 'Visao geral HAPPY',
    responses: 'Respostas do atleta',
    dimensionDetails: 'Detalhes das dimensoes',
    developmentPlan: 'Plano de desenvolvimento',
    pendingMessage:
      'A auto analise do atleta ainda nao foi exportada. Esta pagina ja esta pronta e aguardando o payload HAPPY do Admin.',
    noPlan: 'Ainda nao ha plano de desenvolvimento disponivel.',
    objective: 'Objetivo',
    howToDo: 'Como fazer',
    dimension: 'Dimensao',
    score: 'Score',
    mainContributors: 'Principais contribuintes',
  }
}

export default AthletePage
