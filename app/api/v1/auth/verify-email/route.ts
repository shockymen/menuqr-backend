import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { successResponse, errorResponse } from '@/lib/api-helpers'

// POST /api/v1/auth/verify-email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.token) {
      return errorResponse('MISSING_TOKEN', 'Verification token is required', 400)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { error } = await supabase.auth.verifyOtp({
      token_hash: body.token,
      type: 'email'
    })

    if (error) {
      return errorResponse('VERIFICATION_FAILED', error.message, 400)
    }

    return successResponse({ message: 'Email verified successfully' })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, errorMessage)
  }
}