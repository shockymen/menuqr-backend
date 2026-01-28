import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isSuperAdmin, hasPermission, PERMISSIONS } from '@/lib/team-helpers'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/v1/businesses/[id]/team
// List all team members for a business
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

    // 3. Check permissions
    const isAdmin = await isSuperAdmin(businessId, user.id)
    const canView = isAdmin || await hasPermission(businessId, user.id, PERMISSIONS.TEAM_VIEW)

    if (!canView) {
      return NextResponse.json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to view team members'
        }
      }, { status: 403 })
    }

    // 4. Fetch ALL team members (including super_admins)
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select(`
        id,
        user_id,
        status,
        invited_at,
        invitation_accepted_at,
        last_active_at,
        created_at,
        role:business_roles(
          id,
          role_key,
          role_name,
          role_description,
          permissions
        )
      `)
      .eq('business_id', businessId)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: true })

    if (membersError) {
      console.error('Fetch team members error:', membersError)
      return NextResponse.json({
        error: {
          code: 'QUERY_FAILED',
          message: 'Failed to fetch team members',
          details: membersError.message
        }
      }, { status: 500 })
    }

    // 5. Add is_super_admin flag to each member
    const teamMembers = (members || []).map(member => {
      const role = Array.isArray(member.role) ? member.role[0] : member.role
      return {
        ...member,
        is_super_admin: role?.role_key === 'super_admin'
      }
    })

    return NextResponse.json({
      data: {
        team_members: teamMembers,
        total: teamMembers.length
      }
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('List team members error:', errorMessage)
    
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}