import { redis } from '@/lib/cache'
import { prisma } from '@/lib/prisma'
import {
  type ScoringWeights,
  type SortOption,
  type ABTestConfig,
  type SortingPerformance
} from '@/types/search'

/**
 * SortingConfigService - 排序配置和调优服务
 *
 * 功能：
 * 1. 管理排序权重配置
 * 2. A/B测试支持
 * 3. 动态权重调优
 * 4. 配置缓存管理
 * 5. 性能指标跟踪
 */
export class SortingConfigService {
  private cachePrefix = 'sorting_config:'
  private cacheTtl = 3600 // 1小时缓存

  // 预设的排序权重配置方案
  private readonly presetConfigs: Record<string, ScoringWeights> = {
    // 默认均衡配置
    balanced: {
      relevance: 0.4,
      popularity: 0.3,
      recency: 0.2,
      personalization: 0.1
    },
    // 相关性优先配置
    relevance_focused: {
      relevance: 0.6,
      popularity: 0.2,
      recency: 0.1,
      personalization: 0.1
    },
    // 热度优先配置
    popularity_focused: {
      relevance: 0.3,
      popularity: 0.5,
      recency: 0.1,
      personalization: 0.1
    },
    // 时效性优先配置
    recency_focused: {
      relevance: 0.3,
      popularity: 0.2,
      recency: 0.4,
      personalization: 0.1
    },
    // 个性化优先配置
    personalized: {
      relevance: 0.2,
      popularity: 0.2,
      recency: 0.1,
      personalization: 0.5
    }
  }

  /**
   * 获取排序权重配置
   * @param configName 配置名称，如果不提供则返回默认配置
   * @returns 权重配置
   */
  async getSortingWeights(configName?: string): Promise<ScoringWeights> {
    try {
      const cacheKey = `${this.cachePrefix}weights:${configName || 'default'}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      // 从预设配置获取
      const weights = configName
        ? this.presetConfigs[configName] || this.presetConfigs.balanced
        : this.presetConfigs.balanced

      // 缓存配置
      await redis.setex(cacheKey, this.cacheTtl, JSON.stringify(weights))

      return weights
    } catch (error) {
      console.error('获取排序权重配置失败:', error)
      return this.presetConfigs.balanced
    }
  }

  /**
   * 更新排序权重配置
   * @param configName 配置名称
   * @param weights 新的权重配置
   */
  async updateSortingWeights(configName: string, weights: ScoringWeights): Promise<void> {
    try {
      // 验证权重总和
      if (!this.validateWeights(weights)) {
        throw new Error('权重总和必须等于1.0')
      }

      // 更新缓存
      const cacheKey = `${this.cachePrefix}weights:${configName}`
      await redis.setex(cacheKey, this.cacheTtl, JSON.stringify(weights))

      // 记录配置变更
      console.log(`排序权重配置已更新: ${configName}`, weights)

      // 可以存储到数据库以持久化
      // await prisma.sortingConfig.upsert({
      //   where: { name: configName },
      //   update: { weights: JSON.stringify(weights), updatedAt: new Date() },
      //   create: { name: configName, weights: JSON.stringify(weights) }
      // })
    } catch (error) {
      console.error('更新排序权重配置失败:', error)
      throw error
    }
  }

  /**
   * 获取所有预设配置
   */
  getPresetConfigs(): Record<string, ScoringWeights> {
    return { ...this.presetConfigs }
  }

  /**
   * 创建A/B测试配置
   */
  async createABTest(config: Omit<ABTestConfig, 'testId'>): Promise<string> {
    try {
      const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const abTestConfig: ABTestConfig = {
        ...config,
        testId,
        isActive: true,
        startDate: new Date()
      }

      // 验证变体权重配置
      for (const variant of abTestConfig.variants) {
        if (!this.validateWeights(variant.weights)) {
          throw new Error(`变体 ${variant.name} 权重配置无效`)
        }
      }

      // 验证流量分配总和
      const totalTraffic = abTestConfig.variants.reduce((sum, v) => sum + v.traffic, 0)
      if (Math.abs(totalTraffic - 1.0) > 0.001) {
        throw new Error('变体流量分配总和必须等于1.0')
      }

      // 存储A/B测试配置
      const cacheKey = `${this.cachePrefix}abtest:${testId}`
      await redis.setex(cacheKey, this.cacheTtl * 24, JSON.stringify(abTestConfig)) // 24小时缓存

      console.log(`A/B测试已创建: ${testId}`, config)
      return testId
    } catch (error) {
      console.error('创建A/B测试失败:', error)
      throw error
    }
  }

  /**
   * 获取A/B测试配置
   */
  async getABTestConfig(testId: string): Promise<ABTestConfig | null> {
    try {
      const cacheKey = `${this.cachePrefix}abtest:${testId}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      return null
    } catch (error) {
      console.error('获取A/B测试配置失败:', error)
      return null
    }
  }

  /**
   * 为用户分配A/B测试变体
   */
  async assignABTestVariant(testId: string, userId: string): Promise<ScoringWeights | null> {
    try {
      const config = await this.getABTestConfig(testId)
      if (!config || !config.isActive) {
        return null
      }

      // 检查测试是否已过期
      if (config.endDate && new Date() > config.endDate) {
        return null
      }

      // 基于用户ID生成一致的随机数（确保同一用户总是分配到同一变体）
      const hash = this.hashString(userId + testId)
      const random = (hash % 1000) / 1000

      // 根据流量分配选择变体
      let cumulativeTraffic = 0
      for (const variant of config.variants) {
        cumulativeTraffic += variant.traffic
        if (random < cumulativeTraffic) {
          console.log(`用户 ${userId} 分配到A/B测试变体: ${variant.name}`)
          return variant.weights
        }
      }

      // 默认返回第一个变体
      return config.variants[0]?.weights || null
    } catch (error) {
      console.error('A/B测试变体分配失败:', error)
      return null
    }
  }

  /**
   * 停止A/B测试
   */
  async stopABTest(testId: string): Promise<void> {
    try {
      const config = await this.getABTestConfig(testId)
      if (config) {
        config.isActive = false
        config.endDate = new Date()

        const cacheKey = `${this.cachePrefix}abtest:${testId}`
        await redis.setex(cacheKey, this.cacheTtl * 24, JSON.stringify(config))

        console.log(`A/B测试已停止: ${testId}`)
      }
    } catch (error) {
      console.error('停止A/B测试失败:', error)
      throw error
    }
  }

  /**
   * 动态调优权重配置
   * 基于性能指标自动调整权重
   */
  async optimizeWeights(
    currentWeights: ScoringWeights,
    performanceMetrics: SortingPerformance[]
  ): Promise<ScoringWeights> {
    try {
      if (performanceMetrics.length === 0) {
        return currentWeights
      }

      // 计算平均性能指标
      const avgMetrics = this.calculateAverageMetrics(performanceMetrics)

      // 基于性能指标调整权重
      const optimizedWeights = { ...currentWeights }

      // 如果用户满意度较低，增加个性化权重
      if (avgMetrics.userSatisfaction < 3.0) {
        optimizedWeights.personalization = Math.min(
          optimizedWeights.personalization + 0.1,
          0.5
        )
        optimizedWeights.relevance = Math.max(
          optimizedWeights.relevance - 0.05,
          0.1
        )
        optimizedWeights.popularity = Math.max(
          optimizedWeights.popularity - 0.05,
          0.1
        )
      }

      // 如果点击率较低，增加相关性权重
      if (avgMetrics.clickThroughRate < 0.1) {
        optimizedWeights.relevance = Math.min(
          optimizedWeights.relevance + 0.1,
          0.7
        )
        optimizedWeights.popularity = Math.max(
          optimizedWeights.popularity - 0.05,
          0.1
        )
        optimizedWeights.recency = Math.max(
          optimizedWeights.recency - 0.05,
          0.05
        )
      }

      // 标准化权重（确保总和为1）
      const normalizedWeights = this.normalizeWeights(optimizedWeights)

      console.log('权重配置已优化:', {
        before: currentWeights,
        after: normalizedWeights,
        metrics: avgMetrics
      })

      return normalizedWeights
    } catch (error) {
      console.error('动态权重优化失败:', error)
      return currentWeights
    }
  }

  /**
   * 获取排序配置推荐
   * 基于查询类型和上下文推荐最佳配置
   */
  async getConfigRecommendation(
    query: string,
    userContext?: {
      hasHistory: boolean
      preferredCategories: string[]
      queryFrequency: number
    }
  ): Promise<{ configName: string; weights: ScoringWeights; reason: string }> {
    try {
      // 分析查询特征
      const queryFeatures = this.analyzeQuery(query)

      // 基于查询特征和用户上下文推荐配置
      if (userContext?.hasHistory && userContext.queryFrequency > 10) {
        return {
          configName: 'personalized',
          weights: this.presetConfigs.personalized,
          reason: '用户有丰富的搜索历史，推荐个性化配置'
        }
      }

      if (queryFeatures.isSpecific) {
        return {
          configName: 'relevance_focused',
          weights: this.presetConfigs.relevance_focused,
          reason: '查询较为具体，推荐相关性优先配置'
        }
      }

      if (queryFeatures.isGeneral) {
        return {
          configName: 'popularity_focused',
          weights: this.presetConfigs.popularity_focused,
          reason: '查询较为宽泛，推荐热度优先配置'
        }
      }

      // 默认推荐均衡配置
      return {
        configName: 'balanced',
        weights: this.presetConfigs.balanced,
        reason: '默认均衡配置，适用于大多数场景'
      }
    } catch (error) {
      console.error('获取配置推荐失败:', error)
      return {
        configName: 'balanced',
        weights: this.presetConfigs.balanced,
        reason: '系统默认配置'
      }
    }
  }

  /**
   * 验证权重配置
   */
  private validateWeights(weights: ScoringWeights): boolean {
    const sum = weights.relevance + weights.popularity + weights.recency + weights.personalization
    return Math.abs(sum - 1.0) < 0.001
  }

  /**
   * 标准化权重（确保总和为1）
   */
  private normalizeWeights(weights: ScoringWeights): ScoringWeights {
    const sum = weights.relevance + weights.popularity + weights.recency + weights.personalization

    if (sum === 0) {
      return this.presetConfigs.balanced
    }

    return {
      relevance: weights.relevance / sum,
      popularity: weights.popularity / sum,
      recency: weights.recency / sum,
      personalization: weights.personalization / sum
    }
  }

  /**
   * 计算平均性能指标
   */
  private calculateAverageMetrics(metrics: SortingPerformance[]): {
    avgResponseTime: number
    userSatisfaction: number
    clickThroughRate: number
    queryCount: number
  } {
    const totalQueries = metrics.reduce((sum, m) => sum + m.queryCount, 0)

    return {
      avgResponseTime: metrics.reduce((sum, m) => sum + m.avgResponseTime * m.queryCount, 0) / totalQueries,
      userSatisfaction: metrics.reduce((sum, m) => sum + m.userSatisfaction * m.queryCount, 0) / totalQueries,
      clickThroughRate: metrics.reduce((sum, m) => sum + m.clickThroughRate * m.queryCount, 0) / totalQueries,
      queryCount: totalQueries
    }
  }

  /**
   * 分析查询特征
   */
  private analyzeQuery(query: string): { isSpecific: boolean; isGeneral: boolean } {
    const words = query.trim().split(/\s+/)
    const hasSpecificTerms = /\b(表|视图|字段|列|数据库|模式)\b/.test(query)
    const isLongQuery = words.length > 3

    return {
      isSpecific: hasSpecificTerms || isLongQuery,
      isGeneral: words.length <= 2 && !hasSpecificTerms
    }
  }

  /**
   * 字符串哈希函数（用于A/B测试用户分配）
   */
  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return Math.abs(hash)
  }

  /**
   * 清除配置缓存
   */
  async clearConfigCache(configName?: string): Promise<void> {
    try {
      if (configName) {
        const cacheKey = `${this.cachePrefix}weights:${configName}`
        await redis.del(cacheKey)
      } else {
        // 清除所有权重配置缓存
        const pattern = `${this.cachePrefix}weights:*`
        const keys = await redis.keys(pattern)
        if (keys.length > 0) {
          await redis.del(...keys)
        }
      }
      console.log(`排序配置缓存已清除: ${configName || '全部'}`)
    } catch (error) {
      console.error('清除配置缓存失败:', error)
    }
  }
}

export const sortingConfigService = new SortingConfigService()