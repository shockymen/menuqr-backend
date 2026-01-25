// app/api/v1/businesses/[id]/settings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ApiResponse, Business } from '@/types/api'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// PATCH /api/v1/businesses/:id/settings
// Update business settings
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

    // Verify business ownership
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, user_id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (businessError || !business) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'NOT_FOUND',
          message: 'Business not found or you do not have permission'
        }
      }, { status: 404 })
    }

    // Parse request body
    const body = await request.json() as Partial<Business>

    // Build updates object with allowed fields
    const updates: Partial<Business> = {}
    
    const settingsFields = [
      'timezone',
      'currency',
      'tax_rate',
      'default_language',
      'supported_languages',
      'auto_translate',
      'translation_provider',
      'business_hours',
      'primary_color',
      'features_enabled',
      'social_media'
    ] as const

    for (const field of settingsFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field] as never
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No valid settings fields to update'
        }
      }, { status: 400 })
    }

    // Validate specific fields
    if (updates.currency && !/^[A-Z]{3}$/.test(updates.currency)) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'currency must be a 3-letter ISO code (e.g., GHS, USD, EUR)'
        }
      }, { status: 400 })
    }

    if (updates.tax_rate !== undefined && (updates.tax_rate < 0 || updates.tax_rate > 100)) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'tax_rate must be between 0 and 100'
        }
      }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString() as never

    // Update business settings
    const { data: updatedBusiness, error: updateError } = await supabase
      .from('businesses')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      console.error('Settings update error:', updateError)
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update business settings',
          details: updateError.message
        }
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse<Business>>({
      data: updatedBusiness as Business
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Update business settings error:', errorMessage)
    
    return NextResponse.json<ApiResponse>({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}