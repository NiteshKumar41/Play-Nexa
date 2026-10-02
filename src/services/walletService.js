import { apiClient } from './apiClient'
import { TRANSACTION_STATUS } from '../constants/transactionStatus'
import { TRANSACTION_TYPE } from '../constants/transactionTypes'
import { makeId, mockStore, now } from './mockStore'

// Both reads use the JWT identity; the browser never chooses a wallet user ID.
export async function getWallet() {
  const response = await apiClient.get('/wallet')
  return response.data
}

export async function getTransactions({ page = 1, limit = 10 } = {}) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) })
  const response = await apiClient.get(`/wallet/transactions?${query}`)
  return response.data
}

function addTransaction(type, amount, description, status = TRANSACTION_STATUS.COMPLETED) {
  mockStore.walletTransactions.unshift({
    id: makeId('TX'), transaction_type: type, amount: Number(amount), status, description, created_at: now(),
  })
}

export async function createWithdrawal({ amount, upiId, clientRequestId = crypto.randomUUID() }) {
  const response = await apiClient.post('/wallet/withdrawals', {
    amount: String(amount),
    upiId,
    clientRequestId,
  })
  return response.data
}

export async function approveWithdrawal({ withdrawalId, utr, remarks }) {
  const response = await apiClient.post(
    `/admin/withdrawals/${encodeURIComponent(withdrawalId)}/success`,
    { upiTransactionId: utr, remarks },
  )
  return response.data.withdrawal
}

export async function rejectWithdrawal(withdrawalId, reason = 'Withdrawal rejected by administrator') {
  const response = await apiClient.post(
    `/admin/withdrawals/${encodeURIComponent(withdrawalId)}/reject`,
    { reason },
  )
  return response.data.withdrawal
}

export async function debitWallet({ userId, amount, description = 'Match entry' }) {
  const balance = mockStore.walletBalances.get(userId) ?? 0
  if (balance < Number(amount)) throw new Error('Your wallet balance is too low for this match.')
  mockStore.walletBalances.set(userId, balance - Number(amount))
  addTransaction(TRANSACTION_TYPE.MATCH_ENTRY, amount, description)
}

export async function creditWallet({ userId, amount, description = 'Match winnings' }) {
  mockStore.walletBalances.set(userId, (mockStore.walletBalances.get(userId) || 0) + Number(amount))
  addTransaction(TRANSACTION_TYPE.MATCH_WINNING, amount, description)
}

export async function refundWallet({ userId, amount, description = 'Match refund' }) {
  mockStore.walletBalances.set(userId, (mockStore.walletBalances.get(userId) || 0) + Number(amount))
  addTransaction(TRANSACTION_TYPE.REFUND, amount, description)
}
