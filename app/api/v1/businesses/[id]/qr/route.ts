import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET - List all QR codes for a business
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const businessId = params.id
    
    // 1. Authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Create authenticated client (inside function, not module level)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false }
      }
    )
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Verify business ownership
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

    // 3. Get QR codes
    const { data: qrCodes, error } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('List QR codes error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch QR codes' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: qrCodes })

  } catch (error) {
    console.error('List QR codes error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}