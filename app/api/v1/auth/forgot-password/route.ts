import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api-helpers'

// POST /api/v1/auth/forgot-password
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

    // Send password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(body.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`
    })

    if (error) {
      return errorResponse('RESET_REQUEST_FAILED', error.message, 500)
    }

    // Always return success (don't reveal if email exists)
    return successResponse({ 
      message: 'If an account exists with this email, you will receive a password reset link' 
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, errorMessage)
  }
}