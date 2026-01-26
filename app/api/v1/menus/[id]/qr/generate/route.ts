// app/api/v1/menus/[id]/qr/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'
import type { ApiResponse, QRCode as QRCodeType } from '@/types/api'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST /api/v1/menus/:id/qr/generate
// Generate QR code for a specific menu
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createServerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token'
        }
      }, { status: 401 })
    }

    // Get menu and verify ownership
    const { data: menu, error: menuError } = await supabase
      .from('menus')
      .select('id, name, slug, business_id')
      .eq('id', params.id)
      .single()

    if (menuError || !menu) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'NOT_FOUND',
          message: 'Menu not found'
        }
      }, { status: 404 })
    }

    // Verify business ownership
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('id, slug, user_id')
      .eq('id', menu.business_id)
      .single()

    if (bizError || !business || business.user_id !== user.id) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to generate QR for this menu'
        }
      }, { status: 403 })
    }

    // Parse optional request body
    const body = await request.json().catch(() => ({})) as {
      name?: string
      size?: number
    }

    const qrName = body.name || `${menu.name} QR Code`
    const qrSize = body.size || 512

    // Validate size
    if (qrSize < 128 || qrSize > 2048) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'QR code size must be between 128 and 2048 pixels'
        }
      }, { status: 400 })
    }

    // Generate menu URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://menuqr.africa'
    const menuUrl = `${baseUrl}/m/${menu.slug}`

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(menuUrl, {
      width: qrSize,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })

    // Convert data URL to buffer
    const base64Data = qrDataUrl.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    // Upload to Supabase Storage
    const filename = `${business.slug}-${menu.slug}-${Date.now()}.png`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('qr-codes')
      .upload(filename, buffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('QR upload error:', uploadError)
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Failed to upload QR code',
          details: uploadError.message
        }
      }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('qr-codes')
      .getPublicUrl(filename)

    // Save QR code record to database
    const { data: qrCode, error: insertError } = await supabase
      .from('qr_codes')
      .insert({
        menu_id: params.id,
        name: qrName,
        url: menuUrl,
        image_url: urlData.publicUrl,
        format: 'png',
        size: qrSize
      })
      .select()
      .single()

    if (insertError) {
      console.error('QR code insert error:', insertError)
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to save QR code record',
          details: insertError.message
        }
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse<QRCodeType>>({
      data: qrCode as QRCodeType
    }, { status: 201 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Generate menu QR error:', errorMessage)
    
    return NextResponse.json<ApiResponse>({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}