import { z } from 'zod'
import { createTRPCRouter, publicProcedure, protectedProcedure } from '@/lib/trpc'
import {
  searchEngineService,
  LiveSearchInputSchema as ServiceLiveSearchInputSchema
} from '@/server/services/SearchEngineService'
import {
  searchSuggestionService,
  IntelligentSuggestInputSchema,
  SuggestionType
} from '@/server/services/SearchSuggestionService'
import {
  searchHistoryService,
  GetSearchHistoryInputSchema,
  SaveSearchHistoryInputSchema,
  ClearSearchHistoryInputSchema,
  UpdateSearchPreferencesInputSchema
} from '@/server/services/SearchHistoryService'
import {
  searchIndexUpdateService,
  BulkUpdateInputSchema,
  IndexUpdateType
} from '@/server/services/SearchIndexUpdateService'
import {
  searchPerformanceService
} from '@/server/services/SearchPerformanceService'
import {
  SearchInputSchema,
  SuggestInputSchema,
  SearchLogInputSchema,
  FilterOptionsInputSchema,
  FilterAggregationsInputSchema,
  AdvancedSearchInputSchema,
  SearchWithSortingInputSchema,
  SortingFeedbackInputSchema,
  SortOptionSchema,
  ScoringWeightsSchema
} from '@/types/search'
import {
  searchFilterService,
  FilterOptionsInputSchema as ServiceFilterOptionsInputSchema,
  FilterAggregationsInputSchema as ServiceFilterAggregationsInputSchema,
  AdvancedSearchInputSchema as ServiceAdvancedSearchInputSchema
} from '@/server/services/SearchFilterService'
import {
  searchRankingService
} from '@/server/services/SearchRankingService'
import {
  userBehaviorService
} from '@/server/services/UserBehaviorService'
import {
  userSortPreferenceService
} from '@/server/services/UserSortPreferenceService'
import {
  sortingConfigService
} from '@/server/services/SortingConfigService'
import {
  sortingPerformanceService
} from '@/server/services/SortingPerformanceService'
import {
  sortingBehaviorAnalyticsService
} from '@/server/services/SortingBehaviorAnalyticsService'
import {
  abTestManagerService
} from '@/server/services/ABTestManagerService'

/**
 * 搜索相关的 tRPC 路由
 * 提供全文搜索、搜索建议和搜索行为记录功能
 */
export const searchRouter = createTRPCRouter({
  /**
   * 搜索资产
   * 支持全文搜索、分页、排序和过滤
   */
  search: publicProcedure
    .input(SearchInputSchema)
    .query(async ({ input }) => {
      const requestId = searchPerformanceService.startTracking('search', { query: input.query })

      try {
        const result = await searchEngineService.search(input)

        // 记录成功的搜索性能
        await searchPerformanceService.endTracking(requestId, true, undefined, {
          query: input.query,
          resultCount: result.total,
          cacheHit: false, // 这里需要从searchEngineService传回缓存命中信息
          fallbackUsed: false
        })

        return {
          success: true,
          data: result
        }
      } catch (error) {
        console.error('搜索失败:', error)

        // 记录失败的搜索性能
        await searchPerformanceService.endTracking(requestId, false, error.message, {
          query: input.query,
          resultCount: 0,
          cacheHit: false,
          fallbackUsed: false
        })

        throw new Error('搜索服务暂时不可用，请稍后重试')
      }
    }),

  /**
   * 实时搜索资产
   * 提供快速、轻量级的实时搜索功能，优化响应时间
   */
  liveSearch: publicProcedure
    .input(ServiceLiveSearchInputSchema)
    .query(async ({ input }) => {
      const requestId = searchPerformanceService.startTracking('liveSearch', { query: input.query })

      try {
        const results = await searchEngineService.liveSearch(input)

        // 记录成功的实时搜索性能
        await searchPerformanceService.endTracking(requestId, true, undefined, {
          query: input.query,
          resultCount: results.length,
          cacheHit: false,
          fallbackUsed: false
        })

        return {
          success: true,
          data: results
        }
      } catch (error) {
        console.error('实时搜索失败:', error)

        // 记录失败的实时搜索性能
        await searchPerformanceService.endTracking(requestId, false, error.message, {
          query: input.query,
          resultCount: 0,
          cacheHit: false,
          fallbackUsed: false
        })

        return {
          success: false,
          data: []
        }
      }
    }),

  /**
   * 获取搜索建议
   * 基于用户输入提供自动完成建议
   */
  suggest: publicProcedure
    .input(SuggestInputSchema)
    .query(async ({ input }) => {
      const requestId = searchPerformanceService.startTracking('suggest', { query: input.query })

      try {
        const suggestions = await searchEngineService.suggest(input)

        // 记录成功的搜索建议性能
        await searchPerformanceService.endTracking(requestId, true, undefined, {
          query: input.query,
          resultCount: suggestions.length,
          cacheHit: false,
          fallbackUsed: false
        })

        return {
          success: true,
          data: suggestions
        }
      } catch (error) {
        console.error('获取搜索建议失败:', error)

        // 记录失败的搜索建议性能
        await searchPerformanceService.endTracking(requestId, false, error.message, {
          query: input.query,
          resultCount: 0,
          cacheHit: false,
          fallbackUsed: false
        })

        return {
          success: false,
          data: []
        }
      }
    }),

  /**
   * 获取智能搜索建议
   * 提供基于资产名称、分类、标签等的智能建议
   */
  intelligentSuggest: publicProcedure
    .input(IntelligentSuggestInputSchema)
    .query(async ({ input }) => {
      try {
        const suggestions = await searchSuggestionService.getIntelligentSuggestions(input)
        return {
          success: true,
          data: suggestions
        }
      } catch (error) {
        console.error('获取智能搜索建议失败:', error)
        return {
          success: false,
          data: []
        }
      }
    }),

  /**
   * 获取热门搜索建议
   * 返回当前热门的搜索词和资产
   */
  popularSuggestions: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(20).default(10)
    }))
    .query(async ({ input }) => {
      try {
        const suggestions = await searchSuggestionService.getPopularSuggestions(input.limit)
        return {
          success: true,
          data: suggestions
        }
      } catch (error) {
        console.error('获取热门搜索建议失败:', error)
        return {
          success: false,
          data: []
        }
      }
    }),

  /**
   * 获取用户搜索历史
   * 返回用户的搜索历史记录
   */
  getSearchHistory: protectedProcedure
    .input(GetSearchHistoryInputSchema)
    .query(async ({ input }) => {
      try {
        const history = await searchHistoryService.getSearchHistory(input)
        return {
          success: true,
          data: history
        }
      } catch (error) {
        console.error('获取搜索历史失败:', error)
        return {
          success: false,
          data: []
        }
      }
    }),

  /**
   * 保存搜索历史
   * 将用户搜索记录保存到历史中
   */
  saveSearchHistory: protectedProcedure
    .input(SaveSearchHistoryInputSchema)
    .mutation(async ({ input }) => {
      try {
        await searchHistoryService.saveSearchHistory(input)
        return {
          success: true,
          message: '搜索历史保存成功'
        }
      } catch (error) {
        console.error('保存搜索历史失败:', error)
        return {
          success: false,
          message: '保存搜索历史失败'
        }
      }
    }),

  /**
   * 清除用户搜索历史
   * 清空用户的所有搜索历史记录
   */
  clearSearchHistory: protectedProcedure
    .input(ClearSearchHistoryInputSchema)
    .mutation(async ({ input }) => {
      try {
        await searchHistoryService.clearSearchHistory(input)
        return {
          success: true,
          message: '搜索历史清除成功'
        }
      } catch (error) {
        console.error('清除搜索历史失败:', error)
        throw new Error('清除搜索历史失败')
      }
    }),

  /**
   * 获取用户搜索偏好
   * 返回用户的搜索偏好设置
   */
  getUserSearchPreferences: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      try {
        const preferences = await searchHistoryService.getUserSearchPreferences(input.userId)
        return {
          success: true,
          data: preferences
        }
      } catch (error) {
        console.error('获取用户搜索偏好失败:', error)
        throw new Error('获取用户搜索偏好失败')
      }
    }),

  /**
   * 更新用户搜索偏好
   * 更新用户的搜索偏好设置
   */
  updateUserSearchPreferences: protectedProcedure
    .input(UpdateSearchPreferencesInputSchema)
    .mutation(async ({ input }) => {
      try {
        await searchHistoryService.updateUserSearchPreferences(input)
        return {
          success: true,
          message: '搜索偏好更新成功'
        }
      } catch (error) {
        console.error('更新用户搜索偏好失败:', error)
        throw new Error('更新用户搜索偏好失败')
      }
    }),

  /**
   * 获取用户热门搜索词
   * 返回用户的高频搜索词列表
   */
  getFrequentSearches: protectedProcedure
    .input(z.object({
      userId: z.string(),
      limit: z.number().min(1).max(20).default(10)
    }))
    .query(async ({ input }) => {
      try {
        const frequentSearches = await searchHistoryService.getFrequentSearches(input.userId, input.limit)
        return {
          success: true,
          data: frequentSearches
        }
      } catch (error) {
        console.error('获取热门搜索词失败:', error)
        return {
          success: false,
          data: []
        }
      }
    }),

  /**
   * 记录搜索行为
   * 用于搜索分析和优化
   */
  logSearchAction: protectedProcedure
    .input(SearchLogInputSchema)
    .mutation(async ({ input }) => {
      try {
        await searchEngineService.logSearchAction(
          input.query,
          input.action,
          input.sessionId
        )
        return {
          success: true,
          message: '搜索行为记录成功'
        }
      } catch (error) {
        console.error('记录搜索行为失败:', error)
        return {
          success: false,
          message: '记录搜索行为失败'
        }
      }
    }),

  /**
   * 搜索引擎健康检查
   * 检查Elasticsearch服务是否正常
   */
  healthCheck: protectedProcedure
    .query(async () => {
      try {
        const isHealthy = await searchEngineService.healthCheck()
        return {
          success: true,
          data: {
            elasticsearch: isHealthy,
            message: isHealthy ? '搜索引擎运行正常' : '搜索引擎连接失败，将使用数据库搜索'
          }
        }
      } catch (error) {
        return {
          success: false,
          data: {
            elasticsearch: false,
            message: '健康检查失败'
          }
        }
      }
    }),

  /**
   * 初始化搜索索引
   * 管理员功能：创建和配置Elasticsearch索引
   */
  initializeIndex: protectedProcedure
    .mutation(async ({ ctx }) => {
      // 检查用户权限（应为管理员）
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以初始化搜索索引')
      }

      try {
        await searchEngineService.initializeIndex()
        return {
          success: true,
          message: '搜索索引初始化成功'
        }
      } catch (error) {
        console.error('初始化搜索索引失败:', error)
        throw new Error('搜索索引初始化失败')
      }
    }),

  /**
   * 同步资产到搜索索引
   * 管理员功能：将数据库中的资产同步到Elasticsearch
   */
  syncAssetsToIndex: protectedProcedure
    .input(z.object({
      assetIds: z.array(z.string()).optional(),
      fullSync: z.boolean().default(false)
    }))
    .mutation(async ({ input, ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以同步搜索索引')
      }

      try {
        if (input.fullSync) {
          await searchEngineService.bulkUpdateIndex()
        } else if (input.assetIds && input.assetIds.length > 0) {
          await searchEngineService.bulkUpdateIndex(input.assetIds)
        } else {
          throw new Error('请指定要同步的资产ID或选择全量同步')
        }

        return {
          success: true,
          message: `资产同步到搜索索引成功${input.fullSync ? '（全量）' : `（${input.assetIds?.length}个资产）`}`
        }
      } catch (error) {
        console.error('同步资产到搜索索引失败:', error)
        throw new Error('资产同步失败')
      }
    }),

  /**
   * 获取搜索统计信息
   * 管理员功能：查看搜索相关的统计数据
   */
  getSearchStats: protectedProcedure
    .query(async ({ ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以查看搜索统计')
      }

      try {
        // 这里可以实现搜索统计逻辑
        // 例如：搜索热词、搜索频率、用户搜索行为分析等
        return {
          success: true,
          data: {
            totalSearches: 0, // TODO: 从数据库或缓存中获取实际数据
            averageResponseTime: 0,
            popularQueries: [],
            searchVolumeTrend: []
          }
        }
      } catch (error) {
        console.error('获取搜索统计失败:', error)
        throw new Error('获取搜索统计失败')
      }
    }),

  /**
   * 调度资产索引更新
   * 管理员功能：手动触发资产索引更新
   */
  scheduleIndexUpdate: protectedProcedure
    .input(z.object({
      assetId: z.string(),
      updateType: z.nativeEnum(IndexUpdateType),
      priority: z.number().min(1).max(10).default(5)
    }))
    .mutation(async ({ input, ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以调度索引更新')
      }

      try {
        const { assetId, updateType, priority } = input

        switch (updateType) {
          case IndexUpdateType.CREATE:
            await searchIndexUpdateService.scheduleAssetCreate(assetId, priority)
            break
          case IndexUpdateType.UPDATE:
            await searchIndexUpdateService.scheduleAssetUpdate(assetId, priority)
            break
          case IndexUpdateType.DELETE:
            await searchIndexUpdateService.scheduleAssetDelete(assetId, priority)
            break
          default:
            throw new Error(`不支持的更新类型: ${updateType}`)
        }

        return {
          success: true,
          message: `索引更新任务已调度: ${updateType} ${assetId}`
        }
      } catch (error) {
        console.error('调度索引更新失败:', error)
        throw new Error('调度索引更新失败')
      }
    }),

  /**
   * 批量调度索引更新
   * 管理员功能：批量更新资产索引
   */
  scheduleBulkIndexUpdate: protectedProcedure
    .input(BulkUpdateInputSchema)
    .mutation(async ({ input, ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以调度批量索引更新')
      }

      try {
        await searchIndexUpdateService.scheduleBulkUpdate(input)

        const message = input.fullSync
          ? '全量索引更新任务已调度'
          : `批量索引更新任务已调度，资产数量: ${input.assetIds?.length || 0}`

        return {
          success: true,
          message
        }
      } catch (error) {
        console.error('调度批量索引更新失败:', error)
        throw new Error('调度批量索引更新失败')
      }
    }),

  /**
   * 获取索引更新队列状态
   * 管理员功能：查看索引更新队列状态
   */
  getIndexUpdateQueueStatus: protectedProcedure
    .query(async ({ ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以查看队列状态')
      }

      try {
        const status = await searchIndexUpdateService.getQueueStatus()
        return {
          success: true,
          data: status
        }
      } catch (error) {
        console.error('获取队列状态失败:', error)
        throw new Error('获取队列状态失败')
      }
    }),

  /**
   * 获取索引统计信息
   * 管理员功能：查看搜索索引的统计信息
   */
  getIndexStats: protectedProcedure
    .query(async ({ ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以查看索引统计')
      }

      try {
        const stats = await searchEngineService.getIndexStats()
        return {
          success: true,
          data: stats
        }
      } catch (error) {
        console.error('获取索引统计失败:', error)
        throw new Error('获取索引统计失败')
      }
    }),

  /**
   * 获取实时性能统计
   * 管理员功能：查看搜索服务的实时性能指标
   */
  getRealTimePerformanceStats: protectedProcedure
    .query(async ({ ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以查看性能统计')
      }

      try {
        const stats = await searchPerformanceService.getRealTimeStats()
        return {
          success: true,
          data: stats
        }
      } catch (error) {
        console.error('获取实时性能统计失败:', error)
        throw new Error('获取实时性能统计失败')
      }
    }),

  /**
   * 获取性能报告
   * 管理员功能：生成详细的性能分析报告
   */
  getPerformanceReport: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(30).default(7)
    }))
    .query(async ({ input, ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以查看性能报告')
      }

      try {
        const report = await searchPerformanceService.getPerformanceReport(input.days)
        return {
          success: true,
          data: report
        }
      } catch (error) {
        console.error('获取性能报告失败:', error)
        throw new Error('获取性能报告失败')
      }
    }),

  /**
   * 获取性能警报
   * 管理员功能：查看性能警报历史
   */
  getPerformanceAlerts: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50)
    }))
    .query(async ({ input, ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以查看性能警报')
      }

      try {
        const alerts = await searchPerformanceService.getPerformanceAlerts(input.limit)
        return {
          success: true,
          data: alerts
        }
      } catch (error) {
        console.error('获取性能警报失败:', error)
        throw new Error('获取性能警报失败')
      }
    }),

  /**
   * 设置性能阈值
   * 管理员功能：配置性能监控阈值
   */
  setPerformanceThresholds: protectedProcedure
    .input(z.object({
      maxResponseTime: z.number().min(100).max(10000).optional(),
      maxErrorRate: z.number().min(0).max(100).optional(),
      minCacheHitRate: z.number().min(0).max(100).optional(),
      maxActiveRequests: z.number().min(10).max(1000).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以设置性能阈值')
      }

      try {
        await searchPerformanceService.setPerformanceThresholds(input)
        return {
          success: true,
          message: '性能阈值设置成功'
        }
      } catch (error) {
        console.error('设置性能阈值失败:', error)
        throw new Error('设置性能阈值失败')
      }
    }),

  /**
   * 刷新搜索索引
   * 管理员功能：立即刷新搜索索引使更改可见
   */
  refreshSearchIndex: protectedProcedure
    .mutation(async ({ ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以刷新索引')
      }

      try {
        await searchEngineService.refreshIndex()
        return {
          success: true,
          message: '搜索索引刷新成功'
        }
      } catch (error) {
        console.error('刷新搜索索引失败:', error)
        throw new Error('刷新搜索索引失败')
      }
    }),

  /**
   * 优化搜索索引
   * 管理员功能：优化搜索索引性能
   */
  optimizeSearchIndex: protectedProcedure
    .mutation(async ({ ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以优化索引')
      }

      try {
        await searchEngineService.optimizeIndex()
        return {
          success: true,
          message: '搜索索引优化成功'
        }
      } catch (error) {
        console.error('优化搜索索引失败:', error)
        throw new Error('优化搜索索引失败')
      }
    }),

  /**
   * 获取筛选器选项
   * 返回所有可用的筛选维度及其统计信息
   */
  getFilterOptions: publicProcedure
    .input(ServiceFilterOptionsInputSchema)
    .query(async ({ input }) => {
      try {
        const filterOptions = await searchFilterService.getFilterOptions(input)
        return {
          success: true,
          data: filterOptions
        }
      } catch (error) {
        console.error('获取筛选器选项失败:', error)
        return {
          success: false,
          data: {
            categories: [],
            statuses: [],
            types: [],
            owners: [],
            tags: [],
            qualityScoreRanges: [],
            dateRanges: []
          }
        }
      }
    }),

  /**
   * 获取筛选器聚合统计
   * 根据当前搜索和筛选条件返回聚合统计信息
   */
  getFilterAggregations: publicProcedure
    .input(ServiceFilterAggregationsInputSchema)
    .query(async ({ input }) => {
      try {
        const aggregations = await searchFilterService.getFilterAggregations(input)
        return {
          success: true,
          data: aggregations
        }
      } catch (error) {
        console.error('获取筛选器聚合统计失败:', error)
        return {
          success: false,
          data: {
            categories: {},
            statuses: {},
            types: {},
            owners: {},
            tags: {},
            qualityScoreDistribution: [],
            updateTimeDistribution: [],
            totalResults: 0
          }
        }
      }
    }),

  /**
   * 高级搜索
   * 支持复杂筛选条件的搜索功能
   */
  advancedSearch: publicProcedure
    .input(ServiceAdvancedSearchInputSchema)
    .query(async ({ input }) => {
      const requestId = searchPerformanceService.startTracking('advancedSearch', {
        query: input.query,
        filtersCount: input.filters ? Object.keys(input.filters).filter(key =>
          input.filters![key as keyof typeof input.filters] !== undefined
        ).length : 0
      })

      try {
        // 验证筛选条件
        if (input.filters) {
          const validation = searchFilterService.validateFilters(input.filters)
          if (!validation.valid) {
            throw new Error(`筛选条件验证失败: ${validation.errors.join(', ')}`)
          }
        }

        const result = await searchFilterService.advancedSearch(input)

        // 记录成功的高级搜索性能
        await searchPerformanceService.endTracking(requestId, true, undefined, {
          query: input.query,
          resultCount: result.total,
          cacheHit: false,
          fallbackUsed: false,
          filtersApplied: input.filters ? Object.keys(input.filters).length : 0
        })

        return {
          success: true,
          data: result
        }
      } catch (error) {
        console.error('高级搜索失败:', error)

        // 记录失败的高级搜索性能
        await searchPerformanceService.endTracking(requestId, false, error.message, {
          query: input.query,
          resultCount: 0,
          cacheHit: false,
          fallbackUsed: false,
          filtersApplied: input.filters ? Object.keys(input.filters).length : 0
        })

        throw new Error('高级搜索服务暂时不可用，请稍后重试')
      }
    }),

  /**
   * 验证筛选条件
   * 确保筛选条件的合法性和安全性
   */
  validateFilters: publicProcedure
    .input(z.object({
      filters: z.object({
        categories: z.array(z.string()).optional(),
        statuses: z.array(z.string()).optional(),
        types: z.array(z.string()).optional(),
        owners: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        qualityScoreMin: z.number().min(0).max(10).optional(),
        qualityScoreMax: z.number().min(0).max(10).optional(),
        updatedAfter: z.string().optional(),
        updatedBefore: z.string().optional(),
        createdAfter: z.string().optional(),
        createdBefore: z.string().optional(),
        logicOperator: z.enum(['AND', 'OR']).default('AND')
      })
    }))
    .query(async ({ input }) => {
      try {
        const validation = searchFilterService.validateFilters(input.filters)
        return {
          success: true,
          data: validation
        }
      } catch (error) {
        console.error('筛选条件验证失败:', error)
        return {
          success: false,
          data: {
            valid: false,
            errors: ['筛选条件验证失败']
          }
        }
      }
    }),

  // ========================= 智能排序相关API =========================

  /**
   * 智能搜索 - 带排序功能的搜索
   * 支持多种排序策略和个性化推荐
   */
  intelligentSearch: publicProcedure
    .input(SearchWithSortingInputSchema)
    .query(async ({ input, ctx }) => {
      const requestId = sortingPerformanceService.startSortingTracking('intelligentSearch')

      try {
        // 首先执行基础搜索
        const baseSearchResult = await searchEngineService.search({
          query: input.query,
          page: input.page,
          pageSize: input.pageSize,
          filters: input.filters
        })

        // 对搜索结果进行智能排序
        const rankedResults = await searchRankingService.rankSearchResults(
          baseSearchResult.items,
          input.query,
          input.sortOption,
          ctx.user?.id, // 用户ID用于个性化
          input.customWeights
        )

        // 记录用户搜索行为
        if (ctx.user?.id) {
          userBehaviorService.recordSearchBehavior(
            ctx.user.id,
            input.query,
            [], // 点击记录将在用户实际点击时记录
            input.sortOption || 'relevance',
            `session_${Date.now()}`
          ).catch(error => {
            console.error('记录搜索行为失败:', error)
          })
        }

        // 记录排序性能
        const responseTime = await sortingPerformanceService.endSortingTracking(
          requestId,
          input.sortOption || 'relevance',
          rankedResults.length,
          ctx.user?.id
        )

        return {
          success: true,
          data: {
            ...baseSearchResult,
            items: rankedResults,
            sortMethod: input.sortOption || 'relevance',
            responseTime
          }
        }
      } catch (error) {
        console.error('智能搜索失败:', error)

        await sortingPerformanceService.endSortingTracking(
          requestId,
          input.sortOption || 'relevance',
          0,
          ctx.user?.id,
          error.message
        )

        throw new Error('智能搜索服务暂时不可用，请稍后重试')
      }
    }),

  /**
   * 获取用户排序偏好
   * 返回用户的个性化排序设置和推荐
   */
  getUserSortPreferences: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const preferences = await userSortPreferenceService.getUserSortPreferences(ctx.user.id)
        const stats = await userSortPreferenceService.getSortUsageStats(ctx.user.id)
        const recommendation = await userSortPreferenceService.recommendSortConfiguration(ctx.user.id)

        return {
          success: true,
          data: {
            preferences,
            statistics: stats,
            recommendation
          }
        }
      } catch (error) {
        console.error('获取用户排序偏好失败:', error)
        throw new Error('获取排序偏好失败')
      }
    }),

  /**
   * 更新用户默认排序方式
   */
  updateUserDefaultSort: protectedProcedure
    .input(z.object({
      defaultSort: SortOptionSchema
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await userSortPreferenceService.updateDefaultSort(ctx.user.id, input.defaultSort)
        return {
          success: true,
          message: '默认排序方式更新成功'
        }
      } catch (error) {
        console.error('更新默认排序失败:', error)
        throw new Error('更新默认排序失败')
      }
    }),

  /**
   * 保存自定义排序配置
   */
  saveSortConfiguration: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(50),
      sort: SortOptionSchema,
      weights: ScoringWeightsSchema.optional()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await userSortPreferenceService.saveSortConfiguration(
          ctx.user.id,
          input.name,
          input.sort,
          input.weights
        )
        return {
          success: true,
          message: '排序配置保存成功'
        }
      } catch (error) {
        console.error('保存排序配置失败:', error)
        throw error // 保持原始错误信息
      }
    }),

  /**
   * 删除保存的排序配置
   */
  deleteSortConfiguration: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(50)
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await userSortPreferenceService.deleteSortConfiguration(ctx.user.id, input.name)
        return {
          success: true,
          message: '排序配置删除成功'
        }
      } catch (error) {
        console.error('删除排序配置失败:', error)
        throw error // 保持原始错误信息
      }
    }),

  /**
   * 记录排序使用情况
   */
  recordSortUsage: protectedProcedure
    .input(z.object({
      sortMethod: SortOptionSchema
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await userSortPreferenceService.recordSortUsage(ctx.user.id, input.sortMethod)
        return {
          success: true,
          message: '排序使用记录成功'
        }
      } catch (error) {
        console.error('记录排序使用失败:', error)
        return {
          success: false,
          message: '记录排序使用失败'
        }
      }
    }),

  /**
   * 记录排序反馈
   * 收集用户对排序效果的反馈，用于算法优化
   */
  recordSortingFeedback: protectedProcedure
    .input(SortingFeedbackInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // 记录用户对特定资产的反馈
        if (input.assetId && input.rating) {
          await userBehaviorService.recordAssetInteraction(
            ctx.user.id,
            input.assetId,
            'click', // 反馈可以视为一种点击行为
            {
              query: input.query,
              sortMethod: input.sortMethod,
              position: input.position,
              feedback: {
                rating: input.rating,
                comment: input.comment
              }
            }
          )
        }

        // 记录排序方法的整体满意度
        await sortingPerformanceService.recordUserFeedback(
          ctx.user.id,
          input.sortMethod,
          input.query,
          {
            overallSatisfaction: input.overallSatisfaction,
            relevanceRating: input.relevanceRating,
            specificFeedback: input.comment,
            sessionId: input.sessionId
          }
        )

        return {
          success: true,
          message: '排序反馈记录成功'
        }
      } catch (error) {
        console.error('记录排序反馈失败:', error)
        return {
          success: false,
          message: '记录排序反馈失败'
        }
      }
    }),

  /**
   * 获取排序配置推荐
   * 基于查询上下文推荐最适合的排序配置
   */
  getSortConfigRecommendation: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      context: z.object({
        hasHistory: z.boolean().default(false),
        preferredCategories: z.array(z.string()).default([]),
        queryFrequency: z.number().default(1)
      }).optional()
    }))
    .query(async ({ input, ctx }) => {
      try {
        const userContext = input.context || {
          hasHistory: false,
          preferredCategories: [],
          queryFrequency: 1
        }

        // 如果用户已登录，从用户行为服务获取更准确的上下文
        if (ctx.user?.id) {
          const userConfig = await userBehaviorService.getPersonalizationConfig(ctx.user.id)
          if (userConfig) {
            userContext.hasHistory = userConfig.searchHistory.length > 0
            userContext.preferredCategories = userConfig.preferredCategories
          }
        }

        const recommendation = await sortingConfigService.getConfigRecommendation(
          input.query,
          userContext
        )

        return {
          success: true,
          data: recommendation
        }
      } catch (error) {
        console.error('获取排序配置推荐失败:', error)
        return {
          success: false,
          data: {
            configName: 'relevance',
            weights: {
              relevance: 0.4,
              popularity: 0.3,
              recency: 0.2,
              personalization: 0.1
            },
            reason: '默认推荐',
            confidence: 0.5
          }
        }
      }
    }),

  /**
   * 获取排序性能统计
   * 管理员功能：查看排序算法的性能指标
   */
  getSortingPerformanceStats: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(30).default(7),
      sortMethod: SortOptionSchema.optional()
    }))
    .query(async ({ input, ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以查看排序性能统计')
      }

      try {
        const stats = await sortingPerformanceService.getPerformanceStats(input.days, input.sortMethod)
        return {
          success: true,
          data: stats
        }
      } catch (error) {
        console.error('获取排序性能统计失败:', error)
        throw new Error('获取排序性能统计失败')
      }
    }),

  /**
   * 获取A/B测试状态
   * 管理员功能：查看排序算法A/B测试结果
   */
  getABTestStatus: protectedProcedure
    .query(async ({ ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以查看A/B测试状态')
      }

      try {
        const abTests = await sortingConfigService.getActiveABTests()
        return {
          success: true,
          data: abTests
        }
      } catch (error) {
        console.error('获取A/B测试状态失败:', error)
        throw new Error('获取A/B测试状态失败')
      }
    }),

  /**
   * 创建A/B测试
   * 管理员功能：创建新的排序算法A/B测试
   */
  createABTest: protectedProcedure
    .input(z.object({
      testName: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      controlWeights: ScoringWeightsSchema,
      testWeights: ScoringWeightsSchema,
      trafficSplit: z.number().min(0.1).max(0.9).default(0.5),
      duration: z.number().min(1).max(30).default(7) // 天数
    }))
    .mutation(async ({ input, ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以创建A/B测试')
      }

      try {
        const testId = await sortingConfigService.createABTest({
          testName: input.testName,
          description: input.description,
          controlWeights: input.controlWeights,
          testWeights: input.testWeights,
          trafficSplit: input.trafficSplit,
          startDate: new Date(),
          endDate: new Date(Date.now() + input.duration * 24 * 60 * 60 * 1000),
          status: 'active',
          createdBy: ctx.user.id
        })

        return {
          success: true,
          data: { testId },
          message: 'A/B测试创建成功'
        }
      } catch (error) {
        console.error('创建A/B测试失败:', error)
        throw new Error('创建A/B测试失败')
      }
    }),

  /**
   * 获取全局排序偏好统计
   * 管理员功能：查看所有用户的排序偏好统计
   */
  getGlobalSortPreferenceStats: protectedProcedure
    .query(async ({ ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以查看全局统计')
      }

      try {
        const stats = await userSortPreferenceService.getGlobalSortPreferenceStats()
        return {
          success: true,
          data: stats
        }
      } catch (error) {
        console.error('获取全局排序偏好统计失败:', error)
        throw new Error('获取全局排序偏好统计失败')
      }
    }),

  /**
   * 导出用户排序偏好
   * 允许用户导出自己的排序偏好配置
   */
  exportSortPreferences: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const preferences = await userSortPreferenceService.exportSortPreferences(ctx.user.id)
        return {
          success: true,
          data: preferences,
          message: '排序偏好导出成功'
        }
      } catch (error) {
        console.error('导出排序偏好失败:', error)
        throw new Error('导出排序偏好失败')
      }
    }),

  /**
   * 导入用户排序偏好
   * 允许用户导入排序偏好配置
   */
  importSortPreferences: protectedProcedure
    .input(z.object({
      preferences: z.object({
        defaultSort: SortOptionSchema.optional(),
        savedSorts: z.array(z.object({
          name: z.string(),
          sort: SortOptionSchema,
          weights: ScoringWeightsSchema.optional(),
          createdAt: z.date()
        })).optional(),
        sortFrequency: z.record(SortOptionSchema, z.number()).optional()
      })
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await userSortPreferenceService.importSortPreferences(ctx.user.id, input.preferences)
        return {
          success: true,
          message: '排序偏好导入成功'
        }
      } catch (error) {
        console.error('导入排序偏好失败:', error)
        throw error // 保持原始错误信息
      }
    }),

  /**
   * 重置用户排序偏好
   * 将用户排序偏好重置为默认设置
   */
  resetSortPreferences: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        await userSortPreferenceService.resetSortPreferences(ctx.user.id)
        return {
          success: true,
          message: '排序偏好重置成功'
        }
      } catch (error) {
        console.error('重置排序偏好失败:', error)
        throw new Error('重置排序偏好失败')
      }
    }),

  // ========================= 排序行为分析和A/B测试API =========================

  /**
   * 开始搜索会话跟踪
   * 记录用户搜索会话开始，用于行为分析
   */
  startSearchSession: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      query: z.string(),
      sortOption: SortOptionSchema.default('relevance'),
      resultCount: z.number().default(0)
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await sortingBehaviorAnalyticsService.recordSearchSessionStart(
          input.sessionId,
          ctx.user?.id,
          {
            query: input.query,
            sortOption: input.sortOption,
            resultCount: input.resultCount,
            timestamp: new Date()
          }
        )

        return {
          success: true,
          message: '搜索会话跟踪开始'
        }
      } catch (error) {
        console.error('开始搜索会话跟踪失败:', error)
        return {
          success: false,
          message: '开始搜索会话跟踪失败'
        }
      }
    }),

  /**
   * 记录搜索结果交互
   * 记录用户与搜索结果的交互行为
   */
  recordResultInteraction: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      assetId: z.string(),
      interactionType: z.enum(['view', 'click', 'download', 'bookmark', 'share']),
      position: z.number().optional(),
      query: z.string().optional(),
      sortMethod: SortOptionSchema.optional()
    }))
    .mutation(async ({ input }) => {
      try {
        await sortingBehaviorAnalyticsService.recordResultInteraction(
          input.sessionId,
          input.assetId,
          input.interactionType,
          {
            position: input.position || 0,
            timestamp: new Date(),
            query: input.query,
            sortMethod: input.sortMethod
          }
        )

        return {
          success: true,
          message: '交互记录成功'
        }
      } catch (error) {
        console.error('记录搜索结果交互失败:', error)
        return {
          success: false,
          message: '记录交互失败'
        }
      }
    }),

  /**
   * 结束搜索会话
   * 记录搜索会话结束，计算会话统计信息
   */
  endSearchSession: publicProcedure
    .input(z.object({
      sessionId: z.string()
    }))
    .mutation(async ({ input }) => {
      try {
        await sortingBehaviorAnalyticsService.recordSearchSessionEnd(input.sessionId)

        return {
          success: true,
          message: '搜索会话已结束'
        }
      } catch (error) {
        console.error('结束搜索会话失败:', error)
        return {
          success: false,
          message: '结束搜索会话失败'
        }
      }
    }),

  /**
   * 获取排序效果分析
   * 管理员功能：获取排序算法效果的综合分析
   */
  getSortingEffectivenessAnalysis: protectedProcedure
    .input(z.object({
      startDate: z.string().transform(str => new Date(str)),
      endDate: z.string().transform(str => new Date(str)),
      sortMethod: SortOptionSchema.optional(),
      userId: z.string().optional(),
      query: z.string().optional()
    }))
    .query(async ({ input, ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以查看排序效果分析')
      }

      try {
        const analysis = await sortingBehaviorAnalyticsService.getSortingEffectivenessAnalysis(
          {
            startDate: input.startDate,
            endDate: input.endDate
          },
          {
            sortMethod: input.sortMethod,
            userId: input.userId,
            query: input.query
          }
        )

        return {
          success: true,
          data: analysis
        }
      } catch (error) {
        console.error('获取排序效果分析失败:', error)
        throw new Error('获取排序效果分析失败')
      }
    }),

  /**
   * 获取用户排序行为洞察
   * 为用户提供个性化的排序行为分析洞察
   */
  getUserSortingBehaviorInsights: protectedProcedure
    .input(z.object({
      startDate: z.string().transform(str => new Date(str)).optional(),
      endDate: z.string().transform(str => new Date(str)).optional()
    }))
    .query(async ({ input, ctx }) => {
      try {
        const timeRange = input.startDate && input.endDate ? {
          startDate: input.startDate,
          endDate: input.endDate
        } : undefined

        const insights = await sortingBehaviorAnalyticsService.getUserSortingBehaviorInsights(
          ctx.user.id,
          timeRange
        )

        return {
          success: true,
          data: insights
        }
      } catch (error) {
        console.error('获取用户排序行为洞察失败:', error)
        throw new Error('获取用户排序行为洞察失败')
      }
    }),

  /**
   * 生成排序优化建议
   * 管理员功能：基于数据分析生成排序算法优化建议
   */
  generateSortingOptimizationSuggestions: protectedProcedure
    .query(async ({ ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以查看优化建议')
      }

      try {
        const suggestions = await sortingBehaviorAnalyticsService.generateSortingOptimizationSuggestions()

        return {
          success: true,
          data: suggestions
        }
      } catch (error) {
        console.error('生成排序优化建议失败:', error)
        throw new Error('生成排序优化建议失败')
      }
    }),

  /**
   * 获取实时排序监控指标
   * 管理员功能：获取排序系统的实时性能监控数据
   */
  getRealTimeSortingMetrics: protectedProcedure
    .query(async ({ ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以查看实时监控指标')
      }

      try {
        const metrics = await sortingBehaviorAnalyticsService.getRealTimeSortingMetrics()

        return {
          success: true,
          data: metrics
        }
      } catch (error) {
        console.error('获取实时排序监控指标失败:', error)
        throw new Error('获取实时监控指标失败')
      }
    }),

  /**
   * 获取A/B测试结果分析
   * 管理员功能：获取指定A/B测试的详细结果分析
   */
  getABTestResultAnalysis: protectedProcedure
    .input(z.object({
      testId: z.string()
    }))
    .query(async ({ input, ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以查看A/B测试结果')
      }

      try {
        const analysis = await abTestManagerService.getTestResultAnalysis(input.testId)

        return {
          success: true,
          data: analysis
        }
      } catch (error) {
        console.error('获取A/B测试结果分析失败:', error)
        throw new Error('获取A/B测试结果分析失败')
      }
    }),

  /**
   * 停止A/B测试
   * 管理员功能：手动停止正在运行的A/B测试
   */
  stopABTest: protectedProcedure
    .input(z.object({
      testId: z.string(),
      reason: z.string().min(1).max(200)
    }))
    .mutation(async ({ input, ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以停止A/B测试')
      }

      try {
        await abTestManagerService.stopABTest(input.testId, input.reason, ctx.user.id)

        return {
          success: true,
          message: 'A/B测试已停止'
        }
      } catch (error) {
        console.error('停止A/B测试失败:', error)
        throw new Error('停止A/B测试失败')
      }
    }),

  /**
   * 为用户分配A/B测试变体
   * 系统内部API：为参与A/B测试的用户分配测试变体
   */
  assignABTestVariant: publicProcedure
    .input(z.object({
      testId: z.string(),
      forceVariant: z.enum(['control', 'test']).optional()
    }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user?.id) {
        return {
          success: false,
          data: null
        }
      }

      try {
        const assignment = await abTestManagerService.assignUserToVariant(
          input.testId,
          ctx.user.id,
          input.forceVariant
        )

        return {
          success: true,
          data: assignment
        }
      } catch (error) {
        console.error('分配A/B测试变体失败:', error)
        return {
          success: false,
          data: null
        }
      }
    }),

  /**
   * 记录A/B测试结果
   * 记录用户在A/B测试中的行为和结果指标
   */
  recordABTestResult: publicProcedure
    .input(z.object({
      testId: z.string(),
      sessionId: z.string(),
      metrics: z.object({
        satisfactionScore: z.number().min(1).max(5).optional(),
        clickThroughRate: z.number().min(0).max(1).optional(),
        responseTime: z.number().min(0).optional(),
        converted: z.boolean().optional(),
        sessionDuration: z.number().min(0).optional()
      })
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) {
        return {
          success: false,
          message: '需要用户登录'
        }
      }

      try {
        await abTestManagerService.recordTestResult(
          input.testId,
          ctx.user.id,
          input.sessionId,
          input.metrics
        )

        return {
          success: true,
          message: 'A/B测试结果记录成功'
        }
      } catch (error) {
        console.error('记录A/B测试结果失败:', error)
        return {
          success: false,
          message: '记录A/B测试结果失败'
        }
      }
    }),

  /**
   * 清理过期A/B测试
   * 管理员功能：清理已过期的A/B测试
   */
  cleanupExpiredABTests: protectedProcedure
    .mutation(async ({ ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以清理过期测试')
      }

      try {
        await abTestManagerService.cleanupExpiredTests()

        return {
          success: true,
          message: '过期A/B测试清理完成'
        }
      } catch (error) {
        console.error('清理过期A/B测试失败:', error)
        throw new Error('清理过期测试失败')
      }
    }),

  /**
   * 清除排序分析缓存
   * 管理员功能：清除排序行为分析相关的缓存数据
   */
  clearSortingAnalyticsCache: protectedProcedure
    .input(z.object({
      pattern: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      // 检查用户权限
      if (ctx.user?.role !== 'ADMIN') {
        throw new Error('权限不足：只有管理员可以清除缓存')
      }

      try {
        await sortingBehaviorAnalyticsService.clearAnalyticsCache(input.pattern)

        return {
          success: true,
          message: '排序分析缓存清除成功'
        }
      } catch (error) {
        console.error('清除排序分析缓存失败:', error)
        throw new Error('清除缓存失败')
      }
    })
})