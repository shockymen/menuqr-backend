// app/api/v1/public/businesses/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ApiResponse } from '@/types/api'

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
    const params = await context.params
    const supabase = createServerClient()

    const { data: business, error } = await supabase
      .from('businesses')
      .select('id, name, slug, description, logo_url, cover_image_url, primary_color, phone, address, city, country, website, business_hours, social_media')
      .eq('id', params.id)
      .eq('is_active', true)
      .single()

    if (error || !business) {
      return NextResponse.json<ApiResponse>({
        error: { code: 'NOT_FOUND', message: 'Business not found' }
      }, { status: 404 })
    }

    return NextResponse.json<ApiResponse>({ data: business }, { status: 200 })

  } catch (error) {
    console.error('Get business error:', error)
    return NextResponse.json<ApiResponse>({
      error: { code: 'INTERNAL_ERROR', message: 'Internal error' }
    }, { status: 500 })
  }
}