import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { SSORoleMappingService, SSOUserAttributes } from '@/lib/ssoRoleMapping'

// 手动触发用户同步
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { providerId, users, syncType = 'manual' } = body

    if (!providerId) {
      return NextResponse.json(
        { error: 'Provider ID is required' },
        { status: 400 }
      )
    }

    let results

    if (users && Array.isArray(users)) {
      // 批量同步指定用户
      results = await SSORoleMappingService.bulkSyncUsers(providerId, users)
    } else {
      // 这里应该集成实际的SSO API来获取用户列表
      // 目前返回示例结果
      const mockUsers = [
        {
          ssoId: 'user1',
          attributes: {
            email: 'admin@company.com',
            name: 'System Admin',
            department: 'IT',
            groups: ['admin', 'it'],
            roles: ['administrator']
          } as SSOUserAttributes
        },
        {
          ssoId: 'user2',
          attributes: {
            email: 'john.doe@company.com',
            name: 'John Doe',
            department: 'Sales',
            groups: ['sales'],
            roles: ['user']
          } as SSOUserAttributes
        }
      ]

      results = await SSORoleMappingService.bulkSyncUsers(providerId, mockUsers)
    }

    // 统计同步结果
    const stats = {
      total: results.length,
      created: results.filter(r => r.action === 'created').length,
      updated: results.filter(r => r.action === 'updated').length,
      noChange: results.filter(r => r.action === 'noChange').length,
      errors: results.filter(r => r.errors && r.errors.length > 0).length
    }

    return NextResponse.json({
      success: true,
      syncType,
      stats,
      results
    })

  } catch (error) {
    console.error('User sync error:', error)
    return NextResponse.json(
      {
        error: 'Failed to sync users',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}

// 获取用户同步状态
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get('providerId')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!providerId) {
      return NextResponse.json(
        { error: 'Provider ID is required' },
        { status: 400 }
      )
    }

    // 获取用户权限统计
    const stats = await SSORoleMappingService.getUserPermissionStats(providerId)

    // 获取最近的同步活动
    const recentActivity = await SSORoleMappingService.getRecentSyncActivity(providerId, limit)

    return NextResponse.json({
      success: true,
      stats,
      recentActivity
    })

  } catch (error) {
    console.error('Get sync status error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get sync status',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}