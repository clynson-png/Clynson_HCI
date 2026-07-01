import { useEffect, useMemo, useRef, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
  Bar,
  LabelList,
} from 'recharts'
import {
  loadTaurusTargetSessions,
  saveTaurusTargetSession,
} from '../services/taurusTargetStore'
import { analyzeTaurusHumanoidSession } from '../services/taurusHumanoidIntelligence'
import {
  analyzeTaurusColorSession,
  buildTaurusColorChartModel,
} from '../services/taurusColorIntelligence'
import { analyzeTaurusDuelSession } from '../services/taurusDuelIntelligence'
import humanoidTargetImage from '../assets/taurus-humanoid-real.png'
import duelTargetImage from '../assets/taurus-duel20-real.png'
import taurusLogoWordmark from '../assets/taurus-logo-wordmark.png'
import TaurusSmartChart from '../components/taurus/TaurusSmartChart'
import A4ReportShell from '../components/reports/A4ReportShell'
import PremiumLockedAction from '../components/reports/PremiumLockedAction'
import { translations } from '../i18n/translations'

const DUEL_AUDIO_DEFAULT_PEAK_THRESHOLD_DB = 80
const DUEL_AUDIO_MAX_PEAK_DB = 200
const DUEL_AUDIO_DEFAULT_MIN_PEAK_GAP_MS = 350
const DUEL_AUDIO_MAX_SHOTS = 5
const DUEL_SERIES_MAX_SECONDS = 20
const COLOR_AUDIO_MAX_SHOTS = 4
const COLOR_SERIES_MAX_SECONDS = 15
const COLOR_SHOT_SEQUENCE = ['YELLOW', 'GREEN', 'RED', 'BLUE', 'YELLOW', 'GREEN', 'RED', 'BLUE']

const ENTRY_DEFINITIONS = {
  HUMANOID: {
    uiLabel: 'Humanoide',
    sessionLabel: 'TAURUS_HUMANOID',
    sessionUiLabel: 'TAURUS Humanoide',
    accent: '#9f1239',
    defaultMaxShots: 20,
    zones: [
      { zoneCode: 'ALPHA_HEAD', zoneLabel: 'Alpha Head', uiLabel: 'Alfa Cabeça', color: '#f97316' },
      { zoneCode: 'ALPHA_TORSO', zoneLabel: 'Alpha Torso', uiLabel: 'Alfa Tórax', color: '#dc2626' },
      { zoneCode: 'CHARLIE_LEFT', zoneLabel: 'Charlie Left', uiLabel: 'Intermediária Esquerda', color: '#2563eb' },
      { zoneCode: 'CHARLIE_CENTER', zoneLabel: 'Charlie Center', uiLabel: 'Intermediária Centro', color: '#7c3aed' },
      { zoneCode: 'DELTA_LEFT', zoneLabel: 'Delta Left', uiLabel: 'Periférica Esquerda', color: '#0f766e' },
      { zoneCode: 'DELTA_RIGHT', zoneLabel: 'Delta Right', uiLabel: 'Periférica Direita', color: '#14b8a6' },
      { zoneCode: 'CHARLIE_RIGHT', zoneLabel: 'Charlie Right', uiLabel: 'Intermediária Direita', color: '#0ea5e9' },
      { zoneCode: 'DELTA_LOWER', zoneLabel: 'Delta Lower', uiLabel: 'Periférica Inferior', color: '#e11d48' },
    ],
  },
  COLOR: {
    uiLabel: 'Cartões Coloridos',
    sessionLabel: 'TAURUS_COLOR_CARDS',
    sessionUiLabel: 'TAURUS Cartões Coloridos',
    accent: '#0f766e',
    defaultMaxShots: 8,
    zones: [
      { zoneCode: 'YELLOW', zoneLabel: 'Yellow', uiLabel: 'Amarelo', color: '#facc15' },
      { zoneCode: 'GREEN', zoneLabel: 'Green', uiLabel: 'Verde', color: '#84cc16' },
      { zoneCode: 'RED', zoneLabel: 'Red', uiLabel: 'Vermelho', color: '#ef4444' },
      { zoneCode: 'BLUE', zoneLabel: 'Blue', uiLabel: 'Azul', color: '#0ea5e9' },
    ],
  },
  DUEL20: {
    uiLabel: 'Duelo 20',
    sessionLabel: 'TAURUS_DUEL_20',
    sessionUiLabel: 'TAURUS Duelo 20',
    accent: '#1d4ed8',
    defaultMaxShots: 20,
    zones: [
      { zoneCode: 'N', zoneLabel: 'North', uiLabel: 'N', color: '#ef4444', angle: -90 },
      { zoneCode: 'NE', zoneLabel: 'North-East', uiLabel: 'NE', color: '#f97316', angle: -45 },
      { zoneCode: 'E', zoneLabel: 'East', uiLabel: 'E', color: '#f59e0b', angle: 0 },
      { zoneCode: 'SE', zoneLabel: 'South-East', uiLabel: 'SE', color: '#84cc16', angle: 45 },
      { zoneCode: 'S', zoneLabel: 'South', uiLabel: 'S', color: '#22c55e', angle: 90 },
      { zoneCode: 'SW', zoneLabel: 'South-West', uiLabel: 'SW', color: '#06b6d4', angle: 135 },
      { zoneCode: 'W', zoneLabel: 'West', uiLabel: 'W', color: '#3b82f6', angle: 180 },
      { zoneCode: 'NW', zoneLabel: 'North-West', uiLabel: 'NW', color: '#8b5cf6', angle: 225 },
    ],
  },
}

function TaurusTargetPage({ athletes = [], selectedAthlete, onAthleteChange, lang = 'pt', subscriptionAccess = {} }) {
  const t = translations[lang] || translations.pt
  const [sessions, setSessions] = useState([])
  const [activeArea, setActiveArea] = useState('ENTRY')
  const [activeEntryType, setActiveEntryType] = useState('HUMANOID')
  const [activeOutputType, setActiveOutputType] = useState('HUMANOID')
  const [duelMode, setDuelMode] = useState('25M')
  const [notes, setNotes] = useState('')
  const [counts, setCounts] = useState(() => buildCounts('HUMANOID'))
  const [rowTimes, setRowTimes] = useState(() => buildRowTimes('HUMANOID'))
  const [maxShots, setMaxShots] = useState(ENTRY_DEFINITIONS.HUMANOID.defaultMaxShots)
  const [durationSeconds, setDurationSeconds] = useState('')
  const [duelShots, setDuelShots] = useState(() => buildDuelShots())
  const [duelSeriesTimes, setDuelSeriesTimes] = useState(() => buildDuelSeriesTimes())
  const [colorShots, setColorShots] = useState(() => buildColorShots())
  const [editingSessionId, setEditingSessionId] = useState(null)
  const [audioStatus, setAudioStatus] = useState('IDLE')
  const [audioSequence, setAudioSequence] = useState([])
  const [audioError, setAudioError] = useState('')
  const [audioCurrentPeak, setAudioCurrentPeak] = useState(0)
  const [audioMaxPeak, setAudioMaxPeak] = useState(0)
  const [audioPeakThresholdDb, setAudioPeakThresholdDb] = useState(DUEL_AUDIO_DEFAULT_PEAK_THRESHOLD_DB)
  const [audioMinPeakGapMs, setAudioMinPeakGapMs] = useState(DUEL_AUDIO_DEFAULT_MIN_PEAK_GAP_MS)
  const [athleteSubmissionJson, setAthleteSubmissionJson] = useState('')
  const audioContextRef = useRef(null)
  const audioStreamRef = useRef(null)
  const audioFrameRef = useRef(0)
  const audioStartAtRef = useRef(0)
  const audioLastPeakAtRef = useRef(0)
  const audioPeakThresholdDbRef = useRef(DUEL_AUDIO_DEFAULT_PEAK_THRESHOLD_DB)
  const audioMinPeakGapMsRef = useRef(DUEL_AUDIO_DEFAULT_MIN_PEAK_GAP_MS)

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
    stopDuelAudioCapture()
    setCounts(buildCounts(activeEntryType))
    setRowTimes(buildRowTimes(activeEntryType))
    setNotes('')
    setMaxShots(ENTRY_DEFINITIONS[activeEntryType].defaultMaxShots)
    setDurationSeconds('')
    setDuelMode('25M')
    setDuelShots(buildDuelShots())
    setDuelSeriesTimes(buildDuelSeriesTimes())
    setColorShots(buildColorShots())
    setAudioSequence([])
    setAudioError('')
  }, [activeEntryType])

  useEffect(() => {
    return () => {
      stopDuelAudioCapture()
    }
  }, [])

  useEffect(() => {
    audioPeakThresholdDbRef.current = audioPeakThresholdDb
  }, [audioPeakThresholdDb])

  useEffect(() => {
    audioMinPeakGapMsRef.current = audioMinPeakGapMs
  }, [audioMinPeakGapMs])

  const athleteOptions = athletes.length > 0 ? athletes : ['ATLETA_TAURUS']
  const currentAthlete = selectedAthlete || athleteOptions[0]
  const entryDefinition = ENTRY_DEFINITIONS[activeEntryType]
  const selectedSessions = useMemo(
    () => sessions.filter((session) => session.athleteName === currentAthlete),
    [currentAthlete, sessions]
  )
  const pendingAthleteSessions = useMemo(
    () => selectedSessions.filter((session) => session.workflowStatus === 'PENDING'),
    [selectedSessions]
  )



  useEffect(() => {
  const modifySessionId = sessionStorage.getItem('TAURUS_MODIFY_SESSION_ID')

  if (!modifySessionId || sessions.length === 0) return

  const sessionToEdit = sessions.find((item) => item.sessionId === modifySessionId)

  if (!sessionToEdit) return

  setEditingSessionId(sessionToEdit.sessionId)
  setActiveArea('ENTRY')
  setActiveEntryType(sessionToEdit.targetType)
  setNotes(sessionToEdit.notes || '')
  setMaxShots(sessionToEdit.maxShots || 0)
  setDurationSeconds(sessionToEdit.durationSeconds || '')

  if (sessionToEdit.targetType === 'DUEL20') {
    try {
      const parsedShots = JSON.parse(sessionToEdit.shotDetailsJson || '[]')
      if (Array.isArray(parsedShots) && parsedShots.length > 0) {
        setDuelShots(parsedShots)
        setDuelSeriesTimes(buildDuelSeriesTimesFromShots(parsedShots))
      }
    } catch {
      setDuelShots(buildDuelShots())
      setDuelSeriesTimes(buildDuelSeriesTimes())
    }
  } else {
    const nextCounts = buildCounts(sessionToEdit.targetType)

    ;(sessionToEdit.hits || []).forEach((hit) => {
      nextCounts[hit.zoneCode] = Number(hit.hitCount || 0)
    })

    setCounts(nextCounts)
    setRowTimes(buildRowTimesFromHits(sessionToEdit.targetType, sessionToEdit.hits || []))
  }

  sessionStorage.removeItem('TAURUS_MODIFY_SESSION_ID')
}, [sessions])


  const latestHumanoid = selectedSessions.find((session) => session.targetType === 'HUMANOID') || null
  const latestColor = selectedSessions.find((session) => session.targetType === 'COLOR') || null
  const latestDuel = selectedSessions.find((session) => session.targetType === 'DUEL20') || null
  const latestSession = selectedSessions[0] || null
  const latestHumanoidReport = useMemo(
    () => (latestHumanoid ? analyzeTaurusHumanoidSession(latestHumanoid, 'pt-BR') : null),
    [latestHumanoid]
  )

  const outputSessionMap = {
    HUMANOID: latestHumanoid,
    COLOR: latestColor,
    DUEL20: latestDuel,
  }

  const currentOutputSession = outputSessionMap[activeOutputType] || null
  const latestEntrySession = outputSessionMap[activeEntryType] || null
  const currentA4Report = useMemo(
    () => buildTaurusA4Report(currentOutputSession, activeOutputType, currentAthlete, selectedSessions),
    [activeOutputType, currentAthlete, currentOutputSession, selectedSessions]
  )

  function handleCopyLatestSession() {
    if (!latestEntrySession) return

    setEditingSessionId(null)
    setNotes(latestEntrySession.notes || '')
    setMaxShots(latestEntrySession.maxShots || ENTRY_DEFINITIONS[activeEntryType].defaultMaxShots)
    setDurationSeconds(latestEntrySession.durationSeconds ?? '')

    if (activeEntryType === 'DUEL20') {
      const parsedShots = parseShotDetails(latestEntrySession.shotDetailsJson)
      setDuelMode(latestEntrySession.sessionMode || '25M')
      setDuelShots(parsedShots.length > 0 ? normalizeDuelShots(parsedShots) : buildDuelShots())
      setDuelSeriesTimes(parsedShots.length > 0 ? buildDuelSeriesTimesFromShots(parsedShots) : buildDuelSeriesTimes())
      return
    }

    const nextCounts = buildCounts(activeEntryType)
    ;(latestEntrySession.hits || []).forEach((hit) => {
      nextCounts[hit.zoneCode] = Number(hit.hitCount || 0)
    })
    setCounts(nextCounts)
    setRowTimes(buildRowTimesFromHits(activeEntryType, latestEntrySession.hits || []))
  }

  async function handleSaveEntry() {
    const duelPayload = activeEntryType === 'DUEL20' ? buildDuelSessionPayload(duelShots, entryDefinition.zones, duelMode, duelSeriesTimes) : null
    const colorPayload = activeEntryType === 'COLOR' ? buildColorSessionPayload(colorShots, entryDefinition.zones) : null
    const derivedDurationSeconds = activeEntryType === 'DUEL20'
      ? calculateDuelSessionDurationSeconds(duelPayload.shots, durationSeconds)
      : activeEntryType === 'COLOR'
        ? calculateColorTotalTimeSeconds(colorPayload.shots)
      : calculateRowTimeTotalSeconds(rowTimes)

    const hits = activeEntryType === 'DUEL20'
      ? duelPayload.hits
      : activeEntryType === 'COLOR'
        ? colorPayload.hits
      : entryDefinition.zones.map((zone, index) => ({
          zoneCode: zone.zoneCode,
          zoneLabel: zone.zoneLabel,
          hitCount: Number(counts[zone.zoneCode] || 0),
          displayOrder: index + 1,
          metaJson: JSON.stringify({
            color: zone.color,
            angle: zone.angle ?? null,
            rowTimeSeconds: normalizeSeriesTime(rowTimes[zone.zoneCode]),
          }),
        }))

    const totalShots = activeEntryType === 'DUEL20'
      ? duelPayload.totalShots
      : activeEntryType === 'COLOR'
        ? colorPayload.totalShots
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
      durationSeconds:
        derivedDurationSeconds > 0
          ? derivedDurationSeconds
          : (activeEntryType === 'HUMANOID' || activeEntryType === 'COLOR') && durationSeconds !== ''
            ? Number(durationSeconds)
            : null,
      durationSource:
        activeEntryType === 'DUEL20' && duelPayload?.shots?.some((shot) => shot.audioSequenceStatus === 'SUGGESTED')
          ? 'AUDIO_SEQUENCE'
          : activeEntryType === 'COLOR' && colorPayload?.shots?.some((shot) => shot.audioSequenceStatus === 'SUGGESTED')
            ? 'AUDIO_SEQUENCE'
            : derivedDurationSeconds > 0
              ? 'ROW_SUM'
              : durationSeconds !== ''
                ? 'MANUAL_TOTAL'
                : null,
      totalScore: activeEntryType === 'DUEL20' ? duelPayload.totalScore : null,
      shotDetailsJson:
        activeEntryType === 'DUEL20'
          ? JSON.stringify(duelPayload.shots)
          : activeEntryType === 'COLOR'
            ? JSON.stringify(colorPayload.shots)
            : null,
      recordedAt: Date.now(),
      updatedAt: Date.now(),

      workflowStatus: 'PENDING',

      createdAt: new Date().toISOString(),
      createdBy: 'TAURUS',

      approvedAt: null,
      approvedBy: null,

      archivedAt: null,
      archivedBy: null,

      hits,
    }

    await saveTaurusTargetSession(session)
    const nextSessions = await loadTaurusTargetSessions()
    setSessions(nextSessions)
    setCounts(buildCounts(activeEntryType))
    setRowTimes(buildRowTimes(activeEntryType))
    setDurationSeconds('')
    setDuelShots(buildDuelShots())
    setDuelSeriesTimes(buildDuelSeriesTimes())
    setNotes('')
    setActiveOutputType(activeEntryType)
    setActiveArea('OUTPUT')
    setAthleteSubmissionJson(buildAthleteEntrySubmissionJson(currentAthlete, [session]))
  }

  function handleBuildAthleteSubmissionJson() {
    setAthleteSubmissionJson(buildAthleteEntrySubmissionJson(currentAthlete, pendingAthleteSessions))
  }

  async function handleCopyAthleteSubmissionJson() {
    const payload = athleteSubmissionJson || buildAthleteEntrySubmissionJson(currentAthlete, pendingAthleteSessions)
    setAthleteSubmissionJson(payload)

    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload)
    }
  }

  function handleApproveAudioSequence() {
    if (activeEntryType === 'DUEL20') {
      if (audioSequence.length > 0) {
        const nextDuelShots = applyAudioSequenceToDuelShots(duelShots, audioSequence)
        setDuelShots(nextDuelShots)
        setDuelSeriesTimes(buildDuelSeriesTimesFromCalculatedShots(nextDuelShots))
        setDurationSeconds(String(calculateDuelTotalTimeSeconds(nextDuelShots) || ''))
        setAudioSequence([])
        return
      }
      setDurationSeconds(String(calculateDuelTotalTimeSeconds(duelShots) || ''))
      return
    }

    if (activeEntryType === 'COLOR') {
      if (audioSequence.length > 0) {
        const nextColorShots = applyAudioSequenceToColorShots(colorShots, audioSequence)
        setColorShots(nextColorShots)
        setDurationSeconds(String(calculateColorTotalTimeSeconds(nextColorShots) || ''))
        setAudioSequence([])
        return
      }
      setDurationSeconds(String(calculateColorTotalTimeSeconds(colorShots) || ''))
      return
    }

    setDurationSeconds(String(calculateRowTimeTotalSeconds(rowTimes) || ''))
  }

  async function startDuelAudioCapture() {
    if (!['DUEL20', 'COLOR'].includes(activeEntryType)) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setAudioError('Microfone indisponivel neste navegador.')
      setAudioStatus('ERROR')
      return
    }

    stopDuelAudioCapture()
    setAudioSequence([])
    setAudioError('')
    setAudioCurrentPeak(0)
    setAudioMaxPeak(0)
    setAudioStatus('LISTENING')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      const audioContext = new AudioContextClass()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)

      audioStreamRef.current = stream
      audioContextRef.current = audioContext
      audioStartAtRef.current = performance.now()
      audioLastPeakAtRef.current = 0

      const samples = new Uint8Array(analyser.fftSize)

      function detect() {
        analyser.getByteTimeDomainData(samples)
        const peak = calculateAudioPeak(samples)
        const now = performance.now()
        const elapsedSeconds = (now - audioStartAtRef.current) / 1000
        const enoughGap = now - audioLastPeakAtRef.current > audioMinPeakGapMsRef.current
        const peakDb = convertAudioPeakToDb(peak)

        setAudioCurrentPeak(peakDb)
        setAudioMaxPeak((current) => Math.max(current, peakDb))

        if (peakDb >= audioPeakThresholdDbRef.current && enoughGap) {
          audioLastPeakAtRef.current = now
          setAudioSequence((current) => {
            const maxAudioShots = activeEntryType === 'COLOR' ? COLOR_AUDIO_MAX_SHOTS : DUEL_AUDIO_MAX_SHOTS
            if (current.length >= maxAudioShots) return current
            const previousAt = current[current.length - 1]?.elapsedSeconds || 0
            const partialSeconds = Math.max(0.1, elapsedSeconds - previousAt)
            return [
              ...current,
              {
                shotIndex: current.length + 1,
                elapsedSeconds: roundSeconds(elapsedSeconds),
                partialSeconds: roundSeconds(partialSeconds),
                peak: peakDb,
              },
            ]
          })
        }

        audioFrameRef.current = window.requestAnimationFrame(detect)
      }

      audioFrameRef.current = window.requestAnimationFrame(detect)
    } catch (error) {
      setAudioError(error?.message || 'Nao foi possivel iniciar o microfone.')
      setAudioStatus('ERROR')
      stopDuelAudioCapture()
    }
  }

  function handleUseMaxPeakAsThreshold() {
    if (audioMaxPeak <= 0) return
    setAudioPeakThresholdDb(audioMaxPeak)
  }

  function handleClearAudioSequence() {
    stopDuelAudioCapture()
    setAudioSequence([])
    setAudioError('')
    setAudioCurrentPeak(0)
    setAudioMaxPeak(0)

    const activeAudioRows = activeEntryType === 'COLOR' ? colorShots : duelShots
    const hasAppliedAudioTiming = activeAudioRows.some((shot) => shot.audioSequenceStatus === 'SUGGESTED')
    if (!hasAppliedAudioTiming) return

    const shouldClearTiming = window.confirm('Limpar tambem os tempos de audio ja lancados na tabela? Pontos e zonas serao preservados.')
    if (!shouldClearTiming) return

    if (activeEntryType === 'COLOR') {
      const nextColorShots = clearAudioTimingFromColorShots(colorShots)
      setColorShots(nextColorShots)
      setDurationSeconds(String(calculateColorTotalTimeSeconds(nextColorShots) || ''))
      return
    }

    const nextDuelShots = clearAudioTimingFromDuelShots(duelShots)
    setDuelShots(nextDuelShots)
    setDuelSeriesTimes(buildDuelSeriesTimesFromCalculatedShots(nextDuelShots))
    setDurationSeconds(String(calculateDuelTotalTimeSeconds(nextDuelShots) || ''))
  }

  function stopDuelAudioCapture() {
    if (audioFrameRef.current) {
      window.cancelAnimationFrame(audioFrameRef.current)
      audioFrameRef.current = 0
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop())
      audioStreamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close?.()
      audioContextRef.current = null
    }

    if (audioStatus === 'LISTENING') {
      setAudioStatus('IDLE')
    }
  }

  function handleGeneratePdfReport() {
    if (!currentOutputSession || typeof window === 'undefined') return
    if (!subscriptionAccess.canExportPdf) {
      window.alert('Exportar PDF e um recurso premium.')
      return
    }

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
    <main className="dashboard dashboard-taurus-target">
      <header className="dashboard-header taurus-page-header">
        <div className="taurus-page-header-brand">
          <img src={taurusLogoWordmark} alt="TAURUS" />
        </div>

        <div className="taurus-page-header-title">
          <small>HCI PERFORMANCE</small>
          <h1>TAURUS TARGET</h1>
        </div>

        <div className="dashboard-header-actions">
          <a
            className="dashboard-action-link"
            href="https://www-dev.taurusshootingacademy.com.br/login"
            target="_blank"
            rel="noreferrer"
          >
            {t.taurusTarget.academy}
          </a>
          <div className="dashboard-header-select">
            <span>{t.common.activeAthlete}</span>
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
        </div>
      </header>

      <div className="dashboard-tabs">
        <button type="button" className={activeArea === 'ENTRY' ? 'active' : ''} onClick={() => setActiveArea('ENTRY')}>
          {t.taurusTarget.tabs.entry}
        </button>
        <button type="button" className={activeArea === 'OUTPUT' ? 'active' : ''} onClick={() => setActiveArea('OUTPUT')}>
          {t.taurusTarget.tabs.output}
        </button>
        <button type="button" className={activeArea === 'SMART_CHART' ? 'active' : ''} onClick={() => setActiveArea('SMART_CHART')}>
          {t.taurusTarget.tabs.smartChart}
        </button>
      </div>

      {activeArea === 'ENTRY' && (
        <section className="dashboard-layout-grid">
          <div className="dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <h2>{entryDefinition.uiLabel}</h2>
                <p className="dashboard-panel-subtitle">{t.taurusTarget.entrySubtitle}</p>
              </div>
            </div>

            <div className="taurus-entry-tabs">
              {Object.entries(ENTRY_DEFINITIONS).map(([key, definition]) => (
                <button
                  key={key}
                  type="button"
                  className={activeEntryType === key ? 'active' : ''}
                  onClick={() => setActiveEntryType(key)}
                >
                  {definition.uiLabel}
                </button>
              ))}
            </div>

            {activeEntryType === 'DUEL20' && (
              <div className="taurus-duel-rulebar">
                <button type="button" className={duelMode === '25M' ? 'active' : ''} onClick={() => setDuelMode('25M')}>
                  Duelo 20 - 25m
                </button>
                <button type="button" className={duelMode === '10M' ? 'active' : ''} onClick={() => setDuelMode('10M')}>
                  Duelo 20 - 10m
                </button>
                <span>{t.taurusTarget.duelRule}</span>
              </div>
            )}

            {(activeEntryType === 'COLOR' || activeEntryType === 'HUMANOID') && (
              <div className="taurus-color-rulecard">
                <strong>{activeEntryType === 'COLOR' ? t.taurusTarget.colorRuleTitle : t.taurusTarget.humanoidRuleTitle}</strong>
                {activeEntryType === 'COLOR' ? (
                  <>
                    {t.taurusTarget.colorRules.map((rule) => <span key={rule}>{rule}</span>)}
                  </>
                ) : (
                  <>
                    {t.taurusTarget.humanoidRules.map((rule) => <span key={rule}>{rule}</span>)}
                  </>
                )}
              </div>
            )}

            {activeEntryType === 'DUEL20' ? (
              <DuelShotEntryTable
                duelShots={duelShots}
                seriesTimes={duelSeriesTimes}
                onChange={setDuelShots}
                onSeriesTimesChange={setDuelSeriesTimes}
                duelMode={duelMode}
                t={t}
              />
            ) : activeEntryType === 'COLOR' ? (
              <ColorShotEntryTable
                colorShots={colorShots}
                onChange={setColorShots}
                definition={entryDefinition}
              />
            ) : (
              <div className="taurus-manual-grid">
                {entryDefinition.zones.map((zone) => (
                  <label key={zone.zoneCode} className="taurus-input-card">
                    <span className="taurus-color-dot" style={{ background: zone.color }} />
                    <strong>{zone.uiLabel || zone.zoneLabel}</strong>
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
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={rowTimes[zone.zoneCode] ?? ''}
                      onChange={(event) =>
                        setRowTimes((current) => ({
                          ...current,
                          [zone.zoneCode]: event.target.value,
                        }))
                      }
                      placeholder="tempo s"
                    />
                  </label>
                ))}
              </div>
            )}

            <div className="taurus-entry-footer">
              <div className="taurus-total-box">
                <span>{activeEntryType === 'DUEL20' ? t.taurusTarget.launchedShots : t.taurusTarget.registeredImpacts}</span>
                <strong>
                  {activeEntryType === 'DUEL20'
                    ? countFilledDuelShots(duelShots)
                    : activeEntryType === 'COLOR'
                      ? countFilledColorShots(colorShots)
                      : sumCounts(counts)}
                </strong>
              </div>
              {activeEntryType === 'DUEL20' && (
                <div className="taurus-total-box taurus-total-box-secondary">
                  <span>{t.taurusTarget.scoreSum}</span>
                  <strong>{calculateDuelScoreTotal(duelShots, duelMode)}</strong>
                </div>
              )}
              <label className="taurus-session-limit">
                <span>{t.taurusTarget.maxShots}</span>
                <input type="number" min="0" value={maxShots} onChange={(event) => setMaxShots(Number(event.target.value || 0))} />
              </label>
              {activeEntryType === 'HUMANOID' && (
                <label className="taurus-session-limit">
                  <span>{t.taurusTarget.twentyShotsTime} (soma)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={calculateRowTimeTotalSeconds(rowTimes) || durationSeconds}
                    onChange={(event) => setDurationSeconds(event.target.value)}
                    placeholder={t.taurusTarget.secondsPlaceholder}
                    readOnly={calculateRowTimeTotalSeconds(rowTimes) > 0}
                  />
                </label>
              )}
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t.taurusTarget.notesPlaceholder} />
            </div>

            {(activeEntryType === 'DUEL20' || activeEntryType === 'COLOR') && (
              <div className="taurus-audio-sequence-panel">
                <div>
                  <span>{activeEntryType === 'COLOR' ? 'Audio Cartoes Coloridos' : 'Audio Duelo 20'}</span>
                  <strong>{audioStatus === 'LISTENING' ? 'Capturando' : 'Sequencia sugerida'}</strong>
                  <small>
                    {audioSequence.length
                      ? `${audioSequence.length}/${activeEntryType === 'COLOR' ? COLOR_AUDIO_MAX_SHOTS : DUEL_AUDIO_MAX_SHOTS} disparos detectados`
                      : activeEntryType === 'COLOR'
                        ? `Inicie a captura para ${getNextColorAudioSeriesStartIndex(colorShots) === 0 ? 'SR1 / T1-T4' : 'SR2 / T5-T8'}.`
                        : `Inicie a captura para ${formatDuelAudioSeriesLabel(getNextDuelAudioSeriesStartIndex(duelShots))}.`}
                  </small>
                  <div className="taurus-audio-peak-grid">
                    <span>Pico atual: {formatAudioPeakDb(audioCurrentPeak)}</span>
                    <span>Pico maximo gravado: {formatAudioPeakDb(audioMaxPeak)}</span>
                    <label>
                      Indicador de disparo (dB)
                      <input
                        type="number"
                        min="1"
                        max={DUEL_AUDIO_MAX_PEAK_DB}
                        step="1"
                        value={audioPeakThresholdDb}
                        onChange={(event) => setAudioPeakThresholdDb(normalizeAudioThresholdDb(event.target.value))}
                      />
                    </label>
                    <label>
                      Intervalo minimo (ms)
                      <input
                        type="number"
                        min="100"
                        max="2000"
                        step="10"
                        value={audioMinPeakGapMs}
                        onChange={(event) => setAudioMinPeakGapMs(normalizeAudioMinPeakGapMs(event.target.value))}
                      />
                    </label>
                    <button type="button" onClick={handleUseMaxPeakAsThreshold} disabled={audioMaxPeak <= 0}>
                      Usar pico maximo
                    </button>
                  </div>
                  {audioSequence.length > 0 && (
                    <div className="taurus-audio-detected-stack">
                      <div className="taurus-audio-detected-label">Tempo no disparo</div>
                      <div className="taurus-audio-detected-times">
                        {audioSequence.map((item) => (
                          <span key={item.shotIndex}>
                            T{item.shotIndex}: {formatCompactSeconds(item.elapsedSeconds)}
                          </span>
                        ))}
                      </div>
                      <div className="taurus-audio-detected-label">Intervalo entre disparos</div>
                      <div className="taurus-audio-detected-times">
                        {audioSequence.map((item) => (
                          <span key={item.shotIndex}>
                            T{item.shotIndex}: {formatCompactSeconds(item.partialSeconds)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {audioError && <small>{audioError}</small>}
                </div>
                <div className="taurus-audio-actions">
                  <button type="button" onClick={startDuelAudioCapture} disabled={audioStatus === 'LISTENING'}>
                    Iniciar audio
                  </button>
                  <button type="button" onClick={stopDuelAudioCapture} disabled={audioStatus !== 'LISTENING'}>
                    Parar audio
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAudioSequence}
                    disabled={
                      audioStatus === 'LISTENING' ||
                      (
                        audioSequence.length === 0 &&
                        !(activeEntryType === 'COLOR' ? colorShots : duelShots).some((shot) => shot.audioSequenceStatus === 'SUGGESTED')
                      )
                    }
                  >
                    Limpar sequencia de audio
                  </button>
                </div>
              </div>
            )}

            <div className="admin-actions">
              <button
                type="button"
                className="taurus-secondary-action"
                onClick={handleCopyLatestSession}
                disabled={!latestEntrySession}
                title={latestEntrySession ? t.taurusTarget.copyLatestTitle : t.taurusTarget.noLatestTitle}
              >
                {t.taurusTarget.copyLatest}
              </button>
              <button
                type="button"
                className="taurus-secondary-action"
                onClick={handleApproveAudioSequence}
              >
                Aprovar sequencia de audio
              </button>
              <button type="button" onClick={handleSaveEntry}>
                {t.taurusTarget.saveManual}
              </button>
            </div>
          </div>

          <div className="dashboard-panel dashboard-preview-panel">
            <h2>{t.taurusTarget.preview}</h2>
            {activeEntryType === 'HUMANOID' && <HumanoidSilhouette counts={counts} definition={entryDefinition} t={t} />}
            {activeEntryType === 'COLOR' && <ColorPreview counts={buildColorCountsFromShots(colorShots)} definition={entryDefinition} />}
            {activeEntryType === 'DUEL20' && <DuelPreview shots={duelShots} definition={entryDefinition} duelMode={duelMode} />}
          </div>
        </section>
      )}

      {activeArea === 'OUTPUT' && (
        <>
          <div className="taurus-output-toolbar">
            <div className="taurus-entry-tabs taurus-target-switcher">
              {Object.entries(ENTRY_DEFINITIONS).map(([key, definition]) => (
                <button
                  key={key}
                  type="button"
                  className={activeOutputType === key ? 'active' : ''}
                  onClick={() => setActiveOutputType(key)}
                >
                  {definition.uiLabel}
                </button>
              ))}
            </div>

            <PremiumLockedAction
              label={t.taurusTarget.generatePdf}
              lockedLabel="PDF Premium"
              description="Exportar PDF e um recurso premium."
              allowed={!!subscriptionAccess.canExportPdf}
              onClick={handleGeneratePdfReport}
              disabled={!currentOutputSession}
            />
          </div>

          <section className="panel taurus-panel taurus-athlete-submission-panel">
            <div>
              <span>Entrada do atleta</span>
              <h2>JSON para envio</h2>
              <p>
                Exporta somente sessoes pendentes de entrada do atleta. Use este conteudo para enviar por WhatsApp quando o envio direto ao Admin ainda nao estiver ativo.
              </p>
            </div>
            <div className="taurus-athlete-submission-actions">
              <button type="button" className="taurus-secondary-action" onClick={handleBuildAthleteSubmissionJson}>
                Gerar JSON
              </button>
              <button type="button" onClick={handleCopyAthleteSubmissionJson} disabled={pendingAthleteSessions.length === 0}>
                Copiar JSON
              </button>
            </div>
            <textarea
              readOnly
              value={athleteSubmissionJson}
              placeholder="O JSON das entradas pendentes aparece aqui."
            />
          </section>

          <section className="taurus-output-focus">
            <section className="panel taurus-panel">
              <div className="taurus-output-header">
                <div>
                  <h2>{ENTRY_DEFINITIONS[activeOutputType].uiLabel}</h2>
                  <p>
                    {currentOutputSession
                      ? `${new Date(currentOutputSession.recordedAt).toLocaleDateString('pt-BR')} · ${getSessionUiLabel(currentOutputSession)}`
                      : t.taurusTarget.noTargetSession}
                  </p>
                </div>

                {activeOutputType === 'HUMANOID' && latestHumanoidReport ? (
                  <div className="taurus-output-insight">
                    <span>{t.taurusTarget.engineReading}</span>
                    <strong>{translateHumanoidParameter(latestHumanoidReport.parameter).replace('Pior resultado: ', '')}</strong>
                  </div>
                ) : null}
              </div>

              {activeOutputType === 'HUMANOID' ? (
                latestHumanoid ? <HumanoidRadialChart session={latestHumanoid} t={t} /> : <EmptyChartState message={t.taurusTarget.noHumanoid} />
              ) : null}

              {activeOutputType === 'COLOR' ? (
                latestColor ? (
                  <ColorPiePerformance
                    session={latestColor}
                    sessions={selectedSessions.filter((item) => item.targetType === 'COLOR')}
                    t={t}
                  />
                ) : <EmptyChartState message={t.taurusTarget.noColor} />
              ) : null}

              {activeOutputType === 'DUEL20' ? (
                latestDuel ? (
                  <DuelOctagonChart
                    session={latestDuel}
                    t={t}
                    onGeneratePdf={handleGeneratePdfReport}
                    canExportPdf={!!subscriptionAccess.canExportPdf}
                  />
                ) : <EmptyChartState message={t.taurusTarget.noDuel} />
              ) : null}

              {currentA4Report && (
                <section className="taurus-a4-preview-panel">
                  <div className="taurus-a4-preview-head">
                    <div>
                      <span>Preview A4 Premium</span>
                      <strong>1 pagina · A4 · margens 2 cm</strong>
                    </div>
                    <PremiumLockedAction
                      label={t.taurusTarget.generatePdf}
                      lockedLabel="PDF Premium"
                      description="Exportar PDF e um recurso premium."
                      allowed={!!subscriptionAccess.canExportPdf}
                      className="taurus-a4-preview-button"
                      onClick={handleGeneratePdfReport}
                    />
                  </div>
                  <TaurusTargetA4Report report={currentA4Report} />
                </section>
              )}
            </section>
          </section>
        </>
      )}

      {activeArea === 'SMART_CHART' && (
        <section className="dashboard-panel dashboard-panel-grid" style={{ margin: '0 32px 24px' }}>
          {subscriptionAccess.canViewSmartChart ? (
            <TaurusSmartChart
              sessions={selectedSessions.filter((session) => session.workflowStatus === 'APPROVED')}
              athleteName={currentAthlete}
              lang={lang}
              subscriptionAccess={subscriptionAccess}
            />
          ) : (
            <section className="smart-chart-locked-state smart-chart-locked-state-embedded">
              <div>
                <span>Smart Chart Premium</span>
                <h1>{t.taurusTarget.tabs.smartChart}</h1>
                <p>Smart Chart e exclusivo para atletas com plano premium.</p>
              </div>
              <PremiumLockedAction
                lockedLabel="Smart Chart"
                description="Smart Chart e um recurso premium."
                allowed={false}
              />
            </section>
          )}
        </section>
      )}
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

function TaurusTargetA4Report({ report }) {
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
    >
      <div className={`a4-target-visual a4-target-visual-${report.targetType.toLowerCase()}`}>
        <div className="a4-target-visual-title">
          <span>{report.visualTitle}</span>
          <strong>{report.visualValue}</strong>
        </div>
        <div className="a4-target-bars">
          {report.visualItems.map((item) => (
            <div key={item.label} className="a4-target-bar-row">
              <span>{item.label}</span>
              <div>
                <i style={{ width: `${item.percent}%` }} />
              </div>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </A4ReportShell>
  )
}

function buildTaurusA4Report(session, activeOutputType, athleteName, selectedSessions = []) {
  if (!session) return null

  const definition = ENTRY_DEFINITIONS[activeOutputType] || ENTRY_DEFINITIONS[session.targetType]
  const recordedAt = session.recordedAt ? new Date(session.recordedAt) : null
  const dateLabel = recordedAt ? recordedAt.toLocaleDateString('pt-BR') : '-'
  const timeLabel = recordedAt ? recordedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'
  const baseMeta = [
    { label: 'Alvo', value: definition?.uiLabel || session.targetType },
    { label: 'Data', value: dateLabel },
    { label: 'Horario', value: timeLabel },
    { label: 'Sessao', value: getSessionUiLabel(session) },
  ]

  if (session.targetType === 'COLOR') {
    return buildColorA4Report(session, athleteName, baseMeta, selectedSessions)
  }

  if (session.targetType === 'DUEL20') {
    return buildDuelA4Report(session, athleteName, baseMeta)
  }

  return buildHumanoidA4Report(session, athleteName, baseMeta)
}

function buildHumanoidA4Report(session, athleteName, baseMeta) {
  const report = analyzeTaurusHumanoidSession(session, 'pt-BR')
  const hits = session.hits || []
  const total = Math.max(Number(session.totalShots || 0), 1)

  return {
    title: 'TAURUS Humanoide',
    subtitle: 'Relatorio tecnico compacto para entrega ao atleta.',
    athleteName,
    targetType: 'HUMANOID',
    metaItems: baseMeta,
    metrics: [
      { label: 'Disparos', value: `${session.totalShots || 0}/${session.maxShots || session.totalShots || 0}` },
      ...normalizeReportMetrics(report.officialMetrics),
    ],
    diagnosis: {
      title: translateHumanoidParameter(report.parameter),
      body: report.keyPhrase,
    },
    recommendation: {
      title: report.recommendedTraining?.title,
      body: report.recommendedTraining?.description || report.recommendedTraining?.objective,
    },
    insights: report.insights || [],
    visualTitle: 'Distribuicao do alvo',
    visualValue: `${session.totalShots || 0} impactos`,
    visualItems: hits.map((hit) => ({
      label: getZoneUiLabel(hit.zoneCode, hit.zoneLabel),
      value: String(hit.hitCount || 0),
      percent: Math.min(100, Math.round((Number(hit.hitCount || 0) / total) * 100)),
    })),
    footer: 'Smart diagnosis generated from approved TAURUS target data.',
  }
}

function buildColorA4Report(session, athleteName, baseMeta, selectedSessions = []) {
  const report = analyzeTaurusColorSession(session, 'pt-BR')
  const hits = session.hits || []
  const total = Math.max(Number(session.totalShots || 0), 1)
  const chartRows = buildTaurusColorChartModel(
    selectedSessions.filter((item) => item.targetType === 'COLOR').length
      ? selectedSessions.filter((item) => item.targetType === 'COLOR')
      : session
  )
  const latestChart = chartRows[chartRows.length - 1] || {}

  return {
    title: 'TAURUS Cartoes Coloridos',
    subtitle: 'Relatorio tecnico compacto para reconhecimento, transicao e execucao.',
    athleteName,
    targetType: 'COLOR',
    metaItems: [
      ...baseMeta,
      { label: 'Regra', value: 'LINADE 4 cores' },
    ],
    metrics: [
      { label: 'Impactos', value: `${session.totalShots || 0}/${session.maxShots || 8}` },
      { label: 'Tempo', value: formatCompactSeconds(session.durationSeconds) },
      { label: 'Impacto %', value: latestChart.impactPercent ? `${latestChart.impactPercent}%` : '-' },
      ...normalizeReportMetrics(report.officialMetrics),
    ],
    diagnosis: {
      title: translateColorParameter(report.parameter),
      body: report.keyPhrase,
    },
    recommendation: {
      title: report.recommendedTraining?.title,
      body: report.recommendedTraining?.description || report.recommendedTraining?.objective,
    },
    insights: report.insights || [],
    visualTitle: 'Distribuicao por cor',
    visualValue: `${session.totalShots || 0} impactos`,
    visualItems: hits.map((hit) => ({
      label: getZoneUiLabel(hit.zoneCode, hit.zoneLabel),
      value: String(hit.hitCount || 0),
      percent: Math.min(100, Math.round((Number(hit.hitCount || 0) / total) * 100)),
    })),
    footer: 'Cores, quantidade e tempo sao preservados como evidencia tecnica.',
  }
}

function buildDuelA4Report(session, athleteName, baseMeta) {
  const report = analyzeTaurusDuelSession(session, 'pt-BR')
  const directionProfile = buildDuelDirectionProfile(session)
  const maxIdd = Math.max(...directionProfile.map((item) => Number(item.idd || 0)), 1)
  const shots = parseShotDetails(session.shotDetailsJson)
  const duelMode = session.sessionMode || '25M'
  const seriesScores = ['SR1', 'SR2', 'SR3', 'SR4'].map((seriesCode) => {
    const seriesShots = shots.filter((shot) => shot.seriesCode === seriesCode)
    return {
      seriesCode,
      score: calculateDuelScoreTotal(seriesShots, duelMode),
      time: seriesShots.find((shot) => shot.seriesTimeSeconds)?.seriesTimeSeconds,
    }
  })

  return {
    title: 'TAURUS Duelo 20',
    subtitle: 'Relatorio tecnico compacto de pontuacao, direcao e tempo por serie.',
    athleteName,
    targetType: 'DUEL20',
    metaItems: [
      ...baseMeta,
      { label: 'Modo', value: duelMode === '10M' ? '10m · X = 12' : '25m · X = 10' },
    ],
    metrics: [
      { label: 'Disparos', value: `${session.totalShots || 0}/${session.maxShots || 20}` },
      { label: 'Pontuacao', value: `${session.totalScore || 0}/${session.maxScore || getDuelMaxScore(duelMode)}` },
      ...seriesScores.map((series) => ({
        label: series.seriesCode,
        value: `${series.score}${series.time ? ` · ${formatCompactSeconds(series.time)}` : ''}`,
      })),
      ...normalizeReportMetrics(report.officialMetrics),
    ],
    diagnosis: {
      title: translateDuelParameter(report.parameter),
      body: report.keyPhrase,
    },
    recommendation: {
      title: report.recommendedTraining?.title,
      body: report.recommendedTraining?.description || report.recommendedTraining?.objective,
    },
    insights: report.insights || [],
    visualTitle: 'IDD direcional',
    visualValue: `${Math.round(directionProfile.reduce((sum, item) => sum + Number(item.idd || 0), 0))} IDD`,
    visualItems: directionProfile.map((item) => ({
      label: getZoneUiLabel(item.zoneCode, item.zoneCode),
      value: `${item.hitCount} · ${Math.round(item.idd)}`,
      percent: Math.min(100, Math.round((Number(item.idd || 0) / maxIdd) * 100)),
    })),
    footer: 'IDD estimado por direcao ate que coordenadas exatas sejam capturadas.',
  }
}

function normalizeReportMetrics(metrics = []) {
  return metrics.map((metric) => ({
    label: metric.label,
    value: metric.value,
  }))
}

function formatCompactSeconds(value) {
  if (value === null || value === undefined || value === '') return '-'
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return '-'
  return `${Math.round(numberValue * 10) / 10}s`
}

function HumanoidSilhouette({ counts, definition, t }) {
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
        <div className="taurus-zone-pill taurus-zone-pill-alpha">{t.taurusTarget.zoneLegendAlpha}</div>
        <div className="taurus-zone-pill taurus-zone-pill-charlie">{t.taurusTarget.zoneLegendCharlie}</div>
        <div className="taurus-zone-pill taurus-zone-pill-delta">{t.taurusTarget.zoneLegendDelta}</div>
      </div>
      <p>{total} disparos distribuídos manualmente no alvo humanóide.</p>
    </div>
  )
}

function ColorPreview({ counts, definition }) {
  return (
    <div className="taurus-color-preview">
      {definition.zones.map((zone) => (
        <div key={zone.zoneCode} className="taurus-color-card" style={{ background: zone.color }}>
          <div className="taurus-color-card-head">
            <strong>{zone.uiLabel || zone.zoneLabel}</strong>
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

function DuelPreview({ shots, definition, duelMode }) {
  const counts = buildDuelCountsFromShots(shots)
  const points = definition.zones.map((zone) => ({
    ...zone,
    value: Number(counts[zone.zoneCode] || 0),
  }))

  return (
    <div className="taurus-preview">
      <DuelTargetBoard duelMode={duelMode}>
        {buildDuelShotMarks(shots, definition.zones, duelMode).map((mark) => (
          <span
            key={mark.key}
            className="taurus-duel-shot-mark"
            style={{ left: `${mark.left}%`, top: `${mark.top}%` }}
            title={`${mark.score} ${mark.directionCode}`}
          />
        ))}
      </DuelTargetBoard>
      <MiniOctagonPlot points={points} />
      <p>{sumCounts(counts)} impactos distribuídos nas 8 direções.</p>
    </div>
  )
}

function HumanoidRadialChart({ session, t }) {
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
                {getZoneUiLabel(point.zoneCode, point.zoneLabel)}
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
              <strong>{t.taurusTarget.trainingObjective}</strong>
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
                <span>{t.taurusTarget.execution}</span>
                <strong>{report.recommendedTraining.executionSummary}</strong>
              </div>
            )}
            {report.recommendedTraining.qualityFocus && (
              <div className="taurus-report-summary-card">
                <span>{t.taurusTarget.qualityFocus}</span>
                <strong>{report.recommendedTraining.qualityFocus}</strong>
              </div>
            )}
            {report.recommendedTraining.loadNote && (
              <div className="taurus-report-summary-card">
                <span>{t.taurusTarget.loadNote}</span>
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
                  <strong>Dicas do treinador {index + 1}</strong>
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
      <div className="taurus-humanoid-brand-mask" aria-hidden="true" />
      {children}
    </div>
  )
}

function DuelShotEntryTable({ duelShots, seriesTimes, onChange, onSeriesTimesChange, duelMode, t }) {
  const scoreOptions = ['X', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1']
  const directionOptions = ENTRY_DEFINITIONS.DUEL20.zones

  return (
    <div className="taurus-shot-entry-shell">
      <div className="taurus-color-sequence-note">
        4 series de 5 tiros. Reinicie o audio a cada serie. Tempo maximo por serie: {DUEL_SERIES_MAX_SECONDS}s.
      </div>
      <table className="taurus-shot-entry-table">
        <thead>
          <tr>
            <th>{t.taurusTarget.tableSeries}</th>
            {Array.from({ length: 5 }).map((_, index) => (
              <th key={index}>T{index + 1}</th>
            ))}
            <th>{t.taurusTarget.time}</th>
            <th>{t.common.total}</th>
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
                        <option value="">{t.taurusTarget.points}</option>
                        {scoreOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      <select
                        value={shot.directionCode}
                        onChange={(event) => onChange(updateDuelShot(duelShots, absoluteIndex, 'directionCode', event.target.value))}
                      >
                        <option value="">{t.taurusTarget.zone}</option>
                        {directionOptions.map((option) => (
                          <option key={option.zoneCode} value={option.zoneCode}>{option.uiLabel || option.zoneLabel}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={shot.shotTimeSeconds ?? ''}
                        onChange={(event) => onChange(updateDuelShot(duelShots, absoluteIndex, 'shotTimeSeconds', event.target.value))}
                        placeholder="s"
                      />
                    </div>
                  </td>
                )
              })}
              <td>
                <strong className="taurus-shot-series-time">
                  {formatCompactSeconds(calculateDuelSeriesTimeSeconds(duelShots, seriesIndex))}
                </strong>
              </td>
              <td className="taurus-shot-series-total">{calculateDuelScoreTotal(duelShots.slice(seriesIndex * 5, seriesIndex * 5 + 5), duelMode)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ColorShotEntryTable({ colorShots, onChange, definition }) {
  const zoneMap = new Map(definition.zones.map((zone) => [zone.zoneCode, zone]))

  return (
    <div className="taurus-shot-entry-shell">
      <div className="taurus-color-sequence-note">
        2 series de 4 tiros. SR1 mede T1-T4; SR2 reinicia o audio e mede T5-T8. Tempo maximo por serie: {COLOR_SERIES_MAX_SECONDS}s.
      </div>
      <table className="taurus-shot-entry-table taurus-color-shot-table">
        <thead>
          <tr>
            <th>Serie</th>
            {Array.from({ length: 4 }).map((_, index) => (
              <th key={index}>Tiro {index + 1}</th>
            ))}
            <th>Tempo</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 2 }).map((_, seriesIndex) => (
            <tr key={seriesIndex}>
              <td className="taurus-shot-series-label">SR{seriesIndex + 1}</td>
              {Array.from({ length: 4 }).map((_, shotIndex) => {
                const absoluteIndex = seriesIndex * 4 + shotIndex
                const shot = colorShots[absoluteIndex]
                const zone = zoneMap.get(shot.zoneCode)
                return (
                  <td key={absoluteIndex}>
                    <div className="taurus-shot-cell taurus-color-shot-cell">
                      <strong style={{ color: zone?.color }}>{zone?.uiLabel || shot.zoneCode}</strong>
                      <span className="taurus-color-shot-number">T{absoluteIndex + 1}</span>
                      <label className="taurus-color-hit-toggle">
                        <input
                          type="checkbox"
                          checked={!!shot.hit}
                          onChange={(event) => onChange(updateColorShot(colorShots, absoluteIndex, 'hit', event.target.checked))}
                        />
                        Impacto
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={shot.shotTimeSeconds ?? ''}
                        onChange={(event) => onChange(updateColorShot(colorShots, absoluteIndex, 'shotTimeSeconds', event.target.value))}
                        placeholder="s"
                      />
                    </div>
                  </td>
                )
              })}
              <td>
                <strong className="taurus-shot-series-time">
                  {formatCompactSeconds(calculateColorSeriesTimeSeconds(colorShots, seriesIndex))}
                </strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ColorPiePerformance({ session, sessions = [], t }) {
  const report = useMemo(() => analyzeTaurusColorSession(session, 'pt-BR'), [session])
  const chartData = useMemo(
    () => buildTaurusColorChartModel(sessions.length ? sessions : session),
    [session, sessions]
  )
  const pieData = (session.hits || []).map((hit) => ({
    name: getZoneUiLabel(hit.zoneCode, hit.zoneLabel),
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
      <div className="taurus-color-time-chart">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 16, right: 28, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: '#cbd5e1', fontSize: 12 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.14)' }}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: '#cbd5e1', fontSize: 12 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.14)' }}
              tickLine={false}
              width={48}
              label={{ value: 'Tempo medido (s)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#fbbf24', fontSize: 12 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.14)' }}
              tickLine={false}
              width={48}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(value) => `${Math.round(value)}%`}
              label={{ value: 'Impactos 0-8 (%)', angle: 90, position: 'insideRight', fill: '#fbbf24', fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#04101d', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc' }}
              formatter={(value, name) => {
                if (name === 'impactPercent') return [`${value}%`, 'Impactos']
                if (name === 'impactCount') return [`${value}/8`, 'Número de impactos']
                if (name === 'measuredTimeSeconds') return [value === null ? '-' : `${value}s`, 'Tempo medido']
                if (name === 'predictedBestTimeSeconds') return [value === null ? '-' : `${value}s`, 'Predição melhor tempo']
                return [value, name]
              }}
            />
            <Bar yAxisId="left" dataKey="measuredTimeSeconds" fill="#2563eb" radius={[10, 10, 0, 0]} barSize={28}>
              <LabelList dataKey="measuredTimeSeconds" position="top" fill="#f8fafc" fontSize={12} />
            </Bar>
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="predictedBestTimeSeconds"
              stroke="#60a5fa"
              strokeWidth={3}
              dot={{ fill: '#60a5fa', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="impactPercent"
              stroke="#fbbf24"
              strokeWidth={3}
              dot={{ fill: '#fbbf24', r: 4 }}
              strokeDasharray="5 3"
            />
          </ComposedChart>
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
              <strong>{t.taurusTarget.trainingObjective}</strong>
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
                <span>{t.taurusTarget.execution}</span>
                <strong>{report.recommendedTraining.executionSummary}</strong>
              </div>
            )}
            {report.recommendedTraining.qualityFocus && (
              <div className="taurus-report-summary-card">
                <span>{t.taurusTarget.qualityFocus}</span>
                <strong>{report.recommendedTraining.qualityFocus}</strong>
              </div>
            )}
            {report.recommendedTraining.loadNote && (
              <div className="taurus-report-summary-card">
                <span>{t.taurusTarget.loadNote}</span>
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
                  <strong>Dicas do treinador {index + 1}</strong>
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

function DuelOctagonChart({ session, t, onGeneratePdf, canExportPdf = false }) {
  const report = useMemo(() => analyzeTaurusDuelSession(session, 'pt-BR'), [session])
  const directionProfile = buildDuelDirectionProfile(session)
  const duelShots = parseShotDetails(session.shotDetailsJson)
  const duelMode = session.sessionMode || '25M'
  const totalIdd = Math.max(directionProfile.reduce((sum, item) => sum + Number(item.idd || 0), 0), 1)
  const centerX = 280
  const centerY = 240
  const radius = 146

  const points = ENTRY_DEFINITIONS.DUEL20.zones.map((zone) => {
    const directionData = directionProfile.find((item) => item.zoneCode === zone.zoneCode)
    const angleDeg = zone.angle
    const angle = (angleDeg * Math.PI) / 180
    const ratio = Number(directionData?.idd || 0) / totalIdd
    return {
      zoneCode: zone.zoneCode,
      zoneLabel: zone.zoneLabel,
      angleDeg,
      averageDistanceMm: Number(directionData?.averageDistanceMm || 0),
      idd: Number(directionData?.idd || 0),
      hitCount: Number(directionData?.hitCount || 0),
      x: centerX + Math.cos(angle) * radius * ratio,
      y: centerY + Math.sin(angle) * radius * ratio,
      labelX: centerX + Math.cos(angle) * (radius + 46),
      labelY: centerY + Math.sin(angle) * (radius + 46),
      guideX: centerX + Math.cos(angle) * radius,
      guideY: centerY + Math.sin(angle) * radius,
      color: zone.color,
    }
  })

  const polygon = points.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <div className="taurus-chart-stack">
      <DuelTargetBoard duelMode={duelMode}>
        {buildDuelShotMarks(duelShots, ENTRY_DEFINITIONS.DUEL20.zones, duelMode).map((mark) => (
          <span
            key={mark.key}
            className="taurus-duel-shot-mark"
            style={{ left: `${mark.left}%`, top: `${mark.top}%` }}
            title={`${mark.score} ${mark.directionCode}`}
          />
        ))}
      </DuelTargetBoard>
      <svg viewBox="0 0 560 480" className="taurus-svg-chart">
        {[0.25, 0.5, 0.75, 1].map((ring) => (
          <polygon
            key={ring}
            points={buildDuelOctagonRingPoints(centerX, centerY, radius * ring)}
            fill="none"
            stroke="#dbe7f6"
            strokeWidth="1.4"
          />
        ))}
        {points.map((point) => (
          <g key={point.zoneCode}>
            <line x1={centerX} y1={centerY} x2={point.guideX} y2={point.guideY} stroke="#c3d4ec" strokeWidth="1.4" />
            <text x={point.labelX} y={point.labelY - 6} textAnchor="middle" className="taurus-axis-label">
              {getZoneUiLabel(point.zoneCode, point.zoneLabel)}
            </text>
            <text x={point.labelX} y={point.labelY + 12} textAnchor="middle" className="taurus-axis-value">
              {point.hitCount} · {point.idd.toFixed(1)}
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
        <PremiumLockedAction
          label={t.taurusTarget.generatePdf}
          lockedLabel="PDF Premium"
          description="Exportar PDF e um recurso premium."
          allowed={canExportPdf}
          className="taurus-duel-pdf-button"
          onClick={onGeneratePdf}
        />
      </div>
      <div className="taurus-report-card">
        <div className="taurus-report-head">
          <div>
            <small>{report.reportTitle}</small>
            <h3>{report.recommendedTraining.title}</h3>
          </div>
          <span className="taurus-report-pill">{translateDuelParameter(report.parameter)}</span>
        </div>
        <div className="taurus-report-flow">
          <div className="taurus-premium-card taurus-premium-card-hero">
            <p className="taurus-report-keyphrase">{report.keyPhrase}</p>
            <p className="taurus-report-description">{report.recommendedTraining.description}</p>
          </div>
          {report.recommendedTraining.objective && (
            <div className="taurus-premium-card taurus-premium-card-section">
              <strong>{t.taurusTarget.trainingObjective}</strong>
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
                <span>{t.taurusTarget.execution}</span>
                <strong>{report.recommendedTraining.executionSummary}</strong>
              </div>
            )}
            {report.recommendedTraining.qualityFocus && (
              <div className="taurus-report-summary-card">
                <span>{t.taurusTarget.qualityFocus}</span>
                <strong>{report.recommendedTraining.qualityFocus}</strong>
              </div>
            )}
            {report.recommendedTraining.loadNote && (
              <div className="taurus-report-summary-card">
                <span>{t.taurusTarget.loadNote}</span>
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
                  <strong>Dicas do treinador {index + 1}</strong>
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

function DuelTargetBoard({ duelMode, children }) {
  return (
    <div className="taurus-duel-target-wrap">
      <div className="taurus-duel-target-stage">
        <img src={duelTargetImage} alt="Alvo Duelo 20" className="taurus-duel-photo" />
        {children}
      </div>
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

function buildDuelOctagonRingPoints(centerX, centerY, radius) {
  return ENTRY_DEFINITIONS.DUEL20.zones
    .map((zone) => {
      const angle = (zone.angle * Math.PI) / 180
      return `${centerX + Math.cos(angle) * radius},${centerY + Math.sin(angle) * radius}`
    })
    .join(' ')
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

function buildDuelShotMarks(shots, zones, duelMode) {
  const zoneMap = new Map(zones.map((zone) => [zone.zoneCode, zone]))
  const maxScore = getDuelMaxScore(duelMode) / 20

  return shots
    .filter((shot) => shot.directionCode)
    .map((shot, index) => {
      const zone = zoneMap.get(shot.directionCode)
      const angle = ((zone?.angle ?? 0) * Math.PI) / 180
      const scoreValue = parseDuelScoreValue(shot.score, duelMode)
      const radialRatio = Math.min(Math.max((maxScore - scoreValue) / Math.max(maxScore - 1, 1), 0), 1)
      const radius = 4 + radialRatio * 36
      const lane = ((index % 5) - 2) * 1.8

      return {
        key: `${shot.seriesCode}_${shot.shotNumber}_${index}`,
        score: shot.score || '-',
        directionCode: shot.directionCode,
        left: 50 + Math.cos(angle) * radius - Math.sin(angle) * lane,
        top: 50 + Math.sin(angle) * radius + Math.cos(angle) * lane,
      }
    })
}

function buildDuelDirectionProfile(session) {
  const shots = parseShotDetails(session?.shotDetailsJson)

  return ENTRY_DEFINITIONS.DUEL20.zones.map((zone) => {
    const zoneShots = shots.filter((shot) => shot.directionCode === zone.zoneCode)
    const hitCount = zoneShots.length
    const distanceSum = zoneShots.reduce(
      (sum, shot) => sum + estimateDuelDistanceMm(shot.score, session?.sessionMode || '25M'),
      0
    )
    const averageDistanceMm = hitCount > 0 ? distanceSum / hitCount : 0
    const idd = hitCount * averageDistanceMm

    return {
      zoneCode: zone.zoneCode,
      hitCount,
      averageDistanceMm,
      idd,
      directionValue: idd,
    }
  })
}

function estimateDuelDistanceMm(score, duelMode = '25M') {
  const maxShotScore = duelMode === '10M' ? 12 : 10
  const scoreValue = parseDuelScoreValue(score, duelMode)
  return Math.max(0, maxShotScore - scoreValue) * 10
}

function buildDuelShots() {
  return Array.from({ length: 20 }, (_, index) => ({
    shotNumber: index + 1,
    seriesCode: `SR${Math.floor(index / 5) + 1}`,
    score: '',
    directionCode: '',
    shotTimeSeconds: '',
    seriesTimeSeconds: null,
  }))
}

function buildColorShots() {
  return COLOR_SHOT_SEQUENCE.map((zoneCode, index) => ({
    shotNumber: index + 1,
    seriesCode: `SR${Math.floor(index / 4) + 1}`,
    zoneCode,
    hit: true,
    shotTimeSeconds: '',
    shotIntervalMs: null,
    audioSequenceIndex: null,
    audioSequenceStatus: null,
    audioElapsedSeconds: null,
    audioPeak: null,
  }))
}

function updateColorShot(currentShots, shotIndex, field, value) {
  return currentShots.map((shot, index) => (
    index === shotIndex
      ? { ...shot, [field]: value }
      : shot
  ))
}

function buildColorCountsFromShots(colorShots = []) {
  return colorShots.reduce((accumulator, shot) => {
    if (!shot.hit) return accumulator
    accumulator[shot.zoneCode] = (accumulator[shot.zoneCode] || 0) + 1
    return accumulator
  }, {})
}

function countFilledColorShots(colorShots = []) {
  return colorShots.filter((shot) => shot.hit).length
}

function buildColorSessionPayload(colorShots = [], zones = []) {
  const zoneMap = new Map(zones.map((zone) => [zone.zoneCode, zone]))
  const countsByZone = buildColorCountsFromShots(colorShots)
  const hits = zones.map((zone, index) => ({
    zoneCode: zone.zoneCode,
    zoneLabel: zone.zoneLabel,
    hitCount: countsByZone[zone.zoneCode] || 0,
    displayOrder: index + 1,
    metaJson: JSON.stringify({
      color: zone.color,
      rowTimeSeconds: calculateColorZoneTimeSeconds(colorShots, zone.zoneCode),
    }),
  }))

  return {
    hits,
    totalShots: countFilledColorShots(colorShots),
    shots: colorShots.map((shot, index) => ({
      shotNumber: index + 1,
      seriesCode: `SR${Math.floor(index / 4) + 1}`,
      zoneCode: shot.zoneCode,
      zoneLabel: zoneMap.get(shot.zoneCode)?.zoneLabel || shot.zoneCode,
      hit: !!shot.hit,
      shotTimeSeconds: normalizeSeriesTime(shot.shotTimeSeconds),
      shotIntervalMs: normalizeSeriesTime(shot.shotTimeSeconds) ? Math.round(normalizeSeriesTime(shot.shotTimeSeconds) * 1000) : null,
      audioSequenceIndex: shot.audioSequenceIndex || null,
      audioSequenceStatus: shot.audioSequenceStatus || null,
      audioElapsedSeconds: normalizeSeriesTime(shot.audioElapsedSeconds),
      audioPeak: shot.audioPeak || null,
      seriesTimeSeconds: calculateColorSeriesTimeSeconds(colorShots, Math.floor(index / 4)),
    })),
  }
}

function normalizeDuelShots(shots) {
  const baseShots = buildDuelShots()

  shots.slice(0, 20).forEach((shot, index) => {
    baseShots[index] = {
      ...baseShots[index],
      ...shot,
      shotNumber: index + 1,
      seriesCode: shot.seriesCode || `SR${Math.floor(index / 5) + 1}`,
      score: shot.score || '',
      directionCode: shot.directionCode || '',
      shotTimeSeconds: shot.shotTimeSeconds ?? '',
      seriesTimeSeconds: shot.seriesTimeSeconds ?? null,
    }
  })

  return baseShots
}

function buildDuelSeriesTimes() {
  return {
    SR1: '',
    SR2: '',
    SR3: '',
    SR4: '',
  }
}

function buildDuelSeriesTimesFromShots(shots) {
  return shots.reduce((accumulator, shot) => {
    const seriesCode = shot.seriesCode || `SR${Math.floor((Number(shot.shotNumber || 1) - 1) / 5) + 1}`
    const timeValue = shot.seriesTimeSeconds
    if (timeValue !== null && timeValue !== undefined && timeValue !== '') {
      accumulator[seriesCode] = String(timeValue)
    }
    return accumulator
  }, buildDuelSeriesTimes())
}

function buildDuelSeriesTimesFromCalculatedShots(shots) {
  return Array.from({ length: 4 }).reduce((accumulator, _, seriesIndex) => ({
    ...accumulator,
    [`SR${seriesIndex + 1}`]: String(calculateDuelSeriesDisplayTimeSeconds(shots, seriesIndex) || ''),
  }), buildDuelSeriesTimes())
}

function updateDuelShot(currentShots, shotIndex, field, value) {
  return currentShots.map((shot, index) => (
    index === shotIndex
      ? { ...shot, [field]: value }
      : shot
  ))
}

function clearAudioTimingFromDuelShots(currentShots = []) {
  return currentShots.map((shot) => {
    if (shot.audioSequenceStatus !== 'SUGGESTED') return shot

    return {
      ...shot,
      shotTimeSeconds: '',
      shotIntervalMs: null,
      audioSequenceIndex: null,
      audioSequenceStatus: null,
      audioElapsedSeconds: null,
      audioPeak: null,
    }
  })
}

function clearAudioTimingFromColorShots(currentShots = []) {
  return currentShots.map((shot) => {
    if (shot.audioSequenceStatus !== 'SUGGESTED') return shot

    return {
      ...shot,
      shotTimeSeconds: '',
      shotIntervalMs: null,
      audioSequenceIndex: null,
      audioSequenceStatus: null,
      audioElapsedSeconds: null,
      audioPeak: null,
    }
  })
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

function buildDuelSessionPayload(duelShots, zones, duelMode, seriesTimes = buildDuelSeriesTimes()) {
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
      shotTimeSeconds: normalizeSeriesTime(shot.shotTimeSeconds),
      shotIntervalMs: normalizeSeriesTime(shot.shotTimeSeconds) ? Math.round(normalizeSeriesTime(shot.shotTimeSeconds) * 1000) : null,
      audioSequenceIndex: shot.audioSequenceIndex || null,
      audioSequenceStatus: shot.audioSequenceStatus || null,
      audioElapsedSeconds: normalizeSeriesTime(shot.audioElapsedSeconds),
      audioPeak: shot.audioPeak || null,
      seriesTimeSeconds: calculateDuelSeriesTimeSeconds(duelShots, Math.floor(index / 5)) || normalizeSeriesTime(seriesTimes[`SR${Math.floor(index / 5) + 1}`]),
    })),
  }
}

function buildRowTimes(targetType) {
  return (ENTRY_DEFINITIONS[targetType]?.zones || []).reduce((accumulator, zone) => {
    accumulator[zone.zoneCode] = ''
    return accumulator
  }, {})
}

function buildRowTimesFromHits(targetType, hits = []) {
  return hits.reduce((accumulator, hit) => {
    const meta = parseJsonObject(hit.metaJson)
    accumulator[hit.zoneCode] = meta.rowTimeSeconds ?? ''
    return accumulator
  }, buildRowTimes(targetType))
}

function calculateRowTimeTotalSeconds(rowTimes = {}) {
  return roundSeconds(
    Object.values(rowTimes).reduce((sum, value) => sum + (normalizeSeriesTime(value) || 0), 0)
  )
}

function calculateColorSeriesTimeSeconds(colorShots = [], seriesIndex = 0) {
  const seriesShots = colorShots.slice(seriesIndex * 4, seriesIndex * 4 + 4)
  const lastTimedShot = [...seriesShots].reverse().find((shot) => normalizeSeriesTime(shot.shotTimeSeconds) > 0)
  return normalizeSeriesTime(lastTimedShot?.shotTimeSeconds)
}

function calculateColorZoneTimeSeconds(colorShots = [], zoneCode = '') {
  const zoneShots = colorShots.filter((shot) => shot.zoneCode === zoneCode)
  const lastTimedShot = [...zoneShots].reverse().find((shot) => normalizeSeriesTime(shot.shotTimeSeconds) > 0)
  return normalizeSeriesTime(lastTimedShot?.shotTimeSeconds)
}

function calculateColorTotalTimeSeconds(colorShots = []) {
  return roundSeconds(
    [0, 1].reduce((sum, seriesIndex) => sum + (calculateColorSeriesTimeSeconds(colorShots, seriesIndex) || 0), 0)
  )
}

function calculateDuelSeriesTimeSeconds(duelShots = [], seriesIndex = 0) {
  const seriesShots = duelShots.slice(seriesIndex * 5, seriesIndex * 5 + 5)
  if (seriesShots.some((shot) => shot.audioSequenceStatus === 'SUGGESTED')) {
    return calculateDuelSeriesDisplayTimeSeconds(duelShots, seriesIndex)
  }

  return roundSeconds(
    seriesShots
      .reduce((sum, shot) => sum + (normalizeSeriesTime(shot.shotTimeSeconds) || 0), 0)
  )
}

function calculateDuelSeriesDisplayTimeSeconds(duelShots = [], seriesIndex = 0) {
  const seriesShots = duelShots.slice(seriesIndex * 5, seriesIndex * 5 + 5)
  const lastTimedShot = [...seriesShots].reverse().find((shot) => normalizeSeriesTime(shot.shotTimeSeconds) > 0)
  return normalizeSeriesTime(lastTimedShot?.shotTimeSeconds)
}

function calculateDuelTotalTimeSeconds(duelShots = []) {
  if (duelShots.some((shot) => shot.audioSequenceStatus === 'SUGGESTED')) {
    return roundSeconds(
      Array.from({ length: 4 }).reduce(
        (sum, _, seriesIndex) => sum + (calculateDuelSeriesDisplayTimeSeconds(duelShots, seriesIndex) || 0),
        0
      )
    )
  }

  return roundSeconds(
    duelShots.reduce((sum, shot) => sum + (normalizeSeriesTime(shot.shotTimeSeconds) || 0), 0)
  )
}

function calculateDuelSessionDurationSeconds(duelShots = [], approvedAudioDurationSeconds = '') {
  const hasAudioSequence = duelShots.some((shot) => shot.audioSequenceStatus === 'SUGGESTED')
  if (hasAudioSequence) {
    const approvedValue = normalizeSeriesTime(approvedAudioDurationSeconds)
    if (approvedValue > 0) return approvedValue
    const lastAudioShot = [...duelShots].reverse().find((shot) => normalizeSeriesTime(shot.audioElapsedSeconds) > 0)
    return normalizeSeriesTime(lastAudioShot?.audioElapsedSeconds) || calculateDuelTotalTimeSeconds(duelShots)
  }

  return calculateDuelTotalTimeSeconds(duelShots)
}

function calculateAudioSequenceTotalSeconds(audioSequence = []) {
  const lastAudioShot = audioSequence[audioSequence.length - 1]
  return normalizeSeriesTime(lastAudioShot?.elapsedSeconds)
}

function applyAudioSequenceToDuelShots(duelShots = [], audioSequence = []) {
  const startIndex = getNextDuelAudioSeriesStartIndex(duelShots)

  return duelShots.map((shot, index) => {
    const audioShot = audioSequence[index - startIndex]
    if (!audioShot) return shot

    return {
      ...shot,
      shotTimeSeconds: String(audioShot.elapsedSeconds ?? ''),
      shotIntervalMs: audioShot.partialSeconds ? Math.round(audioShot.partialSeconds * 1000) : null,
      audioSequenceIndex: audioShot.shotIndex,
      audioSequenceStatus: 'SUGGESTED',
      audioElapsedSeconds: audioShot.elapsedSeconds,
      audioPeak: audioShot.peak,
    }
  })
}

function getNextDuelAudioSeriesStartIndex(duelShots = []) {
  for (let seriesIndex = 0; seriesIndex < 4; seriesIndex += 1) {
    const seriesStart = seriesIndex * 5
    const hasTiming = duelShots
      .slice(seriesStart, seriesStart + 5)
      .some((shot) => shot.audioSequenceStatus === 'SUGGESTED' || normalizeSeriesTime(shot.shotTimeSeconds) > 0)

    if (!hasTiming) return seriesStart
  }

  return 15
}

function formatDuelAudioSeriesLabel(startIndex) {
  const seriesNumber = Math.floor(startIndex / 5) + 1
  return `SR${seriesNumber} / T${startIndex + 1}-T${startIndex + 5}`
}

function applyAudioSequenceToColorShots(colorShots = [], audioSequence = []) {
  const startIndex = getNextColorAudioSeriesStartIndex(colorShots)

  return colorShots.map((shot, index) => {
    const audioShot = audioSequence[index - startIndex]
    if (!audioShot) return shot

    return {
      ...shot,
      shotTimeSeconds: String(audioShot.elapsedSeconds ?? ''),
      shotIntervalMs: audioShot.partialSeconds ? Math.round(audioShot.partialSeconds * 1000) : null,
      audioSequenceIndex: audioShot.shotIndex,
      audioSequenceStatus: 'SUGGESTED',
      audioElapsedSeconds: audioShot.elapsedSeconds,
      audioPeak: audioShot.peak,
    }
  })
}

function getNextColorAudioSeriesStartIndex(colorShots = []) {
  const firstSeriesHasAudio = colorShots
    .slice(0, 4)
    .some((shot) => shot.audioSequenceStatus === 'SUGGESTED' || normalizeSeriesTime(shot.shotTimeSeconds) > 0)

  const secondSeriesHasAudio = colorShots
    .slice(4, 8)
    .some((shot) => shot.audioSequenceStatus === 'SUGGESTED' || normalizeSeriesTime(shot.shotTimeSeconds) > 0)

  if (!firstSeriesHasAudio) return 0
  if (!secondSeriesHasAudio) return 4
  return 4
}

function calculateAudioPeak(samples) {
  if (!samples?.length) return 0

  let peak = 0
  for (let index = 0; index < samples.length; index += 1) {
    const centered = Math.abs(samples[index] - 128) / 128
    if (centered > peak) peak = centered
  }

  return peak
}

function convertAudioPeakToDb(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue) || numberValue <= 0) return 0
  return Math.min(DUEL_AUDIO_MAX_PEAK_DB, Math.max(0, Math.round(numberValue * DUEL_AUDIO_MAX_PEAK_DB)))
}

function formatAudioPeakDb(value) {
  return `${convertAudioPeakToDb(value)} dB`
}

function normalizeAudioThresholdDb(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return DUEL_AUDIO_DEFAULT_PEAK_THRESHOLD_DB
  return Math.min(DUEL_AUDIO_MAX_PEAK_DB, Math.max(1, Math.round(numberValue)))
}

function normalizeAudioMinPeakGapMs(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return DUEL_AUDIO_DEFAULT_MIN_PEAK_GAP_MS
  return Math.min(2000, Math.max(100, Math.round(numberValue)))
}

function roundSeconds(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue) || numberValue <= 0) return 0
  return Math.round(numberValue * 10) / 10
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function normalizeSeriesTime(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null
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

function getSessionUiLabel(session) {
  const definition = ENTRY_DEFINITIONS[session?.targetType]
  return definition?.sessionUiLabel || session?.sessionLabel || ''
}

function getZoneUiLabel(zoneCode, fallback = '') {
  for (const definition of Object.values(ENTRY_DEFINITIONS)) {
    const zone = definition.zones.find((item) => item.zoneCode === zoneCode)
    if (zone) return zone.uiLabel || fallback || zone.zoneLabel
  }

  return fallback
}

function translateHumanoidParameter(parameter) {
  const labels = {
    TAURUS_HUMANOID_POSITION: 'Pior resultado: posicao',
    TAURUS_HUMANOID_AIMING: 'Pior resultado: visada',
    TAURUS_HUMANOID_TRIGGERING: 'Pior resultado: gatilho',
    TAURUS_HUMANOID_GRIP: 'Pior resultado: empunhadura',
    TARGET_POSITION: 'Pior resultado: posição',
    TARGET_AIMING: 'Pior resultado: visada',
    TARGET_TRIGGERING: 'Pior resultado: gatilho',
    TARGET_GRIP: 'Pior resultado: empunhadura',
  }

  return labels[parameter] || 'Pior resultado: visada'
}

function translateColorParameter(parameter) {
  const labels = {
    TAURUS_COLOR_IDENTIFICATION: 'Pior resultado: reconhecimento de cor',
    TAURUS_COLOR_AIMING: 'Pior resultado: visada',
    TAURUS_COLOR_TRIGGERING: 'Pior resultado: gatilho',
    TAURUS_COLOR_GRIP: 'Pior resultado: empunhadura',
    TAURUS_COLOR_POSITION: 'Pior resultado: posicao',
    TARGET_COLOR_IDENTIFICATION: 'Pior resultado: reconhecimento de cor',
    TARGET_AIMING: 'Pior resultado: visada',
    TARGET_TRIGGERING: 'Pior resultado: gatilho',
    TARGET_GRIP: 'Pior resultado: empunhadura',
    TARGET_POSITION: 'Pior resultado: posição',
  }

  return labels[parameter] || 'Pior resultado: visada'
}

function translateDuelParameter(parameter) {
  const labels = {
    TAURUS_DUEL_BASE_REBUILD: 'Pior resultado: reconstrucao de base',
    TAURUS_DUEL_SERIES_STABILITY: 'Pior resultado: estabilidade de serie',
    TAURUS_DUEL_DIRECTIONAL_CONTROL: 'Pior resultado: controle direcional',
    TAURUS_DUEL_CENTER_RETENTION: 'Pior resultado: retencao de centro',
    TAURUS_DUEL_TIMING_CONTROL: 'Pior resultado: controle de tempo',
    PROCESS: 'Pior resultado: processo',
    TRANSFER: 'Pior resultado: transferência',
    CONSISTENCY: 'Pior resultado: consistência',
    OUTCOME: 'Pior resultado: resultado',
    RHYTHM: 'Pior resultado: ritmo',
    TARGET_TRIGGERING: 'Pior resultado: gatilho',
    TARGET_AIMING: 'Pior resultado: visada',
    TARGET_POSITION: 'Pior resultado: posição',
    TARGET_GRIP: 'Pior resultado: empunhadura',
    DECISION_SPEED: 'Pior resultado: velocidade de decisão',
    SERIES_CONSISTENCY: 'Pior resultado: consistência de série',
  }

  return labels[parameter] || 'Pior resultado: processo'
}

function buildAthleteEntrySubmissionJson(athleteName, pendingSessions) {
  const payload = {
    schema: 'TAURUS_ATHLETE_ENTRY_SUBMISSION_V1',
    source: 'REACT_MOBILE_TAURUS',
    athleteName,
    generatedAt: new Date().toISOString(),
    workflowStatus: 'PENDING_ADMIN_APPROVAL',
    sessions: pendingSessions.map((session) => ({
      sessionId: session.sessionId,
      athleteName: session.athleteName,
      targetType: session.targetType,
      sessionMode: session.sessionMode || null,
      sessionLabel: session.sessionLabel,
      notes: session.notes || '',
      maxShots: session.maxShots,
      maxScore: session.maxScore ?? null,
      totalShots: session.totalShots,
      totalScore: session.totalScore ?? null,
      durationSeconds: session.durationSeconds ?? null,
      durationSource: session.durationSource || null,
      shotDetails: parseShotDetails(session.shotDetailsJson),
      recordedAt: session.recordedAt,
      updatedAt: session.updatedAt,
      workflowStatus: session.workflowStatus || 'PENDING',
      hits: (session.hits || []).map((hit) => ({
        zoneCode: hit.zoneCode,
        zoneLabel: hit.zoneLabel,
        hitCount: hit.hitCount,
        displayOrder: hit.displayOrder,
        meta: safeParseJson(hit.metaJson),
      })),
    })),
  }

  return JSON.stringify(payload, null, 2)
}

function safeParseJson(value) {
  try {
    return JSON.parse(value || '{}')
  } catch {
    return {}
  }
}

const HUMANOID_LAYOUT = {
  ALPHA_HEAD: { left: '50%', top: '13.5%' },
  ALPHA_TORSO: { left: '50%', top: '48%' },
  CHARLIE_LEFT: { left: '31%', top: '49%' },
  CHARLIE_RIGHT: { left: '69%', top: '49%' },
  CHARLIE_CENTER: { left: '50%', top: '63%' },
  DELTA_LEFT: { left: '24%', top: '42%' },
  DELTA_RIGHT: { left: '76%', top: '42%' },
  DELTA_LOWER: { left: '50%', top: '86%' },
}

export default TaurusTargetPage
