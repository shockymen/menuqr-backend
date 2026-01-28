import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isBusinessOwner, hasPermission, PERMISSIONS } from '@/lib/team-helpers'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/v1/businesses/[id]/roles
// List all available roles for a business
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const businessId = params.id

    // 1. Authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createServerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token'
        }
      }, { status: 401 })
    }

    // 2. Verify business exists
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('id', businessId)
      .single()

    if (bizError || !business) {
      return NextResponse.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Business not found'
        }
      }, { status: 404 })
    }

    // 3. Check permissions (any team member can view roles)
    const isOwner = await isBusinessOwner(businessId, user.id)
    const canView = isOwner || await hasPermission(businessId, user.id, PERMISSIONS.TEAM_VIEW)

    if (!canView) {
      return NextResponse.json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to view roles'
        }
      }, { status: 403 })
    }

    // 4. Fetch all roles for the business
    const { data: roles, error: rolesError } = await supabase
      .from('business_roles')
      .select(`
        id,
        role_key,
        role_name,
        role_description,
        permissions,
        is_custom,
        can_be_edited,
        can_be_deleted,
        created_at
      `)
      .eq('business_id', businessId)
      .order('role_key', { ascending: true })

    if (rolesError) {
      console.error('Fetch roles error:', rolesError)
      return NextResponse.json({
        error: {
          code: 'QUERY_FAILED',
          message: 'Failed to fetch roles',
          details: rolesError.message
        }
      }, { status: 500 })
    }

    // 5. Categorize roles
    const defaultRoles = roles?.filter(r => !r.is_custom) || []
    const customRoles = roles?.filter(r => r.is_custom) || []

    return NextResponse.json({
      data: {
        roles: roles || [],
        default_roles: defaultRoles,
        custom_roles: customRoles,
        total: roles?.length || 0
      }
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('List roles error:', errorMessage)
    
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}