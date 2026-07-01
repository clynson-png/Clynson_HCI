function VisualFocusMetricsCard({ metrics }) {
  if (!metrics) {
    return (
      <div className="visual-focus-metrics-card">
        <span>Visual Focus Drill</span>
        <strong>-</strong>
        <p>Execute a descida para gerar a leitura visual.</p>
      </div>
    )
  }

  return (
    <div className="visual-focus-metrics-card">
      <span>Visual Discipline Score</span>
      <strong>{metrics.visualDisciplineScore}</strong>
      <p>{metrics.interpretation}</p>

      <div className="visual-focus-metric-grid">
        <Metric label="Following" value={`${metrics.followingMovingObjectPct}%`} />
        <Metric label="Black circle" value={`${metrics.blackCircleFixationPct}%`} />
        <Metric label="Y axis error" value={`${metrics.yAxisDeviationPct}%`} />
        <Metric label="Lost focus" value={`${metrics.lostFocusPct}%`} />
      </div>
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div>
      <small>{label}</small>
      <b>{value}</b>
    </div>
  )
}

export default VisualFocusMetricsCard
