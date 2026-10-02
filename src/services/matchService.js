import { calculateMatchFinancials } from '../utils/matchFinancials'
import { MATCH_STATUS } from '../constants/matchStatus'
import { getCurrentUserId } from './userService'
import { creditWallet, debitWallet, refundWallet } from './walletService'
import { makeId, mockStore, notifyMatchChange, now } from './mockStore'

function findMatch(matchId) {
  const match = mockStore.matches.find(item => item.id === matchId)
  if (!match) throw new Error('Match could not be found.')
  return match
}

function withGame(match) {
  const game = mockStore.games.find(item => item.id === match.game_id)
  return { ...match, game: game ? { ...game } : { name: 'Game', slug: '' } }
}

export async function getOpenMatches(gameId) {
  return mockStore.matches
    .filter(match => match.game_id === gameId && match.status === MATCH_STATUS.OPEN)
    .map(match => withGame(match))
}

export async function createMatch({ gameId, entryAmount }) {
  const userId = getCurrentUserId()
  await debitWallet({ userId, amount: entryAmount, description: 'Match entry reserved' })
  const match = {
    id: makeId('NX'), game_id: gameId, status: MATCH_STATUS.OPEN, entry_amount: Number(entryAmount), prize_pool: 0,
    platform_fee: 0, winner_amount: 0, host_user_id: userId, opponent_user_id: null,
    winner_claimed_by: null, winner_claim_status: null, winner_claim_path: null, winner_claim_image_url: null,
    dispute_reason: null, dispute_screenshot_url: null, room_code: null, created_at: now(), started_at: null, finished_at: null,
  }
  mockStore.matches.unshift(match)
  notifyMatchChange(match.id)
  return match.id
}

export async function joinMatch({ matchId }) {
  const match = findMatch(matchId)
  if (match.status !== MATCH_STATUS.OPEN || match.host_user_id === getCurrentUserId()) throw new Error('This match is no longer available.')
  await debitWallet({ userId: getCurrentUserId(), amount: match.entry_amount, description: 'Match entry' })
  const financials = calculateMatchFinancials(match.entry_amount, match.entry_amount)
  Object.assign(match, {
    opponent_user_id: getCurrentUserId(), status: MATCH_STATUS.IN_PROGRESS, prize_pool: financials.grossPool,
    platform_fee: financials.platformFee, winner_amount: financials.winnerAmount, started_at: now(),
  })
  notifyMatchChange(match.id)
  return match.id
}

export async function getMatch(matchId) {
  return withGame(findMatch(matchId))
}

export async function submitRoomCode({ matchId, roomCode }) {
  const match = findMatch(matchId)
  match.room_code = String(roomCode).trim()
  notifyMatchChange(matchId)
}

function localImage(proofFile) {
  return typeof File !== 'undefined' && proofFile instanceof File ? URL.createObjectURL(proofFile) : null
}

export async function submitWinnerClaim({ matchId, proofFile }) {
  const match = findMatch(matchId)
  match.winner_claimed_by = getCurrentUserId()
  match.winner_claim_status = 'PENDING'
  match.winner_claim_path = proofFile?.name || null
  match.winner_claim_image_url = localImage(proofFile)
  notifyMatchChange(matchId)
}

export async function submitMatchDispute({ matchId, reason, proofFile }) {
  const match = findMatch(matchId)
  match.dispute_reason = String(reason).trim()
  match.dispute_screenshot_url = localImage(proofFile)
  match.status = MATCH_STATUS.DISPUTED
  notifyMatchChange(matchId)
}

async function refundMatchEntry(match, userId) {
  await refundWallet({ userId, amount: match.entry_amount, description: 'Match entry refund' })
}

export async function leaveMatch({ matchId }) {
  const match = findMatch(matchId)
  if (match.opponent_user_id !== getCurrentUserId() || match.room_code) throw new Error('This match can no longer be left.')
  await refundMatchEntry(match, match.opponent_user_id)
  match.opponent_user_id = null
  match.status = MATCH_STATUS.OPEN
  match.started_at = null
  match.prize_pool = 0
  match.platform_fee = 0
  match.winner_amount = 0
  notifyMatchChange(matchId)
}

export async function cancelMatch({ matchId }) {
  const match = findMatch(matchId)
  if (match.host_user_id !== getCurrentUserId() || match.opponent_user_id || match.room_code) throw new Error('This match can no longer be cancelled.')
  await refundMatchEntry(match, match.host_user_id)
  match.status = MATCH_STATUS.CANCELLED
  notifyMatchChange(matchId)
}

export function subscribeToLobby(gameId, callback) {
  const handler = event => {
    const match = mockStore.matches.find(item => item.id === event.detail.matchId)
    if (match?.game_id === gameId) callback({ event: 'UPDATE', match })
  }
  window.addEventListener('playnexa:match-change', handler)
  return () => window.removeEventListener('playnexa:match-change', handler)
}

export function subscribeToMatch(matchId, callback) {
  const handler = event => { if (event.detail.matchId === matchId) callback(event) }
  window.addEventListener('playnexa:match-change', handler)
  return () => window.removeEventListener('playnexa:match-change', handler)
}

export async function getSettlementQueue() {
  return mockStore.settlementMatches.map(match => ({ ...match }))
}

export async function declareMatchWinner({ matchId, winnerUserId }) {
  const match = mockStore.settlementMatches.find(item => item.id === matchId)
  if (!match) throw new Error('Settlement could not be found.')
  match.status = MATCH_STATUS.COMPLETED
  match.winner_claim_status = 'APPROVED'
  await creditWallet({ userId: winnerUserId, amount: match.winner_amount, description: 'Match winnings' })
}

export async function refundMatchPlayers(matchId) {
  const match = mockStore.settlementMatches.find(item => item.id === matchId)
  if (!match) throw new Error('Settlement could not be found.')
  await Promise.all([match.host_user_id, match.opponent_user_id].filter(Boolean).map(userId => refundWallet({
    userId, amount: match.entry_amount, description: 'Match refund',
  })))
  match.status = MATCH_STATUS.CANCELLED
}

export async function rejectMatchWinnerClaim(matchId) {
  const match = mockStore.settlementMatches.find(item => item.id === matchId)
  if (!match) throw new Error('Settlement could not be found.')
  match.winner_claim_status = 'REJECTED'
}
