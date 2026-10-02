import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error('SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY must be configured as Edge Function secrets.')
}

export function getAdminClient(): SupabaseClient {
  return createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function authenticateRequest(request: Request): Promise<User> {
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('A valid bearer token is required.')
  }

  const token = authorization.slice('Bearer '.length)
  const client = createClient(supabaseUrl!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await client.auth.getUser(token)
  if (error) throw new Error('Authentication failed.')
  return data.user
}

export async function requireActiveProfile(userId: string): Promise<void> {
  const { data, error } = await getAdminClient()
    .from('users')
    .select('active, is_blocked')
    .eq('id', userId)
    .single()

  if (error) throw new Error('Could not verify account status.')
  if (!data.active || data.is_blocked) throw new Error('An active, unblocked account is required.')
}
