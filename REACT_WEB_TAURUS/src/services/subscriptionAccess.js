export const SUBSCRIPTION_TIERS = {
  FREE: 'FREE',
  PREMIUM: 'PREMIUM',
  ADMIN: 'ADMIN',
}

export function buildSubscriptionAccess(profile = {}) {
  const tier = normalizeSubscriptionTier(profile.subscriptionTier)
  const role = String(profile.role || '').trim().toUpperCase()
  const hasAdminAccess = tier === SUBSCRIPTION_TIERS.ADMIN || role === SUBSCRIPTION_TIERS.ADMIN
  const hasPremiumAccess = tier === SUBSCRIPTION_TIERS.PREMIUM || hasAdminAccess

  return {
    subscriptionTier: tier,
    role: role || 'ATHLETE',
    canViewTaurus: true,
    canViewTarget: true,
    canViewSmartChart: hasPremiumAccess,
    canViewIndices: hasAdminAccess,
    canViewPlan: hasAdminAccess,
    canViewLibrary: hasAdminAccess,
    canViewLibraryHci109: hasPremiumAccess,
    canViewMobileLibrary: hasPremiumAccess,
    canExportPdf: hasPremiumAccess,
  }
}

export function getLocalSubscriptionProfile() {
  if (typeof localStorage === 'undefined') {
    return buildSubscriptionAccess()
  }

  return buildSubscriptionAccess({
    subscriptionTier: localStorage.getItem('TAURUS_SUBSCRIPTION_TIER') || SUBSCRIPTION_TIERS.FREE,
    role: localStorage.getItem('TAURUS_USER_ROLE') || 'ATHLETE',
  })
}

export function normalizeSubscriptionTier(value) {
  const tier = String(value || '').trim().toUpperCase()

  if (tier === SUBSCRIPTION_TIERS.PREMIUM) return SUBSCRIPTION_TIERS.PREMIUM
  if (tier === SUBSCRIPTION_TIERS.ADMIN) return SUBSCRIPTION_TIERS.ADMIN

  return SUBSCRIPTION_TIERS.FREE
}
