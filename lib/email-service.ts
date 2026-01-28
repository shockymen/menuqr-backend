import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@menuqr.africa'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://menuqr.africa'

// Email Templates
const getWelcomeEmailHtml = (userName: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to MenuQR Africa</title>
</head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 32px;">🎉 Welcome to MenuQR Africa!</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 40px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 18px; margin-bottom: 20px;">Hi ${userName || 'there'},</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      Thank you for joining MenuQR Africa! We're excited to help you create beautiful digital menus for your restaurant.
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      Here's what you can do with MenuQR Africa:
    </p>
    
    <ul style="font-size: 16px; margin-bottom: 30px; padding-left: 20px;">
      <li style="margin-bottom: 10px;">Create unlimited menus with time-based scheduling</li>
      <li style="margin-bottom: 10px;">Add team members with role-based permissions</li>
      <li style="margin-bottom: 10px;">Generate QR codes for contactless viewing</li>
      <li style="margin-bottom: 10px;">Support multiple languages for international guests</li>
    </ul>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}/dashboard" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">
        Get Started
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      If you have any questions, feel free to reply to this email.
    </p>
    
    <p style="font-size: 14px; color: #666;">
      Best regards,<br>
      The MenuQR Africa Team
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© 2026 MenuQR Africa. All rights reserved.</p>
  </div>
</body>
</html>
`

const getInvitationEmailHtml = (data: {
  inviteeName: string
  businessName: string
  roleName: string
  inviterName: string
  invitationUrl: string
  message?: string
}) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Invitation - ${data.businessName}</title>
</head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎉 You're Invited!</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 40px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 18px; margin-bottom: 20px;">Hi ${data.inviteeName || 'there'},</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      <strong>${data.inviterName}</strong> has invited you to join <strong>${data.businessName}</strong> on MenuQR Africa as a <strong>${data.roleName}</strong>.
    </p>
    
    ${data.message ? `
      <div style="background: #fff; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; font-style: italic; color: #555;">"${data.message}"</p>
      </div>
    ` : ''}
    
    <p style="font-size: 16px; margin-bottom: 30px;">
      Click the button below to accept the invitation and join the team:
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.invitationUrl}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">
        Accept Invitation
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      This invitation will expire in 7 days.
    </p>
    
    <p style="font-size: 14px; color: #666;">
      If you don't want to join this team, you can safely ignore this email.
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© 2026 MenuQR Africa. All rights reserved.</p>
  </div>
</body>
</html>
`

const getInvitationAcceptedEmailHtml = (data: {
  inviterName: string
  businessName: string
  newMemberName: string
  newMemberEmail: string
  roleName: string
}) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation Accepted - ${data.businessName}</title>
</head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">✅ Invitation Accepted!</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 40px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 18px; margin-bottom: 20px;">Hi ${data.inviterName},</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      Great news! <strong>${data.newMemberName || data.newMemberEmail}</strong> has accepted your invitation to join <strong>${data.businessName}</strong> as a <strong>${data.roleName}</strong>.
    </p>
    
    <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #666;"><strong>Email:</strong> ${data.newMemberEmail}</p>
      <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;"><strong>Role:</strong> ${data.roleName}</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}/businesses/${data.businessName}/team" style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">
        View Team Members
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      You can manage team members and their permissions from your dashboard.
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© 2026 MenuQR Africa. All rights reserved.</p>
  </div>
</body>
</html>
`

// Email sending functions

export async function sendWelcomeEmail(params: {
  to: string
  userName?: string
}) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: 'Welcome to MenuQR Africa! 🎉',
      html: getWelcomeEmailHtml(params.userName || params.to.split('@')[0])
    })

    if (error) {
      console.error('Failed to send welcome email:', error)
      return { success: false, error }
    }

    console.log('Welcome email sent:', data)
    return { success: true, data }
  } catch (error) {
    console.error('Error sending welcome email:', error)
    return { success: false, error }
  }
}

export async function sendInvitationEmail(params: {
  to: string
  businessName: string
  roleName: string
  inviterName: string
  inviterEmail: string
  invitationUrl: string
  message?: string
}) {
  try {
    const inviteeName = params.to.split('@')[0]
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `You're invited to join ${params.businessName} on MenuQR Africa`,
      html: getInvitationEmailHtml({
        inviteeName,
        businessName: params.businessName,
        roleName: params.roleName,
        inviterName: params.inviterName,
        invitationUrl: params.invitationUrl,
        message: params.message
      }),
      replyTo: params.inviterEmail
    })

    if (error) {
      console.error('Failed to send invitation email:', error)
      return { success: false, error }
    }

    console.log('Invitation email sent:', data)
    return { success: true, data }
  } catch (error) {
    console.error('Error sending invitation email:', error)
    return { success: false, error }
  }
}

export async function sendInvitationAcceptedEmail(params: {
  to: string
  inviterName: string
  businessName: string
  newMemberName?: string
  newMemberEmail: string
  roleName: string
}) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `${params.newMemberName || params.newMemberEmail} joined ${params.businessName}`,
      html: getInvitationAcceptedEmailHtml({
        inviterName: params.inviterName,
        businessName: params.businessName,
        newMemberName: params.newMemberName || params.newMemberEmail.split('@')[0],
        newMemberEmail: params.newMemberEmail,
        roleName: params.roleName
      })
    })

    if (error) {
      console.error('Failed to send invitation accepted email:', error)
      return { success: false, error }
    }

    console.log('Invitation accepted email sent:', data)
    return { success: true, data }
  } catch (error) {
    console.error('Error sending invitation accepted email:', error)
    return { success: false, error }
  }
}

export async function sendPasswordResetEmail(params: {
  to: string
  resetUrl: string
}) {
  try {
    const userName = params.to.split('@')[0]
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🔒 Reset Your Password</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 40px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 18px; margin-bottom: 20px;">Hi ${userName},</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      We received a request to reset your password for your MenuQR Africa account.
    </p>
    
    <p style="font-size: 16px; margin-bottom: 30px;">
      Click the button below to reset your password:
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${params.resetUrl}" style="background: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">
        Reset Password
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      This link will expire in 1 hour for security reasons.
    </p>
    
    <p style="font-size: 14px; color: #666;">
      If you didn't request a password reset, you can safely ignore this email.
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© 2026 MenuQR Africa. All rights reserved.</p>
  </div>
</body>
</html>
    `
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: 'Reset Your Password - MenuQR Africa',
      html
    })

    if (error) {
      console.error('Failed to send password reset email:', error)
      return { success: false, error }
    }

    console.log('Password reset email sent:', data)
    return { success: true, data }
  } catch (error) {
    console.error('Error sending password reset email:', error)
    return { success: false, error }
  }
}