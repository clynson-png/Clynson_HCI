import { useState } from 'react'
import taurusLogoWordmark from '../assets/taurus-logo-wordmark.png'

function AthleteLoginPage({ onLogin, leadOptions = [] }) {
  const [athleteName, setAthleteName] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    setError('')

    try {
      onLogin({ athleteName })
    } catch (err) {
      setError(err.message || 'Erro ao entrar.')
    }
  }

  return (
    <main className="taurus-login-page">
      <section className="taurus-login-panel">
        <div className="taurus-login-brand">
          <img src={taurusLogoWordmark} alt="TAURUS" />
          <span>HCI Performance</span>
          <h1>Portal do Atleta</h1>
        </div>

        <form className="taurus-login-form" onSubmit={handleSubmit}>
          <label>
            <span>Nome do atleta</span>
            <input
              value={athleteName}
              onChange={(event) => setAthleteName(event.target.value)}
              autoComplete="username"
              list="taurus-lead-login-list"
              placeholder="Digite ou selecione seu nome"
            />
            <datalist id="taurus-lead-login-list">
              {leadOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>

          {error && <p className="taurus-login-error">{error}</p>}

          <button type="submit">Entrar</button>
        </form>

      </section>
    </main>
  )
}

export default AthleteLoginPage
