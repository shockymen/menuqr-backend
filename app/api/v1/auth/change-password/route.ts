import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse, validationErrorResponse } from '@/lib/api-helpers'

// POST /api/v1/auth/change-password
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request)
    if (authError || !user) {
      return unauthorizedResponse()
    }

    const body = await request.json()

    if (!body.currentPassword || !body.newPassword) {
      return validationErrorResponse('Current password and new password are required')
    }

    if (body.newPassword.length < 8) {
      return validationErrorResponse('New password must be at least 8 characters')
    }

    const authHeader = request.headers.get('authorization')!
    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false }
      }
    )

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: body.currentPassword
    })

    if (signInError) {
      return errorResponse('INVALID_PASSWORD', 'Current password is incorrect', 401)
    }

    // Update to new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: body.newPassword
    })

    if (updateError) {
      return errorResponse('UPDATE_FAILED', updateError.message, 500)
    }

    return successResponse({ message: 'Password changed successfully' })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, errorMessage)
  }
}