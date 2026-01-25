import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET - List all active subscription plans (public endpoint)
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()

    // Get all active plans
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('id, name, slug, description, price, currency, billing_interval, features, limits, trial_days, is_featured, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Get plans error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch plans' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      data: plans || [],
      count: plans?.length || 0
    })

  } catch (error) {
    console.error('Get plans error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
