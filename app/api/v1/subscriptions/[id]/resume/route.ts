// app/api/v1/subscriptions/[id]/resume/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ApiResponse } from '@/types/api'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
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

    // Get subscription and verify ownership
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id, status, business_id, businesses!inner(user_id)')
      .eq('id', params.id)
      .single()

    if (subError || !subscription) {
      return NextResponse.json<ApiResponse>({
        error: { code: 'NOT_FOUND', message: 'Subscription not found' }
      }, { status: 404 })
    }

    const subData = subscription as { businesses: Array<{ user_id: string }> }
    if (subData.businesses[0].user_id !== user.id) {
      return NextResponse.json<ApiResponse>({
        error: { code: 'FORBIDDEN', message: 'Permission denied' }
      }, { status: 403 })
    }

    // Resume subscription
    const { data: updated, error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json<ApiResponse>({
        error: { code: 'UPDATE_FAILED', message: 'Failed to resume subscription' }
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse>({ data: updated }, { status: 200 })

  } catch (error) {
    console.error('Resume subscription error:', error)
    return NextResponse.json<ApiResponse>({
      error: { code: 'INTERNAL_ERROR', message: 'Internal error' }
    }, { status: 500 })
  }
}