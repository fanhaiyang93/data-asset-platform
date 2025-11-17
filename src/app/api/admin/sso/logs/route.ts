import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 获取SSO日志
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
    const action = searchParams.get('action')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const skip = (page - 1) * limit

    // 构建查询条件
    const where: any = {}

    if (providerId) {
      where.providerId = providerId
    }

    if (action) {
      where.action = action
    }

    if (status) {
      where.status = status
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate)
      }
    }

    // 获取日志数据
    const [logs, total] = await Promise.all([
      prisma.sSOLog.findMany({
        where,
        include: {
          provider: {
            select: {
              name: true,
              type: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.sSOLog.count({ where })
    ])

    return NextResponse.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Get SSO logs error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get SSO logs',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}