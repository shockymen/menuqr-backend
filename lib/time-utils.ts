// lib/time-utils.ts

interface TimeSchedule {
  is_time_restricted: boolean
  available_from: string | null
  available_to: string | null
  days_of_week: number[]
  timezone: string
  start_date: string | null
  end_date: string | null
  active_dates: string[] | null
  priority: number
}

/**
 * Check if today falls within the menu's date restrictions
 */
function isDateAvailable(schedule: TimeSchedule, currentDate: Date): boolean {
  // If no date restrictions, available every day
  if (!schedule.start_date && !schedule.end_date && (!schedule.active_dates || schedule.active_dates.length === 0)) {
    return true
  }

  const today = currentDate.toISOString().split('T')[0] // YYYY-MM-DD format

  // Check specific dates (e.g., Valentine's Day, Christmas)
  if (schedule.active_dates && schedule.active_dates.length > 0) {
    return schedule.active_dates.some(date => date === today)
  }

  // Check date range (e.g., Dec 24-26 for Christmas weekend)
  if (schedule.start_date || schedule.end_date) {
    const start = schedule.start_date || '1900-01-01'
    const end = schedule.end_date || '2100-12-31'
    return today >= start && today <= end
  }

  return true
}

/**
 * Check if a menu is currently available based on time and date restrictions
 */
export function isMenuAvailable(schedule: TimeSchedule): boolean {
  try {
    // Get current date/time in the menu's timezone
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: schedule.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'short'
    })

    const parts = formatter.formatToParts(now)
    const year = parts.find(p => p.type === 'year')?.value
    const month = parts.find(p => p.type === 'month')?.value
    const day = parts.find(p => p.type === 'day')?.value
    const currentTime = `${parts.find(p => p.type === 'hour')?.value}:${parts.find(p => p.type === 'minute')?.value}:${parts.find(p => p.type === 'second')?.value}`
    
    const currentDate = new Date(`${year}-${month}-${day}`)

    // Check date availability first
    if (!isDateAvailable(schedule, currentDate)) {
      return false
    }

    // If not time-restricted, available all day (if date is valid)
    if (!schedule.is_time_restricted) {
      return true
    }

    // If time-restricted but no times set, assume unavailable
    if (!schedule.available_from || !schedule.available_to) {
      return false
    }

    // Get current day of week (0 = Sunday, 6 = Saturday)
    const dayStr = parts.find(p => p.type === 'weekday')?.value
    const dayMap: { [key: string]: number } = {
      'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
    }
    const currentDay = dayMap[dayStr || 'Sun']

    // Check if current day is in allowed days
    if (!schedule.days_of_week.includes(currentDay)) {
      return false
    }

    // Parse times for comparison
    const [currentHour, currentMinute] = currentTime.split(':').map(Number)
    const [fromHour, fromMinute] = schedule.available_from.split(':').map(Number)
    const [toHour, toMinute] = schedule.available_to.split(':').map(Number)

    const currentMinutes = currentHour * 60 + currentMinute
    const fromMinutes = fromHour * 60 + fromMinute
    const toMinutes = toHour * 60 + toMinute

    // Handle overnight hours (e.g., 17:00 - 02:00 for bar)
    if (toMinutes < fromMinutes) {
      return currentMinutes >= fromMinutes || currentMinutes <= toMinutes
    } else {
      return currentMinutes >= fromMinutes && currentMinutes <= toMinutes
    }
  } catch (error) {
    console.error('Error checking menu availability:', error)
    // On error, return true to avoid blocking access
    return true
  }
}

/**
 * Get human-readable availability message
 */
export function getAvailabilityMessage(schedule: TimeSchedule): string {
  // Date-specific message
  if (schedule.active_dates && schedule.active_dates.length > 0) {
    const dates = schedule.active_dates
      .map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
      .join(', ')
    
    if (schedule.is_time_restricted && schedule.available_from && schedule.available_to) {
      const from = formatTime(schedule.available_from.slice(0, 5))
      const to = formatTime(schedule.available_to.slice(0, 5))
      return `Available ${dates} from ${from} to ${to}`
    }
    return `Available ${dates}`
  }

  // Date range message
  if (schedule.start_date || schedule.end_date) {
    const start = schedule.start_date 
      ? new Date(schedule.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) 
      : 'now'
    const end = schedule.end_date 
      ? new Date(schedule.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) 
      : 'ongoing'
    
    if (schedule.is_time_restricted && schedule.available_from && schedule.available_to) {
      const from = formatTime(schedule.available_from.slice(0, 5))
      const to = formatTime(schedule.available_to.slice(0, 5))
      return `Available ${start} - ${end}, ${from} - ${to}`
    }
    return `Available ${start} - ${end}`
  }

  // Time-only message
  if (schedule.is_time_restricted && schedule.available_from && schedule.available_to) {
    const from = formatTime(schedule.available_from.slice(0, 5))
    const to = formatTime(schedule.available_to.slice(0, 5))
    return `Available ${from} - ${to}`
  }

  return 'Available 24/7'
}

/**
 * Helper function to format time (24h to 12h)
 */
function formatTime(time: string): string {
  const [hour, minute] = time.split(':').map(Number)
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:${minute.toString().padStart(2, '0')}${period}`
}