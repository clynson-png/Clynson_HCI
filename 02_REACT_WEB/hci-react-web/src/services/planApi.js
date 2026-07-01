async function readJson(url) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Erro ao carregar plan em ${url}`)
  }

  return response.json()
}

export async function getTrainingPlan(params = {}) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value))
    }
  })

  const suffix = query.toString() ? `?${query.toString()}` : ''
  return readJson(`/api/plan${suffix}`)
}
