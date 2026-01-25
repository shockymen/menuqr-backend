import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST - Create menu item
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const menuId = params.id
    
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

    // 2. Get request body
    const body = await request.json()
    const { 
      name, 
      description, 
      price,
      category_id,
      subcategory,
      image_url,
      is_available,
      is_featured,
      prep_time_minutes,
      portion_size,
      spice_level,
      allergens,
      dietary_flags,
      tags
    } = body

    // 3. Validate required fields
    if (!name || price === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: name, price' },
        { status: 400 }
      )
    }

    if (price < 0) {
      return NextResponse.json(
        { error: 'Price cannot be negative' },
        { status: 400 }
      )
    }

    // 4. Verify menu exists and user owns it
    const { data: menu, error: menuError } = await supabase
      .from('menus')
      .select('id, business_id')
      .eq('id', menuId)
      .single()

    if (menuError || !menu) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    // Verify ownership via business
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('user_id')
      .eq('id', menu.business_id)
      .single()

    if (bizError || !business || business.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 5. Get current max sort_order
    const { data: maxItem } = await supabase
      .from('menu_items')
      .select('sort_order')
      .eq('menu_id', menuId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const nextSortOrder = maxItem ? maxItem.sort_order + 1 : 0

    // 6. Create menu item
    const { data: item, error: createError } = await supabase
      .from('menu_items')
      .insert({
        menu_id: menuId,
        name,
        description: description || null,
        price,
        category_id: category_id || null,
        subcategory: subcategory || null,
        image_url: image_url || null,
        is_available: is_available !== undefined ? is_available : true,
        is_featured: is_featured || false,
        prep_time_minutes: prep_time_minutes || null,
        portion_size: portion_size || null,
        spice_level: spice_level || null,
        allergens: allergens || null,
        dietary_flags: dietary_flags || null,
        tags: tags || null,
        sort_order: nextSortOrder
      })
      .select()
      .single()

    if (createError) {
      console.error('Create item error:', createError)
      return NextResponse.json(
        { error: 'Failed to create menu item', details: createError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: item }, { status: 201 })

  } catch (error) {
    console.error('Menu item creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - List menu items
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const menuId = params.id
    const supabase = createServerClient()

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('category_id')
    const available = searchParams.get('available')
    const featured = searchParams.get('featured')

    // Build query
    let query = supabase
      .from('menu_items')
      .select('*')
      .eq('menu_id', menuId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })

    // Apply filters
    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    if (available === 'true') {
      query = query.eq('is_available', true)
    } else if (available === 'false') {
      query = query.eq('is_available', false)
    }

    if (featured === 'true') {
      query = query.eq('is_featured', true)
    }

    const { data: items, error } = await query

    if (error) {
      console.error('List items error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch menu items' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: items })

  } catch (error) {
    console.error('Menu items list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
