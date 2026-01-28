import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isSuperAdmin, hasPermission, PERMISSIONS } from '@/lib/team-helpers'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// DELETE /api/v1/businesses/[id]/languages/[code]
// Remove a language
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; code: string }> }
) {
  try {
    const params = await context.params
    const businessId = params.id
    const languageCode = params.code

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

    // 2. Check permissions
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

    // 3. Get language
    const { data: language, error: langError } = await supabase
      .from('languages')
      .select('*')
      .eq('business_id', businessId)
      .eq('language_code', languageCode)
      .single()

    if (langError || !language) {
      return NextResponse.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Language not found'
        }
      }, { status: 404 })
    }

    // 4. Prevent deleting default language
    if (language.is_default) {
      return NextResponse.json({
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot delete the default language. Set another language as default first.'
        }
      }, { status: 403 })
    }

    // 5. Delete language (translations will be cascaded)
    const { error: deleteError } = await supabase
      .from('languages')
      .delete()
      .eq('id', language.id)

    if (deleteError) {
      console.error('Delete language error:', deleteError)
      return NextResponse.json({
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete language',
          details: deleteError.message
        }
      }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        message: `${language.language_name} removed successfully`,
        deleted_code: languageCode
      }
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Delete language error:', errorMessage)
    
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}