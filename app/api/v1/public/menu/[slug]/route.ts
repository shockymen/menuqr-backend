import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET - Public menu by slug (no auth required - for QR scans)
// Slug can be either menu slug OR business slug (backwards compatible)
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

    // Try to get menu by slug first
    const { data: menu, error: menuError } = await supabase
      .from('menus')
      .select('id, business_id, name, slug, description')
      .eq('slug', slug)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single()

    let business
    let menuId

    if (menu) {
      // Menu slug found - use this specific menu
      menuId = menu.id
      
      // Get business details
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('id, name, display_name, slug, description, logo_url, city, country, phone, address')
        .eq('id', menu.business_id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .single()

      if (businessError || !businessData) {
        return NextResponse.json(
          { error: 'Business not found' },
          { status: 404 }
        )
      }
      business = businessData
    } else {
      // Try business slug (backwards compatibility)
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('id, name, display_name, slug, description, logo_url, city, country, phone, address')
        .eq('slug', slug)
        .eq('is_active', true)
        .is('deleted_at', null)
        .single()

      if (businessError || !businessData) {
        return NextResponse.json(
          { error: 'Menu not found' },
          { status: 404 }
        )
      }
      business = businessData

      // Get first active menu for this business (backwards compatibility)
      const { data: firstMenu } = await supabase
        .from('menus')
        .select('id')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('display_order', { ascending: true })
        .limit(1)
        .single()

      menuId = firstMenu?.id
    }

    // Get template settings (menu-specific or business default)
    let template
    if (menuId) {
      // Try menu-specific template first
      const { data: menuTemplate } = await supabase
        .from('business_templates')
        .select('*')
        .eq('business_id', business.id)
        .eq('menu_id', menuId)
        .single()

      if (menuTemplate) {
        template = menuTemplate
      }
    }

    // Fallback to business default template
    if (!template) {
      const { data: businessTemplate } = await supabase
        .from('business_templates')
        .select('*')
        .eq('business_id', business.id)
        .is('menu_id', null)
        .single()

      template = businessTemplate
    }

    // Get categories for this business
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

    // Get menu items for this specific menu (or all menus if no specific menu)
    let items = []
    if (menuId) {
      const { data: itemsData, error: itemsError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('menu_id', menuId)
        .eq('is_available', true)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })

      if (itemsError) {
        console.error('Items fetch error:', itemsError)
      } else {
        items = itemsData || []
      }
    }

    // Get all menus for navigation (optional)
    const { data: allMenus } = await supabase
      .from('menus')
      .select('id, name, slug, description')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })

    // Return complete menu data with template
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
        template: template || { 
          template_name: 'modern-minimal',
          primary_color: '#ffc107',
          secondary_color: '#212529',
          accent_color: '#28a745'
        },
        menus: allMenus || [],
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