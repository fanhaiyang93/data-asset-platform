import { searchEngineService, SearchEngineService } from '../SearchEngineService'

// Mock Elasticsearch client
jest.mock('@elastic/elasticsearch', () => {
  const mockElasticsearchClient = {
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
  }

  return {
    Client: jest.fn(() => mockElasticsearchClient),
  }
})

// Mock Redis
jest.mock('@/lib/cache', () => ({
  redis: {
    get: jest.fn(),
    setex: jest.fn(),
  },
}))

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    asset: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}))

// Import the mocked instances after mocking
import { Client } from '@elastic/elasticsearch'
import { redis } from '@/lib/cache'
import { prisma } from '@/lib/prisma'

// Get mock instances
const mockRedis = redis as jest.Mocked<typeof redis>
const mockPrisma = prisma as jest.Mocked<typeof prisma>

// Get the mock Elasticsearch client from service instance
const getMockElasticsearchClient = () => (searchEngineService as any).client

describe('SearchEngineService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('initializeIndex', () => {
    it('应该创建新的索引当索引不存在时', async () => {
      getMockElasticsearchClient().indices.exists.mockResolvedValue(false)
      getMockElasticsearchClient().indices.create.mockResolvedValue({ statusCode: 200 })

      await searchEngineService.initializeIndex()

      expect(getMockElasticsearchClient().indices.exists).toHaveBeenCalledWith({ index: 'data-assets' })
      expect(getMockElasticsearchClient().indices.create).toHaveBeenCalledWith({
        index: 'data-assets',
        body: expect.objectContaining({
          mappings: expect.any(Object),
          settings: expect.any(Object),
        }),
      })
    })

    it('应该跳过创建当索引已存在时', async () => {
      getMockElasticsearchClient().indices.exists.mockResolvedValue(true)

      await searchEngineService.initializeIndex()

      expect(getMockElasticsearchClient().indices.exists).toHaveBeenCalledWith({ index: 'data-assets' })
      expect(getMockElasticsearchClient().indices.create).not.toHaveBeenCalled()
    })
  })

  describe('search', () => {
    const mockSearchInput = {
      query: '测试查询',
      page: 1,
      pageSize: 20,
      sort: 'relevance' as const,
    }

    it('应该返回缓存的搜索结果', async () => {
      const cachedResult = {
        results: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      }
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult))

      const result = await searchEngineService.search(mockSearchInput)

      expect(result).toEqual(cachedResult)
      expect(getMockElasticsearchClient().search).not.toHaveBeenCalled()
    })

    it('应该执行Elasticsearch搜索当缓存未命中时', async () => {
      mockRedis.get.mockResolvedValue(null)
      getMockElasticsearchClient().search.mockResolvedValue({
        body: {
          hits: {
            hits: [
              {
                _source: {
                  id: 'test-id',
                  name: '测试资产',
                  description: '测试描述',
                  businessDescription: '业务描述',
                  code: 'TEST_CODE',
                  type: 'table',
                  categoryName: '测试分类',
                  status: 'active',
                  tags: 'tag1,tag2',
                  databaseName: 'test_db',
                  schemaName: 'test_schema',
                  tableName: 'test_table',
                  qualityScore: 8.5,
                },
                _score: 1.0,
                highlight: {
                  name: ['<mark>测试</mark>资产'],
                },
              },
            ],
            total: {
              value: 1,
            },
          },
        },
      })
      mockRedis.setex.mockResolvedValue('OK')

      const result = await searchEngineService.search(mockSearchInput)

      expect(result).toEqual({
        results: [
          expect.objectContaining({
            id: 'test-id',
            name: '测试资产',
            searchScore: 1.0,
            highlights: {
              name: ['<mark>测试</mark>资产'],
            },
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      })

      expect(getMockElasticsearchClient().search).toHaveBeenCalledWith({
        index: 'data-assets',
        body: expect.objectContaining({
          query: expect.any(Object),
          highlight: expect.any(Object),
          sort: expect.any(Array),
          from: 0,
          size: 20,
        }),
      })
    })

    it('应该使用PostgreSQL降级搜索当Elasticsearch失败时', async () => {
      mockRedis.get.mockResolvedValue(null)
      getMockElasticsearchClient().search.mockRejectedValue(new Error('ES connection failed'))

      const mockAssets = [
        {
          id: 'test-id',
          name: '测试资产',
          description: '测试描述',
          businessDescription: '业务描述',
          code: 'TEST_CODE',
          type: 'table',
          status: 'active',
          tags: 'tag1,tag2',
          databaseName: 'test_db',
          schemaName: 'test_schema',
          tableName: 'test_table',
          qualityScore: 8.5,
          category: { name: '测试分类' },
        },
      ]

      mockPrisma.asset.findMany.mockResolvedValue(mockAssets)
      mockPrisma.asset.count.mockResolvedValue(1)

      const result = await searchEngineService.search(mockSearchInput)

      expect(result.results).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.results[0]).toEqual(
        expect.objectContaining({
          id: 'test-id',
          name: '测试资产',
          searchScore: 1.0,
        })
      )
    })
  })

  describe('suggest', () => {
    it('应该返回缓存的搜索建议', async () => {
      const cachedSuggestions = ['建议1', '建议2']
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedSuggestions))

      const result = await searchEngineService.suggest({ query: '测试', size: 5 })

      expect(result).toEqual(cachedSuggestions)
      expect(getMockElasticsearchClient().search).not.toHaveBeenCalled()
    })

    it('应该从Elasticsearch获取新的搜索建议', async () => {
      mockRedis.get.mockResolvedValue(null)
      getMockElasticsearchClient().search.mockResolvedValue({
        body: {
          suggest: {
            name_suggest: [
              {
                options: [
                  { text: '建议1' },
                  { text: '建议2' },
                ],
              },
            ],
          },
        },
      })
      mockRedis.setex.mockResolvedValue('OK')

      const result = await searchEngineService.suggest({ query: '测试', size: 5 })

      expect(result).toEqual(['建议1', '建议2'])
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('suggest:'),
        1800,
        JSON.stringify(['建议1', '建议2'])
      )
    })
  })

  describe('healthCheck', () => {
    it('应该返回true当Elasticsearch可用时', async () => {
      getMockElasticsearchClient().ping.mockResolvedValue({ statusCode: 200 })

      const result = await searchEngineService.healthCheck()

      expect(result).toBe(true)
    })

    it('应该返回false当Elasticsearch不可用时', async () => {
      getMockElasticsearchClient().ping.mockRejectedValue(new Error('Connection failed'))

      const result = await searchEngineService.healthCheck()

      expect(result).toBe(false)
    })
  })
})