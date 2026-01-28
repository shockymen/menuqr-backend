/** 
 * This checks if a business has reached its subscription limits.
 * 
 * Usage:
 *   const check = await checkSubscriptionLimit(businessId, 'menus')
 *   if (!check.allowed) {
 *     return error response
 *   }
 */

import { createClient } from '@supabase/supabase-js'

export type ResourceType = 'menus' | 'items' | 'qr_codes' | 'team_members'

export interface SubscriptionCheckResult {
  allowed: boolean
  error?: {
    code: string
    message: string
    details?: {
      resource: string
      limit: number
      current: number
      current_plan: string
      upgrade_url: string
    }
  }
}

// Type for plan limits
interface PlanLimits {
  max_menus?: number
  max_menu_items?: number
  max_qr_codes?: number
  max_team_members?: number
}

// Type for subscription plan
interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  limits: PlanLimits
}

/**
 * Main function - checks if business can create more resources
 */
export async function checkSubscriptionLimit(
  businessId: string,
  resource: ResourceType
): Promise<SubscriptionCheckResult> {
  
  try {
    // Create admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    )

    // STEP 1: Get active subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        status,
        current_period_start,
        current_period_end,
        plan:subscription_plans(
          id,
          name,
          slug,
          limits
        )
      `)
      .eq('business_id', businessId)
      .in('status', ['active', 'trial'])
      .gte('current_period_end', new Date().toISOString())  // Not expired
      .lte('current_period_start', new Date().toISOString())  // Already started
      .single()

    // No subscription? Block action
    if (subError || !subscription) {
      return {
        allowed: false,
        error: {
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'An active subscription is required to perform this action',
          details: {
            resource,
            limit: 0,
            current: 0,
            current_plan: 'none',
            upgrade_url: 'https://menuqr.africa/pricing'
          }
        }
      }
    }

    // Get plan (handle Supabase join - returns array or object)
    const planData = subscription.plan as unknown as SubscriptionPlan[] | SubscriptionPlan
    const plan: SubscriptionPlan = Array.isArray(planData) ? planData[0] : planData

    if (!plan) {
      return {
        allowed: false,
        error: {
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'No subscription plan found',
          details: {
            resource,
            limit: 0,
            current: 0,
            current_plan: 'none',
            upgrade_url: 'https://menuqr.africa/pricing'
          }
        }
      }
    }

    // STEP 2: Get current count and limit
    let currentCount = 0
    let limit = Infinity

    switch (resource) {
      case 'menus':
        const { count: menuCount } = await supabase
          .from('menus')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .is('deleted_at', null)
        
        currentCount = menuCount || 0
        limit = plan.limits?.max_menus ?? Infinity
        break

      case 'items':
        const { count: itemCount } = await supabase
          .from('menu_items')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .is('deleted_at', null)
        
        currentCount = itemCount || 0
        limit = plan.limits?.max_menu_items ?? Infinity
        break

      case 'qr_codes':
        const { count: qrCount } = await supabase
          .from('qr_codes')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .is('deleted_at', null)
        
        currentCount = qrCount || 0
        limit = plan.limits?.max_qr_codes ?? Infinity
        break

      case 'team_members':
        const { count: teamCount } = await supabase
          .from('team_members')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .eq('status', 'active')
        
        currentCount = teamCount || 0
        limit = plan.limits?.max_team_members ?? Infinity
        break
    }

    // STEP 3: Check if limit exceeded
    if (limit !== Infinity && currentCount >= limit) {
      return {
        allowed: false,
        error: {
          code: 'LIMIT_EXCEEDED',
          message: `You've reached the maximum number of ${resource} for your ${plan.name} plan (${currentCount}/${limit})`,
          details: {
            resource,
            limit,
            current: currentCount,
            current_plan: plan.name,
            upgrade_url: 'https://menuqr.africa/pricing'
          }
        }
      }
    }

    // Allow!
    return { allowed: true }

  } catch (error) {
    console.error('Subscription check error:', error)
    // Fail open - allow on error for better UX
    return { allowed: true }
  }
}