import { getSupabaseClient } from '../lib/supabase'

function requireAuthenticatedUser(client) {
  return client.auth.getUser().then(({ data, error }) => {
    if (error) throw error
    if (!data.user) throw new Error('You must be signed in to view your wallet.')
    return data.user
  })
}

export async function getMyWalletOverview() {
  const client = getSupabaseClient()
  const user = await requireAuthenticatedUser(client)

  const { data: wallet, error: walletError } = await client
    .from('wallets')
    .select('id, balance, currency, created_at, updated_at')
    .eq('user_id', user.id)
    .single()

  if (walletError) throw walletError

  const { data: transactions, error: transactionsError } = await client
    .from('wallet_transactions')
    .select('id, transaction_type, amount, status, description, reference_id, created_at')
    .eq('wallet_id', wallet.id)
    .order('created_at', { ascending: false })

  if (transactionsError) throw transactionsError

  return { wallet, transactions }
}

export async function debitWallet({ userId, amount, idempotencyKey, referenceId = null, description = null }) {
  return callWalletFunction('debit_wallet', {
    p_user_id: userId,
    p_amount: amount,
    p_idempotency_key: idempotencyKey,
    p_reference_id: referenceId,
    p_description: description,
  })
}

export async function creditWallet({ userId, amount, idempotencyKey, referenceId = null, description = null }) {
  return callWalletFunction('credit_wallet', {
    p_user_id: userId,
    p_amount: amount,
    p_idempotency_key: idempotencyKey,
    p_reference_id: referenceId,
    p_description: description,
  })
}

export async function refundWallet({ userId, amount, idempotencyKey, referenceId = null, description = null }) {
  return callWalletFunction('refund_wallet', {
    p_user_id: userId,
    p_amount: amount,
    p_idempotency_key: idempotencyKey,
    p_reference_id: referenceId,
    p_description: description,
  })
}

export async function createWithdrawal({ amount, upiId }) {
  const client = getSupabaseClient()
  await requireAuthenticatedUser(client)
  const { data, error } = await client.rpc('create_withdrawal', {
    p_amount: amount,
    p_upi_id: upiId,
    p_idempotency_key: crypto.randomUUID(),
  })

  if (error) throw error
  return data
}

export async function approveWithdrawal({ withdrawalId, utr, payoutTransactionId }) {
  const client = getSupabaseClient()
  await requireAuthenticatedUser(client)
  const { data, error } = await client.rpc('approve_withdrawal', {
    p_withdrawal_id: withdrawalId,
    p_utr: utr,
    p_payout_transaction_id: payoutTransactionId,
  })

  if (error) throw error
  return data
}

export async function rejectWithdrawal(withdrawalId) {
  const client = getSupabaseClient()
  await requireAuthenticatedUser(client)
  const { data, error } = await client.rpc('reject_withdrawal', {
    p_withdrawal_id: withdrawalId,
  })

  if (error) throw error
  return data
}

async function callWalletFunction(functionName, args) {
  const client = getSupabaseClient()
  await requireAuthenticatedUser(client)
  const { data, error } = await client.rpc(functionName, args)
  if (error) throw error
  return data
}
