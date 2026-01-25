// app/api/v1/upload/images/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ApiResponse } from '@/types/api'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json<ApiResponse>({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json<ApiResponse>({
        error: { code: 'UNAUTHORIZED', message: 'Invalid token' }
      }, { status: 401 })
    }

    const body = await request.json() as {
      images: Array<{ filename: string; data: string; contentType?: string }>
      folder?: string
    }

    if (!body.images || !Array.isArray(body.images) || body.images.length === 0) {
      return NextResponse.json<ApiResponse>({
        error: { code: 'VALIDATION_ERROR', message: 'images array required' }
      }, { status: 400 })
    }

    if (body.images.length > 10) {
      return NextResponse.json<ApiResponse>({
        error: { code: 'VALIDATION_ERROR', message: 'Max 10 images at once' }
      }, { status: 400 })
    }

    const folder = body.folder || 'uploads'
    const uploaded: Array<{ filename: string; url: string; size: number }> = []
    const errors: Array<{ filename: string; message: string }> = []

    for (const image of body.images) {
      try {
        const base64Data = image.data.replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')
        const uniqueFilename = `${folder}/${user.id}/${Date.now()}-${image.filename}`

        const { data, error } = await supabase.storage
          .from('menu-images')
          .upload(uniqueFilename, buffer, {
            contentType: image.contentType || 'image/jpeg',
            cacheControl: '3600'
          })

        if (error) {
          errors.push({ filename: image.filename, message: error.message })
          continue
        }

        const { data: urlData } = supabase.storage
          .from('menu-images')
          .getPublicUrl(uniqueFilename)

        uploaded.push({
          filename: image.filename,
          url: urlData.publicUrl,
          size: buffer.length
        })
      } catch (err) {
        errors.push({
          filename: image.filename,
          message: err instanceof Error ? err.message : 'Upload failed'
        })
      }
    }

    return NextResponse.json<ApiResponse>({
      data: { uploaded: uploaded.length, images: uploaded, errors: errors.length > 0 ? errors : undefined }
    }, { status: 201 })

  } catch (error) {
    console.error('Bulk upload error:', error)
    return NextResponse.json<ApiResponse>({
      error: { code: 'INTERNAL_ERROR', message: 'Internal error' }
    }, { status: 500 })
  }
}