import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST - Create Paystack Checkout Session
export async function POST(request: NextRequest) {
  try {
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
    const { plan_id, business_id } = body

    if (!plan_id || !business_id) {
      return NextResponse.json(
        { error: 'plan_id and business_id are required' },
        { status: 400 }
      )
    }

    // Verify business ownership
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('id, user_id, name, email')
      .eq('id', business_id)
      .single()

    if (bizError || !business || business.user_id !== user.id) {
      return NextResponse.json({ error: 'Business not found or forbidden' }, { status: 403 })
    }

    // Get plan details with trial_days
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Check for existing subscription
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('business_id', business_id)
      .single()

    if (existingSub) {
      if (existingSub.status === 'active') {
        return NextResponse.json(
          { error: 'Business already has an active subscription. Use upgrade endpoint to change plans.' },
          { status: 400 }
        )
      }
    }

    // Convert price to smallest currency unit (pesewas for GHS)
    const amountInSmallestUnit = Math.round(parseFloat(plan.price) * 100)

    // Initialize Paystack transaction using REST API
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: business.email || user.email,
        amount: amountInSmallestUnit,
        currency: plan.currency || 'GHS',
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true`,
        metadata: {
          business_id: business_id,
          plan_id: plan_id,
          user_id: user.id,
          plan_name: plan.name,
          trial_days: plan.trial_days || 14
        },
        channels: ['card', 'mobile_money', 'bank']
      })
    })

    const paystackData = await paystackResponse.json()

    if (!paystackData.status) {
      console.error('Paystack initialization failed:', paystackData)
      return NextResponse.json(
        { error: paystackData.message || 'Failed to initialize payment' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: {
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paystackData.data.reference,
        trial_days: plan.trial_days || 14
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Checkout session error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
