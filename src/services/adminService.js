import { getCurrentUserId } from './userService'
import { makeId, mockStore, now } from './mockStore'

export async function getAdminDashboardSummary() {
  return {
    deposits_total: 18500,
    withdrawals_total: 8500,
    completed_matches: 148,
    platform_earnings: 6240,
    pending_deposits: mockStore.deposits.filter(item => item.status === 'PENDING').reduce((sum, item) => sum + Number(item.amount), 0),
    pending_withdrawals: mockStore.payouts.filter(item => item.status === 'INITIATED').reduce((sum, item) => sum + Number(item.amount), 0),
    pending_disputes: mockStore.settlementMatches.filter(item => item.status === 'DISPUTED').length,
    players: mockStore.users.length,
    pending_tickets: mockStore.supportTickets.filter(item => item.status === 'OPEN' || item.status === 'IN_PROGRESS').length,
  }
}

export async function getAdminDeposits() {
  return mockStore.deposits.map(deposit => ({ ...deposit, proof_url: deposit.proof_url || null }))
}

export async function processManualDeposit({ depositId, approve }) {
  const deposit = mockStore.deposits.find(item => item.id === depositId)
  if (!deposit) throw new Error('Deposit request could not be found.')
  if (deposit.status !== 'PENDING') throw new Error('This deposit has already been reviewed.')
  deposit.status = approve ? 'APPROVED' : 'REJECTED'
  if (approve) {
    const userId = deposit.user_id || getCurrentUserId()
    mockStore.walletBalances.set(userId, (mockStore.walletBalances.get(userId) || 0) + Number(deposit.amount))
  }
}

export async function getAdminWithdrawals() {
  return mockStore.payouts.map(row => ({ ...row }))
}

export async function getAdminGames() {
  return mockStore.games.map(game => ({ ...game }))
}

export async function saveAdminGame(game) {
  const record = {
    id: game.id || makeId('GAME'), slug: game.slug, name: game.name, category: game.category,
    minimum_entry: Number(game.minimumEntry), maximum_entry: game.maximumEntry,
    is_active: Boolean(game.isActive), is_open: Boolean(game.isOpen), image_url: game.imageUrl || null,
    players: 0, symbol: '🎮', theme: 'carrom', entry: Number(game.minimumEntry),
  }
  const existingIndex = mockStore.games.findIndex(item => item.id === game.id)
  if (existingIndex >= 0) mockStore.games[existingIndex] = { ...mockStore.games[existingIndex], ...record }
  else mockStore.games.push(record)
  return record.id
}

function localImageUrl(file, label) {
  if (typeof File === 'undefined' || !(file instanceof File) || !file.size) return null
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error(`${label} must be a JPEG, PNG, or WebP image.`)
  if (file.size > 10 * 1024 * 1024) throw new Error(`${label} must be smaller than 10 MB.`)
  return URL.createObjectURL(file)
}

export async function uploadGameImage(file) {
  return localImageUrl(file, 'Game image')
}

export async function getAdminPaymentMethods() {
  return mockStore.paymentMethods.map(method => ({ ...method }))
}

export async function saveAdminPaymentMethod(method) {
  if (method.isActive) mockStore.paymentMethods.forEach(item => { item.is_active = false })
  const record = {
    id: method.id || makeId('PM'), display_name: method.displayName, provider: method.provider,
    upi_id: method.upiId || null, payee_name: method.payeeName || null,
    qr_storage_path: method.qrStoragePath || null, qr_url: method.qrStoragePath || null,
    is_active: Boolean(method.isActive),
  }
  const existingIndex = mockStore.paymentMethods.findIndex(item => item.id === method.id)
  if (existingIndex >= 0) mockStore.paymentMethods[existingIndex] = record
  else mockStore.paymentMethods.push(record)
  return record.id
}

export async function uploadPaymentQr(file) {
  return localImageUrl(file, 'QR image')
}

export async function getAdminUsers() {
  return mockStore.users.map(user => ({ ...user, balance: mockStore.walletBalances.get(user.id) || 0 }))
}

export async function updateAdminUser({ userId, active, blocked, userType }) {
  const user = mockStore.users.find(item => item.id === userId)
  if (!user) throw new Error('Player account could not be found.')
  if (active !== undefined) user.active = active
  if (blocked !== undefined) user.is_blocked = blocked
  if (userType) user.user_type = userType
  user.updated_at = now()
}
