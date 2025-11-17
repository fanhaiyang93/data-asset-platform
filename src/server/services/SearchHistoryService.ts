import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'

// 搜索历史项界面
export interface SearchHistoryItem {
  query: string
  timestamp: Date
  resultCount: number
  searchType?: string
}

// 用户搜索偏好界面
export interface UserSearchPreferences {
  preferredCategories?: string[]
  preferredAssetTypes?: string[]
  defaultSort?: string
  defaultPageSize?: number
  showSuggestions?: boolean
  saveHistory?: boolean
}

// 搜索历史输入验证
export const GetSearchHistoryInputSchema = z.object({
  userId: z.string(),
  limit: z.number().min(1).max(50).default(10)
})

export const SaveSearchHistoryInputSchema = z.object({
  userId: z.string(),
  query: z.string().min(1),
  resultCount: z.number().min(0),
  searchType: z.string().default('full'),
  sessionId: z.string()
})

export const ClearSearchHistoryInputSchema = z.object({
  userId: z.string()
})

export const UpdateSearchPreferencesInputSchema = z.object({
  userId: z.string(),
  preferences: z.object({
    preferredCategories: z.array(z.string()).optional(),
    preferredAssetTypes: z.array(z.string()).optional(),
    defaultSort: z.string().optional(),
    defaultPageSize: z.number().min(1).max(100).optional(),
    showSuggestions: z.boolean().optional(),
    saveHistory: z.boolean().optional()
  })
})

export type GetSearchHistoryInput = z.infer<typeof GetSearchHistoryInputSchema>
export type SaveSearchHistoryInput = z.infer<typeof SaveSearchHistoryInputSchema>
export type ClearSearchHistoryInput = z.infer<typeof ClearSearchHistoryInputSchema>
export type UpdateSearchPreferencesInput = z.infer<typeof UpdateSearchPreferencesInputSchema>

export class SearchHistoryService {
  constructor() {}

  // 获取用户搜索历史
  async getSearchHistory(input: GetSearchHistoryInput): Promise<SearchHistoryItem[]> {
    try {
      const { userId, limit } = input

      // 从UserSearchPreference中获取搜索历史
      const userPreference = await prisma.userSearchPreference.findUnique({
        where: { userId },
        select: { searchHistory: true }
      })

      if (!userPreference?.searchHistory) {
        return []
      }

      // 解析搜索历史JSON数组
      const history = Array.isArray(userPreference.searchHistory)
        ? userPreference.searchHistory as SearchHistoryItem[]
        : []

      // 按时间戳倒序排序并限制数量
      return history
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit)
        .map(item => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }))
    } catch (error) {
      console.error('获取搜索历史失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '获取搜索历史失败'
      })
    }
  }

  // 保存搜索历史
  async saveSearchHistory(input: SaveSearchHistoryInput): Promise<void> {
    try {
      const { userId, query, resultCount, searchType, sessionId } = input

      // 首先检查用户是否启用搜索历史保存
      const userPreference = await prisma.userSearchPreference.findUnique({
        where: { userId },
        select: { saveHistory: true, searchHistory: true }
      })

      // 如果用户禁用了搜索历史保存，则不保存
      if (userPreference && !userPreference.saveHistory) {
        return
      }

      // 创建新的搜索历史项
      const newHistoryItem: SearchHistoryItem = {
        query,
        timestamp: new Date(),
        resultCount,
        searchType
      }

      // 获取现有搜索历史
      const existingHistory = Array.isArray(userPreference?.searchHistory)
        ? userPreference.searchHistory as SearchHistoryItem[]
        : []

      // 去重：移除相同的查询词
      const filteredHistory = existingHistory.filter(item => item.query !== query)

      // 添加新项并限制历史数量（最多50条）
      const updatedHistory = [newHistoryItem, ...filteredHistory].slice(0, 50)

      // 更新或创建用户搜索偏好
      await prisma.userSearchPreference.upsert({
        where: { userId },
        update: {
          searchHistory: updatedHistory,
          lastSearchQuery: query,
          lastSearchAt: new Date()
        },
        create: {
          userId,
          searchHistory: updatedHistory,
          lastSearchQuery: query,
          lastSearchAt: new Date()
        }
      })

      // 同时记录到详细搜索日志
      await this.logSearchAction({
        userId,
        sessionId,
        query,
        resultCount,
        searchType,
        action: 'search'
      })
    } catch (error) {
      console.error('保存搜索历史失败:', error)
      // 不抛出错误，避免影响搜索功能
    }
  }

  // 清除用户搜索历史
  async clearSearchHistory(input: ClearSearchHistoryInput): Promise<void> {
    try {
      const { userId } = input

      await prisma.userSearchPreference.update({
        where: { userId },
        data: {
          searchHistory: [],
          lastSearchQuery: null,
          lastSearchAt: null
        }
      })
    } catch (error) {
      console.error('清除搜索历史失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '清除搜索历史失败'
      })
    }
  }

  // 获取用户搜索偏好
  async getUserSearchPreferences(userId: string): Promise<UserSearchPreferences> {
    try {
      const userPreference = await prisma.userSearchPreference.findUnique({
        where: { userId },
        select: {
          preferredCategories: true,
          preferredAssetTypes: true,
          defaultSort: true,
          defaultPageSize: true,
          showSuggestions: true,
          saveHistory: true
        }
      })

      if (!userPreference) {
        // 返回默认偏好设置
        return {
          preferredCategories: [],
          preferredAssetTypes: [],
          defaultSort: 'relevance',
          defaultPageSize: 20,
          showSuggestions: true,
          saveHistory: true
        }
      }

      return {
        preferredCategories: userPreference.preferredCategories
          ? JSON.parse(userPreference.preferredCategories)
          : [],
        preferredAssetTypes: userPreference.preferredAssetTypes
          ? JSON.parse(userPreference.preferredAssetTypes)
          : [],
        defaultSort: userPreference.defaultSort || 'relevance',
        defaultPageSize: userPreference.defaultPageSize || 20,
        showSuggestions: userPreference.showSuggestions !== false,
        saveHistory: userPreference.saveHistory !== false
      }
    } catch (error) {
      console.error('获取用户搜索偏好失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '获取用户搜索偏好失败'
      })
    }
  }

  // 更新用户搜索偏好
  async updateUserSearchPreferences(input: UpdateSearchPreferencesInput): Promise<void> {
    try {
      const { userId, preferences } = input

      const updateData: any = {}

      if (preferences.preferredCategories !== undefined) {
        updateData.preferredCategories = JSON.stringify(preferences.preferredCategories)
      }

      if (preferences.preferredAssetTypes !== undefined) {
        updateData.preferredAssetTypes = JSON.stringify(preferences.preferredAssetTypes)
      }

      if (preferences.defaultSort !== undefined) {
        updateData.defaultSort = preferences.defaultSort
      }

      if (preferences.defaultPageSize !== undefined) {
        updateData.defaultPageSize = preferences.defaultPageSize
      }

      if (preferences.showSuggestions !== undefined) {
        updateData.showSuggestions = preferences.showSuggestions
      }

      if (preferences.saveHistory !== undefined) {
        updateData.saveHistory = preferences.saveHistory
      }

      await prisma.userSearchPreference.upsert({
        where: { userId },
        update: updateData,
        create: {
          userId,
          ...updateData
        }
      })
    } catch (error) {
      console.error('更新用户搜索偏好失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '更新用户搜索偏好失败'
      })
    }
  }

  // 获取用户热门搜索词
  async getFrequentSearches(userId: string, limit: number = 10): Promise<Array<{query: string, count: number}>> {
    try {
      const userPreference = await prisma.userSearchPreference.findUnique({
        where: { userId },
        select: { frequentSearches: true }
      })

      if (!userPreference?.frequentSearches) {
        return []
      }

      const frequentSearches = userPreference.frequentSearches as Record<string, number>

      // 转换为数组并按频次排序
      return Object.entries(frequentSearches)
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
    } catch (error) {
      console.error('获取热门搜索词失败:', error)
      return []
    }
  }

  // 更新搜索频次统计
  async updateSearchFrequency(userId: string, query: string): Promise<void> {
    try {
      const userPreference = await prisma.userSearchPreference.findUnique({
        where: { userId },
        select: { frequentSearches: true }
      })

      const frequentSearches = userPreference?.frequentSearches as Record<string, number> || {}

      // 更新查询频次
      frequentSearches[query] = (frequentSearches[query] || 0) + 1

      // 只保留前20个高频搜索词
      const sortedEntries = Object.entries(frequentSearches)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 20)

      const updatedFrequentSearches = Object.fromEntries(sortedEntries)

      await prisma.userSearchPreference.upsert({
        where: { userId },
        update: { frequentSearches: updatedFrequentSearches },
        create: {
          userId,
          frequentSearches: updatedFrequentSearches
        }
      })
    } catch (error) {
      console.error('更新搜索频次失败:', error)
      // 不抛出错误，避免影响搜索功能
    }
  }

  // 记录详细搜索行为（私有方法）
  private async logSearchAction(data: {
    userId?: string
    sessionId: string
    query: string
    resultCount: number
    searchType: string
    action: string
    selectedAssetId?: string
    clickPosition?: number
    ipAddress?: string
    userAgent?: string
    referer?: string
  }): Promise<void> {
    try {
      await prisma.searchLog.create({
        data: {
          userId: data.userId,
          sessionId: data.sessionId,
          query: data.query,
          resultCount: data.resultCount,
          searchType: data.searchType,
          action: data.action,
          selectedAssetId: data.selectedAssetId,
          clickPosition: data.clickPosition,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          referer: data.referer
        }
      })
    } catch (error) {
      console.error('记录搜索行为失败:', error)
      // 不抛出错误，避免影响主要功能
    }
  }

  // 获取搜索分析数据（管理员功能）
  async getSearchAnalytics(options: {
    startDate?: Date
    endDate?: Date
    limit?: number
  } = {}): Promise<{
    totalSearches: number
    topQueries: Array<{query: string, count: number}>
    searchTrends: Array<{date: string, count: number}>
  }> {
    try {
      const { startDate, endDate, limit = 10 } = options

      const where: any = {}
      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt.gte = startDate
        if (endDate) where.createdAt.lte = endDate
      }

      // 获取总搜索次数
      const totalSearches = await prisma.searchLog.count({ where })

      // 获取热门查询词
      const queryStats = await prisma.searchLog.groupBy({
        by: ['query'],
        where,
        _count: { query: true },
        orderBy: { _count: { query: 'desc' } },
        take: limit
      })

      const topQueries = queryStats.map(stat => ({
        query: stat.query,
        count: stat._count.query
      }))

      // 获取搜索趋势（按天统计）
      const trendStats = await prisma.searchLog.groupBy({
        by: ['createdAt'],
        where,
        _count: { createdAt: true },
        orderBy: { createdAt: 'asc' }
      })

      // 按日期聚合
      const dailyTrends = new Map<string, number>()
      trendStats.forEach(stat => {
        const date = new Date(stat.createdAt).toISOString().split('T')[0]
        dailyTrends.set(date, (dailyTrends.get(date) || 0) + stat._count.createdAt)
      })

      const searchTrends = Array.from(dailyTrends.entries()).map(([date, count]) => ({
        date,
        count
      }))

      return {
        totalSearches,
        topQueries,
        searchTrends
      }
    } catch (error) {
      console.error('获取搜索分析数据失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '获取搜索分析数据失败'
      })
    }
  }
}

export const searchHistoryService = new SearchHistoryService()