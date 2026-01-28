import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isValidInvitationToken } from '@/lib/team-helpers'
import { sendInvitationAcceptedEmail } from '@/lib/email-service'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST /api/v1/invitations/[token]/accept
// Accept a team invitation
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const params = await context.params
    const inviteToken = params.token

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

    // 2. Validate invitation token
    const validation = await isValidInvitationToken(inviteToken)
    
    if (!validation.valid) {
      return NextResponse.json({
        error: {
          code: 'INVALID_INVITATION',
          message: validation.error || 'Invalid invitation'
        }
      }, { status: 400 })
    }

    const invitation = validation.invitation!

    // 3. Check if email matches (if invitation is for specific email)
    if (invitation.email && invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
      return NextResponse.json({
        error: {
          code: 'EMAIL_MISMATCH',
          message: 'This invitation was sent to a different email address'
        }
      }, { status: 403 })
    }

    // 4. Check if user is already a team member
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('id, status')
      .eq('business_id', invitation.business_id)
      .eq('user_id', user.id)
      .single()

    if (existingMember) {
      return NextResponse.json({
        error: {
          code: 'ALREADY_MEMBER',
          message: existingMember.status === 'active'
            ? 'You are already a member of this team'
            : 'You already have a pending invitation'
        }
      }, { status: 409 })
    }

    // 5. Get business name for response message
    const { data: business } = await supabase
      .from('businesses')
      .select('name')
      .eq('id', invitation.business_id)
      .single()

    // 6. Get role details
    const { data: role, error: roleError } = await supabase
      .from('business_roles')
      .select('id, role_key, role_name, permissions')
      .eq('business_id', invitation.business_id)
      .eq('role_key', invitation.role_key)
      .single()

    if (roleError || !role) {
      return NextResponse.json({
        error: {
          code: 'ROLE_NOT_FOUND',
          message: 'The role for this invitation no longer exists'
        }
      }, { status: 404 })
    }

    // 7. Create team member record
    const { data: teamMember, error: memberError } = await supabase
      .from('team_members')
      .insert({
        business_id: invitation.business_id,
        user_id: user.id,
        role_id: role.id,
        status: 'active',
        invited_by_user_id: invitation.invited_by_user_id,
        invited_at: invitation.created_at,
        invitation_accepted_at: new Date().toISOString()
      })
      .select(`
        id,
        business_id,
        user_id,
        status,
        invited_at,
        invitation_accepted_at,
        created_at,
        role:business_roles(
          id,
          role_key,
          role_name,
          role_description,
          permissions
        ),
        business:businesses(
          id,
          name,
          slug
        )
      `)
      .single()

    if (memberError) {
      console.error('Create team member error:', memberError)
      return NextResponse.json({
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to join team',
          details: memberError.message
        }
      }, { status: 500 })
    }

    // 8. Update invitation status
    const { error: updateError } = await supabase
      .from('team_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by_user_id: user.id,
        current_uses: invitation.current_uses + 1
      })
      .eq('id', invitation.id)

    if (updateError) {
      console.error('Update invitation error:', updateError)
      // Don't fail the request - member was created successfully
    }

    // 9. Send notification to inviter
    try {
      const { data: inviter, error: inviterError } = await supabase.auth.admin.getUserById(
        invitation.invited_by_user_id
      )

      if (!inviterError && inviter?.user?.email) {
        await sendInvitationAcceptedEmail({
          to: inviter.user.email,
          inviterName: inviter.user.email.split('@')[0],
          businessName: business?.name || 'your business',
          newMemberName: user.email?.split('@')[0],
          newMemberEmail: user.email!,
          roleName: role.role_name
        })
        console.log(`Acceptance notification sent to ${inviter.user.email}`)
      }
    } catch (emailError) {
      console.error('Failed to send acceptance notification:', emailError)
      // Don't fail the request - email is non-critical
    }

    const businessData = Array.isArray(teamMember.business) 
      ? teamMember.business[0] 
      : teamMember.business
    const businessName = businessData?.name || business?.name || 'the team'

    return NextResponse.json({
      data: {
        team_member: teamMember,
        message: `You've successfully joined ${businessName} as a ${role.role_name}`
      }
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Accept invitation error:', errorMessage)
    
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}

// GET /api/v1/invitations/[token]/accept
// Check invitation validity (public, no auth required)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const params = await context.params
    const inviteToken = params.token

    // Validate invitation token
    const validation = await isValidInvitationToken(inviteToken)
    
    if (!validation.valid) {
      return NextResponse.json({
        error: {
          code: 'INVALID_INVITATION',
          message: validation.error || 'Invalid invitation'
        }
      }, { status: 400 })
    }

    const invitation = validation.invitation!
    const business = Array.isArray(invitation.business) 
      ? invitation.business[0] 
      : invitation.business

    return NextResponse.json({
      data: {
        valid: true,
        business: {
          id: business?.id,
          name: business?.name,
          slug: business?.slug
        },
        role_key: invitation.role_key,
        email: invitation.email,
        expires_at: invitation.expires_at
      }
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Check invitation error:', errorMessage)
    
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}