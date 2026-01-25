import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'
import { jsPDF } from 'jspdf'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // IMPORTANT: Await params in Next.js 15+
    const params = await context.params
    
    console.log('=== QR Download Request ===')
    console.log('QR ID:', params.id)
    
    // 1. Authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('No auth header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.log('Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('Authenticated user:', user.id)

    // 2. Get QR code
    console.log('Fetching QR code...')
    const { data: qrCode, error: qrError } = await supabase
      .from('qr_codes')
      .select('id, target_url, business_id')
      .eq('id', params.id)
      .single()

    console.log('QR query result:', { qrCode, qrError })

    if (qrError || !qrCode) {
      console.log('QR code not found!')
      return NextResponse.json({ error: 'QR code not found' }, { status: 404 })
    }

    console.log('QR code found:', qrCode.id)

    // 3. Get business and verify ownership
    console.log('Fetching business...')
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, user_id, name, slug')
      .eq('id', qrCode.business_id)
      .single()

    console.log('Business query result:', { business, businessError })

    if (businessError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (business.user_id !== user.id) {
      console.log('Ownership mismatch:', { businessUserId: business.user_id, userId: user.id })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    console.log('Ownership verified')

    // 4. Parse parameters
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'png'
    const size = parseInt(searchParams.get('size') || '512')

    if (!['png', 'pdf', 'svg'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format: use png, pdf, or svg' }, { status: 400 })
    }

    if (![128, 256, 512, 1024, 2048].includes(size)) {
      return NextResponse.json({ error: 'Invalid size: use 128, 256, 512, 1024, or 2048' }, { status: 400 })
    }

    console.log('Generating QR code:', { format, size })

    // 5. Generate QR code
    let fileBuffer: Buffer
    let contentType: string
    let filename: string
    const slug = business.slug || business.id.slice(0, 8)

    if (format === 'png') {
      fileBuffer = await QRCode.toBuffer(qrCode.target_url, {
        width: size,
        margin: 2,
        errorCorrectionLevel: 'M'
      })
      contentType = 'image/png'
      filename = `menuqr-${slug}-${size}px.png`

    } else if (format === 'svg') {
      const svgString = await QRCode.toString(qrCode.target_url, {
        type: 'svg',
        width: size,
        margin: 2,
        errorCorrectionLevel: 'M'
      })
      fileBuffer = Buffer.from(svgString)
      contentType = 'image/svg+xml'
      filename = `menuqr-${slug}.svg`

    } else {
      // PDF format
      const pngBuffer = await QRCode.toBuffer(qrCode.target_url, {
        width: 512,
        margin: 2,
        errorCorrectionLevel: 'M'
      })
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })
      
      const pngBase64 = pngBuffer.toString('base64')
      
      // Business name
      pdf.setFontSize(18)
      pdf.text(business.name, 105, 30, { align: 'center' })
      
      // QR code (centered)
      pdf.addImage(`data:image/png;base64,${pngBase64}`, 'PNG', 55, 50, 100, 100)
      
      // Instructions
      pdf.setFontSize(14)
      pdf.text('Scan to view our menu', 105, 165, { align: 'center' })
      
      fileBuffer = Buffer.from(pdf.output('arraybuffer'))
      contentType = 'application/pdf'
      filename = `menuqr-${slug}.pdf`
    }

    console.log('QR code generated successfully, size:', fileBuffer.length)

    // 6. Track analytics (optional, fire and forget)
    void supabase.from('analytics').insert({
      business_id: business.id,
      event_type: 'qr_download',
      event_data: { qr_code_id: qrCode.id, format, size }
    })

    // 7. Return file
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600'
      }
    })

  } catch (error) {
    console.error('QR download error:', error)
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    )
  }
}
