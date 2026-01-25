// app/api/v1/items/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ApiResponse, MenuItem } from '@/types/api'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/v1/items
// List all menu items across all menus for authenticated user's businesses
export async function GET(request: NextRequest) {
  try {
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('business_id')
    const menuId = searchParams.get('menu_id')
    const categoryId = searchParams.get('category_id')
    const isAvailable = searchParams.get('is_available')
    const isFeatured = searchParams.get('is_featured')
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Build query
    let query = supabase
      .from('menu_items')
      .select(`
        *,
        menus!inner(
          id,
          name,
          business_id,
          businesses!inner(user_id)
        )
      `)
      .is('deleted_at', null)

    // Filter by user's businesses only
    query = query.eq('menus.businesses.user_id', user.id)

    // Apply optional filters
    if (businessId) {
      query = query.eq('menus.business_id', businessId)
    }

    if (menuId) {
      query = query.eq('menu_id', menuId)
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    if (isAvailable !== null) {
      query = query.eq('is_available', isAvailable === 'true')
    }

    if (isFeatured !== null) {
      query = query.eq('is_featured', isFeatured === 'true')
    }

    // Apply pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: items, error } = await query

    if (error) {
      console.error('Query items error:', error)
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'QUERY_FAILED',
          message: 'Failed to fetch menu items',
          details: error.message
        }
      }, { status: 500 })
    }

    // Get total count
    let countQuery = supabase
      .from('menu_items')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)

    // Apply same filters to count
    if (businessId || menuId) {
      countQuery = countQuery.in('menu_id', 
        items?.map(item => (item as MenuItem).menu_id) || []
      )
    }

    const { count } = await countQuery

    return NextResponse.json<ApiResponse>({
      data: {
        items: items || [],
        pagination: {
          total: count || 0,
          limit,
          offset,
          has_more: (count || 0) > offset + limit
        }
      }
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('List items error:', errorMessage)
    
    return NextResponse.json<ApiResponse>({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}