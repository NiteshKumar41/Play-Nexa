import { apiClient } from './apiClient'

export async function getProfile() {
  const response = await apiClient.get('/profile/me')
  if (!response.data?.profile) throw new Error('The server did not return your profile.')
  return response.data.profile
}

export async function updateProfile(details) {
  const response = await apiClient.patch('/profile/me', details)
  if (!response.data?.profile) throw new Error('The server did not return your updated profile.')
  return response.data.profile
}
