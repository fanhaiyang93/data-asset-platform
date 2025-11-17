/**
 * 审计日志服务
 * Story 5.4: 资产下架管理
 *
 * 提供资产下架操作的完整审计日志记录和查询功能
 */

import {
  DecommissionAuditLog,
  DecommissionAuditMetadata,
  DecommissionAuditQueryParams,
  DecommissionAuditReportConfig,
  DecommissionStatistics,
  OperatorStatistics,
  DecommissionTrend,
  ExtendedAssetStatus
} from '@/types/assetLifecycle'

/**
 * 审计日志服务类
 */
export class AuditLoggerService {
  /**
   * 记录资产下架操作
   * @param assetId 资产ID
   * @param assetName 资产名称
   * @param operatorId 操作人ID
   * @param operatorName 操作人姓名
   * @param reason 下架原因
   * @param reasonDetail 详细说明
   * @param metadata 审计元数据
   */
  static async logAssetDecommission(
    assetId: string,
    assetName: string,
    operatorId: string,
    operatorName: string,
    reason: string,
    reasonDetail: string,
    metadata: Partial<DecommissionAuditMetadata>
  ): Promise<DecommissionAuditLog> {
    const log: DecommissionAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      assetId,
      assetName,
      operation: 'DECOMMISSION',
      operatorId,
      operatorName,
      timestamp: new Date(),
      reason,
      reasonDetail,
      impactLevel: metadata.affectedApplications && metadata.affectedApplications > 5
        ? 'HIGH'
        : metadata.dependentAssets && metadata.dependentAssets > 0
          ? 'MEDIUM'
          : 'LOW',
      metadata: {
        previousStatus: metadata.previousStatus || ExtendedAssetStatus.ACTIVE,
        newStatus: ExtendedAssetStatus.DECOMMISSIONED,
        affectedApplications: metadata.affectedApplications || 0,
        affectedUsers: metadata.affectedUsers || 0,
        dependentAssets: metadata.dependentAssets || 0,
        approvalRequired: metadata.approvalRequired || false,
        notificationsSent: metadata.notificationsSent || 0,
        ...metadata
      }
    }

    // TODO: 保存到数据库
    await this.saveAuditLog(log)

    return log
  }

  /**
   * 记录资产恢复操作
   */
  static async logAssetRestore(
    assetId: string,
    assetName: string,
    operatorId: string,
    operatorName: string,
    reason: string | undefined,
    metadata: Partial<DecommissionAuditMetadata>
  ): Promise<DecommissionAuditLog> {
    const log: DecommissionAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      assetId,
      assetName,
      operation: 'RESTORE',
      operatorId,
      operatorName,
      timestamp: new Date(),
      reason,
      impactLevel: 'LOW',
      metadata: {
        previousStatus: ExtendedAssetStatus.DECOMMISSIONED,
        newStatus: metadata.newStatus || ExtendedAssetStatus.ACTIVE,
        affectedApplications: 0,
        affectedUsers: metadata.affectedUsers || 0,
        dependentAssets: 0,
        approvalRequired: false,
        notificationsSent: metadata.notificationsSent || 0,
        ...metadata
      }
    }

    await this.saveAuditLog(log)

    return log
  }

  /**
   * 记录定时下架操作
   */
  static async logScheduledDecommission(
    assetId: string,
    assetName: string,
    operatorId: string,
    operatorName: string,
    scheduledAt: Date,
    reason: string,
    reasonDetail: string
  ): Promise<DecommissionAuditLog> {
    const log: DecommissionAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      assetId,
      assetName,
      operation: 'SCHEDULE_DECOMMISSION',
      operatorId,
      operatorName,
      timestamp: new Date(),
      reason,
      reasonDetail,
      impactLevel: 'LOW',
      metadata: {
        previousStatus: ExtendedAssetStatus.ACTIVE,
        newStatus: ExtendedAssetStatus.DECOMMISSIONED,
        affectedApplications: 0,
        affectedUsers: 0,
        dependentAssets: 0,
        approvalRequired: false,
        notificationsSent: 0
      }
    }

    await this.saveAuditLog(log)

    return log
  }

  /**
   * 查询审计日志
   * @param params 查询参数
   * @returns 审计日志列表
   */
  static async queryAuditLogs(
    params: DecommissionAuditQueryParams
  ): Promise<{
    logs: DecommissionAuditLog[]
    total: number
    page: number
    limit: number
  }> {
    // TODO: 从数据库查询
    const logs: DecommissionAuditLog[] = []

    const page = params.page || 1
    const limit = params.limit || 20

    return {
      logs,
      total: 0,
      page,
      limit
    }
  }

  /**
   * 生成审计报告
   * @param config 报告配置
   * @returns 报告数据
   */
  static async generateAuditReport(
    config: DecommissionAuditReportConfig
  ): Promise<{
    summary: DecommissionStatistics
    logs: DecommissionAuditLog[]
    reportUrl?: string
  }> {
    // 查询指定时间范围的日志
    const logs = await this.queryAuditLogs({
      dateRange: config.dateRange,
      page: 1,
      limit: 10000 // 获取所有记录用于统计
    })

    // 生成统计数据
    const statistics = await this.generateStatistics(logs.logs, config.dateRange)

    // TODO: 根据格式生成实际报告文件
    let reportUrl: string | undefined

    if (config.format === 'pdf' || config.format === 'excel') {
      // 生成报告文件
      reportUrl = await this.exportReport(logs.logs, statistics, config)
    }

    return {
      summary: statistics,
      logs: logs.logs,
      reportUrl
    }
  }

  /**
   * 生成下架统计数据
   */
  static async generateStatistics(
    logs: DecommissionAuditLog[],
    dateRange: { start: Date; end: Date }
  ): Promise<DecommissionStatistics> {
    const statistics: DecommissionStatistics = {
      totalDecommissioned: 0,
      totalRestored: 0,
      byReason: {} as any,
      byImpactLevel: {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0
      },
      topOperators: [],
      trends: []
    }

    // 统计操作数量
    const operatorMap = new Map<string, { name: string; decommission: number; restore: number }>()

    logs.forEach(log => {
      // 统计操作类型
      if (log.operation === 'DECOMMISSION') {
        statistics.totalDecommissioned++
      } else if (log.operation === 'RESTORE') {
        statistics.totalRestored++
      }

      // 统计影响级别
      if (log.impactLevel) {
        statistics.byImpactLevel[log.impactLevel]++
      }

      // 统计操作员
      if (!operatorMap.has(log.operatorId)) {
        operatorMap.set(log.operatorId, {
          name: log.operatorName,
          decommission: 0,
          restore: 0
        })
      }

      const operator = operatorMap.get(log.operatorId)!
      if (log.operation === 'DECOMMISSION') {
        operator.decommission++
      } else if (log.operation === 'RESTORE') {
        operator.restore++
      }
    })

    // 转换操作员统计
    statistics.topOperators = Array.from(operatorMap.entries())
      .map(([operatorId, data]) => ({
        operatorId,
        operatorName: data.name,
        decommissionCount: data.decommission,
        restoreCount: data.restore,
        averageImpactLevel: 0 // TODO: 计算平均影响级别
      }))
      .sort((a, b) => (b.decommissionCount + b.restoreCount) - (a.decommissionCount + a.restoreCount))
      .slice(0, 10)

    // 生成趋势数据
    statistics.trends = this.generateTrends(logs, dateRange)

    return statistics
  }

  /**
   * 获取资产的审计历史
   */
  static async getAssetAuditHistory(
    assetId: string
  ): Promise<DecommissionAuditLog[]> {
    const result = await this.queryAuditLogs({
      assetIds: [assetId],
      limit: 1000
    })

    return result.logs
  }

  /**
   * 获取批量操作的审计记录
   */
  static async getBatchOperationLogs(
    batchId: string
  ): Promise<DecommissionAuditLog[]> {
    const result = await this.queryAuditLogs({
      batchId,
      limit: 1000
    })

    return result.logs
  }

  /**
   * 删除过期的审计日志
   * @param retentionDays 保留天数
   */
  static async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    // TODO: 从数据库删除过期日志
    return 0
  }

  // ========== 私有辅助方法 ==========

  /**
   * 保存审计日志到数据库
   */
  private static async saveAuditLog(log: DecommissionAuditLog): Promise<void> {
    // TODO: 保存到数据库
    console.log('Audit log saved:', log.id)
  }

  /**
   * 生成趋势数据
   */
  private static generateTrends(
    logs: DecommissionAuditLog[],
    dateRange: { start: Date; end: Date }
  ): DecommissionTrend[] {
    const trends: DecommissionTrend[] = []

    // 按日期分组统计
    const dateMap = new Map<string, {
      decommission: number
      restore: number
      reasons: Map<string, number>
    }>()

    logs.forEach(log => {
      const dateKey = log.timestamp.toISOString().split('T')[0]

      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {
          decommission: 0,
          restore: 0,
          reasons: new Map()
        })
      }

      const data = dateMap.get(dateKey)!

      if (log.operation === 'DECOMMISSION') {
        data.decommission++
        if (log.reason) {
          data.reasons.set(log.reason, (data.reasons.get(log.reason) || 0) + 1)
        }
      } else if (log.operation === 'RESTORE') {
        data.restore++
      }
    })

    // 转换为趋势数据数组
    dateMap.forEach((data, dateKey) => {
      const reasonsObj: any = {}
      data.reasons.forEach((count, reason) => {
        reasonsObj[reason] = count
      })

      trends.push({
        date: new Date(dateKey),
        decommissionCount: data.decommission,
        restoreCount: data.restore,
        reasons: reasonsObj
      })
    })

    // 按日期排序
    trends.sort((a, b) => a.date.getTime() - b.date.getTime())

    return trends
  }

  /**
   * 导出审计报告
   */
  private static async exportReport(
    logs: DecommissionAuditLog[],
    statistics: DecommissionStatistics,
    config: DecommissionAuditReportConfig
  ): Promise<string> {
    // TODO: 实现报告导出逻辑
    // 根据 config.format 生成对应格式的文件

    // 返回临时URL
    return `/api/audit/reports/${Date.now()}.${config.format}`
  }
}

/**
 * 审计日志辅助函数
 */

/**
 * 格式化审计日志用于显示
 */
export function formatAuditLog(log: DecommissionAuditLog): string {
  const operationLabels = {
    DECOMMISSION: '下架',
    RESTORE: '恢复',
    SCHEDULE_DECOMMISSION: '定时下架',
    CANCEL_SCHEDULE: '取消定时'
  }

  const timestamp = log.timestamp.toLocaleString('zh-CN')
  const operation = operationLabels[log.operation] || log.operation

  return `[${timestamp}] ${log.operatorName} ${operation}了资产 "${log.assetName}"`
}

/**
 * 获取影响级别的颜色
 */
export function getImpactLevelColor(level: 'LOW' | 'MEDIUM' | 'HIGH'): string {
  const colors = {
    LOW: 'green',
    MEDIUM: 'yellow',
    HIGH: 'red'
  }

  return colors[level] || 'gray'
}

/**
 * 获取影响级别的标签
 */
export function getImpactLevelLabel(level: 'LOW' | 'MEDIUM' | 'HIGH'): string {
  const labels = {
    LOW: '低',
    MEDIUM: '中',
    HIGH: '高'
  }

  return labels[level] || level
}
