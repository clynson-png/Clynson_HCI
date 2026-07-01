function RhythmMainChart({ data = [], discipline = 'RIFLE' }) {
  const width = 980
  const height = 360
  const padding = { top: 36, right: 58, bottom: 42, left: 58 }

  const leftMin = 0
  const leftMax = 2.5
  const rightMin = discipline === 'RIFLE' ? 9.5 : 8.5
  const rightMax = discipline === 'RIFLE' ? 10.9 : 10.9

  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const leftTicks = [0, 0.5, 1.5, 2, 2.5]
  const rightTicks =
  discipline === 'RIFLE' ? [9.5, 10.0, 10.5, 10.9] : [8.5, 9, 9.5, 10, 10.9]

const referenceValue = discipline === 'RIFLE' ? 10.5 : 9

  function x(index) {
    const slots = data.length + 1
    return padding.left + ((index + 1) / slots) * chartWidth
  }

  function yLeft(value) {
    return padding.top + ((leftMax - Number(value)) / (leftMax - leftMin)) * chartHeight
  }

  function yRight(value) {
    return padding.top + ((rightMax - Number(value)) / (rightMax - rightMin)) * chartHeight
  }

  function barHeight(value) {
    const safeValue = Math.max(leftMin, Math.min(leftMax, Number(value || 0)))
    return height - padding.bottom - yLeft(safeValue)
  }

  function barY(value) {
    const safeValue = Math.max(leftMin, Math.min(leftMax, Number(value || 0)))
    return yLeft(safeValue)
  }

  function buildMedianLine() {
    return data.map((item) => ({
      value: item.media ?? item.p2 ?? null,
    }))
  }

  function buildLogPrediction(values) {
    const clean = values
      .map((item, index) => ({
        x: index + 1,
        y: Number(item.value),
      }))
      .filter((item) => !Number.isNaN(item.y))

    if (clean.length < 2) return []

    const points = clean.map((item) => ({
      x: Math.log(item.x),
      y: item.y,
    }))

    const avgX = points.reduce((sum, item) => sum + item.x, 0) / points.length
    const avgY = points.reduce((sum, item) => sum + item.y, 0) / points.length

    const numerator = points.reduce(
      (sum, item) => sum + (item.x - avgX) * (item.y - avgY),
      0
    )

    const denominator = points.reduce(
      (sum, item) => sum + (item.x - avgX) ** 2,
      0
    )

    const a = denominator ? numerator / denominator : 0
    const b = avgY - a * avgX

    return [...data, { serie: 'Next' }].map((_, index) => ({
      value: a * Math.log(index + 1) + b,
    }))
  }

  function smoothPath(points, yMapper) {
    const valid = points
      .map((point, index) => ({
        x: x(index),
        y: yMapper(point.value),
        value: point.value,
      }))
      .filter((point) => point.value !== null && point.value !== undefined)

    if (!valid.length) return ''

    return valid
      .map((point, index) => {
        if (index === 0) return `M ${point.x} ${point.y}`

        const previous = valid[index - 1]
        const midX = (previous.x + point.x) / 2

        return `C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`
      })
      .join(' ')
  }

  const medianLine = buildMedianLine()
  const predictionLine = buildLogPrediction(medianLine)

  return (
    <section className="panel">
      <h2>Rhythm Chart Principal</h2>

      <div style={{ padding: 16, overflowX: 'auto' }}>
        <svg width={width} height={height} style={{ background: '#ffffff', border: '1px solid #dbe3ef', borderRadius: 8 }}>
          <text x={padding.left} y={22} fontSize="14" fontWeight="700">
            Rhythm chart principal: barras + linhas
          </text>

          <text x={padding.left} y={38} fontSize="11" fill="#64748b">
            {discipline} | eixo esquerdo: 0–2.5 | eixo direito: {rightMin}–{rightMax}
          </text>

          {leftTicks.map((tick) => (
            <g key={`left-${tick}`}>
              <line x1={padding.left} x2={width - padding.right} y1={yLeft(tick)} y2={yLeft(tick)} stroke="#e5e7eb" />
              <text x={padding.left - 10} y={yLeft(tick) + 4} fontSize="11" textAnchor="end" fill="#64748b">
                {tick}
              </text>
            </g>
          ))}

          {rightTicks.map((tick) => (
            <text key={`right-${tick}`} x={width - padding.right + 10} y={yRight(tick) + 4} fontSize="11" fill="#7c3aed">
              {tick}
            </text>
          ))}

          <line x1={padding.left} x2={padding.left} y1={padding.top} y2={height - padding.bottom} stroke="#94a3b8" />
          <line x1={width - padding.right} x2={width - padding.right} y1={padding.top} y2={height - padding.bottom} stroke="#7c3aed" />
          <line x1={padding.left} x2={width - padding.right} y1={height - padding.bottom} y2={height - padding.bottom} stroke="#94a3b8" />

		<line
  x1={padding.left}
  x2={width - padding.right}
  y1={yRight(referenceValue)}
  y2={yRight(referenceValue)}
  stroke="#9333ea"
  strokeWidth="2"
  strokeDasharray="6 6"
/>

<text
  x={width - padding.right - 8}
  y={yRight(referenceValue) - 6}
  fontSize="11"
  textAnchor="end"
  fill="#9333ea"
>
  Reference {referenceValue}
</text>

          {data.map((item, index) => {
            const groupX = x(index)
            const barWidth = 10
            const gap = 3

            const stdValue = Math.abs(Number(item.std || 0))
            const dropValue = Math.abs(Number(item.dropDepth || 0))
            const breakValue = Math.abs(Number(item.breakCount || 0))

            return (
              <g key={`bars-${item.serie}`}>
                <rect x={groupX - barWidth - gap - barWidth / 2} y={barY(stdValue)} width={barWidth} height={barHeight(stdValue)} fill="#16a34a" rx="3" />
                <rect x={groupX - barWidth / 2} y={barY(dropValue)} width={barWidth} height={barHeight(dropValue)} fill="#dc2626" rx="3" />
                <rect x={groupX + barWidth + gap - barWidth / 2} y={barY(breakValue)} width={barWidth} height={barHeight(breakValue)} fill="#f59e0b" rx="3" />
              </g>
            )
          })}

          <path d={smoothPath(medianLine, yRight)} fill="none" stroke="#2563eb" strokeWidth="3" />

          <path d={smoothPath(predictionLine, yRight)} fill="none" stroke="#dc2626" strokeWidth="2" strokeDasharray="8 6" />

{medianLine.map((point, index) => {
  if (point.value === null || point.value === undefined) return null

  return (
    <g key={`median-point-${index}`}>
      <circle
        cx={x(index)}
        cy={yRight(point.value)}
        r="4"
        fill="#2563eb"
        stroke="#ffffff"
        strokeWidth="2"
      />
      <text
        x={x(index)}
        y={yRight(point.value) - 10}
        fontSize="10"
        textAnchor="middle"
        fill="#1d4ed8"
        fontWeight="700"
      >
        {Number(point.value).toFixed(2)}
      </text>
    </g>
  )
})}

{predictionLine.length > 0 && (
  <circle
    cx={x(predictionLine.length - 1)}
    cy={yRight(predictionLine[predictionLine.length - 1].value)}
    r="5"
    fill="#dc2626"
    stroke="#ffffff"
    strokeWidth="2"
  />
)}

          {data.map((item, index) => (
            <text key={item.serie} x={x(index)} y={height - 14} fontSize="11" textAnchor="middle" fill="#475569">
              {item.serie}
            </text>
          ))}

          <text x={x(data.length)} y={height - 14} fontSize="11" textAnchor="middle" fill="#475569">
            Next
          </text>
        </svg>

        <div style={{ display: 'flex', gap: 16, paddingTop: 8, flexWrap: 'wrap' }}>
          <span><strong style={{ color: '#16a34a' }}>■</strong> STD</span>
          <span><strong style={{ color: '#dc2626' }}>■</strong> Drop Depth</span>
          <span><strong style={{ color: '#f59e0b' }}>■</strong> Break Count</span>
          <span><strong style={{ color: '#2563eb' }}>━</strong> Median shot value</span>
          <span><strong style={{ color: '#dc2626' }}>- -</strong> Log prediction</span>
	  <span><strong style={{ color: '#9333ea' }}>- -</strong> Reference</span>
        </div>
      </div>
    </section>
  )
}

export default RhythmMainChart
