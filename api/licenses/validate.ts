// POST /api/licenses/validate — Check a license key against Supabase
import { supabase, errorResponse, successResponse } from '../lib/supabase'

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } })
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed')
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return errorResponse(400, 'Invalid JSON')
  }

  const licenseKey = body.license_key?.trim()
  if (!licenseKey) {
    return errorResponse(400, 'license_key is required')
  }

  const { data, error } = await supabase
    .from('licenses')
    .select('*, product_slug!inner(*)')
    .eq('license_key', licenseKey)
    .single()

  if (error || !data) {
    return successResponse({ valid: false, reason: 'License key not found' })
  }

  if (data.status === 'expired' || data.status === 'cancelled') {
    return successResponse({ valid: false, reason: `License is ${data.status}` })
  }

  // Check expiry
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return successResponse({ valid: false, reason: 'License expired' })
  }

  // Check trial expiry
  if (data.status === 'trialing' && data.trial_ends_at && new Date(data.trial_ends_at) < new Date()) {
    return successResponse({ valid: false, reason: 'Trial expired' })
  }

  const product = data.product_slug as any

  return successResponse({
    valid: true,
    license_key: data.license_key,
    product: product.slug,
    status: data.status,
    features: product.features || [],
    expires_at: data.expires_at,
    trial_ends_at: data.trial_ends_at,
  })
}
