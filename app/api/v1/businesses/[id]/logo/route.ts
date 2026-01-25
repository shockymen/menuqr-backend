// app/api/v1/businesses/[id]/logo/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ApiResponse, Business } from '@/types/api'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST /api/v1/businesses/:id/logo
// Upload/update business logo
export async function POST(
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

    // Parse request body
    const body = await request.json()
    const { logo_url } = body as { logo_url: string }

    // Validate
    if (!logo_url || typeof logo_url !== 'string') {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'logo_url is required and must be a string'
        }
      }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(logo_url)
    } catch {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'logo_url must be a valid URL'
        }
      }, { status: 400 })
    }

    // Verify business ownership
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, user_id, logo_url')
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

    // Update logo
    const { data: updatedBusiness, error: updateError } = await supabase
      .from('businesses')
      .update({ 
        logo_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      console.error('Logo update error:', updateError)
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update business logo',
          details: updateError.message
        }
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse<Business>>({
      data: updatedBusiness as Business
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Upload logo error:', errorMessage)
    
    return NextResponse.json<ApiResponse>({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}

// DELETE /api/v1/businesses/:id/logo
// Remove business logo
export async function DELETE(
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
      .select('id, user_id, logo_url')
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

    // Remove logo
    const { data: updatedBusiness, error: updateError } = await supabase
      .from('businesses')
      .update({ 
        logo_url: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      console.error('Logo removal error:', updateError)
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to remove business logo',
          details: updateError.message
        }
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse>({
      data: {
        message: 'Logo removed successfully',
        business: updatedBusiness as Business
      }
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Remove logo error:', errorMessage)
    
    return NextResponse.json<ApiResponse>({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}