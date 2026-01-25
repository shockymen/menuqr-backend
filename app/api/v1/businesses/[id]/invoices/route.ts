// app/api/v1/businesses/[id]/invoices/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ApiResponse } from '@/types/api'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/v1/businesses/:id/invoices
// List invoices for a business from Supabase database
export async function GET(
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
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('id, user_id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (bizError || !business) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'NOT_FOUND',
          message: 'Business not found or you do not have permission'
        }
      }, { status: 404 })
    }

    // Get subscription for this business
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('business_id', params.id)
      .single()

    if (subError || !subscription) {
      return NextResponse.json<ApiResponse>({
        data: {
          invoices: [],
          message: 'No subscription found for this business'
        }
      }, { status: 200 })
    }

    // Get invoices from YOUR database
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('*')
      .eq('subscription_id', subscription.id)
      .order('created_at', { ascending: false })

    if (invoicesError) {
      console.error('Fetch invoices error:', invoicesError)
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'QUERY_FAILED',
          message: 'Failed to fetch invoices',
          details: invoicesError.message
        }
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse>({
      data: {
        invoices: invoices || [],
        total: invoices?.length || 0
      }
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('List invoices error:', errorMessage)
    
    return NextResponse.json<ApiResponse>({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}