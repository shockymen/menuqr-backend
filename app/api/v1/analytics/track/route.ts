import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  TrackingPayload,
  TrackScanPayload,
  TrackEventPayload,
  TrackSessionPayload,
  TrackingResponse
} from '@/types/analytics'
import {
  hashIP,
  detectDeviceType,
  getClientIP,
  isPartitionError,
  extractTimestampFromError,
  createPartitionForTimestamp
} from '@/lib/analytics-helpers'

// =====================================================
// POST - Track Analytics Event
// Public endpoint (no auth) - called from frontend
// Handles: QR scans, menu views, item views, sessions
// =====================================================

export async function POST(request: NextRequest): Promise<NextResponse<TrackingResponse>> {
  try {
    const payload: TrackingPayload = await request.json()

    // Get client info
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const deviceType = detectDeviceType(userAgent)

    // Route to appropriate handler
    switch (payload.type) {
      case 'scan':
        return await trackScan(payload, clientIP, userAgent, deviceType)
      case 'event':
        return await trackEvent(payload)
      case 'session':
        return await trackSession(payload, deviceType)
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid tracking type' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Analytics tracking error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// =====================================================
// TRACK QR SCAN
// =====================================================

async function trackScan(
  payload: TrackScanPayload,
  clientIP: string,
  userAgent: string,
  deviceType: 'mobile' | 'tablet' | 'desktop'
): Promise<NextResponse<TrackingResponse>> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const scanData = {
    business_id: payload.business_id,
    menu_id: payload.menu_id,
    qr_code_id: payload.qr_code_id || null,
    session_id: payload.session_id,
    location: payload.location || null,
    scanned_at: new Date().toISOString(),
    fallback_triggered: payload.fallback_triggered,
    requested_menu_id: payload.requested_menu_id || null,
    shown_menu_id: payload.shown_menu_id || null,
    fallback_reason: payload.fallback_reason || null,
    device_type: payload.device_type || deviceType,
    user_agent: userAgent,
    ip_address_hash: hashIP(clientIP),
    metadata: payload.metadata || {}
  }

  try {
    // Try to insert scan
    const { error } = await supabase.from('analytics_scans').insert(scanData)

    if (error) {
      // Check if partition error
      if (isPartitionError(error)) {
        console.log('Partition missing, creating dynamically...')

        // Extract timestamp and create partition
        const timestamp = extractTimestampFromError(error) || scanData.scanned_at
        const partitionCreated = await createPartitionForTimestamp(timestamp)

        if (partitionCreated) {
          // Retry insert
          const { error: retryError } = await supabase.from('analytics_scans').insert(scanData)

          if (retryError) {
            throw retryError
          }

          return NextResponse.json({
            success: true,
            partition_created: true,
            message: 'Scan tracked (partition created)'
          })
        } else {
          throw new Error('Failed to create partition')
        }
      } else {
        throw error
      }
    }

    // Success on first try
    return NextResponse.json({
      success: true,
      partition_created: false,
      message: 'Scan tracked'
    })
  } catch (error) {
    console.error('Error tracking scan:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to track scan' },
      { status: 500 }
    )
  }
}

// =====================================================
// TRACK EVENT (menu view, item view, etc.)
// =====================================================

async function trackEvent(
  payload: TrackEventPayload
): Promise<NextResponse<TrackingResponse>> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const eventData = {
    business_id: payload.business_id,
    session_id: payload.session_id,
    event_type: payload.event_type,
    occurred_at: new Date().toISOString(),
    menu_id: payload.menu_id || null,
    item_id: payload.item_id || null,
    category_id: payload.category_id || null,
    location: payload.location || null,
    metadata: payload.metadata || {}
  }

  try {
    // Try to insert event
    const { error } = await supabase.from('analytics_events').insert(eventData)

    if (error) {
      // Check if partition error
      if (isPartitionError(error)) {
        console.log('Partition missing for event, creating dynamically...')

        // Extract timestamp and create partition
        const timestamp = extractTimestampFromError(error) || eventData.occurred_at
        const partitionCreated = await createPartitionForTimestamp(timestamp)

        if (partitionCreated) {
          // Retry insert
          const { error: retryError } = await supabase.from('analytics_events').insert(eventData)

          if (retryError) {
            throw retryError
          }

          return NextResponse.json({
            success: true,
            partition_created: true,
            message: 'Event tracked (partition created)'
          })
        } else {
          throw new Error('Failed to create partition')
        }
      } else {
        throw error
      }
    }

    // Success on first try
    return NextResponse.json({
      success: true,
      partition_created: false,
      message: 'Event tracked'
    })
  } catch (error) {
    console.error('Error tracking event:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to track event' },
      { status: 500 }
    )
  }
}

// =====================================================
// TRACK SESSION (start, update, end)
// =====================================================

async function trackSession(
  payload: TrackSessionPayload,
  deviceType: 'mobile' | 'tablet' | 'desktop'
): Promise<NextResponse<TrackingResponse>> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    if (payload.action === 'start') {
      // Create new session
      const sessionData = {
        business_id: payload.business_id,
        session_id: payload.session_id,
        started_at: new Date().toISOString(),
        menu_id: payload.menu_id || null,
        location: payload.location || null,
        device_type: payload.device_type || deviceType,
        metadata: payload.metadata || {}
      }

      const { error } = await supabase.from('analytics_sessions').insert(sessionData)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Session started'
      })
    } else if (payload.action === 'update') {
      // Update existing session (update updated_at timestamp)
      const { error } = await supabase
        .from('analytics_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('session_id', payload.session_id)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Session updated'
      })
    } else if (payload.action === 'end') {
      // End session (set ended_at, calculate duration)
      const now = new Date()

      // Get session start time
      const { data: session } = await supabase
        .from('analytics_sessions')
        .select('started_at')
        .eq('session_id', payload.session_id)
        .single()

      if (session) {
        const startTime = new Date(session.started_at)
        const durationSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000)

        const { error } = await supabase
          .from('analytics_sessions')
          .update({
            ended_at: now.toISOString(),
            duration_seconds: durationSeconds
          })
          .eq('session_id', payload.session_id)

        if (error) throw error
      }

      return NextResponse.json({
        success: true,
        message: 'Session ended'
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid session action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error tracking session:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to track session' },
      { status: 500 }
    )
  }
}