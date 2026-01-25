import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET - Get single menu item
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const supabase = createServerClient()

    const { data: item, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('id', params.id)
      .is('deleted_at', null)
      .single()

    if (error || !item) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
    }

    return NextResponse.json({ data: item })

  } catch (error) {
    console.error('Get menu item error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Update menu item
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    
    // 1. Authentication
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

    // 2. Get existing item
    const { data: item, error: itemError } = await supabase
      .from('menu_items')
      .select('id, menu_id, menus!inner(business_id)')
      .eq('id', params.id)
      .is('deleted_at', null)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
    }

    // 3. Verify ownership
    const menu = item.menus as any
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('user_id')
      .eq('id', menu.business_id)
      .single()

    if (bizError || !business || business.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 4. Get update data
    const body = await request.json()
    const updates: any = {}

    // Allow updating these fields
    const allowedFields = [
      'name', 'description', 'price', 'category_id', 'subcategory',
      'image_url', 'is_available', 'is_featured', 'prep_time_minutes',
      'portion_size', 'spice_level', 'allergens', 'dietary_flags', 'tags',
      'sort_order', 'ingredients', 'preparation_notes'
    ]

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    })

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Validate price if provided
    if (updates.price !== undefined && updates.price < 0) {
      return NextResponse.json({ error: 'Price cannot be negative' }, { status: 400 })
    }

    // 5. Update item
    updates.updated_at = new Date().toISOString()

    const { data: updatedItem, error: updateError } = await supabase
      .from('menu_items')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update menu item' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: updatedItem })

  } catch (error) {
    console.error('Update menu item error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete menu item (soft delete)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    
    // 1. Authentication
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

    // 2. Get existing item
    const { data: item, error: itemError } = await supabase
      .from('menu_items')
      .select('id, menu_id, menus!inner(business_id)')
      .eq('id', params.id)
      .is('deleted_at', null)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
    }

    // 3. Verify ownership
    const menu = item.menus as any
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('user_id')
      .eq('id', menu.business_id)
      .single()

    if (bizError || !business || business.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 4. Soft delete
    const { error: deleteError } = await supabase
      .from('menu_items')
      .update({ 
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete menu item' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      message: 'Menu item deleted successfully' 
    })

  } catch (error) {
    console.error('Delete menu item error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
