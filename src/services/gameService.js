import { apiClient } from './apiClient'
import { getAuthToken } from './tokenStorage'
import { API_BASE_URL } from '../config/api'

async function requestGameApi(path, { method = 'GET', body, requiresAdmin = false } = {}) {
  const token = getAuthToken()
  if (requiresAdmin && !token) throw new Error('Admin authentication is required.')

  const response = await apiClient.request(`/games${path}`, {
    method,
    body,
  })
  return response.data
}

async function requestAdminGameApi(path, { method = 'GET', body } = {}) {
  const response = await apiClient.request(`/admin/games${path}`, {
    method,
    body,
  })
  return response.data
}

function createGameFormData(gameData) {
  const form = new FormData()
  if (gameData.name !== undefined) form.set('name', String(gameData.name).trim())
  if (gameData.gameCode !== undefined) form.set('gameCode', String(gameData.gameCode))
  if (gameData.isActive !== undefined) form.set('status', String(Boolean(gameData.isActive)))
  if (gameData.isOpen !== undefined) form.set('isOpen', String(Boolean(gameData.isOpen)))
  if (typeof File !== 'undefined' && gameData.imageFile instanceof File && gameData.imageFile.size) {
    form.set('image', gameData.imageFile)
  }
  return form
}

export function getGameImageSource(imageUrl) {
  if (!imageUrl) return ''
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl
  return `${API_BASE_URL}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`
}

export async function loadGameImage(imageUrl) {
  return apiClient.getBlob(getGameImageSource(imageUrl))
}

function toPlayerGame(game) {
  return {
    ...game,
    slug: String(game.gameCode),
    image_url: getGameImageSource(game.imageUrl),
    is_active: game.isActive,
    is_open: game.isOpen,
  }
}

export async function getGames() {
  const result = await requestGameApi('')
  return result.games.map(toPlayerGame)
}

// The backend has no lookup-by-gameCode route; public list items include code.
export async function getGameByCode(gameCode) {
  const games = await getGames()
  const game = games.find(item => item.slug === String(gameCode))
  if (!game) throw new Error('This game is not currently available.')
  return game
}

export async function getGameById(gameId) {
  const result = await requestGameApi(`/${encodeURIComponent(gameId)}`)
  return toPlayerGame(result.game)
}

export async function getAdminGames({ page = 1, limit = 100 } = {}) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) })
  const result = await requestAdminGameApi(`?${query}`)
  return result.games
}

export async function createGame(gameData) {
  const result = await requestAdminGameApi('', {
    method: 'POST',
    body: createGameFormData(gameData),
  })
  return result.game
}

export async function updateGame(gameId, updates) {
  const result = await requestAdminGameApi(`/${encodeURIComponent(gameId)}`, {
    method: 'PATCH',
    body: createGameFormData(updates),
  })
  return result.game
}

export async function toggleGameStatus(gameId, isActive) {
  const result = await requestAdminGameApi(`/${encodeURIComponent(gameId)}`, {
    method: 'PATCH',
    body: createGameFormData({ isActive }),
  })
  return result.game
}

export async function toggleGameOpenStatus(gameId, isOpen) {
  const result = await requestAdminGameApi(`/${encodeURIComponent(gameId)}`, {
    method: 'PATCH',
    body: createGameFormData({ isOpen }),
  })
  return result.game
}

export async function deleteGame(gameId) {
  const result = await requestGameApi(`/${encodeURIComponent(gameId)}`, {
    method: 'DELETE',
    requiresAdmin: true,
  })
  return result.game
}
