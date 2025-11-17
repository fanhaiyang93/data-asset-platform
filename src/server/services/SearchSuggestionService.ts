import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/cache'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'

// 搜索建议类型枚举
export enum SuggestionType {
  ASSET_NAME = 'asset_name',
  CATEGORY = 'category',
  TAG = 'tag',
  DATABASE = 'database',
  SCHEMA = 'schema',
  TABLE = 'table'
}

// 搜索建议结果界面
export interface SearchSuggestion {
  text: string
  type: SuggestionType
  score: number
  metadata?: {
    assetCount?: number
    description?: string
    categoryId?: string
  }
}

// 智能搜索建议输入验证
export const IntelligentSuggestInputSchema = z.object({
  query: z.string().min(1),
  size: z.number().min(1).max(10).default(5),
  types: z.array(z.nativeEnum(SuggestionType)).optional()
})

export type IntelligentSuggestInput = z.infer<typeof IntelligentSuggestInputSchema>

export class SearchSuggestionService {
  private cachePrefix = 'suggestion:'
  // **智能搜索建议缓存策略 - 30分钟TTL**
  // 原因：智能建议计算复杂，元数据变化较少，适合长时间缓存
  // - 30分钟：资产元数据（名称、分类、标签）变化频率低
  // - 性能优化：避免重复执行复杂算法（相似度计算、权重排序）
  // - 适用场景：智能建议主要API，包含多种建议类型的组合
  private cacheTtl = 1800

  constructor() {}

  // 智能搜索建议（主要方法）
  async getIntelligentSuggestions(input: IntelligentSuggestInput): Promise<SearchSuggestion[]> {
    try {
      // 缓存键
      const cacheKey = `${this.cachePrefix}intelligent:${JSON.stringify(input)}`

      // 尝试从缓存获取
      const cached = await redis.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }

      const { query, size, types } = input
      const suggestions: SearchSuggestion[] = []

      // 并行获取各种类型的建议
      const suggestionPromises = []

      if (!types || types.includes(SuggestionType.ASSET_NAME)) {
        suggestionPromises.push(this.getAssetNameSuggestions(query, Math.ceil(size * 0.4)))
      }

      if (!types || types.includes(SuggestionType.CATEGORY)) {
        suggestionPromises.push(this.getCategorySuggestions(query, Math.ceil(size * 0.2)))
      }

      if (!types || types.includes(SuggestionType.TAG)) {
        suggestionPromises.push(this.getTagSuggestions(query, Math.ceil(size * 0.2)))
      }

      if (!types || types.includes(SuggestionType.DATABASE) ||
          types.includes(SuggestionType.SCHEMA) ||
          types.includes(SuggestionType.TABLE)) {
        suggestionPromises.push(this.getDatabaseSuggestions(query, Math.ceil(size * 0.2)))
      }

      const results = await Promise.all(suggestionPromises)

      // 合并和排序建议
      for (const result of results) {
        suggestions.push(...result)
      }

      // 按分数排序并限制数量
      const sortedSuggestions = suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, size)

      // 缓存结果
      await redis.setex(cacheKey, this.cacheTtl, JSON.stringify(sortedSuggestions))

      return sortedSuggestions
    } catch (error) {
      // 统一错误处理：记录详细错误信息，静默失败返回空数组
      console.error('获取智能搜索建议失败，返回空建议列表:', {
        error: error instanceof Error ? error.message : String(error),
        query: input.query,
        timestamp: new Date().toISOString()
      })
      return [] // 搜索建议失败不影响核心搜索功能
    }
  }

  // 获取资产名称建议
  private async getAssetNameSuggestions(query: string, limit: number): Promise<SearchSuggestion[]> {
    try {
      const assets = await prisma.asset.findMany({
        where: {
          status: 'active',
          name: {
            contains: query,
            mode: 'insensitive'
          }
        },
        select: {
          name: true,
          description: true
        },
        take: limit,
        orderBy: {
          name: 'asc'
        }
      })

      return assets.map(asset => ({
        text: asset.name,
        type: SuggestionType.ASSET_NAME,
        score: this.calculateRelevanceScore(asset.name, query),
        metadata: {
          description: asset.description
        }
      }))
    } catch (error) {
      // 统一错误处理：记录详细错误信息，静默失败返回空数组
      console.error('获取资产名称建议失败，跳过该类建议:', {
        error: error instanceof Error ? error.message : String(error),
        query,
        timestamp: new Date().toISOString()
      })
      return [] // 单个类型建议失败不影响其他建议类型
    }
  }

  // 获取分类建议
  private async getCategorySuggestions(query: string, limit: number): Promise<SearchSuggestion[]> {
    try {
      const categories = await prisma.category.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          name: true,
          description: true,
          _count: {
            select: { assets: true }
          }
        },
        take: limit,
        orderBy: {
          assets: {
            _count: 'desc'
          }
        }
      })

      return categories.map(category => ({
        text: category.name,
        type: SuggestionType.CATEGORY,
        score: this.calculateRelevanceScore(category.name, query) + (category._count.assets * 0.1),
        metadata: {
          description: category.description,
          categoryId: category.id,
          assetCount: category._count.assets
        }
      }))
    } catch (error) {
      // 统一错误处理：记录详细错误信息，静默失败返回空数组
      console.error('获取分类建议失败，跳过该类建议:', {
        error: error instanceof Error ? error.message : String(error),
        query,
        timestamp: new Date().toISOString()
      })
      return [] // 单个类型建议失败不影响其他建议类型
    }
  }

  // 获取标签建议
  private async getTagSuggestions(query: string, limit: number): Promise<SearchSuggestion[]> {
    try {
      // 获取包含查询词的标签
      const assets = await prisma.asset.findMany({
        where: {
          status: 'active',
          tags: {
            contains: query,
            mode: 'insensitive'
          }
        },
        select: {
          tags: true
        },
        take: 100 // 获取更多以提取标签
      })

      // 提取和计算标签频率
      const tagFrequency = new Map<string, number>()

      assets.forEach(asset => {
        if (asset.tags) {
          const tags = asset.tags.split(',').map(tag => tag.trim())
          tags.forEach(tag => {
            if (tag.toLowerCase().includes(query.toLowerCase())) {
              tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1)
            }
          })
        }
      })

      // 转换为建议格式并排序
      const suggestions = Array.from(tagFrequency.entries())
        .map(([tag, count]) => ({
          text: tag,
          type: SuggestionType.TAG,
          score: this.calculateRelevanceScore(tag, query) + (count * 0.2),
          metadata: {
            assetCount: count
          }
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)

      return suggestions
    } catch (error) {
      console.error('获取标签建议失败:', error)
      return []
    }
  }

  // 获取数据库相关建议
  private async getDatabaseSuggestions(query: string, limit: number): Promise<SearchSuggestion[]> {
    try {
      const suggestions: SearchSuggestion[] = []

      // 获取数据库名称建议
      const databaseNames = await prisma.asset.groupBy({
        by: ['databaseName'],
        where: {
          status: 'active',
          databaseName: {
            not: null,
            contains: query,
            mode: 'insensitive'
          }
        },
        _count: {
          databaseName: true
        },
        take: Math.ceil(limit / 3)
      })

      databaseNames.forEach(db => {
        if (db.databaseName) {
          suggestions.push({
            text: db.databaseName,
            type: SuggestionType.DATABASE,
            score: this.calculateRelevanceScore(db.databaseName, query) + (db._count.databaseName * 0.1),
            metadata: {
              assetCount: db._count.databaseName
            }
          })
        }
      })

      // 获取Schema建议
      const schemaNames = await prisma.asset.groupBy({
        by: ['schemaName'],
        where: {
          status: 'active',
          schemaName: {
            not: null,
            contains: query,
            mode: 'insensitive'
          }
        },
        _count: {
          schemaName: true
        },
        take: Math.ceil(limit / 3)
      })

      schemaNames.forEach(schema => {
        if (schema.schemaName) {
          suggestions.push({
            text: schema.schemaName,
            type: SuggestionType.SCHEMA,
            score: this.calculateRelevanceScore(schema.schemaName, query) + (schema._count.schemaName * 0.1),
            metadata: {
              assetCount: schema._count.schemaName
            }
          })
        }
      })

      // 获取表名建议
      const tableNames = await prisma.asset.groupBy({
        by: ['tableName'],
        where: {
          status: 'active',
          tableName: {
            not: null,
            contains: query,
            mode: 'insensitive'
          }
        },
        _count: {
          tableName: true
        },
        take: Math.ceil(limit / 3)
      })

      tableNames.forEach(table => {
        if (table.tableName) {
          suggestions.push({
            text: table.tableName,
            type: SuggestionType.TABLE,
            score: this.calculateRelevanceScore(table.tableName, query) + (table._count.tableName * 0.1),
            metadata: {
              assetCount: table._count.tableName
            }
          })
        }
      })

      return suggestions.sort((a, b) => b.score - a.score)
    } catch (error) {
      console.error('获取数据库建议失败:', error)
      return []
    }
  }

  // 计算相关性分数
  private calculateRelevanceScore(text: string, query: string): number {
    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase()

    // 完全匹配最高分
    if (lowerText === lowerQuery) {
      return 100
    }

    // 开头匹配高分
    if (lowerText.startsWith(lowerQuery)) {
      return 80
    }

    // 包含匹配中等分
    if (lowerText.includes(lowerQuery)) {
      return 60
    }

    // 模糊匹配低分
    const similarity = this.calculateStringSimilarity(lowerText, lowerQuery)
    return similarity * 40
  }

  // 计算字符串相似度
  private calculateStringSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length)
    if (maxLength === 0) return 1.0

    const editDistance = this.levenshteinDistance(str1, str2)
    return (maxLength - editDistance) / maxLength
  }

  // 计算编辑距离
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  // 获取热门搜索词
  async getPopularSuggestions(limit: number = 10): Promise<SearchSuggestion[]> {
    try {
      const cacheKey = `${this.cachePrefix}popular:${limit}`

      // 尝试从缓存获取
      const cached = await redis.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }

      // 获取最常搜索的资产名称
      const popularAssets = await prisma.asset.findMany({
        where: {
          status: 'active'
        },
        select: {
          name: true,
          description: true
        },
        take: limit,
        orderBy: {
          updatedAt: 'desc' // 按更新时间排序，模拟热门度
        }
      })

      const suggestions = popularAssets.map(asset => ({
        text: asset.name,
        type: SuggestionType.ASSET_NAME,
        score: 50, // 热门建议统一分数
        metadata: {
          description: asset.description
        }
      }))

      // 缓存结果（较长TTL）
      // **热门搜索词缓存策略 - 1小时TTL**
      // 原因：热门搜索词基于历史统计，更新频率更低，可以使用更长缓存
      // - 1小时：热门词排序变化缓慢，更长缓存减少数据库查询
      // - 统计性质：基于历史数据，不需要实时更新
      // - 适用场景：搜索热门词推荐、趋势分析
      await redis.setex(cacheKey, 3600, JSON.stringify(suggestions))

      return suggestions
    } catch (error) {
      console.error('获取热门搜索建议失败:', error)
      return []
    }
  }

  // 清除建议缓存
  async clearSuggestionCache(): Promise<void> {
    try {
      const keys = await redis.keys(`${this.cachePrefix}*`)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
      console.log(`清除了 ${keys.length} 个建议缓存`)
    } catch (error) {
      console.error('清除建议缓存失败:', error)
    }
  }
}

export const searchSuggestionService = new SearchSuggestionService()