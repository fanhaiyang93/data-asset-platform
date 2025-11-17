import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { SSOLogger } from '@/lib/ssoLogger'

// 获取SSO监控指标
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
    const timeRange = searchParams.get('timeRange') || '24h'
    const metricType = searchParams.get('metricType') || 'overview'

    // 计算时间范围
    let startDate: Date
    const endDate = new Date()

    switch (timeRange) {
      case '1h':
        startDate = new Date(endDate.getTime() - 60 * 60 * 1000)
        break
      case '24h':
        startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000)
    }

    // 获取监控指标
    const metrics = await SSOLogger.getMetrics(
      providerId || undefined,
      startDate,
      endDate
    )

    // 根据请求类型返回不同的数据
    switch (metricType) {
      case 'overview':
        return NextResponse.json({
          success: true,
          timeRange,
          metrics: {
            totalLogins: metrics.totalLogins,
            successfulLogins: metrics.successfulLogins,
            failedLogins: metrics.failedLogins,
            successRate: metrics.totalLogins > 0
              ? ((metrics.successfulLogins / metrics.totalLogins) * 100).toFixed(2)
              : '0.00',
            uniqueUsers: metrics.uniqueUsers,
            averageResponseTime: metrics.averageResponseTime
          }
        })

      case 'performance':
        return NextResponse.json({
          success: true,
          timeRange,
          performance: {
            averageResponseTime: metrics.averageResponseTime,
            loginsByHour: metrics.loginsByHour,
            responseTimeDistribution: await getResponseTimeDistribution(providerId, startDate, endDate)
          }
        })

      case 'errors':
        return NextResponse.json({
          success: true,
          timeRange,
          errors: {
            topErrors: metrics.topErrors,
            errorTrends: await getErrorTrends(providerId, startDate, endDate),
            errorsByProvider: await getErrorsByProvider(startDate, endDate)
          }
        })

      case 'usage':
        return NextResponse.json({
          success: true,
          timeRange,
          usage: {
            loginsByProvider: metrics.loginsByProvider,
            loginsByHour: metrics.loginsByHour,
            userActivity: await getUserActivity(providerId, startDate, endDate)
          }
        })

      default:
        return NextResponse.json({
          success: true,
          timeRange,
          metrics
        })
    }

  } catch (error) {
    console.error('Get SSO monitoring data error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get monitoring data',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}

// 获取系统健康状态
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

    const { action } = await request.json()

    switch (action) {
      case 'health_check':
        const healthStatus = await performHealthCheck()
        return NextResponse.json({
          success: true,
          health: healthStatus
        })

      case 'export_logs':
        const { format, options } = await request.json()
        const exportData = await SSOLogger.exportLogs(format, options)

        return new NextResponse(exportData, {
          headers: {
            'Content-Type': format === 'json' ? 'application/json' : 'text/csv',
            'Content-Disposition': `attachment; filename="sso_logs_${new Date().toISOString().split('T')[0]}.${format}"`
          }
        })

      case 'cleanup_logs':
        const { daysToKeep } = await request.json()
        const cleanedCount = await SSOLogger.cleanupOldLogs(daysToKeep || 90)

        return NextResponse.json({
          success: true,
          message: `清理了 ${cleanedCount} 条过期日志`
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('SSO monitoring action error:', error)
    return NextResponse.json(
      {
        error: 'Failed to execute monitoring action',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}

// 辅助函数：获取响应时间分布
async function getResponseTimeDistribution(providerId?: string, startDate?: Date, endDate?: Date) {
  // 这里应该实现实际的数据库查询
  // 返回示例数据
  return {
    ranges: [
      { range: '0-100ms', count: 1250 },
      { range: '100-500ms', count: 850 },
      { range: '500ms-1s', count: 320 },
      { range: '1s-3s', count: 180 },
      { range: '3s+', count: 45 }
    ]
  }
}

// 辅助函数：获取错误趋势
async function getErrorTrends(providerId?: string, startDate?: Date, endDate?: Date) {
  // 这里应该实现实际的数据库查询
  // 返回示例数据
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    errors: Math.floor(Math.random() * 20)
  }))

  return hours
}

// 辅助函数：按提供商获取错误统计
async function getErrorsByProvider(startDate?: Date, endDate?: Date) {
  // 这里应该实现实际的数据库查询
  // 返回示例数据
  return [
    { providerId: 'saml-provider-1', providerName: 'Company SAML', errors: 25 },
    { providerId: 'oauth-provider-1', providerName: 'Google OAuth', errors: 12 },
    { providerId: 'ldap-provider-1', providerName: 'AD LDAP', errors: 8 }
  ]
}

// 辅助函数：获取用户活动统计
async function getUserActivity(providerId?: string, startDate?: Date, endDate?: Date) {
  // 这里应该实现实际的数据库查询
  // 返回示例数据
  return {
    activeUsers: 1250,
    newUsers: 45,
    returningUsers: 1205,
    peakHour: 14,
    topUsers: [
      { email: 'user1@company.com', loginCount: 25 },
      { email: 'user2@company.com', loginCount: 22 },
      { email: 'user3@company.com', loginCount: 18 }
    ]
  }
}

// 辅助函数：执行健康检查
async function performHealthCheck() {
  const checks = {
    database: false,
    ssoProviders: false,
    responseTime: 0,
    errorRate: 0,
    systemLoad: 0
  }

  try {
    // 数据库连接检查
    const startTime = Date.now()
    // 这里应该执行实际的数据库查询
    const endTime = Date.now()
    checks.database = true
    checks.responseTime = endTime - startTime

    // SSO提供商健康检查
    // 这里应该检查所有活跃的SSO提供商
    checks.ssoProviders = true

    // 错误率检查
    const recentMetrics = await SSOLogger.getMetrics(
      undefined,
      new Date(Date.now() - 60 * 60 * 1000), // 过去1小时
      new Date()
    )

    checks.errorRate = recentMetrics.totalLogins > 0
      ? (recentMetrics.failedLogins / recentMetrics.totalLogins) * 100
      : 0

    // 系统负载检查（示例）
    checks.systemLoad = Math.random() * 100

  } catch (error) {
    console.error('Health check failed:', error)
  }

  return {
    status: checks.database && checks.ssoProviders && checks.errorRate < 10 ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  }
}