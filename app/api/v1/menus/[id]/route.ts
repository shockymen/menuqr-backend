import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// TypeScript interfaces
interface Translation {
  name: string
  description: string | null
}

interface ItemTranslation extends Translation {
  menu_item_id: string
}

interface MenuItem {
  id: string
  name: string
  description: string | null
  price: number
  is_available: boolean
  [key: string]: unknown
} 

// GET /api/v1/menus/[id]?lang=fr
// Get menu with language-specific translations
// If lang is provided, returns translated content with fallback to original
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const menuId = params.id
    
    // Get language from query parameter (e.g., ?lang=fr)
    const { searchParams } = new URL(request.url)
    const requestedLang = searchParams.get('lang')?.toLowerCase() || 'en'

    console.log('🔍 Menu:', menuId, 'Lang:', requestedLang)

    const supabase = createServerClient()

    // 1. Get menu (simple query first)
    const { data: menu, error: menuError } = await supabase
      .from('menus')
      .select('*')
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

    // 2. If no specific language requested or lang=en, return original
    if (requestedLang === 'en') {
      return NextResponse.json({
        data: {
          menu,
          language: 'en'
        }
      }, { status: 200 })
    }

    // 3. Get menu translation
    const { data: menuTranslation } = await supabase
      .from('menu_translations')
      .select('name, description')
      .eq('menu_id', menuId)
      .eq('language_code', requestedLang)
      .single()

    console.log('📝 Translation found:', !!menuTranslation)

    // 4. Apply translation (fallback to original if no translation)
    const translatedMenu = {
      ...menu,
      name: menuTranslation?.name || menu.name,
      description: menuTranslation?.description || menu.description
    }

    return NextResponse.json({
      data: {
        menu: translatedMenu,
        language: requestedLang,
        translation_found: !!menuTranslation
      }
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('💥 Error:', errorMessage)
    
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: errorMessage
      }
    }, { status: 500 })
  }
}