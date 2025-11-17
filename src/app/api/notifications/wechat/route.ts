import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// 企业微信请求验证schema
const wechatRequestSchema = z.object({
  userEmail: z.string().email('Invalid email address'),
  content: z.string().min(1, 'Content is required'),
  isUrgent: z.boolean().optional().default(false)
})

// 企业微信发送服务（基于MCP脚本经验）
async function sendWechatNotification(data: {
  userEmail: string
  content: string
  isUrgent: boolean
}) {
  // 检查是否配置了企业微信Bot
  const webhookKey = process.env.WECHAT_WEBHOOK_KEY
  if (!webhookKey) {
    throw new Error('WeChat webhook not configured')
  }

  const webhookUrl = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${webhookKey}`

  // 构建消息内容（支持markdown格式）
  const messageContent = `
**数据资产管理平台通知**

**用户：** ${data.userEmail}
**时间：** ${new Date().toLocaleString('zh-CN')}
${data.isUrgent ? '**⚠️ 紧急通知**' : ''}

${data.content}

---
*来自数据资产管理平台*
  `.trim()

  const requestBody = {
    msgtype: 'markdown',
    markdown: {
      content: messageContent
    }
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`WeChat API error: ${error}`)
  }

  const result = await response.json()

  // 检查企业微信API返回的错误码
  if (result.errcode !== 0) {
    throw new Error(`WeChat API error code ${result.errcode}: ${result.errmsg}`)
  }

  return result
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 验证请求数据
    const validatedData = wechatRequestSchema.parse(body)

    // 发送企业微信通知
    const result = await sendWechatNotification(validatedData)

    return NextResponse.json({
      success: true,
      messageId: `wechat_${Date.now()}`,
      message: 'WeChat notification sent successfully',
      wechatResponse: result
    })

  } catch (error) {
    console.error('WeChat API error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send WeChat notification'
      },
      { status: 500 }
    )
  }
}

// 测试企业微信连接
export async function GET() {
  try {
    const webhookKey = process.env.WECHAT_WEBHOOK_KEY
    if (!webhookKey) {
      return NextResponse.json(
        { success: false, error: 'WeChat webhook not configured' },
        { status: 503 }
      )
    }

    // 发送测试消息
    const testResult = await sendWechatNotification({
      userEmail: 'system@test.com',
      content: '企业微信通知服务连接测试成功 ✅',
      isUrgent: false
    })

    return NextResponse.json({
      success: true,
      message: 'WeChat connection test successful',
      result: testResult
    })

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'WeChat connection test failed'
      },
      { status: 500 }
    )
  }
}