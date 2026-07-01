import { useEffect, useMemo, useState } from 'react'

const QUESTION_DEFINITIONS = [
  {
    code: 'CONFIDENCE',
    group: 'COMANDO',
    title: 'CONFIDENCE',
    subtitle: 'Confianca no que voce construiu.',
    question: 'Com que consistencia voce acredita na sua execucao durante treinos e competicoes?',
    icon: 'C',
  },
  {
    code: 'ORGANIZATION',
    group: 'COMANDO',
    title: 'ORGANIZATION',
    subtitle: 'Clareza para organizar o essencial.',
    question: 'Com que consistencia voce organiza sua rotina, materiais e prioridades para performar bem?',
    icon: 'O',
  },
  {
    code: 'MANAGEMENT',
    group: 'COMANDO',
    title: 'MANAGEMENT',
    subtitle: 'Gestao do que precisa acontecer.',
    question: 'Com que consistencia voce consegue gerir seu processo sem se perder ao longo da sessao?',
    icon: 'M',
  },
  {
    code: 'ANALYSIS',
    group: 'COMANDO',
    title: 'ANALYSIS',
    subtitle: 'Leitura inteligente do que acontece.',
    question: 'Com que consistencia voce entende o que esta funcionando e o que precisa ajustar?',
    icon: 'A',
  },
  {
    code: 'NERVE',
    group: 'COMANDO',
    title: 'NERVE',
    subtitle: 'Estabilidade emocional sob pressao.',
    question: 'Com que consistencia voce controla a tensao e mantem a estabilidade emocional?',
    icon: 'N',
  },
  {
    code: 'DISCIPLINE',
    group: 'COMANDO',
    title: 'DISCIPLINE',
    subtitle: 'Constancia no compromisso diario.',
    question: 'Com que consistencia voce mantem a disciplina necessaria para seguir o plano?',
    icon: 'D',
  },
  {
    code: 'OPPORTUNITY',
    group: 'COMANDO',
    title: 'OPPORTUNITY',
    subtitle: 'Uso inteligente das oportunidades.',
    question: 'Com que consistencia voce aproveita os estimulos, feedbacks e oportunidades criadas pelo processo?',
    icon: 'O',
  },
  {
    code: 'HEED',
    group: 'HAPPY',
    title: 'HEED',
    subtitle: 'Atencao fina ao que importa.',
    question: 'Com que consistencia voce percebe os sinais importantes do seu corpo, mente e execucao?',
    icon: 'H',
  },
  {
    code: 'ALIGNMENT',
    group: 'HAPPY',
    title: 'ALIGNMENT',
    subtitle: 'Sintonia entre intencao e acao.',
    question: 'Com que consistencia suas acoes estao alinhadas com os objetivos do treino e da prova?',
    icon: 'A',
  },
  {
    code: 'PLAN',
    group: 'HAPPY',
    title: 'PLAN',
    subtitle: 'Plano transformado em execucao.',
    question: 'Com que consistencia voce consegue executar o plano definido para a sessao ou competicao?',
    icon: 'P',
  },
  {
    code: 'POWERING',
    group: 'HAPPY',
    title: 'POWERING',
    subtitle: 'Energia para sustentar o processo.',
    question: 'Com que consistencia voce mantem energia fisica e mental para sustentar a performance?',
    icon: 'P',
  },
  {
    code: 'YEARN',
    group: 'HAPPY',
    title: 'YEARN',
    subtitle: 'Vontade que vira continuidade.',
    question: 'Com que consistencia sua motivacao se transforma em continuidade real de treino e entrega?',
    icon: 'Y',
  },
]

const SCALE_MEANINGS = [
  { value: 1, label: 'Nunca', description: 'Isso quase nunca acontece e compromete claramente meu processo.', colorClass: 'happy-scale-critical' },
  { value: 2, label: 'Raramente', description: 'Acontece pouco e ainda nao e um comportamento confiavel.', colorClass: 'happy-scale-warning' },
  { value: 3, label: 'As vezes', description: 'Acontece em alguns momentos, mas ainda sem consistencia.', colorClass: 'happy-scale-attention' },
  { value: 4, label: 'Frequentemente', description: 'Acontece na maioria das vezes, mesmo com pequenas oscilacoes.', colorClass: 'happy-scale-good' },
  { value: 5, label: 'Sempre', description: 'Acontece de forma estavel e confiavel durante o processo.', colorClass: 'happy-scale-excellent' },
]

function HappySurveyAppCard({
  responses = {},
  athleteMessage = '',
  coachNote = '',
  editable = false,
  onResponseChange,
  onAthleteMessageChange,
  onCoachNoteChange,
  title = 'Athlete input card',
}) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const answeredCount = useMemo(
    () =>
      QUESTION_DEFINITIONS.filter(({ code }) => {
        const value = responses?.[code]
        return value !== '' && value !== null && value !== undefined
      }).length,
    [responses]
  )

  useEffect(() => {
    if (currentIndex > QUESTION_DEFINITIONS.length - 1) {
      setCurrentIndex(QUESTION_DEFINITIONS.length - 1)
    }
  }, [currentIndex])

  const currentQuestion = QUESTION_DEFINITIONS[currentIndex]
  const currentValue = Number(responses?.[currentQuestion.code] || 3)
  const currentMeaning =
    SCALE_MEANINGS.find((item) => item.value === currentValue) || SCALE_MEANINGS[2]
  const progressPercent = ((currentIndex + 1) / QUESTION_DEFINITIONS.length) * 100

  function handleSliderChange(event) {
    onResponseChange?.(currentQuestion.code, event.target.value)
  }

  return (
    <section className="panel happy-survey-panel">
      <div className="happy-survey-topbar">
        <div>
          <h2>{title}</h2>
          <p>
            Pergunta {currentIndex + 1} de {QUESTION_DEFINITIONS.length}
          </p>
        </div>
        <div className="happy-survey-status">
          <strong>{answeredCount}/{QUESTION_DEFINITIONS.length}</strong>
          <span>respondidas</span>
        </div>
      </div>

      <div className="happy-survey-progress">
        <span style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="happy-survey-shell">
        <article className="happy-question-card">
          <div className="happy-question-header">
            <div className="happy-question-brand">
              <div className="happy-question-icon">{currentQuestion.icon}</div>
              <div>
                <span className="happy-question-group">{currentQuestion.group}</span>
                <h3>{currentQuestion.title}</h3>
                <p>{currentQuestion.subtitle}</p>
              </div>
            </div>

            <button type="button" className="happy-help-pill" aria-label="Scale meaning">
              ?
            </button>
          </div>

          <div className="happy-question-body">
            <h4>{currentQuestion.question}</h4>

            <div className="happy-slider-scale">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`happy-scale-step ${value === currentValue ? 'is-active' : ''}`}
                  onClick={() => onResponseChange?.(currentQuestion.code, value)}
                  disabled={!editable}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className="happy-slider-wrap">
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={currentValue}
                onChange={handleSliderChange}
                disabled={!editable}
              />
            </div>

            <div className="happy-slider-labels">
              <span>Nunca</span>
              <strong>{currentMeaning.label}</strong>
              <span>Sempre</span>
            </div>

            <div className="happy-survey-tip">
              <strong>Dica:</strong> Seja honesto. Isso ajuda o coach a montar o melhor plano para voce.
            </div>
          </div>

          <div className="happy-survey-nav">
            <button
              type="button"
              onClick={() => setCurrentIndex((index) => Math.max(index - 1, 0))}
              disabled={currentIndex === 0}
            >
              Anterior
            </button>

            <div className="happy-survey-dots">
              {QUESTION_DEFINITIONS.map((item, index) => (
                <button
                  key={item.code}
                  type="button"
                  className={`happy-survey-dot ${index === currentIndex ? 'is-active' : ''}`}
                  onClick={() => setCurrentIndex(index)}
                  aria-label={item.title}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setCurrentIndex((index) =>
                  Math.min(index + 1, QUESTION_DEFINITIONS.length - 1)
                )
              }
              disabled={currentIndex === QUESTION_DEFINITIONS.length - 1}
            >
              Proxima
            </button>
          </div>
        </article>

        <aside className="happy-meaning-card">
          <div className="happy-meaning-header">
            <h3>O que significa cada grau?</h3>
          </div>

          <div className="happy-meaning-list">
            {SCALE_MEANINGS.map((item) => (
              <div key={item.value} className="happy-meaning-row">
                <div className={`happy-meaning-badge ${item.colorClass}`}>{item.value}</div>
                <div>
                  <strong className={item.colorClass}>{item.label}</strong>
                  <p>{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="happy-notes-grid">
        <div className="happy-note-card">
          <h3>Mensagem do atleta</h3>
          {editable ? (
            <textarea
              value={athleteMessage}
              onChange={(event) => onAthleteMessageChange?.(event.target.value)}
              placeholder="O atleta pode complementar a percepcao da sessao."
              rows={4}
            />
          ) : (
            <p>{athleteMessage || '-'}</p>
          )}
        </div>

        <div className="happy-note-card">
          <h3>Nota do coach</h3>
          {editable ? (
            <textarea
              value={coachNote}
              onChange={(event) => onCoachNoteChange?.(event.target.value)}
              placeholder="O coach pode registrar uma leitura inicial."
              rows={4}
            />
          ) : (
            <p>{coachNote || '-'}</p>
          )}
        </div>
      </div>
    </section>
  )
}

export default HappySurveyAppCard
