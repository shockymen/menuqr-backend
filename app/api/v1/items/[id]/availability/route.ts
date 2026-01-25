// app/api/v1/items/[id]/availability/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { 
  ApiResponse, 
  MenuItemWithMenuAndBusiness,
  AvailabilityUpdateRequest,
  AvailabilityUpdateResponse
} from '@/types/api'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function PATCH(
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

    const body = await request.json() as AvailabilityUpdateRequest

    if (typeof body.is_available !== 'boolean') {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'is_available must be a boolean'
        }
      }, { status: 400 })
    }

    const { data: item, error: itemError } = await supabase
      .from('menu_items')
      .select(`
        id, 
        name,
        is_available,
        menu_id, 
        menus!inner(
          business_id, 
          businesses!inner(user_id)
        )
      `)
      .eq('id', params.id)
      .is('deleted_at', null)
      .single()

    if (itemError || !item) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'NOT_FOUND',
          message: 'Menu item not found'
        }
      }, { status: 404 })
    }

    const typedItem = item as unknown as MenuItemWithMenuAndBusiness
    
    if (typedItem.menus.businesses.user_id !== user.id) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to update this item'
        }
      }, { status: 403 })
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from('menu_items')
      .update({ 
        is_available: body.is_available,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select('id, name, is_available, updated_at')
      .single()

    if (updateError) {
      console.error('Availability update error:', updateError)
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update item availability',
          details: updateError.message
        }
      }, { status: 500 })
    }

    const statusMessage = body.is_available 
      ? 'Item is now available to customers'
      : 'Item marked as sold out'

    const response: AvailabilityUpdateResponse = {
      ...(updatedItem as unknown as AvailabilityUpdateResponse),
      message: statusMessage
    }

    return NextResponse.json<ApiResponse<AvailabilityUpdateResponse>>({
      data: response
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Availability toggle error:', errorMessage)
    
    return NextResponse.json<ApiResponse>({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}