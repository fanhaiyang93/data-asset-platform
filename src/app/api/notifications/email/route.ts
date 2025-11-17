import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// 邮件请求验证schema
const emailRequestSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required'),
  html: z.string().min(1, 'Content is required'),
  from: z.string().email().optional()
})

// 邮件发送服务（使用Resend或其他服务）
async function sendEmail(data: {
  to: string
  subject: string
  html: string
  from?: string
}) {
  // 检查是否配置了邮件服务
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('Email service not configured')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: data.from || process.env.DEFAULT_FROM_EMAIL || 'noreply@dataplatform.com',
      to: [data.to],
      subject: data.subject,
      html: data.html
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Email service error: ${error}`)
  }

  return await response.json()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 验证请求数据
    const validatedData = emailRequestSchema.parse(body)

    // 发送邮件
    const result = await sendEmail(validatedData)

    return NextResponse.json({
      success: true,
      messageId: result.id,
      message: 'Email sent successfully'
    })

  } catch (error) {
    console.error('Email API error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email'
      },
      { status: 500 }
    )
  }
}