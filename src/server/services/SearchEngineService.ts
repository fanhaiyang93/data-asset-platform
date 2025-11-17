import { Client } from '@elastic/elasticsearch'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/cache'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { type Asset } from '@prisma/client'

// Elasticsearch索引映射配置
const ASSET_INDEX_MAPPING = {
  mappings: {
    properties: {
      id: { type: 'keyword' },
      name: {
        type: 'text',
        analyzer: 'ik_max_word',
        search_analyzer: 'ik_smart',
        fields: {
          raw: { type: 'keyword' }
        }
      },
      description: {
        type: 'text',
        analyzer: 'ik_max_word',
        search_analyzer: 'ik_smart'
      },
      businessDescription: {
        type: 'text',
        analyzer: 'ik_max_word',
        search_analyzer: 'ik_smart'
      },
      code: { type: 'keyword' },
      type: { type: 'keyword' },
      categoryId: { type: 'keyword' },
      categoryName: { type: 'text', analyzer: 'ik_max_word' },
      status: { type: 'keyword' },
      tags: { type: 'keyword' },
      databaseName: { type: 'keyword' },
      schemaName: { type: 'keyword' },
      tableName: { type: 'keyword' },
      qualityScore: { type: 'float' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
      searchText: {
        type: 'text',
        analyzer: 'ik_max_word',
        search_analyzer: 'ik_smart'
      }
    }
  },
  settings: {
    analysis: {
      analyzer: {
        ik_max_word: {
          type: 'ik_max_word'
        },
        ik_smart: {
          type: 'ik_smart'
        }
      }
    }
  }
}

// 搜索结果界面
export interface SearchResult {
  id: string
  name: string
  description: string | null
  businessDescription: string | null
  code: string
  type: string | null
  categoryName?: string
  status: string
  tags: string | null
  databaseName: string | null
  schemaName: string | null
  tableName: string | null
  qualityScore: number | null
  highlights?: {
    name?: string[]
    description?: string[]
    businessDescription?: string[]
  }
  searchScore: number
}

// 搜索输入验证
export const SearchInputSchema = z.object({
  query: z.string().min(1, '搜索关键词不能为空'),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
  sort: z.enum(['relevance', 'name', 'createdAt', 'qualityScore']).default('relevance'),
  filters: z.object({
    status: z.array(z.string()).optional(),
    type: z.array(z.string()).optional(),
    categoryId: z.string().optional(),
    qualityScoreMin: z.number().min(0).max(10).optional(),
    qualityScoreMax: z.number().min(0).max(10).optional()
  }).optional()
})

export type SearchInput = z.infer<typeof SearchInputSchema>

// 搜索建议输入验证
export const SuggestInputSchema = z.object({
  query: z.string().min(1),
  size: z.number().min(1).max(10).default(5)
})

export type SuggestInput = z.infer<typeof SuggestInputSchema>

// 实时搜索输入验证
export const LiveSearchInputSchema = z.object({
  query: z.string().min(1),
  size: z.number().min(1).max(20).default(5)
})

export type LiveSearchInput = z.infer<typeof LiveSearchInputSchema>

// 精简搜索结果界面（用于实时搜索）
export interface LiveSearchResult {
  id: string
  name: string
  description: string | null
  type: string | null
  categoryName?: string
  status: string
  searchScore: number
}

export class SearchEngineService {
  private client: Client
  private indexName = 'data-assets'
  private cachePrefix = 'search:'
  // **搜索结果缓存策略 - 5分钟TTL**
  // 原因：搜索结果需要在数据更新速度和用户体验间平衡
  // - 5分钟：足够应对频繁查询，减轻Elasticsearch压力
  // - 不过长：确保用户能看到较新的数据变更
  // - 适用场景：主搜索结果、过滤搜索、分页结果
  private cacheTtl = 300

  constructor() {
    // 从环境变量获取Elasticsearch配置
    const esUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
    const esApiKey = process.env.ELASTICSEARCH_API_KEY
    const esUsername = process.env.ELASTICSEARCH_USERNAME
    const esPassword = process.env.ELASTICSEARCH_PASSWORD

    this.client = new Client({
      node: esUrl,
      auth: esApiKey ? { apiKey: esApiKey } :
            (esUsername && esPassword) ? { username: esUsername, password: esPassword } : undefined,
      maxRetries: 3,
      requestTimeout: 30000,
      sniffOnStart: false
    })
  }

  // 初始化索引
  async initializeIndex(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({ index: this.indexName })
      if (!exists) {
        await this.client.indices.create({
          index: this.indexName,
          body: ASSET_INDEX_MAPPING
        })
        console.log(`Elasticsearch索引 ${this.indexName} 创建成功`)
      }
    } catch (error) {
      console.error('初始化Elasticsearch索引失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '搜索引擎初始化失败'
      })
    }
  }

  // 搜索资产
  async search(input: SearchInput): Promise<{
    results: SearchResult[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    try {
      // 缓存键
      const cacheKey = `${this.cachePrefix}${JSON.stringify(input)}`

      // 尝试从缓存获取
      const cached = await redis.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }

      // 构建Elasticsearch查询
      const query = this.buildSearchQuery(input)
      const { page, pageSize } = input
      const from = (page - 1) * pageSize

      const response = await this.client.search({
        index: this.indexName,
        body: {
          query,
          highlight: {
            fields: {
              name: {},
              description: {},
              businessDescription: {}
            },
            pre_tags: ['<mark>'],
            post_tags: ['</mark>']
          },
          sort: this.buildSortQuery(input.sort),
          from,
          size: pageSize
        }
      })

      const results: SearchResult[] = response.body.hits.hits.map((hit: any) => ({
        id: hit._source.id,
        name: hit._source.name,
        description: hit._source.description,
        businessDescription: hit._source.businessDescription,
        code: hit._source.code,
        type: hit._source.type,
        categoryName: hit._source.categoryName,
        status: hit._source.status,
        tags: hit._source.tags,
        databaseName: hit._source.databaseName,
        schemaName: hit._source.schemaName,
        tableName: hit._source.tableName,
        qualityScore: hit._source.qualityScore,
        highlights: hit.highlight,
        searchScore: hit._score
      }))

      const total = response.body.hits.total.value
      const totalPages = Math.ceil(total / pageSize)

      const result = {
        results,
        total,
        page,
        pageSize,
        totalPages
      }

      // 缓存结果
      await redis.setex(cacheKey, this.cacheTtl, JSON.stringify(result))

      return result
    } catch (error) {
      // 统一错误处理：记录详细错误信息，包含上下文
      console.error('Elasticsearch搜索失败，降级到PostgreSQL搜索:', {
        error: error instanceof Error ? error.message : String(error),
        query: input.query,
        timestamp: new Date().toISOString()
      })
      // 降级到PostgreSQL搜索，确保服务可用性
      return this.fallbackSearch(input)
    }
  }

  // 构建搜索查询
  private buildSearchQuery(input: SearchInput) {
    const { query, filters } = input
    const mustQueries: any[] = []
    const filterQueries: any[] = []

    // 主搜索查询
    mustQueries.push({
      multi_match: {
        query,
        fields: [
          'name^3',
          'description^2',
          'businessDescription^2',
          'searchText'
        ],
        type: 'best_fields',
        fuzziness: 'AUTO',
        operator: 'or'
      }
    })

    // 应用过滤器
    if (filters) {
      if (filters.status && filters.status.length > 0) {
        filterQueries.push({ terms: { status: filters.status } })
      }
      if (filters.type && filters.type.length > 0) {
        filterQueries.push({ terms: { type: filters.type } })
      }
      if (filters.categoryId) {
        filterQueries.push({ term: { categoryId: filters.categoryId } })
      }
      if (filters.qualityScoreMin !== undefined || filters.qualityScoreMax !== undefined) {
        const range: any = {}
        if (filters.qualityScoreMin !== undefined) range.gte = filters.qualityScoreMin
        if (filters.qualityScoreMax !== undefined) range.lte = filters.qualityScoreMax
        filterQueries.push({ range: { qualityScore: range } })
      }
    }

    return {
      bool: {
        must: mustQueries,
        filter: filterQueries
      }
    }
  }

  // 构建排序查询
  private buildSortQuery(sort: string) {
    switch (sort) {
      case 'name':
        return [{ 'name.raw': { order: 'asc' } }]
      case 'createdAt':
        return [{ createdAt: { order: 'desc' } }]
      case 'qualityScore':
        return [{ qualityScore: { order: 'desc' } }]
      case 'relevance':
      default:
        return [{ _score: { order: 'desc' } }]
    }
  }

  // PostgreSQL降级搜索
  private async fallbackSearch(input: SearchInput): Promise<{
    results: SearchResult[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    console.log('使用PostgreSQL降级搜索')

    const { query, page, pageSize, filters } = input
    const skip = (page - 1) * pageSize

    // 构建WHERE条件
    const whereConditions: any = {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { businessDescription: { contains: query, mode: 'insensitive' } }
      ]
    }

    // 应用过滤器
    if (filters) {
      if (filters.status && filters.status.length > 0) {
        whereConditions.status = { in: filters.status }
      }
      if (filters.type && filters.type.length > 0) {
        whereConditions.type = { in: filters.type }
      }
      if (filters.categoryId) {
        whereConditions.categoryId = filters.categoryId
      }
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where: whereConditions,
        include: {
          category: {
            select: { name: true }
          }
        },
        skip,
        take: pageSize,
        orderBy: { name: 'asc' }
      }),
      prisma.asset.count({ where: whereConditions })
    ])

    const results: SearchResult[] = assets.map(asset => ({
      id: asset.id,
      name: asset.name,
      description: asset.description,
      businessDescription: asset.businessDescription,
      code: asset.code,
      type: asset.type,
      categoryName: asset.category?.name,
      status: asset.status,
      tags: asset.tags,
      databaseName: asset.databaseName,
      schemaName: asset.schemaName,
      tableName: asset.tableName,
      qualityScore: asset.qualityScore ? Number(asset.qualityScore) : null,
      searchScore: 1.0 // PostgreSQL降级搜索统一分数
    }))

    return {
      results,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  }

  // 实时搜索资产 - 优化性能版本
  async liveSearch(input: LiveSearchInput): Promise<LiveSearchResult[]> {
    try {
      // 实时搜索缓存键，TTL更短
      const cacheKey = `${this.cachePrefix}live:${JSON.stringify(input)}`

      // 尝试从缓存获取（短TTL）
      const cached = await redis.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }

      // 构建轻量级实时搜索查询
      const query = this.buildLiveSearchQuery(input.query)

      const response = await this.client.search({
        index: this.indexName,
        body: {
          query,
          _source: ['id', 'name', 'description', 'type', 'categoryName', 'status'], // 只返回必要字段
          size: input.size,
          timeout: '200ms' // 实时搜索超时限制
        }
      })

      const results: LiveSearchResult[] = response.body.hits.hits.map((hit: any) => ({
        id: hit._source.id,
        name: hit._source.name,
        description: hit._source.description,
        type: hit._source.type,
        categoryName: hit._source.categoryName,
        status: hit._source.status,
        searchScore: hit._score
      }))

      // **实时搜索缓存策略 - 30秒TTL**
      // 原因：实时搜索需要更频繁的数据更新，应用更短的缓存时间
      // - 30秒：足够减少连续敲击的重复查询，但保持实时性
      // - 短缓存：确保用户输入变化时能快速看到新结果
      // - 适用场景：搜索建议下拉框、实时预览结果
      await redis.setex(cacheKey, 30, JSON.stringify(results))

      return results
    } catch (error) {
      // 统一错误处理：记录详细错误信息，包含上下文
      console.error('Elasticsearch实时搜索失败，降级到PostgreSQL搜索:', {
        error: error instanceof Error ? error.message : String(error),
        query: input.query,
        timestamp: new Date().toISOString()
      })
      // 降级到PostgreSQL实时搜索，确保服务可用性
      return this.fallbackLiveSearch(input)
    }
  }

  // 构建实时搜索查询（简化版）
  private buildLiveSearchQuery(query: string) {
    return {
      bool: {
        must: [
          {
            multi_match: {
              query,
              fields: [
                'name^4',      // 名称权重最高
                'description^2',
                'searchText'
              ],
              type: 'best_fields',
              fuzziness: '1',  // 降低模糊度提升速度
              operator: 'or'
            }
          }
        ],
        filter: [
          { term: { status: 'active' } } // 只搜索活跃资产
        ]
      }
    }
  }

  // PostgreSQL降级实时搜索
  private async fallbackLiveSearch(input: LiveSearchInput): Promise<LiveSearchResult[]> {
    console.log('使用PostgreSQL降级实时搜索')

    const { query, size } = input

    const assets = await prisma.asset.findMany({
      where: {
        status: 'active',
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      },
      include: {
        category: {
          select: { name: true }
        }
      },
      take: size,
      orderBy: { name: 'asc' }
    })

    return assets.map(asset => ({
      id: asset.id,
      name: asset.name,
      description: asset.description,
      type: asset.type,
      categoryName: asset.category?.name,
      status: asset.status,
      searchScore: 1.0
    }))
  }

  // 搜索建议
  async suggest(input: SuggestInput): Promise<string[]> {
    try {
      const cacheKey = `${this.cachePrefix}suggest:${JSON.stringify(input)}`
      const cached = await redis.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }

      const response = await this.client.search({
        index: this.indexName,
        body: {
          suggest: {
            name_suggest: {
              prefix: input.query,
              completion: {
                field: 'name.raw',
                size: input.size
              }
            },
            description_suggest: {
              text: input.query,
              term: {
                field: 'description',
                size: input.size
              }
            }
          }
        }
      })

      const suggestions: string[] = []

      // 处理名称建议
      if (response.body.suggest.name_suggest?.[0]?.options) {
        response.body.suggest.name_suggest[0].options.forEach((option: any) => {
          suggestions.push(option.text)
        })
      }

      // 去重并限制数量
      const uniqueSuggestions = [...new Set(suggestions)].slice(0, input.size)

      // **搜索建议缓存策略 - 30分钟TTL**
      // 原因：搜索建议变化频率较低，可以使用较长的缓存时间
      // - 30分钟：资产名称、分类等元数据变化不频繁，长缓存提升性能
      // - 减少计算：避免重复执行复杂的建议算法（Levenshtein距离计算）
      // - 适用场景：自动补全建议、智能搜索提示
      await redis.setex(cacheKey, 1800, JSON.stringify(uniqueSuggestions))

      return uniqueSuggestions
    } catch (error) {
      // 统一错误处理：记录详细错误信息，静默失败返回空数组
      console.error('获取搜索建议失败，返回空建议列表:', {
        error: error instanceof Error ? error.message : String(error),
        query: input.query,
        timestamp: new Date().toISOString()
      })
      return [] // 搜索建议失败不影响核心搜索功能
    }
  }

  // 同步单个资产到搜索索引
  async updateIndex(assetId: string): Promise<void> {
    try {
      const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        include: {
          category: {
            select: { name: true }
          }
        }
      })

      if (!asset) {
        await this.client.delete({
          index: this.indexName,
          id: assetId
        })
        return
      }

      const document = this.assetToSearchDocument(asset)

      await this.client.index({
        index: this.indexName,
        id: assetId,
        body: document
      })
    } catch (error) {
      console.error(`同步资产 ${assetId} 到搜索索引失败:`, error)
    }
  }

  // 批量同步资产到搜索索引
  async bulkUpdateIndex(assetIds?: string[]): Promise<void> {
    try {
      const assets = await prisma.asset.findMany({
        where: assetIds ? { id: { in: assetIds } } : undefined,
        include: {
          category: {
            select: { name: true }
          }
        }
      })

      if (assets.length === 0) return

      const body = assets.flatMap(asset => [
        { index: { _index: this.indexName, _id: asset.id } },
        this.assetToSearchDocument(asset)
      ])

      await this.client.bulk({ body })

      console.log(`批量同步 ${assets.length} 个资产到搜索索引完成`)
    } catch (error) {
      console.error('批量同步搜索索引失败:', error)
    }
  }

  // 将资产转换为搜索文档
  private assetToSearchDocument(asset: Asset & { category?: { name: string } | null }) {
    const searchText = [
      asset.name,
      asset.description,
      asset.businessDescription,
      asset.databaseName,
      asset.schemaName,
      asset.tableName,
      asset.tags
    ].filter(Boolean).join(' ')

    return {
      id: asset.id,
      name: asset.name,
      description: asset.description,
      businessDescription: asset.businessDescription,
      code: asset.code,
      type: asset.type,
      categoryId: asset.categoryId,
      categoryName: asset.category?.name,
      status: asset.status,
      tags: asset.tags,
      databaseName: asset.databaseName,
      schemaName: asset.schemaName,
      tableName: asset.tableName,
      qualityScore: asset.qualityScore ? Number(asset.qualityScore) : null,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      searchText
    }
  }

  // 记录搜索行为
  async logSearchAction(query: string, action: string, sessionId: string): Promise<void> {
    try {
      // 这里可以将搜索行为记录到数据库或日志系统
      console.log(`搜索行为: ${action}, 查询: ${query}, 会话: ${sessionId}`)

      // 可以添加到数据库或发送到分析系统
      // await prisma.searchLog.create({
      //   data: { query, action, sessionId, timestamp: new Date() }
      // })
    } catch (error) {
      console.error('记录搜索行为失败:', error)
    }
  }

  // 健康检查
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.ping()
      return response.statusCode === 200
    } catch {
      return false
    }
  }

  // 更新单个资产到索引（增量更新专用）
  async updateAssetInIndex(asset: Asset & {
    category?: { name: string } | null,
    creator?: { name: string | null } | null,
    updater?: { name: string | null } | null
  }): Promise<void> {
    try {
      const document = this.assetToSearchDocument(asset)

      await this.client.index({
        index: this.indexName,
        id: asset.id,
        body: document,
        timeout: '30s'
      })

      console.log(`资产索引更新成功: ${asset.id}`)
    } catch (error) {
      console.error(`更新资产索引失败: ${asset.id}`, error)
      throw error
    }
  }

  // 从索引中删除资产（增量更新专用）
  async deleteAssetFromIndex(assetId: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.indexName,
        id: assetId,
        timeout: '30s'
      })

      console.log(`资产从索引中删除成功: ${assetId}`)
    } catch (error) {
      if (error.meta?.body?.result === 'not_found') {
        console.log(`资产在索引中不存在，跳过删除: ${assetId}`)
        return
      }
      console.error(`从索引中删除资产失败: ${assetId}`, error)
      throw error
    }
  }

  // 批量更新索引（增量更新专用，优化版本）
  async bulkUpdateIndexOptimized(assetIds: string[]): Promise<{
    successCount: number
    errorCount: number
    errors: Array<{ assetId: string, error: string }>
  }> {
    try {
      // 获取资产数据
      const assets = await prisma.asset.findMany({
        where: { id: { in: assetIds } },
        include: {
          category: {
            select: { name: true }
          },
          creator: {
            select: { name: true }
          },
          updater: {
            select: { name: true }
          }
        }
      })

      if (assets.length === 0) {
        return { successCount: 0, errorCount: 0, errors: [] }
      }

      // 构建批量操作
      const body = assets.flatMap(asset => [
        {
          index: {
            _index: this.indexName,
            _id: asset.id,
            timeout: '30s'
          }
        },
        this.assetToSearchDocument(asset)
      ])

      const response = await this.client.bulk({
        body,
        timeout: '60s',
        refresh: false // 不立即刷新，提高性能
      })

      // 处理响应
      let successCount = 0
      let errorCount = 0
      const errors: Array<{ assetId: string, error: string }> = []

      if (response.body.items) {
        response.body.items.forEach((item: any, index: number) => {
          const assetId = assets[index]?.id || 'unknown'

          if (item.index?.error) {
            errorCount++
            errors.push({
              assetId,
              error: item.index.error.reason || 'Unknown error'
            })
          } else {
            successCount++
          }
        })
      }

      console.log(`批量索引更新完成: 成功 ${successCount}, 失败 ${errorCount}`)

      return { successCount, errorCount, errors }
    } catch (error) {
      console.error('批量更新索引失败:', error)
      throw error
    }
  }

  // 检查索引中是否存在指定资产
  async assetExistsInIndex(assetId: string): Promise<boolean> {
    try {
      const response = await this.client.exists({
        index: this.indexName,
        id: assetId
      })
      return response.body
    } catch {
      return false
    }
  }

  // 获取索引统计信息
  async getIndexStats(): Promise<{
    indexExists: boolean
    documentCount: number
    indexSize: string
    health: string
  }> {
    try {
      const [exists, stats, health] = await Promise.all([
        this.client.indices.exists({ index: this.indexName }),
        this.client.indices.stats({ index: this.indexName }).catch(() => null),
        this.client.cluster.health({ index: this.indexName }).catch(() => null)
      ])

      return {
        indexExists: exists.body,
        documentCount: stats?.body?.indices?.[this.indexName]?.total?.docs?.count || 0,
        indexSize: stats?.body?.indices?.[this.indexName]?.total?.store?.size_in_bytes
          ? `${Math.round(stats.body.indices[this.indexName].total.store.size_in_bytes / 1024 / 1024)}MB`
          : '0MB',
        health: health?.body?.status || 'unknown'
      }
    } catch (error) {
      console.error('获取索引统计信息失败:', error)
      return {
        indexExists: false,
        documentCount: 0,
        indexSize: '0MB',
        health: 'unknown'
      }
    }
  }

  // 刷新索引（使更改立即可见）
  async refreshIndex(): Promise<void> {
    try {
      await this.client.indices.refresh({
        index: this.indexName,
        timeout: '30s'
      })
      console.log('索引刷新成功')
    } catch (error) {
      console.error('索引刷新失败:', error)
      throw error
    }
  }

  // 优化索引性能
  async optimizeIndex(): Promise<void> {
    try {
      await this.client.indices.forcemerge({
        index: this.indexName,
        max_num_segments: 1,
        timeout: '5m'
      })
      console.log('索引优化成功')
    } catch (error) {
      console.error('索引优化失败:', error)
      throw error
    }
  }
}

export const searchEngineService = new SearchEngineService()