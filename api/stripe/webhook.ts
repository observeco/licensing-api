// POST /api/stripe/webhook — Stripe checkout.session.completed → upsert license
import { supabase, generateLicenseKey, STRIPE_WEBHOOK_SECRET, errorResponse, successResponse } from '../../lib/supabase'

export const config = {
  runtime: 'nodejs18.x',
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, stripe-signature' } })
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed')
  }

  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return errorResponse(400, 'Missing stripe-signature header')
  }

  const body = await req.text()

  let event: any
  try {
    const stripe = await import('stripe')
    const client = new stripe.default(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-02-24.acacia' })
    event = client.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    return errorResponse(400, `Webhook signature verification failed: ${err.message}`)
  }

  if (event.type !== 'checkout.session.completed') {
    return successResponse({ status: 'ignored', event: event.type })
  }

  const session = event.data.object
  const email = session.customer_email || session.customer_details?.email || ''
  const customerId = session.customer
  const subscriptionId = session.subscription
  const plan = session.metadata?.plan || 'solo'

  const licenseKey = generateLicenseKey()

  const { data, error } = await supabase
    .from('licenses')
    .insert({
      product_slug: plan,
      email,
      name: session.customer_details?.name || '',
      license_key: licenseKey,
      status: 'active',
      expires_at: new Date(Date.now() + 365 * 86400 * 1000).toISOString(),
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      issued_by: 'stripe',
    })
    .select()
    .single()

  if (error) {
    return errorResponse(500, `Failed to create license: ${error.message}`)
  }

  return successResponse({ status: 'success', license_key: licenseKey, email }, 201)
}
