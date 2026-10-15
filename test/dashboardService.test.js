import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { normalizeDashboardSummary } from '../src/services/dashboardSummary.js'

describe('player dashboard response mapping', () => {
  it('preserves authoritative backend values and bounded activity arrays', () => {
    const result = normalizeDashboardSummary({
      profile: { id: 'user-1', fullName: 'Player One' },
      wallet: { availableBalance: 125.5, walletAvailable: true, recentTransactions: [{ id: 'tx-1' }] },
      matches: { totalPlayed: 3, wins: 2, losses: 1, netWinnings: 98.75, recent: [{ id: 'match-1' }] },
      referrals: { code: 'ABCDEFGH', referredUsers: 1, rewardsCredited: 2.02 },
      recentActivity: [{ activityId: 'transaction-tx-1' }],
    })

    assert.equal(result.wallet.availableBalance, 125.5)
    assert.equal(result.matches.netWinnings, 98.75)
    assert.equal(result.referrals.rewardsCredited, 2.02)
    assert.equal(result.recentActivity[0].activityId, 'transaction-tx-1')
    assert.deepEqual(result.matches.activeRecent, [])
  })

  it('represents legitimate empty data without inventing profile or wallet availability', () => {
    const result = normalizeDashboardSummary({})

    assert.equal(result.profile, null)
    assert.equal(result.wallet.availableBalance, 0)
    assert.equal(result.wallet.walletAvailable, false)
    assert.deepEqual(result.matches.recent, [])
    assert.deepEqual(result.recentActivity, [])
  })
})
