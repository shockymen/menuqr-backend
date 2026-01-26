import QRCode from 'qrcode'

export interface GenerateQROptions {
  url: string
  size?: number
  format?: 'png' | 'svg'
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  color?: {
    dark?: string
    light?: string
  }
}

/**
 * Generate QR code as Buffer
 */
export async function generateQRCode(options: GenerateQROptions): Promise<Buffer> {
  const {
    url,
    size = 512,
    errorCorrectionLevel = 'M',
    color = { dark: '#000000', light: '#FFFFFF' }
  } = options

  try {
    // Generate QR code as Buffer
    const qrBuffer = await QRCode.toBuffer(url, {
      width: size,
      margin: 2,
      errorCorrectionLevel,
      color
    })

    return qrBuffer
  } catch (error) {
    console.error('QR generation error:', error)
    throw new Error('Failed to generate QR code')
  }
}

/**
 * Generate QR code as Data URL (for immediate display)
 */
export async function generateQRCodeDataURL(options: GenerateQROptions): Promise<string> {
  const {
    url,
    size = 512,
    errorCorrectionLevel = 'M',
    color = { dark: '#000000', light: '#FFFFFF' }
  } = options

  try {
    const dataURL = await QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      errorCorrectionLevel,
      color
    })

    return dataURL
  } catch (error) {
    console.error('QR generation error:', error)
    throw new Error('Failed to generate QR code')
  }
}