import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api-helpers'

// POST /api/v1/auth/reset-password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.password) {
      return validationErrorResponse('Password is required')
    }

    if (body.password.length < 8) {
      return validationErrorResponse('Password must be at least 8 characters')
    }

    // Token comes from URL (user clicks email link)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return errorResponse('MISSING_TOKEN', 'Reset token is required', 400)
    }

    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false }
      }
    )

    const { error } = await supabase.auth.updateUser({
      password: body.password
    })

    if (error) {
      return errorResponse('RESET_FAILED', error.message, 500)
    }

    return successResponse({ message: 'Password reset successfully' })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, errorMessage)
  }
}