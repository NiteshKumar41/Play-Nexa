import { getSupabaseClient } from '../lib/supabase'
import { getUserProfile } from './userService'

function normalizePhone(phone) {
  const value = phone.trim()

  if (/^\+[1-9]\d{7,14}$/.test(value)) return value

  const digits = value.replace(/\D/g, '')
  if (/^\d{10}$/.test(digits)) return `+91${digits}`

  throw new Error('Enter a valid phone number with country code.')
}

async function requireActiveProfile(userId) {
  let profile

  try {
    profile = await getUserProfile(userId)
  } catch (error) {
    await signOut()
    throw new Error('Could not load your account profile. Please try again.', { cause: error })
  }

  if (profile.is_blocked) {
    await signOut()
    throw new Error('This account has been blocked. Contact support for help.')
  }

  if (!profile.active) {
    await signOut()
    throw new Error('This account is inactive. Contact support for help.')
  }

  return profile
}

export async function signUp({ phone, passcode, fullName, email, dob, gender, upiId }) {
  const { data, error } = await getSupabaseClient().auth.signUp({
    phone: normalizePhone(phone),
    password: passcode,
    options: {
      data: {
        full_name: fullName.trim(),
        email: email.trim(),
        dob,
        gender,
        upi_id: upiId.trim(),
      },
    },
  })

  if (error) throw error
  if (data.session && data.user) {
    await requireActiveProfile(data.user.id)
  }

  return data
}

export async function signIn({ phone, passcode }) {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    phone: normalizePhone(phone),
    password: passcode,
  })

  if (error) throw error
  if (!data.user) throw new Error('Authentication succeeded without a user account.')

  await requireActiveProfile(data.user.id)
  return data
}

export async function verifyPhoneOtp({ phone, token }) {
  const { data, error } = await getSupabaseClient().auth.verifyOtp({
    phone: normalizePhone(phone),
    token,
    type: 'sms',
  })

  if (error) throw error
  if (!data.user) throw new Error('Phone verification succeeded without a user account.')

  await requireActiveProfile(data.user.id)
  return data
}

export async function signOut() {
  const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' })
  if (error) throw error
}

export function getSession() {
  return getSupabaseClient().auth.getSession()
}

export function onAuthStateChange(callback) {
  return getSupabaseClient().auth.onAuthStateChange(callback)
}
