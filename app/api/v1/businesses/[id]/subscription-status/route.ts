import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET - Check current subscription status
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    
    // Authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify business ownership
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('user_id')
      .eq('id', params.id)
      .single()

    if (bizError || !business || business.user_id !== user.id) {
      return NextResponse.json({ error: 'Business not found or forbidden' }, { status: 403 })
    }

    // Get active subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        *,
        subscription_plans (
          id,
          name,
          slug,
          price,
          currency,
          features,
          limits
        )
      `)
      .eq('business_id', params.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (subError && subError.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('Get subscription error:', subError)
      return NextResponse.json(
        { error: 'Failed to fetch subscription' },
        { status: 500 }
      )
    }

    // Calculate status details
    const now = new Date()
    const trialEndsAt = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null
    const currentPeriodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null

    const isTrialing = subscription?.status === 'trialing' && trialEndsAt && trialEndsAt > now
    const isActive = subscription?.status === 'active'
    const daysUntilTrialEnd = trialEndsAt ? Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
    const daysUntilRenewal = currentPeriodEnd ? Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null

    return NextResponse.json({ 
      data: {
        has_active_subscription: !!(isTrialing || isActive),
        subscription: subscription || null,
        status: {
          is_trialing: isTrialing,
          is_active: isActive,
          days_until_trial_end: daysUntilTrialEnd,
          days_until_renewal: daysUntilRenewal,
          needs_payment: subscription?.status === 'past_due'
        }
      }
    })

  } catch (error) {
    console.error('Get subscription status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
