import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// =====================================================
// ANALYTICS HELPER FUNCTIONS
// =====================================================

/**
 * Hash IP address for privacy-friendly tracking
 */
export function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex')
}

/**
 * Detect device type from user agent
 */
export function detectDeviceType(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
  const ua = userAgent.toLowerCase()
  
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet'
  }
  
  if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|android.*mobile/i.test(ua)) {
    return 'mobile'
  }
  
  return 'desktop'
}

/**
 * Check if error is a partition missing error
 */
export function isPartitionError(error: unknown): boolean {
  // Type guard to safely access error properties
  const message = error instanceof Error 
    ? error.message 
    : typeof error === 'string' 
      ? error 
      : String(error)
  
  return message.includes('no partition') || 
         message.includes('no partition of relation')
}

/**
 * Extract timestamp from partition error to know which partition to create
 */
export function extractTimestampFromError(error: unknown): string | null {
  // Type guard to safely access error properties
  const message = error instanceof Error 
    ? error.message 
    : typeof error === 'string' 
      ? error 
      : String(error)
  
  // Try to extract timestamp from error message
  const match = message.match(/\(scanned_at\) = \(([\d-: +]+)\)/) ||
                message.match(/\(occurred_at\) = \(([\d-: +]+)\)/)
  return match ? match[1] : null
}

/**
 * Create partition for a specific timestamp
 */
export async function createPartitionForTimestamp(
  timestamp: string
): Promise<boolean> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Need service role for creating partitions
  )
  
  try {
    const { data, error } = await supabase.rpc('create_partitions_for_date', {
      target_date: timestamp
    })
    
    if (error) {
      console.error('Error creating partition:', error)
      return false
    }
    
    console.log('Partition created:', data)
    return data?.success === true
  } catch (error) {
    console.error('Exception creating partition:', error)
    return false
  }
}

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string {
  // Try various headers (Vercel, Cloudflare, standard)
  const headers = request.headers
  return (
    headers.get('x-real-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('cf-connecting-ip') ||
    '0.0.0.0'
  )
}