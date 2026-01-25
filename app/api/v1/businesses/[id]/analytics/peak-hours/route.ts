import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ApiResponse, PeakHoursResponse, PeakHoursData } from '@/types/api'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/v1/businesses/:id/analytics/peak-hours
// Get peak hours analytics for a business
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    
    // Authentication
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json<ApiResponse>({
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
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token'
        }
      }, { status: 401 })
    }

    // Get query parameters for date range
    const { searchParams } = new URL(request.url)
    const daysParam = searchParams.get('days') || '30'
    const days = parseInt(daysParam, 10)

    if (isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'days parameter must be between 1 and 365'
        }
      }, { status: 400 })
    }

    // Verify business ownership
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, user_id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (businessError || !business) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'NOT_FOUND',
          message: 'Business not found or you do not have permission'
        }
      }, { status: 404 })
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get menu views for the date range
    const { data: menuViews, error: viewsError } = await supabase
      .from('menu_views')
      .select('viewed_at')
      .eq('business_id', params.id)
      .gte('viewed_at', startDate.toISOString())
      .lte('viewed_at', endDate.toISOString())

    if (viewsError) {
      console.error('Menu views query error:', viewsError)
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'QUERY_FAILED',
          message: 'Failed to fetch analytics data',
          details: viewsError.message
        }
      }, { status: 500 })
    }

    // Group views by hour (0-23)
    const hourCounts: Record<number, number> = {}
    for (let i = 0; i < 24; i++) {
      hourCounts[i] = 0
    }

    if (menuViews) {
      for (const view of menuViews) {
        const viewDate = new Date(view.viewed_at)
        const hour = viewDate.getHours()
        hourCounts[hour]++
      }
    }

    // Convert to array format
    const peakHoursData: PeakHoursData[] = Object.entries(hourCounts).map(([hour, count]) => ({
      hour: parseInt(hour, 10),
      count
    }))

    // Find busiest hour
    let busiestHour = { hour: 0, count: 0 }
    for (const data of peakHoursData) {
      if (data.count > busiestHour.count) {
        busiestHour = { hour: data.hour, count: data.count }
      }
    }

    const response: PeakHoursResponse = {
      business_id: params.id,
      date_range: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      peak_hours: peakHoursData,
      total_views: menuViews?.length || 0,
      busiest_hour: busiestHour
    }

    return NextResponse.json<ApiResponse<PeakHoursResponse>>({
      data: response
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Peak hours analytics error:', errorMessage)
    
    return NextResponse.json<ApiResponse>({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}