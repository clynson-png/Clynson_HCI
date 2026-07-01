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

function FullAthleteTimelineChart({ data = [] }) {
  if (!data.length) {
    return <p>No timeline data available.</p>
  }

  return (
    <section className="panel">
      <h2>Full Athlete Result Timeline</h2>

      <p className="chart-subtitle">
        Complete performance history across training, simulation and competition
      </p>

      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={data}>
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
        </LineChart>
      </ResponsiveContainer>
    </section>
  )
}

export default FullAthleteTimelineChart
