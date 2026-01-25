import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET - QR scan analytics
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

    // Get time range
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get scans with QR code details
    const { data: scans } = await supabase
      .from('qr_scans')
      .select('*, qr_codes(name, target_url)')
      .eq('business_id', businessId)
      .gte('scanned_at', startDate.toISOString())
      .order('scanned_at', { ascending: false })
      .limit(100)

    // Group by QR code
    const scansByQR = scans?.reduce((acc: any, scan: any) => {
      const qrId = scan.qr_code_id
      if (!acc[qrId]) {
        acc[qrId] = {
          qr_code_id: qrId,
          qr_code_name: scan.qr_codes?.name || 'Unnamed QR',
          target_url: scan.qr_codes?.target_url,
          scan_count: 0,
          devices: {},
          locations: {}
        }
      }
      acc[qrId].scan_count++
      acc[qrId].devices[scan.device_type || 'unknown'] = 
        (acc[qrId].devices[scan.device_type || 'unknown'] || 0) + 1
      
      if (scan.city && scan.country) {
        const location = `${scan.city}, ${scan.country}`
        acc[qrId].locations[location] = (acc[qrId].locations[location] || 0) + 1
      }
      
      return acc
    }, {})

    const scanAnalytics = Object.values(scansByQR || {})
      .sort((a: any, b: any) => b.scan_count - a.scan_count)

    return NextResponse.json({ 
      data: {
        period_days: days,
        total_scans: scans?.length || 0,
        qr_codes: scanAnalytics,
        recent_scans: scans?.slice(0, 20).map((s: any) => ({
          qr_code_name: s.qr_codes?.name || 'Unnamed QR',
          device_type: s.device_type,
          location: s.city && s.country ? `${s.city}, ${s.country}` : null,
          scanned_at: s.scanned_at
        }))
      }
    })

  } catch (error) {
    console.error('QR scan analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
