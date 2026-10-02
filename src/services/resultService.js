import { API_V1_BASE_URL } from '../config/api'
import { apiClient } from './apiClient'
import { getAuthToken } from './tokenStorage'

async function requestResultApi(path, { method = 'GET', body } = {}) {
  const token = getAuthToken()
  if (!token) throw new Error('You are not signed in.')

  const response = await apiClient.request(path, {
    method,
    body,
  })
  return response.data
}

async function loadEvidence(url) {
  if (!url) return null
  const token = getAuthToken()
  if (!token) throw new Error('You are not signed in.')
  const evidenceUrl = new URL(url, `${API_V1_BASE_URL}/`).toString()
  const image = await apiClient.getBlob(evidenceUrl)
  return URL.createObjectURL(image)
}

export async function submitWinnerClaim(matchId, { screenshot, remarks = '' }) {
  const formData = new FormData()
  formData.append('winnerClaim', 'true')
  formData.append('screenshot', screenshot)
  if (remarks.trim()) formData.append('remarks', remarks.trim())

  return requestResultApi(`/matches/${encodeURIComponent(matchId)}/result`, {
    method: 'POST',
    body: formData,
  })
}

export async function submitDispute(matchId, { reason, screenshot }) {
  const formData = new FormData()
  formData.append('reason', reason.trim())
  formData.append('screenshot', screenshot)

  return requestResultApi(`/matches/${encodeURIComponent(matchId)}/dispute`, {
    method: 'POST',
    body: formData,
  })
}

export async function getResult(matchId) {
  const { match } = await requestResultApi(
    `/matches/${encodeURIComponent(matchId)}/result`,
  )

  let player1ScreenshotUrl
  let player2ScreenshotUrl
  const evidenceResults = await Promise.allSettled([
    loadEvidence(match.p1Screenshot),
    loadEvidence(match.p2Screenshot),
  ])

  if (evidenceResults.some(result => result.status === 'rejected')) {
    for (const result of evidenceResults) {
      if (result.status === 'fulfilled' && result.value) {
        URL.revokeObjectURL(result.value)
      }
    }
    throw evidenceResults.find(result => result.status === 'rejected').reason
  }

  [player1ScreenshotUrl, player2ScreenshotUrl] = evidenceResults.map(result => result.value)
  return { ...match, player1ScreenshotUrl, player2ScreenshotUrl }
}

export function releaseResultEvidence(result) {
  if (result?.player1ScreenshotUrl) URL.revokeObjectURL(result.player1ScreenshotUrl)
  if (result?.player2ScreenshotUrl) URL.revokeObjectURL(result.player2ScreenshotUrl)
}

export async function getAdminResults() {
  const { matches } = await requestResultApi('/matches/admin/results')
  return matches
}
