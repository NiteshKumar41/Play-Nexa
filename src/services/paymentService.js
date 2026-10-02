import { apiClient } from './apiClient'

export async function getActiveManualUpiMethod() {
  const response = await apiClient.get('/payment-methods/active')
  return response.data.paymentMethod
}

export async function submitManualDeposit({ amount, proofFile }) {
  if (typeof File === 'undefined' || !(proofFile instanceof File) || !proofFile.size) {
    throw new Error('Choose a payment proof image.')
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(proofFile.type)) {
    throw new Error('Payment proof must be a JPEG, PNG, or WebP image.')
  }
  if (proofFile.size > 5 * 1024 * 1024) {
    throw new Error('Payment proof must be 5 MB or smaller.')
  }

  const form = new FormData()
  form.set('amount', String(amount))
  form.set('proof', proofFile)
  const response = await apiClient.post('/wallet/deposits', form)
  return response.data
}
