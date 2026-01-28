import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { 
  isSuperAdmin, 
  hasPermission, 
  PERMISSIONS,
  generateInvitationToken
} from '@/lib/team-helpers'
import { checkSubscriptionLimit } from '@/lib/subscription-enforcement'
import { sendInvitationEmail } from '@/lib/email-service'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface InviteRequestBody {
  email: string
  role_key: string
  message?: string
}

// POST /api/v1/businesses/[id]/team/invite
// Invite a new team member
export async function POST(
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
      .select('id, name, slug')
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
    const canInvite = isAdmin || await hasPermission(businessId, user.id, PERMISSIONS.TEAM_INVITE)

    if (!canInvite) {
      return NextResponse.json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to invite team members'
        }
      }, { status: 403 })
    }

    // 4. Check subscription limits
    const limitCheck = await checkSubscriptionLimit(businessId, 'team_members')
    if (!limitCheck.allowed) {
      return NextResponse.json({
        error: limitCheck.error
      }, { status: 403 })
    }

    // 5. Parse request body
    const body = await request.json() as InviteRequestBody

    if (!body.email || !body.role_key) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and role_key are required'
        }
      }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email format'
        }
      }, { status: 400 })
    }

    // 6. Check if there's already a pending invitation for this email
    const { data: existingInvitation } = await supabase
      .from('team_invitations')
      .select('id, status')
      .eq('business_id', businessId)
      .eq('email', body.email.toLowerCase())
      .eq('status', 'pending')
      .single()

    if (existingInvitation) {
      return NextResponse.json({
        error: {
          code: 'CONFLICT',
          message: 'An invitation has already been sent to this email address'
        }
      }, { status: 409 })
    }

    // 7. Check if email corresponds to existing team member
    // Note: We can't easily check this without knowing their user_id
    // This will be caught when they try to accept the invitation

    // 8. Verify role exists
    const { data: role, error: roleError } = await supabase
      .from('business_roles')
      .select('id, role_key, role_name, permissions')
      .eq('business_id', businessId)
      .eq('role_key', body.role_key)
      .single()

    if (roleError || !role) {
      return NextResponse.json({
        error: {
          code: 'NOT_FOUND',
          message: `Role '${body.role_key}' not found`
        }
      }, { status: 404 })
    }

    // 9. Check if inviting as super_admin (requires super_admin permission)
    if (role.role_key === 'super_admin' && !isAdmin) {
      return NextResponse.json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only Super Admins can invite users as Super Admin'
        }
      }, { status: 403 })
    }

    // 10. Generate invitation token
    const inviteToken = generateInvitationToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiration

    // 11. Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('team_invitations')
      .insert({
        business_id: businessId,
        invited_by_user_id: user.id,
        invitation_type: 'email',
        email: body.email.toLowerCase(),
        invite_token: inviteToken,
        max_uses: 1,
        current_uses: 0,
        role_id: role.id,
        role_key: role.role_key,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        metadata: body.message ? { message: body.message } : null
      })
      .select(`
        id,
        email,
        invite_token,
        role_key,
        status,
        expires_at,
        created_at,
        role:business_roles(
          role_name,
          role_description
        )
      `)
      .single()

    if (inviteError) {
      console.error('Create invitation error:', inviteError)
      return NextResponse.json({
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create invitation',
          details: inviteError.message
        }
      }, { status: 500 })
    }

    // 12. Generate invitation URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://menuqr.africa'
    const invitationUrl = `${baseUrl}/invite/${inviteToken}`

    // 13. Send invitation email
    try {
      await sendInvitationEmail({
        to: body.email,
        businessName: business.name,
        roleName: role.role_name,
        inviterName: user.email?.split('@')[0] || 'Team Admin',
        inviterEmail: user.email!,
        invitationUrl,
        message: body.message
      })
      console.log(`Invitation email sent to ${body.email}`)
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError)
      // Don't fail the request - invitation was created
      // Email failure is non-critical
    }

    return NextResponse.json({
      data: {
        invitation: {
          ...invitation,
          invitation_url: invitationUrl
        }
      }
    }, { status: 201 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Invite team member error:', errorMessage)
    
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}