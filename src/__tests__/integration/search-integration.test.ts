import { describe, it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals'

// Mock external dependencies
jest.mock('@/lib/cache', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
  }
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    asset: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
    },
    userSearchPreference: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    searchLog: {
      create: jest.fn(),
    },
  }
}))

jest.mock('@elastic/elasticsearch', () => ({
  Client: jest.fn(() => ({
    indices: {
      exists: jest.fn(),
      create: jest.fn(),
      stats: jest.fn(),
    },
    search: jest.fn(),
    index: jest.fn(),
    delete: jest.fn(),
    bulk: jest.fn(),
    ping: jest.fn(),
    cluster: {
      health: jest.fn(),
    },
  }))
}))

// Import after mocking
import { searchEngineService } from '@/server/services/SearchEngineService'
import { searchIndexUpdateService } from '@/server/services/SearchIndexUpdateService'
import { searchPerformanceService } from '@/server/services/SearchPerformanceService'
import { searchSuggestionService } from '@/server/services/SearchSuggestionService'
import { searchHistoryService } from '@/server/services/SearchHistoryService'
import { redis } from '@/lib/cache'
import { prisma } from '@/lib/prisma'

const mockRedis = redis as jest.Mocked<typeof redis>
const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('Search Integration Tests', () => {
  beforeAll(async () => {
    // 设置测试环境
    process.env.NODE_ENV = 'test'
  })

  afterAll(async () => {
    // 清理测试环境
    jest.resetAllMocks()
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // 设置默认Mock返回值
    mockPrisma.asset.groupBy.mockResolvedValue([])
    mockPrisma.category.findMany.mockResolvedValue([])
  })

  afterEach(async () => {
    jest.resetAllMocks()

    // 清理定时器避免内存泄漏
    jest.clearAllTimers()

    // 停止后台处理
    if (searchIndexUpdateService) {
      const service = searchIndexUpdateService as any
      if (service.periodicInterval) {
        clearInterval(service.periodicInterval)
        service.periodicInterval = null
      }
    }

    if (searchPerformanceService) {
      const service = searchPerformanceService as any
      if (service.flushInterval) {
        clearInterval(service.flushInterval)
        service.flushInterval = null
      }
    }
  })

  describe('端到端搜索流程', () => {
    it('应该完成完整的搜索流程：创建资产 -> 索引更新 -> 搜索 -> 性能监控', async () => {
      // Step 1: 模拟创建新资产
      const mockAsset = {
        id: 'test-asset-1',
        name: 'Test Data Asset',
        description: 'This is a test data asset',
        code: 'TDA001',
        status: 'AVAILABLE',
        type: 'table',
        categoryId: 'cat-1',
        category: { name: 'Test Category' },
        creator: { name: 'Test User' },
        updater: { name: 'Test User' }
      }

      // Mock Prisma queries
      mockPrisma.asset.findUnique.mockResolvedValue(mockAsset as any)
      mockPrisma.asset.findMany.mockResolvedValue([mockAsset] as any)
      mockPrisma.asset.count.mockResolvedValue(1)

      // Mock Redis operations
      mockRedis.get.mockResolvedValue(null)
      mockRedis.setex.mockResolvedValue('OK')
      mockRedis.set.mockResolvedValue('OK')
      mockRedis.del.mockResolvedValue(1)
      mockRedis.keys.mockResolvedValue(['search:*'])

      // Mock Elasticsearch operations
      const mockSearchEngineClient = (searchEngineService as any).client
      mockSearchEngineClient.index = jest.fn().mockResolvedValue({ body: { result: 'created' } })
      mockSearchEngineClient.search = jest.fn().mockResolvedValue({
        body: {
          hits: {
            total: { value: 1 },
            hits: [
              {
                _id: 'test-asset-1',
                _source: mockAsset,
                _score: 1.5
              }
            ]
          }
        }
      })
      mockSearchEngineClient.ping = jest.fn().mockResolvedValue({ statusCode: 200 })

      // Step 2: 调度索引更新
      await searchIndexUpdateService.scheduleAssetCreate('test-asset-1', 8)

      // 给一些时间让异步处理完成
      await new Promise(resolve => setTimeout(resolve, 100))

      // Step 3: 手动确保队列处理完成（如果还有未处理任务）
      const processQueueMethod = (searchIndexUpdateService as any).processQueue.bind(searchIndexUpdateService)
      await processQueueMethod()

      // 验证资产被添加到索引
      expect(mockSearchEngineClient.index).toHaveBeenCalledWith({
        index: 'data-assets',
        id: 'test-asset-1',
        body: expect.objectContaining({
          id: 'test-asset-1',
          name: 'Test Data Asset'
        }),
        timeout: '30s'
      })

      // Step 4: 执行搜索并监控性能
      const searchInput = {
        query: 'Test Data',
        page: 1,
        pageSize: 20,
        sort: 'relevance' as const
      }

      // 开始性能跟踪
      const requestId = searchPerformanceService.startTracking('search', { query: searchInput.query })

      // 执行搜索
      const searchResult = await searchEngineService.search(searchInput)

      // 结束性能跟踪
      await searchPerformanceService.endTracking(requestId, true, undefined, {
        query: searchInput.query,
        resultCount: searchResult.total,
        cacheHit: false,
        fallbackUsed: false
      })

      // 验证搜索结果
      expect(searchResult).toEqual({
        results: expect.arrayContaining([
          expect.objectContaining({
            id: 'test-asset-1',
            name: 'Test Data Asset',
            searchScore: 1.5
          })
        ]),
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1
      })

      // 验证性能指标被记录
      const realTimeStats = await searchPerformanceService.getRealTimeStats()
      expect(realTimeStats.currentActiveRequests).toBe(0)

      // Step 5: 验证搜索建议功能
      const suggestionResult = await searchSuggestionService.getIntelligentSuggestions({
        query: 'Test',
        size: 5
      })

      expect(Array.isArray(suggestionResult)).toBe(true)
    })

    it('应该处理索引更新失败和重试机制', async () => {
      const assetId = 'failing-asset'

      mockRedis.get.mockResolvedValue(null)
      mockRedis.setex.mockResolvedValue('OK')

      // Mock失败的索引更新
      const mockSearchEngineClient = (searchEngineService as any).client
      mockSearchEngineClient.index = jest.fn()
        .mockRejectedValueOnce(new Error('Elasticsearch connection failed'))
        .mockResolvedValueOnce({ body: { result: 'updated' } })

      mockPrisma.asset.findUnique.mockResolvedValue({
        id: assetId,
        name: 'Failing Asset',
        category: { name: 'Test Category' }
      } as any)

      // 安排更新任务
      await searchIndexUpdateService.scheduleAssetUpdate(assetId)

      // 第一次处理应该失败
      const processQueueMethod = (searchIndexUpdateService as any).processQueue.bind(searchIndexUpdateService)
      await processQueueMethod()

      // 等待重试延迟时间（2秒）并加上缓冲
      await new Promise(resolve => setTimeout(resolve, 2100))

      // 第二次处理队列（重试任务）
      await processQueueMethod()

      // 验证最终成功：第一次失败，第二次成功
      expect(mockSearchEngineClient.index).toHaveBeenCalledTimes(2)
    })

    it('应该处理Elasticsearch降级到数据库搜索', async () => {
      const searchInput = {
        query: 'Test Query',
        page: 1,
        pageSize: 20,
        sort: 'relevance' as const
      }

      // Mock Elasticsearch失败
      const mockSearchEngineClient = (searchEngineService as any).client
      mockSearchEngineClient.search = jest.fn().mockRejectedValue(
        new Error('Elasticsearch connection failed')
      )

      // Mock数据库搜索降级
      mockPrisma.asset.findMany.mockResolvedValue([
        {
          id: 'db-asset-1',
          name: 'Database Asset',
          description: 'Found via database search',
          code: 'DBA001',
          status: 'AVAILABLE',
          category: { name: 'Database Category' }
        }
      ] as any)

      mockPrisma.asset.count.mockResolvedValue(1)

      mockRedis.get.mockResolvedValue(null)
      mockRedis.setex.mockResolvedValue('OK')

      // 执行搜索
      const searchResult = await searchEngineService.search(searchInput)

      // 验证降级到数据库搜索成功
      expect(searchResult.results).toHaveLength(1)
      expect(searchResult.results[0].name).toBe('Database Asset')
      expect(mockPrisma.asset.findMany).toHaveBeenCalled()
      expect(mockPrisma.asset.count).toHaveBeenCalled()
    })
  })

  describe('搜索历史和用户偏好集成', () => {
    it('应该保存和检索用户搜索历史', async () => {
      const userId = 'test-user-1'
      const searchQuery = 'user search query'

      // Mock用户偏好查询
      mockPrisma.userSearchPreference.findUnique.mockResolvedValue({
        userId,
        searchHistory: [],
        saveHistory: true
      } as any)

      mockPrisma.userSearchPreference.upsert.mockResolvedValue({
        userId,
        searchHistory: [
          {
            query: searchQuery,
            timestamp: new Date(),
            resultCount: 5
          }
        ]
      } as any)

      mockPrisma.searchLog.create.mockResolvedValue({
        id: 'log-1',
        userId,
        query: searchQuery
      } as any)

      // 保存搜索历史
      await searchHistoryService.saveSearchHistory({
        userId,
        query: searchQuery,
        resultCount: 5,
        searchType: 'full',
        sessionId: 'session-123'
      })

      // 验证搜索历史被保存
      expect(mockPrisma.userSearchPreference.upsert).toHaveBeenCalledWith({
        where: { userId },
        update: expect.objectContaining({
          lastSearchQuery: searchQuery
        }),
        create: expect.objectContaining({
          userId,
          lastSearchQuery: searchQuery
        })
      })

      // 验证详细日志被记录
      expect(mockPrisma.searchLog.create).toHaveBeenCalled()

      // 获取搜索历史
      mockPrisma.userSearchPreference.findUnique.mockResolvedValue({
        userId,
        searchHistory: [
          {
            query: searchQuery,
            timestamp: new Date(),
            resultCount: 5
          }
        ]
      } as any)

      const history = await searchHistoryService.getSearchHistory({
        userId,
        limit: 10
      })

      expect(history).toHaveLength(1)
      expect(history[0].query).toBe(searchQuery)
    })

    it('应该尊重用户的搜索偏好设置', async () => {
      const userId = 'test-user-2'

      // Mock用户禁用搜索历史保存
      mockPrisma.userSearchPreference.findUnique.mockResolvedValue({
        userId,
        saveHistory: false
      } as any)

      // 尝试保存搜索历史
      await searchHistoryService.saveSearchHistory({
        userId,
        query: 'test query',
        resultCount: 0,
        searchType: 'full',
        sessionId: 'session-456'
      })

      // 验证搜索历史没有被保存（因为用户禁用了）
      expect(mockPrisma.userSearchPreference.upsert).not.toHaveBeenCalled()
    })
  })

  describe('批量操作和性能', () => {
    it('应该有效处理大批量索引更新', async () => {
      const assetIds = Array.from({ length: 100 }, (_, i) => `asset-${i}`)

      // Mock大量资产
      const mockAssets = assetIds.map((id, index) => ({
        id,
        name: `Asset ${index}`,
        description: `Description ${index}`,
        category: { name: 'Test Category' },
        creator: { name: 'Test User' },
        updater: { name: 'Test User' }
      }))

      mockPrisma.asset.findMany.mockResolvedValue(mockAssets as any)

      // Mock Elasticsearch批量操作
      const mockSearchEngineClient = (searchEngineService as any).client
      mockSearchEngineClient.bulk = jest.fn().mockResolvedValue({
        body: {
          items: mockAssets.map(asset => ({
            index: { _id: asset.id, result: 'updated' }
          }))
        }
      })

      mockRedis.get.mockResolvedValue(null)
      mockRedis.setex.mockResolvedValue('OK')

      // 执行批量更新
      const result = await searchEngineService.bulkUpdateIndexOptimized(assetIds)

      // 验证批量操作成功
      expect(result.successCount).toBe(100)
      expect(result.errorCount).toBe(0)
      expect(result.errors).toHaveLength(0)

      // 验证批量API被调用
      expect(mockSearchEngineClient.bulk).toHaveBeenCalledTimes(1)
      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith({
        where: { id: { in: assetIds } },
        include: {
          category: { select: { name: true } },
          creator: { select: { name: true } },
          updater: { select: { name: true } }
        }
      })
    })

    it('应该监控和报告批量操作性能', async () => {
      const batchSize = 50

      // 模拟多个批量操作
      for (let i = 0; i < 5; i++) {
        const operation = `batch-${i}`
        const requestId = searchPerformanceService.startTracking(operation)

        // 模拟处理时间
        await new Promise(resolve => setTimeout(resolve, 10))

        await searchPerformanceService.endTracking(requestId, true, undefined, {
          batchSize,
          operation
        })
      }

      // 获取性能统计
      const stats = await searchPerformanceService.getRealTimeStats()
      expect(stats.currentActiveRequests).toBe(0)

      // 获取性能报告
      const report = await searchPerformanceService.getPerformanceReport(1)
      expect(report).toHaveProperty('summary')
      expect(report).toHaveProperty('trends')
    })
  })

  describe('缓存集成', () => {
    it('应该正确使用和管理缓存', async () => {
      const searchInput = {
        query: 'cached query',
        page: 1,
        pageSize: 20,
        sort: 'relevance' as const
      }

      const cachedResult = {
        results: [
          {
            id: 'cached-asset',
            name: 'Cached Asset',
            searchScore: 1.0
          }
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1
      }

      // 第一次搜索 - 缓存未命中
      mockRedis.get.mockResolvedValueOnce(null)
      mockRedis.setex.mockResolvedValue('OK')

      const mockSearchEngineClient = (searchEngineService as any).client
      mockSearchEngineClient.search = jest.fn().mockResolvedValue({
        body: {
          hits: {
            total: { value: 1 },
            hits: [
              {
                _id: 'cached-asset',
                _source: { id: 'cached-asset', name: 'Cached Asset' },
                _score: 1.0
              }
            ]
          }
        }
      })

      const firstResult = await searchEngineService.search(searchInput)
      expect(mockSearchEngineClient.search).toHaveBeenCalledTimes(1)
      expect(mockRedis.setex).toHaveBeenCalled()

      // 第二次搜索 - 缓存命中
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedResult))

      const secondResult = await searchEngineService.search(searchInput)
      expect(secondResult).toEqual(cachedResult)
      // Elasticsearch不应该被再次调用
      expect(mockSearchEngineClient.search).toHaveBeenCalledTimes(1)
    })

    it('应该在资产更新时清除相关缓存', async () => {
      const assetId = 'cache-test-asset'

      mockRedis.keys.mockResolvedValue(['search:key1', 'search:key2', 'suggestion:key1'])
      mockRedis.del.mockResolvedValue(3)

      // Mock searchSuggestionService.clearSuggestionCache
      const clearSuggestionCacheSpy = jest.spyOn(searchSuggestionService, 'clearSuggestionCache')
        .mockResolvedValue(undefined)

      mockPrisma.asset.findUnique.mockResolvedValue({
        id: assetId,
        name: 'Test Asset'
      } as any)

      const mockSearchEngineClient = (searchEngineService as any).client
      mockSearchEngineClient.index = jest.fn().mockResolvedValue({ body: { result: 'updated' } })

      // 调用私有方法clearRelatedCaches
      const clearRelatedCachesMethod = (searchIndexUpdateService as any).clearRelatedCaches.bind(searchIndexUpdateService)
      await clearRelatedCachesMethod(assetId)

      // 验证缓存被清除
      expect(clearSuggestionCacheSpy).toHaveBeenCalled()
      expect(mockRedis.keys).toHaveBeenCalledWith('search:*')
      expect(mockRedis.del).toHaveBeenCalled()

      clearSuggestionCacheSpy.mockRestore()
    })
  })

  describe('错误处理和恢复', () => {
    it('应该在多个组件故障时保持服务可用性', async () => {
      // 模拟Redis故障
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'))
      mockRedis.setex.mockRejectedValue(new Error('Redis connection failed'))

      // 模拟Elasticsearch故障
      const mockSearchEngineClient = (searchEngineService as any).client
      mockSearchEngineClient.search = jest.fn().mockRejectedValue(
        new Error('Elasticsearch connection failed')
      )

      // 模拟数据库可用
      mockPrisma.asset.findMany.mockResolvedValue([
        {
          id: 'fallback-asset',
          name: 'Fallback Asset',
          description: 'Found via database fallback',
          category: { name: 'Test Category' }
        }
      ] as any)

      mockPrisma.asset.count.mockResolvedValue(1)

      const searchInput = {
        query: 'resilience test',
        page: 1,
        pageSize: 20,
        sort: 'relevance' as const
      }

      // 搜索应该仍然工作（通过数据库降级）
      const result = await searchEngineService.search(searchInput)

      expect(result.results).toHaveLength(1)
      expect(result.results[0].name).toBe('Fallback Asset')

      // 性能监控应该处理Redis故障
      const requestId = searchPerformanceService.startTracking('test')
      await searchPerformanceService.endTracking(requestId, true)

      // 应该不抛出错误
      const stats = await searchPerformanceService.getRealTimeStats()
      expect(stats.healthScore).toBeLessThan(100) // 降级状态
    })
  })
})