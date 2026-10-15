function numberOrZero(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function normalizeDashboardSummary(data) {
  const wallet = data?.wallet || {}
  const matches = data?.matches || {}
  const referrals = data?.referrals || {}

  return {
    profile: data?.profile || null,
    wallet: {
      availableBalance: numberOrZero(wallet.availableBalance),
      walletAvailable: wallet.walletAvailable === true,
      pendingDeposits: numberOrZero(wallet.pendingDeposits),
      pendingWithdrawals: numberOrZero(wallet.pendingWithdrawals),
      totalDeposits: numberOrZero(wallet.totalDeposits),
      totalWithdrawals: numberOrZero(wallet.totalWithdrawals),
      recentTransactions: Array.isArray(wallet.recentTransactions) ? wallet.recentTransactions : [],
    },
    matches: {
      totalPlayed: numberOrZero(matches.totalPlayed),
      wins: numberOrZero(matches.wins),
      losses: numberOrZero(matches.losses),
      active: numberOrZero(matches.active),
      pendingSettlement: numberOrZero(matches.pendingSettlement),
      winRate: numberOrZero(matches.winRate),
      grossWinnings: numberOrZero(matches.grossWinnings),
      netWinnings: numberOrZero(matches.netWinnings),
      entryFeesPaid: numberOrZero(matches.entryFeesPaid),
      recent: Array.isArray(matches.recent) ? matches.recent : [],
      activeRecent: Array.isArray(matches.activeRecent) ? matches.activeRecent : [],
    },
    referrals: {
      code: referrals.code || null,
      hasReferrer: Boolean(referrals.hasReferrer),
      referredUsers: numberOrZero(referrals.referredUsers),
      rewardsCredited: numberOrZero(referrals.rewardsCredited),
      rewardCount: numberOrZero(referrals.rewardCount),
    },
    recentActivity: Array.isArray(data?.recentActivity) ? data.recentActivity : [],
  }
}
