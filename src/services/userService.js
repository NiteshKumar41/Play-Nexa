import { getSupabaseClient } from '../lib/supabase'

const profileColumns = [
  'id',
  'full_name',
  'phone',
  'email',
  'dob',
  'gender',
  'upi_id',
  'user_type',
  'active',
  'is_blocked',
].join(',')

const editableProfileFields = new Set(['full_name', 'dob', 'gender', 'upi_id'])

export async function getUserProfile(userId) {
  const { data, error } = await getSupabaseClient()
    .from('users')
    .select(profileColumns)
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

export async function updateOwnProfile(updates) {
  const client = getSupabaseClient()
  const { data: { user }, error: userError } = await client.auth.getUser()

  if (userError) throw userError
  if (!user) throw new Error('You must be signed in to update your profile.')

  const safeUpdates = Object.fromEntries(
    Object.entries(updates).filter(([field]) => editableProfileFields.has(field)),
  )

  if (Object.keys(safeUpdates).length === 0) {
    throw new Error('No editable profile fields were provided.')
  }

  const { data, error } = await client
    .from('users')
    .update(safeUpdates)
    .eq('id', user.id)
    .select(profileColumns)
    .single()

  if (error) throw error
  return data
}
