import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isSuperAdmin, hasPermission, PERMISSIONS } from '@/lib/team-helpers'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface AddLanguageBody {
  language_code: string
  language_name: string
  is_default?: boolean
}

// GET /api/v1/businesses/[id]/languages
// List all languages for a business
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const businessId = params.id

    const supabase = createServerClient()

    // Verify business exists
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('id', businessId)
      .single()

    if (bizError || !business) {
      return NextResponse.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Business not found'
        }
      }, { status: 404 })
    }

    // Get languages
    const { data: languages, error: langError } = await supabase
      .from('languages')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('language_name', { ascending: true })

    if (langError) {
      console.error('Fetch languages error:', langError)
      return NextResponse.json({
        error: {
          code: 'QUERY_FAILED',
          message: 'Failed to fetch languages',
          details: langError.message
        }
      }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        languages: languages || [],
        total: languages?.length || 0
      }
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('List languages error:', errorMessage)
    
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}

// POST /api/v1/businesses/[id]/languages
// Add a new language
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const businessId = params.id

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

    // 2. Verify business exists
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('id', businessId)
      .single()

    if (bizError || !business) {
      return NextResponse.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Business not found'
        }
      }, { status: 404 })
    }

    // 3. Check permissions
    const isAdmin = await isSuperAdmin(businessId, user.id)
    const canEdit = isAdmin || await hasPermission(businessId, user.id, PERMISSIONS.SETTINGS_EDIT)

    if (!canEdit) {
      return NextResponse.json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to manage languages'
        }
      }, { status: 403 })
    }

    // 4. Parse request body
    const body = await request.json() as AddLanguageBody

    if (!body.language_code || !body.language_name) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'language_code and language_name are required'
        }
      }, { status: 400 })
    }

    // Validate language code format (2-3 letter ISO codes)
    if (!/^[a-z]{2,3}$/.test(body.language_code)) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid language_code format. Use ISO 639-1 codes (e.g., en, fr, es)'
        }
      }, { status: 400 })
    }

    // 5. Check if language already exists
    const { data: existing } = await supabase
      .from('languages')
      .select('id')
      .eq('business_id', businessId)
      .eq('language_code', body.language_code.toLowerCase())
      .single()

    if (existing) {
      return NextResponse.json({
        error: {
          code: 'CONFLICT',
          message: 'This language is already added'
        }
      }, { status: 409 })
    }

    // 6. Add language
    const { data: language, error: langError } = await supabase
      .from('languages')
      .insert({
        business_id: businessId,
        language_code: body.language_code.toLowerCase(),
        language_name: body.language_name,
        is_default: body.is_default || false,
        is_active: true
      })
      .select()
      .single()

    if (langError) {
      console.error('Add language error:', langError)
      return NextResponse.json({
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to add language',
          details: langError.message
        }
      }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        language,
        message: `${body.language_name} added successfully`
      }
    }, { status: 201 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Add language error:', errorMessage)
    
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}