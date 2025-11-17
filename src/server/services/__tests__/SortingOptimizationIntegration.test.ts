/**
 * Task 5集成测试：排序算法优化和用户体验
 *
 * 测试涵盖：
 * 1. 实时权重调优
 * 2. 排序质量评级指标
 * 3. 缓存和性能优化
 * 4. 用户反馈收集
 */

import { searchRankingService } from '../SearchRankingService'
import { sortingQualityService } from '../SortingQualityService'
import { sortingFeedbackService } from '../SortingFeedbackService'
import { sortingConfigService } from '../SortingConfigService'
import type { SearchResult, SortOption, ScoringWeights } from '@/types/search'

// Mock数据
const mockSearchResults: SearchResult[] = [
  {
    id: 'asset1',
    name: '用户行为分析表',
    description: '记录用户在平台上的各种行为数据',
    type: '表',
    categoryName: '用户数据',
    databaseName: 'user_db',
    searchScore: 8.5,
    qualityScore: 9.2,
    tags: ['用户', '行为', '分析']
  },
  {
    id: 'asset2',
    name: '订单交易记录',
    description: '电商平台的订单和交易数据',
    type: '表',
    categoryName: '交易数据',
    databaseName: 'order_db',
    searchScore: 7.8,
    qualityScore: 8.5,
    tags: ['订单', '交易', '电商']
  },
  {
    id: 'asset3',
    name: '产品信息视图',
    description: '产品基础信息和属性的视图',
    type: '视图',
    categoryName: '产品数据',
    databaseName: 'product_db',
    searchScore: 6.5,
    qualityScore: 7.8,
    tags: ['产品', '信息', '属性']
  }
]

describe('Task 5: 排序算法优化和用户体验集成测试', () => {
  const testUserId = 'test_user_123'
  const testQuery = '用户行为数据'
  const testSessionId = 'session_456'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('1. 实时权重调优测试', () => {
    test('应该基于用户反馈实时调优权重', async () => {
      const currentWeights: ScoringWeights = {
        relevance: 0.4,
        popularity: 0.3,
        recency: 0.2,
        personalization: 0.1
      }

      const feedbackData = {
        satisfaction: 0.6, // 低满意度
        clickPositions: [6, 8, 10], // 点击位置靠后
        querySuccessRate: 0.5
      }

      const optimizedWeights = await searchRankingService.optimizeWeightsRealTime(
        testQuery,
        testUserId,
        currentWeights,
        feedbackData
      )

      // 验证权重调优结果
      expect(optimizedWeights.personalization).toBeGreaterThan(currentWeights.personalization)
      expect(optimizedWeights.relevance).toBeGreaterThan(currentWeights.relevance)
      expect(searchRankingService.validateWeights(optimizedWeights)).toBe(true)
    })

    test('应该支持批量权重优化', async () => {
      const queries = [
        {
          query: '用户数据',
          userId: 'user1',
          currentWeights: { relevance: 0.4, popularity: 0.3, recency: 0.2, personalization: 0.1 },
          performanceData: { satisfaction: 0.8, clickPositions: [1, 2], querySuccessRate: 0.9 }
        },
        {
          query: '交易记录',
          userId: 'user2',
          currentWeights: { relevance: 0.5, popularity: 0.2, recency: 0.2, personalization: 0.1 },
          performanceData: { satisfaction: 0.5, clickPositions: [7, 8], querySuccessRate: 0.6 }
        }
      ]

      const results = await searchRankingService.batchOptimizeWeights(queries)

      expect(results.size).toBe(2)
      expect(results.has('用户数据:user1')).toBe(true)
      expect(results.has('交易记录:user2')).toBe(true)
    })
  })

  describe('2. 排序质量评估指标测试', () => {
    test('应该计算综合排序质量指标', async () => {
      const sortMethod: SortOption = 'personalized'
      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24小时前
        end: new Date()
      }

      const qualityMetrics = await sortingQualityService.calculateOverallQuality(
        sortMethod,
        timeRange
      )

      expect(qualityMetrics).toHaveProperty('relevanceAccuracy')
      expect(qualityMetrics).toHaveProperty('userSatisfaction')
      expect(qualityMetrics).toHaveProperty('clickThroughRate')
      expect(qualityMetrics).toHaveProperty('responseTime')
      expect(qualityMetrics.sortMethod).toBe(sortMethod)
      expect(qualityMetrics.relevanceAccuracy).toBeGreaterThanOrEqual(0)
      expect(qualityMetrics.relevanceAccuracy).toBeLessThanOrEqual(1)
    })

    test('应该生成排序质量报告', async () => {
      const sortMethods: SortOption[] = ['relevance', 'personalized', 'popularity']
      const timeRange = {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7天前
        end: new Date()
      }

      const report = await sortingQualityService.generateQualityReport(
        sortMethods,
        timeRange
      )

      expect(report).toHaveProperty('overall')
      expect(report).toHaveProperty('comparison')
      expect(report).toHaveProperty('recommendations')
      expect(report.overall).toHaveLength(3)
      expect(report.comparison.length).toBeGreaterThan(0)
      expect(Array.isArray(report.recommendations)).toBe(true)
    })

    test('应该支持实时质量监控', async () => {
      const alertThresholds = {
        minUserSatisfaction: 0.7,
        maxResponseTime: 300,
        minClickThroughRate: 0.25
      }

      const monitorResult = await sortingQualityService.monitorQualityRealtime(
        'personalized',
        alertThresholds
      )

      expect(monitorResult).toHaveProperty('alerts')
      expect(monitorResult).toHaveProperty('metrics')
      expect(Array.isArray(monitorResult.alerts)).toBe(true)
      expect(monitorResult.metrics).toHaveProperty('userSatisfaction')
    })
  })

  describe('3. 高级缓存和性能优化测试', () => {
    test('应该使用多层缓存优化排序性能', async () => {
      const results = mockSearchResults
      const sortOption: SortOption = 'relevance'

      // 第一次调用 - 应该计算并缓存
      const firstCall = await searchRankingService.optimizedRankSearchResults(
        results,
        testQuery,
        sortOption,
        testUserId
      )

      expect(firstCall).toBeDefined()
      expect(firstCall.length).toBe(results.length)

      // 第二次调用 - 应该命中缓存
      const secondCall = await searchRankingService.optimizedRankSearchResults(
        results,
        testQuery,
        sortOption,
        testUserId
      )

      expect(secondCall).toEqual(firstCall)
    })

    test('应该提供缓存性能指标', async () => {
      const metrics = await searchRankingService.getCachePerformanceMetrics()

      expect(metrics).toHaveProperty('hitRate')
      expect(metrics).toHaveProperty('avgResponseTime')
      expect(metrics).toHaveProperty('memoryUsage')
      expect(metrics).toHaveProperty('redisConnections')
      expect(metrics.hitRate).toBeGreaterThanOrEqual(0)
      expect(metrics.hitRate).toBeLessThanOrEqual(1)
    })

    test('应该基于查询相似度使用缓存', async () => {
      // 预先缓存一个查询
      await searchRankingService.optimizedRankSearchResults(
        mockSearchResults,
        '用户行为',
        'relevance',
        testUserId
      )

      // 使用相似查询，应该能复用缓存
      const similarResults = await searchRankingService.optimizedRankSearchResults(
        mockSearchResults,
        '用户行为数据', // 相似查询
        'relevance',
        testUserId
      )

      expect(similarResults).toBeDefined()
      expect(similarResults.length).toBe(mockSearchResults.length)
    })
  })

  describe('4. 用户反馈收集测试', () => {
    test('应该记录显式用户反馈', async () => {
      const feedback = {
        userId: testUserId,
        sessionId: testSessionId,
        query: testQuery,
        sortMethod: 'personalized' as SortOption,
        satisfaction: 4,
        relevanceRating: 4,
        easeOfUse: 5,
        comment: '排序结果很准确，找到了需要的数据',
        clickedResults: [
          {
            resultId: 'asset1',
            position: 1,
            dwellTime: 45000,
            timestamp: new Date()
          }
        ],
        queryTime: 1200,
        scrollDepth: 0.8,
        bounceRate: false,
        device: 'desktop',
        browser: 'chrome',
        resultCount: 3
      }

      const feedbackId = await sortingFeedbackService.recordFeedback(feedback)

      expect(feedbackId).toBeDefined()
      expect(feedbackId).toContain('feedback_')
    })

    test('应该记录隐式行为反馈', async () => {
      const behaviorData = {
        clickedResults: [
          {
            resultId: 'asset2',
            position: 2,
            dwellTime: 30000,
            timestamp: new Date()
          }
        ],
        queryTime: 800,
        scrollDepth: 0.6,
        bounceRate: false,
        device: 'mobile',
        browser: 'safari',
        resultCount: 3
      }

      await expect(
        sortingFeedbackService.recordImplicitFeedback(
          testUserId,
          testSessionId,
          testQuery,
          'relevance',
          behaviorData
        )
      ).resolves.not.toThrow()
    })

    test('应该分析反馈趋势', async () => {
      const trends = await sortingFeedbackService.getFeedbackTrends('personalized', 30)

      expect(trends).toHaveProperty('daily')
      expect(trends).toHaveProperty('weekly')
      expect(trends).toHaveProperty('overall')
      expect(Array.isArray(trends.daily)).toBe(true)
      expect(Array.isArray(trends.weekly)).toBe(true)
      expect(trends.overall).toHaveProperty('trend')
      expect(['improving', 'stable', 'declining']).toContain(trends.overall.trend)
    })

    test('应该比较不同排序方法的反馈', async () => {
      const sortMethods: SortOption[] = ['relevance', 'personalized', 'popularity']
      const timeRange = {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date()
      }

      const comparison = await sortingFeedbackService.compareSortMethodFeedback(
        sortMethods,
        timeRange
      )

      expect(comparison).toHaveProperty('comparison')
      expect(comparison).toHaveProperty('winner')
      expect(comparison).toHaveProperty('insights')
      expect(comparison).toHaveProperty('recommendations')
      expect(comparison.comparison).toHaveLength(3)
      expect(sortMethods).toContain(comparison.winner)
    })

    test('应该支持实时反馈监控和告警', async () => {
      const alertThresholds = {
        minSatisfaction: 0.7,
        maxBounceRate: 0.3,
        minFeedbackCount: 5
      }

      const monitoring = await sortingFeedbackService.monitorFeedbackRealtime(alertThresholds)

      expect(monitoring).toHaveProperty('alerts')
      expect(monitoring).toHaveProperty('summary')
      expect(Array.isArray(monitoring.alerts)).toBe(true)
      expect(monitoring.summary).toHaveProperty('totalFeedbacks')
      expect(monitoring.summary).toHaveProperty('avgSatisfaction')
      expect(monitoring.summary).toHaveProperty('criticalIssues')
    })
  })

  describe('5. A/B测试和配置优化集成测试', () => {
    test('应该创建和管理A/B测试', async () => {
      const abTestConfig = {
        name: '排序权重优化测试',
        description: '测试不同权重配置对用户满意度的影响',
        variants: [
          {
            name: 'control',
            traffic: 0.5,
            weights: { relevance: 0.4, popularity: 0.3, recency: 0.2, personalization: 0.1 }
          },
          {
            name: 'treatment',
            traffic: 0.5,
            weights: { relevance: 0.3, popularity: 0.2, recency: 0.2, personalization: 0.3 }
          }
        ]
      }

      const testId = await sortingConfigService.createABTest(abTestConfig)
      expect(testId).toBeDefined()
      expect(testId).toContain('test_')

      // 验证用户分配
      const userWeights = await sortingConfigService.assignABTestVariant(testId, testUserId)
      expect(userWeights).toBeDefined()
      expect(sortingConfigService['validateWeights'](userWeights!)).toBeTruthy()
    })

    test('应该基于配置推荐获取最佳排序策略', async () => {
      const recommendation = await sortingConfigService.getConfigRecommendation(
        '用户行为分析',
        {
          hasHistory: true,
          preferredCategories: ['用户数据', '行为数据'],
          queryFrequency: 15
        }
      )

      expect(recommendation).toHaveProperty('configName')
      expect(recommendation).toHaveProperty('weights')
      expect(recommendation).toHaveProperty('reason')
      expect(sortingConfigService['validateWeights'](recommendation.weights)).toBeTruthy()
    })
  })

  describe('6. 端到端集成测试', () => {
    test('完整的排序优化流程', async () => {
      const startTime = Date.now()

      // 1. 执行优化排序
      const sortedResults = await searchRankingService.optimizedRankSearchResults(
        mockSearchResults,
        testQuery,
        'personalized',
        testUserId
      )

      expect(sortedResults).toBeDefined()
      expect(sortedResults.length).toBe(mockSearchResults.length)

      // 2. 记录用户交互反馈
      await sortingFeedbackService.recordImplicitFeedback(
        testUserId,
        testSessionId,
        testQuery,
        'personalized',
        {
          clickedResults: [
            {
              resultId: sortedResults[0].id,
              position: 1,
              dwellTime: 35000,
              timestamp: new Date()
            }
          ],
          queryTime: Date.now() - startTime,
          scrollDepth: 0.7,
          bounceRate: false,
          device: 'desktop',
          browser: 'chrome',
          resultCount: sortedResults.length
        }
      )

      // 3. 基于反馈优化权重
      const currentWeights = searchRankingService.getDefaultWeights()
      const feedbackData = {
        satisfaction: 0.85,
        clickPositions: [1],
        querySuccessRate: 1.0
      }

      const optimizedWeights = await searchRankingService.optimizeWeightsRealTime(
        testQuery,
        testUserId,
        currentWeights,
        feedbackData
      )

      expect(optimizedWeights).toBeDefined()
      expect(searchRankingService.validateWeights(optimizedWeights)).toBe(true)

      // 4. 获取质量指标
      const timeRange = {
        start: new Date(startTime),
        end: new Date()
      }

      const qualityMetrics = await sortingQualityService.calculateOverallQuality(
        'personalized',
        timeRange
      )

      expect(qualityMetrics).toBeDefined()
      expect(qualityMetrics.sortMethod).toBe('personalized')

      // 5. 验证缓存性能
      const cacheMetrics = await searchRankingService.getCachePerformanceMetrics()
      expect(cacheMetrics.memoryUsage).toBeGreaterThan(0)
    }, 10000) // 10秒超时，因为这是一个复杂的集成测试
  })

  describe('7. 性能和边界条件测试', () => {
    test('应该在高负载下保持性能', async () => {
      const promises = []
      const queryCount = 50

      // 并发执行多个排序请求
      for (let i = 0; i < queryCount; i++) {
        promises.push(
          searchRankingService.optimizedRankSearchResults(
            mockSearchResults,
            `测试查询${i}`,
            'relevance',
            `user_${i}`
          )
        )
      }

      const startTime = Date.now()
      const results = await Promise.all(promises)
      const endTime = Date.now()

      expect(results).toHaveLength(queryCount)
      expect(endTime - startTime).toBeLessThan(5000) // 5秒内完成
    })

    test('应该处理空结果和错误情况', async () => {
      // 空结果测试
      const emptyResults = await searchRankingService.optimizedRankSearchResults(
        [],
        testQuery,
        'relevance',
        testUserId
      )
      expect(emptyResults).toEqual([])

      // 异常权重测试
      const invalidWeights: ScoringWeights = {
        relevance: 0.8,
        popularity: 0.3,
        recency: 0.2,
        personalization: 0.1
      } // 总和不为1

      expect(searchRankingService.validateWeights(invalidWeights)).toBe(false)
    })

    test('应该优雅处理缓存失败', async () => {
      // 模拟Redis连接失败的情况
      const originalRedisGet = require('@/lib/cache').redis.get
      require('@/lib/cache').redis.get = jest.fn().mockRejectedValue(new Error('Redis连接失败'))

      // 应该仍然能够返回排序结果，只是不使用缓存
      const results = await searchRankingService.optimizedRankSearchResults(
        mockSearchResults,
        testQuery,
        'relevance',
        testUserId
      )

      expect(results).toBeDefined()
      expect(results.length).toBe(mockSearchResults.length)

      // 恢复原始函数
      require('@/lib/cache').redis.get = originalRedisGet
    })
  })
})

/**
 * 测试辅助函数
 */
describe('测试辅助工具', () => {
  test('模拟数据应该符合预期格式', () => {
    mockSearchResults.forEach(result => {
      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('name')
      expect(result).toHaveProperty('description')
      expect(result).toHaveProperty('type')
      expect(result.searchScore).toBeGreaterThan(0)
    })
  })

  test('权重验证函数应该正确工作', () => {
    const validWeights: ScoringWeights = {
      relevance: 0.4,
      popularity: 0.3,
      recency: 0.2,
      personalization: 0.1
    }

    const invalidWeights: ScoringWeights = {
      relevance: 0.5,
      popularity: 0.3,
      recency: 0.3,
      personalization: 0.1
    }

    expect(searchRankingService.validateWeights(validWeights)).toBe(true)
    expect(searchRankingService.validateWeights(invalidWeights)).toBe(false)
  })
})