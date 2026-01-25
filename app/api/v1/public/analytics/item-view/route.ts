// app/api/v1/public/analytics/item-view/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ApiResponse, ItemViewCreate, ItemView } from '@/types/api'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST /api/v1/public/analytics/item-view
// Track item view event (public endpoint - no auth required)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ItemViewCreate

    // Validate required fields
    if (!body.business_id || !body.item_id) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'business_id and item_id are required'
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

    // Verify menu item exists and belongs to business
    // Use a simpler query that directly checks the relationship
    const { data: item, error: itemError } = await supabase
      .from('menu_items')
      .select('id, menu_id, menus!inner(business_id)')
      .eq('id', body.item_id)
      .eq('menus.business_id', body.business_id)
      .is('deleted_at', null)
      .single()

    if (itemError || !item) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'NOT_FOUND',
          message: 'Menu item not found or does not belong to this business'
        }
      }, { status: 404 })
    }

    // Get user agent and IP from request headers
    const userAgent = request.headers.get('user-agent')
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ipAddress = forwardedFor?.split(',')[0] || realIp || 'unknown'

    // Create item view record
    const { data: itemView, error: insertError } = await supabase
      .from('item_views')
      .insert({
        business_id: body.business_id,
        item_id: body.item_id,
        viewed_at: new Date().toISOString(),
        user_agent: userAgent || null,
        ip_address: ipAddress
      })
      .select()
      .single()

    if (insertError) {
      console.error('Item view insert error:', insertError)
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to track item view',
          details: insertError.message
        }
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse<ItemView>>({
      data: itemView as ItemView
    }, { status: 201 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Track item view error:', errorMessage)
    
    return NextResponse.json<ApiResponse>({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}