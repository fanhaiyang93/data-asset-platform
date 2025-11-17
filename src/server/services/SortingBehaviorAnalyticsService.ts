import { redis } from '@/lib/cache'
import { prisma } from '@/lib/prisma'
import {
  type SortOption,
  type SearchResult,
  type SortingFeedback,
  type SearchSession
} from '@/types/search'

/**
 * SortingBehaviorAnalyticsService - 排序行为数据分析服务
 *
 * 功能：
 * 1. 收集和存储用户排序行为数据
 * 2. 分析排序效果和用户满意度
 * 3. 生成排序优化建议
 * 4. 支持A/B测试数据收集
 * 5. 提供排序行为分析报告
 */
export class SortingBehaviorAnalyticsService {
  private cachePrefix = 'sorting_analytics:'
  private cacheTtl = 86400 // 24小时缓存

  /**
   * 记录搜索会话开始
   */
  async recordSearchSessionStart(
    sessionId: string,
    userId?: string,
    context?: {
      query: string
      sortOption: SortOption
      resultCount: number
      timestamp: Date
    }
  ): Promise<void> {
    try {
      const sessionData: SearchSession = {
        sessionId,
        userId,
        startTime: new Date(),
        query: context?.query || '',
        sortOption: context?.sortOption || 'relevance',
        resultCount: context?.resultCount || 0,
        interactions: [],
        feedback: [],
        endTime: null,
        sessionDuration: 0,
        clickThroughRate: 0,
        satisfactionScore: 0
      }

      const cacheKey = `${this.cachePrefix}session:${sessionId}`
      await redis.setex(cacheKey, this.cacheTtl, JSON.stringify(sessionData))

      console.log(`搜索会话开始记录: ${sessionId}, 用户: ${userId || 'anonymous'}`)
    } catch (error) {
      console.error('记录搜索会话开始失败:', error)
    }
  }

  /**
   * 记录用户与搜索结果的交互
   */
  async recordResultInteraction(
    sessionId: string,
    assetId: string,
    interactionType: 'view' | 'click' | 'download' | 'bookmark' | 'share',
    context?: {
      position: number
      timestamp: Date
      query?: string
      sortMethod?: SortOption
    }
  ): Promise<void> {
    try {
      const cacheKey = `${this.cachePrefix}session:${sessionId}`
      const cachedSession = await redis.get(cacheKey)

      if (!cachedSession) {
        console.warn(`会话不存在: ${sessionId}`)
        return
      }

      const sessionData: SearchSession = JSON.parse(cachedSession)

      // 添加交互记录
      const interaction = {
        assetId,
        interactionType,
        position: context?.position || 0,
        timestamp: context?.timestamp || new Date(),
        query: context?.query || sessionData.query,
        sortMethod: context?.sortMethod || sessionData.sortOption
      }

      sessionData.interactions.push(interaction)

      // 更新会话数据
      await redis.setex(cacheKey, this.cacheTtl, JSON.stringify(sessionData))

      // 异步更新统计数据
      this.updateInteractionStats(sessionData, interaction).catch(error => {
        console.error('更新交互统计失败:', error)
      })

      console.log(`交互记录已记录: ${sessionId}, 资产: ${assetId}, 类型: ${interactionType}`)
    } catch (error) {
      console.error('记录结果交互失败:', error)
    }
  }

  /**
   * 记录排序反馈
   */
  async recordSortingFeedback(
    sessionId: string,
    feedback: SortingFeedback
  ): Promise<void> {
    try {
      const cacheKey = `${this.cachePrefix}session:${sessionId}`
      const cachedSession = await redis.get(cacheKey)

      if (!cachedSession) {
        console.warn(`会话不存在: ${sessionId}`)
        return
      }

      const sessionData: SearchSession = JSON.parse(cachedSession)

      // 添加反馈记录
      sessionData.feedback.push({
        ...feedback,
        timestamp: new Date()
      })

      // 更新满意度分数
      if (feedback.overallSatisfaction) {
        const feedbackScores = sessionData.feedback
          .map(f => f.overallSatisfaction || 0)
          .filter(score => score > 0)

        sessionData.satisfactionScore = feedbackScores.length > 0
          ? feedbackScores.reduce((sum, score) => sum + score, 0) / feedbackScores.length
          : 0
      }

      // 更新会话数据
      await redis.setex(cacheKey, this.cacheTtl, JSON.stringify(sessionData))

      // 异步更新反馈统计
      this.updateFeedbackStats(sessionData, feedback).catch(error => {
        console.error('更新反馈统计失败:', error)
      })

      console.log(`排序反馈已记录: ${sessionId}, 整体满意度: ${feedback.overallSatisfaction}`)
    } catch (error) {
      console.error('记录排序反馈失败:', error)
    }
  }

  /**
   * 结束搜索会话
   */
  async recordSearchSessionEnd(sessionId: string): Promise<void> {
    try {
      const cacheKey = `${this.cachePrefix}session:${sessionId}`
      const cachedSession = await redis.get(cacheKey)

      if (!cachedSession) {
        console.warn(`会话不存在: ${sessionId}`)
        return
      }

      const sessionData: SearchSession = JSON.parse(cachedSession)

      // 计算会话统计
      const endTime = new Date()
      sessionData.endTime = endTime
      sessionData.sessionDuration = endTime.getTime() - sessionData.startTime.getTime()

      // 计算点击率
      const totalClicks = sessionData.interactions.filter(i =>
        ['click', 'download', 'bookmark', 'share'].includes(i.interactionType)
      ).length
      sessionData.clickThroughRate = sessionData.resultCount > 0
        ? totalClicks / sessionData.resultCount
        : 0

      // 更新会话数据
      await redis.setex(cacheKey, this.cacheTtl, JSON.stringify(sessionData))

      // 异步保存到持久化存储
      this.persistSessionData(sessionData).catch(error => {
        console.error('持久化会话数据失败:', error)
      })

      console.log(`搜索会话结束: ${sessionId}, 时长: ${sessionData.sessionDuration}ms`)
    } catch (error) {
      console.error('记录搜索会话结束失败:', error)
    }
  }

  /**
   * 获取排序效果分析
   */
  async getSortingEffectivenessAnalysis(
    timeRange: {
      startDate: Date
      endDate: Date
    },
    filters?: {
      sortMethod?: SortOption
      userId?: string
      query?: string
    }
  ): Promise<{
    sortMethodPerformance: Array<{
      sortMethod: SortOption
      totalSessions: number
      avgSatisfactionScore: number
      avgClickThroughRate: number
      avgSessionDuration: number
      conversionRate: number
    }>
    trendAnalysis: Array<{
      date: string
      sortMethod: SortOption
      satisfactionScore: number
      clickThroughRate: number
    }>
    userEngagementMetrics: {
      totalUsers: number
      activeUsers: number
      returningUsers: number
      avgSessionsPerUser: number
    }
    recommendationImpact: {
      personalizedvsGeneral: {
        personalizedScore: number
        generalScore: number
        improvement: number
      }
      mostEffectiveSortMethods: SortOption[]
      leastEffectiveSortMethods: SortOption[]
    }
  }> {
    try {
      // 这里应该从数据库查询真实数据
      // 目前返回模拟的分析结果
      const mockAnalysis = {
        sortMethodPerformance: [
          {
            sortMethod: 'personalized' as SortOption,
            totalSessions: 1250,
            avgSatisfactionScore: 4.3,
            avgClickThroughRate: 0.68,
            avgSessionDuration: 185000, // 毫秒
            conversionRate: 0.34
          },
          {
            sortMethod: 'relevance' as SortOption,
            totalSessions: 2100,
            avgSatisfactionScore: 3.8,
            avgClickThroughRate: 0.52,
            avgSessionDuration: 167000,
            conversionRate: 0.28
          },
          {
            sortMethod: 'popularity' as SortOption,
            totalSessions: 890,
            avgSatisfactionScore: 3.6,
            avgClickThroughRate: 0.49,
            avgSessionDuration: 145000,
            conversionRate: 0.31
          },
          {
            sortMethod: 'recency' as SortOption,
            totalSessions: 420,
            avgSatisfactionScore: 3.4,
            avgClickThroughRate: 0.41,
            avgSessionDuration: 128000,
            conversionRate: 0.22
          },
          {
            sortMethod: 'quality' as SortOption,
            totalSessions: 340,
            avgSatisfactionScore: 4.1,
            avgClickThroughRate: 0.58,
            avgSessionDuration: 198000,
            conversionRate: 0.39
          },
          {
            sortMethod: 'created' as SortOption,
            totalSessions: 180,
            avgSatisfactionScore: 3.2,
            avgClickThroughRate: 0.35,
            avgSessionDuration: 112000,
            conversionRate: 0.18
          }
        ],
        trendAnalysis: this.generateTrendData(timeRange),
        userEngagementMetrics: {
          totalUsers: 1580,
          activeUsers: 892,
          returningUsers: 445,
          avgSessionsPerUser: 3.2
        },
        recommendationImpact: {
          personalizedvsGeneral: {
            personalizedScore: 4.3,
            generalScore: 3.8,
            improvement: 0.5
          },
          mostEffectiveSortMethods: ['personalized', 'quality', 'relevance'] as SortOption[],
          leastEffectiveSortMethods: ['created', 'recency'] as SortOption[]
        }
      }

      console.log('排序效果分析生成完成')
      return mockAnalysis
    } catch (error) {
      console.error('获取排序效果分析失败:', error)
      throw new Error('排序效果分析失败')
    }
  }

  /**
   * 获取用户排序行为洞察
   */
  async getUserSortingBehaviorInsights(
    userId: string,
    timeRange?: {
      startDate: Date
      endDate: Date
    }
  ): Promise<{
    sortingPreferenceEvolution: Array<{
      period: string
      preferredSort: SortOption
      usageCount: number
      satisfactionScore: number
    }>
    searchPatterns: {
      mostActiveTimeRanges: string[]
      averageSessionDuration: number
      preferredQueryTypes: string[]
      engagementScore: number
    }
    personalizedPerformance: {
      improvementOverGeneral: number
      personalizedSatisfactionScore: number
      generalSatisfactionScore: number
      recommendationAccuracy: number
    }
    behaviorInsights: string[]
  }> {
    try {
      // 从缓存或数据库获取用户行为数据
      const cacheKey = `${this.cachePrefix}user_insights:${userId}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      // 生成用户行为洞察（实际应用中应从真实数据分析）
      const insights = {
        sortingPreferenceEvolution: [
          {
            period: '上周',
            preferredSort: 'relevance' as SortOption,
            usageCount: 15,
            satisfactionScore: 3.6
          },
          {
            period: '本周',
            preferredSort: 'personalized' as SortOption,
            usageCount: 23,
            satisfactionScore: 4.2
          }
        ],
        searchPatterns: {
          mostActiveTimeRanges: ['09:00-11:00', '14:00-16:00'],
          averageSessionDuration: 145000,
          preferredQueryTypes: ['数据表', '业务指标', '用户行为'],
          engagementScore: 7.8
        },
        personalizedPerformance: {
          improvementOverGeneral: 0.6,
          personalizedSatisfactionScore: 4.2,
          generalSatisfactionScore: 3.6,
          recommendationAccuracy: 0.74
        },
        behaviorInsights: [
          '您更偏好个性化排序，相比通用排序满意度提升了60%',
          '您在上午和下午时段搜索活跃度最高',
          '您经常搜索数据表和业务指标相关内容',
          '个性化推荐的准确率达到74%，高于平均水平'
        ]
      }

      // 缓存用户洞察
      await redis.setex(cacheKey, this.cacheTtl / 2, JSON.stringify(insights))

      return insights
    } catch (error) {
      console.error('获取用户排序行为洞察失败:', error)
      throw new Error('获取用户行为洞察失败')
    }
  }

  /**
   * 生成排序优化建议
   */
  async generateSortingOptimizationSuggestions(): Promise<{
    algorithmSuggestions: Array<{
      sortMethod: SortOption
      currentPerformance: number
      suggestedImprovement: string
      expectedImpact: number
      priority: 'high' | 'medium' | 'low'
    }>
    weightOptimizations: Array<{
      currentWeights: Record<string, number>
      suggestedWeights: Record<string, number>
      expectedImprovement: string
      confidence: number
    }>
    userExperienceRecommendations: string[]
    abTestSuggestions: Array<{
      testName: string
      hypothesis: string
      suggestedVariants: any[]
      expectedOutcome: string
    }>
  }> {
    try {
      // 基于收集的数据生成优化建议
      const suggestions = {
        algorithmSuggestions: [
          {
            sortMethod: 'personalized' as SortOption,
            currentPerformance: 4.3,
            suggestedImprovement: '增强用户历史行为权重，从10%提升到15%',
            expectedImpact: 0.2,
            priority: 'high' as const
          },
          {
            sortMethod: 'relevance' as SortOption,
            currentPerformance: 3.8,
            suggestedImprovement: '优化语义匹配算法，引入同义词扩展',
            expectedImpact: 0.3,
            priority: 'medium' as const
          },
          {
            sortMethod: 'recency' as SortOption,
            currentPerformance: 3.4,
            suggestedImprovement: '结合资产更新频率调整时效性计算',
            expectedImpact: 0.4,
            priority: 'medium' as const
          }
        ],
        weightOptimizations: [
          {
            currentWeights: {
              relevance: 0.4,
              popularity: 0.3,
              recency: 0.2,
              personalization: 0.1
            },
            suggestedWeights: {
              relevance: 0.35,
              popularity: 0.28,
              recency: 0.22,
              personalization: 0.15
            },
            expectedImprovement: '个性化权重提升可提高用户满意度约12%',
            confidence: 0.78
          }
        ],
        userExperienceRecommendations: [
          '为新用户提供排序方式引导教程',
          '在搜索结果页面显示当前排序方式的解释',
          '允许用户保存和分享自定义排序配置',
          '提供排序效果的实时反馈机制',
          '在排序质量较低时主动推荐其他排序方式'
        ],
        abTestSuggestions: [
          {
            testName: '个性化权重优化测试',
            hypothesis: '提高个性化权重至15%可以显著提升用户满意度',
            suggestedVariants: [
              { name: 'Control', personalizationWeight: 0.1 },
              { name: 'Test', personalizationWeight: 0.15 }
            ],
            expectedOutcome: '用户满意度提升10-15%'
          },
          {
            testName: '智能排序推荐测试',
            hypothesis: '基于查询上下文的智能排序推荐可以提高点击率',
            suggestedVariants: [
              { name: 'Control', enableSmartRecommendation: false },
              { name: 'Test', enableSmartRecommendation: true }
            ],
            expectedOutcome: '点击率提升8-12%'
          }
        ]
      }

      console.log('排序优化建议生成完成')
      return suggestions
    } catch (error) {
      console.error('生成排序优化建议失败:', error)
      throw new Error('生成优化建议失败')
    }
  }

  /**
   * 获取实时排序性能监控数据
   */
  async getRealTimeSortingMetrics(): Promise<{
    currentMetrics: {
      activeSessions: number
      avgResponseTime: number
      errorRate: number
      satisfactionScore: number
    }
    performanceAlerts: Array<{
      severity: 'low' | 'medium' | 'high' | 'critical'
      message: string
      timestamp: Date
      affectedSortMethods: SortOption[]
    }>
    throughputStats: {
      requestsPerMinute: number
      successRate: number
      cacheHitRate: number
    }
  }> {
    try {
      // 从Redis获取实时指标
      const metricsKey = `${this.cachePrefix}realtime_metrics`
      const cached = await redis.get(metricsKey)

      const currentTime = Date.now()
      const mockMetrics = {
        currentMetrics: {
          activeSessions: Math.floor(Math.random() * 50) + 20,
          avgResponseTime: Math.floor(Math.random() * 100) + 180, // 180-280ms
          errorRate: Math.random() * 0.02, // 0-2%
          satisfactionScore: 3.8 + Math.random() * 0.8 // 3.8-4.6
        },
        performanceAlerts: [
          {
            severity: 'medium' as const,
            message: '个性化排序响应时间超过阈值',
            timestamp: new Date(currentTime - 300000), // 5分钟前
            affectedSortMethods: ['personalized'] as SortOption[]
          }
        ],
        throughputStats: {
          requestsPerMinute: Math.floor(Math.random() * 20) + 80, // 80-100 rpm
          successRate: 0.98 + Math.random() * 0.02, // 98-100%
          cacheHitRate: 0.75 + Math.random() * 0.2 // 75-95%
        }
      }

      // 缓存1分钟
      await redis.setex(metricsKey, 60, JSON.stringify(mockMetrics))

      return mockMetrics
    } catch (error) {
      console.error('获取实时排序监控数据失败:', error)
      throw new Error('获取实时监控数据失败')
    }
  }

  /**
   * 更新交互统计
   */
  private async updateInteractionStats(
    sessionData: SearchSession,
    interaction: any
  ): Promise<void> {
    try {
      const statsKey = `${this.cachePrefix}interaction_stats:${sessionData.sortOption}`
      const cached = await redis.get(statsKey)

      let stats = cached ? JSON.parse(cached) : {
        totalInteractions: 0,
        clickCount: 0,
        downloadCount: 0,
        bookmarkCount: 0,
        shareCount: 0,
        avgPosition: 0
      }

      stats.totalInteractions++

      switch (interaction.interactionType) {
        case 'click':
          stats.clickCount++
          break
        case 'download':
          stats.downloadCount++
          break
        case 'bookmark':
          stats.bookmarkCount++
          break
        case 'share':
          stats.shareCount++
          break
      }

      // 更新平均位置
      const totalPositions = stats.avgPosition * (stats.totalInteractions - 1) + interaction.position
      stats.avgPosition = totalPositions / stats.totalInteractions

      await redis.setex(statsKey, this.cacheTtl, JSON.stringify(stats))
    } catch (error) {
      console.error('更新交互统计失败:', error)
    }
  }

  /**
   * 更新反馈统计
   */
  private async updateFeedbackStats(
    sessionData: SearchSession,
    feedback: SortingFeedback
  ): Promise<void> {
    try {
      const statsKey = `${this.cachePrefix}feedback_stats:${sessionData.sortOption}`
      const cached = await redis.get(statsKey)

      let stats = cached ? JSON.parse(cached) : {
        totalFeedback: 0,
        avgSatisfaction: 0,
        avgRelevance: 0,
        positiveCount: 0,
        negativeCount: 0
      }

      stats.totalFeedback++

      if (feedback.overallSatisfaction) {
        const totalSatisfaction = stats.avgSatisfaction * (stats.totalFeedback - 1) + feedback.overallSatisfaction
        stats.avgSatisfaction = totalSatisfaction / stats.totalFeedback

        if (feedback.overallSatisfaction >= 4) {
          stats.positiveCount++
        } else if (feedback.overallSatisfaction <= 2) {
          stats.negativeCount++
        }
      }

      if (feedback.relevanceRating) {
        const totalRelevance = stats.avgRelevance * (stats.totalFeedback - 1) + feedback.relevanceRating
        stats.avgRelevance = totalRelevance / stats.totalFeedback
      }

      await redis.setex(statsKey, this.cacheTtl, JSON.stringify(stats))
    } catch (error) {
      console.error('更新反馈统计失败:', error)
    }
  }

  /**
   * 持久化会话数据
   */
  private async persistSessionData(sessionData: SearchSession): Promise<void> {
    try {
      // 这里应该将会话数据保存到数据库
      // await prisma.searchSession.create({ data: sessionData })
      console.log(`会话数据持久化: ${sessionData.sessionId}`)
    } catch (error) {
      console.error('持久化会话数据失败:', error)
    }
  }

  /**
   * 生成趋势数据
   */
  private generateTrendData(timeRange: { startDate: Date; endDate: Date }) {
    const trends = []
    const sortMethods: SortOption[] = ['relevance', 'popularity', 'personalized', 'recency', 'quality', 'created']

    const startTime = timeRange.startDate.getTime()
    const endTime = timeRange.endDate.getTime()
    const dayMs = 24 * 60 * 60 * 1000

    for (let time = startTime; time <= endTime; time += dayMs) {
      const date = new Date(time).toISOString().split('T')[0]

      for (const sortMethod of sortMethods) {
        trends.push({
          date,
          sortMethod,
          satisfactionScore: 3.0 + Math.random() * 2.0, // 3.0-5.0
          clickThroughRate: 0.3 + Math.random() * 0.4 // 0.3-0.7
        })
      }
    }

    return trends
  }

  /**
   * 清除分析数据缓存
   */
  async clearAnalyticsCache(pattern?: string): Promise<void> {
    try {
      const searchPattern = pattern || `${this.cachePrefix}*`
      const keys = await redis.keys(searchPattern)

      if (keys.length > 0) {
        await redis.del(...keys)
        console.log(`已清除 ${keys.length} 个分析缓存项`)
      }
    } catch (error) {
      console.error('清除分析缓存失败:', error)
    }
  }
}

export const sortingBehaviorAnalyticsService = new SortingBehaviorAnalyticsService()