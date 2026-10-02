import { mockStore } from './mockStore'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'
const TOKEN_KEY = 'playnexa.auth-token'

async function requestGameApi(path, { method = 'GET', body, requiresAdmin = false } = {}) {
  const headers = {}
  const token = localStorage.getItem(TOKEN_KEY)

  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (requiresAdmin && !token) throw new Error('Admin authentication is required.')

  const response = await fetch(`${API_BASE_URL}/games${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json()

  if (!response.ok) {
    const error = new Error(result.message || 'Game request failed.')
    error.status = response.status
    throw error
  }

  return result.data
}

export async function getPlayableGames() {
  return mockStore.games.filter(game => game.is_active && game.is_open)
}

export async function getGames() {
  const result = await requestGameApi('')
  return result.games
}

export async function getGameById(gameId) {
  const result = await requestGameApi(`/${encodeURIComponent(gameId)}`)
  return result.game
}

export async function getAdminGames() {
  const result = await requestGameApi('/admin', { requiresAdmin: true })
  return result.games
}

export async function createGame(gameData) {
  const result = await requestGameApi('', {
    method: 'POST',
    body: gameData,
    requiresAdmin: true,
  })
  return result.game
}

export async function updateGame(gameId, updates) {
  const result = await requestGameApi(`/${encodeURIComponent(gameId)}`, {
    method: 'PUT',
    body: updates,
    requiresAdmin: true,
  })
  return result.game
}

export async function toggleGameStatus(gameId, isActive) {
  const result = await requestGameApi(`/${encodeURIComponent(gameId)}/status`, {
    method: 'PATCH',
    body: { isActive },
    requiresAdmin: true,
  })
  return result.game
}

export async function toggleGameOpenStatus(gameId, isOpen) {
  const result = await requestGameApi(
    `/${encodeURIComponent(gameId)}/open-status`,
    {
      method: 'PATCH',
      body: { isOpen },
      requiresAdmin: true,
    },
  )
  return result.game
}

export async function deleteGame(gameId) {
  const result = await requestGameApi(`/${encodeURIComponent(gameId)}`, {
    method: 'DELETE',
    requiresAdmin: true,
  })
  return result.game
}
