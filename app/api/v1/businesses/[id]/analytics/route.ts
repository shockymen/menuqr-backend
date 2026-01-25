import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET - Business analytics dashboard
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const businessId = params.id
    
    // Authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify business ownership
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('user_id')
      .eq('id', businessId)
      .single()

    if (bizError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (business.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get time range from query params (default: last 30 days)
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get total QR scans
    const { count: totalScans } = await supabase
      .from('qr_scans')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('scanned_at', startDate.toISOString())

    // Get total menu views
    const { count: totalMenuViews } = await supabase
      .from('menu_views')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('viewed_at', startDate.toISOString())

    // Get total item views
    const { count: totalItemViews } = await supabase
      .from('item_views')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('viewed_at', startDate.toISOString())

    // Get unique sessions (menu views)
    const { data: uniqueSessions } = await supabase
      .from('menu_views')
      .select('session_id')
      .eq('business_id', businessId)
      .gte('viewed_at', startDate.toISOString())
      .not('session_id', 'is', null)

    const uniqueSessionCount = new Set(uniqueSessions?.map(s => s.session_id)).size

    // Get device breakdown
    const { data: deviceData } = await supabase
      .from('qr_scans')
      .select('device_type')
      .eq('business_id', businessId)
      .gte('scanned_at', startDate.toISOString())

    const deviceBreakdown = deviceData?.reduce((acc: any, scan) => {
      acc[scan.device_type || 'unknown'] = (acc[scan.device_type || 'unknown'] || 0) + 1
      return acc
    }, {})

    // Get top locations
    const { data: locationData } = await supabase
      .from('qr_scans')
      .select('country, city')
      .eq('business_id', businessId)
      .gte('scanned_at', startDate.toISOString())
      .not('country', 'is', null)

    const locationBreakdown = locationData?.reduce((acc: any, scan) => {
      const location = `${scan.city || 'Unknown'}, ${scan.country}`
      acc[location] = (acc[location] || 0) + 1
      return acc
    }, {})

    const topLocations = Object.entries(locationBreakdown || {})
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 10)
      .map(([location, count]) => ({ location, count }))

    const analytics = {
      period_days: days,
      start_date: startDate.toISOString(),
      end_date: new Date().toISOString(),
      overview: {
        total_qr_scans: totalScans || 0,
        total_menu_views: totalMenuViews || 0,
        total_item_views: totalItemViews || 0,
        unique_sessions: uniqueSessionCount || 0
      },
      devices: deviceBreakdown || {},
      top_locations: topLocations
    }

    return NextResponse.json({ data: analytics })

  } catch (error) {
    console.error('Analytics dashboard error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
