const PLAN_TRELLO_BOARDS = [
  {
    id: 'primary-plan',
    shortLink: '7vcK08LX',
    title: 'Plan Board',
    description:
      'Quadro principal de planejamento ja vinculado na aba PLAN.',
  },
  {
    id: 'screen-a',
    shortLink: 'a82EffpE',
    title: 'Tela 2',
    description: 'Quadro Trello adicional para consumo direto na tela.',
  },
  {
    id: 'screen-b',
    shortLink: 'eMMWHI3J',
    title: 'Tela 3',
    description: 'Quadro Trello adicional para consumo direto na tela.',
  },
  {
    id: 'training-sessions',
    shortLink: 'eO9qGgSd',
    title: 'Training Sessions',
    description: 'Todas as sessoes de treino para futura normalizacao HCI.',
  },
]

async function readJson(url) {
  const response = await fetch(url)

  if (response.status === 503) {
    throw new Error('TRELLO_NOT_CONFIGURED')
  }

  if (!response.ok) {
    throw new Error(`Trello proxy returned ${response.status}`)
  }

  return response.json()
}

export function getPlanTrelloBoards() {
  return PLAN_TRELLO_BOARDS.map((board) => ({
    ...board,
    url: `https://trello.com/b/${board.shortLink}`,
  }))
}

export function isTrelloConfigured() {
  return true
}

export async function fetchTrelloBoardSnapshot(shortLink, options = {}) {
  const params = new URLSearchParams({ shortLink })

  if (options.athleteEmail) {
    params.set('athleteEmail', options.athleteEmail)
  }

  return readJson(`/api/trello/board?${params.toString()}`)
}
