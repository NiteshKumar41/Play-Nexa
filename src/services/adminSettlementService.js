import { API_V1_BASE_URL } from '../config/api'
import { apiClient } from './apiClient'
import { getAuthToken } from './tokenStorage'

async function requestAdminApi(path, options = {}) {
  if (!getAuthToken()) throw new Error('You are not signed in.')
  return apiClient.request(path, options)
}

export async function getPendingSettlements() {
  const matches = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const response = await requestAdminApi(`/admin/matches/pending-settlement?page=${page}&limit=100`)
    matches.push(...response.data.matches)
    totalPages = response.data.pagination.totalPages
    page += 1
  }

  return matches
}

export async function getPendingDisputeCount() {
  const response = await requestAdminApi('/admin/matches/disputed?page=1&limit=1')
  return response.data.pagination.total
}

async function loadEvidenceImage(path) {
  if (!path) return null

  const evidenceUrl = new URL(path, `${API_V1_BASE_URL}/`).toString()
  const image = await apiClient.getBlob(evidenceUrl)
  return URL.createObjectURL(image)
}

export async function getSettlement(matchId) {
  const encodedMatchId = encodeURIComponent(matchId)
  const [settlementResponse, matchResponse] = await Promise.all([
    requestAdminApi(`/admin/matches/${encodedMatchId}/settlement`),
    requestAdminApi(`/matches/${encodedMatchId}`),
  ])

  const settlement = settlementResponse.data
  const match = settlement.match
  const imageResults = await Promise.allSettled([
    loadEvidenceImage(match.p1Screenshot),
    loadEvidenceImage(match.p2Screenshot),
  ])

  if (imageResults.some(result => result.status === 'rejected')) {
    for (const result of imageResults) {
      if (result.status === 'fulfilled' && result.value) {
        URL.revokeObjectURL(result.value)
      }
    }
    throw imageResults.find(result => result.status === 'rejected').reason
  }

  const [player1ScreenshotUrl, player2ScreenshotUrl] = imageResults.map(result => result.value)

  return {
    ...settlement,
    match: {
      ...match,
      roomCode: matchResponse.data.match.roomCode,
      joinedAt: matchResponse.data.match.joinedAt,
      player1ScreenshotUrl,
      player2ScreenshotUrl,
    },
  }
}

export function releaseSettlementEvidence(settlement) {
  const match = settlement?.match
  if (match?.player1ScreenshotUrl) URL.revokeObjectURL(match.player1ScreenshotUrl)
  if (match?.player2ScreenshotUrl) URL.revokeObjectURL(match.player2ScreenshotUrl)
}

export function declareWinner(matchId, winnerUserId) {
  return requestAdminApi(`/admin/matches/${encodeURIComponent(matchId)}/settle`, {
    method: 'POST',
    body: { action: 'DECLARE_WINNER', winnerUserId },
  })
}

export function refundBothPlayers(matchId) {
  return requestAdminApi(`/admin/matches/${encodeURIComponent(matchId)}/settle`, {
    method: 'POST',
    body: { action: 'REFUND_BOTH' },
  })
}

export function rejectWinnerClaim(matchId, reason) {
  return requestAdminApi(`/admin/matches/${encodeURIComponent(matchId)}/settle`, {
    method: 'POST',
    body: { action: 'REJECT_CLAIM', reason },
  })
}
