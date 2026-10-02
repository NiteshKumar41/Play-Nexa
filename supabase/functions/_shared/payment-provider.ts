export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'

export interface PaymentOrderInput {
  id: string
  userId: string
  amount: string
  currency: string
}

export interface ProviderOrder {
  providerOrderId: string
  checkout: {
    mode: 'mock' | 'hosted'
    message: string
    checkoutUrl?: string
  }
}

export interface VerifiedPaymentEvent {
  provider: string
  providerOrderId: string
  providerPaymentId: string | null
  status: PaymentStatus
  amount: string
  currency: string
  metadata: Record<string, unknown>
}

export interface PaymentProvider {
  name: string
  createPaymentOrder(input: PaymentOrderInput): Promise<ProviderOrder>
  verifyPayment(rawBody: string, signature: string | null): Promise<VerifiedPaymentEvent>
  handleWebhook(rawBody: string, signature: string | null): Promise<VerifiedPaymentEvent>
}

async function signPayload(rawBody: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function signMockPayload(rawBody: string): Promise<string> {
  const secret = Deno.env.get('PAYMENT_WEBHOOK_SECRET')
  if (!secret) throw new Error('PAYMENT_WEBHOOK_SECRET Edge Function secret is not configured.')
  return signPayload(rawBody, secret)
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

function parseVerifiedEvent(rawBody: string): VerifiedPaymentEvent {
  const payload = JSON.parse(rawBody)
  const statusByType: Record<string, PaymentStatus> = {
    'payment.pending': 'PENDING',
    'payment.succeeded': 'SUCCESS',
    'payment.failed': 'FAILED',
    'payment.cancelled': 'CANCELLED',
  }
  const status = statusByType[payload.type]
  const data = payload.data

  if (
    !status
    || typeof data?.order_id !== 'string'
    || typeof data?.amount !== 'string'
    || typeof data?.currency !== 'string'
  ) {
    throw new Error('Payment provider event is malformed.')
  }

  return {
    provider: payload.provider,
    providerOrderId: data.order_id,
    providerPaymentId: typeof data.payment_id === 'string' ? data.payment_id : null,
    status,
    amount: data.amount,
    currency: data.currency,
    metadata: typeof data.metadata === 'object' && data.metadata !== null ? data.metadata : {},
  }
}

async function verifyMockPayment(rawBody: string, signature: string | null): Promise<VerifiedPaymentEvent> {
  const secret = Deno.env.get('PAYMENT_WEBHOOK_SECRET')
  if (!secret) throw new Error('PAYMENT_WEBHOOK_SECRET Edge Function secret is not configured.')
  if (!signature) throw new Error('Payment webhook signature is required.')

  const expected = await signPayload(rawBody, secret)
  if (!constantTimeEqual(expected, signature.toLowerCase())) {
    throw new Error('Payment webhook signature is invalid.')
  }

  const event = parseVerifiedEvent(rawBody)
  if (event.provider !== 'mock') throw new Error('Webhook provider does not match the configured provider.')
  return event
}

export const mockPaymentProvider: PaymentProvider = {
  name: 'mock',
  async createPaymentOrder(input) {
    return {
      providerOrderId: `mock_${input.id}`,
      checkout: {
        mode: 'mock',
        message: 'Development simulation only. No real payment is collected.',
      },
    }
  },
  verifyPayment: verifyMockPayment,
  handleWebhook: verifyMockPayment,
}

export function getPaymentProvider(): PaymentProvider {
  const provider = Deno.env.get('PAYMENT_PROVIDER')
  if (!provider) throw new Error('Set PAYMENT_PROVIDER to "mock" for development checkout.')
  if (provider === 'mock' && Deno.env.get('PAYMENT_ENVIRONMENT') === 'development') {
    return mockPaymentProvider
  }
  if (provider === 'mock') {
    throw new Error('The mock payment provider is only available when PAYMENT_ENVIRONMENT=development.')
  }
  throw new Error(`Payment provider "${provider}" is not configured. No real payments are enabled.`)
}

export async function handleWebhook(
  provider: PaymentProvider,
  rawBody: string,
  signature: string | null,
): Promise<VerifiedPaymentEvent> {
  return provider.handleWebhook(rawBody, signature)
}
