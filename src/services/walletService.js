import { player } from '../data/users'
import { TRANSACTION_STATUS } from '../constants/transactionStatus'
import { TRANSACTION_TYPE } from '../constants/transactionTypes'
import { makeId, mockStore, now } from './mockStore'
import { getCurrentUserId } from './userService'

function currentUserId() {
  return getCurrentUserId() || player.id
}

export async function getMyWalletOverview() {
  const userId = currentUserId()
  return {
    wallet: { id: `W-${userId}`, user_id: userId, balance: mockStore.walletBalances.get(userId) ?? 0, currency: 'INR' },
    transactions: mockStore.walletTransactions.map(transaction => ({ ...transaction })),
  }
}

function addTransaction(type, amount, description, status = TRANSACTION_STATUS.COMPLETED) {
  mockStore.walletTransactions.unshift({
    id: makeId('TX'), transaction_type: type, amount: Number(amount), status, description, created_at: now(),
  })
}

export async function createWithdrawal({ amount, upiId }) {
  const userId = currentUserId()
  const value = Number(amount)
  const balance = mockStore.walletBalances.get(userId) ?? 0
  if (!(value > 0) || value > balance) throw new Error('Enter an amount within your available balance.')
  mockStore.walletBalances.set(userId, balance - value)
  const id = makeId('PO')
  mockStore.payouts.unshift({
    id, amount: value, payout_upi_id: upiId, status: TRANSACTION_STATUS.INITIATED, created_at: now(),
    wallet: { user: mockStore.users.find(user => user.id === userId) },
  })
  addTransaction(TRANSACTION_TYPE.WITHDRAW, value, 'Withdrawal request', TRANSACTION_STATUS.INITIATED)
  return id
}

export async function approveWithdrawal({ withdrawalId, utr, payoutTransactionId }) {
  const payout = mockStore.payouts.find(row => row.id === withdrawalId)
  if (!payout) throw new Error('Withdrawal could not be found.')
  payout.status = TRANSACTION_STATUS.SUCCESS
  payout.payout_utr = utr
  payout.payout_transaction_id = payoutTransactionId
}

export async function rejectWithdrawal(withdrawalId) {
  const payout = mockStore.payouts.find(row => row.id === withdrawalId)
  if (!payout) throw new Error('Withdrawal could not be found.')
  payout.status = TRANSACTION_STATUS.FAILED
  const userId = payout.wallet?.user?.id
  if (userId) mockStore.walletBalances.set(userId, (mockStore.walletBalances.get(userId) || 0) + Number(payout.amount))
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
