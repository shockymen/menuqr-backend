import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isMenuAvailable } from '@/lib/time-utils'

// Helper function to format dates without timezone shifts
function formatDateOnly(dateString: string): string {
  // Parse date parts directly to avoid timezone issues
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day) // month is 0-indexed
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// GET - Public menu by slug (no auth required - for QR scans)
// Slug can be either menu slug OR business slug (backwards compatible)
// Implements time-based scheduling with is_time_restricted-aware fallback logic
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const params = await context.params
    const slug = params.slug
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Try to get menu by slug first
    const { data: requestedMenu } = await supabase
      .from('menus')
      .select('id, business_id, name, slug, description, location, is_time_restricted, available_from, available_to, days_of_week, start_date, end_date, active_dates, priority')
      .eq('slug', slug)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single()

    let business: {
      id: string
      name: string
      display_name: string
      slug: string
      description: string | null
      logo_url: string | null
      city: string | null
      country: string | null
      phone: string | null
      address: string | null
      timezone: string | null
    } | null = null
    let menuId
    let menuData
    let fallbackInfo = null

    if (requestedMenu) {
      // Get business details (including timezone)
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('id, name, display_name, slug, description, logo_url, city, country, phone, address, timezone')
        .eq('id', requestedMenu.business_id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .single()

      if (businessError || !businessData) {
        return NextResponse.json(
          { error: 'Business not found' },
          { status: 404 }
        )
      }
      business = businessData

      // Menu slug found - check if available based on time/date using BUSINESS timezone
      const schedule = {
        is_time_restricted: requestedMenu.is_time_restricted || false,
        available_from: requestedMenu.available_from,
        available_to: requestedMenu.available_to,
        days_of_week: requestedMenu.days_of_week || [0,1,2,3,4,5,6],
        timezone: business.timezone || 'UTC',
        start_date: requestedMenu.start_date,
        end_date: requestedMenu.end_date,
        active_dates: requestedMenu.active_dates,
        priority: requestedMenu.priority || 0
      }

      const isAvailable = isMenuAvailable(schedule)

      if (isAvailable) {
        // Requested menu is available - use it
        menuId = requestedMenu.id
        menuData = requestedMenu
      } else {
        // Requested menu unavailable - find fallback with is_time_restricted-aware logic
        console.log(`Menu ${requestedMenu.name} not currently available, finding fallback...`)
        
        const { data: allMenus } = await supabase
          .from('menus')
          .select('id, name, slug, description, location, is_time_restricted, available_from, available_to, days_of_week, start_date, end_date, active_dates, priority')
          .eq('business_id', requestedMenu.business_id)
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('display_order', { ascending: true })

        let fallbackMenu = null
        const requestedLocation = requestedMenu.location || 'general'
        const requestedIsTimeRestricted = requestedMenu.is_time_restricted

        // STEP 1: Try same location menus
        console.log(`Looking for fallback in same location: ${requestedLocation}`)
        const sameLocationMenus = allMenus?.filter(m => 
          m.location === requestedLocation && 
          m.id !== requestedMenu.id
        ).sort((a, b) => {
          // Sort by priority (higher first)
          const priorityA = a.priority || 0
          const priorityB = b.priority || 0
          return priorityB - priorityA
        })

        fallbackMenu = sameLocationMenus?.find(m => {
          const fallbackSchedule = {
            is_time_restricted: m.is_time_restricted || false,
            available_from: m.available_from,
            available_to: m.available_to,
            days_of_week: m.days_of_week || [0,1,2,3,4,5,6],
            timezone: business!.timezone || 'UTC',
            start_date: m.start_date,
            end_date: m.end_date,
            active_dates: m.active_dates,
            priority: m.priority || 0
          }
          return isMenuAvailable(fallbackSchedule)
        })

        // STEP 2: If no same-location menu AND requested was time-restricted → LOCATION CLOSED
        if (!fallbackMenu && requestedIsTimeRestricted && requestedLocation !== 'general') {
          console.log(`No available menus in location '${requestedLocation}' - location is closed`)
          
          // Build availability message
          let availabilityMsg = ''
          if (schedule.active_dates && schedule.active_dates.length > 0) {
            const dates = schedule.active_dates
              .map((d: string) => formatDateOnly(d))
              .join(', ')
            availabilityMsg = `Available on ${dates}`
          } else if (schedule.start_date || schedule.end_date) {
            const start = schedule.start_date 
              ? formatDateOnly(schedule.start_date)
              : 'now'
            const end = schedule.end_date 
              ? formatDateOnly(schedule.end_date)
              : 'ongoing'
            availabilityMsg = `${start} - ${end}`
          } else if (schedule.available_from && schedule.available_to) {
            availabilityMsg = `${schedule.available_from.slice(0,5)} - ${schedule.available_to.slice(0,5)}`
          }
          
          return NextResponse.json({
            error: 'Location closed',
            message: `${requestedMenu.name} is not currently available.`,
            location: requestedLocation.charAt(0).toUpperCase() + requestedLocation.slice(1),
            availability: availabilityMsg,
            status: 'closed'
          }, { status: 403 })
        }

        // STEP 3: If requested was NOT time-restricted, try general location as fallback
        if (!fallbackMenu && !requestedIsTimeRestricted && requestedLocation !== 'general') {
          console.log('Service menu unavailable, trying general location')
          const generalMenus = allMenus?.filter(m => m.location === 'general')
            .sort((a, b) => {
              const priorityA = a.priority || 0
              const priorityB = b.priority || 0
              return priorityB - priorityA
            })

          fallbackMenu = generalMenus?.find(m => {
            const fallbackSchedule = {
              is_time_restricted: m.is_time_restricted || false,
              available_from: m.available_from,
              available_to: m.available_to,
              days_of_week: m.days_of_week || [0,1,2,3,4,5,6],
              timezone: business!.timezone || 'UTC',
              start_date: m.start_date,
              end_date: m.end_date,
              active_dates: m.active_dates,
              priority: m.priority || 0
            }
            return isMenuAvailable(fallbackSchedule)
          })
        }

        // STEP 4: If still nothing (shouldn't happen for general menus)
        if (!fallbackMenu) {
          return NextResponse.json({
            error: 'No menus currently available',
            message: 'All menus are currently closed. Please check back during operating hours.'
          }, { status: 403 })
        }

        // Use fallback menu
        console.log(`Using fallback menu: ${fallbackMenu.name} (location: ${fallbackMenu.location})`)
        menuId = fallbackMenu.id
        menuData = fallbackMenu
        
        // Build fallback message
        let availabilityMsg = ''
        if (schedule.active_dates && schedule.active_dates.length > 0) {
          const dates = schedule.active_dates
            .map((d: string) => formatDateOnly(d))
            .join(', ')
          availabilityMsg = `Available on ${dates}`
        } else if (schedule.start_date || schedule.end_date) {
          const start = schedule.start_date 
            ? formatDateOnly(schedule.start_date)
            : 'now'
          const end = schedule.end_date 
            ? formatDateOnly(schedule.end_date)
            : 'ongoing'
          availabilityMsg = `Available ${start} - ${end}`
        } else if (schedule.available_from && schedule.available_to) {
          availabilityMsg = `Available ${schedule.available_from.slice(0,5)} - ${schedule.available_to.slice(0,5)}`
        }
        
        fallbackInfo = {
          requested_menu: requestedMenu.name,
          requested_availability: availabilityMsg,
          showing_menu: fallbackMenu.name,
          message: `${requestedMenu.name} is not currently available. ${availabilityMsg}. Showing ${fallbackMenu.name}.`
        }
      }
    } else {
      // Try business slug (backwards compatibility)
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('id, name, display_name, slug, description, logo_url, city, country, phone, address, timezone')
        .eq('slug', slug)
        .eq('is_active', true)
        .is('deleted_at', null)
        .single()

      if (businessError || !businessData) {
        return NextResponse.json(
          { error: 'Menu not found' },
          { status: 404 }
        )
      }
      business = businessData

      // Get first available menu for this business (priority-sorted)
      const { data: allMenus } = await supabase
        .from('menus')
        .select('id, name, slug, description, location, is_time_restricted, available_from, available_to, days_of_week, start_date, end_date, active_dates, priority')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('display_order', { ascending: true })

      // Find highest priority available menu
      const availableMenu = allMenus
        ?.sort((a, b) => {
          // Sort by priority first (higher first)
          const priorityA = a.priority || 0
          const priorityB = b.priority || 0
          if (priorityB !== priorityA) return priorityB - priorityA
          
          // Then by time restriction (non-restricted first)
          if (!a.is_time_restricted && b.is_time_restricted) return -1
          if (a.is_time_restricted && !b.is_time_restricted) return 1
          return 0
        })
        .find(m => {
          const schedule = {
            is_time_restricted: m.is_time_restricted || false,
            available_from: m.available_from,
            available_to: m.available_to,
            days_of_week: m.days_of_week || [0,1,2,3,4,5,6],
            timezone: business!.timezone || 'UTC',
            start_date: m.start_date,
            end_date: m.end_date,
            active_dates: m.active_dates,
            priority: m.priority || 0
          }
          return isMenuAvailable(schedule)
        })

      if (!availableMenu) {
        return NextResponse.json({
          error: 'No menus currently available',
          message: 'Please check back during operating hours'
        }, { status: 403 })
      }

      menuId = availableMenu.id
      menuData = availableMenu
    }

    // Get template settings (menu-specific or business default)
    let template
    if (menuId) {
      const { data: menuTemplate } = await supabase
        .from('business_templates')
        .select('*')
        .eq('business_id', business!.id)
        .eq('menu_id', menuId)
        .single()

      if (menuTemplate) {
        template = menuTemplate
      }
    }

    if (!template) {
      const { data: businessTemplate } = await supabase
        .from('business_templates')
        .select('*')
        .eq('business_id', business!.id)
        .is('menu_id', null)
        .single()

      template = businessTemplate
    }

    // Get categories
    const { data: categories } = await supabase
      .from('categories')
      .select('*')
      .eq('business_id', business!.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })

    // Get menu items
    let items = []
    if (menuId) {
      const { data: itemsData } = await supabase
        .from('menu_items')
        .select('*')
        .eq('menu_id', menuId)
        .eq('is_available', true)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })

      items = itemsData || []
    }

    // Get all currently available menus for navigation
    const { data: allMenus } = await supabase
      .from('menus')
      .select('id, name, slug, description, location, is_time_restricted, available_from, available_to, days_of_week, start_date, end_date, active_dates, priority')
      .eq('business_id', business!.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })

    const availableMenus = allMenus?.filter(m => {
      const schedule = {
        is_time_restricted: m.is_time_restricted || false,
        available_from: m.available_from,
        available_to: m.available_to,
        days_of_week: m.days_of_week || [0,1,2,3,4,5,6],
        timezone: business!.timezone || 'UTC',
        start_date: m.start_date,
        end_date: m.end_date,
        active_dates: m.active_dates,
        priority: m.priority || 0
      }
      return isMenuAvailable(schedule)
    }).map(m => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      description: m.description
    }))

    return NextResponse.json({
      data: {
        business: {
          id: business!.id,
          name: business!.name,
          display_name: business!.display_name,
          slug: business!.slug,
          description: business!.description,
          logo_url: business!.logo_url,
          city: business!.city,
          country: business!.country,
          phone: business!.phone,
          address: business!.address
        },
        menu: menuData ? {
          id: menuData.id,
          name: menuData.name,
          slug: menuData.slug,
          description: menuData.description
        } : null,
        fallback: fallbackInfo,
        template: template || { 
          template_name: 'modern-minimal',
          primary_color: '#ffc107',
          secondary_color: '#212529',
          accent_color: '#28a745'
        },
        menus: availableMenus || [],
        categories: categories || [],
        items: items
      }
    })

  } catch (error) {
    console.error('Public menu error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}