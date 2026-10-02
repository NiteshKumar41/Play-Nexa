import { apiClient } from './apiClient'
import { clearAuthToken, getAuthToken, saveAuthToken } from './tokenStorage'

function createAuthResult(data) {
  if (!data?.user) {
    throw new Error('The server returned an invalid authentication response.')
  }

  const token = data.token || null
  if (token) saveAuthToken(token)
  else clearAuthToken()

  return {
    user: data.user,
    token,
    session: token ? { user: data.user, access_token: token } : null,
  }
}

function createSignupPayload({ fullName, phone, passcode, email, dob, gender, upiId }) {
  const payload = {
    fullName: String(fullName || '').trim(),
    phone: String(phone || '').trim(),
    password: String(passcode || ''),
  }

  if (email) payload.email = String(email).trim()
  if (dob) payload.dob = String(dob).trim()
  if (gender) payload.gender = String(gender).trim()
  if (upiId) payload.upiId = String(upiId).trim()

  return payload
}

export async function signup(details) {
  const payload = createSignupPayload(details)
  const response = await apiClient.post('/auth/signup', payload, { includeAuth: false })
  return createAuthResult(response.data)
}

export async function login({ phone, passcode }) {
  const response = await apiClient.post('/auth/login', {
    phone: String(phone || '').trim(),
    password: String(passcode || ''),
  }, { includeAuth: false })

  return createAuthResult(response.data)
}

export async function getCurrentUser() {
  if (!getAuthToken()) {
    throw new Error('You are not signed in.')
  }

  const response = await apiClient.get('/auth/me')
  if (!response.data?.user) {
    throw new Error('The server did not return your account details.')
  }

  return response.data.user
}

export async function logout() {
  // The backend has no logout endpoint; clearing the JWT ends this browser session.
  clearAuthToken()
}
