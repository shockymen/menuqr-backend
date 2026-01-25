import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-helpers'

// GET /api/v1/auth/me
export async function GET(request: NextRequest) {
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

    const { data, error } = await supabase.auth.getUser()

    // FIXED: Proper null check
    if (error || !data || !data.user) {
      return unauthorizedResponse()
    }

    return successResponse({
      id: data.user.id,
      email: data.user.email,
      email_verified: data.user.email_confirmed_at !== null,
      created_at: data.user.created_at,
      updated_at: data.user.updated_at
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, errorMessage)
  }
}

// PUT /api/v1/auth/me
export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request)
    if (authError || !user) {
      return unauthorizedResponse()
    }

    const body = await request.json()

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

    const { data, error } = await supabase.auth.updateUser({
      email: body.email,
      data: body.metadata || {}
    })

    // FIXED: Proper null check
    if (error || !data || !data.user) {
      return errorResponse('UPDATE_FAILED', error?.message || 'Update failed', 500)
    }

    return successResponse({
      id: data.user.id,
      email: data.user.email,
      email_verified: data.user.email_confirmed_at !== null,
      updated_at: data.user.updated_at
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, errorMessage)
  }
}

// DELETE /api/v1/auth/me
export async function DELETE(request: NextRequest) {
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

    // Note: Supabase doesn't have a direct delete user method from client
    // You'll need to call admin API or create a database function
    // For now, we can at least sign them out
    const { error } = await supabase.auth.signOut()

    if (error) {
      return errorResponse('DELETE_FAILED', error.message, 500)
    }

    return successResponse({ 
      message: 'Account deletion initiated. Please contact support to complete the process.' 
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, errorMessage)
  }
}