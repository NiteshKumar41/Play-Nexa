import { mockMatches } from '../data/matches'
import { games as gameRecords } from '../data/games'
import { paymentMethods } from '../data/admin'
import { deposits, payouts, transactions } from '../data/transactions'
import { tickets } from '../data/supportTickets'
import { users } from '../data/users'
import { TRANSACTION_STATUS } from '../constants/transactionStatus'
import { TRANSACTION_TYPE } from '../constants/transactionTypes'

const createdAt = new Date().toISOString()

export const mockStore = {
  users: users.map(user => ({ ...user })),
  games: gameRecords.map(game => ({ ...game })),
  matches: mockMatches.map(match => ({ ...match })),
  deposits: deposits.map(deposit => ({ ...deposit })),
  payouts: payouts.map(payout => ({ ...payout })),
  paymentMethods: paymentMethods.map(method => ({ ...method })),
  supportTickets: tickets.map(ticket => ({ ...ticket })),
  walletBalances: new Map(users.map(user => [user.id, Number(user.balance)])),
  walletTransactions: transactions.map(transaction => ({
    id: transaction.id,
    transaction_type: transaction.amount < 0 ? TRANSACTION_TYPE.WITHDRAW : TRANSACTION_TYPE.ADD_MONEY,
    amount: Math.abs(transaction.amount),
    status: transaction.status === 'Processing' ? TRANSACTION_STATUS.PROCESSING : TRANSACTION_STATUS.COMPLETED,
    description: transaction.title,
    created_at: createdAt,
  })),
  activePaymentOrder: null,
}

export function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`
}

export function now() {
  return new Date().toISOString()
}

export function notifyMatchChange(matchId) {
  window.dispatchEvent(new CustomEvent('playnexa:match-change', { detail: { matchId } }))
}
