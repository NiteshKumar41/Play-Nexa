import { getSupabaseClient } from '../lib/supabase'

async function requireAdmin(client) {
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Sign in with an administrator account.')
  const { data: profile, error } = await client
    .from('users')
    .select('user_type, active, is_blocked')
    .eq('id', user.id)
    .single()
  if (error) throw error
  if (profile.user_type !== 'admin' || !profile.active || profile.is_blocked) {
    throw new Error('Active administrator authorization is required.')
  }
  return user
}

export async function getAdminDashboardSummary() {
  const { data, error } = await getSupabaseClient().rpc('get_admin_dashboard_summary')
  if (error) throw error
  return data
}

export async function getAdminDeposits() {
  const client = getSupabaseClient()
  await requireAdmin(client)
  const { data, error } = await client
    .from('deposits')
    .select('id,user_id,amount,status,proof_path,created_at,payment_method:payment_methods(display_name,provider),user:users(full_name,phone)')
    .order('created_at', { ascending: false })
  if (error) throw error

  return Promise.all(data.map(async row => {
    const { data: proof, error: proofError } = await client.storage
      .from('deposit_proofs')
      .createSignedUrl(row.proof_path, 600)
    if (proofError) throw proofError
    return { ...row, proof_url: proof.signedUrl }
  }))
}

export async function processManualDeposit({ depositId, approve }) {
  const { data, error } = await getSupabaseClient().rpc('process_manual_deposit', {
    p_deposit_id: depositId,
    p_approve: approve,
  })
  if (error) throw error
  return data
}

export async function getAdminWithdrawals() {
  const client = getSupabaseClient()
  await requireAdmin(client)
  const { data, error } = await client
    .from('wallet_transactions')
    .select('id,amount,status,payout_upi_id,payout_utr,payout_transaction_id,created_at,wallet:wallets!inner(user:users!wallets_user_id_fkey(full_name,phone))')
    .eq('transaction_type', 'WITHDRAW')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getAdminGames() {
  const client = getSupabaseClient()
  await requireAdmin(client)
  const { data, error } = await client
    .from('games')
    .select('id,slug,name,category,minimum_entry,maximum_entry,is_active,is_open,image_url')
    .order('name')
  if (error) throw error
  return data
}

export async function saveAdminGame(game) {
  const { data, error } = await getSupabaseClient().rpc('admin_save_game', {
    p_game_id: game.id || null,
    p_slug: game.slug,
    p_name: game.name,
    p_category: game.category,
    p_minimum_entry: game.minimumEntry,
    p_maximum_entry: game.maximumEntry || null,
    p_is_active: game.isActive,
    p_is_open: game.isOpen,
    p_image_url: game.imageUrl || null,
  })
  if (error) throw error
  return data
}

export async function uploadGameImage(file) {
  const client = getSupabaseClient()
  const user = await requireAdmin(client)
  const extensionByType = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  const extension = extensionByType[file?.type]
  if (!extension) throw new Error('Game image must be a JPEG, PNG, or WebP image.')
  if (file.size === 0 || file.size > 10 * 1024 * 1024) {
    throw new Error('Game image must be smaller than 10 MB.')
  }
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`
  const { error } = await client.storage.from('games').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error
  return client.storage.from('games').getPublicUrl(path).data.publicUrl
}

export async function getAdminPaymentMethods() {
  const client = getSupabaseClient()
  await requireAdmin(client)
  const { data, error } = await client
    .from('payment_methods')
    .select('id,display_name,provider,upi_id,payee_name,qr_storage_path,is_active')
    .order('created_at', { ascending: true })
  if (error) throw error
  return Promise.all(data.map(async method => {
    if (!method.qr_storage_path) return { ...method, qr_url: null }
    const { data: signed, error: signedError } = await client.storage
      .from('deposit_proofs')
      .createSignedUrl(method.qr_storage_path, 600)
    if (signedError) throw signedError
    return { ...method, qr_url: signed.signedUrl }
  }))
}

export async function saveAdminPaymentMethod(method) {
  const { data, error } = await getSupabaseClient().rpc('admin_save_payment_method', {
    p_method_id: method.id || null,
    p_display_name: method.displayName,
    p_provider: method.provider,
    p_upi_id: method.upiId || null,
    p_payee_name: method.payeeName || null,
    p_qr_storage_path: method.qrStoragePath || null,
    p_is_active: method.isActive,
  })
  if (error) throw error
  return data
}

export async function uploadPaymentQr(file) {
  const client = getSupabaseClient()
  const user = await requireAdmin(client)
  const extensionByType = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  const extension = extensionByType[file?.type]
  if (!extension) throw new Error('QR image must be a JPEG, PNG, or WebP image.')
  if (file.size === 0 || file.size > 10 * 1024 * 1024) {
    throw new Error('QR image must be smaller than 10 MB.')
  }
  const path = `${user.id}/payment-qr/${crypto.randomUUID()}.${extension}`
  const { error } = await client.storage.from('deposit_proofs').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function getAdminUsers() {
  const client = getSupabaseClient()
  await requireAdmin(client)
  const [
    { data: users, error: usersError },
    { data: wallets, error: walletsError },
    { data: matches, error: matchesError },
  ] = await Promise.all([
    client.from('users').select('id,full_name,phone,email,user_type,active,is_blocked,created_at').order('created_at', { ascending: false }),
    client.from('wallets').select('user_id,balance'),
    client.from('game_matches').select('host_user_id,opponent_user_id'),
  ])
  if (usersError) throw usersError
  if (walletsError) throw walletsError
  if (matchesError) throw matchesError
  const balances = new Map(wallets.map(wallet => [wallet.user_id, Number(wallet.balance)]))
  const matchCounts = new Map()
  for (const match of matches) {
    for (const userId of new Set([match.host_user_id, match.opponent_user_id].filter(Boolean))) {
      matchCounts.set(userId, (matchCounts.get(userId) || 0) + 1)
    }
  }
  return users.map(user => ({
    ...user,
    balance: balances.get(user.id) || 0,
    matches: matchCounts.get(user.id) || 0,
  }))
}

export async function updateAdminUser({ userId, active, blocked, userType }) {
  const { data, error } = await getSupabaseClient().rpc('admin_update_user', {
    p_user_id: userId,
    p_active: active ?? null,
    p_is_blocked: blocked ?? null,
    p_user_type: userType ?? null,
  })
  if (error) throw error
  return data
}
