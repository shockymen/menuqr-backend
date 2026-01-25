import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST - Track analytics event
// Public endpoint - no auth required (customer tracking)
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { event_type, qr_code_id, business_id, menu_id, item_id, session_id } = body

    // Get client info from request
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const referrer = request.headers.get('referer') || null

    // Determine device type from user agent
    const deviceType = userAgent.toLowerCase().includes('mobile') ? 'mobile' : 
                      userAgent.toLowerCase().includes('tablet') ? 'tablet' : 'desktop'

    if (event_type === 'qr_scan') {
      // Track QR code scan
      if (!qr_code_id || !business_id) {
        return NextResponse.json({ error: 'qr_code_id and business_id required' }, { status: 400 })
      }

      await supabase.from('qr_scans').insert({
        qr_code_id,
        business_id,
        ip_address: ip,
        device_type: deviceType,
        user_agent: userAgent
      })

      // Update scan count on qr_codes table
      await supabase.rpc('increment_qr_scan_count', { qr_id: qr_code_id })

    } else if (event_type === 'menu_view') {
      // Track menu view
      if (!business_id) {
        return NextResponse.json({ error: 'business_id required' }, { status: 400 })
      }

      await supabase.from('menu_views').insert({
        business_id,
        menu_id: menu_id || null,
        session_id: session_id || null,
        ip_address: ip,
        user_agent: userAgent,
        referrer: referrer
      })

    } else if (event_type === 'item_view') {
      // Track item view
      if (!business_id || !item_id) {
        return NextResponse.json({ error: 'business_id and item_id required' }, { status: 400 })
      }

      await supabase.from('item_views').insert({
        business_id,
        item_id,
        session_id: session_id || null
      })

    } else {
      return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 })
    }

    return NextResponse.json({ success: true }, { status: 201 })

  } catch (error) {
    console.error('Analytics event error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
