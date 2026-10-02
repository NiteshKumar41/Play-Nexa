import { users } from '../data/users'

const PROFILE_KEY = 'playnexa.mock-profiles'

function loadSavedProfiles() {
  try {
    const savedProfiles = JSON.parse(localStorage.getItem(PROFILE_KEY) || '[]')
    return Array.isArray(savedProfiles) ? savedProfiles : []
  } catch {
    return []
  }
}

const profiles = new Map([...users, ...loadSavedProfiles()].map(user => [user.id, { ...user }]))

function saveProfiles() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify([...profiles.values()]))
}

export async function getUserProfile(userId) {
  return profiles.get(userId) || null
}

export function getCurrentUserId() {
  try {
    return JSON.parse(localStorage.getItem('playnexa.mock-session') || 'null')?.user?.id || null
  } catch {
    return null
  }
}

export function saveUserProfile(profile) {
  profiles.set(profile.id, { ...profile })
  saveProfiles()
  return profiles.get(profile.id)
}

export async function updateOwnProfile(userId, updates) {
  const profile = profiles.get(userId)
  if (!profile) throw new Error('That profile could not be found.')
  const editableFields = ['full_name', 'dob', 'gender', 'upi_id']
  const safeUpdates = Object.fromEntries(Object.entries(updates).filter(([key]) => editableFields.includes(key)))
  const updatedProfile = { ...profile, ...safeUpdates }
  profiles.set(userId, updatedProfile)
  saveProfiles()
  return updatedProfile
}
