import { paymentMethods } from '../data/admin'
import { getCurrentUserId } from './userService'
import { creditWallet } from './walletService'
import { makeId, mockStore, now } from './mockStore'

export async function getActiveManualUpiMethod() {
  const method = mockStore.paymentMethods.find(item => item.is_active && item.provider === 'manual_upi')
    || paymentMethods.find(item => item.is_active)
  return method ? { ...method, qrUrl: method.qr_url } : null
}

export async function createPaymentOrder(amount) {
  const order = { id: makeId('ORDER'), amount: Number(amount).toFixed(2), currency: 'INR', status: 'PENDING' }
  mockStore.activePaymentOrder = order
  return {
    order,
    checkout: { mode: 'mock', message: 'Development checkout is simulated locally. No real payment is processed.' },
  }
}

export async function submitManualDeposit({ amount, paymentMethodId, proofFile }) {
  if (!paymentMethodId) throw new Error('Choose an active payment method.')
  const deposit = {
    id: makeId('DP'), user_id: getCurrentUserId(), amount: Number(amount).toFixed(2), status: 'PENDING',
    proof_path: proofFile?.name || null,
    proof_url: typeof File !== 'undefined' && proofFile instanceof File ? URL.createObjectURL(proofFile) : null,
    payment_method: mockStore.paymentMethods.find(method => method.id === paymentMethodId), created_at: now(),
  }
  mockStore.deposits.unshift(deposit)
  return deposit
}

export async function completeMockPayment({ orderId, status }) {
  const order = mockStore.activePaymentOrder
  if (!order || order.id !== orderId) throw new Error('This local checkout is no longer available.')
  order.status = status
  if (status === 'SUCCESS') {
    await creditWallet({ userId: getCurrentUserId(), amount: Number(order.amount), description: 'Wallet top-up' })
  }
  return {
    status,
    message: status === 'SUCCESS' ? 'Payment simulated successfully. Your demo wallet was updated.' : `Demo payment ${status.toLowerCase()}.`,
  }
}
