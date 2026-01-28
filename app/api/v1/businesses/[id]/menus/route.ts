import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse, forbiddenResponse, validationErrorResponse } from '@/lib/api-helpers'
import type { Menu } from '@/types/api'
import { checkSubscriptionLimit } from '@/lib/subscription-enforcement'

// GET /api/v1/businesses/:id/menus - List all menus for a business
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params
    
    const { user, error: authError } = await getAuthUser(request)
    if (authError || !user) {
      return unauthorizedResponse()
    }

    const authHeader = request.headers.get('authorization')!
    const token = authHeader.replace('Bearer ', '')
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false }
      }
    )

    // Verify user owns this business
    const { data: business } = await supabase
      .from('businesses')
      .select('user_id')
      .eq('id', businessId)
      .single()

    if (!business) {
      return notFoundResponse('Business')
    }

    if (business.user_id !== user.id) {
      return forbiddenResponse('You do not have permission to access this business')
    }

    // Get menus
    const { data: menus, error } = await supabase
      .from('menus')
      .select('*')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })

    if (error) {
      return errorResponse('QUERY_FAILED', error.message, 500)
    }

    return successResponse<Menu[]>(menus || [])

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, errorMessage)
  }
}

// POST /api/v1/businesses/:id/menus - Create a new menu
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params
    
    const { user, error: authError } = await getAuthUser(request)
    if (authError || !user) {
      return unauthorizedResponse()
    }

    const body = await request.json()

    // Validation
    if (!body.name) {
      return validationErrorResponse('Menu name is required')
    }

    const authHeader = request.headers.get('authorization')!
    const token = authHeader.replace('Bearer ', '')
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false }
      }
    )

    // Verify user owns this business
    const { data: business } = await supabase
      .from('businesses')
      .select('user_id')
      .eq('id', businessId)
      .single()

    if (!business) {
      return notFoundResponse('Business')
    }

    if (business.user_id !== user.id) {
      return forbiddenResponse('You do not have permission to create menus for this business')
    }

    // Check subscription limits
    const limitCheck = await checkSubscriptionLimit(businessId, 'menus')
    if (!limitCheck.allowed) {
      return errorResponse(limitCheck.error!.code, limitCheck.error!.message, 403, limitCheck.error!.details)
    }

    // Generate slug from name
    const slug = body.slug || body.name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Get max display_order
    const { data: lastMenu } = await supabase
      .from('menus')
      .select('display_order')
      .eq('business_id', businessId)
      .order('display_order', { ascending: false })
      .limit(1)
      .single()

    const displayOrder = body.display_order ?? ((lastMenu?.display_order ?? 0) + 1)

    // Create menu
    const { data: menu, error } = await supabase
      .from('menus')
      .insert({
        business_id: businessId,
        name: body.name,
        slug,
        description: body.description || null,
        is_active: body.is_active ?? true,
        display_order: displayOrder,
        availability_schedule: body.availability_schedule || null
      })
      .select()
      .single()

    if (error) {
      return errorResponse('CREATE_FAILED', error.message, 500)
    }

    return successResponse<Menu>(menu, 201)

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, errorMessage)
  }
}