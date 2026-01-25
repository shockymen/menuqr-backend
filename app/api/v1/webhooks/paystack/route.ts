import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST - Paystack webhook handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(body)
      .digest('hex')

    const signature = request.headers.get('x-paystack-signature')

    // Verify webhook signature
    if (hash !== signature) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(body)
    const supabase = createServerClient()

    console.log('Paystack webhook event:', event.event)

    // Handle different event types
    switch (event.event) {
      case 'charge.success': {
        const data = event.data
        const metadata = data.metadata

        if (!metadata?.business_id || !metadata?.plan_id) {
          console.error('Missing metadata in charge success')
          break
        }

        // Get plan details
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('id', metadata.plan_id)
          .single()

        if (!plan) {
          console.error('Plan not found:', metadata.plan_id)
          break
        }

        // Calculate subscription dates
        const now = new Date()
        const trialDays = metadata.trial_days || plan.trial_days || 14
        const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)
        
        // Billing period (30 days for monthly)
        const currentPeriodEnd = new Date(trialEndsAt.getTime() + 30 * 24 * 60 * 60 * 1000)

        // Create or update subscription
        const { error } = await supabase
          .from('subscriptions')
          .upsert({
            business_id: metadata.business_id,
            plan_id: metadata.plan_id,
            paystack_reference: data.reference,
            paystack_customer_code: data.customer?.customer_code,
            status: 'trialing',
            amount: plan.price,
            currency: data.currency,
            billing_interval: plan.billing_interval,
            current_period_start: now.toISOString(),
            current_period_end: currentPeriodEnd.toISOString(),
            trial_ends_at: trialEndsAt.toISOString(),
            trial_days: trialDays,
            billing_email: data.customer?.email,
            last_four: data.authorization?.last4,
            card_brand: data.authorization?.brand,
            started_at: now.toISOString(),
            invoice_count: 1,
            updated_at: now.toISOString()
          }, {
            onConflict: 'business_id'
          })

        if (error) {
          console.error('Failed to create subscription:', error)
        } else {
          console.log('Subscription created for business:', metadata.business_id)
        }
        break
      }

      case 'subscription.create': {
        const subscription = event.data
        console.log('Subscription created:', subscription.subscription_code)
        
        // Update with Paystack subscription code
        await supabase
          .from('subscriptions')
          .update({
            paystack_subscription_code: subscription.subscription_code,
            paystack_email_token: subscription.email_token,
            updated_at: new Date().toISOString()
          })
          .eq('paystack_customer_code', subscription.customer.customer_code)
        break
      }

      case 'subscription.disable': {
        const subscription = event.data
        console.log('Subscription disabled:', subscription.subscription_code)

        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('paystack_subscription_code', subscription.subscription_code)
        break
      }

      case 'invoice.payment_failed': {
        const data = event.data
        console.log('Payment failed for invoice:', data.invoice_code)

        await supabase
          .from('subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString()
          })
          .eq('paystack_customer_code', data.customer?.customer_code)

        // TODO: Send email notification to business owner
        break
      }

      default:
        console.log('Unhandled webhook event:', event.event)
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
