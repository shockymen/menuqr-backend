// app/api/v1/user/preferences/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ApiResponse } from '@/types/api'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function PATCH(request: NextRequest) {
  try {
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

    const preferences = await request.json()

    // Update user metadata
    const { data: updated, error: updateError } = await supabase.auth.updateUser({
      data: { preferences }
    })

    if (updateError) {
      return NextResponse.json<ApiResponse>({
        error: { code: 'UPDATE_FAILED', message: 'Failed to update preferences' }
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse>({
      data: { preferences: updated.user?.user_metadata?.preferences }
    }, { status: 200 })

  } catch (error) {
    console.error('Update preferences error:', error)
    return NextResponse.json<ApiResponse>({
      error: { code: 'INTERNAL_ERROR', message: 'Internal error' }
    }, { status: 500 })
  }
} 