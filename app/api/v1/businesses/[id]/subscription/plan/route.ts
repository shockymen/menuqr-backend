// app/api/v1/businesses/[id]/subscription/plan/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ApiResponse } from '@/types/api'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json<ApiResponse>({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json<ApiResponse>({
        error: { code: 'UNAUTHORIZED', message: 'Invalid token' }
      }, { status: 401 })
    }

    const body = await request.json() as { new_plan: string }

    if (!body.new_plan || !['starter', 'business', 'enterprise'].includes(body.new_plan)) {
      return NextResponse.json<ApiResponse>({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid plan' }
      }, { status: 400 })
    }

    // Verify ownership
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('id, user_id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (bizError || !business) {
      return NextResponse.json<ApiResponse>({
        error: { code: 'NOT_FOUND', message: 'Business not found' }
      }, { status: 404 })
    }

    // Update subscription
    const { data: updated, error: updateError } = await supabase
      .from('subscriptions')
      .update({ plan: body.new_plan, updated_at: new Date().toISOString() })
      .eq('business_id', params.id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json<ApiResponse>({
        error: { code: 'UPDATE_FAILED', message: 'Failed to update plan' }
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse>({ data: updated }, { status: 200 })

  } catch (error) {
    console.error('Update plan error:', error)
    return NextResponse.json<ApiResponse>({
      error: { code: 'INTERNAL_ERROR', message: 'Internal error' }
    }, { status: 500 })
  }
}