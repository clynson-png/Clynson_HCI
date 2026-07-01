import { useState } from 'react'

const FIELD_GROUPS = [
  {
    title: 'COMANDO',
    items: [
      ['CONFIDENCE', 'Confidence'],
      ['ORGANIZATION', 'Organization'],
      ['MANAGEMENT', 'Management'],
      ['ANALYSIS', 'Analysis'],
      ['NERVE', 'Nerve'],
      ['DISCIPLINE', 'Discipline'],
      ['OPPORTUNITY', 'Opportunity'],
    ],
  },
  {
    title: 'HAPPY',
    items: [
      ['HEED', 'Heed'],
      ['ALIGNMENT', 'Alignment'],
      ['PLAN', 'Plan'],
      ['POWERING', 'Powering'],
      ['YEARN', 'Yearn'],
    ],
  },
]

const SCALE_MEANINGS = [
  ['1', 'Nunca', 'Quase nunca acontece e exige intervencao imediata.'],
  ['2', 'Raramente', 'Acontece pouco e ainda nao e confiavel.'],
  ['3', 'As vezes', 'Acontece em alguns momentos, mas sem consistencia.'],
  ['4', 'Frequentemente', 'Acontece na maioria das vezes, com pequenas oscilacoes.'],
  ['5', 'Sempre', 'Acontece de forma estavel e confiavel.'],
]

const PARAMETER_GUIDE = {
  COMANDO: [
    ['CONFIDENCE', 'Crenca real na propria capacidade de executar bem.'],
    ['ORGANIZATION', 'Capacidade de organizar rotina, materiais e prioridades.'],
    ['MANAGEMENT', 'Capacidade de gerir o processo e responder ao que acontece.'],
    ['ANALYSIS', 'Leitura critica para entender erros, acertos e ajustes.'],
    ['NERVE', 'Controle emocional e estabilidade sob tensao ou pressao.'],
    ['DISCIPLINE', 'Constancia para seguir o plano e sustentar o compromisso.'],
    ['OPPORTUNITY', 'Capacidade de aproveitar feedbacks, estimulos e oportunidades.'],
  ],
  HAPPY: [
    ['HEED', 'Atencao fina aos sinais importantes do corpo, mente e execucao.'],
    ['ALIGNMENT', 'Coerencia entre intencao, plano e acao realizada.'],
    ['PLAN', 'Capacidade de transformar o plano em execucao pratica.'],
    ['POWERING', 'Energia fisica e mental para sustentar desempenho.'],
    ['YEARN', 'Vontade profunda que se converte em continuidade real.'],
  ],
}

function HappySelfAnalysisCard({
  responses = {},
  athleteMessage = '',
  coachNote = '',
  editable = false,
  onResponseChange,
  onAthleteMessageChange,
  onCoachNoteChange,
  title = 'Athlete input card',
}) {
  const [showScaleGuide, setShowScaleGuide] = useState(false)
  const [showParameterGuide, setShowParameterGuide] = useState(false)

  return (
    <section className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div className="happy-guide-actions">
          <button type="button" onClick={() => setShowScaleGuide((value) => !value)}>
            {showScaleGuide ? 'Fechar escala' : 'Ver escala'}
          </button>
          <button type="button" onClick={() => setShowParameterGuide((value) => !value)}>
            {showParameterGuide ? 'Fechar parametros' : 'Ver parametros'}
          </button>
        </div>
      </div>

      {(showScaleGuide || showParameterGuide) && (
        <div className="happy-guide-grid">
          {showScaleGuide && (
            <div className="happy-side-card happy-guide-card">
              <h3 style={{ marginBottom: 10 }}>Escala 1 a 5</h3>
              <div className="happy-guide-list">
                {SCALE_MEANINGS.map(([value, label, description]) => (
                  <div key={value} className="happy-guide-row">
                    <strong className="happy-guide-badge">{value}</strong>
                    <div>
                      <strong>{label}</strong>
                      <p>{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showParameterGuide && (
            <div className="happy-side-card happy-guide-card">
              <h3 style={{ marginBottom: 10 }}>Conceitos dos parametros</h3>
              <div className="happy-guide-parameter-groups">
                {Object.entries(PARAMETER_GUIDE).map(([groupName, items]) => (
                  <div key={groupName} className="happy-guide-parameter-group">
                    <h4>{groupName}</h4>
                    <div className="happy-guide-list">
                      {items.map(([code, description]) => (
                        <div key={code} className="happy-guide-row">
                          <strong className="happy-guide-code">{code}</strong>
                          <p>{description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="happy-three-column" style={{ padding: '16px 0 0' }}>
        {FIELD_GROUPS.map((group) => (
          <div key={group.title} className="happy-layer-card">
            <h3>{group.title}</h3>
            <div className="happy-layer-list">
              {group.items.map(([code, label]) => (
                <label
                  key={code}
                  className="happy-layer-row"
                  style={{ borderBottom: 'none', padding: '6px 0' }}
                >
                  <span>{label}</span>

                  {editable ? (
                    <input
                      type="number"
                      min="1"
                      max="5"
                      step="1"
                      value={responses?.[code] ?? ''}
                      onChange={(event) => onResponseChange?.(code, event.target.value)}
                      style={{ width: 72 }}
                    />
                  ) : (
                    <strong>{responses?.[code] ?? '-'}</strong>
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="happy-layer-card">
          <h3>Communication</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {editable ? (
              <>
                <textarea
                  value={athleteMessage}
                  onChange={(event) => onAthleteMessageChange?.(event.target.value)}
                  placeholder="Athlete message"
                  rows={5}
                />
                <textarea
                  value={coachNote}
                  onChange={(event) => onCoachNoteChange?.(event.target.value)}
                  placeholder="Coach note"
                  rows={5}
                />
              </>
            ) : (
              <>
                <div className="happy-side-card">
                  <h3 style={{ marginBottom: 8 }}>Athlete message</h3>
                  <p style={{ margin: 0 }}>{athleteMessage || '-'}</p>
                </div>
                <div className="happy-side-card">
                  <h3 style={{ marginBottom: 8 }}>Coach note</h3>
                  <p style={{ margin: 0 }}>{coachNote || '-'}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export function mapResponsesArrayToObject(responses = []) {
  return Object.fromEntries(
    responses.map((item) => [item.code, item.value])
  )
}

export default HappySelfAnalysisCard
