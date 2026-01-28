import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isSuperAdmin, hasPermission, PERMISSIONS } from '@/lib/team-helpers'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// DELETE /api/v1/businesses/[id]/team/[memberId]
// Remove a team member
export async function DELETE(
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
          message: 'You do not have permission to remove team members'
        }
      }, { status: 403 })
    }

    // 4. Get team member to delete
    const { data: teamMember, error: memberError } = await supabase
      .from('team_members')
      .select(`
        id,
        user_id,
        business_id,
        role:business_roles(role_key)
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

    // 5. Check if deleting a super_admin
    const role = Array.isArray(teamMember.role) ? teamMember.role[0] : teamMember.role
    const isDeletingSuperAdmin = role?.role_key === 'super_admin'

    if (isDeletingSuperAdmin) {
      // Count remaining super_admins
      const { count } = await supabase
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('status', 'active')
        .eq('role:business_roles.role_key', 'super_admin')

      if ((count || 0) <= 1) {
        return NextResponse.json({
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot delete the last Super Admin. Business must have at least one Super Admin for continuity.'
          }
        }, { status: 403 })
      }
    }

    // 6. Delete the team member
    const { error: deleteError } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)

    if (deleteError) {
      console.error('Delete team member error:', deleteError)
      return NextResponse.json({
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to remove team member',
          details: deleteError.message
        }
      }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        message: 'Team member removed successfully',
        deleted_id: memberId
      }
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Remove team member error:', errorMessage)
    
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}