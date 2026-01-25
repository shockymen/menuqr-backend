import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// DELETE - Delete QR code
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; qrId: string }> }
) {
  try {
    const params = await context.params
    
    // 1. Authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Verify business ownership
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('user_id')
      .eq('id', params.id)
      .single()

    if (bizError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (business.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. Check QR exists and belongs to business
    const { data: qrCode, error: qrError } = await supabase
      .from('qr_codes')
      .select('id, business_id')
      .eq('id', params.qrId)
      .eq('business_id', params.id)
      .is('deleted_at', null)
      .single()

    if (qrError || !qrCode) {
      return NextResponse.json({ error: 'QR code not found' }, { status: 404 })
    }

    // 4. Soft delete
    const { error: deleteError } = await supabase
      .from('qr_codes')
      .update({ 
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', params.qrId)

    if (deleteError) {
      console.error('Delete QR error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete QR code' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      message: 'QR code deleted successfully' 
    })

  } catch (error) {
    console.error('Delete QR code error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
