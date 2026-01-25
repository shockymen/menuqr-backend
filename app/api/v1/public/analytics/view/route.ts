// app/api/v1/public/analytics/view/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ApiResponse, MenuViewCreate, MenuView } from '@/types/api'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Helper function to extract device type from user agent
function getDeviceType(userAgent: string | null): string {
  if (!userAgent) return 'unknown'
  
  const ua = userAgent.toLowerCase()
  
  if (ua.includes('mobile') || ua.includes('android')) return 'mobile'
  if (ua.includes('tablet') || ua.includes('ipad')) return 'tablet'
  if (ua.includes('bot') || ua.includes('crawler')) return 'bot'
  
  return 'desktop'
}

// POST /api/v1/public/analytics/view
// Track menu view event (public endpoint - no auth required)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as MenuViewCreate

    // Validate required fields
    if (!body.business_id || !body.menu_id) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'business_id and menu_id are required'
        }
      }, { status: 400 })
    }

    const supabase = createServerClient()

    // Verify business exists
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', body.business_id)
      .single()

    if (businessError || !business) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'NOT_FOUND',
          message: 'Business not found'
        }
      }, { status: 404 })
    }

    // Verify menu exists and belongs to business
    const { data: menu, error: menuError } = await supabase
      .from('menus')
      .select('id, business_id')
      .eq('id', body.menu_id)
      .eq('business_id', body.business_id)
      .single()

    if (menuError || !menu) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'NOT_FOUND',
          message: 'Menu not found or does not belong to this business'
        }
      }, { status: 404 })
    }

    // Get user agent and IP from request headers
    const userAgent = request.headers.get('user-agent')
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ipAddress = forwardedFor?.split(',')[0] || realIp || 'unknown'

    // Determine device type
    const deviceType = getDeviceType(userAgent)

    // Create menu view record
    const { data: menuView, error: insertError } = await supabase
      .from('menu_views')
      .insert({
        business_id: body.business_id,
        menu_id: body.menu_id,
        viewed_at: new Date().toISOString(),
        user_agent: userAgent || null,
        ip_address: ipAddress,
        country: body.country || null,
        device_type: deviceType
      })
      .select()
      .single()

    if (insertError) {
      console.error('Menu view insert error:', insertError)
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to track menu view',
          details: insertError.message
        }
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse<MenuView>>({
      data: menuView as MenuView
    }, { status: 201 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Track menu view error:', errorMessage)
    
    return NextResponse.json<ApiResponse>({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}