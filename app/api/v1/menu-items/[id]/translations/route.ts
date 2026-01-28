import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isSuperAdmin, hasPermission, PERMISSIONS } from '@/lib/team-helpers'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface ItemTranslationBody {
  language_code: string
  name: string
  description?: string
}

// POST /api/v1/menu-items/[id]/translations
// Add or update menu item translation
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const itemId = params.id

    // 1. Authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({
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
      return NextResponse.json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token'
        }
      }, { status: 401 })
    }

    // 2. Verify item exists and get business_id via menu
    const { data: item, error: itemError } = await supabase
      .from('menu_items')
      .select(`
        id,
        name,
        menu:menus (
          id,
          business_id
        )
      `)
      .eq('id', itemId)
      .single()

    if (itemError || !item) {
      return NextResponse.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Menu item not found'
        }
      }, { status: 404 })
    }

    const menu = Array.isArray(item.menu) ? item.menu[0] : item.menu
    const businessId = menu.business_id

    // 3. Check permissions
    const isAdmin = await isSuperAdmin(businessId, user.id)
    const canEdit = isAdmin || await hasPermission(businessId, user.id, PERMISSIONS.ITEM_EDIT)

    if (!canEdit) {
      return NextResponse.json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to edit item translations'
        }
      }, { status: 403 })
    }

    // 4. Parse request body
    const body = await request.json() as ItemTranslationBody

    if (!body.language_code || !body.name) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'language_code and name are required'
        }
      }, { status: 400 })
    }

    // 5. Verify language is supported by business
    const { data: language, error: langError } = await supabase
      .from('languages')
      .select('language_code, language_name')
      .eq('business_id', businessId)
      .eq('language_code', body.language_code.toLowerCase())
      .eq('is_active', true)
      .single()

    if (langError || !language) {
      return NextResponse.json({
        error: {
          code: 'NOT_FOUND',
          message: `Language '${body.language_code}' is not supported. Add it to your business first.`
        }
      }, { status: 404 })
    }

    // 6. Upsert translation (insert or update)
    const { data: translation, error: transError } = await supabase
      .from('menu_item_translations')
      .upsert({
        menu_item_id: itemId,
        language_code: body.language_code.toLowerCase(),
        name: body.name,
        description: body.description || null
      }, {
        onConflict: 'menu_item_id,language_code'
      })
      .select()
      .single()

    if (transError) {
      console.error('Upsert item translation error:', transError)
      return NextResponse.json({
        error: {
          code: 'UPSERT_FAILED',
          message: 'Failed to save translation',
          details: transError.message
        }
      }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        translation,
        message: `Translation added for ${language.language_name}`
      }
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Item translation error:', errorMessage)
    
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}

// GET /api/v1/menu-items/[id]/translations
// Get all translations for a menu item
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const itemId = params.id

    const supabase = createServerClient()

    // Verify item exists
    const { data: item, error: itemError } = await supabase
      .from('menu_items')
      .select('id, name')
      .eq('id', itemId)
      .single()

    if (itemError || !item) {
      return NextResponse.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Menu item not found'
        }
      }, { status: 404 })
    }

    // Get translations
    const { data: translations, error: transError } = await supabase
      .from('menu_item_translations')
      .select('*')
      .eq('menu_item_id', itemId)
      .order('language_code', { ascending: true })

    if (transError) {
      console.error('Fetch translations error:', transError)
      return NextResponse.json({
        error: {
          code: 'QUERY_FAILED',
          message: 'Failed to fetch translations',
          details: transError.message
        }
      }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        translations: translations || [],
        total: translations?.length || 0
      }
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Get item translations error:', errorMessage)
    
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}