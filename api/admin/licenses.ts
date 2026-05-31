// GET /api/admin/licenses — List all licenses (requires ADMIN_API_KEY)
// POST /api/admin/licenses — Issue a free license
import { supabase, generateLicenseKey, ADMIN_API_KEY, errorResponse, successResponse, corsHeaders } from '../lib/supabase'

function authorize(req: Request): Response | null {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ') || auth.slice(7) !== ADMIN_API_KEY) {
    return errorResponse(401, 'Unauthorized')
  }
  return null
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...corsHeaders(), 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } })
  }

  const authError = authorize(req)
  if (authError) return authError

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('licenses')
      .select('id, email, name, product_slug, status, issued_by, created_at, expires_at, trial_ends_at')
      .order('created_at', { ascending: false })

    if (error) return errorResponse(500, error.message)
    return successResponse(data || [])
  }

  if (req.method === 'POST') {
    let body: any
    try { body = await req.json() } catch { return errorResponse(400, 'Invalid JSON') }

    const email = body.email?.trim()?.toLowerCase()
    const name = body.name?.trim() || ''
    const productSlug = body.product_slug || 'solo'
    const expiresInDays = body.expires_in_days || 365

    if (!email) return errorResponse(400, 'email is required')

    const licenseKey = generateLicenseKey()
    const expiresAt = new Date(Date.now() + expiresInDays * 86400 * 1000).toISOString()

    const { data, error } = await supabase
      .from('licenses')
      .insert({
        product_slug: productSlug,
        email,
        name,
        license_key: licenseKey,
        status: 'active',
        expires_at: expiresAt,
        issued_by: 'admin',
      })
      .select()
      .single()

    if (error) return errorResponse(500, error.message)

    return successResponse({
      license_key: licenseKey,
      email,
      name,
      product_slug: productSlug,
      status: 'active',
      expires_at: expiresAt,
    }, 201)
  }

  return errorResponse(405, 'Method not allowed')
}
