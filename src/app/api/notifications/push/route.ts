import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import webpush from 'web-push'

// Push通知请求验证schema
const pushRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  urgent: z.boolean().optional().default(false),
  icon: z.string().optional(),
  badge: z.string().optional(),
  tag: z.string().optional()
})

// 初始化Web Push配置
function initializeWebPush() {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@dataplatform.com'

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID keys not configured')
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

// 获取用户的Push订阅信息
async function getUserPushSubscriptions(userId: string) {
  // 这里需要从数据库获取用户的Push订阅信息
  // 为了演示，返回空数组
  // 实际项目中需要实现用户订阅管理
  return []
}

// 发送Push通知
async function sendPushNotification(data: {
  userId: string
  title: string
  body: string
  urgent: boolean
  icon?: string
  badge?: string
  tag?: string
}) {
  initializeWebPush()

  // 获取用户的Push订阅
  const subscriptions = await getUserPushSubscriptions(data.userId)

  if (subscriptions.length === 0) {
    throw new Error('No push subscriptions found for user')
  }

  // 构建通知payload
  const notificationPayload = {
    title: data.title,
    body: data.body,
    icon: data.icon || '/icons/notification-icon-192.png',
    badge: data.badge || '/icons/notification-badge-72.png',
    tag: data.tag || 'status-update',
    data: {
      url: '/applications',
      userId: data.userId,
      timestamp: new Date().toISOString()
    },
    actions: [
      {
        action: 'view',
        title: '查看详情',
        icon: '/icons/view-icon.png'
      },
      {
        action: 'dismiss',
        title: '知道了',
        icon: '/icons/dismiss-icon.png'
      }
    ],
    requireInteraction: data.urgent,
    silent: false
  }

  // 并行发送给所有订阅
  const results = await Promise.allSettled(
    subscriptions.map(async (subscription: any) => {
      try {
        const result = await webpush.sendNotification(
          subscription,
          JSON.stringify(notificationPayload),
          {
            urgency: data.urgent ? 'high' : 'normal',
            TTL: 3600 // 1小时
          }
        )
        return { success: true, result }
      } catch (error) {
        console.error('Push notification failed for subscription:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })
  )

  const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length
  const failureCount = results.length - successCount

  return {
    totalSubscriptions: subscriptions.length,
    successCount,
    failureCount,
    results
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 验证请求数据
    const validatedData = pushRequestSchema.parse(body)

    // 发送Push通知
    const result = await sendPushNotification(validatedData)

    return NextResponse.json({
      success: true,
      message: 'Push notifications sent',
      ...result
    })

  } catch (error) {
    console.error('Push API error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send push notification'
      },
      { status: 500 }
    )
  }
}

// 获取VAPID公钥（用于前端订阅）
export async function GET() {
  try {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY

    if (!vapidPublicKey) {
      return NextResponse.json(
        { success: false, error: 'VAPID public key not configured' },
        { status: 503 }
      )
    }

    return NextResponse.json({
      success: true,
      publicKey: vapidPublicKey
    })

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get VAPID public key'
      },
      { status: 500 }
    )
  }
}