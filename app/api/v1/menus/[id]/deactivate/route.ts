// app/api/v1/menus/[id]/deactivate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ApiResponse, Menu } from '@/types/api'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// PATCH /api/v1/menus/:id/deactivate
// Deactivate a menu (hide from customers)
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

    // Get menu and verify ownership
    const { data: menu, error: menuError } = await supabase
      .from('menus')
      .select('id, name, is_active, business_id')
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
      .select('user_id')
      .eq('id', menu.business_id)
      .single()

    if (bizError || !business || business.user_id !== user.id) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to deactivate this menu'
        }
      }, { status: 403 })
    }

    // Check if already inactive
    if (!menu.is_active) {
      return NextResponse.json<ApiResponse>({
        data: {
          menu: menu as Menu,
          message: 'Menu is already inactive'
        }
      }, { status: 200 })
    }

    // Deactivate menu
    const { data: updatedMenu, error: updateError } = await supabase
      .from('menus')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      console.error('Menu deactivation error:', updateError)
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to deactivate menu',
          details: updateError.message
        }
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse>({
      data: {
        menu: updatedMenu as Menu,
        message: 'Menu deactivated successfully'
      }
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Deactivate menu error:', errorMessage)
    
    return NextResponse.json<ApiResponse>({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}