import { apiClient } from './apiClient'

let razorpayScriptPromise

export function loadRazorpayCheckout() {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.Razorpay) return Promise.resolve(true)
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise(resolve => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      script.onload = () => resolve(Boolean(window.Razorpay))
      script.onerror = () => {
        razorpayScriptPromise = null
        resolve(false)
      }
      document.head.appendChild(script)
    })
  }
  return razorpayScriptPromise
}

export async function createRazorpayOrder({ amount, clientRequestId }) {
  const response = await apiClient.post('/payments/razorpay/order', {
    amount,
    clientRequestId,
  })
  return response.data
}

export async function verifyRazorpayPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const response = await apiClient.post('/wallet/deposits/verify', {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  })
  return response.data
}

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
