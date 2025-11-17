import { Client } from '@elastic/elasticsearch'
import { redis } from '@/lib/cache'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { searchEngineService } from './SearchEngineService'

// 筛选器选项数据模型
export interface FilterOptions {
  categories: Array<{
    id: string
    name: string
    count: number
  }>
  statuses: Array<{
    value: string
    label: string
    count: number
  }>
  types: Array<{
    value: string
    label: string
    count: number
  }>
  owners: Array<{
    id: string
    name: string
    count: number
  }>
  tags: Array<{
    value: string
    count: number
  }>
  qualityScoreRanges: Array<{
    min: number
    max: number
    label: string
    count: number
  }>
  dateRanges: Array<{
    range: string
    from?: string
    to?: string
    label: string
    count: number
  }>
}

// 筛选器聚合结果数据模型
export interface FilterAggregations {
  categories: Record<string, number>
  statuses: Record<string, number>
  types: Record<string, number>
  owners: Record<string, number>
  tags: Record<string, number>
  qualityScoreDistribution: Array<{
    range: string
    count: number
  }>
  updateTimeDistribution: Array<{
    period: string
    count: number
  }>
  totalResults: number
}

// 高级筛选条件
export interface AdvancedFilters {
  categories?: string[]
  statuses?: string[]
  types?: string[]
  owners?: string[]
  tags?: string[]
  qualityScoreMin?: number
  qualityScoreMax?: number
  updatedAfter?: string
  updatedBefore?: string
  createdAfter?: string
  createdBefore?: string
  logicOperator?: 'AND' | 'OR'
}

// 筛选器输入验证
export const FilterOptionsInputSchema = z.object({
  query: z.string().optional(),
  includeEmptyOptions: z.boolean().default(false)
})

export const FilterAggregationsInputSchema = z.object({
  query: z.string().min(1),
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
  }).optional()
})

export const AdvancedSearchInputSchema = z.object({
  query: z.string().min(1),
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
  }).optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
  sort: z.enum(['relevance', 'name', 'createdAt', 'updatedAt', 'qualityScore']).default('relevance')
})

export type FilterOptionsInput = z.infer<typeof FilterOptionsInputSchema>
export type FilterAggregationsInput = z.infer<typeof FilterAggregationsInputSchema>
export type AdvancedSearchInput = z.infer<typeof AdvancedSearchInputSchema>

export class SearchFilterService {
  private client: Client
  private indexName = 'data-assets'
  private cachePrefix = 'search-filter:'
  private redisClient = redis

  // **筛选选项缓存策略 - 30分钟TTL**
  // 原因：筛选选项变化频率较低，可以使用较长的缓存时间
  // - 30分钟：资产分类、状态等元数据变化不频繁
  // - 减少聚合查询：避免重复执行Elasticsearch聚合查询
  // - 适用场景：筛选器选项加载、筛选统计显示
  private filterOptionsCacheTtl = 1800

  // **聚合结果缓存策略 - 5分钟TTL**
  // 原因：聚合结果需要在数据更新速度和用户体验间平衡
  // - 5分钟：保证筛选统计的实时性，同时减少计算开销
  // - 性能优化：复杂聚合查询计算成本较高
  // - 适用场景：筛选条件变化时的统计更新
  private aggregationsCacheTtl = 300

  constructor() {
    // 复用SearchEngineService的Elasticsearch客户端配置
    this.client = (searchEngineService as any).client
  }

  /**
   * 获取筛选器选项
   * 返回所有可用的筛选维度及其统计信息
   */
  async getFilterOptions(input: FilterOptionsInput): Promise<FilterOptions> {
    const startTime = Date.now()

    try {
      // 缓存键
      const cacheKey = this.generateCacheKey('options', input)

      // 尝试从缓存获取
      const cached = await this.getFromCache(cacheKey)
      if (cached) {
        await this.recordSearchPerformance('getFilterOptions', startTime, input, true)
        return cached
      }

      // 构建聚合查询
      const aggregationQuery = this.buildFilterOptionsAggregation(input.query)

      const response = await this.client.search({
        index: this.indexName,
        body: {
          size: 0, // 只需要聚合结果，不需要文档
          query: input.query ? this.buildBaseQuery(input.query) : { match_all: {} },
          aggs: aggregationQuery,
          timeout: '10s'
        }
      })

      // 处理聚合结果
      const filterOptions = this.processFilterOptionsAggregation(response.body.aggregations, input.includeEmptyOptions)

      // 缓存结果
      await this.setToCache(cacheKey, filterOptions, this.filterOptionsCacheTtl)

      // 记录性能指标
      await this.recordSearchPerformance('getFilterOptions', startTime, input, false,
        filterOptions.categories.length + filterOptions.statuses.length + filterOptions.types.length + filterOptions.tags.length
      )

      return filterOptions
    } catch (error) {
      console.error('获取筛选器选项失败:', {
        error: error instanceof Error ? error.message : String(error),
        query: input.query,
        timestamp: new Date().toISOString()
      })

      // 返回空的筛选选项，确保服务降级可用性
      return this.getEmptyFilterOptions()
    }
  }

  /**
   * 获取筛选器聚合统计
   * 根据当前搜索和筛选条件返回聚合统计信息
   */
  async getFilterAggregations(input: FilterAggregationsInput): Promise<FilterAggregations> {
    const startTime = Date.now()

    try {
      // 缓存键
      const cacheKey = this.generateCacheKey('aggregations', input)

      // 尝试从缓存获取
      const cached = await this.getFromCache(cacheKey)
      if (cached) {
        await this.recordSearchPerformance('getFilterAggregations', startTime, input, true, cached.totalResults)
        return cached
      }

      // 构建查询和聚合
      const baseQuery = this.buildAdvancedSearchQuery(input.query, input.filters)
      const aggregationQuery = this.buildFilterAggregationsQuery()

      const response = await this.client.search({
        index: this.indexName,
        body: {
          size: 0,
          query: baseQuery,
          aggs: aggregationQuery,
          timeout: '10s'
        }
      })

      // 处理聚合结果
      const aggregations = this.processFilterAggregations(response.body.aggregations)

      // 缓存结果
      await this.setToCache(cacheKey, aggregations, this.aggregationsCacheTtl)

      // 记录性能指标
      await this.recordSearchPerformance('getFilterAggregations', startTime, input, false, aggregations.totalResults)

      return aggregations
    } catch (error) {
      console.error('获取筛选器聚合统计失败:', {
        error: error instanceof Error ? error.message : String(error),
        query: input.query,
        timestamp: new Date().toISOString()
      })

      // 返回空的聚合结果
      return this.getEmptyFilterAggregations()
    }
  }

  /**
   * 高级搜索
   * 支持复杂筛选条件的搜索功能
   */
  async advancedSearch(input: AdvancedSearchInput): Promise<{
    results: any[]
    total: number
    page: number
    pageSize: number
    totalPages: number
    aggregations?: FilterAggregations
  }> {
    const startTime = Date.now()

    try {
      // 缓存键
      const cacheKey = this.generateCacheKey('search', input)

      // 尝试从缓存获取
      const cached = await this.getFromCache(cacheKey)
      if (cached) {
        await this.recordSearchPerformance('advancedSearch', startTime, input, true, cached.total)
        return cached
      }

      // 构建搜索查询
      const searchQuery = this.buildAdvancedSearchQuery(input.query, input.filters)
      const { page, pageSize } = input
      const from = (page - 1) * pageSize

      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: searchQuery,
          highlight: {
            fields: {
              name: {},
              description: {},
              businessDescription: {}
            },
            pre_tags: ['<mark>'],
            post_tags: ['</mark>']
          },
          sort: this.buildAdvancedSortQuery(input.sort),
          from,
          size: pageSize,
          // 同时获取聚合统计信息
          aggs: this.buildFilterAggregationsQuery(),
          timeout: '15s'
        }
      })

      const results = response.body.hits.hits.map((hit: any) => ({
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
        createdAt: hit._source.createdAt,
        updatedAt: hit._source.updatedAt,
        highlights: hit.highlight,
        searchScore: hit._score
      }))

      const total = response.body.hits.total.value
      const totalPages = Math.ceil(total / pageSize)

      // 处理聚合结果
      const aggregations = this.processFilterAggregations(response.body.aggregations)

      const result = {
        results,
        total,
        page,
        pageSize,
        totalPages,
        aggregations
      }

      // 缓存结果
      await this.setToCache(cacheKey, result, this.aggregationsCacheTtl)

      // 记录性能指标
      await this.recordSearchPerformance('advancedSearch', startTime, input, false, total)

      return result
    } catch (error) {
      console.error('高级搜索失败，降级到基础搜索:', {
        error: error instanceof Error ? error.message : String(error),
        query: input.query,
        timestamp: new Date().toISOString()
      })

      // 降级到基础搜索
      return this.fallbackAdvancedSearch(input)
    }
  }

  /**
   * 验证筛选条件
   * 确保筛选条件的合法性和安全性
   */
  validateFilters(filters: AdvancedFilters): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    try {
      // 验证分类ID格式
      if (filters.categories) {
        filters.categories.forEach(categoryId => {
          if (!categoryId || typeof categoryId !== 'string' || categoryId.length > 50) {
            errors.push(`无效的分类ID: ${categoryId}`)
          }
        })
      }

      // 验证状态值
      if (filters.statuses) {
        const validStatuses = ['active', 'inactive', 'draft', 'archived', 'pending']
        filters.statuses.forEach(status => {
          if (!validStatuses.includes(status)) {
            errors.push(`无效的状态值: ${status}`)
          }
        })
      }

      // 验证资产类型
      if (filters.types) {
        const validTypes = ['table', 'view', 'procedure', 'function', 'api', 'file', 'report']
        filters.types.forEach(type => {
          if (!validTypes.includes(type)) {
            errors.push(`无效的资产类型: ${type}`)
          }
        })
      }

      // 验证质量分数范围
      if (filters.qualityScoreMin !== undefined && filters.qualityScoreMax !== undefined) {
        if (filters.qualityScoreMin > filters.qualityScoreMax) {
          errors.push('质量分数最小值不能大于最大值')
        }
      }

      // 验证日期格式
      if (filters.updatedAfter && !this.isValidDateString(filters.updatedAfter)) {
        errors.push(`无效的更新开始日期格式: ${filters.updatedAfter}`)
      }
      if (filters.updatedBefore && !this.isValidDateString(filters.updatedBefore)) {
        errors.push(`无效的更新结束日期格式: ${filters.updatedBefore}`)
      }
      if (filters.createdAfter && !this.isValidDateString(filters.createdAfter)) {
        errors.push(`无效的创建开始日期格式: ${filters.createdAfter}`)
      }
      if (filters.createdBefore && !this.isValidDateString(filters.createdBefore)) {
        errors.push(`无效的创建结束日期格式: ${filters.createdBefore}`)
      }

      // 验证标签
      if (filters.tags) {
        filters.tags.forEach(tag => {
          if (!tag || typeof tag !== 'string' || tag.length > 100) {
            errors.push(`无效的标签: ${tag}`)
          }
        })
      }

      // 验证负责人ID
      if (filters.owners) {
        filters.owners.forEach(ownerId => {
          if (!ownerId || typeof ownerId !== 'string' || ownerId.length > 50) {
            errors.push(`无效的负责人ID: ${ownerId}`)
          }
        })
      }

      return {
        valid: errors.length === 0,
        errors
      }
    } catch (error) {
      console.error('筛选条件验证失败:', error)
      return {
        valid: false,
        errors: ['筛选条件验证失败']
      }
    }
  }

  /**
   * 构建基础查询
   */
  private buildBaseQuery(query: string) {
    return {
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
    }
  }

  /**
   * 构建高级搜索查询
   */
  private buildAdvancedSearchQuery(query: string, filters?: AdvancedFilters) {
    const mustQueries: any[] = []
    const filterQueries: any[] = []

    // 主搜索查询
    if (query) {
      mustQueries.push(this.buildBaseQuery(query))
    }

    // 应用筛选条件
    if (filters) {
      // 分类筛选
      if (filters.categories && filters.categories.length > 0) {
        filterQueries.push({ terms: { categoryId: filters.categories } })
      }

      // 状态筛选
      if (filters.statuses && filters.statuses.length > 0) {
        filterQueries.push({ terms: { status: filters.statuses } })
      }

      // 类型筛选
      if (filters.types && filters.types.length > 0) {
        filterQueries.push({ terms: { type: filters.types } })
      }

      // 负责人筛选 (需要扩展索引映射以包含owner字段)
      if (filters.owners && filters.owners.length > 0) {
        filterQueries.push({ terms: { 'owner.id': filters.owners } })
      }

      // 标签筛选
      if (filters.tags && filters.tags.length > 0) {
        if (filters.logicOperator === 'OR') {
          filterQueries.push({ terms: { tags: filters.tags } })
        } else {
          // AND逻辑：所有标签都必须匹配
          filters.tags.forEach(tag => {
            filterQueries.push({ term: { tags: tag } })
          })
        }
      }

      // 质量分数范围筛选
      if (filters.qualityScoreMin !== undefined || filters.qualityScoreMax !== undefined) {
        const range: any = {}
        if (filters.qualityScoreMin !== undefined) range.gte = filters.qualityScoreMin
        if (filters.qualityScoreMax !== undefined) range.lte = filters.qualityScoreMax
        filterQueries.push({ range: { qualityScore: range } })
      }

      // 更新时间范围筛选
      if (filters.updatedAfter || filters.updatedBefore) {
        const range: any = {}
        if (filters.updatedAfter) range.gte = filters.updatedAfter
        if (filters.updatedBefore) range.lte = filters.updatedBefore
        filterQueries.push({ range: { updatedAt: range } })
      }

      // 创建时间范围筛选
      if (filters.createdAfter || filters.createdBefore) {
        const range: any = {}
        if (filters.createdAfter) range.gte = filters.createdAfter
        if (filters.createdBefore) range.lte = filters.createdBefore
        filterQueries.push({ range: { createdAt: range } })
      }
    }

    return {
      bool: {
        must: mustQueries.length > 0 ? mustQueries : [{ match_all: {} }],
        filter: filterQueries
      }
    }
  }

  /**
   * 构建筛选器选项聚合查询
   */
  private buildFilterOptionsAggregation(query?: string) {
    return {
      categories: {
        terms: {
          field: 'categoryId',
          size: 100
        },
        aggs: {
          category_names: {
            terms: {
              field: 'categoryName.raw',
              size: 1
            }
          }
        }
      },
      statuses: {
        terms: {
          field: 'status',
          size: 20
        }
      },
      types: {
        terms: {
          field: 'type',
          size: 20
        }
      },
      tags: {
        terms: {
          field: 'tags',
          size: 100
        }
      },
      quality_score_ranges: {
        range: {
          field: 'qualityScore',
          ranges: [
            { key: '0-2', to: 2 },
            { key: '2-4', from: 2, to: 4 },
            { key: '4-6', from: 4, to: 6 },
            { key: '6-8', from: 6, to: 8 },
            { key: '8-10', from: 8, to: 10 }
          ]
        }
      },
      update_time_ranges: {
        date_range: {
          field: 'updatedAt',
          ranges: [
            { key: 'last_day', from: 'now-1d/d' },
            { key: 'last_week', from: 'now-7d/d' },
            { key: 'last_month', from: 'now-30d/d' },
            { key: 'last_quarter', from: 'now-90d/d' },
            { key: 'last_year', from: 'now-365d/d' }
          ]
        }
      }
    }
  }

  /**
   * 构建筛选器聚合统计查询
   */
  private buildFilterAggregationsQuery() {
    return {
      categories_agg: {
        terms: {
          field: 'categoryId',
          size: 100
        }
      },
      statuses_agg: {
        terms: {
          field: 'status',
          size: 20
        }
      },
      types_agg: {
        terms: {
          field: 'type',
          size: 20
        }
      },
      tags_agg: {
        terms: {
          field: 'tags',
          size: 100
        }
      },
      quality_score_distribution: {
        histogram: {
          field: 'qualityScore',
          interval: 1,
          min_doc_count: 0,
          extended_bounds: {
            min: 0,
            max: 10
          }
        }
      },
      update_time_distribution: {
        date_histogram: {
          field: 'updatedAt',
          interval: 'month',
          min_doc_count: 0
        }
      }
    }
  }

  /**
   * 构建高级排序查询
   */
  private buildAdvancedSortQuery(sort: string) {
    switch (sort) {
      case 'name':
        return [{ 'name.raw': { order: 'asc' } }]
      case 'createdAt':
        return [{ createdAt: { order: 'desc' } }]
      case 'updatedAt':
        return [{ updatedAt: { order: 'desc' } }]
      case 'qualityScore':
        return [{ qualityScore: { order: 'desc' } }]
      case 'relevance':
      default:
        return [{ _score: { order: 'desc' } }]
    }
  }

  /**
   * 处理筛选器选项聚合结果
   */
  private processFilterOptionsAggregation(aggregations: any, includeEmpty: boolean): FilterOptions {
    return {
      categories: aggregations.categories?.buckets?.map((bucket: any) => ({
        id: bucket.key,
        name: bucket.category_names?.buckets?.[0]?.key || bucket.key,
        count: bucket.doc_count
      })).filter((item: any) => includeEmpty || item.count > 0) || [],

      statuses: aggregations.statuses?.buckets?.map((bucket: any) => ({
        value: bucket.key,
        label: this.getStatusLabel(bucket.key),
        count: bucket.doc_count
      })).filter((item: any) => includeEmpty || item.count > 0) || [],

      types: aggregations.types?.buckets?.map((bucket: any) => ({
        value: bucket.key,
        label: this.getTypeLabel(bucket.key),
        count: bucket.doc_count
      })).filter((item: any) => includeEmpty || item.count > 0) || [],

      owners: [], // 需要从用户服务获取负责人信息

      tags: aggregations.tags?.buckets?.map((bucket: any) => ({
        value: bucket.key,
        count: bucket.doc_count
      })).filter((item: any) => includeEmpty || item.count > 0) || [],

      qualityScoreRanges: aggregations.quality_score_ranges?.buckets?.map((bucket: any) => ({
        min: bucket.from || 0,
        max: bucket.to || 10,
        label: this.getQualityScoreRangeLabel(bucket.key),
        count: bucket.doc_count
      })).filter((item: any) => includeEmpty || item.count > 0) || [],

      dateRanges: aggregations.update_time_ranges?.buckets?.map((bucket: any) => ({
        range: bucket.key,
        from: bucket.from_as_string,
        to: bucket.to_as_string,
        label: this.getDateRangeLabel(bucket.key),
        count: bucket.doc_count
      })).filter((item: any) => includeEmpty || item.count > 0) || []
    }
  }

  /**
   * 处理筛选器聚合统计结果
   */
  private processFilterAggregations(aggregations: any): FilterAggregations {
    const result: FilterAggregations = {
      categories: {},
      statuses: {},
      types: {},
      owners: {},
      tags: {},
      qualityScoreDistribution: [],
      updateTimeDistribution: [],
      totalResults: 0
    }

    // 处理分类聚合
    if (aggregations.categories_agg?.buckets) {
      aggregations.categories_agg.buckets.forEach((bucket: any) => {
        result.categories[bucket.key] = bucket.doc_count
      })
    }

    // 处理状态聚合
    if (aggregations.statuses_agg?.buckets) {
      aggregations.statuses_agg.buckets.forEach((bucket: any) => {
        result.statuses[bucket.key] = bucket.doc_count
      })
    }

    // 处理类型聚合
    if (aggregations.types_agg?.buckets) {
      aggregations.types_agg.buckets.forEach((bucket: any) => {
        result.types[bucket.key] = bucket.doc_count
      })
    }

    // 处理标签聚合
    if (aggregations.tags_agg?.buckets) {
      aggregations.tags_agg.buckets.forEach((bucket: any) => {
        result.tags[bucket.key] = bucket.doc_count
      })
    }

    // 处理质量分数分布
    if (aggregations.quality_score_distribution?.buckets) {
      result.qualityScoreDistribution = aggregations.quality_score_distribution.buckets.map((bucket: any) => ({
        range: `${bucket.key}-${bucket.key + 1}`,
        count: bucket.doc_count
      }))
    }

    // 处理更新时间分布
    if (aggregations.update_time_distribution?.buckets) {
      result.updateTimeDistribution = aggregations.update_time_distribution.buckets.map((bucket: any) => ({
        period: bucket.key_as_string,
        count: bucket.doc_count
      }))
    }

    return result
  }

  /**
   * PostgreSQL降级高级搜索
   */
  private async fallbackAdvancedSearch(input: AdvancedSearchInput) {
    // 这里实现PostgreSQL的降级搜索逻辑
    // 为了简化，返回基本结构
    return {
      results: [],
      total: 0,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: 0,
      aggregations: this.getEmptyFilterAggregations()
    }
  }

  /**
   * 获取空的筛选选项
   */
  private getEmptyFilterOptions(): FilterOptions {
    return {
      categories: [],
      statuses: [],
      types: [],
      owners: [],
      tags: [],
      qualityScoreRanges: [],
      dateRanges: []
    }
  }

  /**
   * 获取空的聚合结果
   */
  private getEmptyFilterAggregations(): FilterAggregations {
    return {
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

  /**
   * 验证日期字符串格式
   */
  private isValidDateString(dateStr: string): boolean {
    const date = new Date(dateStr)
    return !isNaN(date.getTime())
  }

  /**
   * 获取状态标签
   */
  private getStatusLabel(status: string): string {
    const statusLabels: Record<string, string> = {
      'active': '活跃',
      'inactive': '非活跃',
      'draft': '草稿',
      'archived': '已归档',
      'pending': '待审核'
    }
    return statusLabels[status] || status
  }

  /**
   * 获取类型标签
   */
  private getTypeLabel(type: string): string {
    const typeLabels: Record<string, string> = {
      'table': '数据表',
      'view': '视图',
      'procedure': '存储过程',
      'function': '函数',
      'api': 'API接口',
      'file': '文件',
      'report': '报告'
    }
    return typeLabels[type] || type
  }

  /**
   * 获取质量分数范围标签
   */
  private getQualityScoreRangeLabel(range: string): string {
    const rangeLabels: Record<string, string> = {
      '0-2': '较低 (0-2)',
      '2-4': '一般 (2-4)',
      '4-6': '中等 (4-6)',
      '6-8': '良好 (6-8)',
      '8-10': '优秀 (8-10)'
    }
    return rangeLabels[range] || range
  }

  /**
   * 获取日期范围标签
   */
  private getDateRangeLabel(range: string): string {
    const rangeLabels: Record<string, string> = {
      'last_day': '最近1天',
      'last_week': '最近1周',
      'last_month': '最近1个月',
      'last_quarter': '最近3个月',
      'last_year': '最近1年'
    }
    return rangeLabels[range] || range
  }

  // 缓存键生成器
  private generateCacheKey(prefix: string, params: any): string {
    const paramsStr = JSON.stringify(params, Object.keys(params).sort())
    const hash = require('crypto').createHash('md5').update(paramsStr).digest('hex')
    return `${prefix}:${hash}`
  }

  // 从缓存获取数据
  private async getFromCache(key: string): Promise<any | null> {
    try {
      const cached = await this.redisClient.get(key)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      console.warn('Failed to get data from cache:', error)
      return null
    }
  }

  // 设置缓存数据
  private async setToCache(key: string, data: any, ttl: number): Promise<void> {
    try {
      await this.redisClient.setex(key, ttl, JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to set data to cache:', error)
    }
  }

  // 批量获取缓存数据
  private async getBatchFromCache(keys: string[]): Promise<Record<string, any>> {
    try {
      const pipeline = this.redisClient.pipeline()
      keys.forEach(key => pipeline.get(key))
      const results = await pipeline.exec()

      const data: Record<string, any> = {}
      results?.forEach((result, index) => {
        if (result && result[1]) {
          try {
            data[keys[index]] = JSON.parse(result[1] as string)
          } catch (error) {
            console.warn(`Failed to parse cached data for key ${keys[index]}:`, error)
          }
        }
      })
      return data
    } catch (error) {
      console.warn('Failed to get batch data from cache:', error)
      return {}
    }
  }

  // 批量设置缓存数据
  private async setBatchToCache(data: Record<string, any>, ttl: number = 1800): Promise<void> {
    try {
      const pipeline = this.redisClient.pipeline()
      Object.entries(data).forEach(([key, value]) => {
        pipeline.setex(key, ttl, JSON.stringify(value))
      })
      await pipeline.exec()
    } catch (error) {
      console.warn('Failed to set batch data to cache:', error)
    }
  }

  // 预加载筛选选项（在后台异步加载常用筛选数据）
  public async preloadFilterOptions(commonQueries: string[] = []): Promise<void> {
    try {
      // 预加载常用查询的筛选选项
      const preloadPromises = commonQueries.map(async (query) => {
        const cacheKey = this.generateCacheKey('filter_options', { query, includeEmptyOptions: false })
        const cached = await this.getFromCache(cacheKey)

        if (!cached) {
          // 在后台异步加载
          this.getFilterOptions({ query, includeEmptyOptions: false }).catch(error => {
            console.warn(`Failed to preload filter options for query "${query}":`, error)
          })
        }
      })

      await Promise.allSettled(preloadPromises)
    } catch (error) {
      console.warn('Failed to preload filter options:', error)
    }
  }

  // 智能缓存失效（当数据更新时，失效相关缓存）
  public async invalidateRelatedCache(affectedFields: string[] = []): Promise<void> {
    try {
      const patterns = [
        'search-filter:options:*',
        'search-filter:aggregations:*',
        'search-filter:search:*'
      ]

      // 如果指定了受影响的字段，可以更精确地失效缓存
      if (affectedFields.length > 0) {
        const specificPatterns = affectedFields.map(field => `*${field}*`)
        patterns.push(...specificPatterns)
      }

      for (const pattern of patterns) {
        const keys = await this.redisClient.keys(pattern)
        if (keys.length > 0) {
          await this.redisClient.del(...keys)
        }
      }
    } catch (error) {
      console.warn('Failed to invalidate cache:', error)
    }
  }

  // 获取缓存统计信息
  public async getCacheStats(): Promise<{
    totalKeys: number
    filterOptionsKeys: number
    aggregationsKeys: number
    searchKeys: number
    memoryUsage: string
  }> {
    try {
      const filterOptionsKeys = await this.redisClient.keys('search-filter:options:*')
      const aggregationsKeys = await this.redisClient.keys('search-filter:aggregations:*')
      const searchKeys = await this.redisClient.keys('search-filter:search:*')
      const totalKeys = filterOptionsKeys.length + aggregationsKeys.length + searchKeys.length

      // 获取内存使用情况
      const info = await this.redisClient.info('memory')
      const memoryMatch = info.match(/used_memory_human:(.+)/)
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'Unknown'

      return {
        totalKeys,
        filterOptionsKeys: filterOptionsKeys.length,
        aggregationsKeys: aggregationsKeys.length,
        searchKeys: searchKeys.length,
        memoryUsage
      }
    } catch (error) {
      console.warn('Failed to get cache stats:', error)
      return {
        totalKeys: 0,
        filterOptionsKeys: 0,
        aggregationsKeys: 0,
        searchKeys: 0,
        memoryUsage: 'Unknown'
      }
    }
  }

  // 性能监控 - 记录搜索性能指标
  public async recordSearchPerformance(
    operation: 'getFilterOptions' | 'getFilterAggregations' | 'advancedSearch',
    startTime: number,
    params: any,
    cacheHit: boolean,
    resultCount?: number
  ): Promise<void> {
    try {
      const endTime = Date.now()
      const duration = endTime - startTime

      const metric = {
        operation,
        duration,
        timestamp: endTime,
        cacheHit,
        resultCount: resultCount || 0,
        params: {
          query: params.query,
          hasFilters: !!(params.filters && Object.keys(params.filters).length > 0),
          filtersCount: params.filters ? Object.keys(params.filters).length : 0
        }
      }

      // 记录到Redis用于监控（保留最近1000条记录）
      const metricsKey = 'search-filter:metrics'
      await this.redisClient.lpush(metricsKey, JSON.stringify(metric))
      await this.redisClient.ltrim(metricsKey, 0, 999)
      await this.redisClient.expire(metricsKey, 86400) // 24小时过期

      // 记录慢查询（超过2秒）
      if (duration > 2000) {
        const slowQueryKey = 'search-filter:slow-queries'
        await this.redisClient.lpush(slowQueryKey, JSON.stringify({
          ...metric,
          warning: 'Slow query detected'
        }))
        await this.redisClient.ltrim(slowQueryKey, 0, 100)
        await this.redisClient.expire(slowQueryKey, 86400)

        console.warn(`Slow search query detected:`, {
          operation,
          duration: `${duration}ms`,
          query: params.query
        })
      }
    } catch (error) {
      console.warn('Failed to record search performance:', error)
    }
  }

  // 获取性能统计
  public async getPerformanceStats(): Promise<{
    totalQueries: number
    averageResponseTime: number
    cacheHitRate: number
    slowQueries: number
    recentMetrics: any[]
  }> {
    try {
      const metricsData = await this.redisClient.lrange('search-filter:metrics', 0, -1)
      const slowQueriesData = await this.redisClient.lrange('search-filter:slow-queries', 0, -1)

      const metrics = metricsData.map(data => JSON.parse(data))
      const totalQueries = metrics.length

      if (totalQueries === 0) {
        return {
          totalQueries: 0,
          averageResponseTime: 0,
          cacheHitRate: 0,
          slowQueries: 0,
          recentMetrics: []
        }
      }

      const totalResponseTime = metrics.reduce((sum, metric) => sum + metric.duration, 0)
      const cacheHits = metrics.filter(metric => metric.cacheHit).length

      return {
        totalQueries,
        averageResponseTime: Math.round(totalResponseTime / totalQueries),
        cacheHitRate: Math.round((cacheHits / totalQueries) * 100),
        slowQueries: slowQueriesData.length,
        recentMetrics: metrics.slice(0, 10) // 最近10次查询
      }
    } catch (error) {
      console.warn('Failed to get performance stats:', error)
      return {
        totalQueries: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        slowQueries: 0,
        recentMetrics: []
      }
    }
  }
}

export const searchFilterService = new SearchFilterService()