// POST /api/trials/start — Start a 30-day free trial, return license key
import { supabase, generateLicenseKey, errorResponse, successResponse } from '../lib/supabase'

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

  const email = body.email?.trim()?.toLowerCase()
  if (!email) {
    return errorResponse(400, 'email is required')
  }

  // Check if this email already has a trial or active license
  const { data: existing } = await supabase
    .from('licenses')
    .select('id, status')
    .eq('email', email)
    .in('status', ['trialing', 'active'])
    .maybeSingle()

  if (existing) {
    return errorResponse(409, 'Email already has an active or trialing license')
  }

  const licenseKey = generateLicenseKey()
  const trialDays = 30
  const trialEndsAt = new Date(Date.now() + trialDays * 86400 * 1000).toISOString()

  const { data, error } = await supabase
    .from('licenses')
    .insert({
      product_slug: 'solo',
      email,
      license_key: licenseKey,
      status: 'trialing',
      trial_ends_at: trialEndsAt,
      expires_at: trialEndsAt,
      issued_by: 'self',
    })
    .select()
    .single()

  if (error) {
    return errorResponse(500, `Failed to create trial: ${error.message}`)
  }

  return successResponse({
    license_key: licenseKey,
    email,
    trial_ends_at: trialEndsAt,
    expires_at: trialEndsAt,
    product: 'solo',
    status: 'trialing',
  }, 201)
}
