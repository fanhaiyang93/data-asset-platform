import { redis } from '@/lib/cache'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// 性能指标接口
export interface PerformanceMetrics {
  requestId: string
  operation: string
  startTime: number
  endTime: number
  duration: number
  success: boolean
  errorMessage?: string
  metadata?: {
    query?: string
    resultCount?: number
    cacheHit?: boolean
    fallbackUsed?: boolean
    indexName?: string
  }
}

// 聚合性能统计接口
export interface AggregatedMetrics {
  date: string
  operation: string
  totalRequests: number
  successfulRequests: number
  averageResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  errorRate: number
  cacheHitRate: number
  fallbackRate: number
}

// 实时性能状态接口
export interface RealTimeStats {
  currentActiveRequests: number
  requestsPerMinute: number
  averageResponseTime: number
  errorRate: number
  cacheHitRate: number
  healthScore: number
}

// 性能阈值配置
export interface PerformanceThresholds {
  maxResponseTime: number // 毫秒
  maxErrorRate: number // 百分比
  minCacheHitRate: number // 百分比
  maxActiveRequests: number
}

// 默认性能阈值
const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  maxResponseTime: 1000, // 1秒
  maxErrorRate: 5, // 5%
  minCacheHitRate: 70, // 70%
  maxActiveRequests: 100
}

export class SearchPerformanceService {
  private activeRequests = new Map<string, { startTime: number, operation: string }>()
  private metricsBuffer: PerformanceMetrics[] = []
  private bufferSize = 1000
  private flushInterval = 30000 // 30秒
  private cachePrefix = 'perf:'
  private alertThresholds = DEFAULT_THRESHOLDS

  constructor() {
    // 启动定时刷新指标
    this.startPeriodicFlush()
  }

  // 开始跟踪请求
  startTracking(operation: string, metadata?: any): string {
    const requestId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const startTime = Date.now()

    this.activeRequests.set(requestId, { startTime, operation })

    // 记录开始时间到metadata
    if (metadata) {
      metadata.startTime = startTime
    }

    return requestId
  }

  // 结束跟踪请求
  async endTracking(
    requestId: string,
    success: boolean,
    errorMessage?: string,
    metadata?: any
  ): Promise<void> {
    const request = this.activeRequests.get(requestId)
    if (!request) {
      console.warn(`跟踪请求不存在: ${requestId}`)
      return
    }

    const endTime = Date.now()
    const duration = endTime - request.startTime

    // 从活跃请求中移除
    this.activeRequests.delete(requestId)

    // 创建性能指标
    const metrics: PerformanceMetrics = {
      requestId,
      operation: request.operation,
      startTime: request.startTime,
      endTime,
      duration,
      success,
      errorMessage,
      metadata
    }

    // 添加到缓冲区
    this.metricsBuffer.push(metrics)

    // 如果缓冲区满了，立即刷新
    if (this.metricsBuffer.length >= this.bufferSize) {
      await this.flushMetrics()
    }

    // 检查性能警告
    await this.checkAlerts(metrics)
  }

  // 记录搜索操作性能
  async recordSearchMetrics(
    operation: 'search' | 'liveSearch' | 'suggest',
    duration: number,
    success: boolean,
    metadata: {
      query: string
      resultCount: number
      cacheHit: boolean
      fallbackUsed: boolean
    }
  ): Promise<void> {
    const requestId = this.generateRequestId(operation)

    const metrics: PerformanceMetrics = {
      requestId,
      operation,
      startTime: Date.now() - duration,
      endTime: Date.now(),
      duration,
      success,
      metadata
    }

    this.metricsBuffer.push(metrics)

    // 更新实时统计
    await this.updateRealTimeStats(metrics)
  }

  // 获取实时性能统计
  async getRealTimeStats(): Promise<RealTimeStats> {
    try {
      const cacheKey = `${this.cachePrefix}realtime_stats`
      const cached = await redis.get(cacheKey)

      if (cached) {
        const stats = JSON.parse(cached)
        return {
          ...stats,
          currentActiveRequests: this.activeRequests.size
        }
      }

      // 如果缓存不存在，返回默认值
      return {
        currentActiveRequests: this.activeRequests.size,
        requestsPerMinute: 0,
        averageResponseTime: 0,
        errorRate: 0,
        cacheHitRate: 0,
        healthScore: 100
      }
    } catch (error) {
      console.error('获取实时统计失败:', error)
      return {
        currentActiveRequests: this.activeRequests.size,
        requestsPerMinute: 0,
        averageResponseTime: 0,
        errorRate: 0,
        cacheHitRate: 0,
        healthScore: 50
      }
    }
  }

  // 获取历史性能指标
  async getHistoricalMetrics(
    operation?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<AggregatedMetrics[]> {
    try {
      const where: any = {}

      if (operation) {
        where.operation = operation
      }

      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt.gte = startDate
        if (endDate) where.createdAt.lte = endDate
      }

      // 从数据库获取聚合指标（这里假设有一个性能指标表）
      // 实际实现中可能需要创建相应的数据库模型
      const metrics = await this.getAggregatedMetricsFromCache(operation, startDate, endDate, limit)

      return metrics
    } catch (error) {
      console.error('获取历史指标失败:', error)
      return []
    }
  }

  // 获取性能警报历史
  async getPerformanceAlerts(limit: number = 50): Promise<Array<{
    id: string
    type: 'response_time' | 'error_rate' | 'cache_miss' | 'high_load'
    message: string
    threshold: number
    actualValue: number
    operation: string
    timestamp: Date
    resolved: boolean
  }>> {
    try {
      const cacheKey = `${this.cachePrefix}alerts`
      const cached = await redis.get(cacheKey)

      if (cached) {
        const alerts = JSON.parse(cached)
        return alerts.slice(0, limit)
      }

      return []
    } catch (error) {
      console.error('获取性能警报失败:', error)
      return []
    }
  }

  // 设置性能阈值
  async setPerformanceThresholds(thresholds: Partial<PerformanceThresholds>): Promise<void> {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds }

    // 保存到缓存
    const cacheKey = `${this.cachePrefix}thresholds`
    await redis.set(cacheKey, JSON.stringify(this.alertThresholds))

    console.log('性能阈值已更新:', this.alertThresholds)
  }

  // 获取性能报告
  async getPerformanceReport(days: number = 7): Promise<{
    summary: {
      totalRequests: number
      averageResponseTime: number
      errorRate: number
      cacheHitRate: number
      healthScore: number
    }
    trends: Array<{
      date: string
      requests: number
      responseTime: number
      errorRate: number
    }>
    topSlowOperations: Array<{
      operation: string
      averageTime: number
      count: number
    }>
    recentAlerts: number
  }> {
    try {
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

      const [historicalMetrics, alerts] = await Promise.all([
        this.getHistoricalMetrics(undefined, startDate, endDate, days * 24),
        this.getPerformanceAlerts(100)
      ])

      // 计算汇总统计
      const totalRequests = historicalMetrics.reduce((sum, m) => sum + m.totalRequests, 0)
      const avgResponseTime = historicalMetrics.length > 0
        ? historicalMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / historicalMetrics.length
        : 0
      const avgErrorRate = historicalMetrics.length > 0
        ? historicalMetrics.reduce((sum, m) => sum + m.errorRate, 0) / historicalMetrics.length
        : 0
      const avgCacheHitRate = historicalMetrics.length > 0
        ? historicalMetrics.reduce((sum, m) => sum + m.cacheHitRate, 0) / historicalMetrics.length
        : 0

      // 计算健康分数
      const healthScore = this.calculateHealthScore(avgResponseTime, avgErrorRate, avgCacheHitRate)

      // 按日期聚合趋势
      const trendMap = new Map<string, { requests: number, responseTime: number, errorRate: number, count: number }>()
      historicalMetrics.forEach(metric => {
        const existing = trendMap.get(metric.date) || { requests: 0, responseTime: 0, errorRate: 0, count: 0 }
        existing.requests += metric.totalRequests
        existing.responseTime += metric.averageResponseTime
        existing.errorRate += metric.errorRate
        existing.count++
        trendMap.set(metric.date, existing)
      })

      const trends = Array.from(trendMap.entries()).map(([date, data]) => ({
        date,
        requests: data.requests,
        responseTime: data.responseTime / data.count,
        errorRate: data.errorRate / data.count
      }))

      // 找出最慢的操作
      const operationMap = new Map<string, { totalTime: number, count: number }>()
      historicalMetrics.forEach(metric => {
        const existing = operationMap.get(metric.operation) || { totalTime: 0, count: 0 }
        existing.totalTime += metric.averageResponseTime * metric.totalRequests
        existing.count += metric.totalRequests
        operationMap.set(metric.operation, existing)
      })

      const topSlowOperations = Array.from(operationMap.entries())
        .map(([operation, data]) => ({
          operation,
          averageTime: data.totalTime / data.count,
          count: data.count
        }))
        .sort((a, b) => b.averageTime - a.averageTime)
        .slice(0, 5)

      // 计算最近警报数量
      const recentAlertsDate = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24小时内
      const recentAlerts = alerts.filter(alert =>
        new Date(alert.timestamp) > recentAlertsDate
      ).length

      return {
        summary: {
          totalRequests,
          averageResponseTime: Math.round(avgResponseTime),
          errorRate: Math.round(avgErrorRate * 100) / 100,
          cacheHitRate: Math.round(avgCacheHitRate * 100) / 100,
          healthScore: Math.round(healthScore)
        },
        trends,
        topSlowOperations,
        recentAlerts
      }
    } catch (error) {
      console.error('生成性能报告失败:', error)
      throw error
    }
  }

  // 私有方法：更新实时统计
  private async updateRealTimeStats(metrics: PerformanceMetrics): Promise<void> {
    try {
      const cacheKey = `${this.cachePrefix}realtime_stats`
      const windowKey = `${this.cachePrefix}window:${Math.floor(Date.now() / 60000)}` // 1分钟窗口

      // 更新窗口统计
      const windowStats = await redis.get(windowKey)
      const currentWindow = windowStats ? JSON.parse(windowStats) : {
        requests: 0,
        successfulRequests: 0,
        totalResponseTime: 0,
        cacheHits: 0,
        fallbacks: 0
      }

      currentWindow.requests++
      if (metrics.success) currentWindow.successfulRequests++
      currentWindow.totalResponseTime += metrics.duration
      if (metrics.metadata?.cacheHit) currentWindow.cacheHits++
      if (metrics.metadata?.fallbackUsed) currentWindow.fallbacks++

      // **性能监控时间窗口缓存策略 - 5分钟TTL**
      // 原因：实时性能统计需要频繁更新，使用短期缓存
      // - 5分钟：与监控时间窗口对齐，确保数据时效性
      // - 实时监控：支持管理员实时查看系统性能状态
      // - 适用场景：实时性能仪表板、告警触发、负载监控
      await redis.setex(windowKey, 300, JSON.stringify(currentWindow))

      // 计算实时统计
      const stats: Omit<RealTimeStats, 'currentActiveRequests'> = {
        requestsPerMinute: currentWindow.requests,
        averageResponseTime: currentWindow.requests > 0
          ? currentWindow.totalResponseTime / currentWindow.requests
          : 0,
        errorRate: currentWindow.requests > 0
          ? ((currentWindow.requests - currentWindow.successfulRequests) / currentWindow.requests) * 100
          : 0,
        cacheHitRate: currentWindow.requests > 0
          ? (currentWindow.cacheHits / currentWindow.requests) * 100
          : 0,
        healthScore: this.calculateHealthScore(
          currentWindow.totalResponseTime / Math.max(currentWindow.requests, 1),
          ((currentWindow.requests - currentWindow.successfulRequests) / Math.max(currentWindow.requests, 1)) * 100,
          (currentWindow.cacheHits / Math.max(currentWindow.requests, 1)) * 100
        )
      }

      // **实时性能统计缓存策略 - 1分钟TTL**
      // 原因：实时统计数据需要高频更新，支持实时监控
      // - 1分钟：确保管理员能看到最新的系统性能状态
      // - 快速响应：支持性能告警和故障诊断
      // - 适用场景：系统监控面板、性能告警触发、负载均衡决策
      await redis.setex(cacheKey, 60, JSON.stringify(stats))
    } catch (error) {
      console.error('更新实时统计失败:', error)
    }
  }

  // 私有方法：检查警报
  private async checkAlerts(metrics: PerformanceMetrics): Promise<void> {
    const alerts = []

    // 检查响应时间
    if (metrics.duration > this.alertThresholds.maxResponseTime) {
      alerts.push({
        id: `rt_${metrics.requestId}`,
        type: 'response_time' as const,
        message: `${metrics.operation} 响应时间超过阈值`,
        threshold: this.alertThresholds.maxResponseTime,
        actualValue: metrics.duration,
        operation: metrics.operation,
        timestamp: new Date(),
        resolved: false
      })
    }

    // 检查错误率（需要窗口统计）
    const stats = await this.getRealTimeStats()
    if (stats.errorRate > this.alertThresholds.maxErrorRate) {
      alerts.push({
        id: `er_${Date.now()}`,
        type: 'error_rate' as const,
        message: `错误率超过阈值`,
        threshold: this.alertThresholds.maxErrorRate,
        actualValue: stats.errorRate,
        operation: metrics.operation,
        timestamp: new Date(),
        resolved: false
      })
    }

    // 检查缓存命中率
    if (stats.cacheHitRate < this.alertThresholds.minCacheHitRate) {
      alerts.push({
        id: `chr_${Date.now()}`,
        type: 'cache_miss' as const,
        message: `缓存命中率低于阈值`,
        threshold: this.alertThresholds.minCacheHitRate,
        actualValue: stats.cacheHitRate,
        operation: metrics.operation,
        timestamp: new Date(),
        resolved: false
      })
    }

    // 检查活跃请求数
    if (this.activeRequests.size > this.alertThresholds.maxActiveRequests) {
      alerts.push({
        id: `hl_${Date.now()}`,
        type: 'high_load' as const,
        message: `活跃请求数超过阈值`,
        threshold: this.alertThresholds.maxActiveRequests,
        actualValue: this.activeRequests.size,
        operation: metrics.operation,
        timestamp: new Date(),
        resolved: false
      })
    }

    // 保存警报
    if (alerts.length > 0) {
      await this.saveAlerts(alerts)
    }
  }

  // 私有方法：保存警报
  private async saveAlerts(alerts: any[]): Promise<void> {
    try {
      const cacheKey = `${this.cachePrefix}alerts`
      const existingAlerts = await redis.get(cacheKey)
      const allAlerts = existingAlerts ? JSON.parse(existingAlerts) : []

      allAlerts.unshift(...alerts)

      // 只保留最近1000个警报
      const trimmedAlerts = allAlerts.slice(0, 1000)

      // **性能警报缓存策略 - 7天TTL**
      // 原因：性能警报具有问题追踪价值，需要保留足够长时间用于分析
      // - 7天：足够覆盖一周的性能问题分析和故障排查
      // - 有限保留：避免过多历史警报占用存储空间（最多1000条）
      // - 适用场景：故障回溯、性能问题分析、系统健康度评估
      await redis.setex(cacheKey, 7 * 24 * 60 * 60, JSON.stringify(trimmedAlerts))

      console.log(`保存了 ${alerts.length} 个性能警报`)
    } catch (error) {
      console.error('保存警报失败:', error)
    }
  }

  // 私有方法：计算健康分数
  private calculateHealthScore(responseTime: number, errorRate: number, cacheHitRate: number): number {
    let score = 100

    // 响应时间影响 (40%)
    if (responseTime > this.alertThresholds.maxResponseTime) {
      const penalty = Math.min(40, (responseTime / this.alertThresholds.maxResponseTime - 1) * 40)
      score -= penalty
    }

    // 错误率影响 (40%)
    if (errorRate > this.alertThresholds.maxErrorRate) {
      const penalty = Math.min(40, (errorRate / this.alertThresholds.maxErrorRate - 1) * 40)
      score -= penalty
    }

    // 缓存命中率影响 (20%)
    if (cacheHitRate < this.alertThresholds.minCacheHitRate) {
      const penalty = Math.min(20, (1 - cacheHitRate / this.alertThresholds.minCacheHitRate) * 20)
      score -= penalty
    }

    return Math.max(0, Math.min(100, score))
  }

  // 私有方法：定时刷新指标
  private startPeriodicFlush(): void {
    setInterval(async () => {
      if (this.metricsBuffer.length > 0) {
        await this.flushMetrics()
      }
    }, this.flushInterval)
  }

  // 私有方法：刷新指标到存储
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return

    try {
      const metrics = [...this.metricsBuffer]
      this.metricsBuffer = []

      // 聚合指标按操作和日期分组
      const aggregated = this.aggregateMetrics(metrics)

      // 保存聚合指标到缓存
      for (const [key, data] of aggregated.entries()) {
        const cacheKey = `${this.cachePrefix}aggregated:${key}`
        // **聚合性能指标缓存策略 - 30天TTL**
        // 原因：聚合指标用于长期趋势分析和容量规划，需要长期保存
        // - 30天：支持月度性能报告和长期趋势分析
        // - 聚合数据：经过处理的汇总数据，具有长期分析价值
        // - 适用场景：月度报告、容量规划、系统优化决策、历史对比分析
        await redis.setex(cacheKey, 30 * 24 * 60 * 60, JSON.stringify(data))
      }

      console.log(`刷新了 ${metrics.length} 个性能指标`)
    } catch (error) {
      console.error('刷新指标失败:', error)
    }
  }

  // 私有方法：聚合指标
  private aggregateMetrics(metrics: PerformanceMetrics[]): Map<string, AggregatedMetrics> {
    const grouped = new Map<string, PerformanceMetrics[]>()

    metrics.forEach(metric => {
      const date = new Date(metric.startTime).toISOString().split('T')[0]
      const key = `${date}:${metric.operation}`

      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(metric)
    })

    const aggregated = new Map<string, AggregatedMetrics>()

    grouped.forEach((metricsList, key) => {
      const [date, operation] = key.split(':')
      const totalRequests = metricsList.length
      const successfulRequests = metricsList.filter(m => m.success).length

      const durations = metricsList.map(m => m.duration).sort((a, b) => a - b)
      const averageResponseTime = durations.reduce((sum, d) => sum + d, 0) / durations.length
      const p95ResponseTime = durations[Math.floor(durations.length * 0.95)] || 0
      const p99ResponseTime = durations[Math.floor(durations.length * 0.99)] || 0

      const errorRate = ((totalRequests - successfulRequests) / totalRequests) * 100

      const cacheHits = metricsList.filter(m => m.metadata?.cacheHit).length
      const cacheHitRate = (cacheHits / totalRequests) * 100

      const fallbacks = metricsList.filter(m => m.metadata?.fallbackUsed).length
      const fallbackRate = (fallbacks / totalRequests) * 100

      aggregated.set(key, {
        date,
        operation,
        totalRequests,
        successfulRequests,
        averageResponseTime: Math.round(averageResponseTime),
        p95ResponseTime: Math.round(p95ResponseTime),
        p99ResponseTime: Math.round(p99ResponseTime),
        errorRate: Math.round(errorRate * 100) / 100,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
        fallbackRate: Math.round(fallbackRate * 100) / 100
      })
    })

    return aggregated
  }

  // 私有方法：从缓存获取聚合指标
  private async getAggregatedMetricsFromCache(
    operation?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<AggregatedMetrics[]> {
    try {
      const pattern = operation
        ? `${this.cachePrefix}aggregated:*:${operation}`
        : `${this.cachePrefix}aggregated:*`

      const keys = await redis.keys(pattern)
      const metrics: AggregatedMetrics[] = []

      for (const key of keys.slice(0, limit)) {
        const data = await redis.get(key)
        if (data) {
          const metric = JSON.parse(data) as AggregatedMetrics

          // 过滤日期范围
          const metricDate = new Date(metric.date)
          if (startDate && metricDate < startDate) continue
          if (endDate && metricDate > endDate) continue

          metrics.push(metric)
        }
      }

      return metrics.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    } catch (error) {
      console.error('从缓存获取聚合指标失败:', error)
      return []
    }
  }

  // 私有方法：生成请求ID
  private generateRequestId(operation: string): string {
    return `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export const searchPerformanceService = new SearchPerformanceService()