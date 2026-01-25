// app/api/v1/invoices/[id]/download/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jsPDF } from 'jspdf'
import type { ApiResponse } from '@/types/api'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/v1/invoices/:id/download
// Download invoice as PDF (generated from your database)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json<ApiResponse>({
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
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token'
        }
      }, { status: 401 })
    }

    // Get invoice with business and subscription details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        subscriptions!inner(
          plan,
          business_id,
          businesses!inner(
            user_id,
            name,
            email,
            address,
            city,
            country
          )
        )
      `)
      .eq('id', params.id)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'NOT_FOUND',
          message: 'Invoice not found'
        }
      }, { status: 404 })
    }

    // Verify ownership
    const invoiceData = invoice as {
      id: string
      invoice_number: string
      amount: number
      currency: string
      status: string
      created_at: string
      due_date: string | null
      paid_at: string | null
      subscriptions: Array<{
        plan: string
        business_id: string
        businesses: Array<{
          user_id: string
          name: string
          email: string | null
          address: string | null
          city: string | null
          country: string | null
        }>
      }>
    }

    const subscription = invoiceData.subscriptions[0]
    const business = subscription.businesses[0]
    
    if (business.user_id !== user.id) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to download this invoice'
        }
      }, { status: 403 })
    }

    // Generate PDF invoice
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    // Header
    pdf.setFontSize(24)
    pdf.setTextColor(40, 40, 40)
    pdf.text('INVOICE', 20, 30)

    // Invoice details
    pdf.setFontSize(10)
    pdf.setTextColor(100, 100, 100)
    pdf.text(`Invoice #: ${invoiceData.invoice_number}`, 20, 45)
    pdf.text(`Date: ${new Date(invoiceData.created_at).toLocaleDateString()}`, 20, 51)
    pdf.text(`Status: ${invoiceData.status.toUpperCase()}`, 20, 57)

    // Business details
    pdf.setFontSize(12)
    pdf.setTextColor(40, 40, 40)
    pdf.text('Bill To:', 20, 75)
    pdf.setFontSize(10)
    pdf.text(business.name, 20, 82)
    if (business.email) pdf.text(business.email, 20, 88)
    if (business.address) pdf.text(business.address, 20, 94)
    if (business.city && business.country) {
      pdf.text(`${business.city}, ${business.country}`, 20, 100)
    }

    // Line items
    pdf.setFontSize(12)
    pdf.text('Items:', 20, 120)
    
    pdf.setFontSize(10)
    pdf.text('Description', 20, 130)
    pdf.text('Amount', 160, 130, { align: 'right' })
    
    // Draw line
    pdf.setDrawColor(200, 200, 200)
    pdf.line(20, 133, 190, 133)
    
    // Plan subscription item
    const planName = subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)
    pdf.text(`MenuQR Africa - ${planName} Plan`, 20, 140)
    pdf.text(`${invoiceData.currency} ${invoiceData.amount.toFixed(2)}`, 160, 140, { align: 'right' })

    // Total
    pdf.line(20, 150, 190, 150)
    pdf.setFontSize(12)
    pdf.text('Total:', 20, 160)
    pdf.text(`${invoiceData.currency} ${invoiceData.amount.toFixed(2)}`, 160, 160, { align: 'right' })

    // Payment status
    pdf.setFontSize(10)
    if (invoiceData.paid_at) {
      pdf.setTextColor(0, 150, 0)
      pdf.text(`Paid on ${new Date(invoiceData.paid_at).toLocaleDateString()}`, 20, 180)
    } else if (invoiceData.due_date) {
      pdf.setTextColor(200, 0, 0)
      pdf.text(`Due by ${new Date(invoiceData.due_date).toLocaleDateString()}`, 20, 180)
    }

    // Footer
    pdf.setTextColor(100, 100, 100)
    pdf.setFontSize(8)
    pdf.text('MenuQR Africa', 105, 270, { align: 'center' })
    pdf.text('Digital Menu Solutions for African Restaurants', 105, 275, { align: 'center' })

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'))
    const filename = `invoice-${invoiceData.invoice_number}.pdf`

    // Return PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Download invoice error:', errorMessage)
    
    return NextResponse.json<ApiResponse>({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}