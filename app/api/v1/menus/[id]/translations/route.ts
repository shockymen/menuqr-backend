import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isSuperAdmin, hasPermission, PERMISSIONS } from '@/lib/team-helpers'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface MenuTranslationBody {
  language_code: string
  name: string
  description?: string
}

// POST /api/v1/menus/[id]/translations
// Add or update menu translation
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const menuId = params.id

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

    // 2. Verify menu exists and get business_id
    const { data: menu, error: menuError } = await supabase
      .from('menus')
      .select('id, business_id, name')
      .eq('id', menuId)
      .single()

    if (menuError || !menu) {
      return NextResponse.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Menu not found'
        }
      }, { status: 404 })
    }

    // 3. Check permissions
    const isAdmin = await isSuperAdmin(menu.business_id, user.id)
    const canEdit = isAdmin || await hasPermission(menu.business_id, user.id, PERMISSIONS.MENU_EDIT)

    if (!canEdit) {
      return NextResponse.json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to edit menu translations'
        }
      }, { status: 403 })
    }

    // 4. Parse request body
    const body = await request.json() as MenuTranslationBody

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
      .eq('business_id', menu.business_id)
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
      .from('menu_translations')
      .upsert({
        menu_id: menuId,
        language_code: body.language_code.toLowerCase(),
        name: body.name,
        description: body.description || null
      }, {
        onConflict: 'menu_id,language_code'
      })
      .select()
      .single()

    if (transError) {
      console.error('Upsert menu translation error:', transError)
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
    console.error('Menu translation error:', errorMessage)
    
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}

// GET /api/v1/menus/[id]/translations
// Get all translations for a menu
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const menuId = params.id

    const supabase = createServerClient()

    // Verify menu exists
    const { data: menu, error: menuError } = await supabase
      .from('menus')
      .select('id, name')
      .eq('id', menuId)
      .single()

    if (menuError || !menu) {
      return NextResponse.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Menu not found'
        }
      }, { status: 404 })
    }

    // Get translations
    const { data: translations, error: transError } = await supabase
      .from('menu_translations')
      .select('*')
      .eq('menu_id', menuId)
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
    console.error('Get menu translations error:', errorMessage)
    
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}