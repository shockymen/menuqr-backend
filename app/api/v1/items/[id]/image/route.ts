// app/api/v1/items/[id]/image/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { 
  ApiResponse, 
  MenuItemWithMenuAndBusiness,
  ImageUpdateRequest,
  ImageUpdateResponse
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

    const body = await request.json() as ImageUpdateRequest

    if (!body.image_url || typeof body.image_url !== 'string') {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'image_url is required and must be a string'
        }
      }, { status: 400 })
    }

    try {
      new URL(body.image_url)
    } catch {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'image_url must be a valid URL'
        }
      }, { status: 400 })
    }

    const { data: item, error: itemError } = await supabase
      .from('menu_items')
      .select(`
        id, 
        name,
        image_url,
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
        image_url: body.image_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select('id, name, image_url, updated_at')
      .single()

    if (updateError) {
      console.error('Image update error:', updateError)
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update item image',
          details: updateError.message
        }
      }, { status: 500 })
    }

    const response: ImageUpdateResponse = {
      ...(updatedItem as unknown as ImageUpdateResponse),
      message: 'Item image updated successfully'
    }

    return NextResponse.json<ApiResponse<ImageUpdateResponse>>({
      data: response
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Image update error:', errorMessage)
    
    return NextResponse.json<ApiResponse>({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}