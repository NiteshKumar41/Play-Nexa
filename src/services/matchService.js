import { MATCH_STATUS } from '../constants/matchStatus'
import { apiClient } from './apiClient'
import { getAuthToken } from './tokenStorage'
import { getGameById } from './gameService'
import {
  joinGameLobby,
  leaveGameLobby,
  joinMatchRoom,
  leaveMatchRoom,
  onMatchCreated,
  onMatchJoined,
  onMatchUpdated,
  onMatchCancelled,
  onMatchPlayerLeft,
  onRoomCodeUpdated,
  onResultSubmitted,
  onDisputeSubmitted,
  onMatchSettled,
  onMatchRefunded,
  onMatchClaimRejected,
  onSocketError,
  removeListener,
  SOCKET_EVENTS,
} from './socketService'

/** @typedef {import('../types/match.types').Match} Match */
/** @typedef {import('../types/match.types').MatchListItem} MatchListItem */

async function requestMatchApi(path, { method = 'GET', body } = {}) {
  const token = getAuthToken()
  if (!token) throw new Error('You are not signed in.')

  const response = await apiClient.request(`/matches${path}`, {
    method,
    body,
  })
  return response.data
}

/**
 * @param {Match | MatchListItem} match
 * @param {Awaited<ReturnType<typeof getGameById>> | null} game
 * @returns {import('../types/match.types').PlayerMatch}
 */
function toPageMatch(match, game) {
  const status = {
    ACTIVE: MATCH_STATUS.OPEN,
    JOINED: MATCH_STATUS.IN_PROGRESS,
    CANCELLED: MATCH_STATUS.CANCELLED,
  }[match.status] || match.status.toLowerCase()

  return {
    id: match.id,
    game_id: match.gameId,
    game: game
      ? {
          id: game.id,
          name: game.name,
          slug: String(game.gameCode),
          category: game.category || 'Games',
          image_url: game.imageUrl || game.image_url || '',
        }
      : {
          id: match.gameId,
          name: `Game ${match.gameCode}`,
          slug: String(match.gameCode),
          category: 'Games',
          image_url: '',
        },
    host_user_id: match.player1,
    opponent_user_id: match.player2,
    entry_amount: match.player1Amount,
    prize_pool: match.prizePool,
    platform_fee: match.platformFee,
    winner_amount: match.winnerAmount,
    room_code: match.roomCode,
    status,
    winner_claimed_by: null,
    winner_claim_status: null,
    dispute_reason: null,
    created_at: match.createdAt,
    started_at: match.joinedAt,
    finished_at: match.completedAt,
    cancelled_at: match.cancelledAt,
  }
}

export async function getMatches(gameId, { page = 1, limit = 10, game: gameDetails } = {}) {
  if (!gameId) throw new Error('A game ID is required to load matches.')

  const query = new URLSearchParams({ gameId, page: String(page), limit: String(limit) })
  const result = await requestMatchApi(`?${query}`)
  const game = gameDetails || (result.matches.length ? await getGameById(gameId) : null)

  return result.matches.map(match => toPageMatch(match, game))
}

export async function createMatch({ gameId, entryAmount }) {
  const result = await requestMatchApi('', {
    method: 'POST',
    body: { gameId, entryFee: entryAmount },
  })

  return result.match.id
}

export async function joinMatch(matchId) {
  await requestMatchApi(`/${encodeURIComponent(matchId)}/join`, {
    method: 'POST',
    body: {},
  })
}

export async function getMatch(matchId) {
  const result = await requestMatchApi(`/${encodeURIComponent(matchId)}`)
  return toPageMatch(result.match, result.match.game)
}

export async function updateRoomCode(matchId, roomCode) {
  await requestMatchApi(`/${encodeURIComponent(matchId)}/room-code`, {
    method: 'PATCH',
    body: { roomCode },
  })
}

export async function leaveMatch(matchId) {
  await requestMatchApi(`/${encodeURIComponent(matchId)}/leave`, {
    method: 'POST',
    body: {},
  })
}

export async function cancelMatch(matchId) {
  await requestMatchApi(`/${encodeURIComponent(matchId)}/cancel`, {
    method: 'POST',
    body: {},
  })
}

export function subscribeToLobby(gameId, callback, onError) {
  const handleMatchCreated = payload => callback(SOCKET_EVENTS.MATCH_CREATED, payload)
  const handleMatchJoined = payload => callback(SOCKET_EVENTS.MATCH_JOINED, payload)
  const handleMatchCancelled = payload => callback(SOCKET_EVENTS.MATCH_CANCELLED, payload)
  const handleMatchPlayerLeft = payload => callback(SOCKET_EVENTS.MATCH_PLAYER_LEFT, payload)
  const handleSocketError = payload => onError?.(payload.message)

  onMatchCreated(handleMatchCreated)
  onMatchJoined(handleMatchJoined)
  onMatchCancelled(handleMatchCancelled)
  onMatchPlayerLeft(handleMatchPlayerLeft)
  onSocketError(handleSocketError)
  joinGameLobby(gameId)

  return () => {
    removeListener(SOCKET_EVENTS.MATCH_CREATED, handleMatchCreated)
    removeListener(SOCKET_EVENTS.MATCH_JOINED, handleMatchJoined)
    removeListener(SOCKET_EVENTS.MATCH_CANCELLED, handleMatchCancelled)
    removeListener(SOCKET_EVENTS.MATCH_PLAYER_LEFT, handleMatchPlayerLeft)
    removeListener(SOCKET_EVENTS.SOCKET_ERROR, handleSocketError)
    leaveGameLobby(gameId)
  }
}

export function subscribeToMatch(matchId, callback, onError) {
  const handleMatchUpdated = payload => callback(SOCKET_EVENTS.MATCH_UPDATED, payload)
  const handleMatchCancelled = payload => callback(SOCKET_EVENTS.MATCH_CANCELLED, payload)
  const handleMatchPlayerLeft = payload => callback(SOCKET_EVENTS.MATCH_PLAYER_LEFT, payload)
  const handleRoomCodeUpdated = payload => callback(SOCKET_EVENTS.ROOM_CODE_UPDATED, payload)
  const handleResultSubmitted = payload => callback(SOCKET_EVENTS.RESULT_SUBMITTED, payload)
  const handleDisputeSubmitted = payload => callback(SOCKET_EVENTS.DISPUTE_SUBMITTED, payload)
  const handleMatchSettled = payload => callback(SOCKET_EVENTS.MATCH_SETTLED, payload)
  const handleMatchRefunded = payload => callback(SOCKET_EVENTS.MATCH_REFUNDED, payload)
  const handleMatchClaimRejected = payload => callback(SOCKET_EVENTS.MATCH_CLAIM_REJECTED, payload)
  const handleSocketError = payload => onError?.(payload.message)

  onMatchUpdated(handleMatchUpdated)
  onMatchCancelled(handleMatchCancelled)
  onMatchPlayerLeft(handleMatchPlayerLeft)
  onRoomCodeUpdated(handleRoomCodeUpdated)
  onResultSubmitted(handleResultSubmitted)
  onDisputeSubmitted(handleDisputeSubmitted)
  onMatchSettled(handleMatchSettled)
  onMatchRefunded(handleMatchRefunded)
  onMatchClaimRejected(handleMatchClaimRejected)
  onSocketError(handleSocketError)
  joinMatchRoom(matchId)

  return () => {
    removeListener(SOCKET_EVENTS.MATCH_UPDATED, handleMatchUpdated)
    removeListener(SOCKET_EVENTS.MATCH_CANCELLED, handleMatchCancelled)
    removeListener(SOCKET_EVENTS.MATCH_PLAYER_LEFT, handleMatchPlayerLeft)
    removeListener(SOCKET_EVENTS.ROOM_CODE_UPDATED, handleRoomCodeUpdated)
    removeListener(SOCKET_EVENTS.RESULT_SUBMITTED, handleResultSubmitted)
    removeListener(SOCKET_EVENTS.DISPUTE_SUBMITTED, handleDisputeSubmitted)
    removeListener(SOCKET_EVENTS.MATCH_SETTLED, handleMatchSettled)
    removeListener(SOCKET_EVENTS.MATCH_REFUNDED, handleMatchRefunded)
    removeListener(SOCKET_EVENTS.MATCH_CLAIM_REJECTED, handleMatchClaimRejected)
    removeListener(SOCKET_EVENTS.SOCKET_ERROR, handleSocketError)
    leaveMatchRoom(matchId)
  }
}
