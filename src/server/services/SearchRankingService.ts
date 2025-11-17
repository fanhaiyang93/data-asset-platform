import { redis } from '@/lib/cache'
import { prisma } from '@/lib/prisma'
import {
  type SortOption,
  type ScoringWeights,
  type SortingScores,
  type AssetPopularity,
  type SearchResult,
  type SearchResultWithSorting
} from '@/types/search'
import { userBehaviorService } from './UserBehaviorService'
import { sortingConfigService } from './SortingConfigService'

/**
 * SearchRankingService - 智能搜索排序服务
 *
 * 实现多维度评分算法：
 * - 相关度(40%): Elasticsearch相关性分数
 * - 热度(30%): 基于用户行为的热度分数
 * - 时效性(20%): 基于更新时间的新鲜度分数
 * - 个性化(10%): 基于用户偏好的个性化分数
 */
export class SearchRankingService {
  private cachePrefix = 'ranking:'
  private cacheTtl = 300 // 5分钟缓存

  // 默认评分权重配置
  private readonly defaultWeights: ScoringWeights = {
    relevance: 0.4,      // 相关度权重
    popularity: 0.3,     // 热度权重
    recency: 0.2,       // 时效性权重
    personalization: 0.1 // 个性化权重
  }

  /**
   * 对搜索结果进行智能排序
   * @param results 原始搜索结果
   * @param query 搜索查询
   * @param sortOption 排序选项
   * @param userId 用户ID（用于个性化）
   * @param customWeights 自定义权重配置
   * @returns 排序后的搜索结果
   */
  async rankSearchResults(
    results: SearchResult[],
    query: string,
    sortOption: SortOption = 'relevance',
    userId?: string,
    customWeights?: ScoringWeights
  ): Promise<SearchResultWithSorting[]> {
    if (results.length === 0) return []

    const startTime = Date.now()

    try {
      // 根据排序选项决定处理策略
      switch (sortOption) {
        case 'personalized':
          return await this.personalizedRanking(results, query, userId, customWeights)
        case 'popularity':
          return await this.popularityRanking(results)
        case 'recency':
          return await this.recencyRanking(results)
        case 'quality':
          return await this.qualityRanking(results)
        case 'created':
          return await this.createdTimeRanking(results)
        case 'relevance':
        default:
          return await this.intelligentRanking(results, query, userId, customWeights)
      }
    } catch (error) {
      console.error('搜索结果排序失败:', error)
      // 降级到原始排序
      return results.map((result, index) => ({
        ...result,
        personalizedRank: index + 1,
        sortMethod: sortOption
      }))
    } finally {
      // 性能监控
      const duration = Date.now() - startTime
      if (duration > 300) { // 超过300ms记录警告
        console.warn(`搜索排序耗时过长: ${duration}ms, 结果数量: ${results.length}`)
      }
    }
  }

  /**
   * 智能综合排序 - 使用多维度评分算法
   */
  private async intelligentRanking(
    results: SearchResult[],
    query: string,
    userId?: string,
    customWeights?: ScoringWeights
  ): Promise<SearchResultWithSorting[]> {
    const weights = customWeights || this.defaultWeights
    const assetIds = results.map(r => r.id)

    // 获取各维度数据
    const popularityData = await this.getPopularityData(assetIds)

    // 计算各维度分数并排序
    const rankedResults = await Promise.all(results.map(async result => {
      const scores = await this.calculateMultiDimensionalScore(
        result,
        query,
        popularityData.get(result.id),
        userId,
        weights
      )

      return {
        ...result,
        sortingScores: scores,
        sortMethod: 'relevance' as SortOption,
        personalizedRank: 0 // 将在后续设置
      }
    }))

    // 按最终分数排序
    rankedResults.sort((a, b) => {
      const scoreA = a.sortingScores?.finalScore || 0
      const scoreB = b.sortingScores?.finalScore || 0
      return scoreB - scoreA
    })

    // 设置排序位置
    return rankedResults.map((result, index) => ({
      ...result,
      personalizedRank: index + 1
    }))
  }

  /**
   * 计算多维度综合分数（异步版本）
   */
  private async calculateMultiDimensionalScore(
    result: SearchResult,
    query: string,
    popularity: AssetPopularity | undefined,
    userId?: string,
    weights: ScoringWeights
  ): Promise<SortingScores> {
    // 1. 相关度分数 (基于Elasticsearch分数)
    const relevanceScore = this.normalizeRelevanceScore(result.searchScore)

    // 2. 热度分数 (基于用户行为数据)
    const popularityScore = this.calculatePopularityScore(popularity)

    // 3. 时效性分数 (基于更新时间)
    const recencyScore = this.calculateRecencyScore(result)

    // 4. 个性化分数 (基于用户偏好和行为分析)
    const personalizationScore = await this.calculatePersonalizationScore(result, userId)

    // 计算加权最终分数
    const finalScore =
      relevanceScore * weights.relevance +
      popularityScore * weights.popularity +
      recencyScore * weights.recency +
      personalizationScore * weights.personalization

    return {
      relevanceScore,
      popularityScore,
      recencyScore,
      personalizationScore,
      finalScore: Math.max(0, Math.min(1, finalScore)), // 确保在0-1范围内
      explanation: `相关度:${relevanceScore.toFixed(2)} 热度:${popularityScore.toFixed(2)} 时效:${recencyScore.toFixed(2)} 个性化:${personalizationScore.toFixed(2)}`
    }
  }

  /**
   * 标准化相关度分数 (Elasticsearch分数通常在0-几十之间)
   */
  private normalizeRelevanceScore(esScore: number): number {
    // 使用log归一化，将ES分数映射到0-1范围
    if (esScore <= 0) return 0
    const normalizedScore = Math.log(esScore + 1) / Math.log(50) // 假设最高分数约为50
    return Math.max(0, Math.min(1, normalizedScore))
  }

  /**
   * 计算热度分数
   */
  private calculatePopularityScore(popularity: AssetPopularity | undefined): number {
    if (!popularity) return 0.1 // 无数据时给予基础分数

    // 综合考虑各种交互行为，加权计算热度
    const viewWeight = 1.0
    const downloadWeight = 3.0
    const bookmarkWeight = 2.0
    const shareWeight = 4.0
    const searchWeight = 1.5

    const weightedScore =
      popularity.viewCount * viewWeight +
      popularity.downloadCount * downloadWeight +
      popularity.bookmarkCount * bookmarkWeight +
      popularity.shareCount * shareWeight +
      popularity.searchCount * searchWeight

    // 应用点击率加成
    const ctrBonus = Math.min(popularity.clickThroughRate * 0.5, 0.2)

    // 时间衰减：最近访问的资产获得额外加分
    const daysSinceLastAccess = (Date.now() - popularity.lastAccessTime.getTime()) / (1000 * 60 * 60 * 24)
    const recencyBonus = Math.max(0, (7 - daysSinceLastAccess) / 7 * 0.1) // 7天内线性衰减

    // 标准化到0-1范围 (假设最高加权分数为1000)
    const baseScore = Math.min(weightedScore / 1000, 0.8)

    return Math.max(0, Math.min(1, baseScore + ctrBonus + recencyBonus))
  }

  /**
   * 计算时效性分数
   */
  private calculateRecencyScore(result: SearchResult): number {
    // 从result中获取更新时间需要额外查询，这里使用简化逻辑
    // 实际应用中可以在搜索时就包含updatedAt字段

    // 暂时基于质量分数作为时效性的代理指标
    // 质量分数高的资产通常维护更好，更新更及时
    if (result.qualityScore) {
      return Math.max(0, Math.min(1, result.qualityScore / 10))
    }

    // 没有质量分数时返回中等分数
    return 0.5
  }

  /**
   * 计算个性化分数（增强版）
   */
  private async calculatePersonalizationScore(
    result: SearchResult,
    userId?: string
  ): Promise<number> {
    if (!userId) return 0.5 // 无用户ID时返回中性分数

    try {
      // 获取用户个性化配置
      const config = await userBehaviorService.getPersonalizationConfig(userId)
      if (!config) return 0.5

      let score = 0.5 // 基础分数

      // 基于用户偏好的分类加分
      if (result.categoryName && config.preferredCategories.includes(result.categoryName)) {
        score += 0.25
      }

      // 基于用户偏好的资产类型加分
      if (result.type && config.preferredTypes.includes(result.type)) {
        score += 0.2
      }

      // 基于资产兴趣度预测
      const assetMetadata = {
        categoryName: result.categoryName,
        type: result.type,
        tags: result.tags,
        description: result.description
      }

      const interestScore = await userBehaviorService.predictAssetInterest(
        userId,
        result.id,
        assetMetadata
      )

      // 将兴趣度融入个性化分数
      score = score * 0.7 + interestScore * 0.3

      return Math.max(0, Math.min(1, score))
    } catch (error) {
      console.error('计算个性化分数失败:', error)
      return 0.5
    }
  }

  /**
   * 热度排序
   */
  private async popularityRanking(results: SearchResult[]): Promise<SearchResultWithSorting[]> {
    const assetIds = results.map(r => r.id)
    const popularityData = await this.getPopularityData(assetIds)

    return results
      .map(result => ({
        ...result,
        sortMethod: 'popularity' as SortOption,
        personalizedRank: 0
      }))
      .sort((a, b) => {
        const popA = popularityData.get(a.id)?.popularityScore || 0
        const popB = popularityData.get(b.id)?.popularityScore || 0
        return popB - popA
      })
      .map((result, index) => ({
        ...result,
        personalizedRank: index + 1
      }))
  }

  /**
   * 时效性排序
   */
  private async recencyRanking(results: SearchResult[]): Promise<SearchResultWithSorting[]> {
    // 需要查询更新时间，简化实现中按质量分数排序
    return results
      .map(result => ({
        ...result,
        sortMethod: 'recency' as SortOption,
        personalizedRank: 0
      }))
      .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
      .map((result, index) => ({
        ...result,
        personalizedRank: index + 1
      }))
  }

  /**
   * 质量排序
   */
  private async qualityRanking(results: SearchResult[]): Promise<SearchResultWithSorting[]> {
    return results
      .map(result => ({
        ...result,
        sortMethod: 'quality' as SortOption,
        personalizedRank: 0
      }))
      .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
      .map((result, index) => ({
        ...result,
        personalizedRank: index + 1
      }))
  }

  /**
   * 创建时间排序
   */
  private async createdTimeRanking(results: SearchResult[]): Promise<SearchResultWithSorting[]> {
    return results
      .map(result => ({
        ...result,
        sortMethod: 'created' as SortOption,
        personalizedRank: 0
      }))
      .sort((a, b) => a.name.localeCompare(b.name)) // 简化为按名称排序
      .map((result, index) => ({
        ...result,
        personalizedRank: index + 1
      }))
  }

  /**
   * 个性化排序（增强版）
   */
  private async personalizedRanking(
    results: SearchResult[],
    query: string,
    userId?: string,
    customWeights?: ScoringWeights
  ): Promise<SearchResultWithSorting[]> {
    if (!userId) {
      // 无用户ID时降级到智能排序
      return this.intelligentRanking(results, query, userId, customWeights)
    }

    try {
      // 获取用户个性化权重推荐
      const recommendedWeights = await userBehaviorService.recommendPersonalizedWeights(userId)

      // 如果提供了自定义权重，使用自定义权重；否则使用推荐权重
      const finalWeights = customWeights || recommendedWeights

      // 记录用户排序行为（用于后续学习）
      await userBehaviorService.recordSearchBehavior(
        userId,
        query,
        [], // 点击的资产将在用户实际点击时记录
        'personalized',
        `session_${Date.now()}`
      )

      return this.intelligentRanking(results, query, userId, finalWeights)
    } catch (error) {
      console.error('个性化排序失败，降级到智能排序:', error)
      return this.intelligentRanking(results, query, userId, customWeights)
    }
  }

  /**
   * 增强个性化排序 - 支持A/B测试和动态权重优化
   */
  async enhancedPersonalizedRanking(
    results: SearchResult[],
    query: string,
    userId: string,
    abTestVariant?: string
  ): Promise<SearchResultWithSorting[]> {
    try {
      let weights: ScoringWeights

      // 如果指定了A/B测试变体，使用测试权重
      if (abTestVariant) {
        const testWeights = await sortingConfigService.assignABTestVariant(abTestVariant, userId)
        weights = testWeights || await userBehaviorService.recommendPersonalizedWeights(userId)
      } else {
        // 获取动态推荐权重
        weights = await userBehaviorService.recommendPersonalizedWeights(userId)
      }

      // 基于查询上下文获取配置推荐
      const configRecommendation = await sortingConfigService.getConfigRecommendation(
        query,
        {
          hasHistory: true, // 从用户行为服务获取
          preferredCategories: [], // 从用户行为服务获取
          queryFrequency: 10 // 从用户行为服务获取
        }
      )

      // 如果配置推荐的权重更适合当前查询，使用推荐权重
      if (configRecommendation.reason.includes('推荐')) {
        console.log(`使用配置推荐: ${configRecommendation.configName}, 原因: ${configRecommendation.reason}`)
        weights = configRecommendation.weights
      }

      return this.intelligentRanking(results, query, userId, weights)
    } catch (error) {
      console.error('增强个性化排序失败:', error)
      return this.personalizedRanking(results, query, userId)
    }
  }

  /**
   * 获取资产热度数据
   */
  private async getPopularityData(assetIds: string[]): Promise<Map<string, AssetPopularity>> {
    try {
      const cacheKey = `${this.cachePrefix}popularity:${assetIds.join(',')}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        const data: AssetPopularity[] = JSON.parse(cached)
        return new Map(data.map(item => [item.assetId, item]))
      }

      // 从数据库查询热度数据（模拟数据，实际需要真实的统计表）
      const popularityData: AssetPopularity[] = assetIds.map(assetId => ({
        assetId,
        viewCount: Math.floor(Math.random() * 1000),
        downloadCount: Math.floor(Math.random() * 100),
        bookmarkCount: Math.floor(Math.random() * 50),
        shareCount: Math.floor(Math.random() * 20),
        searchCount: Math.floor(Math.random() * 200),
        clickThroughRate: Math.random() * 0.3,
        lastAccessTime: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // 30天内随机
        popularityScore: Math.random()
      }))

      // 缓存热度数据
      await redis.setex(cacheKey, this.cacheTtl, JSON.stringify(popularityData))

      return new Map(popularityData.map(item => [item.assetId, item]))
    } catch (error) {
      console.error('获取热度数据失败:', error)
      return new Map()
    }
  }

  /**
   * 获取用户偏好数据
   */
  private async getUserPreferences(userId: string): Promise<any> {
    try {
      const cacheKey = `${this.cachePrefix}preferences:${userId}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      // 从数据库查询用户偏好（模拟数据）
      const preferences = {
        preferredCategories: ['数据仓库', '业务数据'],
        preferredTypes: ['表', '视图'],
        searchHistory: []
      }

      // 缓存用户偏好（24小时）
      await redis.setex(cacheKey, 86400, JSON.stringify(preferences))

      return preferences
    } catch (error) {
      console.error('获取用户偏好失败:', error)
      return null
    }
  }

  /**
   * 记录排序性能指标
   */
  async recordSortingPerformance(
    sortMethod: SortOption,
    responseTime: number,
    resultCount: number
  ): Promise<void> {
    try {
      // 这里可以将性能指标发送到监控系统
      console.log(`排序性能指标: ${sortMethod}, ${responseTime}ms, ${resultCount}个结果`)

      // 可以存储到时序数据库或监控系统
      // await influxdb.writePoints([{
      //   measurement: 'sorting_performance',
      //   tags: { sort_method: sortMethod },
      //   fields: { response_time: responseTime, result_count: resultCount },
      //   timestamp: new Date()
      // }])
    } catch (error) {
      console.error('记录排序性能指标失败:', error)
    }
  }

  /**
   * 实时调优排序权重 - Task 5: 子任务1
   * 基于用户反馈和搜索效果数据动态调整排序权重
   */
  async optimizeWeightsRealTime(
    query: string,
    userId: string,
    currentWeights: ScoringWeights,
    feedbackData?: {
      satisfaction: number
      clickPositions: number[]
      querySuccessRate?: number
    }
  ): Promise<ScoringWeights> {
    try {
      // 获取查询的历史表现数据
      const performanceMetrics = await this.getQueryPerformanceMetrics(query)

      // 基于当前反馈调整权重
      let optimizedWeights = { ...currentWeights }

      if (feedbackData) {
        // 满意度低于阈值时，增加个性化权重
        if (feedbackData.satisfaction < 0.7) {
          optimizedWeights.personalization = Math.min(0.3, optimizedWeights.personalization + 0.05)
          // 重新平衡其他权重
          this.rebalanceWeights(optimizedWeights)
        }

        // 点击位置靠后时，增加相关度权重
        const avgClickPosition = feedbackData.clickPositions.reduce((a, b) => a + b, 0)
          / feedbackData.clickPositions.length
        if (avgClickPosition > 5) {
          optimizedWeights.relevance = Math.min(0.6, optimizedWeights.relevance + 0.1)
          this.rebalanceWeights(optimizedWeights)
        }
      }

      // 基于历史表现数据进一步优化
      if (performanceMetrics) {
        // 查询成功率低时，增加热度权重（热门资产更可能满足需求）
        if (performanceMetrics.successRate < 0.6) {
          optimizedWeights.popularity = Math.min(0.5, optimizedWeights.popularity + 0.1)
          this.rebalanceWeights(optimizedWeights)
        }

        // 结果陈旧时，增加时效性权重
        if (performanceMetrics.avgResultAge > 30) { // 30天
          optimizedWeights.recency = Math.min(0.4, optimizedWeights.recency + 0.05)
          this.rebalanceWeights(optimizedWeights)
        }
      }

      // 缓存优化后的权重
      const cacheKey = `${this.cachePrefix}optimized_weights:${query}:${userId}`
      await redis.setex(cacheKey, 3600, JSON.stringify(optimizedWeights)) // 1小时缓存

      console.log(`权重实时调优: ${query}, 用户: ${userId}`, {
        original: currentWeights,
        optimized: optimizedWeights
      })

      return optimizedWeights
    } catch (error) {
      console.error('实时权重调优失败:', error)
      return currentWeights
    }
  }

  /**
   * 重新平衡权重，确保总和为1
   */
  private rebalanceWeights(weights: ScoringWeights): void {
    const total = weights.relevance + weights.popularity + weights.recency + weights.personalization
    if (Math.abs(total - 1.0) > 0.001) {
      const factor = 1.0 / total
      weights.relevance *= factor
      weights.popularity *= factor
      weights.recency *= factor
      weights.personalization *= factor
    }
  }

  /**
   * 获取查询的历史表现指标
   */
  private async getQueryPerformanceMetrics(query: string): Promise<{
    successRate: number
    avgResultAge: number
    avgClickPosition: number
    totalQueries: number
  } | null> {
    try {
      const cacheKey = `${this.cachePrefix}query_metrics:${query}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      // 从数据库查询历史表现数据
      // 这里使用模拟数据，实际需要从SearchLog表查询
      const metrics = {
        successRate: 0.5 + Math.random() * 0.4, // 0.5-0.9
        avgResultAge: Math.random() * 60, // 0-60天
        avgClickPosition: 1 + Math.random() * 8, // 1-9位置
        totalQueries: Math.floor(Math.random() * 100) + 10 // 10-110次查询
      }

      // 缓存指标数据（10分钟）
      await redis.setex(cacheKey, 600, JSON.stringify(metrics))

      return metrics
    } catch (error) {
      console.error('获取查询表现指标失败:', error)
      return null
    }
  }

  /**
   * 批量优化多个查询的权重配置
   */
  async batchOptimizeWeights(
    queries: Array<{
      query: string
      userId: string
      currentWeights: ScoringWeights
      performanceData: any
    }>
  ): Promise<Map<string, ScoringWeights>> {
    const results = new Map<string, ScoringWeights>()

    for (const queryData of queries) {
      try {
        const optimized = await this.optimizeWeightsRealTime(
          queryData.query,
          queryData.userId,
          queryData.currentWeights,
          queryData.performanceData
        )
        results.set(`${queryData.query}:${queryData.userId}`, optimized)
      } catch (error) {
        console.error(`批量优化失败: ${queryData.query}`, error)
        results.set(`${queryData.query}:${queryData.userId}`, queryData.currentWeights)
      }
    }

    return results
  }

  /**
   * 高级缓存优化 - Task 5: 子任务3
   * 实现多层缓存策略和智能预加载
   */
  async optimizedRankSearchResults(
    results: SearchResult[],
    query: string,
    sortOption: SortOption = 'relevance',
    userId?: string,
    customWeights?: ScoringWeights
  ): Promise<SearchResultWithSorting[]> {
    const startTime = Date.now()

    try {
      // 1. L1缓存：内存缓存（最快）
      const memoryKey = this.generateCacheKey(query, sortOption, userId, customWeights)
      const memoryCached = await this.getFromMemoryCache(memoryKey)
      if (memoryCached) {
        console.log(`L1缓存命中: ${memoryKey}`)
        return memoryCached
      }

      // 2. L2缓存：Redis缓存（较快）
      const redisCached = await this.getFromRedisCache(memoryKey)
      if (redisCached) {
        console.log(`L2缓存命中: ${memoryKey}`)
        // 同时填充内存缓存
        await this.setMemoryCache(memoryKey, redisCached, 300) // 5分钟
        return redisCached
      }

      // 3. 并行预计算优化：检查是否有相似查询的缓存
      const similarResults = await this.findSimilarCachedResults(query, sortOption, userId)
      if (similarResults && this.shouldUseSimilarResults(results, similarResults.results)) {
        console.log(`使用相似查询缓存: ${similarResults.query}`)
        // 异步更新缓存
        this.asyncUpdateCache(memoryKey, similarResults.results)
        return similarResults.results
      }

      // 4. 执行完整排序计算
      const rankedResults = await this.rankSearchResults(
        results,
        query,
        sortOption,
        userId,
        customWeights
      )

      // 5. 智能缓存策略
      await this.intelligentCacheStrategy(memoryKey, rankedResults, query, userId, {
        responseTime: Date.now() - startTime,
        resultCount: results.length,
        sortComplexity: this.calculateSortComplexity(sortOption, customWeights)
      })

      // 6. 预测性预加载
      this.predictivePreloading(query, sortOption, userId)

      return rankedResults
    } catch (error) {
      console.error('优化排序失败，降级到基础排序:', error)
      return await this.rankSearchResults(results, query, sortOption, userId, customWeights)
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(
    query: string,
    sortOption: SortOption,
    userId?: string,
    customWeights?: ScoringWeights
  ): string {
    const userPart = userId ? `:${userId}` : ''
    const weightsPart = customWeights ? `:${JSON.stringify(customWeights)}` : ''
    return `${this.cachePrefix}optimized:${query}:${sortOption}${userPart}${weightsPart}`
  }

  /**
   * 内存缓存管理
   */
  private memoryCache = new Map<string, { data: any; expiry: number }>()

  private async getFromMemoryCache(key: string): Promise<SearchResultWithSorting[] | null> {
    const cached = this.memoryCache.get(key)
    if (cached && cached.expiry > Date.now()) {
      return cached.data
    }
    if (cached) {
      this.memoryCache.delete(key) // 清除过期缓存
    }
    return null
  }

  private async setMemoryCache(
    key: string,
    data: SearchResultWithSorting[],
    ttlSeconds: number
  ): Promise<void> {
    const expiry = Date.now() + ttlSeconds * 1000
    this.memoryCache.set(key, { data, expiry })

    // 限制内存缓存大小
    if (this.memoryCache.size > 1000) {
      this.cleanupMemoryCache()
    }
  }

  private cleanupMemoryCache(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    this.memoryCache.forEach((value, key) => {
      if (value.expiry <= now) {
        keysToDelete.push(key)
      }
    })

    // 删除过期项
    keysToDelete.forEach(key => this.memoryCache.delete(key))

    // 如果还是太大，删除最老的项
    if (this.memoryCache.size > 800) {
      const entries = Array.from(this.memoryCache.entries())
      entries.sort((a, b) => a[1].expiry - b[1].expiry)
      const toDelete = entries.slice(0, 200)
      toDelete.forEach(([key]) => this.memoryCache.delete(key))
    }
  }

  /**
   * Redis缓存优化
   */
  private async getFromRedisCache(key: string): Promise<SearchResultWithSorting[] | null> {
    try {
      const cached = await redis.get(key)
      if (cached) {
        return JSON.parse(cached)
      }
      return null
    } catch (error) {
      console.error('Redis缓存读取失败:', error)
      return null
    }
  }

  /**
   * 查找相似缓存结果
   */
  private async findSimilarCachedResults(
    query: string,
    sortOption: SortOption,
    userId?: string
  ): Promise<{ query: string; results: SearchResultWithSorting[] } | null> {
    try {
      // 查询相似性算法：查找缓存中的相似查询
      const pattern = `${this.cachePrefix}optimized:*:${sortOption}${userId ? ':' + userId : ''}*`
      const keys = await redis.keys(pattern)

      for (const key of keys.slice(0, 10)) { // 限制检查数量
        const cachedQuery = this.extractQueryFromKey(key)
        if (this.calculateQuerySimilarity(query, cachedQuery) > 0.8) {
          const cached = await redis.get(key)
          if (cached) {
            return {
              query: cachedQuery,
              results: JSON.parse(cached)
            }
          }
        }
      }

      return null
    } catch (error) {
      console.error('查找相似缓存结果失败:', error)
      return null
    }
  }

  /**
   * 计算查询相似度
   */
  private calculateQuerySimilarity(query1: string, query2: string): number {
    const words1 = new Set(query1.toLowerCase().split(/\s+/))
    const words2 = new Set(query2.toLowerCase().split(/\s+/))

    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size // Jaccard相似度
  }

  /**
   * 从缓存键提取查询内容
   */
  private extractQueryFromKey(key: string): string {
    const parts = key.split(':')
    return parts[2] || '' // 假设格式为 prefix:optimized:query:sortOption...
  }

  /**
   * 判断是否应该使用相似结果
   */
  private shouldUseSimilarResults(
    currentResults: SearchResult[],
    cachedResults: SearchResultWithSorting[]
  ): boolean {
    // 简单检查：如果结果数量相近，可以使用缓存
    const countDiff = Math.abs(currentResults.length - cachedResults.length)
    return countDiff <= Math.max(3, currentResults.length * 0.1)
  }

  /**
   * 异步更新缓存
   */
  private asyncUpdateCache(key: string, results: SearchResultWithSorting[]): void {
    setTimeout(async () => {
      try {
        await redis.setex(key, this.cacheTtl, JSON.stringify(results))
        await this.setMemoryCache(key, results, 300)
      } catch (error) {
        console.error('异步缓存更新失败:', error)
      }
    }, 0)
  }

  /**
   * 智能缓存策略
   */
  private async intelligentCacheStrategy(
    key: string,
    results: SearchResultWithSorting[],
    query: string,
    userId?: string,
    metrics?: {
      responseTime: number
      resultCount: number
      sortComplexity: number
    }
  ): Promise<void> {
    try {
      // 根据查询特征确定缓存TTL
      let ttl = this.cacheTtl // 默认5分钟

      if (metrics) {
        // 复杂查询缓存更久
        if (metrics.sortComplexity > 0.7) {
          ttl = this.cacheTtl * 2 // 10分钟
        }

        // 高频查询缓存更久
        const queryFrequency = await this.getQueryFrequency(query, userId)
        if (queryFrequency > 10) {
          ttl = this.cacheTtl * 3 // 15分钟
        }

        // 个性化查询缓存时间较短
        if (userId) {
          ttl = Math.min(ttl, this.cacheTtl) // 最多5分钟
        }
      }

      // 存储到Redis
      await redis.setex(key, ttl, JSON.stringify(results))

      // 存储到内存缓存（更短的TTL）
      await this.setMemoryCache(key, results, Math.min(ttl, 300))

      // 记录缓存统计
      await this.updateCacheStats(key, 'set', metrics)
    } catch (error) {
      console.error('智能缓存策略执行失败:', error)
    }
  }

  /**
   * 预测性预加载
   */
  private predictivePreloading(query: string, sortOption: SortOption, userId?: string): void {
    setTimeout(async () => {
      try {
        // 基于查询历史预测可能的后续查询
        const predictedQueries = await this.predictNextQueries(query, userId)

        for (const predictedQuery of predictedQueries.slice(0, 3)) { // 限制预加载数量
          const cacheKey = this.generateCacheKey(predictedQuery, sortOption, userId)
          const exists = await redis.exists(cacheKey)

          if (!exists) {
            console.log(`预测性预加载: ${predictedQuery}`)
            // 这里应该触发后台预计算
            // await this.precomputeResults(predictedQuery, sortOption, userId)
          }
        }
      } catch (error) {
        console.error('预测性预加载失败:', error)
      }
    }, 1000) // 1秒后开始预加载
  }

  /**
   * 计算排序复杂度
   */
  private calculateSortComplexity(sortOption: SortOption, customWeights?: ScoringWeights): number {
    let complexity = 0.5 // 基础复杂度

    switch (sortOption) {
      case 'personalized':
        complexity = 0.9
        break
      case 'relevance':
        complexity = 0.7
        break
      case 'popularity':
        complexity = 0.6
        break
      case 'quality':
        complexity = 0.6
        break
      case 'recency':
        complexity = 0.4
        break
      case 'created':
        complexity = 0.3
        break
    }

    // 自定义权重增加复杂度
    if (customWeights) {
      complexity += 0.2
    }

    return Math.min(1.0, complexity)
  }

  /**
   * 获取查询频率
   */
  private async getQueryFrequency(query: string, userId?: string): Promise<number> {
    try {
      const key = `${this.cachePrefix}frequency:${query}${userId ? ':' + userId : ''}`
      const count = await redis.get(key)
      return count ? parseInt(count, 10) : 0
    } catch (error) {
      console.error('获取查询频率失败:', error)
      return 0
    }
  }

  /**
   * 预测后续查询
   */
  private async predictNextQueries(query: string, userId?: string): Promise<string[]> {
    try {
      // 简化的预测逻辑：基于查询历史和相似性
      const patterns = [
        query + ' 详情',
        query + ' 下载',
        query.replace(/\s+$/, '') + ' 表结构',
        query.split(' ')[0] // 第一个词
      ]

      return patterns.filter(p => p !== query)
    } catch (error) {
      console.error('查询预测失败:', error)
      return []
    }
  }

  /**
   * 更新缓存统计
   */
  private async updateCacheStats(
    key: string,
    operation: 'get' | 'set' | 'hit' | 'miss',
    metrics?: any
  ): Promise<void> {
    try {
      const statsKey = `${this.cachePrefix}stats:${new Date().toISOString().split('T')[0]}`
      const stats = await redis.get(statsKey) || '{}'
      const currentStats = JSON.parse(stats)

      currentStats[operation] = (currentStats[operation] || 0) + 1

      if (metrics) {
        currentStats.totalResponseTime = (currentStats.totalResponseTime || 0) + metrics.responseTime
        currentStats.totalQueries = (currentStats.totalQueries || 0) + 1
      }

      await redis.setex(statsKey, 86400, JSON.stringify(currentStats)) // 24小时
    } catch (error) {
      console.error('更新缓存统计失败:', error)
    }
  }

  /**
   * 获取缓存性能指标
   */
  async getCachePerformanceMetrics(): Promise<{
    hitRate: number
    avgResponseTime: number
    memoryUsage: number
    redisConnections: number
  }> {
    try {
      const today = new Date().toISOString().split('T')[0]
      const statsKey = `${this.cachePrefix}stats:${today}`
      const stats = await redis.get(statsKey)

      if (!stats) {
        return {
          hitRate: 0,
          avgResponseTime: 0,
          memoryUsage: this.memoryCache.size,
          redisConnections: 0
        }
      }

      const data = JSON.parse(stats)
      const totalRequests = (data.hit || 0) + (data.miss || 0)
      const hitRate = totalRequests > 0 ? (data.hit || 0) / totalRequests : 0
      const avgResponseTime = data.totalQueries > 0
        ? (data.totalResponseTime || 0) / data.totalQueries
        : 0

      return {
        hitRate,
        avgResponseTime,
        memoryUsage: this.memoryCache.size,
        redisConnections: 1 // 简化
      }
    } catch (error) {
      console.error('获取缓存性能指标失败:', error)
      return {
        hitRate: 0,
        avgResponseTime: 0,
        memoryUsage: 0,
        redisConnections: 0
      }
    }
  }

  /**
   * 获取默认评分权重
   */
  getDefaultWeights(): ScoringWeights {
    return { ...this.defaultWeights }
  }

  /**
   * 验证权重配置
   */
  validateWeights(weights: ScoringWeights): boolean {
    const sum = weights.relevance + weights.popularity + weights.recency + weights.personalization
    return Math.abs(sum - 1.0) < 0.001
  }
}

export const searchRankingService = new SearchRankingService()