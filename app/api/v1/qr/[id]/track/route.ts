import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST - Track QR code scan (public endpoint)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const supabase = createServerClient()

    const body = await request.json()
    const { device_type, user_agent, location } = body

    // Get QR code details
    const { data: qrCode, error: qrError } = await supabase
      .from('qr_codes')
      .select('business_id, menu_id')
      .eq('id', params.id)
      .single()

    if (qrError || !qrCode) {
      return NextResponse.json({ error: 'QR code not found' }, { status: 404 })
    }

    // Track the scan event
    const { data: event, error: eventError } = await supabase
      .from('analytics_events')
      .insert({
        business_id: qrCode.business_id,
        qr_code_id: params.id,
        event_type: 'qr_scan',
        device_type: device_type || 'unknown',
        user_agent: user_agent || null,
        location: location || null,
        metadata: {
          menu_id: qrCode.menu_id,
          scanned_at: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (eventError) {
      console.error('Track event error:', eventError)
      return NextResponse.json(
        { error: 'Failed to track event' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      data: event,
      message: 'Scan tracked successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Track scan error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
