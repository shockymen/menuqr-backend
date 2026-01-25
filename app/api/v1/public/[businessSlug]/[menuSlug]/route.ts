import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-helpers'

// GET /api/v1/public/{businessSlug}/{menuSlug}
// Example: /api/v1/public/accra-bites/dinner-menu
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessSlug: string; menuSlug: string }> }
) {
  try {
    const { businessSlug, menuSlug } = await params
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // STEP 1: Find business by slug
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, slug, address, city, country, phone, email, website, logo_url, primary_color, business_hours, currency, timezone')
      .eq('slug', businessSlug)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single()

    if (businessError || !business) {
      return notFoundResponse('Business')
    }

    // STEP 2: Find menu for this specific business
    const { data: menu, error: menuError } = await supabase
      .from('menus')
      .select('*')
      .eq('slug', menuSlug)
      .eq('business_id', business.id)  // Scoped to this business!
      .eq('is_active', true)
      .is('deleted_at', null)
      .single()

    if (menuError || !menu) {
      return notFoundResponse('Menu')
    }

    // STEP 3: Get categories for this business
    const { data: categories } = await supabase
      .from('categories')
      .select('*')
      .eq('business_id', business.id)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })

    // STEP 4: Get items for this menu
    const { data: items } = await supabase
      .from('menu_items')
      .select('*')
      .eq('menu_id', menu.id)
      .eq('is_available', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })

    // Return structured response
    const response = {
      business,
      menu,
      categories: categories || [],
      items: items || []
    }

    return successResponse(response)

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, errorMessage)
  }
}