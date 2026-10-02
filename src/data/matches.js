import { calculateMatchFinancials } from '../utils/matchFinancials'

export const matches = [
  { id: 'NX-2841', game: 'Chess', opponent: 'Priya Sharma', entry: 100, prizePool: calculateMatchFinancials(100, 100).grossPool, status: 'In progress', room: 'CH-7294' },
  { id: 'NX-2838', game: 'Ludo', opponent: 'Rohan Kapoor', entry: 50, prizePool: calculateMatchFinancials(50, 50).grossPool, status: 'Awaiting result', room: 'LU-1382' },
  { id: 'NX-2812', game: '8 Ball Pool', opponent: 'Ishita Rao', entry: 100, prizePool: calculateMatchFinancials(100, 100).grossPool, status: 'Completed', room: 'PB-5520' },
]

export const lobbyMatches = [
  { id: 'NX-2852', game: 'Chess', creator: 'Neha Verma', entry: 50, pool: 100, status: 'Open' },
  { id: 'NX-2850', game: 'Chess', creator: 'Kabir Singh', entry: 100, pool: 200, status: 'Open' },
  { id: 'NX-2849', game: 'Chess', creator: 'Ananya Iyer', entry: 500, pool: 1000, status: 'Open' },
  { id: 'NX-2847', game: 'Ludo', creator: 'Sana Khan', entry: 100, pool: 200, status: 'Open' },
  { id: 'NX-2846', game: '8 Ball Pool', creator: 'Dev Malhotra', entry: 50, pool: 100, status: 'Open' },
  { id: 'NX-2845', game: 'Carrom', creator: 'Aditi Bose', entry: 500, pool: 1000, status: 'Open' },
]

export const mockMatches = [
  { id: 'NX-2841', game_id: 'chess', status: 'in_progress', entry_amount: 100, prize_pool: 200, platform_fee: 6, winner_amount: 194, host_user_id: 'PL-9021', opponent_user_id: 'PL-9018', winner_claimed_by: null, winner_claim_status: null, winner_claim_path: null, winner_claim_image_url: null, dispute_reason: null, dispute_screenshot_url: null, room_code: 'CH-7294', created_at: '2026-10-02T10:00:00+05:30', started_at: '2026-10-02T10:15:00+05:30', finished_at: null },
  { id: 'NX-2838', game_id: 'ludo', status: 'active', entry_amount: 50, prize_pool: 0, platform_fee: 0, winner_amount: 0, host_user_id: 'PL-9021', opponent_user_id: null, winner_claimed_by: null, winner_claim_status: null, winner_claim_path: null, winner_claim_image_url: null, dispute_reason: null, dispute_screenshot_url: null, room_code: null, created_at: '2026-10-02T09:00:00+05:30', started_at: null, finished_at: null },
  { id: 'NX-2812', game_id: 'pool', status: 'completed', entry_amount: 100, prize_pool: 200, platform_fee: 6, winner_amount: 194, host_user_id: 'PL-9021', opponent_user_id: 'PL-9018', winner_claimed_by: 'PL-9021', winner_claim_status: 'APPROVED', winner_claim_path: null, winner_claim_image_url: null, dispute_reason: null, dispute_screenshot_url: null, room_code: 'PB-5520', created_at: '2026-10-01T09:00:00+05:30', started_at: '2026-10-01T09:15:00+05:30', finished_at: '2026-10-01T09:40:00+05:30' },
  { id: 'NX-2852', game_id: 'chess', status: 'active', entry_amount: 50, prize_pool: 0, platform_fee: 0, winner_amount: 0, host_user_id: 'PL-9018', opponent_user_id: null, winner_claimed_by: null, winner_claim_status: null, winner_claim_path: null, winner_claim_image_url: null, dispute_reason: null, dispute_screenshot_url: null, room_code: null, created_at: '2026-10-02T11:00:00+05:30', started_at: null, finished_at: null },
  { id: 'NX-2850', game_id: 'chess', status: 'active', entry_amount: 100, prize_pool: 0, platform_fee: 0, winner_amount: 0, host_user_id: 'PL-8950', opponent_user_id: null, winner_claimed_by: null, winner_claim_status: null, winner_claim_path: null, winner_claim_image_url: null, dispute_reason: null, dispute_screenshot_url: null, room_code: null, created_at: '2026-10-02T10:30:00+05:30', started_at: null, finished_at: null },
  { id: 'NX-2849', game_id: 'chess', status: 'active', entry_amount: 500, prize_pool: 0, platform_fee: 0, winner_amount: 0, host_user_id: 'PL-8992', opponent_user_id: null, winner_claimed_by: null, winner_claim_status: null, winner_claim_path: null, winner_claim_image_url: null, dispute_reason: null, dispute_screenshot_url: null, room_code: null, created_at: '2026-10-02T10:00:00+05:30', started_at: null, finished_at: null },
]

export const settlementMatches = [
  { id: 'NX-2841', status: 'disputed', entry_amount: 100, prize_pool: 200, winner_amount: 194, host_user_id: 'PL-9021', opponent_user_id: 'PL-9018', winner_claimed_by: 'PL-9021', winner_claim_status: 'PENDING', winner_claim_path: null, winner_claim_image_url: null, dispute_reason: 'Players submitted different results.', dispute_screenshot_url: null, game: { name: 'Chess', slug: 'chess' } },
  { id: 'NX-2838', status: 'completed', entry_amount: 50, prize_pool: 100, winner_amount: 80, host_user_id: 'PL-9018', opponent_user_id: 'PL-8992', winner_claimed_by: 'PL-9018', winner_claim_status: 'PENDING', winner_claim_path: null, winner_claim_image_url: null, dispute_reason: null, dispute_screenshot_url: null, game: { name: 'Ludo', slug: 'ludo' } },
]
