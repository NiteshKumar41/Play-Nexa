import { getPaymentProvider } from '../_shared/payment-provider.ts'
import { authenticateRequest, getAdminClient, requireActiveProfile } from '../_shared/supabase.ts'
import { errorResponse, handleOptions, jsonResponse } from '../_shared/http.ts'

function validAmount(amount: unknown): amount is string {
  if (typeof amount !== 'string' || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(amount)) return false
  const value = Number(amount)
  return Number.isFinite(value) && value >= 100 && value <= 100000
}

Deno.serve(async request => {
  const options = handleOptions(request)
  if (options) return options
  if (request.method !== 'POST') return errorResponse(new Error('Method not allowed.'), 405)

  try {
    const user = await authenticateRequest(request)
    await requireActiveProfile(user.id)
    const payload = await request.json()
    if (!validAmount(payload.amount)) {
      return errorResponse(new Error('Amount must be between ₹100 and ₹100,000, with at most two decimal places.'))
    }

    const provider = getPaymentProvider()
    const admin = getAdminClient()
    const orderId = crypto.randomUUID()
    const amount = Number(payload.amount).toFixed(2)

    const { error: insertError } = await admin
      .from('payment_orders')
      .insert({
        id: orderId,
        user_id: user.id,
        amount,
        currency: 'INR',
        provider: provider.name,
        status: 'CREATED',
        metadata: { source: 'wallet_top_up' },
      })

    if (insertError) throw insertError

    try {
      const providerOrder = await provider.createPaymentOrder({
        id: orderId,
        userId: user.id,
        amount,
        currency: 'INR',
      })

      const { error: updateError } = await admin
        .from('payment_orders')
        .update({
          provider_order_id: providerOrder.providerOrderId,
          status: 'PENDING',
        })
        .eq('id', orderId)

      if (updateError) throw updateError

      return jsonResponse({
        order: { id: orderId, amount, currency: 'INR', status: 'PENDING' },
        checkout: providerOrder.checkout,
      })
    } catch (providerError) {
      const { error: statusError } = await admin
        .from('payment_orders')
        .update({ status: 'FAILED' })
        .eq('id', orderId)

      if (statusError) {
        throw new Error(
          `Payment provider order creation failed and the order could not be marked failed: ${statusError.message}`,
          { cause: providerError },
        )
      }
      throw providerError
    }
  } catch (error) {
    console.error('create-payment-order failed:', error)
    return errorResponse(error, 400)
  }
})
