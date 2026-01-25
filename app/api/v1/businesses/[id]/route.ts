import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse, forbiddenResponse } from '@/lib/api-helpers'
import type { Business } from '@/types/api'

// GET /api/v1/businesses/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params  // FIX: Await params
    
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

    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !business) {
      return notFoundResponse('Business')
    }

    return successResponse<Business>(business)

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, errorMessage)
  }
}

// PUT /api/v1/businesses/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params  // FIX: Await params
    
    const { user, error: authError } = await getAuthUser(request)
    if (authError || !user) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    
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

    // Check ownership
    const { data: existing } = await supabase
      .from('businesses')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing) {
      return notFoundResponse('Business')
    }

    if (existing.user_id !== user.id) {
      return forbiddenResponse('You do not have permission to update this business')
    }

    // Update business
    const { data: business, error } = await supabase
      .from('businesses')
      .update({
        name: body.name,
        email: body.email,
        phone: body.phone,
        address: body.address,
        city: body.city,
        country: body.country,
        postal_code: body.postal_code,
        description: body.description,
        website: body.website,
        business_hours: body.business_hours,
        primary_color: body.primary_color,
        social_media: body.social_media,
        supported_languages: body.supported_languages,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return errorResponse('UPDATE_FAILED', error.message, 500)
    }

    return successResponse<Business>(business)

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, errorMessage)
  }
}

// DELETE /api/v1/businesses/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params  // FIX: Await params
    
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

    // Check ownership
    const { data: existing } = await supabase
      .from('businesses')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing) {
      return notFoundResponse('Business')
    }

    if (existing.user_id !== user.id) {
      return forbiddenResponse('You do not have permission to delete this business')
    }

    // Soft delete
    const { error } = await supabase
      .from('businesses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return errorResponse('DELETE_FAILED', error.message, 500)
    }

    return successResponse({ message: 'Business deleted successfully' })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, errorMessage)
  }
}