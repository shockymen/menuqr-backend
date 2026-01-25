import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-helpers'
import type { Business, Menu } from '@/types/api'

// GET /api/v1/public/{businessSlug}
// Returns business info + all active menus
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessSlug: string }> }
) {
  try {
    const { businessSlug } = await params
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Find business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('slug', businessSlug)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single()

    if (businessError || !business) {
      return notFoundResponse('Business')
    }

    // Get all active menus for this business
    const { data: menus } = await supabase
      .from('menus')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })

    const response = {
      business: business as Business,
      menus: menus as Menu[] || []
    }

    return successResponse(response)

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, errorMessage)
  }
}