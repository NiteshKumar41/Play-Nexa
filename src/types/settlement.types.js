/**
 * @typedef {Object} SettlementQueueMatch
 * @property {string} id
 * @property {{ id: string, gameCode: number, name: string } | null} game
 * @property {{ id: string, name: string, phone: string, amount: number }} player1
 * @property {{ id: string, name: string, phone: string, amount: number } | null} player2
 * @property {number} prizePool
 * @property {string | null} winnerPlayer
 * @property {string | null} winnerClaimedBy
 * @property {'PENDING' | 'APPROVED' | 'REJECTED' | null} winnerClaimStatus
 * @property {string | null} p1Screenshot
 * @property {string | null} p2Screenshot
 * @property {string | null} disputeReason
 * @property {string} status
 * @property {string} createdAt
 * @property {string | null} completedAt
 *
 * @typedef {Object} SettlementPlayer
 * @property {string} id
 * @property {string} name
 * @property {string} phone
 * @property {number} amount
 *
 * @typedef {Object} SettlementFinancials
 * @property {number} player1Amount
 * @property {number | null} player2Amount
 * @property {number} prizePool
 * @property {number} platformFee
 * @property {number} winnerAmount
 * @property {number | null} refundAmountPerPlayer
 *
 * @typedef {Object} SettlementWalletTransaction
 * @property {string} id
 * @property {string} walletId
 * @property {string} userId
 * @property {'GAME_WIN' | 'GAME_REFUND'} transactionType
 * @property {number} amount
 * @property {number} balanceBefore
 * @property {number} balanceAfter
 * @property {'SUCCESS'} status
 * @property {string | null} referenceId
 * @property {'MATCH_SETTLEMENT' | 'MATCH_REFUND' | null} referenceType
 * @property {string} createdAt
 *
 * @typedef {Object} SettlementDetail
 * @property {Object} match
 * @property {string} match.id
 * @property {{ id: string, gameCode: number, name: string } | null} match.game
 * @property {SettlementPlayer | null} match.player1
 * @property {SettlementPlayer | null} match.player2
 * @property {string} match.status
 * @property {{ id: string, name: string, phone: string } | null} match.winnerPlayer
 * @property {string | null} match.winnerClaimedBy
 * @property {'PENDING' | 'APPROVED' | 'REJECTED' | null} match.winnerClaimStatus
 * @property {string | null} match.p1Screenshot
 * @property {string | null} match.p2Screenshot
 * @property {string | null} match.disputeReason
 * @property {SettlementFinancials} match.financials
 * @property {Object} match.settlement
 * @property {SettlementWalletTransaction[]} walletTransactions
 */

export {}
