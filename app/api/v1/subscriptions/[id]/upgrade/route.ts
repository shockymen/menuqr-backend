import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST - Upgrade/downgrade subscription
// Note: Paystack doesn't support direct subscription upgrades via API
// User must complete new checkout for plan changes
export async function POST(
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

    const body = await request.json()
    const { new_plan_id } = body

    if (!new_plan_id) {
      return NextResponse.json(
        { error: 'new_plan_id is required' },
        { status: 400 }
      )
    }

    // Get current subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*, businesses(user_id, id)')
      .eq('id', params.id)
      .single()

    if (subError || !subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // Verify ownership
    if (subscription.businesses.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if subscription is active
    if (!['active', 'trialing'].includes(subscription.status)) {
      return NextResponse.json(
        { error: 'Can only upgrade active subscriptions' },
        { status: 400 }
      )
    }

    // Check if same plan
    if (subscription.plan_id === new_plan_id) {
      return NextResponse.json(
        { error: 'Already subscribed to this plan' },
        { status: 400 }
      )
    }

    // Get new plan details
    const { data: newPlan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', new_plan_id)
      .eq('is_active', true)
      .single()

    if (planError || !newPlan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Paystack doesn't support direct subscription upgrades via API
    // We'll mark current subscription for upgrade and return checkout URL
    // The webhook will handle the transition when new payment succeeds
    
    // Mark subscription as pending upgrade
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'pending_upgrade',
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)

    if (updateError) {
      console.error('Update subscription error:', updateError)
      return NextResponse.json(
        { error: 'Failed to prepare subscription upgrade' },
        { status: 500 }
      )
    }

    // Return instructions for creating new checkout
    return NextResponse.json({
      message: 'To complete the upgrade, please create a new checkout session with the new plan.',
      instructions: {
        step1: 'Call POST /api/v1/subscriptions/checkout',
        step2: 'Provide new_plan_id and business_id',
        step3: 'Complete payment to activate new plan'
      },
      new_plan: {
        id: newPlan.id,
        name: newPlan.name,
        price: newPlan.price,
        currency: newPlan.currency
      }
    })

  } catch (error) {
    console.error('Upgrade subscription error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
