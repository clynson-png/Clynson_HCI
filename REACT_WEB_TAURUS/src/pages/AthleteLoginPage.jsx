import { useState } from 'react'
import taurusLogoWordmark from '../assets/taurus-logo-wordmark.png'
import { MOBILE_LOGIN_NAMES } from '../services/authService'

function AthleteLoginPage({ onLogin }) {
  const [athleteName, setAthleteName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    setError('')

    try {
      onLogin({ athleteName, password })
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
          <p className="taurus-login-orientation-alert">
            Use o app com o celular na horizontal para melhor leitura dos alvos e graficos.
          </p>
        </div>

        <form className="taurus-login-form" onSubmit={handleSubmit}>
          <label>
            <span>Nome do atleta</span>
            <input
              value={athleteName}
              onChange={(event) => setAthleteName(event.target.value)}
              autoComplete="username"
              list="taurus-lead-login-list"
              placeholder="Selecione seu usuario"
            />
            <datalist id="taurus-lead-login-list">
              {MOBILE_LOGIN_NAMES.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>

          <label>
            <span>Senha</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Digite sua senha"
            />
          </label>

          {error && <p className="taurus-login-error">{error}</p>}

          <button type="submit">Entrar</button>
        </form>

      </section>
    </main>
  )
}

export default AthleteLoginPage
