import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

function RhythmTransferChart({ transferComparison }) {
  const rows = transferComparison?.rows || []
  const expectedNext = transferComparison?.expectedNext ?? null

  if (!rows.length) {
    return <p>Sem dados de Transfer Comparison.</p>
  }

  return (
    <section className="panel">
      <h2>Transfer Comparison</h2>

      <p className="chart-subtitle">
        Training / Simulation performance vs Competition performance with transfer trend
      </p>

      <div className="cards">
        <div className="card">
          <span>Expected Next Competition</span>
          <strong>{expectedNext ?? '-'}</strong>
        </div>

        <div className="card">
          <span>Data Points</span>
          <strong>{rows.length}</strong>
        </div>
      </div>

      <div className="chart-box">
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="label" />

            <YAxis domain={['auto', 'auto']} />

            <Tooltip />

            <Legend />

            <Line
              type="monotone"
              dataKey="trainingSimulation"
              name="Training + Simulation"
              stroke="#2563eb"
              strokeWidth={3}
              connectNulls
              dot
            />

            <Line
              type="monotone"
              dataKey="competition"
              name="Competition"
              stroke="#dc2626"
              strokeWidth={3}
              connectNulls
              dot
            />

            <Line
              type="monotone"
              dataKey="transferTrend"
              name="Log Transfer Trend"
              stroke="#111827"
              strokeWidth={3}
              strokeDasharray="8 6"
              connectNulls
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export default RhythmTransferChart
