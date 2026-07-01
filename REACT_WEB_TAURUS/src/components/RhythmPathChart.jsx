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

function RhythmPathChart({ data = [] }) {
  if (!data.length) {
    return <p>Sem dados de Rhythm Transfer Analysis.</p>
  }

  return (
    <section className="panel">
      <h2>Rhythm Transfer Analysis</h2>

      <p className="chart-subtitle">
        Current Session vs Training Median vs Competition Median by Series
      </p>

      <div className="chart-box">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="serie" />

            <YAxis domain={[9.5, 10.9]} />

            <Tooltip />

            <Legend />

            <Line
              type="monotone"
              dataKey="currentSession"
              name="Current Session"
              stroke="#2563eb"
              strokeWidth={3}
              dot
            />

            <Line
              type="monotone"
              dataKey="trainingMedian"
              name="Training + Simulation Median"
              stroke="#16a34a"
              strokeWidth={3}
              dot
            />

            <Line
              type="monotone"
              dataKey="competitionMedian"
              name="Competition Median"
              stroke="#dc2626"
              strokeWidth={3}
              dot
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export default RhythmPathChart