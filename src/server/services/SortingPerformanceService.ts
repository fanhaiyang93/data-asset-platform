import { redis } from '@/lib/cache'
import { prisma } from '@/lib/prisma'
import {
  type SortOption,
  type SortingPerformance,
  type SortingFeedbackInput
} from '@/types/search'

/**
 * SortingPerformanceService - 排序性能监控和优化服务
 *
 * 功能：
 * 1. 性能指标收集和分析
 * 2. 用户满意度跟踪
 * 3. 排序算法效果评估
 * 4. 性能优化建议
 * 5. 实时监控和报警
 */
export class SortingPerformanceService {
  private cachePrefix = 'sorting_perf:'
  private metricsRetention = 86400 * 7 // 7天数据保留

  // 性能阈值配置
  private readonly performanceThresholds = {
    responseTime: {
      excellent: 100,   // <100ms 优秀
      good: 200,       // <200ms 良好
      acceptable: 300,  // <300ms 可接受
      poor: 500        // >500ms 需要优化
    },
    userSatisfaction: {
      excellent: 4.5,   // >4.5 优秀
      good: 4.0,       // >4.0 良好
      acceptable: 3.5,  // >3.5 可接受
      poor: 3.0        // <3.0 需要改进
    },
    clickThroughRate: {
      excellent: 0.25,  // >25% 优秀
      good: 0.20,      // >20% 良好
      acceptable: 0.15, // >15% 可接受
      poor: 0.10       // <10% 需要优化
    }
  }

  /**
   * 记录排序性能指标
   */
  async recordPerformanceMetrics(
    sortMethod: SortOption,
    responseTime: number,
    resultCount: number,
    userId?: string,
    query?: string
  ): Promise<void> {
    try {
      const timestamp = new Date()
      const metricKey = `${this.cachePrefix}metrics:${sortMethod}:${timestamp.toISOString().split('T')[0]}`

      // 获取当日累计指标
      const existingMetrics = await this.getDailyMetrics(sortMethod, timestamp)

      // 更新指标
      const updatedMetrics: SortingPerformance = {
        sortMethod,
        avgResponseTime: this.calculateRunningAverage(
          existingMetrics?.avgResponseTime || 0,
          responseTime,
          existingMetrics?.queryCount || 0
        ),
        queryCount: (existingMetrics?.queryCount || 0) + 1,
        userSatisfaction: existingMetrics?.userSatisfaction || 4.0, // 默认满意度
        clickThroughRate: existingMetrics?.clickThroughRate || 0.15, // 默认点击率
        timestamp
      }

      // 存储到Redis（带过期时间）
      await redis.setex(metricKey, this.metricsRetention, JSON.stringify(updatedMetrics))

      // 实时性能检查
      await this.checkPerformanceThresholds(updatedMetrics)

      // 记录详细日志用于后续分析
      if (responseTime > this.performanceThresholds.responseTime.poor) {
        console.warn(`排序性能警告: ${sortMethod} 响应时间 ${responseTime}ms 超过阈值`, {
          query,
          resultCount,
          userId,
          timestamp
        })
      }
    } catch (error) {
      console.error('记录排序性能指标失败:', error)
    }
  }

  /**
   * 记录用户满意度反馈
   */
  async recordUserFeedback(feedback: SortingFeedbackInput): Promise<void> {
    try {
      const timestamp = new Date()
      const feedbackKey = `${this.cachePrefix}feedback:${feedback.sortMethod}:${timestamp.toISOString().split('T')[0]}`

      // 更新用户满意度指标
      const dailyMetrics = await this.getDailyMetrics(feedback.sortMethod, timestamp)
      if (dailyMetrics) {
        // 计算新的平均满意度
        const totalFeedback = dailyMetrics.queryCount
        const currentAvgSatisfaction = dailyMetrics.userSatisfaction
        const newAvgSatisfaction = this.calculateRunningAverage(
          currentAvgSatisfaction,
          feedback.satisfactionScore,
          totalFeedback - 1
        )

        dailyMetrics.userSatisfaction = newAvgSatisfaction

        const metricKey = `${this.cachePrefix}metrics:${feedback.sortMethod}:${timestamp.toISOString().split('T')[0]}`
        await redis.setex(metricKey, this.metricsRetention, JSON.stringify(dailyMetrics))
      }

      // 存储详细反馈数据
      const feedbackData = {
        ...feedback,
        timestamp
      }

      await redis.lpush(feedbackKey, JSON.stringify(feedbackData))
      await redis.expire(feedbackKey, this.metricsRetention)

      console.log(`用户反馈已记录: ${feedback.sortMethod}, 满意度: ${feedback.satisfactionScore}`)
    } catch (error) {
      console.error('记录用户反馈失败:', error)
    }
  }

  /**
   * 更新点击率指标
   */
  async updateClickThroughRate(
    sortMethod: SortOption,
    totalImpressions: number,
    totalClicks: number
  ): Promise<void> {
    try {
      const timestamp = new Date()
      const dailyMetrics = await this.getDailyMetrics(sortMethod, timestamp)

      if (dailyMetrics && totalImpressions > 0) {
        const newCTR = totalClicks / totalImpressions
        dailyMetrics.clickThroughRate = newCTR

        const metricKey = `${this.cachePrefix}metrics:${sortMethod}:${timestamp.toISOString().split('T')[0]}`
        await redis.setex(metricKey, this.metricsRetention, JSON.stringify(dailyMetrics))

        console.log(`点击率已更新: ${sortMethod}, CTR: ${(newCTR * 100).toFixed(2)}%`)
      }
    } catch (error) {
      console.error('更新点击率失败:', error)
    }
  }

  /**
   * 获取性能分析报告
   */
  async getPerformanceReport(
    sortMethod?: SortOption,
    days: number = 7
  ): Promise<{
    summary: {
      totalQueries: number
      avgResponseTime: number
      avgUserSatisfaction: number
      avgClickThroughRate: number
      performanceGrade: string
    }
    trends: Array<{
      date: string
      responseTime: number
      userSatisfaction: number
      clickThroughRate: number
      queryCount: number
    }>
    recommendations: string[]
  }> {
    try {
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

      // 收集指定时间范围内的性能数据
      const metrics = await this.getMetricsInRange(startDate, endDate, sortMethod)

      // 计算汇总指标
      const summary = this.calculateSummaryMetrics(metrics)

      // 生成趋势数据
      const trends = this.generateTrendData(metrics, days)

      // 生成优化建议
      const recommendations = this.generateRecommendations(summary, metrics)

      return {
        summary,
        trends,
        recommendations
      }
    } catch (error) {
      console.error('获取性能分析报告失败:', error)
      return {
        summary: {
          totalQueries: 0,
          avgResponseTime: 0,
          avgUserSatisfaction: 0,
          avgClickThroughRate: 0,
          performanceGrade: 'N/A'
        },
        trends: [],
        recommendations: ['数据收集不足，无法生成建议']
      }
    }
  }

  /**
   * 获取实时性能状态
   */
  async getRealTimeStatus(): Promise<{
    sortMethods: Array<{
      method: SortOption
      status: 'excellent' | 'good' | 'acceptable' | 'poor'
      responseTime: number
      userSatisfaction: number
      clickThroughRate: number
      queryCount: number
    }>
    alerts: string[]
    overallHealth: 'healthy' | 'warning' | 'critical'
  }> {
    try {
      const today = new Date()
      const sortMethods: SortOption[] = ['relevance', 'popularity', 'recency', 'quality', 'personalized']

      const methodStatus = await Promise.all(
        sortMethods.map(async (method) => {
          const metrics = await this.getDailyMetrics(method, today)
          const status = this.evaluatePerformanceStatus(metrics)

          return {
            method,
            status,
            responseTime: metrics?.avgResponseTime || 0,
            userSatisfaction: metrics?.userSatisfaction || 0,
            clickThroughRate: metrics?.clickThroughRate || 0,
            queryCount: metrics?.queryCount || 0
          }
        })
      )

      // 生成警报
      const alerts = this.generateAlerts(methodStatus)

      // 评估整体健康状态
      const overallHealth = this.evaluateOverallHealth(methodStatus)

      return {
        sortMethods: methodStatus,
        alerts,
        overallHealth
      }
    } catch (error) {
      console.error('获取实时性能状态失败:', error)
      return {
        sortMethods: [],
        alerts: ['无法获取性能状态'],
        overallHealth: 'critical'
      }
    }
  }

  /**
   * 性能优化建议
   */
  async getOptimizationSuggestions(sortMethod: SortOption): Promise<{
    priority: 'high' | 'medium' | 'low'
    suggestions: Array<{
      type: 'algorithm' | 'caching' | 'infrastructure' | 'configuration'
      description: string
      expectedImpact: string
      effort: 'low' | 'medium' | 'high'
    }>
  }> {
    try {
      const metrics = await this.getDailyMetrics(sortMethod, new Date())
      const suggestions = []

      if (!metrics) {
        return {
          priority: 'low',
          suggestions: [
            {
              type: 'infrastructure',
              description: '收集更多性能数据以生成准确建议',
              expectedImpact: '提供数据驱动的优化方向',
              effort: 'low'
            }
          ]
        }
      }

      // 响应时间优化建议
      if (metrics.avgResponseTime > this.performanceThresholds.responseTime.acceptable) {
        suggestions.push({
          type: 'caching',
          description: '增加排序结果缓存层，减少重复计算',
          expectedImpact: '响应时间减少30-50%',
          effort: 'medium'
        })

        suggestions.push({
          type: 'algorithm',
          description: '优化评分算法，减少不必要的计算步骤',
          expectedImpact: '响应时间减少20-30%',
          effort: 'high'
        })
      }

      // 用户满意度优化建议
      if (metrics.userSatisfaction < this.performanceThresholds.userSatisfaction.acceptable) {
        suggestions.push({
          type: 'algorithm',
          description: '调整个性化权重，提高结果相关性',
          expectedImpact: '用户满意度提升15-25%',
          effort: 'medium'
        })

        suggestions.push({
          type: 'configuration',
          description: '启用A/B测试，验证不同权重配置效果',
          expectedImpact: '找到最优配置，满意度提升10-20%',
          effort: 'low'
        })
      }

      // 点击率优化建议
      if (metrics.clickThroughRate < this.performanceThresholds.clickThroughRate.acceptable) {
        suggestions.push({
          type: 'algorithm',
          description: '增强相关性评分算法，提高结果准确性',
          expectedImpact: '点击率提升20-40%',
          effort: 'high'
        })
      }

      // 确定优先级
      const priority = this.determinePriority(metrics)

      return { priority, suggestions }
    } catch (error) {
      console.error('获取优化建议失败:', error)
      return {
        priority: 'low',
        suggestions: []
      }
    }
  }

  /**
   * 获取每日性能指标
   */
  private async getDailyMetrics(sortMethod: SortOption, date: Date): Promise<SortingPerformance | null> {
    try {
      const dateKey = date.toISOString().split('T')[0]
      const metricKey = `${this.cachePrefix}metrics:${sortMethod}:${dateKey}`

      const cached = await redis.get(metricKey)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      console.error('获取每日指标失败:', error)
      return null
    }
  }

  /**
   * 计算滑动平均值
   */
  private calculateRunningAverage(currentAvg: number, newValue: number, count: number): number {
    if (count === 0) return newValue
    return (currentAvg * count + newValue) / (count + 1)
  }

  /**
   * 检查性能阈值
   */
  private async checkPerformanceThresholds(metrics: SortingPerformance): Promise<void> {
    const alerts = []

    if (metrics.avgResponseTime > this.performanceThresholds.responseTime.poor) {
      alerts.push(`${metrics.sortMethod} 响应时间过慢: ${metrics.avgResponseTime}ms`)
    }

    if (metrics.userSatisfaction < this.performanceThresholds.userSatisfaction.poor) {
      alerts.push(`${metrics.sortMethod} 用户满意度过低: ${metrics.userSatisfaction}`)
    }

    if (metrics.clickThroughRate < this.performanceThresholds.clickThroughRate.poor) {
      alerts.push(`${metrics.sortMethod} 点击率过低: ${(metrics.clickThroughRate * 100).toFixed(1)}%`)
    }

    if (alerts.length > 0) {
      console.warn('性能警报:', alerts)
      // 这里可以发送到监控系统或通知服务
    }
  }

  /**
   * 收集指定时间范围内的指标
   */
  private async getMetricsInRange(
    startDate: Date,
    endDate: Date,
    sortMethod?: SortOption
  ): Promise<SortingPerformance[]> {
    const metrics: SortingPerformance[] = []
    const sortMethods = sortMethod ? [sortMethod] : ['relevance', 'popularity', 'recency', 'quality', 'personalized'] as SortOption[]

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      for (const method of sortMethods) {
        const dailyMetrics = await this.getDailyMetrics(method, date)
        if (dailyMetrics) {
          metrics.push(dailyMetrics)
        }
      }
    }

    return metrics
  }

  /**
   * 计算汇总指标
   */
  private calculateSummaryMetrics(metrics: SortingPerformance[]) {
    if (metrics.length === 0) {
      return {
        totalQueries: 0,
        avgResponseTime: 0,
        avgUserSatisfaction: 0,
        avgClickThroughRate: 0,
        performanceGrade: 'N/A'
      }
    }

    const totalQueries = metrics.reduce((sum, m) => sum + m.queryCount, 0)
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.avgResponseTime * m.queryCount, 0) / totalQueries
    const avgUserSatisfaction = metrics.reduce((sum, m) => sum + m.userSatisfaction * m.queryCount, 0) / totalQueries
    const avgClickThroughRate = metrics.reduce((sum, m) => sum + m.clickThroughRate * m.queryCount, 0) / totalQueries

    const performanceGrade = this.calculatePerformanceGrade(avgResponseTime, avgUserSatisfaction, avgClickThroughRate)

    return {
      totalQueries,
      avgResponseTime,
      avgUserSatisfaction,
      avgClickThroughRate,
      performanceGrade
    }
  }

  /**
   * 生成趋势数据
   */
  private generateTrendData(metrics: SortingPerformance[], days: number) {
    const trends = []
    const endDate = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000)
      const dateKey = date.toISOString().split('T')[0]

      const dayMetrics = metrics.filter(m =>
        m.timestamp.toISOString().split('T')[0] === dateKey
      )

      if (dayMetrics.length > 0) {
        const totalQueries = dayMetrics.reduce((sum, m) => sum + m.queryCount, 0)

        trends.push({
          date: dateKey,
          responseTime: dayMetrics.reduce((sum, m) => sum + m.avgResponseTime * m.queryCount, 0) / totalQueries,
          userSatisfaction: dayMetrics.reduce((sum, m) => sum + m.userSatisfaction * m.queryCount, 0) / totalQueries,
          clickThroughRate: dayMetrics.reduce((sum, m) => sum + m.clickThroughRate * m.queryCount, 0) / totalQueries,
          queryCount: totalQueries
        })
      } else {
        trends.push({
          date: dateKey,
          responseTime: 0,
          userSatisfaction: 0,
          clickThroughRate: 0,
          queryCount: 0
        })
      }
    }

    return trends
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(summary: any, metrics: SortingPerformance[]): string[] {
    const recommendations = []

    if (summary.avgResponseTime > this.performanceThresholds.responseTime.acceptable) {
      recommendations.push('建议增加缓存层以提升响应速度')
    }

    if (summary.avgUserSatisfaction < this.performanceThresholds.userSatisfaction.acceptable) {
      recommendations.push('建议调整个性化权重以提升用户满意度')
    }

    if (summary.avgClickThroughRate < this.performanceThresholds.clickThroughRate.acceptable) {
      recommendations.push('建议优化相关性算法以提高点击率')
    }

    if (summary.totalQueries < 100) {
      recommendations.push('数据样本较少，建议收集更多数据后再优化')
    }

    return recommendations
  }

  /**
   * 评估性能状态
   */
  private evaluatePerformanceStatus(metrics: SortingPerformance | null): 'excellent' | 'good' | 'acceptable' | 'poor' {
    if (!metrics) return 'poor'

    const rtStatus = this.getThresholdStatus(metrics.avgResponseTime, this.performanceThresholds.responseTime, true)
    const satStatus = this.getThresholdStatus(metrics.userSatisfaction, this.performanceThresholds.userSatisfaction, false)
    const ctrStatus = this.getThresholdStatus(metrics.clickThroughRate, this.performanceThresholds.clickThroughRate, false)

    // 取最差的状态作为整体状态
    const statuses = [rtStatus, satStatus, ctrStatus]
    if (statuses.includes('poor')) return 'poor'
    if (statuses.includes('acceptable')) return 'acceptable'
    if (statuses.includes('good')) return 'good'
    return 'excellent'
  }

  /**
   * 获取阈值状态
   */
  private getThresholdStatus(
    value: number,
    thresholds: any,
    lowerIsBetter: boolean
  ): 'excellent' | 'good' | 'acceptable' | 'poor' {
    if (lowerIsBetter) {
      if (value <= thresholds.excellent) return 'excellent'
      if (value <= thresholds.good) return 'good'
      if (value <= thresholds.acceptable) return 'acceptable'
      return 'poor'
    } else {
      if (value >= thresholds.excellent) return 'excellent'
      if (value >= thresholds.good) return 'good'
      if (value >= thresholds.acceptable) return 'acceptable'
      return 'poor'
    }
  }

  /**
   * 生成警报
   */
  private generateAlerts(methodStatus: any[]): string[] {
    const alerts = []

    const poorMethods = methodStatus.filter(m => m.status === 'poor')
    if (poorMethods.length > 0) {
      alerts.push(`以下排序方法性能较差: ${poorMethods.map(m => m.method).join(', ')}`)
    }

    const lowQueryMethods = methodStatus.filter(m => m.queryCount < 10)
    if (lowQueryMethods.length > 0) {
      alerts.push(`以下排序方法使用率较低: ${lowQueryMethods.map(m => m.method).join(', ')}`)
    }

    return alerts
  }

  /**
   * 评估整体健康状态
   */
  private evaluateOverallHealth(methodStatus: any[]): 'healthy' | 'warning' | 'critical' {
    const poorCount = methodStatus.filter(m => m.status === 'poor').length
    const acceptableCount = methodStatus.filter(m => m.status === 'acceptable').length

    if (poorCount > 0) return 'critical'
    if (acceptableCount > methodStatus.length / 2) return 'warning'
    return 'healthy'
  }

  /**
   * 计算性能等级
   */
  private calculatePerformanceGrade(responseTime: number, satisfaction: number, ctr: number): string {
    const rtGrade = this.getThresholdStatus(responseTime, this.performanceThresholds.responseTime, true)
    const satGrade = this.getThresholdStatus(satisfaction, this.performanceThresholds.userSatisfaction, false)
    const ctrGrade = this.getThresholdStatus(ctr, this.performanceThresholds.clickThroughRate, false)

    // 简单的等级计算
    const gradeScores = { excellent: 4, good: 3, acceptable: 2, poor: 1 }
    const avgScore = (gradeScores[rtGrade] + gradeScores[satGrade] + gradeScores[ctrGrade]) / 3

    if (avgScore >= 3.5) return 'A'
    if (avgScore >= 2.5) return 'B'
    if (avgScore >= 1.5) return 'C'
    return 'D'
  }

  /**
   * 确定优化优先级
   */
  private determinePriority(metrics: SortingPerformance): 'high' | 'medium' | 'low' {
    const issues = []

    if (metrics.avgResponseTime > this.performanceThresholds.responseTime.poor) {
      issues.push('high')
    }
    if (metrics.userSatisfaction < this.performanceThresholds.userSatisfaction.poor) {
      issues.push('high')
    }
    if (metrics.clickThroughRate < this.performanceThresholds.clickThroughRate.poor) {
      issues.push('medium')
    }

    if (issues.includes('high')) return 'high'
    if (issues.includes('medium')) return 'medium'
    return 'low'
  }
}

export const sortingPerformanceService = new SortingPerformanceService()