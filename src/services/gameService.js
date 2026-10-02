import { getSupabaseClient } from '../lib/supabase'

export async function getPlayableGames() {
  const { data, error } = await getSupabaseClient()
    .from('games')
    .select('id, slug, name, category, minimum_entry, maximum_entry, image_url')
    .eq('is_active', true)
    .eq('is_open', true)
    .order('name')

  if (error) throw error
  return data
}
