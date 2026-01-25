import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api-helpers'

// POST /api/v1/auth/refresh
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.refresh_token) {
      return validationErrorResponse('Refresh token is required')
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: body.refresh_token
    })

    // FIXED: Proper null checks
    if (error || !data || !data.session || !data.user) {
      return errorResponse('REFRESH_FAILED', error?.message || 'Invalid refresh token', 401)
    }

    return successResponse({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email
      }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, errorMessage)
  }
}