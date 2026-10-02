/**
 * @typedef {'ACTIVE' | 'JOINED' | 'COMPLETED' | 'DISPUTED' | 'SETTLED' | 'CANCELLED' | 'REJECTED'} MatchStatus
 */

/**
 * Fields returned by GET /api/v1/matches for each active lobby item.
 * @typedef {Object} MatchListItem
 * @property {string} id
 * @property {string} gameId
 * @property {number} gameCode
 * @property {string} player1
 * @property {string} player1Name
 * @property {number} player1Amount
 * @property {MatchStatus} status
 * @property {number} prizePool
 * @property {string} createdAt
 */

/**
 * Match detail shape returned by the backend serializer.
 * Some private fields are omitted unless the requester is a participant or admin.
 * @typedef {MatchListItem & {
 *   game?: { id: string, gameCode: number, name: string, imageUrl: string },
 *   player2: string | null,
 *   player2Name: string | null,
 *   player2Amount: number | null,
 *   roomCode?: string,
 *   platformFee: number,
 *   winnerAmount: number,
 *   joinedAt: string | null,
 *   cancelledAt: string | null,
 *   completedAt: string | null
 * }} Match
 */

/**
 * The existing player pages' display model; the service maps backend names to it.
 * @typedef {Object} PlayerMatch
 * @property {string} id
 * @property {string} game_id
 * @property {{ id: string, name: string, slug: string, category: string, image_url: string }} game
 * @property {string} host_user_id
 * @property {string | null} opponent_user_id
 * @property {number} entry_amount
 * @property {number} prize_pool
 * @property {number} platform_fee
 * @property {number} winner_amount
 * @property {string} [room_code]
 * @property {string} status
 * @property {string} created_at
 * @property {string | null} started_at
 * @property {string | null} finished_at
 * @property {string | null} cancelled_at
 */

export {}
