export function mapAdminDashboardSummary(summary, pendingDisputes) {
  return {
    deposits_total: summary.totalDeposits,
    withdrawals_total: summary.totalWithdrawals,
    completed_matches: summary.completedMatches,
    platform_commission_total: summary.platformCommissionTotal,
    platform_commission_count: summary.platformCommissionCount,
    legacy_platform_fee_total: summary.legacyPlatformFeeTotal,
    legacy_settled_match_count: summary.legacySettledMatchCount,
    pending_deposits: summary.pendingDeposits,
    pending_withdrawals: summary.pendingWithdrawals,
    pending_disputes: pendingDisputes,
    players: summary.totalUsers,
    pending_tickets: summary.openSupportTickets,
  }
}
