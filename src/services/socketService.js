import { io } from 'socket.io-client'
import { SOCKET_URL } from '../config/api'

const SOCKET_EVENTS = {
  MATCH_CREATED: 'match_created',
  MATCH_JOINED: 'match_joined',
  MATCH_UPDATED: 'match_updated',
  MATCH_CANCELLED: 'match_cancelled',
  MATCH_PLAYER_LEFT: 'match_player_left',
  ROOM_CODE_UPDATED: 'room_code_updated',
  RESULT_SUBMITTED: 'result_submitted',
  DISPUTE_SUBMITTED: 'dispute_submitted',
  MATCH_RESULT_UPDATED: 'match_result_updated',
  MATCH_SETTLED: 'match_settled',
  MATCH_REFUNDED: 'match_refunded',
  MATCH_CLAIM_REJECTED: 'match_claim_rejected',
  SOCKET_ERROR: 'socket_error',
}

let socket
let activeToken
const gameLobbyRooms = new Set()
const matchRooms = new Set()
const listeners = new Map()

function addListener(event, callback) {
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event).add(callback)
  socket?.on(event, callback)
}

function getSocketOrigin() {
  return new URL(SOCKET_URL, window.location.origin).origin
}

function joinActiveRooms() {
  for (const gameId of gameLobbyRooms) {
    socket.emit('join_game_lobby', { gameId })
  }

  for (const matchId of matchRooms) {
    socket.emit('join_match_room', { matchId })
  }
}

export function connect(accessToken) {
  if (!accessToken) throw new Error('Authentication token is required for realtime.')
  if (socket && activeToken === accessToken) return socket

  closeSocket(false)
  activeToken = accessToken
  socket = io(getSocketOrigin(), {
    auth: { token: accessToken },
    withCredentials: true,
  })
  socket.on('connect', joinActiveRooms)
  for (const [event, callbacks] of listeners) {
    for (const callback of callbacks) socket.on(event, callback)
  }

  return socket
}

function closeSocket(clearRooms) {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
  }
  socket = undefined
  activeToken = undefined
  if (clearRooms) {
    gameLobbyRooms.clear()
    matchRooms.clear()
  }
}

export function disconnect() {
  closeSocket(true)
}

export function joinGameLobby(gameId) {
  gameLobbyRooms.add(gameId)
  socket?.connected && socket.emit('join_game_lobby', { gameId })
}

export function leaveGameLobby(gameId) {
  gameLobbyRooms.delete(gameId)
  socket?.connected && socket.emit('leave_game_lobby', { gameId })
}

export function joinMatchRoom(matchId) {
  matchRooms.add(matchId)
  socket?.connected && socket.emit('join_match_room', { matchId })
}

export function leaveMatchRoom(matchId) {
  matchRooms.delete(matchId)
  socket?.connected && socket.emit('leave_match_room', { matchId })
}

export function onMatchCreated(callback) {
  addListener(SOCKET_EVENTS.MATCH_CREATED, callback)
}

export function onMatchJoined(callback) {
  addListener(SOCKET_EVENTS.MATCH_JOINED, callback)
}

export function onMatchUpdated(callback) {
  addListener(SOCKET_EVENTS.MATCH_UPDATED, callback)
}

export function onMatchCancelled(callback) {
  addListener(SOCKET_EVENTS.MATCH_CANCELLED, callback)
}

export function onMatchPlayerLeft(callback) {
  addListener(SOCKET_EVENTS.MATCH_PLAYER_LEFT, callback)
}

export function onRoomCodeUpdated(callback) {
  addListener(SOCKET_EVENTS.ROOM_CODE_UPDATED, callback)
}

export function onResultSubmitted(callback) {
  addListener(SOCKET_EVENTS.RESULT_SUBMITTED, callback)
}

export function onDisputeSubmitted(callback) {
  addListener(SOCKET_EVENTS.DISPUTE_SUBMITTED, callback)
}

export function onMatchResultUpdated(callback) {
  addListener(SOCKET_EVENTS.MATCH_RESULT_UPDATED, callback)
}

export function onMatchSettled(callback) {
  addListener(SOCKET_EVENTS.MATCH_SETTLED, callback)
}

export function onMatchRefunded(callback) {
  addListener(SOCKET_EVENTS.MATCH_REFUNDED, callback)
}

export function onMatchClaimRejected(callback) {
  addListener(SOCKET_EVENTS.MATCH_CLAIM_REJECTED, callback)
}

export function onSocketError(callback) {
  addListener(SOCKET_EVENTS.SOCKET_ERROR, callback)
}

export function removeListener(event, callback) {
  socket?.off(event, callback)
  const callbacks = listeners.get(event)
  callbacks?.delete(callback)
  if (callbacks?.size === 0) listeners.delete(event)
}

export { SOCKET_EVENTS }
