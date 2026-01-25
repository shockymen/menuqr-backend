import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET - Get single menu by ID
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const supabase = createServerClient()

    const { data: menu, error } = await supabase
      .from('menus')
      .select('*')
      .eq('id', params.id)
      .eq('is_active', true)
      .single()

    if (error || !menu) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    return NextResponse.json({ data: menu })
  } catch (error) {
    console.error('Get menu error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Update menu
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    
    // Authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, is_active } = body

    // Get menu to verify ownership
    const { data: menu, error: menuError } = await supabase
      .from('menus')
      .select('business_id, businesses!inner(user_id)')
      .eq('id', params.id)
      .single()

    if (menuError || !menu) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    // Verify ownership - FIX: businesses is an array
    const menuData = menu as { businesses: Array<{ user_id: string }> }
    if (menuData.businesses[0].user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Build update object
    const updates: Record<string, string | boolean | undefined> = {
      updated_at: new Date().toISOString()
    }

    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (is_active !== undefined) updates.is_active = is_active

    // Update menu
    const { data: updatedMenu, error: updateError } = await supabase
      .from('menus')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      console.error('Update menu error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update menu' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: updatedMenu })

  } catch (error) {
    console.error('Update menu error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete menu
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    
    // Authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get menu to verify ownership
    const { data: menu, error: menuError } = await supabase
      .from('menus')
      .select('business_id, businesses!inner(user_id)')
      .eq('id', params.id)
      .single()

    if (menuError || !menu) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    // Verify ownership - FIX: businesses is an array
    const menuData = menu as { businesses: Array<{ user_id: string }> }
    if (menuData.businesses[0].user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Soft delete (set is_active to false and deleted_at)
    const { error: deleteError } = await supabase
      .from('menus')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)

    if (deleteError) {
      console.error('Delete menu error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete menu' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      message: 'Menu deleted successfully' 
    }, { status: 200 })

  } catch (error) {
    console.error('Delete menu error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
