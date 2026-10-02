import { adminUser, player } from '../data'
import { USER_ROLES } from '../constants/userRoles'
import { getUserProfile, saveUserProfile } from './userService'

const SESSION_KEY = 'playnexa.mock-session'
const listeners = new Set()
let nextUserId = 1

function readStoredSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    return session?.user?.id ? session : null
  } catch {
    return null
  }
}

function writeSession(session) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_KEY)
  listeners.forEach(callback => callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session))
}

function makeSession(profile) {
  return { user: { id: profile.id, email: profile.email, user_metadata: { full_name: profile.full_name } } }
}

export async function signUp({ phone, passcode, fullName, email, upiId }) {
  if (String(passcode).length !== 6) throw new Error('Passcode must contain six digits.')
  const profile = {
    id: `MOCK-${Date.now()}-${nextUserId++}`,
    full_name: String(fullName).trim(),
    email: String(email).trim().toLowerCase(),
    phone: String(phone).trim(),
    upi_id: String(upiId).trim(),
    user_type: USER_ROLES.PLAYER,
    active: true,
    is_blocked: false,
    created_at: new Date().toISOString(),
  }
  saveUserProfile(profile)
  const session = makeSession(profile)
  writeSession(session)
  return { user: session.user, session }
}

export async function signIn({ email, passcode }) {
  if (!String(email).trim() || !String(passcode).trim()) throw new Error('Enter your email and passcode.')
  const normalizedEmail = String(email).trim().toLowerCase()
  const profile = await getUserProfile(normalizedEmail === adminUser.email ? adminUser.id : player.id)
  if (!profile) throw new Error('No local demo profile is available.')
  if (profile.is_blocked || !profile.active) throw new Error('This account cannot sign in.')
  const session = makeSession(profile)
  writeSession(session)
  return { user: session.user, session }
}

export async function signOut() {
  writeSession(null)
}

export async function getSession() {
  return { data: { session: readStoredSession() }, error: null }
}

export function onAuthStateChange(callback) {
  listeners.add(callback)
  return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }
}
