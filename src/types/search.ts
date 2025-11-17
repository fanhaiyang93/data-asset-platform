import { z } from 'zod'

// 搜索过滤器
export interface SearchFilters {
  status?: string[]
  type?: string[]
  categoryId?: string
  qualityScoreMin?: number
  qualityScoreMax?: number
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

// 搜索结果项目
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

// 搜索响应
export interface SearchResponse {
  results: SearchResult[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// 搜索输入参数
export interface SearchInput {
  query: string
  page?: number
  pageSize?: number
  sort?: 'relevance' | 'name' | 'createdAt' | 'qualityScore'
  filters?: SearchFilters
}

// 搜索建议输入参数
export interface SuggestInput {
  query: string
  size?: number
}

// 实时搜索输入参数
export interface LiveSearchInput {
  query: string
  size?: number
}

// 精简搜索结果（用于实时搜索）
export interface LiveSearchResult {
  id: string
  name: string
  description: string | null
  type: string | null
  categoryName?: string
  status: string
  searchScore: number
}

// 搜索行为日志
export interface SearchLogInput {
  query: string
  action: string
  sessionId: string
}

// Zod验证模式
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

export const SuggestInputSchema = z.object({
  query: z.string().min(1),
  size: z.number().min(1).max(10).default(5)
})

export const LiveSearchInputSchema = z.object({
  query: z.string().min(1),
  size: z.number().min(1).max(20).default(5)
})

export const SearchLogInputSchema = z.object({
  query: z.string().min(1),
  action: z.string().min(1),
  sessionId: z.string().min(1)
})

// 高级筛选输入验证
export const AdvancedFiltersSchema = z.object({
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

export const FilterOptionsInputSchema = z.object({
  query: z.string().optional(),
  includeEmptyOptions: z.boolean().default(false)
})

export const FilterAggregationsInputSchema = z.object({
  query: z.string().min(1),
  filters: AdvancedFiltersSchema.optional()
})

export const AdvancedSearchInputSchema = z.object({
  query: z.string().min(1),
  filters: AdvancedFiltersSchema.optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
  sort: z.enum(['relevance', 'name', 'createdAt', 'updatedAt', 'qualityScore']).default('relevance')
})

// 类型断言
export type SearchInputType = z.infer<typeof SearchInputSchema>
export type SuggestInputType = z.infer<typeof SuggestInputSchema>
export type LiveSearchInputType = z.infer<typeof LiveSearchInputSchema>
export type SearchLogInputType = z.infer<typeof SearchLogInputSchema>
export type AdvancedFiltersType = z.infer<typeof AdvancedFiltersSchema>
export type FilterOptionsInputType = z.infer<typeof FilterOptionsInputSchema>
export type FilterAggregationsInputType = z.infer<typeof FilterAggregationsInputSchema>
export type AdvancedSearchInputType = z.infer<typeof AdvancedSearchInputSchema>

// ===== 智能排序相关类型定义 =====

// 排序选项枚举
export type SortOption =
  | 'relevance'     // 相关度
  | 'popularity'    // 热门程度
  | 'recency'       // 最新更新
  | 'created'       // 创建时间
  | 'quality'       // 质量评分
  | 'personalized'  // 个性化推荐

// 多维度评分权重配置
export interface ScoringWeights {
  relevance: number    // 相关度权重 (默认: 0.4)
  popularity: number   // 热度权重 (默认: 0.3)
  recency: number      // 时效性权重 (默认: 0.2)
  personalization: number // 个性化权重 (默认: 0.1)
}

// 排序评分结果
export interface SortingScores {
  relevanceScore: number     // 相关度分数 (0-1)
  popularityScore: number    // 热度分数 (0-1)
  recencyScore: number       // 时效性分数 (0-1)
  personalizationScore: number // 个性化分数 (0-1)
  finalScore: number         // 最终综合分数 (0-1)
  explanation?: string       // 评分解释（调试用）
}

// 用户排序偏好
export interface UserSortPreferences {
  userId: string
  defaultSort: SortOption
  customWeights?: ScoringWeights
  savedSorts: Array<{
    name: string
    sort: SortOption
    weights?: ScoringWeights
    createdAt: Date
  }>
  lastUsedSort?: SortOption
  sortFrequency: Record<SortOption, number> // 各排序方式使用频率
}

// 个性化推荐配置
export interface PersonalizationConfig {
  userId: string
  searchHistory: Array<{
    query: string
    clickedAssets: string[]
    timestamp: Date
  }>
  preferredCategories: string[]
  preferredTypes: string[]
  interactionWeights: {
    view: number      // 查看权重
    download: number  // 下载权重
    bookmark: number  // 收藏权重
    share: number     // 分享权重
  }
}

// 资产热度统计数据
export interface AssetPopularity {
  assetId: string
  viewCount: number
  downloadCount: number
  bookmarkCount: number
  shareCount: number
  searchCount: number      // 被搜索到的次数
  clickThroughRate: number // 点击率
  lastAccessTime: Date
  popularityScore: number  // 计算出的热度分数
}

// 排序性能指标
export interface SortingPerformance {
  sortMethod: SortOption
  avgResponseTime: number  // 平均响应时间(ms)
  queryCount: number       // 查询次数
  userSatisfaction: number // 用户满意度 (1-5)
  clickThroughRate: number // 点击率
  timestamp: Date
}

// A/B测试配置
export interface ABTestConfig {
  testId: string
  name: string
  description: string
  variants: Array<{
    name: string
    weights: ScoringWeights
    traffic: number // 流量分配比例 (0-1)
  }>
  isActive: boolean
  startDate: Date
  endDate?: Date
  targetMetrics: string[] // 目标指标 ['ctr', 'satisfaction', 'engagement']
}

// 扩展搜索输入（包含排序参数）
export interface SearchWithSortingInput extends SearchInput {
  sort?: SortOption
  personalizeForUser?: string  // 用户ID，用于个性化排序
  customWeights?: ScoringWeights
  abTestVariant?: string       // A/B测试变体
}

// 扩展搜索结果（包含排序信息）
export interface SearchResultWithSorting extends SearchResult {
  sortingScores?: SortingScores
  sortMethod?: SortOption
  personalizedRank?: number    // 个性化排序中的位置
}

// 排序反馈输入
export interface SortingFeedbackInput {
  userId: string
  query: string
  sortMethod: SortOption
  resultPosition: number       // 用户点击的结果位置
  satisfactionScore: number    // 满意度评分 (1-5)
  clickedAssetId?: string      // 点击的资产ID
  sessionId: string
}

// Zod验证模式 - 排序相关
export const SortOptionSchema = z.enum([
  'relevance', 'popularity', 'recency', 'created', 'quality', 'personalized'
])

export const ScoringWeightsSchema = z.object({
  relevance: z.number().min(0).max(1),
  popularity: z.number().min(0).max(1),
  recency: z.number().min(0).max(1),
  personalization: z.number().min(0).max(1)
}).refine(
  (weights) => {
    const sum = weights.relevance + weights.popularity + weights.recency + weights.personalization
    return Math.abs(sum - 1.0) < 0.001 // 允许小数点精度误差
  },
  { message: "权重总和必须等于1.0" }
)

export const SearchWithSortingInputSchema = SearchInputSchema.extend({
  sort: SortOptionSchema.default('relevance'),
  personalizeForUser: z.string().optional(),
  customWeights: ScoringWeightsSchema.optional(),
  abTestVariant: z.string().optional()
})

export const SortingFeedbackInputSchema = z.object({
  userId: z.string().min(1),
  query: z.string().min(1),
  sortMethod: SortOptionSchema,
  resultPosition: z.number().min(0),
  satisfactionScore: z.number().min(1).max(5),
  clickedAssetId: z.string().optional(),
  sessionId: z.string().min(1)
})

// 类型断言 - 排序相关
export type ScoringWeightsType = z.infer<typeof ScoringWeightsSchema>
export type SearchWithSortingInputType = z.infer<typeof SearchWithSortingInputSchema>
export type SortingFeedbackInputType = z.infer<typeof SortingFeedbackInputSchema>