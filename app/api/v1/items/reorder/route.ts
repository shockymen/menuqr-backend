// app/api/v1/items/reorder/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { 
  ApiResponse,
  MenuItem,
  ItemReorderRequest,
  MenuItemWithMenuAndBusiness
} from '@/types/api'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// PATCH /api/v1/items/reorder
// Reorder menu items (change sort_order)
export async function PATCH(request: NextRequest) {
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

    const body = await request.json() as ItemReorderRequest

    // Validate
    if (!body.items || !Array.isArray(body.items)) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'items array is required'
        }
      }, { status: 400 })
    }

    if (body.items.length === 0) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'items array cannot be empty'
        }
      }, { status: 400 })
    }

    // Validate each item has id and sort_order
    for (const item of body.items) {
      if (!item.id || typeof item.sort_order !== 'number') {
        return NextResponse.json<ApiResponse>({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Each item must have id (string) and sort_order (number)'
          }
        }, { status: 400 })
      }

      if (item.sort_order < 0) {
        return NextResponse.json<ApiResponse>({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'sort_order must be non-negative'
          }
        }, { status: 400 })
      }
    }

    const itemIds = body.items.map(item => item.id)

    // Get all items and verify ownership
    const { data: existingItems, error: fetchError } = await supabase
      .from('menu_items')
      .select(`
        id,
        name,
        sort_order,
        menu_id,
        menus!inner(
          business_id, 
          businesses!inner(user_id)
        )
      `)
      .in('id', itemIds)
      .is('deleted_at', null)

    if (fetchError) {
      console.error('Fetch items error:', fetchError)
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'QUERY_FAILED',
          message: 'Failed to fetch menu items'
        }
      }, { status: 500 })
    }

    if (!existingItems || existingItems.length === 0) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'NOT_FOUND',
          message: 'No menu items found'
        }
      }, { status: 404 })
    }

    if (existingItems.length !== itemIds.length) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'NOT_FOUND',
          message: 'Some items were not found'
        }
      }, { status: 404 })
    }

    // Verify all items belong to user
    for (const item of existingItems) {
      const typedItem = item as unknown as MenuItemWithMenuAndBusiness
      
      if (typedItem.menus.businesses.user_id !== user.id) {
        return NextResponse.json<ApiResponse>({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to reorder these items'
          }
        }, { status: 403 })
      }
    }

    // Update sort_order for each item
    const updatedItems: MenuItem[] = []
    const errors: Array<{ id: string; message: string }> = []

    for (const item of body.items) {
      const { data: updatedItem, error: updateError } = await supabase
        .from('menu_items')
        .update({ 
          sort_order: item.sort_order,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id)
        .select()
        .single()

      if (updateError) {
        errors.push({
          id: item.id,
          message: updateError.message
        })
      } else if (updatedItem) {
        updatedItems.push(updatedItem as MenuItem)
      }
    }

    return NextResponse.json<ApiResponse>({
      data: {
        updated: updatedItems.length,
        items: updatedItems,
        errors: errors.length > 0 ? errors : undefined,
        message: 'Items reordered successfully'
      }
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Reorder items error:', errorMessage)
    
    return NextResponse.json<ApiResponse>({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}