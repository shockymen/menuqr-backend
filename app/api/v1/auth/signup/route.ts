import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { ApiResponse } from '@/types/api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required'
        }
      }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password must be at least 8 characters'
        }
      }, { status: 400 })
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })

    if (error) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'SIGNUP_FAILED',
          message: error.message
        }
      }, { status: 400 })
    }

    return NextResponse.json<ApiResponse>({
      data: {
        user: {
          id: data.user?.id,
          email: data.user?.email
        },
        message: 'Signup successful'
      }
    }, { status: 201 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json<ApiResponse>({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}