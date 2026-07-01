import { SUBSCRIPTION_TIERS, buildSubscriptionAccess } from './subscriptionAccess'

const AUTH_SESSION_KEY = 'TAURUS_AUTH_SESSION_V1'

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

export function loginWithLeadName({ athleteName, snapshot }) {
  const normalizedAthleteName = normalizeName(athleteName)

  if (!normalizedAthleteName) {
    throw new Error('Informe o nome do atleta.')
  }

  const leads = snapshot?.leads || []
  const athletes = snapshot?.athletes || []
  const lead = leads.find(
    (item) => normalizeName(item.athleteName) === normalizedAthleteName
  )
  const athlete = athletes.find(
    (item) => normalizeName(item.athleteName) === normalizedAthleteName
  )

  if (!lead && !athlete) {
    throw new Error('Atleta nao encontrado na base de leads.')
  }

  const session = {
    athleteId: lead?.leadId || athlete?.athleteId || athleteName,
    athleteName: lead?.athleteName || athlete?.athleteName || athleteName,
    athleteEmail: lead?.athleteEmail || athlete?.athleteEmail || null,
    displayName: lead?.athleteName || athlete?.athleteName || athleteName,
    role: lead?.role || athlete?.role || 'ATHLETE',
    subscriptionTier: lead?.subscriptionTier || athlete?.subscriptionTier || SUBSCRIPTION_TIERS.FREE,
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
