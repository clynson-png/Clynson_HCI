import { SUBSCRIPTION_TIERS, buildSubscriptionAccess } from './subscriptionAccess'

const AUTH_SESSION_KEY = 'TAURUS_AUTH_SESSION_V1'
const FIXED_MOBILE_USERS = {
  OLIVEIRA: {
    password: 'Am@zonas',
    subscriptionTier: SUBSCRIPTION_TIERS.PREMIUM,
  },
  CLYNSON: {
    password: 'Am@zonas',
    subscriptionTier: SUBSCRIPTION_TIERS.PREMIUM,
  },
  FREE: {
    password: 'usuariopremium',
    subscriptionTier: SUBSCRIPTION_TIERS.FREE,
  },
  PREMIUM: {
    password: 'usuariopremium',
    subscriptionTier: SUBSCRIPTION_TIERS.PREMIUM,
  },
}

export const MOBILE_LOGIN_NAMES = Object.keys(FIXED_MOBILE_USERS)

export function getStoredAuthSession() {
  if (typeof localStorage === 'undefined') return null

  try {
    const rawSession = localStorage.getItem(AUTH_SESSION_KEY)
    if (!rawSession) return null

    const parsed = JSON.parse(rawSession)
    if (!parsed?.athleteName || !parsed?.createdAt) return null

    return {
      ...parsed,
      access: buildSubscriptionAccess(parsed),
    }
  } catch {
    return null
  }
}

export function loginWithLeadName({ athleteName, password = '', snapshot }) {
  const normalizedAthleteName = normalizeName(athleteName)

  if (!normalizedAthleteName) {
    throw new Error('Informe o nome do atleta.')
  }

  const fixedUser = FIXED_MOBILE_USERS[normalizedAthleteName]

  if (!fixedUser) {
    throw new Error('Usuario nao autorizado neste portal.')
  }

  if (password !== fixedUser.password) {
    throw new Error('Senha incorreta.')
  }

  const leads = snapshot?.leads || []
  const athletes = snapshot?.athletes || []
  const lead = leads.find(
    (item) => normalizeName(item.athleteName) === normalizedAthleteName
  )
  const athlete = athletes.find(
    (item) => normalizeName(item.athleteName) === normalizedAthleteName
  )

  const session = {
    athleteId: lead?.leadId || athlete?.athleteId || normalizedAthleteName,
    athleteName: lead?.athleteName || athlete?.athleteName || normalizedAthleteName,
    athleteEmail: lead?.athleteEmail || athlete?.athleteEmail || null,
    displayName: lead?.athleteName || athlete?.athleteName || normalizedAthleteName,
    role: lead?.role || athlete?.role || 'ATHLETE',
    subscriptionTier: fixedUser.subscriptionTier,
    createdAt: new Date().toISOString(),
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
    localStorage.setItem('TAURUS_SUBSCRIPTION_TIER', session.subscriptionTier)
    localStorage.setItem('TAURUS_USER_ROLE', session.role)
  }

  return {
    ...session,
    access: buildSubscriptionAccess(session),
  }
}

export function logoutAuthSession() {
  if (typeof localStorage === 'undefined') return

  localStorage.removeItem(AUTH_SESSION_KEY)
  localStorage.removeItem('TAURUS_SUBSCRIPTION_TIER')
  localStorage.removeItem('TAURUS_USER_ROLE')
}

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase()
}
