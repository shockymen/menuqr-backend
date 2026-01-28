import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isSuperAdmin, hasPermission, PERMISSIONS } from '@/lib/team-helpers'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface UpdateRoleBody {
  role_key: string
}

// PATCH /api/v1/businesses/[id]/team/[memberId]/role
// Update a team member's role
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const params = await context.params
    const businessId = params.id
    const memberId = params.memberId

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
    const canManage = isAdmin || await hasPermission(businessId, user.id, PERMISSIONS.TEAM_MANAGE)

    if (!canManage) {
      return NextResponse.json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to manage team members'
        }
      }, { status: 403 })
    }

    // 4. Parse request body
    const body = await request.json() as UpdateRoleBody

    if (!body.role_key) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'role_key is required'
        }
      }, { status: 400 })
    }

    // 5. Get existing team member
    const { data: teamMember, error: memberError } = await supabase
      .from('team_members')
      .select(`
        id,
        user_id,
        business_id,
        status,
        role:business_roles(
          id,
          role_key,
          role_name
        )
      `)
      .eq('id', memberId)
      .eq('business_id', businessId)
      .single()

    if (memberError || !teamMember) {
      return NextResponse.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Team member not found'
        }
      }, { status: 404 })
    }

    // 6. Verify new role exists
    const { data: newRole, error: roleError } = await supabase
      .from('business_roles')
      .select('id, role_key, role_name, role_description, permissions')
      .eq('business_id', businessId)
      .eq('role_key', body.role_key)
      .single()

    if (roleError || !newRole) {
      return NextResponse.json({
        error: {
          code: 'NOT_FOUND',
          message: `Role '${body.role_key}' not found`
        }
      }, { status: 404 })
    }

    // 7. Check if promoting to super_admin (requires super_admin permission)
    if (newRole.role_key === 'super_admin' && !isAdmin) {
      return NextResponse.json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only Super Admins can promote users to Super Admin'
        }
      }, { status: 403 })
    }

    // 8. Check if role is already the same
    const currentRole = Array.isArray(teamMember.role) 
      ? teamMember.role[0] 
      : teamMember.role

    if (currentRole?.role_key === body.role_key) {
      return NextResponse.json({
        error: {
          code: 'NO_CHANGE',
          message: 'Team member already has this role'
        }
      }, { status: 400 })
    }

    // 9. Update team member role
    const { data: updatedMember, error: updateError } = await supabase
      .from('team_members')
      .update({
        role_id: newRole.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', memberId)
      .select(`
        id,
        user_id,
        business_id,
        status,
        invited_at,
        invitation_accepted_at,
        last_active_at,
        created_at,
        updated_at,
        role:business_roles(
          id,
          role_key,
          role_name,
          role_description,
          permissions
        )
      `)
      .single()

    if (updateError) {
      console.error('Update team member error:', updateError)
      return NextResponse.json({
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update team member role',
          details: updateError.message
        }
      }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        team_member: updatedMember,
        message: `Role updated to ${newRole.role_name}`
      }
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Update team member role error:', errorMessage)
    
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}