import { saveUserProfile } from './userService'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'
const TOKEN_KEY = 'playnexa.auth-token'
const listeners = new Set()

function readToken() {
  return localStorage.getItem(TOKEN_KEY)
}

function writeSession(session) {
  listeners.forEach(callback => callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session))
}

async function requestAuthApi(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const authToken = token || readToken()

  if (authToken) headers.Authorization = `Bearer ${authToken}`

  const response = await fetch(`${API_BASE_URL}/auth${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json()

  if (!response.ok) {
    const error = new Error(result.message || 'Authentication request failed.')
    error.status = response.status
    throw error
  }

  return result
}

function makeProfile(user) {
  const profile = {
    id: user.id,
    full_name: user.fullName,
    email: user.email || '',
    phone: user.phone,
    upi_id: user.upiId || '',
    user_type: user.role,
    active: user.active ?? true,
    is_blocked: user.isBlocked ?? false,
    created_at: user.createdAt || new Date().toISOString(),
  }

  return saveUserProfile(profile)
}

function makeSession(profile) {
  return {
    user: {
      id: profile.id,
      email: profile.email,
      role: profile.user_type,
      user_metadata: { full_name: profile.full_name },
    },
  }
}

function establishSession(user) {
  const profile = makeProfile(user)
  const session = makeSession(profile)
  writeSession(session)
  return { user: session.user, session }
}

export async function signup(userData) {
  const result = await requestAuthApi('/signup', {
    method: 'POST',
    body: userData,
  })

  localStorage.setItem(TOKEN_KEY, result.data.token)
  return establishSession(result.data.user)
}

export async function login(credentials) {
  const result = await requestAuthApi('/login', {
    method: 'POST',
    body: credentials,
  })

  localStorage.setItem(TOKEN_KEY, result.data.token)
  return establishSession(result.data.user)
}

export async function getCurrentUser() {
  const token = readToken()
  if (!token) throw new Error('You are not signed in.')

  try {
    const result = await requestAuthApi('/me', { token })
    makeProfile(result.data.user)
    return result.data.user
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      localStorage.removeItem(TOKEN_KEY)
      writeSession(null)
    }
    throw error
  }
}

export async function signUp({ phone, passcode, fullName, email, upiId }) {
  return signup({
    phone: String(phone).trim(),
    password: String(passcode),
    fullName: String(fullName).trim(),
    email: String(email || '').trim(),
    upiId: String(upiId || '').trim(),
  })
}

export async function signIn({ phone, passcode }) {
  return login({
    phone: String(phone).trim(),
    password: String(passcode),
  })
}

export async function signOut() {
  localStorage.removeItem(TOKEN_KEY)
  writeSession(null)
}

export async function getSession() {
  if (!readToken()) return { data: { session: null }, error: null }

  const user = await getCurrentUser()
  const profile = makeProfile(user)
  return { data: { session: makeSession(profile) }, error: null }
}

export function onAuthStateChange(callback) {
  listeners.add(callback)
  return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }
}
