import { useMemo, useState } from 'react'
import { buildTaurusSmartChartModel } from '../../services/taurusSmartChartEngine'
import { buildTaurusColorChartModel } from '../../services/taurusColorIntelligence'
import { translations } from '../../i18n/translations'
import A4ReportShell from '../reports/A4ReportShell'
import PremiumLockedAction from '../reports/PremiumLockedAction'


const TARGETS = {
  HUMANOID: { label: 'HUMANOIDE', type: 'humanoid' },
  COLOR: { label: 'CARTÕES COLORIDOS', type: 'color' },
  DUEL20: { label: 'DUELO 20', type: 'duel' },
}

const RANGE_OPTIONS = [
  { key: '7', days: 7, labelIndex: 0 },
  { key: '30', days: 30, labelIndex: 1 },
  { key: '90', days: 90, labelIndex: 2 },
  { key: 'ALL', days: null, labelIndex: 3 },
]

function TaurusSmartChart({ sessions = [], athleteName, lang = 'pt', subscriptionAccess = {} }) {
  const t = translations[lang] || translations.pt
  const [activeTarget, setActiveTarget] = useState('HUMANOID')
  const [activeRangeKey, setActiveRangeKey] = useState('90')
  const [showSmartChartReport, setShowSmartChartReport] = useState(false)
  const scopedSessions = useMemo(
    () =>
      athleteName
        ? sessions.filter((session) => session.athleteName === athleteName)
        : sessions,
    [sessions, athleteName]
  )
  const activeRange = RANGE_OPTIONS.find((option) => option.key === activeRangeKey) || RANGE_OPTIONS[2]
  const rangedSessions = useMemo(
    () => filterSessionsByRange(scopedSessions, activeRange.days),
    [scopedSessions, activeRange.days]
  )

  const model = useMemo(
    () =>
      buildTaurusSmartChartModel({
        sessions: rangedSessions,
        athleteName,
        targetType: activeTarget,
      }),
    [rangedSessions, athleteName, activeTarget]
  )

  const target = {
    ...TARGETS[activeTarget],
    label: t.smartChart.targetLabels[activeTarget],
  }
  const latest = model.latestIndicators || {}
  const history = model.history || []
  const timeline = model.timeline || []
  const training = model.mainTrainingRecommendation
  const trainingLevel = model.summary.trainingLevel || {}
  const colorChartData = useMemo(
    () => (activeTarget === 'COLOR' ? buildTaurusColorChartModel(model.sessions) : []),
    [activeTarget, model.sessions]
  )
  const coachCues = model.coachCues || []
  const trainingTitle = resolveTrainingText(
    training?.title ||
      training?.trainingTitle ||
      training?.name ||
      training?.trainingId
  )
  const trainingDescription = resolveTrainingText(
    training?.description ||
      training?.objective
  )
  const smartChartA4Report = useMemo(
    () =>
      buildSmartChartA4Report({
        model,
        target,
        athleteName,
        trainingTitle,
        trainingDescription,
        coachCues,
        t,
      }),
    [athleteName, coachCues, model, t, target, trainingDescription, trainingTitle]
  )

  function handleShowSmartChartReport() {
    if (!subscriptionAccess.canExportPdf) {
      window.alert(t.smartChart.premiumPdfMessage)
      return
    }

    setShowSmartChartReport(true)
  }

  function handleGenerateSmartChartPdf() {
    if (typeof window === 'undefined') return
    if (!subscriptionAccess.canExportPdf) {
      window.alert(t.smartChart.premiumPdfMessage)
      return
    }

    setShowSmartChartReport(true)

    const clearPrintMode = () => {
      document.body.classList.remove('taurus-print-a4')
      window.removeEventListener('afterprint', clearPrintMode)
    }

    document.body.classList.add('taurus-print-a4')
    window.addEventListener('afterprint', clearPrintMode)
    window.print()
    window.setTimeout(() => {
      clearPrintMode()
    }, 1200)
  }

  return (
    <section className="taurus-smart-layout">
      <aside className="taurus-smart-sidebar">
        <div className="taurus-smart-brand">
          <TaurusMark />
          <div className="taurus-smart-brand-text">TAURUS</div>
        </div>

        <div className="taurus-smart-nav">
          <NavItem icon={<CrosshairIcon />} label={t.smartChart.nav.targets} />
          <NavItem icon={<EntryIcon />} label={t.smartChart.nav.entry} />
          <NavItem icon={<OutputIcon />} label={t.smartChart.nav.output} />
          <NavItem icon={<ChartIcon />} label={t.smartChart.nav.smartChart} active />
        </div>

        <button
          className={`taurus-smart-pdf${subscriptionAccess.canExportPdf ? '' : ' premium-locked-action'}`}
          type="button"
          onClick={handleShowSmartChartReport}
        >
          <PdfIcon />
          <span>
            <strong>{subscriptionAccess.canExportPdf ? t.smartChart.reportTitle : t.smartChart.premiumPdfTitle}</strong>
            <small>{subscriptionAccess.canExportPdf ? t.smartChart.reportSubtitle : t.smartChart.premiumPdfSubtitle}</small>
          </span>
        </button>

        <div className="taurus-smart-athlete-card">
          <small>{t.smartChart.activeAthlete}</small>
          <strong>{athleteName || '-'}</strong>
          <span>{t.smartChart.approvedTrainingCount(Number(model.summary.sessionsCount || 0))}</span>
        </div>
      </aside>

      <main className="taurus-smart-main">
        <header className="taurus-smart-topbar">
          <div>
            <h1>{t.smartChart.title}</h1>
            <p>{t.smartChart.subtitle}</p>
          </div>
          <div className="taurus-smart-athlete-top">
            <AthleteIcon />
            <div>
              <small>{t.smartChart.activeAthlete}</small>
              <strong>{athleteName || '-'}</strong>
            </div>
            <ChevronDownIcon />
          </div>
        </header>

        <section className="taurus-smart-target-tabs">
          {Object.entries(TARGETS).map(([key, item]) => (
            <button
              key={key}
              type="button"
              className={activeTarget === key ? 'active' : ''}
              onClick={() => setActiveTarget(key)}
            >
              <TargetTabIcon type={item.type} />
              <span>{t.smartChart.targetLabels[key]}</span>
            </button>
          ))}
        </section>

        <section className="taurus-smart-hero">
          <div className="taurus-smart-panel taurus-smart-chart-panel">
            <div className="taurus-smart-panel-header">
              <div>
                <h2>{t.smartChart.evolutionTitle} - {target.label}</h2>
                <p>{t.smartChart.tacticalIndex}</p>
              </div>
              <div className="taurus-smart-range">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={activeRangeKey === option.key ? 'sel' : ''}
                    onClick={() => setActiveRangeKey(option.key)}
                  >
                    {t.smartChart.range[option.labelIndex]}
                  </button>
                ))}
              </div>
            </div>
            {activeTarget === 'COLOR' ? (
              <ColorCardsSmartChart data={colorChartData} t={t} />
            ) : activeTarget === 'DUEL20' ? (
              <Duel20SmartChart data={model.duel20ChartData} t={t} />
            ) : (
              <SmartLineChart timeline={timeline} t={t} />
            )}
          </div>

          <aside className="taurus-smart-panel taurus-smart-summary-panel">
            <h2>{t.smartChart.trendTitle} - {target.label}</h2>

            <div className="taurus-smart-summary-block">
              <span>{t.smartChart.latestTraining}</span>
              <div className="taurus-smart-date-row">
                <CalendarIcon />
                <strong>{model.summary.latestDate || '-'}</strong>
              </div>
            </div>

            <div className="taurus-smart-summary-metrics">
              <div>
                <span>{t.smartChart.currentIndex}</span>
                <strong className="orange">{formatOptionalPercent(model.summary.currentIndex)}</strong>
              </div>
              <div className="taurus-smart-summary-best">
                <span>{t.smartChart.bestIndex}</span>
                <strong className="green">{formatOptionalPercent(model.summary.bestIndex)}</strong>
                <small>{model.summary.bestDate || '-'}</small>
              </div>
            </div>

            <div className="taurus-smart-trend-block">
              <span>{t.smartChart.trainingLevel}</span>
              <div className="taurus-smart-trend-row">
                <TrendIcon />
                <strong className={trainingLevel.code === 'ELITE' ? 'green' : 'orange'}>
                  {trainingLevel.label || '-'}
                </strong>
              </div>
              <small>{trainingLevel.reason || '-'}</small>
            </div>

            <div className="taurus-smart-trend-block">
              <span>{t.smartChart.trend}</span>
              <div className="taurus-smart-trend-row">
                <TrendIcon />
                <strong className="green">{trendLabel(model.summary.trend, t)}</strong>
              </div>
              <small>{t.smartChart.comparedLastFive}</small>
            </div>
          </aside>
        </section>

        <section className="taurus-smart-panel taurus-smart-indicators-panel">
          <h2>{t.smartChart.indicatorsTitle} ({model.summary.latestDate || '-'})</h2>

          <div className="taurus-smart-indicators-grid">
            <MetricCard label={t.smartChart.totalImpacts} value={latest.totalShots ?? '-'} />
            <MetricCard label={t.smartChart.alpha} value={formatOptionalPercent(latest.alphaPercent)} bar="green" />
            <MetricCard label={t.smartChart.intermediate} value={formatOptionalPercent(latest.intermediatePercent)} bar="yellow" />
            <MetricCard label={t.smartChart.peripheral} value={formatOptionalPercent(latest.peripheralPercent)} bar="red" />
            <MetricCard label={t.smartChart.dominantZone} value={latest.dominantZone || '-'} tone="green" />
            <MetricCard label={t.smartChart.worstRecurringZone} value={latest.biggestOpportunity || '-'} tone="red" />
            <MetricCard label={t.smartChart.tacticalEfficiencyIndex} value={formatOptionalPercent(latest.indexValue)} tone="orange" />
          </div>

          <div className="taurus-smart-cues-grid">
            <div className="taurus-smart-cue-card">
              <ChatIcon />
              <div>
                <h3>{t.smartChart.coachInsight}</h3>
                <p>{coachCues.length ? coachCues.join(' ') : '-'}</p>
                <div className="taurus-smart-rule-lines" />
              </div>
            </div>

            <div className="taurus-smart-cue-card">
              <TargetSmallIcon />
              <div>
                <h3>{t.smartChart.mainTraining}</h3>
                <strong>{trainingTitle || '-'}</strong>
                <p>{trainingDescription || '-'}</p>
                <div className="taurus-smart-rule-lines" />
              </div>
            </div>
          </div>
        </section>

        <section className="taurus-smart-panel taurus-smart-history-panel">
          <h2>{t.smartChart.historyTitle} - {target.label}</h2>

          <div className="taurus-smart-history-wrap">
            <table className="taurus-smart-history-table">
              <thead>
                <tr>
                  <th>{t.smartChart.date}</th>
                  <th>{t.smartChart.tacticalEfficiencyIndex}</th>
                  <th>{t.smartChart.totalImpacts}</th>
                  <th>{t.smartChart.time}</th>
                  <th>{t.smartChart.timePrediction}</th>
                  <th>{t.smartChart.alpha} (%)</th>
                  <th>{t.smartChart.intermediate} (%)</th>
                  <th>{t.smartChart.peripheral} (%)</th>
                  <th>{t.smartChart.dominantZone}</th>
                  <th>{t.smartChart.reading}</th>
                  <th>{t.smartChart.trend}</th>
                </tr>
              </thead>
              <tbody>
                {history.length ? (
                  history.slice().reverse().map((row, index) => (
                    <tr key={row.sessionId || `${index}-${row.date}-${row.indexValue}`}>
                      <td>{row.date}</td>
                      <td className="orange">{formatOptionalPercent(row.indexValue)}</td>
                      <td className="center">{row.totalShots}</td>
                      <td className="center">{formatSeconds(row.durationSeconds)}</td>
                      <td className="center">{formatSeconds(row.predictedDurationSeconds)}</td>
                      <td className="center">{formatOptionalPercent(row.alphaPercent)}</td>
                      <td className="center">{formatOptionalPercent(row.intermediatePercent)}</td>
                      <td className="center">{formatOptionalPercent(row.peripheralPercent)}</td>
                      <td className={row.dominantZone === 'ALFA' ? 'green-text center' : 'yellow-text center'}>
                        {row.dominantZone}
                      </td>
                      <td>{trendLabel(row.trend, t)}</td>
                      <td className={`center ${trendClass(row.trend)}`}>{trendSymbol(row.trend)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="center" colSpan="11">{t.smartChart.emptyTarget}.</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="taurus-smart-see-all">
              {t.smartChart.seeAll} <ChevronDownIcon />
            </div>
          </div>
        </section>

        {showSmartChartReport && (
          <section className="taurus-smart-a4-preview">
            <div className="taurus-a4-preview-head">
              <div>
                <span>{t.smartChart.reportPreviewTitle}</span>
                <strong>{t.smartChart.reportPreviewSubtitle}</strong>
              </div>
              <PremiumLockedAction
                label={t.smartChart.pdfTitle}
                lockedLabel={t.smartChart.premiumPdfTitle}
                description={t.smartChart.premiumPdfMessage}
                allowed={!!subscriptionAccess.canExportPdf}
                className="taurus-a4-preview-button"
                onClick={handleGenerateSmartChartPdf}
              />
            </div>
            <SmartChartA4Report report={smartChartA4Report} />
          </section>
        )}
      </main>
    </section>
  )
}

function SmartChartA4Report({ report }) {
  return (
    <A4ReportShell
      title={report.title}
      subtitle={report.subtitle}
      athleteName={report.athleteName}
      metaItems={report.metaItems}
      metrics={report.metrics}
      diagnosis={report.diagnosis}
      recommendation={report.recommendation}
      insights={report.insights}
      footer={report.footer}
      labels={report.labels}
    >
      <div className="a4-smart-chart-visual">
        <div className="a4-target-visual-title">
          <span>{report.visualTitle}</span>
          <strong>{report.visualValue}</strong>
        </div>
        <div className="a4-smart-history-mini">
          {report.historyRows.map((row) => (
            <div key={row.key} className="a4-smart-history-row">
              <span>{row.date}</span>
              <div>
                <i style={{ width: `${row.percent}%` }} />
              </div>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </A4ReportShell>
  )
}

function buildSmartChartA4Report({
  model,
  target,
  athleteName,
  trainingTitle,
  trainingDescription,
  coachCues,
  t,
}) {
  const summary = model.summary || {}
  const latest = model.latestIndicators || {}
  const historyRows = (model.history || []).slice(-6).map((row, index) => ({
    key: row.sessionId || `${row.date}-${index}`,
    date: row.date || '-',
    percent: clampPercent(row.indexValue),
    value: formatOptionalPercent(row.indexValue),
  }))
  const effectiveHistoryRows = historyRows.length
    ? historyRows
    : [{ key: 'empty', date: '-', percent: 0, value: '-' }]

  return {
    title: `Smart Chart ${target.label}`,
    subtitle: t.smartChart.reportSubtitleLine,
    athleteName,
    metaItems: [
      { label: t.smartChart.target, value: target.label },
      { label: t.smartChart.trainings, value: String(summary.sessionsCount || 0) },
      { label: t.smartChart.latest, value: summary.latestDate || '-' },
      { label: t.smartChart.bestDate, value: summary.bestDate || '-' },
    ],
    metrics: [
      { label: t.smartChart.currentIndex, value: formatOptionalPercent(summary.currentIndex) },
      { label: t.smartChart.bestIndex, value: formatOptionalPercent(summary.bestIndex) },
      { label: t.smartChart.trend, value: trendLabel(summary.trend, t) },
      { label: t.smartChart.trainingLevel, value: summary.trainingLevel?.label || '-' },
      { label: t.smartChart.totalImpacts, value: latest.totalShots ?? '-' },
      { label: t.smartChart.dominantZone, value: latest.dominantZone || '-' },
    ],
    diagnosis: {
      title: `${t.smartChart.trendTitle}: ${trendLabel(summary.trend, t)}`,
      body: coachCues?.length ? coachCues.join(' ') : t.smartChart.emptyTarget,
    },
    recommendation: {
      title: trainingTitle || '-',
      body: trainingDescription || '-',
    },
    insights: [
      `${t.smartChart.tacticalEfficiencyIndex}: ${formatOptionalPercent(latest.indexValue)}.`,
      `${t.smartChart.worstRecurringZone}: ${latest.biggestOpportunity || '-'}.`,
      summary.trainingLevel?.reason || '-',
    ],
    visualTitle: t.smartChart.historyTitle,
    visualValue: t.smartChart.reportSessionCount(Number(summary.sessionsCount || 0)),
    historyRows: effectiveHistoryRows,
    footer: t.smartChart.reportFooter,
    labels: t.reportLabels,
  }
}

function SmartLineChart({ timeline, t }) {
  const width = 850
  const height = 210
  const left = 44
  const right = 815
  const top = 18
  const bottom = 194

  const points = timeline.map((item, index) => {
    const x = (right - left) * (index / Math.max(timeline.length - 1, 1)) + left
    const y = bottom - (Number(item.indexValue || 0) / 100) * (bottom - top)
    const predictedDuration = Number(item.predictedDurationSeconds ?? item.durationSeconds ?? 0)
    const predictedY = bottom - (Math.min(Math.max(predictedDuration, 0), 20) / 20) * (bottom - top)
    return { ...item, x, y, predictedY }
  })

  const path = buildSmoothPath(points)
  const predictedPath = buildSmoothPath(points.map((point) => ({ ...point, y: point.predictedY })))
  const timeTicks = [20, 15, 10, 5, 0]

  return (
    <div className="taurus-smart-plot">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {[18, 62, 106, 150].map((y) => (
          <line key={y} className="taurus-smart-gridline" x1={left} y1={y} x2={right} y2={y} />
        ))}
        <line className="taurus-smart-axis" x1={left} y1={bottom} x2={right} y2={bottom} />
        <line className="taurus-smart-axis" x1={left} y1={top} x2={left} y2={bottom} />

        {[100, 75, 50, 25, 0].map((value, i) => (
          <text key={value} className="taurus-smart-axis-label" x={i === 4 ? 14 : 0} y={[22, 66, 110, 154, 198][i]}>
            {value}%
          </text>
        ))}

        <line className="taurus-smart-axis" x1={right} y1={top} x2={right} y2={bottom} />
        {timeTicks.map((value) => (
          <text
            key={value}
            className="taurus-smart-axis-label taurus-smart-time-scale"
            x={right + 10}
            y={timeToY(value, top, bottom) + 4}
          >
            {value}s
          </text>
        ))}

        {points.map((point, index) => (
          <rect
            key={`${index}-${point.date}-bar`}
            className="taurus-smart-time-bar"
            x={point.x - 10}
            y={timeToY(point.durationSeconds, top, bottom)}
            width="20"
            height={bottom - timeToY(point.durationSeconds, top, bottom)}
            rx="4"
          />
        ))}

        {points.length === 0 && (
          <text className="taurus-smart-empty-label" x="425" y="110" textAnchor="middle">
            {t.smartChart.emptyTarget}
          </text>
        )}

        <path className="taurus-smart-line" d={path} />
        <path className="taurus-smart-time-line" d={predictedPath} />
        {points.map((point, index) => (
          <circle key={`${index}-${point.date}-${point.x}`} className="taurus-smart-dot" cx={point.x} cy={point.y} r="4" />
        ))}
        {points.map((point, index) => (
          <circle key={`${index}-${point.date}-pred-${point.x}`} className="taurus-smart-time-dot" cx={point.x} cy={point.predictedY} r="3" />
        ))}

        {points.map((point, index) => (
          <text key={`${index}-${point.date}-label`} className="taurus-smart-axis-label" x={Math.max(28, point.x - 16)} y="210">
            {index % Math.ceil(points.length / 6 || 1) === 0 ? shortDate(point.date) : ''}
          </text>
        ))}

      </svg>
    </div>
  )
}

function filterSessionsByRange(sessions, days) {
  if (!days) return sessions

  const datedSessions = sessions
    .map((session) => ({
      session,
      timestamp: normalizeSessionTimestamp(session),
    }))
    .filter((item) => item.timestamp !== null)

  if (!datedSessions.length) return []

  const latestTimestamp = Math.max(...datedSessions.map((item) => item.timestamp))
  const minTimestamp = latestTimestamp - days * 24 * 60 * 60 * 1000

  return datedSessions
    .filter((item) => item.timestamp >= minTimestamp)
    .map((item) => item.session)
}

function normalizeSessionTimestamp(session) {
  const direct = Number(session?.recordedAt)
  if (Number.isFinite(direct) && direct > 0) return direct

  const parsed = new Date(session?.recordedAt || session?.date || session?.createdAt || '').getTime()
  return Number.isNaN(parsed) ? null : parsed
}

function ColorCardsSmartChart({ data, t }) {
  const width = 850
  const height = 210
  const left = 44
  const right = 815
  const top = 18
  const bottom = 194
  const maxTime = Math.max(
    20,
    ...data.map((item) =>
      Math.max(
        Number(item.measuredTimeSeconds || 0),
        Number(item.predictedBestTimeSeconds || 0)
      )
    )
  )

  const points = data.map((item, index) => {
    const x = (right - left) * (index / Math.max(data.length - 1, 1)) + left
    const impactY = bottom - (Number(item.impactPercent || 0) / 100) * (bottom - top)
    const measuredTimeY = bottom - (Number(item.measuredTimeSeconds || 0) / maxTime) * (bottom - top)
    const predictedTimeY = bottom - (Number(item.predictedBestTimeSeconds || 0) / maxTime) * (bottom - top)

    return {
      ...item,
      x,
      impactY,
      measuredTimeY,
      predictedTimeY,
    }
  })

  const impactPath = buildSmoothPath(points.map((point) => ({ ...point, y: point.impactY })))
  const predictedPath = buildSmoothPath(points.map((point) => ({ ...point, y: point.predictedTimeY })))
  const timeTicks = [maxTime, maxTime * 0.75, maxTime * 0.5, maxTime * 0.25, 0]

  return (
    <div className="taurus-smart-plot taurus-smart-color-plot">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {[18, 62, 106, 150].map((y) => (
          <line key={y} className="taurus-smart-gridline" x1={left} y1={y} x2={right} y2={y} />
        ))}
        <line className="taurus-smart-axis" x1={left} y1={bottom} x2={right} y2={bottom} />
        <line className="taurus-smart-axis" x1={left} y1={top} x2={left} y2={bottom} />

        {[100, 75, 50, 25, 0].map((value, i) => (
          <text key={value} className="taurus-smart-axis-label" x={i === 4 ? 14 : 0} y={[22, 66, 110, 154, 198][i]}>
            {value}%
          </text>
        ))}

        <line className="taurus-smart-axis" x1={right} y1={top} x2={right} y2={bottom} />
        {timeTicks.map((value) => (
          <text
            key={value}
            className="taurus-smart-axis-label taurus-smart-time-scale"
            x={right + 10}
            y={timeValueToY(value, maxTime, top, bottom) + 4}
          >
            {Math.round(value)}s
          </text>
        ))}

        {points.map((point, index) => (
          <rect
            key={`${point.sessionId || index}-time`}
            className="taurus-smart-color-time-bar"
            x={point.x - 10}
            y={point.measuredTimeY}
            width="20"
            height={bottom - point.measuredTimeY}
            rx="4"
          />
        ))}

        {points.length === 0 && (
          <text className="taurus-smart-empty-label" x="425" y="110" textAnchor="middle">
            {t.smartChart.emptyColor}
          </text>
        )}

        <path className="taurus-smart-color-impact-line" d={impactPath} />
        <path className="taurus-smart-color-time-line" d={predictedPath} />

        {points.map((point, index) => (
          <circle
            key={`${point.sessionId || index}-impact`}
            className="taurus-smart-color-impact-dot"
            cx={point.x}
            cy={point.impactY}
            r="4"
          />
        ))}
        {points.map((point, index) => (
          <circle
            key={`${point.sessionId || index}-prediction`}
            className="taurus-smart-color-time-dot"
            cx={point.x}
            cy={point.predictedTimeY}
            r="3"
          />
        ))}

        {points.map((point, index) => (
          <text key={`${point.sessionId || index}-label`} className="taurus-smart-axis-label" x={Math.max(28, point.x - 16)} y="210">
            {index % Math.ceil(points.length / 6 || 1) === 0 ? point.name : ''}
          </text>
        ))}
      </svg>
    </div>
  )
}

function Duel20SmartChart({ data = {}, t }) {
  const points = (data.points || []).map((point, index) => ({
    ...point,
    index,
  }))

  if (!points.length) {
    return (
      <div className="taurus-smart-plot">
        <svg viewBox="0 0 850 260" preserveAspectRatio="none">
          <text className="taurus-smart-empty-label" x="425" y="130" textAnchor="middle">
            {t.smartChart.emptyDuel}
          </text>
        </svg>
      </div>
    )
  }

  const width = 850
  const height = 260
  const left = 64
  const right = 815
  const top = 28
  const bottom = 220
  const scoreMax = Math.max(
    40,
    ...points.map((point) => Number(point.score || 0)),
    ...points.map((point) => Number(point.predictedScore || 0))
  )
  const timeMax = Math.max(
    20,
    ...points.map((point) => Number(point.time || 0)),
    ...points.map((point) => Number(point.predictedTime || 0))
  )

  const chartPoints = points.map((point, index) => {
    const x = (right - left) * (index / Math.max(points.length - 1, 1)) + left
    const scoreY = bottom - (Number(point.score || 0) / scoreMax) * (bottom - top)
    const timeY = bottom - (Number(point.time || 0) / timeMax) * (bottom - top)
    const predictedScoreY = bottom - (Number(point.predictedScore || 0) / scoreMax) * (bottom - top)
    const predictedTimeY = bottom - (Number(point.predictedTime || 0) / timeMax) * (bottom - top)

    return {
      ...point,
      x,
      scoreY,
      timeY,
      predictedScoreY,
      predictedTimeY,
    }
  })

  const scorePath = buildSmoothPath(chartPoints.map((point) => ({ ...point, y: point.scoreY })))
  const predictedScorePath = buildSmoothPath(chartPoints.map((point) => ({ ...point, y: point.predictedScoreY })))
  const predictedTimePath = buildSmoothPath(chartPoints.map((point) => ({ ...point, y: point.predictedTimeY })))
  const leftTicks = [scoreMax, Math.round(scoreMax * 0.75), Math.round(scoreMax * 0.5), Math.round(scoreMax * 0.25), 0]
  const rightTicks = [timeMax, Math.round(timeMax * 0.75), Math.round(timeMax * 0.5), Math.round(timeMax * 0.25), 0]

  return (
    <div className="taurus-smart-plot">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {[44, 86, 128, 170].map((y) => (
          <line key={y} className="taurus-smart-gridline" x1={left} y1={y} x2={right} y2={y} />
        ))}
        <line className="taurus-smart-axis" x1={left} y1={bottom} x2={right} y2={bottom} />
        <line className="taurus-smart-axis" x1={left} y1={top} x2={left} y2={bottom} />
        <line className="taurus-smart-axis" x1={right} y1={top} x2={right} y2={bottom} />

        {leftTicks.map((value, index) => (
          <text key={`left-${value}`} className="taurus-smart-axis-label" x={10} y={[22, 64, 106, 148, 218][index]}>
            {Math.round(value)}
          </text>
        ))}

        {rightTicks.map((value, index) => (
          <text key={`right-${value}`} className="taurus-smart-axis-label taurus-smart-time-scale" x={right + 10} y={[22, 64, 106, 148, 218][index] + 4}>
            {Math.round(value)}s
          </text>
        ))}

        {chartPoints.map((point) => (
          <rect
            key={`${point.seriesCode}-bar`}
            x={point.x - 10}
            y={point.timeY}
            width="20"
            height={bottom - point.timeY}
            rx="4"
            fill="#2563eb"
            opacity="0.88"
          />
        ))}

        <path d={scorePath} stroke="#f59e0b" strokeWidth="2.5" fill="none" />
        <path d={predictedScorePath} stroke="#f59e0b" strokeWidth="2" fill="none" strokeDasharray="6 5" />
        <path d={predictedTimePath} stroke="#2563eb" strokeWidth="2" fill="none" strokeDasharray="6 5" />

        {chartPoints.map((point) => (
          <circle key={`${point.seriesCode}-score`} cx={point.x} cy={point.scoreY} r="5" fill="#f59e0b" />
        ))}

        {chartPoints.map((point) => (
          <text key={`${point.seriesCode}-label`} className="taurus-smart-axis-label" x={point.x - 10} y={point.scoreY - 10}>
            {point.seriesCode}
          </text>
        ))}

        {chartPoints.map((point) => (
          <text key={`${point.seriesCode}-value`} className="taurus-smart-axis-label" x={point.x - 12} y={point.scoreY - 24}>
            {Math.round(point.score)}
          </text>
        ))}

        {chartPoints.map((point, index) => (
          <text key={`${point.seriesCode}-x`} className="taurus-smart-axis-label" x={point.x - 12} y="245">
            {point.seriesCode}
          </text>
        ))}
      </svg>
    </div>
  )
}

function buildSmoothPath(points) {
  if (!points.length) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`
    const previous = points[index - 1]
    const controlX = (previous.x + point.x) / 2
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`
  }, '')
}

function timeValueToY(value, maxTime, top, bottom) {
  const numberValue = Number(value)
  const clamped = Number.isFinite(numberValue)
    ? Math.min(Math.max(numberValue, 0), maxTime)
    : 0

  return bottom - (clamped / maxTime) * (bottom - top)
}

function timeToY(value, top, bottom) {
  const numberValue = Number(value)
  const clamped = Number.isFinite(numberValue)
    ? Math.min(Math.max(numberValue, 0), 20)
    : 0

  return bottom - (clamped / 20) * (bottom - top)
}

function MetricCard({ label, value, hint, bar, tone }) {
  return (
    <div className="taurus-smart-metric-card">
      <label>{label}</label>
      <strong className={tone ? `${tone}-text` : ''}>{value}</strong>
      {hint && <small>{hint}</small>}
      {bar && (
        <div className="taurus-smart-bar">
          <i className={`${bar}bar`} />
        </div>
      )}
    </div>
  )
}

function NavItem({ icon, label, active }) {
  return (
    <div className={`taurus-smart-nav-item${active ? ' active' : ''}`}>
      {icon}
      <span>{label}</span>
    </div>
  )
}

function TaurusMark() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="48" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="42 12 30 10" />
      <circle cx="60" cy="60" r="33" fill="none" stroke="currentColor" strokeWidth="5" opacity=".82" />
      <path d="M58 33c12 12 9 23 2 34-4 6-4 14 5 19-22-3-26-18-16-32 6-9 5-15 9-21Z" fill="currentColor" opacity=".92" />
      <path d="M44 82c25 10 47-2 51-25" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path d="M26 74c17 23 48 31 76 10" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}

function TargetTabIcon({ type }) {
  if (type === 'color') {
    return (
      <span className="taurus-smart-color-dots">
        <i className="g" />
        <i className="r" />
        <i className="y" />
        <i className="b" />
      </span>
    )
  }

  if (type === 'duel') {
    return <CrosshairIcon />
  }

  return <HumanIcon />
}

function HumanIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="4" r="2" />
      <path d="M12 6v13M8 22l4-6 4 6M7 10l5-3 5 3M8 10v7M16 10v7" />
    </svg>
  )
}

function CrosshairIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
    </svg>
  )
}

function EntryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4l11-11-4-4L4 16v4Z" />
      <path d="M13 7l4 4" />
    </svg>
  )
}

function OutputIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20V10" />
      <path d="M10 20V5" />
      <path d="M16 20v-8" />
      <path d="M22 20V3" />
      <path d="M2 20h22" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 17l5-5 4 4 7-9" />
      <path d="M17 7h3v3" />
      <circle cx="4" cy="17" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="13" cy="16" r="1" />
    </svg>
  )
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M10 6h18l8 8v28H10z" fill="#fff" />
      <path d="M28 6v8h8" fill="none" stroke="#cbd5e1" strokeWidth="2" />
      <rect x="12" y="23" width="12" height="12" rx="2" fill="#ef4444" />
      <text x="18" y="32" textAnchor="middle" fill="#fff" fontSize="6" fontWeight="900">PDF</text>
    </svg>
  )
}

function AthleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="7" r="4" />
      <path d="M4 22c1-5 4-8 8-8s7 3 8 8" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  )
}

function TrendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14l6-6M10 8h4v4" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 11.5a8.5 8.5 0 0 1-9.8 8.4L4 22l2.1-6.4A8.5 8.5 0 1 1 21 11.5Z" />
    </svg>
  )
}

function TargetSmallIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M15 9l5-5M18 4h2v2" />
    </svg>
  )
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0))}%`
}

function formatOptionalPercent(value) {
  if (value === null || value === undefined || value === '') return '-'
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return '-'
  return formatPercent(numberValue)
}

function clampPercent(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return 0
  return Math.min(100, Math.max(0, Math.round(numberValue)))
}

function formatSeconds(value) {
  if (value === null || value === undefined || value === '') return '-'
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return '-'
  return `${Math.round(numberValue * 10) / 10} Seg`
}

function formatSessionsCount(value) {
  const count = Number(value || 0)
  return count === 1 ? '1 treino aprovado' : `${count} treinos aprovados`
}

function shortDate(value) {
  return value?.slice(0, 5) || ''
}

function trendLabel(value, t) {
  if (value === 'IMPROVING' || value === 'CONSISTENT_IMPROVEMENT') return t.smartChart.trendLabels.improving
  if (value === 'DECLINING' || value === 'CONSISTENT_DECLINE') return t.smartChart.trendLabels.declining
  if (value === 'STABLE' || value === 'STABLE_PATTERN') return t.smartChart.trendLabels.stable
  if (value === 'INSUFFICIENT_DATA') return t.smartChart.trendLabels.insufficient
  return t.smartChart.trendLabels.oscillation
}

function trendSymbol(value) {
  if (value === 'IMPROVING' || value === 'CONSISTENT_IMPROVEMENT') return '↗'
  if (value === 'DECLINING' || value === 'CONSISTENT_DECLINE') return '↘'
  if (value === 'INSUFFICIENT_DATA') return '-'
  return '⊖'
}

function trendClass(value) {
  if (value === 'IMPROVING' || value === 'CONSISTENT_IMPROVEMENT') return 'green-text'
  if (value === 'DECLINING' || value === 'CONSISTENT_DECLINE') return 'red-text'
  return ''
}

function resolveTrainingText(value) {
  if (!value) return '-'
  if (typeof value === 'string' || typeof value === 'number') return value
  return value['pt-BR'] || value.pt || value['en-US'] || value.en || '-'
}

export default TaurusSmartChart
