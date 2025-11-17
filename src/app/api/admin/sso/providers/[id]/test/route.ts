import { NextRequest, NextResponse } from 'next/server'
import { SSOConfigService } from '@/lib/ssoConfig'
import { getSession } from '@/lib/session'

// 测试SSO提供商连接
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户权限
    const session = await getSession(request)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 检查管理员权限
    if (session.user.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const result = await SSOConfigService.testProviderConnection(params.id)

    return NextResponse.json({
      success: true,
      result
    })

  } catch (error) {
    console.error('Test SSO provider connection error:', error)
    return NextResponse.json(
      {
        error: 'Failed to test SSO provider connection',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}