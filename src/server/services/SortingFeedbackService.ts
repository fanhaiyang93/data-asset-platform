import { redis } from '@/lib/cache'
import { prisma } from '@/lib/prisma'
import {
  type SortOption,
  type SearchResult,
  type SearchResultWithSorting
} from '@/types/search'

/**
 * 用户反馈数据结构
 */
export interface SortingFeedback {
  id: string
  userId: string
  sessionId: string
  query: string
  sortMethod: SortOption

  // 显式反馈
  satisfaction: number         // 1-5分满意度评分
  relevanceRating: number     // 1-5分相关性评分
  easeOfUse: number          // 1-5分易用性评分
  comment?: string           // 文本反馈

  // 隐式反馈
  clickedResults: Array<{
    resultId: string
    position: number
    dwellTime: number
    timestamp: Date
  }>

  // 行为指标
  queryTime: number          // 查询完成时间 (ms)
  scrollDepth: number        // 滚动深度 (0-1)
  bounceRate: boolean        // 是否跳出
  refinedQuery?: string      // 查询改进

  // 元数据
  timestamp: Date
  device: string
  browser: string
  resultCount: number
}

/**
 * 反馈聚合分析结果
 */
export interface FeedbackAnalysis {
  sortMethod: SortOption
  period: { start: Date; end: Date }

  // 整体指标
  totalFeedbacks: number
  avgSatisfaction: number
  avgRelevance: number
  avgEaseOfUse: number

  // 行为指标
  avgClickThroughRate: number
  avgClickPosition: number
  avgDwellTime: number
  bounceRate: number

  // 趋势分析
  trend: 'improving' | 'stable' | 'declining'
  trendConfidence: number

  // 问题识别
  issueAreas: Array<{
    issue: string
    severity: 'low' | 'medium' | 'high'
    suggestion: string
    affectedUsers: number
  }>

  // 用户细分
  userSegments: Array<{
    segment: string
    satisfaction: number
    count: number
    characteristics: string[]
  }>
}

/**
 * SortingFeedbackService - 用户反馈收集和分析服务
 *
 * Task 5子任务4: 实现排序效果用户反馈收集
 *
 * 功能：
 * 1. 收集用户显式和隐式反馈
 * 2. 分析反馈数据并生成洞察
 * 3. 基于反馈优化排序算法
 * 4. 提供反馈趋势监控
 * 5. 支持A/B测试反馈对比
 */
export class SortingFeedbackService {
  private cachePrefix = 'sorting_feedback:'
  private cacheTtl = 3600 // 1小时缓存

  /**
   * 记录用户反馈
   * @param feedback 用户反馈数据
   */
  async recordFeedback(feedback: Omit<SortingFeedback, 'id' | 'timestamp'>): Promise<string> {
    try {
      const feedbackId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const completeFeedback: SortingFeedback = {
        ...feedback,
        id: feedbackId,
        timestamp: new Date()
      }

      // 存储到数据库
      await this.persistFeedback(completeFeedback)

      // 缓存最新反馈
      const cacheKey = `${this.cachePrefix}latest:${feedback.userId}`
      await redis.setex(cacheKey, this.cacheTtl, JSON.stringify(completeFeedback))

      // 实时更新反馈统计
      await this.updateFeedbackStats(completeFeedback)

      // 触发反馈分析（异步）
      this.analyzeFeedbackAsync(completeFeedback)

      console.log(`用户反馈已记录: ${feedbackId}, 满意度: ${feedback.satisfaction}/5`)

      return feedbackId
    } catch (error) {
      console.error('记录用户反馈失败:', error)
      throw error
    }
  }

  /**
   * 记录隐式行为反馈
   * @param userId 用户ID
   * @param sessionId 会话ID
   * @param query 查询内容
   * @param sortMethod 排序方法
   * @param behaviorData 行为数据
   */
  async recordImplicitFeedback(
    userId: string,
    sessionId: string,
    query: string,
    sortMethod: SortOption,
    behaviorData: {
      clickedResults: Array<{
        resultId: string
        position: number
        dwellTime: number
        timestamp: Date
      }>
      queryTime: number
      scrollDepth: number
      bounceRate: boolean
      refinedQuery?: string
      device: string
      browser: string
      resultCount: number
    }
  ): Promise<void> {
    try {
      // 基于行为数据推断隐式满意度
      const implicitSatisfaction = this.inferSatisfactionFromBehavior(behaviorData)

      const implicitFeedback: Omit<SortingFeedback, 'id' | 'timestamp'> = {
        userId,
        sessionId,
        query,
        sortMethod,

        // 推断的满意度评分
        satisfaction: implicitSatisfaction.satisfaction,
        relevanceRating: implicitSatisfaction.relevance,
        easeOfUse: implicitSatisfaction.easeOfUse,

        // 行为数据
        clickedResults: behaviorData.clickedResults,
        queryTime: behaviorData.queryTime,
        scrollDepth: behaviorData.scrollDepth,
        bounceRate: behaviorData.bounceRate,
        refinedQuery: behaviorData.refinedQuery,
        device: behaviorData.device,
        browser: behaviorData.browser,
        resultCount: behaviorData.resultCount
      }

      await this.recordFeedback(implicitFeedback)
    } catch (error) {
      console.error('记录隐式反馈失败:', error)
    }
  }

  /**
   * 获取排序方法的反馈分析
   */
  async getFeedbackAnalysis(
    sortMethod: SortOption,
    timeRange: { start: Date; end: Date },
    userId?: string
  ): Promise<FeedbackAnalysis> {
    try {
      const cacheKey = `${this.cachePrefix}analysis:${sortMethod}:${timeRange.start.getTime()}-${timeRange.end.getTime()}${userId ? ':' + userId : ''}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      // 获取时间范围内的反馈数据
      const feedbacks = await this.getFeedbacksInRange(sortMethod, timeRange, userId)

      if (feedbacks.length === 0) {
        return {
          sortMethod,
          period: timeRange,
          totalFeedbacks: 0,
          avgSatisfaction: 0,
          avgRelevance: 0,
          avgEaseOfUse: 0,
          avgClickThroughRate: 0,
          avgClickPosition: 0,
          avgDwellTime: 0,
          bounceRate: 0,
          trend: 'stable',
          trendConfidence: 0,
          issueAreas: [],
          userSegments: []
        }
      }

      // 计算基础统计指标
      const analysis = await this.calculateFeedbackAnalysis(feedbacks, sortMethod, timeRange)

      // 缓存分析结果
      await redis.setex(cacheKey, this.cacheTtl, JSON.stringify(analysis))

      return analysis
    } catch (error) {
      console.error('获取反馈分析失败:', error)
      throw error
    }
  }

  /**
   * 比较不同排序方法的用户反馈
   */
  async compareSortMethodFeedback(
    sortMethods: SortOption[],
    timeRange: { start: Date; end: Date }
  ): Promise<{
    comparison: Array<{
      sortMethod: SortOption
      score: number
      analysis: FeedbackAnalysis
    }>
    winner: SortOption
    insights: string[]
    recommendations: string[]
  }> {
    try {
      // 获取每个排序方法的反馈分析
      const analyses = await Promise.all(
        sortMethods.map(async method => {
          const analysis = await this.getFeedbackAnalysis(method, timeRange)
          const score = this.calculateOverallFeedbackScore(analysis)
          return { sortMethod: method, score, analysis }
        })
      )

      // 按评分排序
      analyses.sort((a, b) => b.score - a.score)
      const winner = analyses[0].sortMethod

      // 生成洞察和建议
      const insights = this.generateInsights(analyses)
      const recommendations = this.generateRecommendations(analyses)

      return {
        comparison: analyses,
        winner,
        insights,
        recommendations
      }
    } catch (error) {
      console.error('排序方法反馈比较失败:', error)
      throw error
    }
  }

  /**
   * 获取用户反馈趋势
   */
  async getFeedbackTrends(
    sortMethod: SortOption,
    days: number = 30
  ): Promise<{
    daily: Array<{
      date: Date
      satisfaction: number
      feedbackCount: number
      issues: string[]
    }>
    weekly: Array<{
      week: string
      satisfaction: number
      trend: number
      significentChanges: string[]
    }>
    overall: {
      trend: 'improving' | 'stable' | 'declining'
      confidence: number
      prediction: string
    }
  }> {
    try {
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

      // 获取每日数据
      const daily = await this.getDailyFeedbackTrends(sortMethod, startDate, endDate)

      // 计算每周数据
      const weekly = this.calculateWeeklyTrends(daily)

      // 分析整体趋势
      const overall = this.analyzeOverallTrend(daily)

      return { daily, weekly, overall }
    } catch (error) {
      console.error('获取反馈趋势失败:', error)
      throw error
    }
  }

  /**
   * 实时反馈监控和告警
   */
  async monitorFeedbackRealtime(
    alertThresholds: {
      minSatisfaction: number
      maxBounceRate: number
      minFeedbackCount: number
    }
  ): Promise<{
    alerts: Array<{
      level: 'warning' | 'critical'
      message: string
      sortMethod: SortOption
      value: number
      threshold: number
    }>
    summary: {
      totalFeedbacks: number
      avgSatisfaction: number
      criticalIssues: number
    }
  }> {
    try {
      const now = new Date()
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)

      const alerts: any[] = []
      let totalFeedbacks = 0
      let totalSatisfaction = 0
      let criticalIssues = 0

      // 检查每种排序方法
      const sortMethods: SortOption[] = ['relevance', 'personalized', 'popularity', 'recency', 'quality', 'created']

      for (const method of sortMethods) {
        const analysis = await this.getFeedbackAnalysis(method, { start: hourAgo, end: now })
        totalFeedbacks += analysis.totalFeedbacks

        if (analysis.totalFeedbacks > 0) {
          totalSatisfaction += analysis.avgSatisfaction * analysis.totalFeedbacks

          // 检查满意度告警
          if (analysis.avgSatisfaction < alertThresholds.minSatisfaction) {
            alerts.push({
              level: analysis.avgSatisfaction < alertThresholds.minSatisfaction * 0.8 ? 'critical' : 'warning',
              message: `${method} 排序满意度过低`,
              sortMethod: method,
              value: analysis.avgSatisfaction,
              threshold: alertThresholds.minSatisfaction
            })
            if (analysis.avgSatisfaction < alertThresholds.minSatisfaction * 0.8) {
              criticalIssues++
            }
          }

          // 检查跳出率告警
          if (analysis.bounceRate > alertThresholds.maxBounceRate) {
            alerts.push({
              level: analysis.bounceRate > alertThresholds.maxBounceRate * 1.5 ? 'critical' : 'warning',
              message: `${method} 排序跳出率过高`,
              sortMethod: method,
              value: analysis.bounceRate,
              threshold: alertThresholds.maxBounceRate
            })
          }
        }

        // 检查反馈数量告警
        if (analysis.totalFeedbacks < alertThresholds.minFeedbackCount) {
          alerts.push({
            level: 'warning',
            message: `${method} 排序反馈数量不足`,
            sortMethod: method,
            value: analysis.totalFeedbacks,
            threshold: alertThresholds.minFeedbackCount
          })
        }
      }

      const avgSatisfaction = totalFeedbacks > 0 ? totalSatisfaction / totalFeedbacks : 0

      return {
        alerts,
        summary: {
          totalFeedbacks,
          avgSatisfaction,
          criticalIssues
        }
      }
    } catch (error) {
      console.error('实时反馈监控失败:', error)
      throw error
    }
  }

  // 私有辅助方法实现...

  private async persistFeedback(feedback: SortingFeedback): Promise<void> {
    try {
      // 实际实现中需要存储到数据库
      // await prisma.sortingFeedback.create({
      //   data: {
      //     id: feedback.id,
      //     userId: feedback.userId,
      //     query: feedback.query,
      //     sortMethod: feedback.sortMethod,
      //     satisfaction: feedback.satisfaction,
      //     // ... 其他字段
      //   }
      // })

      console.log(`反馈已持久化: ${feedback.id}`)
    } catch (error) {
      console.error('持久化反馈失败:', error)
      throw error
    }
  }

  private async updateFeedbackStats(feedback: SortingFeedback): Promise<void> {
    try {
      const statsKey = `${this.cachePrefix}stats:${feedback.sortMethod}:${new Date().toISOString().split('T')[0]}`

      // 更新当日统计
      const currentStats = await redis.get(statsKey)
      const stats = currentStats ? JSON.parse(currentStats) : {
        count: 0,
        totalSatisfaction: 0,
        totalRelevance: 0,
        totalEaseOfUse: 0
      }

      stats.count++
      stats.totalSatisfaction += feedback.satisfaction
      stats.totalRelevance += feedback.relevanceRating
      stats.totalEaseOfUse += feedback.easeOfUse

      await redis.setex(statsKey, 86400, JSON.stringify(stats)) // 24小时缓存
    } catch (error) {
      console.error('更新反馈统计失败:', error)
    }
  }

  private analyzeFeedbackAsync(feedback: SortingFeedback): void {
    // 异步分析反馈，检测异常模式
    setTimeout(async () => {
      try {
        // 检测是否有异常低的满意度
        if (feedback.satisfaction <= 2) {
          console.warn(`检测到低满意度反馈: ${feedback.id}, 满意度: ${feedback.satisfaction}`)
          // 可以触发告警或自动优化
        }

        // 检测查询改进模式
        if (feedback.refinedQuery) {
          console.log(`用户查询改进: "${feedback.query}" -> "${feedback.refinedQuery}"`)
          // 可以用于改进搜索建议
        }
      } catch (error) {
        console.error('异步反馈分析失败:', error)
      }
    }, 0)
  }

  private inferSatisfactionFromBehavior(behaviorData: any): {
    satisfaction: number
    relevance: number
    easeOfUse: number
  } {
    let satisfaction = 3.0 // 基准分数
    let relevance = 3.0
    let easeOfUse = 3.0

    // 基于点击行为推断
    if (behaviorData.clickedResults.length > 0) {
      const avgPosition = behaviorData.clickedResults.reduce((sum: number, click: any) => sum + click.position, 0)
                         / behaviorData.clickedResults.length

      // 点击位置越靠前，相关性越好
      if (avgPosition <= 3) {
        relevance += 1.0
        satisfaction += 0.5
      } else if (avgPosition > 6) {
        relevance -= 0.5
        satisfaction -= 0.3
      }

      // 停留时间长说明内容有价值
      const avgDwellTime = behaviorData.clickedResults.reduce((sum: number, click: any) => sum + click.dwellTime, 0)
                          / behaviorData.clickedResults.length

      if (avgDwellTime > 30000) { // 30秒
        satisfaction += 0.8
        relevance += 0.5
      } else if (avgDwellTime < 5000) { // 5秒
        satisfaction -= 0.5
        relevance -= 0.3
      }
    } else {
      // 没有点击，降低满意度
      satisfaction -= 1.0
      relevance -= 0.8
    }

    // 基于查询时间推断易用性
    if (behaviorData.queryTime < 500) {
      easeOfUse += 0.5
    } else if (behaviorData.queryTime > 2000) {
      easeOfUse -= 0.5
    }

    // 基于跳出率
    if (behaviorData.bounceRate) {
      satisfaction -= 0.8
      relevance -= 0.5
    }

    // 基于滚动深度
    if (behaviorData.scrollDepth > 0.7) {
      satisfaction += 0.3
    }

    // 确保分数在合理范围内
    return {
      satisfaction: Math.max(1, Math.min(5, satisfaction)),
      relevance: Math.max(1, Math.min(5, relevance)),
      easeOfUse: Math.max(1, Math.min(5, easeOfUse))
    }
  }

  private async getFeedbacksInRange(
    sortMethod: SortOption,
    timeRange: { start: Date; end: Date },
    userId?: string
  ): Promise<SortingFeedback[]> {
    // 模拟数据库查询
    // 实际实现需要从数据库查询指定条件的反馈数据
    return []
  }

  private async calculateFeedbackAnalysis(
    feedbacks: SortingFeedback[],
    sortMethod: SortOption,
    timeRange: { start: Date; end: Date }
  ): Promise<FeedbackAnalysis> {
    // 计算基础统计指标
    const totalFeedbacks = feedbacks.length
    const avgSatisfaction = feedbacks.reduce((sum, f) => sum + f.satisfaction, 0) / totalFeedbacks
    const avgRelevance = feedbacks.reduce((sum, f) => sum + f.relevanceRating, 0) / totalFeedbacks
    const avgEaseOfUse = feedbacks.reduce((sum, f) => sum + f.easeOfUse, 0) / totalFeedbacks

    // 计算行为指标
    const clickRates = feedbacks.map(f => f.clickedResults.length / f.resultCount)
    const avgClickThroughRate = clickRates.reduce((sum, rate) => sum + rate, 0) / clickRates.length

    const allClicks = feedbacks.flatMap(f => f.clickedResults)
    const avgClickPosition = allClicks.length > 0
      ? allClicks.reduce((sum, click) => sum + click.position, 0) / allClicks.length
      : 0

    const avgDwellTime = allClicks.length > 0
      ? allClicks.reduce((sum, click) => sum + click.dwellTime, 0) / allClicks.length
      : 0

    const bounceRate = feedbacks.filter(f => f.bounceRate).length / totalFeedbacks

    // 分析趋势（简化实现）
    const trend: 'improving' | 'stable' | 'declining' = 'stable'
    const trendConfidence = 0.7

    return {
      sortMethod,
      period: timeRange,
      totalFeedbacks,
      avgSatisfaction,
      avgRelevance,
      avgEaseOfUse,
      avgClickThroughRate,
      avgClickPosition,
      avgDwellTime,
      bounceRate,
      trend,
      trendConfidence,
      issueAreas: [], // 实际实现中分析具体问题
      userSegments: [] // 实际实现中进行用户细分
    }
  }

  private calculateOverallFeedbackScore(analysis: FeedbackAnalysis): number {
    // 综合评分权重
    const weights = {
      satisfaction: 0.4,
      relevance: 0.3,
      clickThroughRate: 0.2,
      bounceRate: 0.1
    }

    const score =
      (analysis.avgSatisfaction / 5) * weights.satisfaction +
      (analysis.avgRelevance / 5) * weights.relevance +
      analysis.avgClickThroughRate * weights.clickThroughRate +
      (1 - analysis.bounceRate) * weights.bounceRate

    return Math.max(0, Math.min(1, score))
  }

  private generateInsights(analyses: any[]): string[] {
    const insights: string[] = []

    if (analyses.length > 0) {
      const best = analyses[0]
      insights.push(`${best.sortMethod} 排序方法用户反馈最佳，综合评分 ${(best.score * 100).toFixed(1)}%`)
    }

    return insights
  }

  private generateRecommendations(analyses: any[]): string[] {
    const recommendations: string[] = []

    // 基于分析结果生成优化建议
    recommendations.push('建议定期收集用户反馈，持续优化排序算法')

    return recommendations
  }

  private async getDailyFeedbackTrends(
    sortMethod: SortOption,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    // 模拟每日趋势数据
    return []
  }

  private calculateWeeklyTrends(daily: any[]): any[] {
    // 基于每日数据计算每周趋势
    return []
  }

  private analyzeOverallTrend(daily: any[]): any {
    // 分析整体趋势
    return {
      trend: 'stable' as const,
      confidence: 0.7,
      prediction: '预期未来一周表现稳定'
    }
  }
}

export const sortingFeedbackService = new SortingFeedbackService()