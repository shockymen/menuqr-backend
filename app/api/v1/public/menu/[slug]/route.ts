import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET - Public menu by slug (no auth required - for QR scans)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const params = await context.params
    const slug = params.slug
    
    // Create public Supabase client (no auth)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // 1. Get business by slug
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, display_name, slug, description, logo_url, city, country, phone, address')
      .eq('slug', slug)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single()

    if (businessError || !business) {
      return NextResponse.json(
        { error: 'Menu not found' },
        { status: 404 }
      )
    }

    // 2. Get active menus for business
    const { data: menus, error: menusError } = await supabase
      .from('menus')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })

    if (menusError) {
      console.error('Menus fetch error:', menusError)
      return NextResponse.json(
        { error: 'Failed to fetch menus' },
        { status: 500 }
      )
    }

    // 3. Get categories
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })

    if (categoriesError) {
      console.error('Categories fetch error:', categoriesError)
    }

    // 4. Get menu items (only available ones)
    const menuIds = menus?.map(m => m.id) || []
    
    let items = []
    if (menuIds.length > 0) {
      const { data: itemsData, error: itemsError } = await supabase
        .from('menu_items')
        .select('*')
        .in('menu_id', menuIds)
        .eq('is_available', true)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })

      if (itemsError) {
        console.error('Items fetch error:', itemsError)
      } else {
        items = itemsData || []
      }
    }

    // 5. Return complete menu data
    return NextResponse.json({
      data: {
        business: {
          id: business.id,
          name: business.name,
          display_name: business.display_name,
          slug: business.slug,
          description: business.description,
          logo_url: business.logo_url,
          city: business.city,
          country: business.country,
          phone: business.phone,
          address: business.address
        },
        menus: menus || [],
        categories: categories || [],
        items: items
      }
    })

  } catch (error) {
    console.error('Public menu error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}