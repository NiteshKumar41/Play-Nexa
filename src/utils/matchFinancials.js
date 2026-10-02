/** Return the shared financial split for a two-player match. */
export function calculateMatchFinancials(player1Amount, player2Amount) {
  const entry = Math.min(player1Amount, player2Amount)
  const grossPool = player1Amount + player2Amount
  const platformFee = Math.round(grossPool * (entry < 100 ? 0.2 : 0.03))
  return { entry, grossPool, platformFee, winnerAmount: grossPool - platformFee }
}
