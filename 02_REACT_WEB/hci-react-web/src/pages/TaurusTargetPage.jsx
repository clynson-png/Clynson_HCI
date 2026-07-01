import { useEffect, useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import {
  loadTaurusTargetSessions,
  saveTaurusTargetSession,
} from '../services/taurusTargetStore'
import { analyzeTaurusHumanoidSession } from '../services/taurusHumanoidIntelligence'
import { analyzeTaurusColorSession } from '../services/taurusColorIntelligence'
import { analyzeTaurusDuelSession } from '../services/taurusDuelIntelligence'
import humanoidTargetImage from '../assets/taurus-humanoid-real.png'
import duelTargetImage from '../assets/taurus-duel20-real.png'

const ENTRY_DEFINITIONS = {
  HUMANOID: {
    label: 'Humanoide',
    sessionLabel: 'TAURUS Humanoide',
    accent: '#9f1239',
    defaultMaxShots: 20,
    zones: [
      { zoneCode: 'ALPHA_HEAD', zoneLabel: 'Alpha Cabeca', color: '#f97316' },
      { zoneCode: 'ALPHA_TORSO', zoneLabel: 'Alpha Torax', color: '#dc2626' },
      { zoneCode: 'CHARLIE_LEFT', zoneLabel: 'Charlie Esq.', color: '#2563eb' },
      { zoneCode: 'CHARLIE_CENTER', zoneLabel: 'Charlie Centro', color: '#7c3aed' },
      { zoneCode: 'DELTA_LEFT', zoneLabel: 'Delta Esq.', color: '#0f766e' },
      { zoneCode: 'DELTA_RIGHT', zoneLabel: 'Delta Dir.', color: '#14b8a6' },
      { zoneCode: 'CHARLIE_RIGHT', zoneLabel: 'Charlie Dir.', color: '#0ea5e9' },
      { zoneCode: 'DELTA_LOWER', zoneLabel: 'Delta Inferior', color: '#e11d48' },
    ],
  },
  COLOR: {
    label: 'Cartões Coloridos',
    sessionLabel: 'TAURUS Cartões Coloridos',
    accent: '#0f766e',
    defaultMaxShots: 8,
    zones: [
      { zoneCode: 'YELLOW', zoneLabel: 'Amarelo', color: '#facc15' },
      { zoneCode: 'GREEN', zoneLabel: 'Verde', color: '#84cc16' },
      { zoneCode: 'RED', zoneLabel: 'Vermelho', color: '#ef4444' },
      { zoneCode: 'BLUE', zoneLabel: 'Azul', color: '#0ea5e9' },
    ],
  },
  DUEL20: {
    label: 'Duelo 20',
    sessionLabel: 'TAURUS Duelo 20',
    accent: '#1d4ed8',
    defaultMaxShots: 20,
    zones: [
      { zoneCode: 'N', zoneLabel: 'N', color: '#ef4444', angle: -90 },
      { zoneCode: 'NE', zoneLabel: 'NE', color: '#f97316', angle: -45 },
      { zoneCode: 'E', zoneLabel: 'E', color: '#f59e0b', angle: 0 },
      { zoneCode: 'SE', zoneLabel: 'SE', color: '#84cc16', angle: 45 },
      { zoneCode: 'S', zoneLabel: 'S', color: '#22c55e', angle: 90 },
      { zoneCode: 'SW', zoneLabel: 'SW', color: '#06b6d4', angle: 135 },
      { zoneCode: 'W', zoneLabel: 'W', color: '#3b82f6', angle: 180 },
      { zoneCode: 'NW', zoneLabel: 'NW', color: '#8b5cf6', angle: 225 },
    ],
  },
}

function TaurusTargetPage({ athletes = [], selectedAthlete, onAthleteChange }) {
  const [sessions, setSessions] = useState([])
  const [activeArea, setActiveArea] = useState('ENTRY')
  const [activeEntryType, setActiveEntryType] = useState('HUMANOID')
  const [duelMode, setDuelMode] = useState('25M')
  const [notes, setNotes] = useState('')
  const [counts, setCounts] = useState(() => buildCounts('HUMANOID'))
  const [maxShots, setMaxShots] = useState(ENTRY_DEFINITIONS.HUMANOID.defaultMaxShots)
  const [duelShots, setDuelShots] = useState(() => buildDuelShots())

  useEffect(() => {
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
  }, [])

  useEffect(() => {
    setCounts(buildCounts(activeEntryType))
    setNotes('')
    setMaxShots(ENTRY_DEFINITIONS[activeEntryType].defaultMaxShots)
    setDuelMode('25M')
    setDuelShots(buildDuelShots())
  }, [activeEntryType])

  const athleteOptions = athletes.length > 0 ? athletes : ['ATLETA_TAURUS']
  const currentAthlete = selectedAthlete || athleteOptions[0]
  const entryDefinition = ENTRY_DEFINITIONS[activeEntryType]
  const selectedSessions = useMemo(
    () => sessions.filter((session) => session.athleteName === currentAthlete),
    [currentAthlete, sessions]
  )
  const latestHumanoid = selectedSessions.find((session) => session.targetType === 'HUMANOID') || null
  const latestColor = selectedSessions.find((session) => session.targetType === 'COLOR') || null
  const latestDuel = selectedSessions.find((session) => session.targetType === 'DUEL20') || null

  async function handleSaveEntry() {
    const duelPayload = activeEntryType === 'DUEL20' ? buildDuelSessionPayload(duelShots, entryDefinition.zones, duelMode) : null

    const hits = activeEntryType === 'DUEL20'
      ? duelPayload.hits
      : entryDefinition.zones.map((zone, index) => ({
          zoneCode: zone.zoneCode,
          zoneLabel: zone.zoneLabel,
          hitCount: Number(counts[zone.zoneCode] || 0),
          displayOrder: index + 1,
          metaJson: JSON.stringify({
            color: zone.color,
            angle: zone.angle ?? null,
          }),
        }))

    const totalShots = activeEntryType === 'DUEL20'
      ? duelPayload.totalShots
      : hits.reduce((sum, item) => sum + item.hitCount, 0)

    const session = {
      sessionId: `TAURUS_${activeEntryType}_${Date.now()}`,
      athleteName: currentAthlete,
      targetType: activeEntryType,
      sessionMode:
        activeEntryType === 'DUEL20'
          ? duelMode
          : activeEntryType === 'COLOR'
            ? 'LINADE_4_CORES'
            : null,
      sessionLabel: entryDefinition.sessionLabel,
      notes: notes.trim(),
      maxShots: Number(maxShots || 0),
      maxScore:
        activeEntryType === 'DUEL20'
          ? getDuelMaxScore(duelMode)
          : activeEntryType === 'COLOR'
            ? 40
            : null,
      totalShots,
      totalScore: activeEntryType === 'DUEL20' ? duelPayload.totalScore : null,
      shotDetailsJson: activeEntryType === 'DUEL20' ? JSON.stringify(duelPayload.shots) : null,
      recordedAt: Date.now(),
      updatedAt: Date.now(),
      hits,
    }

    await saveTaurusTargetSession(session)
    const nextSessions = await loadTaurusTargetSessions()
    setSessions(nextSessions)
    setCounts(buildCounts(activeEntryType))
    setDuelShots(buildDuelShots())
    setNotes('')
    setActiveArea('OUTPUT')
  }

  return (
    <main className="dashboard taurus-page">
      <header className="dashboard-header taurus-header">
        <div>
          <small>TAURUS TARGET</small>
          <h1>Entrada Manual e Performance</h1>
        </div>
        <div className="taurus-header-actions">
          <select
            className="taurus-athlete-select"
            value={currentAthlete}
            onChange={(event) => onAthleteChange?.(event.target.value)}
          >
            {athleteOptions.map((athleteName) => (
              <option key={athleteName} value={athleteName}>
                {athleteName}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="taurus-shell">
        <div className="taurus-main-tabs">
          <button
            type="button"
            className={activeArea === 'ENTRY' ? 'active' : ''}
            onClick={() => setActiveArea('ENTRY')}
          >
            Entrada de Dados
          </button>
          <button
            type="button"
            className={activeArea === 'OUTPUT' ? 'active' : ''}
            onClick={() => setActiveArea('OUTPUT')}
          >
            Saída
          </button>
        </div>

        {activeArea === 'ENTRY' ? (
          <>
            <div className="taurus-entry-tabs">
              {Object.entries(ENTRY_DEFINITIONS).map(([key, definition]) => (
                <button
                  key={key}
                  type="button"
                  className={activeEntryType === key ? 'active' : ''}
                  onClick={() => setActiveEntryType(key)}
                >
                  {definition.label}
                </button>
              ))}
            </div>

            <section className="taurus-entry-grid">
              <div className="panel taurus-panel">
                <h2>{entryDefinition.label}</h2>
                {activeEntryType === 'DUEL20' && (
                  <div className="taurus-duel-rulebar">
                    <button
                      type="button"
                      className={duelMode === '25M' ? 'active' : ''}
                      onClick={() => setDuelMode('25M')}
                    >
                      Duelo 20 - 25m
                    </button>
                    <button
                      type="button"
                      className={duelMode === '10M' ? 'active' : ''}
                      onClick={() => setDuelMode('10M')}
                    >
                      Duelo 20 - 10m
                    </button>
                    <span>20 disparos · 4 séries de 5 · X no centro</span>
                  </div>
                )}
                {activeEntryType === 'COLOR' && (
                  <div className="taurus-color-rulecard">
                    <strong>Prova 4 Cores LINADE</strong>
                    <span>2 séries de 15 segundos · 4 disparos por série · 1 disparo em cada cor</span>
                    <span>1ª série: arma curta em guarda baixa a 45 graus, carregada e travada.</span>
                    <span>2ª série: arma obrigatoriamente na bancada ao sinal do cronômetro.</span>
                  </div>
                )}
                {activeEntryType === 'HUMANOID' && (
                  <div className="taurus-color-rulecard">
                    <strong>Zonas do humanoide</strong>
                    <span>Alpha: cabeça e centro do tórax, pontuação máxima.</span>
                    <span>Charlie: entorno do tórax, pontuação intermediária.</span>
                    <span>Delta: periferia e extremidades, pontuação mínima. Linha vale a zona maior.</span>
                  </div>
                )}
                {activeEntryType === 'DUEL20' ? (
                  <DuelShotEntryTable duelShots={duelShots} onChange={setDuelShots} duelMode={duelMode} />
                ) : (
                  <div className="taurus-manual-grid">
                    {entryDefinition.zones.map((zone) => (
                      <label key={zone.zoneCode} className="taurus-input-card">
                        <span className="taurus-color-dot" style={{ background: zone.color }} />
                        <strong>{zone.zoneLabel}</strong>
                        <input
                          type="number"
                          min="0"
                          value={counts[zone.zoneCode] ?? 0}
                          onChange={(event) =>
                            setCounts((current) => ({
                              ...current,
                              [zone.zoneCode]: Number(event.target.value || 0),
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}

                <div className="taurus-entry-footer">
                  <div className="taurus-total-box">
                    <span>{activeEntryType === 'DUEL20' ? 'Disparos lançados' : 'Impactos registrados'}</span>
                    <strong>{activeEntryType === 'DUEL20' ? countFilledDuelShots(duelShots) : sumCounts(counts)}</strong>
                  </div>
                  {activeEntryType === 'DUEL20' && (
                    <div className="taurus-total-box taurus-total-box-secondary">
                      <span>Somatório de pontos</span>
                      <strong>{calculateDuelScoreTotal(duelShots, duelMode)}</strong>
                    </div>
                  )}
                  <label className="taurus-session-limit">
                    <span>Máximo de disparos da sessão</span>
                    <input
                      type="number"
                      min="0"
                      value={maxShots}
                      onChange={(event) => setMaxShots(Number(event.target.value || 0))}
                    />
                  </label>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Observações da sessão"
                  />
                </div>

                <div className="admin-actions">
                  <button type="button" onClick={handleSaveEntry}>
                    Salvar entrada manual
                  </button>
                </div>
              </div>

              <div className="panel taurus-panel">
                <h2>Pré-visualização</h2>
                {activeEntryType === 'HUMANOID' && (
                  <HumanoidSilhouette counts={counts} definition={entryDefinition} />
                )}
                {activeEntryType === 'COLOR' && (
                  <ColorPreview counts={counts} definition={entryDefinition} />
                )}
                {activeEntryType === 'DUEL20' && (
                  <DuelPreview counts={buildDuelCountsFromShots(duelShots)} definition={entryDefinition} duelMode={duelMode} />
                )}
              </div>
            </section>
          </>
        ) : (
          <section className="taurus-output-grid">
            <section className="panel taurus-panel">
              <h2>Humanoide</h2>
              {latestHumanoid ? (
                <HumanoidRadialChart session={latestHumanoid} />
              ) : (
                <EmptyChartState message="Sem entrada manual de humanoide." />
              )}
            </section>

            <section className="panel taurus-panel">
              <h2>Cartões Coloridos</h2>
              {latestColor ? (
                <ColorPiePerformance session={latestColor} />
              ) : (
                <EmptyChartState message="Sem entrada manual de cartões coloridos." />
              )}
            </section>

            <section className="panel taurus-panel">
              <h2>Duelo 20</h2>
              {latestDuel ? (
                <DuelOctagonChart session={latestDuel} />
              ) : (
                <EmptyChartState message="Sem entrada manual de duelo 20." />
              )}
            </section>
          </section>
        )}
      </section>
    </main>
  )
}

function buildCounts(targetType) {
  return ENTRY_DEFINITIONS[targetType].zones.reduce((accumulator, zone) => {
    accumulator[zone.zoneCode] = 0
    return accumulator
  }, {})
}

function sumCounts(counts) {
  return Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0)
}

function EmptyChartState({ message }) {
  return <div className="taurus-empty-state">{message}</div>
}

function HumanoidSilhouette({ counts, definition }) {
  const total = sumCounts(counts)

  return (
    <div className="taurus-preview">
      <HumanoidTargetBoard>
        {definition.zones.map((zone) => {
          const position = HUMANOID_LAYOUT[zone.zoneCode]
          return (
            <div
              key={zone.zoneCode}
              className="taurus-hit-badge taurus-hit-badge-humanoid"
              style={{ left: position.left, top: position.top, background: zone.color }}
            >
              <span>{counts[zone.zoneCode] || 0}</span>
            </div>
          )
        })}
      </HumanoidTargetBoard>
      <div className="taurus-zone-legend">
        <div className="taurus-zone-pill taurus-zone-pill-alpha">A · Alpha</div>
        <div className="taurus-zone-pill taurus-zone-pill-charlie">C · Charlie</div>
        <div className="taurus-zone-pill taurus-zone-pill-delta">D · Delta</div>
      </div>
      <p>{total} disparos distribuídos manualmente no alvo humanoide.</p>
    </div>
  )
}

function ColorPreview({ counts, definition }) {
  return (
    <div className="taurus-color-preview">
      {definition.zones.map((zone) => (
        <div key={zone.zoneCode} className="taurus-color-card" style={{ background: zone.color }}>
          <div className="taurus-color-card-head">
            <strong>{zone.zoneLabel}</strong>
            <span>{counts[zone.zoneCode] || 0}</span>
          </div>
          <svg viewBox="0 0 180 180" className="taurus-color-target" aria-hidden="true">
            {[56, 40, 24].map((radius) => (
              <circle
                key={radius}
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.92)"
                strokeDasharray="5 7"
                strokeWidth="2.5"
              />
            ))}
            <circle cx="90" cy="90" r="11" fill="#111827" />
            <text x="33" y="94" className="taurus-color-target-label">3</text>
            <text x="55" y="94" className="taurus-color-target-label">4</text>
            <text x="88" y="94" className="taurus-color-target-label">5</text>
            <text x="112" y="94" className="taurus-color-target-label">4</text>
            <text x="138" y="94" className="taurus-color-target-label">3</text>
          </svg>
        </div>
      ))}
    </div>
  )
}

function DuelPreview({ counts, definition, duelMode }) {
  const points = definition.zones.map((zone) => ({
    ...zone,
    value: Number(counts[zone.zoneCode] || 0),
  }))

  return (
    <div className="taurus-preview">
      <DuelTargetBoard duelMode={duelMode} />
      <MiniOctagonPlot points={points} />
      <p>{sumCounts(counts)} impactos distribuídos nas 8 direções.</p>
    </div>
  )
}

function HumanoidRadialChart({ session }) {
  const hits = session.hits || []
  const report = useMemo(() => analyzeTaurusHumanoidSession(session, 'pt-BR'), [session])
  const maxValue = Math.max(...hits.map((item) => Number(item.hitCount || 0)), 1)
  const centerX = 280
  const centerY = 240
  const radius = 130

  const points = hits.map((hit, index) => {
    const angle = (-90 + (360 / hits.length) * index) * (Math.PI / 180)
    const ratio = Number(hit.hitCount || 0) / maxValue
    return {
      ...hit,
      x: centerX + Math.cos(angle) * radius * ratio,
      y: centerY + Math.sin(angle) * radius * ratio,
      labelX: centerX + Math.cos(angle) * (radius + 48),
      labelY: centerY + Math.sin(angle) * (radius + 48),
    }
  })

  const polygon = points.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <div className="taurus-chart-stack">
      <div className="taurus-humanoid-output">
        <div className="taurus-humanoid-stage">
          <HumanoidTargetBoard>
            {hits.map((hit) => {
              const position = HUMANOID_LAYOUT[hit.zoneCode]
              const color = extractColor(hit.metaJson, '#9f1239')

              if (!position) return null

              return (
                <div
                  key={hit.zoneCode}
                  className="taurus-hit-badge taurus-hit-badge-humanoid"
                  style={{ left: position.left, top: position.top, background: color }}
                >
                  <span>{hit.hitCount}</span>
                </div>
              )
            })}
          </HumanoidTargetBoard>
        </div>
        <svg viewBox="0 0 560 480" className="taurus-svg-chart">
          {[0.25, 0.5, 0.75, 1].map((ring) => (
            <circle
              key={ring}
              cx={centerX}
              cy={centerY}
              r={radius * ring}
              fill="none"
              stroke="#dbe7f6"
              strokeWidth="1.5"
            />
          ))}
          {points.map((point) => (
            <g key={point.zoneCode}>
              <line
                x1={centerX}
                y1={centerY}
                x2={point.labelX - (point.labelX > centerX ? 14 : -14)}
                y2={point.labelY}
                stroke="#c3d4ec"
                strokeWidth="1.4"
              />
              <text x={point.labelX} y={point.labelY - 8} textAnchor="middle" className="taurus-axis-label">
                {point.zoneLabel}
              </text>
              <text x={point.labelX} y={point.labelY + 12} textAnchor="middle" className="taurus-axis-value">
                {point.hitCount}
              </text>
            </g>
          ))}
          <polygon points={polygon} fill="rgba(159,18,57,0.18)" stroke="#9f1239" strokeWidth="3" />
          {points.map((point) => (
            <circle key={point.zoneCode} cx={point.x} cy={point.y} r="6" fill="#9f1239" />
          ))}
          {buildScatterDots(points, centerX, centerY, 11).map((dot) => (
            <circle
              key={dot.key}
              cx={dot.x}
              cy={dot.y}
              r="2.6"
              fill={dot.color}
              opacity="0.28"
            />
          ))}
        </svg>
      </div>
      <div className="taurus-chart-meta">
        <strong>{session.totalShots} / {session.maxShots || session.totalShots} disparos</strong>
        <span>{new Date(session.recordedAt).toLocaleString('pt-BR')}</span>
      </div>
      <div className="taurus-report-card">
        <div className="taurus-report-head">
          <div>
            <small>{report.reportTitle}</small>
            <h3>{report.recommendedTraining.title}</h3>
          </div>
          <span className="taurus-report-pill">{translateHumanoidParameter(report.parameter)}</span>
        </div>
        <div className="taurus-report-flow">
          <div className="taurus-premium-card taurus-premium-card-hero">
            <p className="taurus-report-keyphrase">{report.keyPhrase}</p>
            <p className="taurus-report-description">{report.recommendedTraining.description}</p>
          </div>

          {report.recommendedTraining.objective && (
            <div className="taurus-premium-card taurus-premium-card-section">
              <strong>Objetivo do treino</strong>
              <p>{report.recommendedTraining.objective}</p>
            </div>
          )}

          <div className="taurus-report-metrics">
            {report.officialMetrics.map((metric) => (
              <div key={metric.label} className="taurus-report-metric">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>

          <div className="taurus-report-summary-grid">
            {report.recommendedTraining.executionSummary && (
              <div className="taurus-report-summary-card">
                <span>Execução</span>
                <strong>{report.recommendedTraining.executionSummary}</strong>
              </div>
            )}
            {report.recommendedTraining.qualityFocus && (
              <div className="taurus-report-summary-card">
                <span>Foco de qualidade</span>
                <strong>{report.recommendedTraining.qualityFocus}</strong>
              </div>
            )}
            {report.recommendedTraining.loadNote && (
              <div className="taurus-report-summary-card">
                <span>Nota de carga</span>
                <strong>{report.recommendedTraining.loadNote}</strong>
              </div>
            )}
          </div>

          <div className="taurus-report-insights">
            {report.insights.map((insight, index) => (
              <div key={index} className="taurus-premium-card taurus-premium-card-insight">
                <strong>Leitura técnica {index + 1}</strong>
                <p>{insight}</p>
              </div>
            ))}
          </div>

          {report.recommendedTraining.coachCues?.length > 0 && (
            <div className="taurus-report-cues">
              {report.recommendedTraining.coachCues.map((cue, index) => (
                <div key={index} className="taurus-premium-card taurus-premium-card-cue">
                  <strong>Coach cue {index + 1}</strong>
                  <p>{cue}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function HumanoidTargetBoard({ children }) {
  return (
    <div className="taurus-figure taurus-figure-humanoid">
      <img src={humanoidTargetImage} alt="Alvo humanoide" className="taurus-humanoid-photo" />
      {children}
    </div>
  )
}

function DuelShotEntryTable({ duelShots, onChange, duelMode }) {
  const scoreOptions = ['X', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1']
  const directionOptions = ENTRY_DEFINITIONS.DUEL20.zones

  return (
    <div className="taurus-shot-entry-shell">
      <table className="taurus-shot-entry-table">
        <thead>
          <tr>
            <th>S?rie</th>
            {Array.from({ length: 5 }).map((_, index) => (
              <th key={index}>T{index + 1}</th>
            ))}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 4 }).map((_, seriesIndex) => (
            <tr key={seriesIndex}>
              <td className="taurus-shot-series-label">SR{seriesIndex + 1}</td>
              {Array.from({ length: 5 }).map((_, shotIndex) => {
                const absoluteIndex = seriesIndex * 5 + shotIndex
                const shot = duelShots[absoluteIndex]
                return (
                  <td key={absoluteIndex}>
                    <div className="taurus-shot-cell">
                      <select
                        value={shot.score}
                        onChange={(event) => onChange(updateDuelShot(duelShots, absoluteIndex, 'score', event.target.value))}
                      >
                        <option value="">Pts</option>
                        {scoreOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      <select
                        value={shot.directionCode}
                        onChange={(event) => onChange(updateDuelShot(duelShots, absoluteIndex, 'directionCode', event.target.value))}
                      >
                        <option value="">Zona</option>
                        {directionOptions.map((option) => (
                          <option key={option.zoneCode} value={option.zoneCode}>{option.zoneLabel}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                )
              })}
              <td className="taurus-shot-series-total">{calculateDuelScoreTotal(duelShots.slice(seriesIndex * 5, seriesIndex * 5 + 5), duelMode)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ColorPiePerformance({ session }) {
  const report = useMemo(() => analyzeTaurusColorSession(session, 'pt-BR'), [session])
  const pieData = (session.hits || []).map((hit) => ({
    name: hit.zoneLabel,
    value: Number(hit.hitCount || 0),
    color: extractColor(hit.metaJson, '#94a3b8'),
  }))

  return (
    <div className="taurus-chart-stack">
      <div className="taurus-pie-wrap">
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              innerRadius={70}
              outerRadius={118}
              paddingAngle={4}
            >
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="taurus-legend-grid">
        {pieData.map((item) => (
          <div key={item.name} className="taurus-legend-item">
            <span className="taurus-color-dot" style={{ background: item.color }} />
            <strong>{item.name}</strong>
            <span>{item.value}</span>
          </div>
        ))}
      </div>
      <div className="taurus-chart-meta">
        <strong>{session.totalShots} / {session.maxShots || session.totalShots} impactos</strong>
        <span>
          {session.sessionMode === 'LINADE_4_CORES'
            ? 'LINADE 4 cores · 2x15s · 8 disparos · máximo 40'
            : 'Distribuição por cor'}
        </span>
        <span>{new Date(session.recordedAt).toLocaleString('pt-BR')}</span>
      </div>
      <div className="taurus-report-card">
        <div className="taurus-report-head">
          <div>
            <small>{report.reportTitle}</small>
            <h3>{report.recommendedTraining.title}</h3>
          </div>
          <span className="taurus-report-pill">{translateColorParameter(report.parameter)}</span>
        </div>
        <div className="taurus-report-flow">
          <div className="taurus-premium-card taurus-premium-card-hero">
            <p className="taurus-report-keyphrase">{report.keyPhrase}</p>
            <p className="taurus-report-description">{report.recommendedTraining.description}</p>
          </div>

          {report.recommendedTraining.objective && (
            <div className="taurus-premium-card taurus-premium-card-section">
              <strong>Objetivo do treino</strong>
              <p>{report.recommendedTraining.objective}</p>
            </div>
          )}

          <div className="taurus-report-metrics">
            {report.officialMetrics.map((metric) => (
              <div key={metric.label} className="taurus-report-metric">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>

          <div className="taurus-report-summary-grid">
            {report.recommendedTraining.executionSummary && (
              <div className="taurus-report-summary-card">
                <span>Execução</span>
                <strong>{report.recommendedTraining.executionSummary}</strong>
              </div>
            )}
            {report.recommendedTraining.qualityFocus && (
              <div className="taurus-report-summary-card">
                <span>Foco de qualidade</span>
                <strong>{report.recommendedTraining.qualityFocus}</strong>
              </div>
            )}
            {report.recommendedTraining.loadNote && (
              <div className="taurus-report-summary-card">
                <span>Nota de carga</span>
                <strong>{report.recommendedTraining.loadNote}</strong>
              </div>
            )}
          </div>

          <div className="taurus-report-insights">
            {report.insights.map((insight, index) => (
              <div key={index} className="taurus-premium-card taurus-premium-card-insight">
                <strong>Leitura técnica {index + 1}</strong>
                <p>{insight}</p>
              </div>
            ))}
          </div>

          {report.recommendedTraining.coachCues?.length > 0 && (
            <div className="taurus-report-cues">
              {report.recommendedTraining.coachCues.map((cue, index) => (
                <div key={index} className="taurus-premium-card taurus-premium-card-cue">
                  <strong>Coach cue {index + 1}</strong>
                  <p>{cue}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DuelOctagonChart({ session }) {
  const hits = session.hits || []
  const report = useMemo(() => analyzeTaurusDuelSession(session, 'pt-BR'), [session])
  const directionProfile = buildDuelDirectionProfile(session)
  const maxValue = Math.max(...directionProfile.map((item) => Number(item.directionValue || 0)), 1)
  const centerX = 280
  const centerY = 240
  const radius = 146

  const points = hits.map((hit) => {
    const directionData = directionProfile.find((item) => item.zoneCode === hit.zoneCode)
    const angleDeg = extractAngle(hit.metaJson)
    const angle = (angleDeg * Math.PI) / 180
    const ratio = Number(directionData?.directionValue || 0) / maxValue
    return {
      ...hit,
      angleDeg,
      averageScore: Number(directionData?.averageScore || 0),
      x: centerX + Math.cos(angle) * radius * ratio,
      y: centerY + Math.sin(angle) * radius * ratio,
      labelX: centerX + Math.cos(angle) * (radius + 46),
      labelY: centerY + Math.sin(angle) * (radius + 46),
      guideX: centerX + Math.cos(angle) * radius,
      guideY: centerY + Math.sin(angle) * radius,
      color: extractColor(hit.metaJson, '#2563eb'),
    }
  })

  const polygon = points.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <div className="taurus-chart-stack">
      <svg viewBox="0 0 560 480" className="taurus-svg-chart">
        {[0.25, 0.5, 0.75, 1].map((ring) => (
          <polygon
            key={ring}
            points={points
              .map((point) => {
                const angle = (point.angleDeg * Math.PI) / 180
                const px = centerX + Math.cos(angle) * radius * ring
                const py = centerY + Math.sin(angle) * radius * ring
                return `${px},${py}`
              })
              .join(' ')}
            fill="none"
            stroke="#dbe7f6"
            strokeWidth="1.4"
          />
        ))}
        {points.map((point) => (
          <g key={point.zoneCode}>
            <line x1={centerX} y1={centerY} x2={point.guideX} y2={point.guideY} stroke="#c3d4ec" strokeWidth="1.4" />
            <text x={point.labelX} y={point.labelY - 6} textAnchor="middle" className="taurus-axis-label">
              {point.zoneLabel}
            </text>
            <text x={point.labelX} y={point.labelY + 12} textAnchor="middle" className="taurus-axis-value">
              {point.hitCount} · {point.averageScore.toFixed(1)}
            </text>
          </g>
        ))}
        <polygon
          points={polygon}
          fill="rgba(29,78,216,0.18)"
          stroke="#1d4ed8"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        {points.map((point) => (
          <circle key={point.zoneCode} cx={point.x} cy={point.y} r="5.5" fill="#1d4ed8" />
        ))}
        {buildScatterDots(points, centerX, centerY, 13).map((dot) => (
          <circle key={dot.key} cx={dot.x} cy={dot.y} r="2.4" fill={dot.color} opacity="0.32" />
        ))}
      </svg>
      <div className="taurus-chart-meta">
        <strong>{session.totalShots} / {session.maxShots || session.totalShots} impactos</strong>
        <span>
          {session.sessionMode === '10M' ? 'Duelo 20 - 10m · X = 12' : 'Duelo 20 - 25m · X = 10'}
        </span>
      </div>
    </div>
  )
}

function DuelTargetBoard({ duelMode }) {
  return (
    <div className="taurus-duel-target-wrap">
      <img src={duelTargetImage} alt="Alvo Duelo 20" className="taurus-duel-photo" />
      <div className="taurus-duel-board-caption">
        {duelMode === '10M' ? 'Modo 10m: centro branco = X = 12' : 'Modo 25m: centro = X = 10'}
      </div>
    </div>
  )
}

function MiniOctagonPlot({ points }) {
  const centerX = 150
  const centerY = 150
  const radius = 92
  const maxValue = Math.max(...points.map((item) => item.value), 1)

  const chartPoints = points.map((point) => {
    const angle = ((point.angle || 0) * Math.PI) / 180
    const ratio = point.value / maxValue
    return {
      ...point,
      x: centerX + Math.cos(angle) * radius * ratio,
      y: centerY + Math.sin(angle) * radius * ratio,
    }
  })

  return (
    <svg viewBox="0 0 300 300" className="taurus-mini-svg">
      <circle cx={centerX} cy={centerY} r={radius} fill="none" stroke="#dbe7f6" strokeWidth="2" />
      <polygon
        points={chartPoints.map((point) => `${point.x},${point.y}`).join(' ')}
        fill="rgba(29,78,216,0.18)"
        stroke="#1d4ed8"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {chartPoints.map((point) => (
        <circle key={point.zoneCode} cx={point.x} cy={point.y} r="4.5" fill={point.color} />
      ))}
    </svg>
  )
}

function buildScatterDots(points, centerX, centerY, spreadBase) {
  return points.flatMap((point, pointIndex) => {
    const count = Math.max(0, Number(point.hitCount || 0))
    return Array.from({ length: count }).map((_, index) => {
      const angle = ((point.angleDeg ?? -90 + pointIndex * 45) * Math.PI) / 180
      const radius = 22 + ((index % spreadBase) + 1) * 7
      const lane = ((index % 5) - 2) * 4
      return {
        key: `${point.zoneCode}_${index}`,
        x: centerX + Math.cos(angle) * radius - Math.sin(angle) * lane,
        y: centerY + Math.sin(angle) * radius + Math.cos(angle) * lane,
        color: point.color || extractColor(point.metaJson, '#475569'),
      }
    })
  })
}

function buildDuelDirectionProfile(session) {
  const shots = parseShotDetails(session?.shotDetailsJson)
  const maxScore = Math.max(Number(session?.maxScore || 0), 1)
  const totalShots = Math.max(Number(session?.totalShots || 0), 1)

  return ENTRY_DEFINITIONS.DUEL20.zones.map((zone) => {
    const zoneShots = shots.filter((shot) => shot.directionCode === zone.zoneCode)
    const hitCount = zoneShots.length
    const scoreSum = zoneShots.reduce(
      (sum, shot) => sum + parseDuelScoreValue(shot.score, session?.sessionMode || '25M'),
      0
    )
    const averageScore = hitCount > 0 ? scoreSum / hitCount : 0
    const countRatio = hitCount / totalShots
    const distanceRatio = averageScore / maxScore

    return {
      zoneCode: zone.zoneCode,
      hitCount,
      averageScore,
      directionValue: hitCount > 0 ? (countRatio * 0.45) + (distanceRatio * 0.55) : 0,
    }
  })
}

function buildDuelShots() {
  return Array.from({ length: 20 }, (_, index) => ({
    shotNumber: index + 1,
    seriesCode: `SR${Math.floor(index / 5) + 1}`,
    score: '',
    directionCode: '',
  }))
}

function updateDuelShot(currentShots, shotIndex, field, value) {
  return currentShots.map((shot, index) => (
    index === shotIndex
      ? { ...shot, [field]: value }
      : shot
  ))
}

function countFilledDuelShots(duelShots) {
  return duelShots.filter((shot) => String(shot.score || '').trim() !== '' || String(shot.directionCode || '').trim() !== '').length
}

function parseDuelScoreValue(score, duelMode = '25M') {
  const normalized = String(score || '').trim().toUpperCase()
  if (!normalized) return 0
  if (normalized === 'X') return duelMode === '10M' ? 12 : 10
  const numeric = Number(normalized)
  return Number.isNaN(numeric) ? 0 : numeric
}

function calculateDuelScoreTotal(duelShots, duelMode = '25M') {
  return duelShots.reduce((sum, shot) => sum + parseDuelScoreValue(shot.score, duelMode), 0)
}

function buildDuelCountsFromShots(duelShots) {
  return ENTRY_DEFINITIONS.DUEL20.zones.reduce((accumulator, zone) => {
    accumulator[zone.zoneCode] = duelShots.filter((shot) => shot.directionCode === zone.zoneCode).length
    return accumulator
  }, {})
}

function buildDuelSessionPayload(duelShots, zones, duelMode) {
  const zoneMap = new Map(zones.map((zone) => [zone.zoneCode, zone]))
  const hits = zones.map((zone, index) => ({
    zoneCode: zone.zoneCode,
    zoneLabel: zone.zoneLabel,
    hitCount: duelShots.filter((shot) => shot.directionCode === zone.zoneCode).length,
    displayOrder: index + 1,
    metaJson: JSON.stringify({ color: zone.color, angle: zone.angle ?? null }),
  }))

  return {
    hits,
    totalShots: countFilledDuelShots(duelShots),
    totalScore: calculateDuelScoreTotal(duelShots, duelMode),
    shots: duelShots.map((shot, index) => ({
      shotNumber: index + 1,
      seriesCode: `SR${Math.floor(index / 5) + 1}`,
      score: shot.score || '',
      directionCode: shot.directionCode || '',
      directionLabel: zoneMap.get(shot.directionCode)?.zoneLabel || '',
    })),
  }
}

function parseShotDetails(shotDetailsJson) {
  try {
    const parsed = JSON.parse(shotDetailsJson || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function extractColor(metaJson, fallback) {
  try {
    return JSON.parse(metaJson || '{}').color || fallback
  } catch {
    return fallback
  }
}

function extractAngle(metaJson) {
  try {
    return Number(JSON.parse(metaJson || '{}').angle || 0)
  } catch {
    return 0
  }
}

function getDuelMaxScore(duelMode) {
  return duelMode === '10M' ? 240 : 200
}

function translateHumanoidParameter(parameter) {
  const labels = {
    TARGET_POSITION: 'Pior resultado: posição',
    TARGET_AIMING: 'Pior resultado: visada',
    TARGET_TRIGGERING: 'Pior resultado: gatilho',
    TARGET_GRIP: 'Pior resultado: empunhadura',
  }

  return labels[parameter] || 'Pior resultado: visada'
}

function translateColorParameter(parameter) {
  const labels = {
    TARGET_COLOR_IDENTIFICATION: 'Pior resultado: reconhecimento de cor',
    TARGET_AIMING: 'Pior resultado: visada',
    TARGET_TRIGGERING: 'Pior resultado: gatilho',
    TARGET_GRIP: 'Pior resultado: empunhadura',
    TARGET_POSITION: 'Pior resultado: posição',
  }

  return labels[parameter] || 'Pior resultado: visada'
}

const HUMANOID_LAYOUT = {
  ALPHA_HEAD: { left: '50%', top: '14%' },
  ALPHA_TORSO: { left: '50%', top: '43%' },
  CHARLIE_LEFT: { left: '38%', top: '50%' },
  CHARLIE_RIGHT: { left: '62%', top: '50%' },
  CHARLIE_CENTER: { left: '50%', top: '60%' },
  DELTA_LEFT: { left: '28%', top: '37%' },
  DELTA_RIGHT: { left: '72%', top: '37%' },
  DELTA_LOWER: { left: '50%', top: '86%' },
}

export default TaurusTargetPage
