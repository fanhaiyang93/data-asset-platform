import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface SSOLogData {
  providerId: string
  userId?: string
  email?: string
  action: string
  status: 'success' | 'failure' | 'warning'
  message?: string
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  responseTime?: number
  errorCode?: string
  metadata?: Record<string, any>
}

export interface SSOMetrics {
  totalLogins: number
  successfulLogins: number
  failedLogins: number
  uniqueUsers: number
  averageResponseTime: number
  topErrors: Array<{
    error: string
    count: number
  }>
  loginsByHour: Array<{
    hour: number
    count: number
  }>
  loginsByProvider: Array<{
    providerId: string
    providerName: string
    count: number
  }>
}

export interface AlertRule {
  id: string
  name: string
  description: string
  condition: {
    metric: 'failed_login_rate' | 'response_time' | 'error_count' | 'login_count'
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq'
    threshold: number
    timeWindow: number // 分钟
  }
  actions: Array<{
    type: 'email' | 'webhook' | 'sms'
    target: string
    template?: string
  }>
  isActive: boolean
  cooldown: number // 冷却时间（分钟）
  lastTriggered?: Date
}

export class SSOLogger {
  /**
   * 记录SSO事件
   */
  static async logEvent(data: SSOLogData): Promise<void> {
    try {
      await prisma.sSOLog.create({
        data: {
          providerId: data.providerId,
          userId: data.userId,
          email: data.email,
          action: data.action,
          status: data.status,
          message: data.message,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          sessionId: data.sessionId,
          responseTime: data.responseTime,
          errorCode: data.errorCode,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null
        }
      })

      // 检查是否需要触发告警
      await this.checkAlerts(data)
    } catch (error) {
      console.error('Failed to log SSO event:', error)
    }
  }

  /**
   * 批量记录日志
   */
  static async logBatch(events: SSOLogData[]): Promise<void> {
    try {
      await prisma.sSOLog.createMany({
        data: events.map(event => ({
          providerId: event.providerId,
          userId: event.userId,
          email: event.email,
          action: event.action,
          status: event.status,
          message: event.message,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          sessionId: event.sessionId,
          responseTime: event.responseTime,
          errorCode: event.errorCode,
          metadata: event.metadata ? JSON.stringify(event.metadata) : null
        }))
      })
    } catch (error) {
      console.error('Failed to log SSO events batch:', error)
    }
  }

  /**
   * 获取SSO指标
   */
  static async getMetrics(
    providerId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<SSOMetrics> {
    try {
      const where: any = {}

      if (providerId) {
        where.providerId = providerId
      }

      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt.gte = startDate
        if (endDate) where.createdAt.lte = endDate
      }

      // 总体统计
      const [
        totalLogins,
        successfulLogins,
        failedLogins,
        uniqueUsers,
        avgResponseTime,
        topErrors,
        hourlyStats,
        providerStats
      ] = await Promise.all([
        // 总登录次数
        prisma.sSOLog.count({
          where: { ...where, action: 'login' }
        }),

        // 成功登录次数
        prisma.sSOLog.count({
          where: { ...where, action: 'login', status: 'success' }
        }),

        // 失败登录次数
        prisma.sSOLog.count({
          where: { ...where, action: 'login', status: 'failure' }
        }),

        // 唯一用户数
        prisma.sSOLog.findMany({
          where: { ...where, action: 'login', email: { not: null } },
          select: { email: true },
          distinct: ['email']
        }).then(results => results.length),

        // 平均响应时间
        prisma.sSOLog.aggregate({
          where: { ...where, responseTime: { not: null } },
          _avg: { responseTime: true }
        }).then(result => result._avg.responseTime || 0),

        // 错误统计
        prisma.sSOLog.groupBy({
          by: ['errorCode'],
          where: { ...where, status: 'failure', errorCode: { not: null } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 5
        }),

        // 按小时统计
        this.getHourlyLoginStats(where),

        // 按提供商统计
        this.getProviderLoginStats(where)
      ])

      return {
        totalLogins,
        successfulLogins,
        failedLogins,
        uniqueUsers,
        averageResponseTime: Math.round(avgResponseTime),
        topErrors: topErrors.map(item => ({
          error: item.errorCode || 'Unknown',
          count: item._count.id
        })),
        loginsByHour: hourlyStats,
        loginsByProvider: providerStats
      }
    } catch (error) {
      console.error('Failed to get SSO metrics:', error)
      return {
        totalLogins: 0,
        successfulLogins: 0,
        failedLogins: 0,
        uniqueUsers: 0,
        averageResponseTime: 0,
        topErrors: [],
        loginsByHour: [],
        loginsByProvider: []
      }
    }
  }

  /**
   * 获取按小时统计的登录数据
   */
  private static async getHourlyLoginStats(where: any): Promise<Array<{ hour: number; count: number }>> {
    try {
      // 获取过去24小时的数据
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      const logs = await prisma.sSOLog.findMany({
        where: {
          ...where,
          action: 'login',
          createdAt: { gte: startOfDay }
        },
        select: { createdAt: true }
      })

      // 按小时分组统计
      const hourlyStats = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }))

      logs.forEach(log => {
        const hour = log.createdAt.getHours()
        hourlyStats[hour].count++
      })

      return hourlyStats
    } catch (error) {
      console.error('Failed to get hourly login stats:', error)
      return []
    }
  }

  /**
   * 获取按提供商统计的登录数据
   */
  private static async getProviderLoginStats(where: any): Promise<Array<{ providerId: string; providerName: string; count: number }>> {
    try {
      const stats = await prisma.sSOLog.groupBy({
        by: ['providerId'],
        where: { ...where, action: 'login' },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } }
      })

      // 获取提供商名称
      const providerIds = stats.map(stat => stat.providerId)
      const providers = await prisma.sSOProvider.findMany({
        where: { id: { in: providerIds } },
        select: { id: true, name: true }
      })

      const providerMap = Object.fromEntries(
        providers.map(p => [p.id, p.name])
      )

      return stats.map(stat => ({
        providerId: stat.providerId,
        providerName: providerMap[stat.providerId] || 'Unknown',
        count: stat._count.id
      }))
    } catch (error) {
      console.error('Failed to get provider login stats:', error)
      return []
    }
  }

  /**
   * 检查告警规则
   */
  private static async checkAlerts(eventData: SSOLogData): Promise<void> {
    try {
      // 这里应该从数据库获取告警规则
      const alertRules = await this.getAlertRules(eventData.providerId)

      for (const rule of alertRules) {
        if (!rule.isActive) continue

        // 检查冷却时间
        if (rule.lastTriggered) {
          const cooldownEnd = new Date(rule.lastTriggered.getTime() + rule.cooldown * 60000)
          if (new Date() < cooldownEnd) continue
        }

        const shouldTrigger = await this.evaluateAlertRule(rule, eventData)
        if (shouldTrigger) {
          await this.triggerAlert(rule, eventData)
        }
      }
    } catch (error) {
      console.error('Failed to check alerts:', error)
    }
  }

  /**
   * 获取告警规则
   */
  private static async getAlertRules(providerId: string): Promise<AlertRule[]> {
    // 示例告警规则，实际应用中应该从数据库获取
    return [
      {
        id: 'high_failure_rate',
        name: '高失败率告警',
        description: '当登录失败率超过20%时触发',
        condition: {
          metric: 'failed_login_rate',
          operator: 'gt',
          threshold: 20,
          timeWindow: 10
        },
        actions: [
          {
            type: 'email',
            target: 'admin@company.com',
            template: 'high_failure_rate'
          }
        ],
        isActive: true,
        cooldown: 30
      },
      {
        id: 'slow_response',
        name: '响应时间告警',
        description: '当平均响应时间超过5秒时触发',
        condition: {
          metric: 'response_time',
          operator: 'gt',
          threshold: 5000,
          timeWindow: 5
        },
        actions: [
          {
            type: 'email',
            target: 'admin@company.com',
            template: 'slow_response'
          }
        ],
        isActive: true,
        cooldown: 15
      }
    ]
  }

  /**
   * 评估告警规则
   */
  private static async evaluateAlertRule(rule: AlertRule, eventData: SSOLogData): Promise<boolean> {
    try {
      const endTime = new Date()
      const startTime = new Date(endTime.getTime() - rule.condition.timeWindow * 60000)

      const where = {
        providerId: eventData.providerId,
        createdAt: { gte: startTime, lte: endTime }
      }

      switch (rule.condition.metric) {
        case 'failed_login_rate': {
          const [total, failed] = await Promise.all([
            prisma.sSOLog.count({ where: { ...where, action: 'login' } }),
            prisma.sSOLog.count({ where: { ...where, action: 'login', status: 'failure' } })
          ])
          const failureRate = total > 0 ? (failed / total) * 100 : 0
          return this.compareValue(failureRate, rule.condition.operator, rule.condition.threshold)
        }

        case 'response_time': {
          const result = await prisma.sSOLog.aggregate({
            where: { ...where, responseTime: { not: null } },
            _avg: { responseTime: true }
          })
          const avgResponseTime = result._avg.responseTime || 0
          return this.compareValue(avgResponseTime, rule.condition.operator, rule.condition.threshold)
        }

        case 'error_count': {
          const errorCount = await prisma.sSOLog.count({ where: { ...where, status: 'failure' } })
          return this.compareValue(errorCount, rule.condition.operator, rule.condition.threshold)
        }

        case 'login_count': {
          const loginCount = await prisma.sSOLog.count({ where: { ...where, action: 'login' } })
          return this.compareValue(loginCount, rule.condition.operator, rule.condition.threshold)
        }

        default:
          return false
      }
    } catch (error) {
      console.error('Failed to evaluate alert rule:', error)
      return false
    }
  }

  /**
   * 比较值
   */
  private static compareValue(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold
      case 'gte': return value >= threshold
      case 'lt': return value < threshold
      case 'lte': return value <= threshold
      case 'eq': return value === threshold
      default: return false
    }
  }

  /**
   * 触发告警
   */
  private static async triggerAlert(rule: AlertRule, eventData: SSOLogData): Promise<void> {
    try {
      console.log(`Alert triggered: ${rule.name}`, { rule, eventData })

      // 记录告警日志
      await this.logEvent({
        providerId: eventData.providerId,
        action: 'alert_triggered',
        status: 'warning',
        message: `Alert triggered: ${rule.name}`,
        metadata: {
          alertRule: rule.id,
          alertName: rule.name,
          condition: rule.condition
        }
      })

      // 执行告警动作
      for (const action of rule.actions) {
        await this.executeAlertAction(action, rule, eventData)
      }

      // 更新最后触发时间（在实际应用中应该保存到数据库）
      rule.lastTriggered = new Date()
    } catch (error) {
      console.error('Failed to trigger alert:', error)
    }
  }

  /**
   * 执行告警动作
   */
  private static async executeAlertAction(
    action: AlertRule['actions'][0],
    rule: AlertRule,
    eventData: SSOLogData
  ): Promise<void> {
    try {
      switch (action.type) {
        case 'email':
          // 发送邮件告警
          console.log(`Sending email alert to ${action.target}`, { rule, eventData })
          // await this.sendEmailAlert(action.target, rule, eventData)
          break

        case 'webhook':
          // 发送webhook告警
          console.log(`Sending webhook alert to ${action.target}`, { rule, eventData })
          // await this.sendWebhookAlert(action.target, rule, eventData)
          break

        case 'sms':
          // 发送短信告警
          console.log(`Sending SMS alert to ${action.target}`, { rule, eventData })
          // await this.sendSMSAlert(action.target, rule, eventData)
          break

        default:
          console.warn(`Unknown alert action type: ${action.type}`)
      }
    } catch (error) {
      console.error(`Failed to execute alert action ${action.type}:`, error)
    }
  }

  /**
   * 清理过期日志
   */
  static async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

      const result = await prisma.sSOLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate }
        }
      })

      console.log(`Cleaned up ${result.count} old SSO log entries`)
      return result.count
    } catch (error) {
      console.error('Failed to cleanup old logs:', error)
      return 0
    }
  }

  /**
   * 导出日志数据
   */
  static async exportLogs(
    format: 'json' | 'csv',
    options: {
      providerId?: string
      startDate?: Date
      endDate?: Date
      limit?: number
    } = {}
  ): Promise<string> {
    try {
      const where: any = {}

      if (options.providerId) {
        where.providerId = options.providerId
      }

      if (options.startDate || options.endDate) {
        where.createdAt = {}
        if (options.startDate) where.createdAt.gte = options.startDate
        if (options.endDate) where.createdAt.lte = options.endDate
      }

      const logs = await prisma.sSOLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit,
        include: {
          provider: {
            select: { name: true, type: true }
          }
        }
      })

      if (format === 'json') {
        return JSON.stringify(logs, null, 2)
      } else {
        // CSV格式
        const headers = [
          'ID', 'Provider', 'User', 'Action', 'Status', 'Message',
          'IP Address', 'Response Time', 'Created At'
        ]

        const rows = logs.map(log => [
          log.id,
          log.provider?.name || log.providerId,
          log.email || '',
          log.action,
          log.status,
          log.message || '',
          log.ipAddress || '',
          log.responseTime || '',
          log.createdAt.toISOString()
        ])

        return [headers, ...rows].map(row => row.join(',')).join('\n')
      }
    } catch (error) {
      console.error('Failed to export logs:', error)
      throw new Error('导出日志失败')
    }
  }
}