import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api-helpers'

// POST /api/v1/auth/resend-verification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.email) {
      return validationErrorResponse('Email is required')
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: body.email
    })

    if (error) {
      return errorResponse('RESEND_FAILED', error.message, 500)
    }

    return successResponse({ 
      message: 'Verification email sent. Please check your inbox.' 
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, errorMessage)
  }
}