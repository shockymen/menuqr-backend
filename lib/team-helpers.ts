import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const createAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface InvitationData {
  id: string
  business_id: string
  invited_by_user_id: string
  invitation_type: string
  email?: string
  invite_token?: string
  max_uses: number
  current_uses: number
  role_id?: string
  role_key: string
  status: string
  expires_at: string
  created_at: string
  business?: {
    id: string
    name: string
    slug: string
  }
}

// Check if user is a super admin of the business
export async function isSuperAdmin(businessId: string, userId: string): Promise<boolean> {
  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      id,
      role:business_roles!inner(role_key)
    `)
    .eq('business_id', businessId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  if (error || !data) return false

  const role = Array.isArray(data.role) ? data.role[0] : data.role
  return role?.role_key === 'super_admin'
}

// DEPRECATED: Use isSuperAdmin() instead
// Kept for backwards compatibility during migration
export async function isBusinessOwner(businessId: string, userId: string): Promise<boolean> {
  return isSuperAdmin(businessId, userId)
}

// Check if user has a specific permission
export async function hasPermission(
  businessId: string, 
  userId: string, 
  permission: string
): Promise<boolean> {
  const supabase = createAdminClient()
  
  // Check if user is super admin (has all permissions)
  const isAdmin = await isSuperAdmin(businessId, userId)
  if (isAdmin) return true
  
  // Check specific permission
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      role:business_roles!inner(permissions)
    `)
    .eq('business_id', businessId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  if (error || !data) return false

  const role = Array.isArray(data.role) ? data.role[0] : data.role
  const permissions = role?.permissions || []
  
  // Check if user has wildcard permission
  if (permissions.includes('*')) return true
  
  // Check specific permission
  return permissions.includes(permission)
}

// Get count of active team members (for subscription limits)
export async function getTeamMemberCount(businessId: string): Promise<number> {
  const supabase = createAdminClient()
  
  const { count, error } = await supabase
    .from('team_members')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('status', 'active')

  if (error) {
    console.error('Error counting team members:', error)
    return 0
  }

  return count || 0
}

// Generate a secure invitation token
export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// Validate an invitation token
export async function isValidInvitationToken(token: string): Promise<{
  valid: boolean
  invitation?: InvitationData
  error?: string
}> {
  const supabase = createAdminClient()
  
  const { data: invitation, error } = await supabase
    .from('team_invitations')
    .select(`
      *,
      business:businesses(id, name, slug)
    `)
    .eq('invite_token', token)
    .single()

  if (error || !invitation) {
    return { valid: false, error: 'Invitation not found' }
  }

  // Check if invitation is expired
  const expiresAt = new Date(invitation.expires_at)
  if (expiresAt < new Date()) {
    return { valid: false, error: 'Invitation has expired' }
  }

  // Check if invitation is still pending
  if (invitation.status !== 'pending') {
    return { valid: false, error: 'Invitation is no longer valid' }
  }

  // Check if invitation has reached max uses
  if (invitation.current_uses >= invitation.max_uses) {
    return { valid: false, error: 'Invitation has been fully used' }
  }

  return { valid: true, invitation: invitation as InvitationData }
}

// Get default role for new team members
export async function getDefaultRoleId(businessId: string): Promise<string | null> {
  const supabase = createAdminClient()
  
  // Try to find 'member' role
  const { data: role } = await supabase
    .from('business_roles')
    .select('id')
    .eq('business_id', businessId)
    .eq('role_key', 'member')
    .single()
  
  if (role) return role.id
  
  // Fallback: get any role
  const { data: anyRole } = await supabase
    .from('business_roles')
    .select('id')
    .eq('business_id', businessId)
    .limit(1)
    .single()
  
  return anyRole?.id || null
}

// Count super admins for a business (NEW FUNCTION)
export async function getSuperAdminCount(businessId: string): Promise<number> {
  const supabase = createAdminClient()
  
  const { count, error } = await supabase
    .from('team_members')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('status', 'active')
    .eq('role_id', supabase
      .from('business_roles')
      .select('id')
      .eq('business_id', businessId)
      .eq('role_key', 'super_admin')
      .single()
    )

  if (error) {
    console.error('Error counting super admins:', error)
    return 0
  }

  return count || 0
}

// Permission constants
export const PERMISSIONS = {
  // Menu permissions
  MENU_VIEW: 'menu:view',
  MENU_CREATE: 'menu:create',
  MENU_EDIT: 'menu:edit',
  MENU_DELETE: 'menu:delete',
  
  // Item permissions
  ITEM_VIEW: 'item:view',
  ITEM_CREATE: 'item:create',
  ITEM_EDIT: 'item:edit',
  ITEM_DELETE: 'item:delete',
  
  // QR permissions
  QR_VIEW: 'qr:view',
  QR_GENERATE: 'qr:generate',
  QR_DELETE: 'qr:delete',
  
  // Team permissions
  TEAM_VIEW: 'team:view',
  TEAM_INVITE: 'team:invite',
  TEAM_MANAGE: 'team:manage',
  
  // Analytics permissions
  ANALYTICS_VIEW: 'analytics:view',
  
  // Settings permissions
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT: 'settings:edit',
  
  // Billing permissions
  BILLING_VIEW: 'billing:view',
  BILLING_MANAGE: 'billing:manage',
}