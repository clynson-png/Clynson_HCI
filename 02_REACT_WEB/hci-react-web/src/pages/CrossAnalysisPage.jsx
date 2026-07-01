function CrossAnalysisPage({
  athleteView,
  athletes = [],
  selectedAthlete,
  onAthleteChange,
  lang = 'pt',
}) {
  const t = getCrossTranslations(lang)
  const crossAnalysis = athleteView?.crossAnalysis || {}
  const selfAnalysis = athleteView?.athleteSelfAnalysis || {}
  const insights = crossAnalysis.insights || []
  const coachActions = crossAnalysis.coachActions || []
  const perceptionReadings = crossAnalysis.perceptionReadings || []
  const objectiveEvidence = crossAnalysis.objectiveEvidence || []
  const dimensions = selfAnalysis.dimensions || []
  const localizedInsights = insights.map((item) => ({
    ...item,
    localizedQuestion: localizeCrossQuestion(item.question, lang),
    localizedDivergence: localizeDivergenceLevel(item.divergenceLevel, lang),
  }))

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
          <strong className="small-value">
            {localizeSourceStatus(crossAnalysis.sourceStatus, lang)}
          </strong>
        </div>
        <div className="card">
          <span>{t.insights}</span>
          <strong>{insights.length}</strong>
        </div>
        <div className="card">
          <span>{t.primaryGap}</span>
          <strong>{selfAnalysis.criticalParameter?.code || '-'}</strong>
        </div>
      </section>

      <section className="panel">
        <h2>{t.mainDashboard}</h2>

        {crossAnalysis.sourceStatus !== 'READY' ? (
          <p style={{ padding: 16, margin: 0 }}>{t.pendingMessage}</p>
        ) : (
          <div className="happy-cross-main-grid">
            <div className="happy-cross-gauge-stack">
              <PremiumGaugePanel
                title={t.parameterClocks}
                subtitle={t.parameterClocksSubtitle}
                items={perceptionReadings.map((item) => ({
                  id: item.parameterCode,
                  label: item.parameterCode,
                  value: item.value,
                  tone: resolveScoreTone(item.value),
                  helper: localizeSourceSystem(item.sourceSystem, lang),
                }))}
              />
              <PremiumGaugePanel
                title={t.crossedClocks}
                subtitle={t.crossedClocksSubtitle}
                items={localizedInsights.slice(0, 8).map((item) => ({
                  id: `${item.perceptionCode}-${item.objectiveCode}`,
                  label: `${item.perceptionCode} x ${item.objectiveCode}`,
                  value: Math.min(5, Math.abs(item.gap) + 1),
                  displayValue: formatCrossGaugeDisplayValue(item.gap),
                  tone: resolveGapDirectionTone(item.gap),
                  helper: formatGapHelper(item.gap, lang),
                }))}
              />
            </div>
            <div className="happy-cross-radar-panel">
              <div className="happy-cross-radar-head">
                <h3>{t.happyRadar}</h3>
                <p>{t.happyRadarSubtitle}</p>
              </div>
              {dimensions.length === 0 ? (
                <p style={{ padding: 16, margin: 0 }}>{t.pendingMessage}</p>
              ) : (
                <HappyRadarCard dimensions={dimensions} />
              )}
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>{t.questionsAndScores}</h2>
        {localizedInsights.length === 0 ? (
          <p style={{ padding: 16, margin: 0 }}>{t.pendingMessage}</p>
        ) : (
          <div className="happy-cross-question-list">
            {localizedInsights.map((item) => (
              <article
                key={`${item.perceptionCode}-${item.objectiveCode}`}
                className="happy-cross-question-card"
              >
                <div className="happy-cross-question-copy">
                  <div className="happy-cross-question-head">
                    <small>{`${item.perceptionCode} x ${item.objectiveCode}`}</small>
                    <strong>{item.localizedDivergence}</strong>
                  </div>
                  <h3>{item.localizedQuestion}</h3>
                </div>
                <div className="happy-cross-question-metrics">
                  <MetricPill label={t.athleteFeels} value={item.athleteFeels} />
                  <MetricPill label={t.dataShows} value={item.dataShows} />
                  <MetricPill
                    label={t.gap}
                    value={item.gap}
                    tone={resolveGapDirectionTone(item.gap)}
                    emphasized
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>{t.rawResults}</h2>

        <div className="happy-collapsible-stack">
          <CollapsiblePanel title={t.coachActions} defaultOpen={false}>
            {coachActions.length === 0 ? (
              <p style={{ margin: 0 }}>{t.noActions}</p>
            ) : (
              <div className="happy-action-list">
                {coachActions.map((action, index) => (
                  <article key={`${action.type}-${index}`} className="happy-action-card">
                    <small>{localizeCoachActionType(action.type, lang)}</small>
                    <p>{localizeCoachActionMessage(action, lang)}</p>
                  </article>
                ))}
              </div>
            )}
          </CollapsiblePanel>

          <CollapsiblePanel title={t.threeLayerView} defaultOpen={false}>
            <div className="happy-three-column">
              <LayerCard
                title={t.layer1}
                rows={perceptionReadings.map((item) => ({
                  label: item.parameterCode,
                  value: item.value,
                }))}
              />
              <LayerCard
                title={t.layer2}
                rows={objectiveEvidence.slice(0, 12).map((item) => ({
                  label: formatObjectiveEvidenceLabel(item.parameterCode, lang),
                  value: item.score5,
                }))}
              />
              <LayerCard
                title={t.layer3}
                rows={localizedInsights.slice(0, 8).map((item) => ({
                  label: `${item.perceptionCode} x ${item.objectiveCode}`,
                  value: item.gap,
                }))}
              />
            </div>
          </CollapsiblePanel>

          <CollapsiblePanel title={t.rawEvidence} defaultOpen={false}>
            {objectiveEvidence.length === 0 ? (
              <p style={{ margin: 0 }}>{t.pendingMessage}</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{t.parameter}</th>
                    <th>{t.scoreFive}</th>
                    <th>{t.scoreTen}</th>
                    <th>{t.level}</th>
                  </tr>
                </thead>
                <tbody>
                  {objectiveEvidence.map((item) => (
                    <tr key={`${item.parameterCode}-${item.levelCode || 'na'}`}>
                      <td>{formatObjectiveEvidenceLabel(item.parameterCode, lang)}</td>
                      <td>{roundGaugeValue(item.score5)}</td>
                      <td>{roundGaugeValue(item.score10)}</td>
                      <td>{item.levelCode || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CollapsiblePanel>

          <CollapsiblePanel title={t.rawQuestionTable} defaultOpen={false}>
            {localizedInsights.length === 0 ? (
              <p style={{ margin: 0 }}>{t.pendingMessage}</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{t.question}</th>
                    <th>{t.athleteFeels}</th>
                    <th>{t.dataShows}</th>
                    <th>{t.gap}</th>
                    <th>{t.divergence}</th>
                  </tr>
                </thead>
                <tbody>
                  {localizedInsights.map((item) => (
                    <tr key={`${item.perceptionCode}-${item.objectiveCode}`}>
                      <td>{item.localizedQuestion}</td>
                      <td>{item.athleteFeels}</td>
                      <td>{item.dataShows}</td>
                      <td>{item.gap}</td>
                      <td>{item.localizedDivergence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CollapsiblePanel>
        </div>
      </section>
    </main>
  )
}

function MetricPill({ label, value, tone = 'good', emphasized = false }) {
  return (
    <div
      className={`happy-cross-metric-pill${emphasized ? ` happy-cross-metric-pill-${tone}` : ''}`}
    >
      <span>{label}</span>
      <strong>{roundGaugeValue(value)}</strong>
    </div>
  )
}

function CollapsiblePanel({ title, children, defaultOpen = false }) {
  return (
    <details className="happy-collapsible-panel" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="happy-collapsible-body">{children}</div>
    </details>
  )
}

function LayerCard({ title, rows }) {
  return (
    <div className="happy-layer-card">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p style={{ margin: 0 }}>-</p>
      ) : (
        <div className="happy-layer-list">
          {rows.map((row) => (
            <div key={row.label} className="happy-layer-row">
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
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

function PremiumGaugePanel({ title, subtitle, items }) {
  return (
    <div className="happy-premium-panel">
      <div className="happy-premium-panel-head">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>

      {items.length === 0 ? (
        <p style={{ margin: 0 }}>-</p>
      ) : (
        <div className="happy-premium-grid">
          {items.map((item) => (
            <GaugeCard
              key={item.id}
              label={item.label}
              value={item.value}
              tone={item.tone}
              helper={item.helper}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GaugeCard({ label, value, displayValue, tone, helper }) {
  const numericValue = Number(value || 0)
  const percentage = Math.max(0, Math.min(100, (numericValue / 5) * 100))
  const toneClass = `happy-gauge-${tone}`

  return (
    <article className={`happy-gauge-card ${toneClass}`}>
      <div
        className="happy-gauge-dial"
        style={{
          background: `conic-gradient(var(--gauge-color) ${percentage}%, #e8edf5 ${percentage}% 100%)`,
        }}
      >
        <div className="happy-gauge-center">
          <strong>{displayValue ?? roundGaugeValue(value)}</strong>
          <span>/5</span>
        </div>
      </div>
      <h4>{label}</h4>
      <p>{helper}</p>
    </article>
  )
}

function resolveScoreTone(value) {
  const numericValue = Number(value || 0)
  if (numericValue < 2) return 'danger'
  if (numericValue < 3) return 'warning'
  return 'good'
}

function resolveDivergenceTone(gap) {
  const absoluteGap = Math.abs(Number(gap || 0))
  if (absoluteGap >= 2) return 'danger'
  if (absoluteGap >= 1) return 'warning'
  return 'good'
}

function resolveGapDirectionTone(gap) {
  const numericGap = Number(gap || 0)
  if (Math.abs(numericGap) < 0.25) return 'good'
  if (numericGap > 0) return 'warning'
  return 'danger'
}

function formatCrossGaugeDisplayValue(gap) {
  const numericGap = Number(gap || 0)
  const normalizedValue = Math.min(5, Math.abs(numericGap) + 1)
  const roundedValue = roundGaugeValue(normalizedValue)

  if (Math.abs(numericGap) < 0.25) {
    return roundedValue
  }

  if (numericGap > 0) {
    return roundedValue
  }

  return `-${roundedValue}`
}

function formatGapHelper(gap, lang) {
  const numericGap = Number(gap || 0)
  if (Math.abs(numericGap) < 0.25) {
    return lang === 'en' ? 'Aligned perception' : 'Percepcao alinhada'
  }

  if (numericGap > 0) {
    return lang === 'en'
      ? 'Athlete above objective evidence'
      : 'Atleta acima da evidencia objetiva'
  }

  return lang === 'en'
    ? 'Athlete below objective evidence'
    : 'Atleta abaixo da evidencia objetiva'
}

function localizeSourceStatus(status, lang) {
  if (status === 'READY') {
    return lang === 'en' ? 'Ready' : 'Pronto'
  }

  if (status === 'PENDING_ATHLETE_INPUT') {
    return lang === 'en' ? 'Pending athlete input' : 'Aguardando resposta do atleta'
  }

  return status || '-'
}

function localizeSourceSystem(sourceSystem, lang) {
  if (!sourceSystem) return '-'
  if (sourceSystem === 'COMANDO' || sourceSystem === 'HAPPY') return sourceSystem
  return lang === 'en' ? sourceSystem : sourceSystem
}

function localizeDivergenceLevel(level, lang) {
  if (level === 'HIGH_DIVERGENCE') {
    return lang === 'en' ? 'High divergence' : 'Divergencia alta'
  }
  if (level === 'MODERATE_DIVERGENCE') {
    return lang === 'en' ? 'Moderate divergence' : 'Divergencia moderada'
  }
  if (level === 'LOW_DIVERGENCE') {
    return lang === 'en' ? 'Low divergence' : 'Divergencia baixa'
  }
  return level || '-'
}

function localizeCoachActionType(type, lang) {
  if (type === 'CRITICAL_PARAMETER') {
    return lang === 'en' ? 'Critical parameter' : 'Parametro critico'
  }
  if (type === 'PERCEPTION_GAP') {
    return lang === 'en' ? 'Perception gap' : 'Gap de percepcao'
  }
  if (type === 'PENDING_ATHLETE_INPUT') {
    return lang === 'en' ? 'Pending input' : 'Entrada pendente'
  }
  return type || '-'
}

function localizeCoachActionMessage(action, lang) {
  if (action?.type === 'CRITICAL_PARAMETER' && action?.parameterCode) {
    return lang === 'en'
      ? `Primary intervention target: ${action.parameterCode}.`
      : `Alvo principal de intervencao: ${action.parameterCode}.`
  }

  if (action?.type === 'PERCEPTION_GAP') {
    return lang === 'en'
      ? `${action.message}`
      : `${action.message}`
  }

  if (action?.type === 'PENDING_ATHLETE_INPUT') {
    return lang === 'en'
      ? 'Athlete self-analysis has not been exported yet.'
      : 'A autoanalise do atleta ainda nao foi exportada.'
  }

  return action?.message || '-'
}

function localizeCrossQuestion(question, lang) {
  const ptMap = {
    'Confidence supported by score evidence?': 'A confianca e sustentada pela evidencia de resultado?',
    'Can confidence survive repetition?': 'A confianca se mantem ao longo da repeticao?',
    'Does perceived pressure match performance degradation?':
      'A pressao percebida combina com a degradacao da performance?',
    'Does arousal affect rhythm stability?': 'A ativacao afeta a estabilidade do ritmo?',
    'Does the athlete perceive emotional instability?':
      'O atleta percebe instabilidade emocional?',
    'Is the coach plan becoming execution?': 'O plano do coach esta virando execucao?',
    'Does training direction transfer into performance?':
      'A direcao do treino esta transferindo para a performance?',
    'Does perceived energy match physical evidence?':
      'A energia percebida combina com a evidencia fisica?',
    'Does ambition match commitment and continuity?':
      'A ambicao combina com compromisso e continuidade?',
    'Does poor organization create inconsistency?':
      'A organizacao fraca esta criando inconsistencia?',
    'Is the athlete learning or just repeating?':
      'O atleta esta aprendendo ou apenas repetindo?',
    'Is the athlete using the opportunities created by the coach?':
      'O atleta esta usando as oportunidades criadas pelo coach?',
  }

  if (lang === 'en') return question || '-'
  return ptMap[question] || question || '-'
}

function roundGaugeValue(value) {
  const numericValue = Number(value || 0)
  return Number.isInteger(numericValue) ? numericValue : numericValue.toFixed(2)
}

function formatObjectiveEvidenceLabel(parameterCode, lang) {
  if (!parameterCode) return '-'

  if (parameterCode.startsWith('CRITICAL_')) {
    const code = parameterCode.replace('CRITICAL_', '')
    return lang === 'en'
      ? `Critical parameter: ${code}`
      : `Parametro critico: ${code}`
  }

  if (
    ['SELF_LEADERSHIP', 'TEAM_LEADERSHIP', 'WISDOM', 'MANAGEMENT', 'ENVIRONMENT'].includes(
      parameterCode
    )
  ) {
    return lang === 'en'
      ? `HAPPY dimension: ${parameterCode}`
      : `Dimensao HAPPY: ${parameterCode}`
  }

  return parameterCode
}

function getCrossTranslations(lang) {
  if (lang === 'en') {
    return {
      pageTitle: 'Cross Analysis',
      selectAthlete: 'Select athlete',
      athlete: 'Athlete',
      status: 'Status',
      insights: 'Insights',
      primaryGap: 'Primary gap',
      mainDashboard: 'Main dashboard',
      threeLayerView: 'Three-layer dashboard',
      layer1: 'What the athlete feels',
      layer2: 'What the data shows',
      layer3: 'Where perception and reality diverge',
      coachActions: 'Coach actions',
      questionsAndScores: 'FEEDBACK',
      rawResults: 'Raw results',
      rawEvidence: 'Raw objective evidence',
      rawQuestionTable: 'Detailed question table',
      parameter: 'Parameter',
      scoreFive: 'Score /5',
      scoreTen: 'Score /10',
      level: 'Level',
      premiumDashboard: 'Premium alert dashboard',
      parameterClocks: 'Parameter clocks',
      parameterClocksSubtitle: 'Direct reading of HAPPY and COMANDO parameters.',
      crossedClocks: 'Crossed clocks',
      crossedClocksSubtitle: 'Alert panel for divergence between perception and objective evidence.',
      happyRadar: 'HAPPY radar',
      happyRadarSubtitle: 'Main graphic view of the five HAPPY dimensions.',
      noActions: 'No coach actions available yet.',
      insightTable: 'Insight table',
      pendingMessage:
        'Cross analysis is live and waiting for athlete self-analysis input from Admin export.',
      question: 'Question',
      athleteFeels: 'Athlete feels',
      dataShows: 'Data shows',
      gap: 'Gap',
      divergence: 'Divergence',
    }
  }

  return {
    pageTitle: 'Cross Analysis',
    selectAthlete: 'Selecionar atleta',
    athlete: 'Atleta',
    status: 'Status',
    insights: 'Insights',
    primaryGap: 'Gap principal',
    mainDashboard: 'Painel principal',
    threeLayerView: 'Dashboard em tres camadas',
    layer1: 'O que o atleta sente',
    layer2: 'O que os dados mostram',
    layer3: 'Onde percepcao e realidade divergem',
    coachActions: 'Acoes para o coach',
    questionsAndScores: 'FEEDBACK',
    rawResults: 'Resultados brutos',
    rawEvidence: 'Evidencia objetiva bruta',
    rawQuestionTable: 'Tabela detalhada das perguntas',
    parameter: 'Parametro',
    scoreFive: 'Nota /5',
    scoreTen: 'Nota /10',
    level: 'Nivel',
    premiumDashboard: 'Dashboard premium de alertas',
    parameterClocks: 'Relogios dos parametros',
    parameterClocksSubtitle: 'Leitura direta dos parametros HAPPY e COMANDO.',
    crossedClocks: 'Relogios cruzados',
    crossedClocksSubtitle: 'Painel de alerta da divergencia entre percepcao e evidencia objetiva.',
    happyRadar: 'Radar HAPPY',
    happyRadarSubtitle: 'Visual principal das cinco dimensoes HAPPY.',
    noActions: 'Ainda nao ha acoes para o coach.',
    insightTable: 'Tabela de insights',
    pendingMessage:
      'O cross analysis ja esta ativo e aguardando a entrada de auto analise do atleta no export do Admin.',
    question: 'Pergunta',
    athleteFeels: 'Atleta sente',
    dataShows: 'Dados mostram',
    gap: 'Gap',
    divergence: 'Divergencia',
  }
}

export default CrossAnalysisPage
