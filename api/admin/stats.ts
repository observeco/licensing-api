// GET /api/admin/stats — Dashboard counts (requires ADMIN_API_KEY)
import { supabase, ADMIN_API_KEY, errorResponse, successResponse, corsHeaders } from '../lib/supabase'

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...corsHeaders(), 'Access-Control-Allow-Methods': 'GET, OPTIONS' } })
  }

  const auth = req.headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ') || auth.slice(7) !== ADMIN_API_KEY) {
    return errorResponse(401, 'Unauthorized')
  }

  const { data, error } = await supabase
    .from('licenses')
    .select('status')

  if (error) return errorResponse(500, error.message)

  const total = data?.length || 0
  const active = data?.filter(l => l.status === 'active').length || 0
  const trialing = data?.filter(l => l.status === 'trialing').length || 0
  const expired = data?.filter(l => l.status === 'expired').length || 0
  const cancelled = data?.filter(l => l.status === 'cancelled').length || 0

  return successResponse({ total, active, trialing, expired, cancelled })
}
