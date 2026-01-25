import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ApiResponse, Business } from '@/types/api'

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Create Supabase client with the user's access token
    // IMPORTANT: Use anon key but authenticate with the JWT
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Set the auth context using the access token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token'
        }
      }, { status: 401 })
    }

    // Now query with an authenticated client
    // Create a new client that uses this specific session
    const authenticatedClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        },
        auth: {
          persistSession: false
        }
      }
    )

    // Query businesses - RLS will filter to only user's businesses
    const { data: businesses, error } = await authenticatedClient
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'QUERY_FAILED',
          message: error.message
        }
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse<Business[]>>({
      data: businesses
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Unexpected error:', errorMessage)
    return NextResponse.json<ApiResponse>({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get and verify auth token (same as GET)
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json<ApiResponse>({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json<ApiResponse>({
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' }
      }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { name, email, phone, address, logo_url } = body

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Business name and email are required'
        }
      }, { status: 400 })
    }

    // Create authenticated client
    const authenticatedClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false }
      }
    )

    // Insert business (RLS ensures user_id is set automatically)
    const { data: business, error } = await authenticatedClient
      .from('businesses')
      .insert({
        user_id: user.id, // Explicitly set user_id
        name,
        email,
        phone,
        address,
        logo_url
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json<ApiResponse>({
        error: { code: 'CREATE_FAILED', message: error.message }
      }, { status: 500 })
    }

    // Optional: Create default menu for the business
    const { error: menuError } = await authenticatedClient
      .from('menus')
      .insert({
        business_id: business.id,
        name: 'Main Menu',
        is_active: true
      })

    if (menuError) {
      console.error('Failed to create default menu:', menuError)
      // Don't fail the whole request, just log it
    }

    // Optional: Create trial subscription
    const { error: subError } = await authenticatedClient
      .from('subscriptions')
      .insert({
        business_id: business.id,
        plan: 'starter',
        status: 'trial',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
      })

    if (subError) {
      console.error('Failed to create subscription:', subError)
      // Don't fail the whole request
    }

    return NextResponse.json<ApiResponse<Business>>({
      data: business
    }, { status: 201 }) // 201 Created

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Unexpected error:', errorMessage)
    return NextResponse.json<ApiResponse>({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}