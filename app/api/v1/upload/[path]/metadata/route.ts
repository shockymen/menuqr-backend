// app/api/v1/upload/[path]/metadata/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ApiResponse } from '@/types/api'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string }> }
) {
  try {
    const params = await context.params
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json<ApiResponse>({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json<ApiResponse>({
        error: { code: 'UNAUTHORIZED', message: 'Invalid token' }
      }, { status: 401 })
    }

    const filePath = decodeURIComponent(params.path)

    // Get file metadata from storage
    const { data: files, error } = await supabase.storage
      .from('menu-images')
      .list(filePath.split('/').slice(0, -1).join('/'), {
        search: filePath.split('/').pop()
      })

    if (error || !files || files.length === 0) {
      return NextResponse.json<ApiResponse>({
        error: { code: 'NOT_FOUND', message: 'File not found' }
      }, { status: 404 })
    }

    const file = files[0]
    
    return NextResponse.json<ApiResponse>({
      data: {
        name: file.name,
        size: file.metadata?.size || 0,
        mimetype: file.metadata?.mimetype || 'unknown',
        created_at: file.created_at,
        updated_at: file.updated_at
      }
    }, { status: 200 })

  } catch (error) {
    console.error('Get metadata error:', error)
    return NextResponse.json<ApiResponse>({
      error: { code: 'INTERNAL_ERROR', message: 'Internal error' }
    }, { status: 500 })
  }
}