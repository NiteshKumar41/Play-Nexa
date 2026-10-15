import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mapAdminDashboardSummary } from '../src/services/adminDashboardSummary.js'

describe('admin dashboard summary mapping', () => {
  it('keeps recorded commission separate from legacy platform fees', () => {
    const result = mapAdminDashboardSummary({
      totalDeposits: 1000,
      totalWithdrawals: 250,
      completedMatches: 4,
      platformCommissionTotal: 18.5,
      platformCommissionCount: 3,
      legacyPlatformFeeTotal: 6,
      legacySettledMatchCount: 1,
      pendingDeposits: 2,
      pendingWithdrawals: 1,
      totalUsers: 11,
      openSupportTickets: 5,
    }, 7)

    assert.deepEqual(result, {
      deposits_total: 1000,
      withdrawals_total: 250,
      completed_matches: 4,
      platform_commission_total: 18.5,
      platform_commission_count: 3,
      legacy_platform_fee_total: 6,
      legacy_settled_match_count: 1,
      pending_deposits: 2,
      pending_withdrawals: 1,
      pending_disputes: 7,
      players: 11,
      pending_tickets: 5,
    })
  })
})
