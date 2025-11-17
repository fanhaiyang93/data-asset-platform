import { NextRequest, NextResponse } from 'next/server'
import { SSOConfigService } from '@/lib/ssoConfig'
import { getSession } from '@/lib/session'

// 获取SSO提供商统计信息
export async function GET(
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

    // 获取天数参数，默认30天
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    const statistics = await SSOConfigService.getProviderStatistics(params.id, days)

    return NextResponse.json({
      success: true,
      statistics,
      period: `${days} days`
    })

  } catch (error) {
    console.error('Get SSO provider statistics error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get SSO provider statistics',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}