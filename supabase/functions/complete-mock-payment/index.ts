import { getPaymentProvider, signMockPayload, type PaymentStatus } from '../_shared/payment-provider.ts'
import { errorResponse, handleOptions, jsonResponse } from '../_shared/http.ts'
import { processVerifiedPayment } from '../_shared/process-payment.ts'
import { authenticateRequest, getAdminClient, requireActiveProfile } from '../_shared/supabase.ts'

Deno.serve(async request => {
  const options = handleOptions(request)
  if (options) return options
  if (request.method !== 'POST') return errorResponse(new Error('Method not allowed.'), 405)

  try {
    const user = await authenticateRequest(request)
    await requireActiveProfile(user.id)
    const provider = getPaymentProvider()
    if (provider.name !== 'mock') {
      return errorResponse(new Error('Development checkout is disabled for this payment provider.'), 403)
    }

    const payload = await request.json()
    const status = payload.status as PaymentStatus
    if (!['SUCCESS', 'FAILED', 'CANCELLED'].includes(status)) {
      return errorResponse(new Error('Mock payment status must be SUCCESS, FAILED, or CANCELLED.'))
    }

    const { data: order, error: orderError } = await getAdminClient()
      .from('payment_orders')
      .select('id, amount, currency, provider, provider_order_id, status')
      .eq('id', payload.order_id)
      .eq('user_id', user.id)
      .single()

    if (orderError) throw new Error('Payment order was not found for this account.')
    if (order.provider !== 'mock') throw new Error('Order does not belong to the mock provider.')
    if (!order.provider_order_id) throw new Error('Payment order is not ready for checkout.')
    if (!['PENDING', 'SUCCESS'].includes(order.status)) {
      throw new Error('This mock payment order is no longer available for checkout.')
    }

    const rawBody = JSON.stringify({
      provider: 'mock',
      type: `payment.${status.toLowerCase() === 'success' ? 'succeeded' : status.toLowerCase()}`,
      data: {
        order_id: order.provider_order_id,
        payment_id: status === 'SUCCESS' ? `mock_payment_${order.id}` : null,
        amount: Number(order.amount).toFixed(2),
        currency: order.currency,
        metadata: { development_simulation: true },
      },
    })
    const signature = await signMockPayload(rawBody)
    const verifiedEvent = await provider.verifyPayment(rawBody, signature)
    const processedOrderId = await processVerifiedPayment(verifiedEvent)

    return jsonResponse({
      order_id: processedOrderId,
      status,
      development_only: true,
      message: 'Development simulation only. No real payment was processed.',
    })
  } catch (error) {
    console.error('complete-mock-payment failed:', error)
    return errorResponse(error, 400)
  }
})
