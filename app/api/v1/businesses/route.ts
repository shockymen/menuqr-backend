import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ApiResponse, Business } from '@/types/api'

export async function GET(request: NextRequest) {
  try {
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

    // Get businesses where user is owner OR team member
    const { data: businesses, error } = await authenticatedClient
      .from('businesses')
      .select(`
        *,
        team_members:business_team_members!inner(
          role_id,
          status,
          roles:business_roles(
            role_key,
            role_name,
            permissions
          )
        )
      `)
      .eq('business_team_members.user_id', user.id)
      .eq('business_team_members.status', 'active')
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

    const body = await request.json()
    const { 
      name, 
      location,
      email, 
      phone, 
      address, 
      logo_url, 
      city, 
      country, 
      description 
    } = body

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

    // Generate slug: name + location + city + userID (first 6 chars)
    const slugParts = [name, location, city].filter(Boolean)
    const baseSlug = slugParts
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    const userIdSuffix = user.id.slice(0, 6)
    const slug = `${baseSlug}-${userIdSuffix}`

    const authenticatedClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false }
      }
    )

    // ========================================
    // STEP 1: Create Business
    // ========================================
    const { data: business, error: businessError } = await authenticatedClient
      .from('businesses')
      .insert({
        user_id: user.id,
        name,
        location,
        display_name: displayName,
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

    if (businessError) {
      console.error('Business creation error:', businessError)
      return NextResponse.json<ApiResponse>({
        error: { code: 'CREATE_FAILED', message: businessError.message }
      }, { status: 500 })
    }

    // ========================================
    // STEP 2: Create Default Roles
    // (Trigger should handle this, but let's be explicit)
    // ========================================
    const defaultRoles = [
      {
        business_id: business.id,
        role_key: 'super_admin',
        role_name: 'Super Admin',
        role_description: 'Full system control, manages billing & team',
        permissions: ['*'],
        is_custom: false,
        can_be_edited: false,
        can_be_deleted: false
      },
      {
        business_id: business.id,
        role_key: 'administrator',
        role_name: 'Administrator',
        role_description: 'Manages operations, team, and settings',
        permissions: ['menu.*', 'item.*', 'category.*', 'qr.*', 'team.read', 'team.invite', 'team.remove', 'team.update_roles', 'business.read', 'business.update_info', 'business.upload_logo', 'analytics.*', 'audit.view_logs'],
        is_custom: false,
        can_be_edited: true,
        can_be_deleted: false
      },
      {
        business_id: business.id,
        role_key: 'manager',
        role_name: 'Manager',
        role_description: 'Manages daily operations',
        permissions: ['menu.read', 'menu.update', 'menu.activate', 'item.*', 'category.*', 'qr.generate', 'qr.download', 'analytics.view_business', 'analytics.view_items'],
        is_custom: false,
        can_be_edited: true,
        can_be_deleted: false
      },
      {
        business_id: business.id,
        role_key: 'staff',
        role_name: 'Staff',
        role_description: 'Basic menu operations',
        permissions: ['menu.read', 'item.read', 'item.toggle_availability', 'category.read'],
        is_custom: false,
        can_be_edited: true,
        can_be_deleted: false
      },
      {
        business_id: business.id,
        role_key: 'viewer',
        role_name: 'Viewer',
        role_description: 'Read-only access',
        permissions: ['menu.read', 'item.read', 'category.read', 'analytics.*', 'audit.view_logs'],
        is_custom: false,
        can_be_edited: true,
        can_be_deleted: false
      }
    ]

    const { data: roles, error: rolesError } = await authenticatedClient
      .from('business_roles')
      .insert(defaultRoles)
      .select()

    if (rolesError) {
      console.error('Roles creation error:', rolesError)
      // Continue anyway - trigger might have created them
    }

    // ========================================
    // STEP 3: Add Creator as Super Admin
    // ========================================
    const superAdminRole = roles?.find(r => r.role_key === 'super_admin')
    
    if (superAdminRole) {
      const { error: memberError } = await authenticatedClient
        .from('business_team_members')
        .insert({
          business_id: business.id,
          user_id: user.id,
          role_id: superAdminRole.id,
          status: 'active',
          invited_by_user_id: user.id,
          invited_at: new Date().toISOString(),
          invitation_accepted_at: new Date().toISOString(),
          last_active_at: new Date().toISOString()
        })

      if (memberError) {
        console.error('Team member creation error:', memberError)
        // Continue anyway - might already exist from trigger
      }
    }

    // ========================================
    // STEP 4: Create Default Menu (Optional)
    // ========================================
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

    // ========================================
    // STEP 5: Create Trial Subscription (Optional)
    // ========================================
    const { error: subError } = await authenticatedClient
      .from('subscriptions')
      .insert({
        business_id: business.id,
        plan: 'starter',
        status: 'trial',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      })

    if (subError) {
      console.error('Failed to create subscription:', subError)
    }

    // ========================================
    // RETURN: Complete Business with Role Info
    // ========================================
    return NextResponse.json<ApiResponse<Business>>({
      data: {
        ...business,
        my_role: superAdminRole,
        team_count: 1
      }
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