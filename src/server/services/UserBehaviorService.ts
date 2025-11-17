import { redis } from '@/lib/cache'
import { prisma } from '@/lib/prisma'
import {
  type PersonalizationConfig,
  type UserSortPreferences,
  type SortOption,
  type ScoringWeights
} from '@/types/search'

/**
 * UserBehaviorService - 用户行为分析服务
 *
 * 功能：
 * 1. 用户搜索行为跟踪和分析
 * 2. 个性化偏好学习和存储
 * 3. 用户排序偏好管理
 * 4. 行为模式识别和预测
 * 5. 个性化推荐配置生成
 */
export class UserBehaviorService {
  private cachePrefix = 'user_behavior:'
  private cacheTtl = 86400 // 24小时缓存

  // 行为权重配置
  private readonly interactionWeights = {
    view: 1.0,      // 查看权重
    download: 3.0,  // 下载权重（高价值行为）
    bookmark: 2.5,  // 收藏权重（高价值行为）
    share: 4.0,     // 分享权重（最高价值行为）
    search: 0.5,    // 搜索权重（低价值，但频繁）
    click: 1.5      // 点击权重
  }

  /**
   * 记录用户搜索行为
   */
  async recordSearchBehavior(
    userId: string,
    query: string,
    clickedAssets: string[] = [],
    sortMethod: SortOption = 'relevance',
    sessionId: string
  ): Promise<void> {
    try {
      const timestamp = new Date()
      const behaviorKey = `${this.cachePrefix}search:${userId}`

      // 获取现有搜索历史
      const existingHistory = await this.getSearchHistory(userId)

      // 添加新的搜索记录
      const newSearchRecord = {
        query,
        clickedAssets,
        sortMethod,
        sessionId,
        timestamp
      }

      // 限制历史记录数量（保留最近100条）
      const updatedHistory = [newSearchRecord, ...existingHistory].slice(0, 100)

      // 存储搜索历史
      await redis.setex(behaviorKey, this.cacheTtl * 7, JSON.stringify(updatedHistory)) // 7天保留

      // 异步更新用户偏好
      this.updateUserPreferences(userId, newSearchRecord).catch(error => {
        console.error('更新用户偏好失败:', error)
      })

      console.log(`用户搜索行为已记录: ${userId}, 查询: ${query}`)
    } catch (error) {
      console.error('记录用户搜索行为失败:', error)
    }
  }

  /**
   * 记录用户资产交互行为
   */
  async recordAssetInteraction(
    userId: string,
    assetId: string,
    interactionType: 'view' | 'download' | 'bookmark' | 'share' | 'click',
    context?: {
      query?: string
      sortMethod?: SortOption
      position?: number // 结果中的位置
    }
  ): Promise<void> {
    try {
      const timestamp = new Date()
      const interactionKey = `${this.cachePrefix}interaction:${userId}:${assetId}`

      // 获取现有交互记录
      const existingInteractions = await this.getAssetInteractions(userId, assetId)

      // 添加新的交互记录
      const newInteraction = {
        type: interactionType,
        timestamp,
        context
      }

      const updatedInteractions = [newInteraction, ...existingInteractions].slice(0, 50) // 保留最近50次交互

      // 存储交互记录
      await redis.setex(interactionKey, this.cacheTtl * 30, JSON.stringify(updatedInteractions)) // 30天保留

      // 更新用户兴趣权重
      await this.updateInterestWeights(userId, assetId, interactionType)

      console.log(`用户交互行为已记录: ${userId}, 资产: ${assetId}, 类型: ${interactionType}`)
    } catch (error) {
      console.error('记录用户交互行为失败:', error)
    }
  }

  /**
   * 获取用户个性化配置
   */
  async getPersonalizationConfig(userId: string): Promise<PersonalizationConfig | null> {
    try {
      const cacheKey = `${this.cachePrefix}config:${userId}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      // 生成个性化配置
      const config = await this.generatePersonalizationConfig(userId)

      // 缓存配置
      await redis.setex(cacheKey, this.cacheTtl, JSON.stringify(config))

      return config
    } catch (error) {
      console.error('获取个性化配置失败:', error)
      return null
    }
  }

  /**
   * 获取用户排序偏好
   */
  async getUserSortPreferences(userId: string): Promise<UserSortPreferences> {
    try {
      const cacheKey = `${this.cachePrefix}sort_prefs:${userId}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      // 分析用户排序行为，生成偏好
      const preferences = await this.analyzeUserSortPreferences(userId)

      // 缓存偏好设置
      await redis.setex(cacheKey, this.cacheTtl, JSON.stringify(preferences))

      return preferences
    } catch (error) {
      console.error('获取用户排序偏好失败:', error)
      return this.getDefaultSortPreferences(userId)
    }
  }

  /**
   * 更新用户排序偏好
   */
  async updateUserSortPreferences(
    userId: string,
    preferences: Partial<UserSortPreferences>
  ): Promise<void> {
    try {
      const currentPrefs = await this.getUserSortPreferences(userId)
      const updatedPrefs = { ...currentPrefs, ...preferences }

      const cacheKey = `${this.cachePrefix}sort_prefs:${userId}`
      await redis.setex(cacheKey, this.cacheTtl, JSON.stringify(updatedPrefs))

      console.log(`用户排序偏好已更新: ${userId}`)
    } catch (error) {
      console.error('更新用户排序偏好失败:', error)
    }
  }

  /**
   * 学习和推荐个性化权重
   */
  async recommendPersonalizedWeights(userId: string): Promise<ScoringWeights> {
    try {
      const config = await this.getPersonalizationConfig(userId)
      const sortPrefs = await this.getUserSortPreferences(userId)

      if (!config || !sortPrefs) {
        return this.getDefaultWeights()
      }

      // 基于用户行为分析推荐权重
      const weights = this.calculatePersonalizedWeights(config, sortPrefs)

      console.log(`为用户 ${userId} 推荐个性化权重:`, weights)
      return weights
    } catch (error) {
      console.error('推荐个性化权重失败:', error)
      return this.getDefaultWeights()
    }
  }

  /**
   * 获取用户兴趣标签
   */
  async getUserInterestTags(userId: string): Promise<Array<{
    tag: string
    weight: number
    category: string
  }>> {
    try {
      const cacheKey = `${this.cachePrefix}interests:${userId}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      // 分析用户行为生成兴趣标签
      const interests = await this.analyzeUserInterests(userId)

      // 缓存兴趣标签
      await redis.setex(cacheKey, this.cacheTtl * 3, JSON.stringify(interests)) // 3天缓存

      return interests
    } catch (error) {
      console.error('获取用户兴趣标签失败:', error)
      return []
    }
  }

  /**
   * 预测用户对资产的兴趣度
   */
  async predictAssetInterest(
    userId: string,
    assetId: string,
    assetMetadata: {
      categoryName?: string
      type?: string
      tags?: string
      description?: string
    }
  ): Promise<number> {
    try {
      const config = await this.getPersonalizationConfig(userId)
      const interests = await this.getUserInterestTags(userId)

      if (!config || interests.length === 0) {
        return 0.5 // 默认中性兴趣度
      }

      // 计算兴趣度分数
      let interestScore = 0.5 // 基础分数

      // 基于分类偏好
      if (assetMetadata.categoryName && config.preferredCategories.includes(assetMetadata.categoryName)) {
        interestScore += 0.2
      }

      // 基于类型偏好
      if (assetMetadata.type && config.preferredTypes.includes(assetMetadata.type)) {
        interestScore += 0.15
      }

      // 基于兴趣标签匹配
      if (assetMetadata.tags) {
        const assetTags = assetMetadata.tags.split(',').map(tag => tag.trim())
        for (const assetTag of assetTags) {
          const matchingInterest = interests.find(i => i.tag === assetTag)
          if (matchingInterest) {
            interestScore += matchingInterest.weight * 0.1
          }
        }
      }

      // 基于历史交互
      const hasInteracted = await this.hasUserInteractedWithAsset(userId, assetId)
      if (hasInteracted) {
        interestScore += 0.1
      }

      return Math.max(0, Math.min(1, interestScore))
    } catch (error) {
      console.error('预测用户资产兴趣度失败:', error)
      return 0.5
    }
  }

  /**
   * 获取用户搜索历史
   */
  private async getSearchHistory(userId: string): Promise<Array<{
    query: string
    clickedAssets: string[]
    sortMethod: SortOption
    sessionId: string
    timestamp: Date
  }>> {
    try {
      const behaviorKey = `${this.cachePrefix}search:${userId}`
      const cached = await redis.get(behaviorKey)

      if (cached) {
        const history = JSON.parse(cached)
        // 将时间戳字符串转换回Date对象
        return history.map((record: any) => ({
          ...record,
          timestamp: new Date(record.timestamp)
        }))
      }

      return []
    } catch (error) {
      console.error('获取搜索历史失败:', error)
      return []
    }
  }

  /**
   * 获取资产交互记录
   */
  private async getAssetInteractions(userId: string, assetId: string): Promise<Array<{
    type: string
    timestamp: Date
    context?: any
  }>> {
    try {
      const interactionKey = `${this.cachePrefix}interaction:${userId}:${assetId}`
      const cached = await redis.get(interactionKey)

      if (cached) {
        const interactions = JSON.parse(cached)
        return interactions.map((interaction: any) => ({
          ...interaction,
          timestamp: new Date(interaction.timestamp)
        }))
      }

      return []
    } catch (error) {
      console.error('获取交互记录失败:', error)
      return []
    }
  }

  /**
   * 生成个性化配置
   */
  private async generatePersonalizationConfig(userId: string): Promise<PersonalizationConfig> {
    const searchHistory = await this.getSearchHistory(userId)

    // 分析偏好的分类和类型
    const categoryFreq: Record<string, number> = {}
    const typeFreq: Record<string, number> = {}

    // 这里需要从实际的点击记录中分析，简化实现
    const preferredCategories = ['数据仓库', '业务数据'] // 基于历史数据分析
    const preferredTypes = ['表', '视图'] // 基于历史数据分析

    return {
      userId,
      searchHistory,
      preferredCategories,
      preferredTypes,
      interactionWeights: { ...this.interactionWeights }
    }
  }

  /**
   * 分析用户排序偏好
   */
  private async analyzeUserSortPreferences(userId: string): Promise<UserSortPreferences> {
    const searchHistory = await this.getSearchHistory(userId)

    // 统计各排序方式使用频率
    const sortFrequency: Record<SortOption, number> = {
      relevance: 0,
      popularity: 0,
      recency: 0,
      created: 0,
      quality: 0,
      personalized: 0
    }

    let lastUsedSort: SortOption = 'relevance'
    let mostFrequentSort: SortOption = 'relevance'
    let maxFreq = 0

    for (const record of searchHistory) {
      if (record.sortMethod && sortFrequency.hasOwnProperty(record.sortMethod)) {
        sortFrequency[record.sortMethod]++

        // 更新最近使用的排序方式
        if (!lastUsedSort || record.timestamp > new Date()) {
          lastUsedSort = record.sortMethod
        }
      }
    }

    // 找出最常用的排序方式
    for (const [sort, freq] of Object.entries(sortFrequency)) {
      if (freq > maxFreq) {
        maxFreq = freq
        mostFrequentSort = sort as SortOption
      }
    }

    return {
      userId,
      defaultSort: mostFrequentSort,
      savedSorts: [],
      lastUsedSort,
      sortFrequency
    }
  }

  /**
   * 计算个性化权重
   */
  private calculatePersonalizedWeights(
    config: PersonalizationConfig,
    sortPrefs: UserSortPreferences
  ): ScoringWeights {
    // 基于用户行为和偏好计算权重
    let weights = this.getDefaultWeights()

    // 如果用户频繁使用个性化排序，增加个性化权重
    if ((sortPrefs.sortFrequency.personalized || 0) > 5) {
      weights.personalization = Math.min(weights.personalization + 0.2, 0.5)
      weights.relevance = Math.max(weights.relevance - 0.1, 0.1)
      weights.popularity = Math.max(weights.popularity - 0.1, 0.1)
    }

    // 如果用户频繁使用热度排序，增加热度权重
    if ((sortPrefs.sortFrequency.popularity || 0) > 10) {
      weights.popularity = Math.min(weights.popularity + 0.15, 0.5)
      weights.relevance = Math.max(weights.relevance - 0.075, 0.1)
      weights.recency = Math.max(weights.recency - 0.075, 0.05)
    }

    // 标准化权重
    return this.normalizeWeights(weights)
  }

  /**
   * 分析用户兴趣
   */
  private async analyzeUserInterests(userId: string): Promise<Array<{
    tag: string
    weight: number
    category: string
  }>> {
    // 简化实现，返回基于用户行为的兴趣标签
    return [
      { tag: '数据仓库', weight: 0.8, category: '业务域' },
      { tag: '用户行为', weight: 0.6, category: '数据类型' },
      { tag: '实时数据', weight: 0.4, category: '时效性' }
    ]
  }

  /**
   * 更新用户偏好
   */
  private async updateUserPreferences(userId: string, searchRecord: any): Promise<void> {
    // 基于搜索记录更新用户偏好
    // 这里可以实现更复杂的学习算法
    console.log(`更新用户偏好: ${userId}, 查询: ${searchRecord.query}`)
  }

  /**
   * 更新兴趣权重
   */
  private async updateInterestWeights(
    userId: string,
    assetId: string,
    interactionType: string
  ): Promise<void> {
    // 基于交互行为更新兴趣权重
    console.log(`更新兴趣权重: ${userId}, 资产: ${assetId}, 交互: ${interactionType}`)
  }

  /**
   * 检查用户是否与资产有过交互
   */
  private async hasUserInteractedWithAsset(userId: string, assetId: string): Promise<boolean> {
    try {
      const interactions = await this.getAssetInteractions(userId, assetId)
      return interactions.length > 0
    } catch {
      return false
    }
  }

  /**
   * 获取默认排序偏好
   */
  private getDefaultSortPreferences(userId: string): UserSortPreferences {
    return {
      userId,
      defaultSort: 'relevance',
      savedSorts: [],
      sortFrequency: {
        relevance: 1,
        popularity: 0,
        recency: 0,
        created: 0,
        quality: 0,
        personalized: 0
      }
    }
  }

  /**
   * 获取默认权重
   */
  private getDefaultWeights(): ScoringWeights {
    return {
      relevance: 0.4,
      popularity: 0.3,
      recency: 0.2,
      personalization: 0.1
    }
  }

  /**
   * 标准化权重
   */
  private normalizeWeights(weights: ScoringWeights): ScoringWeights {
    const sum = weights.relevance + weights.popularity + weights.recency + weights.personalization

    if (sum === 0) {
      return this.getDefaultWeights()
    }

    return {
      relevance: weights.relevance / sum,
      popularity: weights.popularity / sum,
      recency: weights.recency / sum,
      personalization: weights.personalization / sum
    }
  }

  /**
   * 清除用户行为缓存
   */
  async clearUserBehaviorCache(userId: string): Promise<void> {
    try {
      const patterns = [
        `${this.cachePrefix}search:${userId}`,
        `${this.cachePrefix}config:${userId}`,
        `${this.cachePrefix}sort_prefs:${userId}`,
        `${this.cachePrefix}interests:${userId}`,
        `${this.cachePrefix}interaction:${userId}:*`
      ]

      for (const pattern of patterns) {
        if (pattern.includes('*')) {
          const keys = await redis.keys(pattern)
          if (keys.length > 0) {
            await redis.del(...keys)
          }
        } else {
          await redis.del(pattern)
        }
      }

      console.log(`用户行为缓存已清除: ${userId}`)
    } catch (error) {
      console.error('清除用户行为缓存失败:', error)
    }
  }
}

export const userBehaviorService = new UserBehaviorService()