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
 * @typedef {Object} SettlementFinancials
 * @property {number} player1Amount
 * @property {number | null} player2Amount
 * @property {number} prizePool
 * @property {number} platformFee
 * @property {number} winnerAmount
 * @property {number | null} refundAmountPerPlayer
 */

export {}
