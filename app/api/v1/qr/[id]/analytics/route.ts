import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET - Individual QR code analytics
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const qrCodeId = params.id
    
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

    // Get QR code and verify ownership
    const { data: qrCode, error: qrError } = await supabase
      .from('qr_codes')
      .select('id, business_id, name, target_url, scan_count')
      .eq('id', qrCodeId)
      .single()

    if (qrError || !qrCode) {
      return NextResponse.json({ error: 'QR code not found' }, { status: 404 })
    }

    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('user_id')
      .eq('id', qrCode.business_id)
      .single()

    if (bizError || !business || business.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get time range
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get scans for this QR code
    const { data: scans } = await supabase
      .from('qr_scans')
      .select('*')
      .eq('qr_code_id', qrCodeId)
      .gte('scanned_at', startDate.toISOString())
      .order('scanned_at', { ascending: false })

    // Device breakdown
    const deviceBreakdown = scans?.reduce((acc: any, scan) => {
      acc[scan.device_type || 'unknown'] = (acc[scan.device_type || 'unknown'] || 0) + 1
      return acc
    }, {})

    // Location breakdown
    const locationBreakdown = scans
      ?.filter(s => s.city && s.country)
      .reduce((acc: any, scan) => {
        const location = `${scan.city}, ${scan.country}`
        acc[location] = (acc[location] || 0) + 1
        return acc
      }, {})

    const topLocations = Object.entries(locationBreakdown || {})
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 10)
      .map(([location, count]) => ({ location, count }))

    // Scans by day
    const scansByDay = scans?.reduce((acc: any, scan) => {
      const date = new Date(scan.scanned_at).toISOString().split('T')[0]
      acc[date] = (acc[date] || 0) + 1
      return acc
    }, {})

    const dailyScans = Object.entries(scansByDay || {})
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ 
      data: {
        qr_code: {
          id: qrCode.id,
          name: qrCode.name,
          target_url: qrCode.target_url,
          total_scans: qrCode.scan_count
        },
        period_days: days,
        scans_in_period: scans?.length || 0,
        devices: deviceBreakdown || {},
        top_locations: topLocations,
        daily_scans: dailyScans,
        recent_scans: scans?.slice(0, 20).map(s => ({
          device_type: s.device_type,
          location: s.city && s.country ? `${s.city}, ${s.country}` : null,
          scanned_at: s.scanned_at
        }))
      }
    })

  } catch (error) {
    console.error('QR analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
