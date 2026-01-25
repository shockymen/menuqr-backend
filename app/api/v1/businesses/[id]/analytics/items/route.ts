import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET - Popular menu items analytics
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const businessId = params.id
    
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
      .eq('id', businessId)
      .single()

    if (bizError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (business.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get time range
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const limit = parseInt(searchParams.get('limit') || '20')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get item views with menu item details
    const { data: views } = await supabase
      .from('item_views')
      .select('item_id, menu_items(name, description, price, category_id, categories(name))')
      .eq('business_id', businessId)
      .gte('viewed_at', startDate.toISOString())

    // Group by item
    const viewsByItem = views?.reduce((acc: any, view: any) => {
      const itemId = view.item_id
      if (!acc[itemId]) {
        acc[itemId] = {
          item_id: itemId,
          item_name: view.menu_items?.name || 'Unknown Item',
          description: view.menu_items?.description,
          price: view.menu_items?.price,
          category: view.menu_items?.categories?.name || 'Uncategorized',
          view_count: 0
        }
      }
      acc[itemId].view_count++
      return acc
    }, {})

    const popularItems = Object.values(viewsByItem || {})
      .sort((a: any, b: any) => b.view_count - a.view_count)
      .slice(0, limit)

    return NextResponse.json({ 
      data: {
        period_days: days,
        total_item_views: views?.length || 0,
        popular_items: popularItems
      }
    })

  } catch (error) {
    console.error('Popular items analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
