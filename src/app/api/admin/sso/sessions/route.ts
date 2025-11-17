import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 获取SSO会话
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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const providerId = searchParams.get('providerId')
    const userId = searchParams.get('userId')
    const isActive = searchParams.get('isActive')

    const skip = (page - 1) * limit

    // 构建查询条件
    const where: any = {}

    if (providerId) {
      where.providerId = providerId
    }

    if (userId) {
      where.userId = userId
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    // 获取会话数据
    const [sessions, total] = await Promise.all([
      prisma.sSOSession.findMany({
        where,
        include: {
          provider: {
            select: {
              name: true,
              type: true
            }
          },
          user: {
            select: {
              username: true,
              email: true,
              name: true
            }
          }
        },
        orderBy: { loginTime: 'desc' },
        skip,
        take: limit
      }),
      prisma.sSOSession.count({ where })
    ])

    return NextResponse.json({
      success: true,
      sessions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Get SSO sessions error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get SSO sessions',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}

// 强制注销SSO会话
export async function DELETE(request: NextRequest) {
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

    const { sessionIds } = await request.json()

    if (!sessionIds || !Array.isArray(sessionIds)) {
      return NextResponse.json(
        { error: 'Session IDs are required' },
        { status: 400 }
      )
    }

    // 强制注销指定的会话
    const updatedSessions = await prisma.sSOSession.updateMany({
      where: {
        sessionId: { in: sessionIds },
        isActive: true
      },
      data: {
        isActive: false,
        logoutRequested: true,
        lastActivity: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: `Successfully logged out ${updatedSessions.count} sessions`
    })

  } catch (error) {
    console.error('Force logout SSO sessions error:', error)
    return NextResponse.json(
      {
        error: 'Failed to force logout SSO sessions',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}