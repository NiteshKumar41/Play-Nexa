import { getAdminClient } from './supabase.ts'
import type { VerifiedPaymentEvent } from './payment-provider.ts'

export async function processVerifiedPayment(event: VerifiedPaymentEvent): Promise<string> {
  const { data, error } = await getAdminClient().rpc('process_verified_payment', {
    p_provider: event.provider,
    p_provider_order_id: event.providerOrderId,
    p_provider_payment_id: event.providerPaymentId,
    p_status: event.status,
    p_amount: event.amount,
    p_currency: event.currency,
    p_metadata: event.metadata,
  })

  if (error) throw error
  return data
}
