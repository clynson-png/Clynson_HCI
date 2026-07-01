import { useMemo } from 'react'
import {
  FaArrowRightArrowLeft,
  FaBullseye,
  FaChartLine,
  FaCrosshairs,
  FaGaugeHigh,
  FaHeartPulse,
  FaShieldHeart,
  FaSignal,
  FaBolt,
  FaArrowsDownToLine,
} from 'react-icons/fa6'
import {
  LEVEL_CODES,
  PARAMETER_CODES,
  REPORT_PROFILE_CODES,
  READING_CODES,
  translateCode,
} from '../i18n/codes'
import { mapSnapshotToAthleteView } from '../services/athleteViewMapper'

function IndicesPage({
  activeSnapshot,
  lang = 'pt',
  selectedAthlete = '',
  onAthleteChange,
}) {
  const t = getIndicesTranslations(lang)
  const athletes = buildSelectableAthletes(activeSnapshot)
  const selectedAthleteNameResolved = selectedAthlete || athletes[0]?.athleteName || ''

  const athleteView = useMemo(() => {
    return mapSnapshotToAthleteView(activeSnapshot, selectedAthleteNameResolved)
  }, [activeSnapshot, selectedAthleteNameResolved])

  if (!athleteView) {
    return <p>{t.noAthletes}</p>
  }

  const targets = athleteView.indices.targets || []
  const structure = athleteView.indices.structure || []

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <small>HCI PERFORMANCE</small>
          <h1>{t.pageTitle}</h1>
        </div>
      </header>

      <section className="panel selector-panel">
        <h2>{t.selectAthlete}</h2>

        <div className="selector-row">
          <select
            value={selectedAthleteNameResolved || ''}
            onChange={(event) => onAthleteChange?.(event.target.value)}
          >
            {athletes.map((athlete) => (
              <option key={athlete.athleteName} value={athlete.athleteName}>
                {athlete.athleteName}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="cards">
        <div className="card">
          <span>{t.athlete}</span>
          <strong className="small-value">{athleteView.athlete.name}</strong>
        </div>

        <div className="card">
          <span>{t.discipline}</span>
          <strong>{athleteView.athlete.discipline || '-'}</strong>
        </div>

        <div className="card">
          <span>{t.overallHci}</span>
          <strong>{athleteView.indices.overallHci}</strong>
        </div>

        <div className="card">
          <span>{t.level}</span>
          <strong className="small-value">{athleteView.summary.levelCode}</strong>
        </div>

        <div className="card">
          <span>{t.sessions}</span>
          <strong>{athleteView.summary.sessionsCount}</strong>
        </div>
      </section>

      <section className="panel">
        <h2>{t.athleteCharts}</h2>
        <div className="indices-chart-grid">
          <IndicesRadarCard
            title={t.targets}
            rows={targets}
            lang={lang}
            color="#2563eb"
          />
          <IndicesRadarCard
            title={t.structure}
            rows={structure}
            lang={lang}
            color="#0f766e"
          />
        </div>
      </section>

      <section className="panel">
        <h2>{t.quickGuide}</h2>
        <IndexExplanationTable lang={lang} />
      </section>

      <section className="panel">
        <h2>{t.targets}</h2>
        <AnalysisPanel
          title={t.targets}
          rows={targets}
          lang={lang}
          tone="targets"
          color="#2563eb"
          emptyLabel={t.noIndices}
        />
      </section>

      <section className="panel">
        <h2>{t.structure}</h2>
        <AnalysisPanel
          title={t.structure}
          rows={structure}
          lang={lang}
          tone="structure"
          color="#0f766e"
          emptyLabel={t.noIndices}
        />
      </section>
    </main>
  )
}

function getIndicesTranslations(lang) {
  if (lang === 'en') {
    return {
      pageTitle: 'HCI Indexes',
      selectAthlete: 'Select athlete',
      athlete: 'Athlete',
      discipline: 'Discipline',
      overallHci: 'Overall HCI',
      level: 'Level',
      sessions: 'Sessions',
      athleteCharts: 'Athlete charts',
      quickGuide: 'Quick index guide',
      targets: 'Targets',
      structure: 'Structure',
      noAthletes: 'No athletes available.',
      noIndices: 'No indexes available.',
      index: 'Index',
      whatItMeasures: 'What it measures',
      order: 'Order',
      parameter: 'Parameter',
      score: 'Score',
      profile: 'Profile',
      reading: 'Reading',
    }
  }

  return {
    pageTitle: 'Índices HCI',
    selectAthlete: 'Selecionar atleta',
    athlete: 'Atleta',
    discipline: 'Prova',
    overallHci: 'HCI Geral',
    level: 'Nível',
    sessions: 'Sessões',
    athleteCharts: 'Gráficos do Atleta',
    quickGuide: 'Guia Rápido dos Índices',
    targets: 'Metas',
    structure: 'Fundamentos',
    noAthletes: 'Sem atletas disponíveis.',
    noIndices: 'Sem índices disponíveis.',
    index: 'Índice',
    whatItMeasures: 'O que mede',
    order: 'Ordem',
    parameter: 'Parâmetro',
    score: 'Score',
    profile: 'Perfil',
    reading: 'Leitura',
  }
}

function buildSelectableAthletes(snapshot) {
  const names = Array.from(
    new Set([
      ...((snapshot?.leads || []).map((item) => item.athleteName).filter(Boolean)),
      ...((snapshot?.athlete360 || []).map((item) => item.athlete).filter(Boolean)),
      ...((snapshot?.sessionHeaders || []).map((item) => item.athleteName).filter(Boolean)),
    ])
  ).sort((a, b) => a.localeCompare(b))

  return names.map((athleteName) => ({ athleteName }))
}

function IndexExplanationTable({ lang }) {
  const t = getIndicesTranslations(lang)
  const rows = [
    ['OUTCOME', 'Entrega competitiva final em pontuação total.'],
    ['PROCESS', 'Continuidade de tiros aceitáveis ao longo da sessão.'],
    ['RHYTHM', 'Estabilidade do comportamento entre tiros e séries.'],
    ['DEEPENING', 'Capacidade de sustentar sequências profundas de bons tiros.'],
    ['CONSISTENCY', 'Repetibilidade dos totais de série.'],
    ['TRANSFER', 'Transferência do desempenho para contexto competitivo.'],
    ['RESILIENCE', 'Recuperação após quedas de rendimento.'],
    ['PRESSURE', 'Resposta à carga de pressão combinando ritmo e quebras.'],
    ['EMOTIONAL', 'Controle emocional inferido por quedas recorrentes.'],
    ['PHYSICAL', 'Sinal de degradação física ao longo da prova.'],
  ]

  return (
    <table>
      <thead>
        <tr>
          <th>{t.index}</th>
          <th>{t.whatItMeasures}</th>
        </tr>
      </thead>

      <tbody>
        {rows.map(([indexCode, description]) => (
          <tr key={indexCode}>
            <td>
              <div className="parameter-cell">
                <span className="parameter-icon parameter-icon-large" aria-hidden="true">
                  <ParameterGlyph parameterCode={indexCode} />
                </span>
                <span>{indexCode}</span>
              </div>
            </td>
            <td>{description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function AnalysisPanel({ title, rows, lang, tone, color, emptyLabel }) {
  return (
    <div className="indices-analysis-shell">
      <ParameterStrip rows={rows} lang={lang} tone={tone} />

      <div className="indices-analysis-layout">
        <div className="indices-analysis-table">
          <IndexTable rows={rows} lang={lang} emptyLabel={emptyLabel} />
        </div>

        <div className="indices-analysis-preview">
          <div className="indices-preview-table-shell">
            <div className="indices-preview-table-head">
              <span>{title}</span>
            </div>

            <div className="indices-preview-table-body">
              <IndicesRadarCard
                title=""
                rows={rows}
                lang={lang}
                color={color}
                compact
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function IndexTable({ rows, lang, emptyLabel }) {
  const t = getIndicesTranslations(lang)
  if (!rows.length) {
    return <p style={{ padding: 16 }}>{emptyLabel}</p>
  }

  return (
    <table>
      <thead>
        <tr>
          <th>{t.order}</th>
          <th>{t.parameter}</th>
          <th>{t.score}</th>
          <th>{t.level}</th>
          <th>{t.profile}</th>
          <th>{t.reading}</th>
        </tr>
      </thead>

      <tbody>
        {rows.map((param) => (
          <tr key={param.parameterCode || param.displayOrder}>
            <td>{param.displayOrder}</td>
            <td>
              <div className="parameter-cell">
                <span className="parameter-icon" aria-hidden="true">
                  <ParameterGlyph parameterCode={param.parameterCode} />
                </span>
                <span>{translateCode(PARAMETER_CODES, param.parameterCode, lang)}</span>
              </div>
            </td>
            <td>{param.score}</td>
            <td>{translateCode(LEVEL_CODES, param.levelCode, lang)}</td>
            <td>{translateCode(REPORT_PROFILE_CODES, param.reportProfileCode, lang)}</td>
            <td>{translateCode(READING_CODES, param.readingCode, lang)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ParameterStrip({ rows, lang, tone }) {
  if (!rows.length) return null

  return (
    <div className={`parameter-strip parameter-strip-${tone}`}>
      {rows.map((param) => (
        <div key={param.parameterCode || param.displayOrder} className="parameter-pill">
          <span className="parameter-pill-icon" aria-hidden="true">
            <ParameterGlyph parameterCode={param.parameterCode} />
          </span>
          <div className="parameter-pill-copy">
            <strong>{translateCode(PARAMETER_CODES, param.parameterCode, lang)}</strong>
            <small>{param.score}</small>
          </div>
        </div>
      ))}
    </div>
  )
}

function IndicesRadarCard({ title, rows, lang, color, compact = false }) {
  if (!rows.length) {
    return (
      <div className="indices-chart-card">
        <div className="indices-chart-header">
          <strong>{title}</strong>
        </div>
        <p style={{ padding: 16, margin: 0 }}>
          {lang === 'en' ? 'No chart data available.' : 'Sem dados para gráfico.'}
        </p>
      </div>
    )
  }

  const size = compact ? 250 : 340
  const center = size / 2
  const radius = compact ? 78 : 115
  const angleStep = (Math.PI * 2) / rows.length

  const polygonPoints = rows
    .map((row, index) => {
      const valueRadius = (Number(row.score || 0) / 10) * radius
      const angle = index * angleStep - Math.PI / 2
      const x = center + valueRadius * Math.cos(angle)
      const y = center + valueRadius * Math.sin(angle)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="indices-chart-card">
      {title ? (
        <div className="indices-chart-header">
          <strong>{title}</strong>
        </div>
      ) : null}

      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height={compact ? 220 : 320}>
        {[2, 4, 6, 8, 10].map((step) => (
          <circle
            key={step}
            cx={center}
            cy={center}
            r={(step / 10) * radius}
            fill="none"
            stroke="#dbe3ef"
          />
        ))}

        {rows.map((_, index) => {
          const angle = index * angleStep - Math.PI / 2
          const x = center + radius * Math.cos(angle)
          const y = center + radius * Math.sin(angle)

          return (
            <line
              key={`axis-${index}`}
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
          fill={color}
          fillOpacity="0.18"
          stroke={color}
          strokeWidth="3"
        />

        {rows.map((row, index) => {
          const angle = index * angleStep - Math.PI / 2
          const labelX = center + (radius + (compact ? 20 : 28)) * Math.cos(angle)
          const labelY = center + (radius + (compact ? 20 : 28)) * Math.sin(angle)
          const pointRadius = (Number(row.score || 0) / 10) * radius
          const pointX = center + pointRadius * Math.cos(angle)
          const pointY = center + pointRadius * Math.sin(angle)

          return (
            <g key={row.parameterCode || index}>
              <circle cx={pointX} cy={pointY} r="4.5" fill={color} />
              <text
                x={labelX}
                y={labelY}
                fontSize={compact ? '8' : '10'}
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#334155"
              >
                {translateCode(PARAMETER_CODES, row.parameterCode, lang)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function ParameterGlyph({ parameterCode }) {
  const iconMap = {
    OUTCOME: FaBullseye,
    PROCESS: FaCrosshairs,
    RHYTHM: FaSignal,
    DEEPENING: FaChartLine,
    CONSISTENCY: FaGaugeHigh,
    TRANSFER: FaArrowRightArrowLeft,
    RESILIENCE: FaShieldHeart,
    PRESSURE: FaBolt,
    EMOTIONAL: FaArrowsDownToLine,
    PHYSICAL: FaHeartPulse,
  }

  const Icon = iconMap[parameterCode] || FaBullseye
  return <Icon size={18} strokeWidth={2.1} />
}

export default IndicesPage
