import { apiClient } from './apiClient'
import { normalizeAuthenticatedUser } from './authRole'
import { clearAuthToken, getAuthToken, saveAuthToken } from './tokenStorage'

export { normalizeAuthenticatedUser }

function createSession(user, token) {
  return {
    user,
    token,
    session: token ? { user, access_token: token } : null,
  }
}

async function createAuthResult(data) {
  if (!data?.user) {
    throw new Error('The server returned an invalid authentication response.')
  }

  const token = data.token || null
  if (token) saveAuthToken(token)
  else clearAuthToken()

  try {
    return createSession(normalizeAuthenticatedUser(data.user), token)
  } catch (error) {
    // Older login responses may contain a valid token but omit account fields.
    // Resolve the identity from /auth/me, where the backend reloads the role
    // from MongoDB. Never guess a missing role in the browser.
    if (!token || !/invalid account role/i.test(error.message)) {
      clearAuthToken()
      throw error
    }

    try {
      return createSession(await getCurrentUser(), token)
    } catch {
      clearAuthToken()
      throw error
    }
  }
}

function createSignupPayload({ fullName, phone, passcode, email, dob, gender, upiId, referralCode }) {
  const payload = {
    fullName: String(fullName || '').trim(),
    phone: String(phone || '').trim(),
    password: String(passcode || ''),
  }

  if (email) payload.email = String(email).trim()
  if (dob) payload.dob = String(dob).trim()
  if (gender) payload.gender = String(gender).trim()
  if (upiId) payload.upiId = String(upiId).trim()
  if (referralCode) payload.referralCode = String(referralCode).trim()

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
  if (response.data?.user) {
    try {
      return normalizeAuthenticatedUser(response.data.user)
    } catch (error) {
      if (!/invalid account role/i.test(error.message)) throw error
    }
  }

  // Compatibility fallback for deployments where /auth/me still returns the
  // legacy minimal user object. /profile/me is authenticated and reads the
  // same database-backed role; it is not a client-side role source.
  const profileResponse = await apiClient.get('/profile/me')
  if (!profileResponse.data?.profile) {
    throw new Error('The server did not return your account details.')
  }

  return normalizeAuthenticatedUser(profileResponse.data.profile)
}

export async function logout() {
  // The backend has no logout endpoint; clearing the JWT ends this browser session.
  clearAuthToken()
}
