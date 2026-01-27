// =====================================================
// ANALYTICS TYPES
// Purpose: TypeScript types for analytics tracking
// =====================================================

export interface TrackScanPayload {
  type: 'scan'
  business_id: string
  menu_id: string
  qr_code_id?: string
  session_id: string
  location?: string
  fallback_triggered: boolean
  requested_menu_id?: string
  shown_menu_id?: string
  fallback_reason?: string
  device_type?: 'mobile' | 'tablet' | 'desktop'
  user_agent?: string
  metadata?: Record<string, unknown>  // Changed from 'any' to 'unknown'
}

export interface TrackEventPayload {
  type: 'event'
  business_id: string
  session_id: string
  event_type: 'menu_view' | 'item_view' | 'category_click' | 'menu_switch'
  menu_id?: string
  item_id?: string
  category_id?: string
  location?: string
  metadata?: Record<string, unknown>  // Changed from 'any' to 'unknown'
}

export interface TrackSessionPayload {
  type: 'session'
  business_id: string
  session_id: string
  action: 'start' | 'update' | 'end'
  menu_id?: string
  location?: string
  device_type?: 'mobile' | 'tablet' | 'desktop'
  metadata?: Record<string, unknown>  // Changed from 'any' to 'unknown'
}

export type TrackingPayload = TrackScanPayload | TrackEventPayload | TrackSessionPayload

export interface TrackingResponse {
  success: boolean
  message?: string
  partition_created?: boolean
  error?: string
}