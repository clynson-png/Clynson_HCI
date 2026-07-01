export function normalizeAthleteName(value) {
  const normalizedValue = String(value || '').trim()

  if (!normalizedValue) return ''
  if (normalizedValue === '-') return ''
  if (normalizedValue.length < 3) return ''

  return normalizedValue
}

export function buildAthleteLookupKey(value) {
  return normalizeAthleteName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

export function athleteNamesMatch(left, right) {
  const leftKey = buildAthleteLookupKey(left)
  const rightKey = buildAthleteLookupKey(right)

  if (!leftKey || !rightKey) return false
  return leftKey === rightKey
}

export function resolveExistingAthleteName(snapshot, athleteName) {
  const normalizedName = normalizeAthleteName(athleteName)
  const lookupKey = buildAthleteLookupKey(normalizedName)

  if (!lookupKey) return normalizedName

  const candidates = [
    ...(snapshot?.leads || []).map((item) => item.athleteName),
    ...(snapshot?.athlete360 || []).map((item) => item.athlete),
    ...(snapshot?.sessionHeaders || []).map((item) => item.athleteName),
    ...(snapshot?.happyStates || []).map((item) => item.athlete || item.athleteName),
  ].filter(Boolean)

  const existingName = candidates.find((item) => buildAthleteLookupKey(item) === lookupKey)
  return existingName || normalizedName
}
