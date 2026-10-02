import { mockStore, now } from './mockStore'
import { getPendingDisputeCount } from './adminSettlementService'
import { apiClient } from './apiClient'

export async function getAdminDashboardSummary() {
  const pendingDisputes = await getPendingDisputeCount()
  return {
    deposits_total: 18500,
    withdrawals_total: 8500,
    completed_matches: 148,
    platform_earnings: 6240,
    pending_deposits: mockStore.deposits.filter(item => item.status === 'PENDING').reduce((sum, item) => sum + Number(item.amount), 0),
    pending_withdrawals: mockStore.payouts.filter(item => item.status === 'INITIATED').reduce((sum, item) => sum + Number(item.amount), 0),
    pending_disputes: pendingDisputes,
    players: mockStore.users.length,
    pending_tickets: mockStore.supportTickets.filter(item => item.status === 'OPEN' || item.status === 'IN_PROGRESS').length,
  }
}

export async function getAdminDeposits() {
  const deposits = await getAllAdminPages('/admin/deposits', 'deposits')
  return deposits.map(deposit => ({
    id: deposit.transactionId,
    user_id: deposit.userId,
    user: { full_name: deposit.userName, phone: deposit.phone },
    amount: deposit.amount,
    status: { SUCCESS: 'APPROVED', FAILED: 'REJECTED' }[deposit.status] || deposit.status,
    created_at: deposit.createdAt,
    proof_url: deposit.proofUrl,
    payment_method: { display_name: deposit.upiId || 'Manual UPI', provider: 'manual_upi' },
  }))
}

async function getAllAdminPages(path, key) {
  const pageSize = 100
  const firstPage = await apiClient.get(`${path}?page=1&limit=${pageSize}`)
  const { [key]: firstRows, pagination } = firstPage.data
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, pagination.totalPages - 1) }, (_, index) =>
      apiClient.get(`${path}?page=${index + 2}&limit=${pageSize}`),
    ),
  )
  return [
    ...firstRows,
    ...remainingPages.flatMap(response => response.data[key]),
  ]
}

export async function processManualDeposit({ depositId, approve, reason = 'Payment proof could not be verified' }) {
  const action = approve ? 'approve' : 'reject'
  const response = await apiClient.post(
    `/admin/deposits/${encodeURIComponent(depositId)}/${action}`,
    approve ? {} : { reason },
  )
  return response.data.deposit
}

export async function getAdminDepositProof(proofUrl) {
  return apiClient.getBlob(proofUrl)
}

export async function getAdminPaymentMethods() {
  const methods = await getAllAdminPages('/admin/payment-methods', 'paymentMethods')
  return methods.map(method => ({
    id: method.id,
    display_name: method.payeeName,
    provider: 'manual_upi',
    upi_id: method.upiId,
    payee_name: method.payeeName,
    qr_url: method.qrUrl,
    qr_storage_path: method.qrUrl,
    is_active: method.status,
    created_at: method.createdAt,
  }))
}

export async function saveAdminPaymentMethod(method) {
  const upiId = String(method.upiId ?? '').trim()
  const payeeName = String(method.payeeName ?? '').trim()
  if (!/^[^\s@]+@[^\s@]+$/.test(upiId)) {
    throw new Error('Enter a valid UPI ID such as payments@bank.')
  }
  if (!payeeName) {
    throw new Error('Payee name is required.')
  }
  if (!method.id && !(typeof File !== 'undefined' && method.qrFile instanceof File && method.qrFile.size)) {
    throw new Error('Upload a QR image when creating a payment method.')
  }

  const form = new FormData()
  form.set('upiId', upiId)
  form.set('payeeName', payeeName)
  if (method.qrFile instanceof File && method.qrFile.size) form.set('qrImage', method.qrFile)

  const path = method.id
    ? `/admin/payment-methods/${encodeURIComponent(method.id)}`
    : '/admin/payment-methods'
  const response = method.id
    ? await apiClient.patch(path, form)
    : await apiClient.post(path, form)
  const paymentMethod = response.data.paymentMethod

  if (method.isActive) {
    await apiClient.patch(`/admin/payment-methods/${encodeURIComponent(paymentMethod.id)}/activate`, {})
  } else if (method.id && method.wasActive) {
    await apiClient.patch(path, { status: false })
  }

  return paymentMethod.id
}

export async function getAdminWithdrawals() {
  const withdrawals = await getAllAdminPages('/admin/withdrawals', 'withdrawals')
  return withdrawals.map(withdrawal => ({
    id: withdrawal.transactionId,
    amount: withdrawal.amount,
    payout_upi_id: withdrawal.upiId,
    payout_utr: withdrawal.upiTransactionId,
    status: withdrawal.status,
    created_at: withdrawal.createdAt,
    wallet: {
      user: {
        full_name: withdrawal.userName || 'Player',
        phone: withdrawal.phone || '',
      },
    },
  }))
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
