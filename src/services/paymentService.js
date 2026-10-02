import { getSupabaseClient } from '../lib/supabase'

export async function getActiveManualUpiMethod() {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('payment_methods')
    .select('id, display_name, upi_id, payee_name, qr_storage_path')
    .eq('is_active', true)
    .eq('provider', 'manual_upi')
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  let qrUrl = null
  if (data.qr_storage_path) {
    const { data: signedImage, error: imageError } = await client.storage
      .from('deposit_proofs')
      .createSignedUrl(data.qr_storage_path, 600)

    if (imageError) throw imageError
    qrUrl = signedImage.signedUrl
  }

  return { ...data, qrUrl }
}

export async function createPaymentOrder(amount) {
  const { data, error } = await getSupabaseClient()
    .functions.invoke('create-payment-order', {
      body: { amount: String(amount) },
    })

  if (error) throw error
  return data
}

export async function submitManualDeposit({ amount, paymentMethodId, proofFile }) {
  const client = getSupabaseClient()
  const numericAmount = Number(amount)
  const { data: { user }, error: authError } = await client.auth.getUser()

  if (authError) throw authError
  if (!user) throw new Error('Sign in to submit a manual deposit.')
  if (!paymentMethodId) throw new Error('The active manual payment method is unavailable.')
  if (!Number.isFinite(numericAmount) || numericAmount < 100 || numericAmount > 100000
    || Math.round(numericAmount * 100) !== numericAmount * 100) {
    throw new Error('Deposit amount must be between ₹100 and ₹100,000 with up to two decimal places.')
  }
  if (typeof File === 'undefined' || !(proofFile instanceof File)) {
    throw new Error('Select a payment screenshot to upload.')
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(proofFile.type)) {
    throw new Error('Payment proof must be a JPEG, PNG, or WebP image.')
  }
  if (proofFile.size === 0 || proofFile.size > 10 * 1024 * 1024) {
    throw new Error('Payment proof must be smaller than 10 MB.')
  }

  const extensionByType = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  const proofPath = `${user.id}/${crypto.randomUUID()}.${extensionByType[proofFile.type]}`
  const { error: uploadError } = await client.storage
    .from('deposit_proofs')
    .upload(proofPath, proofFile, { contentType: proofFile.type, upsert: false })

  if (uploadError) throw uploadError

  try {
    const { data, error } = await client
      .from('deposits')
      .insert({
        user_id: user.id,
        payment_method_id: paymentMethodId,
        amount: numericAmount.toFixed(2),
        status: 'PENDING',
        proof_path: proofPath,
      })
      .select('id, amount, status, created_at')
      .single()

    if (error) throw error
    return data
  } catch (error) {
    const { error: cleanupError } = await client.storage
      .from('deposit_proofs')
      .remove([proofPath])

    if (cleanupError) {
      throw new Error(
        `Deposit request failed and the uploaded proof could not be removed: ${cleanupError.message}`,
        { cause: error },
      )
    }
    throw error
  }
}

export async function completeMockPayment({ orderId, status }) {
  const { data, error } = await getSupabaseClient()
    .functions.invoke('complete-mock-payment', {
      body: { order_id: orderId, status },
    })

  if (error) throw error
  return data
}
