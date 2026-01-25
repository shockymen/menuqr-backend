import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-helpers'

// POST /api/v1/auth/signout
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request)
    if (authError || !user) {
      return unauthorizedResponse()
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

    const { error } = await supabase.auth.signOut()

    if (error) {
      return errorResponse('SIGNOUT_FAILED', error.message, 500)
    }

    return successResponse({ message: 'Successfully signed out' })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, errorMessage)
  }
}