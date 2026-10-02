import { getSupabaseClient } from '../lib/supabase'

const matchDetails = `
  id,
  status,
  entry_amount,
  prize_pool,
  platform_fee,
  winner_amount,
  host_user_id,
  opponent_user_id,
  winner_user_id,
  winner_claimed_by,
  winner_claim_status,
  winner_claim_path,
  dispute_reason,
  dispute_screenshot_path,
  settled_at,
  created_at,
  started_at,
  finished_at,
  game:games!inner(id, slug, name, category, image_url)
`

function newIdempotencyKey() {
  return crypto.randomUUID()
}

export async function getOpenMatches(gameId) {
  const { data, error } = await getSupabaseClient()
    .from('game_matches')
    .select(matchDetails)
    .eq('game_id', gameId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export async function createMatch({ gameId, entryAmount, idempotencyKey = newIdempotencyKey() }) {
  const { data, error } = await getSupabaseClient()
    .rpc('create_match', {
      p_game_id: gameId,
      p_entry_amount: entryAmount,
      p_idempotency_key: idempotencyKey,
    })

  if (error) throw error
  return data
}

export async function joinMatch({ matchId, idempotencyKey = newIdempotencyKey() }) {
  const { data, error } = await getSupabaseClient()
    .rpc('join_match', {
      p_match_id: matchId,
      p_idempotency_key: idempotencyKey,
    })

  if (error) throw error
  return data
}

export async function submitRoomCode({ matchId, roomCode }) {
  const { error } = await getSupabaseClient()
    .rpc('submit_room_code', {
      p_match_id: matchId,
      p_room_code: roomCode,
    })

  if (error) throw error
}

export async function leaveMatch({ matchId }) {
  const { data, error } = await getSupabaseClient()
    .rpc('leave_match', { p_match_id: matchId })

  if (error) throw error
  return data
}

export async function cancelMatch({ matchId }) {
  const { data, error } = await getSupabaseClient()
    .rpc('cancel_match', { p_match_id: matchId })

  if (error) throw error
  return data
}

export async function submitWinnerClaim({ matchId, proofFile }) {
  return uploadMatchEvidence({
    matchId,
    proofFile,
    bucket: 'game_winners',
    rpc: 'submit_winner_claim',
    args: path => ({ p_match_id: matchId, p_screenshot_path: path }),
  })
}

export async function submitMatchDispute({ matchId, reason, proofFile }) {
  return uploadMatchEvidence({
    matchId,
    proofFile,
    bucket: 'game_disputes',
    rpc: 'submit_match_dispute',
    args: path => ({ p_match_id: matchId, p_reason: reason, p_screenshot_path: path }),
  })
}

async function uploadMatchEvidence({ matchId, proofFile, bucket, rpc, args }) {
  const client = getSupabaseClient()
  const { data: { user }, error: authError } = await client.auth.getUser()

  if (authError) throw authError
  if (!user) throw new Error('Sign in to submit match evidence.')
  if (typeof File === 'undefined' || !(proofFile instanceof File)) {
    throw new Error('Select a screenshot to upload.')
  }
  const extensionByType = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  const extension = extensionByType[proofFile.type]
  if (!extension) throw new Error('Screenshot must be a JPEG, PNG, or WebP image.')
  if (proofFile.size === 0 || proofFile.size > 10 * 1024 * 1024) {
    throw new Error('Screenshot must be smaller than 10 MB.')
  }

  const path = `${user.id}/${matchId}/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await client.storage
    .from(bucket)
    .upload(path, proofFile, { contentType: proofFile.type, upsert: false })

  if (uploadError) throw uploadError

  try {
    const { data, error } = await client.rpc(rpc, args(path))
    if (error) throw error
    return data
  } catch (error) {
    const { error: cleanupError } = await client.storage.from(bucket).remove([path])
    if (cleanupError) {
      throw new Error(
        `Evidence submission failed and the uploaded screenshot could not be removed: ${cleanupError.message}`,
        { cause: error },
      )
    }
    throw error
  }
}

export async function getMatch(matchId) {
  const { data, error } = await getSupabaseClient()
    .from('game_matches')
    .select(matchDetails)
    .eq('id', matchId)
    .single()

  if (error) throw error
  const [winnerEvidence, disputeEvidence] = await Promise.all([
    data.winner_claim_path
      ? getSupabaseClient().storage.from('game_winners').createSignedUrl(data.winner_claim_path, 600)
      : Promise.resolve({ data: null, error: null }),
    data.dispute_screenshot_path
      ? getSupabaseClient().storage.from('game_disputes').createSignedUrl(data.dispute_screenshot_path, 600)
      : Promise.resolve({ data: null, error: null }),
  ])
  if (winnerEvidence.error) throw winnerEvidence.error
  if (disputeEvidence.error) throw disputeEvidence.error

  return {
    ...data,
    winner_claim_image_url: winnerEvidence.data?.signedUrl || null,
    dispute_screenshot_url: disputeEvidence.data?.signedUrl || null,
  }
}

export async function getSettlementQueue() {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('game_matches')
    .select(`
      id, status, entry_amount, prize_pool, winner_amount,
      host_user_id, opponent_user_id, winner_claimed_by,
      winner_claim_status, winner_claim_path, dispute_reason,
      dispute_screenshot_path, game:games!inner(name, slug)
    `)
    .in('status', ['completed', 'disputed', 'under_review'])
    .or('winner_claim_status.eq.PENDING,dispute_reason.not.is.null')
    .order('created_at', { ascending: true })

  if (error) throw error

  return Promise.all(data.map(async match => {
    const [winnerEvidence, disputeEvidence] = await Promise.all([
      match.winner_claim_path
        ? client.storage.from('game_winners').createSignedUrl(match.winner_claim_path, 600)
        : Promise.resolve({ data: null, error: null }),
      match.dispute_screenshot_path
        ? client.storage.from('game_disputes').createSignedUrl(match.dispute_screenshot_path, 600)
        : Promise.resolve({ data: null, error: null }),
    ])
    if (winnerEvidence.error) throw winnerEvidence.error
    if (disputeEvidence.error) throw disputeEvidence.error
    return {
      ...match,
      winner_claim_image_url: winnerEvidence.data?.signedUrl || null,
      dispute_screenshot_url: disputeEvidence.data?.signedUrl || null,
    }
  }))
}

export async function declareMatchWinner({ matchId, winnerUserId }) {
  return callMatchFunction('declare_match_winner', {
    p_match_id: matchId,
    p_winner_user_id: winnerUserId,
  })
}

export async function refundMatchPlayers(matchId) {
  return callMatchFunction('refund_match_players', { p_match_id: matchId })
}

export async function rejectMatchWinnerClaim(matchId) {
  return callMatchFunction('reject_match_winner_claim', { p_match_id: matchId })
}

async function callMatchFunction(functionName, args) {
  const { data, error } = await getSupabaseClient().rpc(functionName, args)
  if (error) throw error
  return data
}
export function subscribeToLobby(gameId, onChange) {
  const client = getSupabaseClient()
  const channel = client
    .channel(`game-lobby:${gameId}`, { config: { private: true } })
    .on('broadcast', { event: '*' }, onChange)
    .subscribe()

  return () => {
    void client.removeChannel(channel)
  }
}

export function subscribeToMatch(matchId, onChange) {
  const client = getSupabaseClient()
  const channel = client
    .channel(`match:${matchId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'game_matches',
        filter: `id=eq.${matchId}`,
      },
      onChange,
    )
    .subscribe()

  return () => {
    void client.removeChannel(channel)
  }
}
