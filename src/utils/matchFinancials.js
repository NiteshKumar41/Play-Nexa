/** Return only display-safe gross pool data for local mock fixtures. */
export function calculateMatchFinancials(player1Amount, player2Amount) {
  const entry = Math.min(player1Amount, player2Amount)
  const grossPool = player1Amount + player2Amount
  return { entry, grossPool }
}
