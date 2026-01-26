import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase'

// POST - Generate QR code for business
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const businessId = params.id
    
    // 1. Authentication with user client
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Create authenticated client for verification
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
      .select('id, user_id, name, slug')
      .eq('id', businessId)
      .single()

    if (bizError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (business.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. Get request body (optional customization)
    const body = await request.json().catch(() => ({}))
    const { 
      name,
      menu_id,
      format = 'png',
      size = 512,
      display_text,
      location
    } = body

    // 4. Generate target URL
    const slug = business.slug || businessId.slice(0, 8)
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://menuqr-backend.vercel.app'
    let targetUrl = `${frontendUrl}/m/${slug}`
    
    if (menu_id) {
      targetUrl = `${targetUrl}/${menu_id}`
    }

    // 5. Use admin client for QR operations (bypasses RLS)
    const supabaseAdmin = getSupabaseAdmin()

    // Check if QR already exists for this target
    const { data: existingQR } = await supabaseAdmin
      .from('qr_codes')
      .select('id')
      .eq('business_id', businessId)
      .eq('target_url', targetUrl)
      .is('deleted_at', null)
      .single()

    if (existingQR) {
      return NextResponse.json(
        { error: 'QR code already exists for this URL' },
        { status: 409 }
      )
    }

    // 6. Create QR code record using admin client
    const { data: qrCode, error: createError } = await supabaseAdmin
      .from('qr_codes')
      .insert({
        business_id: businessId,
        menu_id: menu_id || null,
        name: name || `QR Code - ${business.name}`,
        target_url: targetUrl,
        qr_code_url: `https://storage.menuqr.africa/qr/${businessId}/${Date.now()}.${format}`,
        format: format,
        size: size,
        display_text: display_text || 'Scan to view menu',
        location: location || null,
        error_correction_level: 'M',
        is_active: true
      })
      .select()
      .single()

    if (createError) {
      console.error('Create QR error:', createError)
      return NextResponse.json(
        { error: 'Failed to create QR code', details: createError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      data: qrCode,
      message: 'QR code generated successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('QR generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}