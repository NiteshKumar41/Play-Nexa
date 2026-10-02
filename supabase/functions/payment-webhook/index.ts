import { getPaymentProvider, handleWebhook } from '../_shared/payment-provider.ts'
import { errorResponse, handleOptions, jsonResponse } from '../_shared/http.ts'
import { processVerifiedPayment } from '../_shared/process-payment.ts'

Deno.serve(async request => {
  const options = handleOptions(request)
  if (options) return options
  if (request.method !== 'POST') return errorResponse(new Error('Method not allowed.'), 405)

  try {
    const rawBody = await request.text()
    const event = await handleWebhook(
      getPaymentProvider(),
      rawBody,
      request.headers.get('x-payment-signature'),
    )
    const orderId = await processVerifiedPayment(event)
    return jsonResponse({ received: true, order_id: orderId })
  } catch (error) {
    console.error('payment-webhook rejected event:', error)
    return errorResponse(error, 400)
  }
})
