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
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token'
        }
      }, { status: 401 })
    }

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

    // Parse request body - NOW WITH LOCATION!
    const body = await request.json()
    const { 
      name, 
      location,  // NEW FIELD
      email, 
      phone, 
      address, 
      logo_url, 
      city, 
      country, 
      description 
    } = body

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Business name and email are required'
        }
      }, { status: 400 })
    }

    // Generate display_name
    const displayName = location ? `${name} - ${location}` : name

    // Generate slug from name + location + city (all that's available)
    const slugParts = [name, location, city].filter(Boolean)
    const baseSlug = slugParts
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    // Add timestamp to ensure uniqueness (even for same name+location+city)
    const timestamp = Date.now().toString(36).slice(-6)
    const slug = `${baseSlug}-${timestamp}`

    // Create authenticated client
    const authenticatedClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false }
      }
    )

    // Insert business with new fields
    const { data: business, error } = await authenticatedClient
      .from('businesses')
      .insert({
        user_id: user.id,
        name,
        location,      // NEW
        display_name: displayName,  // NEW
        slug,
        email,
        phone,
        address,
        city,
        country,
        description,
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
    }

    // Optional: Create trial subscription
    const { error: subError } = await authenticatedClient
      .from('subscriptions')
      .insert({
        business_id: business.id,
        plan: 'starter',
        status: 'trial',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      })

    if (subError) {
      console.error('Failed to create subscription:', subError)
    }

    return NextResponse.json<ApiResponse<Business>>({
      data: business
    }, { status: 201 })

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