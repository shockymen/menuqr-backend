import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateQRCode } from '@/lib/qr-generator'

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
    
    // Create authenticated client
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

    // 3. Get request body
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

    // 5. Create admin client inline (bypasses RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    )

    // Check if QR already exists
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

    // 6. Generate QR code image
    const qrBuffer = await generateQRCode({
      url: targetUrl,
      size: size,
      errorCorrectionLevel: 'M'
    })

    // 7. Upload to Supabase Storage
    const timestamp = Date.now()
    const fileName = `${businessId}/${timestamp}.${format}`
    const storagePath = `qr-codes/${fileName}`

    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from('qr-codes') // Make sure this bucket exists in Supabase
      .upload(storagePath, qrBuffer, {
        contentType: `image/${format}`,
        cacheControl: '31536000', // 1 year
        upsert: false
      })

    if (uploadError) {
      console.error('QR upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload QR code', details: uploadError.message },
        { status: 500 }
      )
    }

    // 8. Get public URL for the uploaded QR code
    const { data: publicUrlData } = supabaseAdmin
      .storage
      .from('qr-codes')
      .getPublicUrl(storagePath)

    const qrCodeUrl = publicUrlData.publicUrl

    // 9. Create QR code record
    const { data: qrCode, error: createError } = await supabaseAdmin
      .from('qr_codes')
      .insert({
        business_id: businessId,
        menu_id: menu_id || null,
        name: name || `QR Code - ${business.name}`,
        target_url: targetUrl,
        qr_code_url: qrCodeUrl, // Real Supabase Storage URL
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
      
      // Cleanup: Delete uploaded file if DB insert fails
      await supabaseAdmin.storage.from('qr-codes').remove([storagePath])
      
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