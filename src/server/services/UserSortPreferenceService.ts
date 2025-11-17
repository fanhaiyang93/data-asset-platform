import { redis } from '@/lib/cache'
import { prisma } from '@/lib/prisma'
import {
  type UserSortPreferences,
  type SortOption,
  type ScoringWeights,
  ScoringWeightsSchema
} from '@/types/search'
import { TRPCError } from '@trpc/server'

/**
 * UserSortPreferenceService - 用户排序偏好管理服务
 *
 * 功能：
 * 1. 用户排序偏好的存储和管理
 * 2. 自定义排序权重配置
 * 3. 保存的排序方案管理
 * 4. 排序历史记录和分析
 * 5. 个性化排序推荐
 */
export class UserSortPreferenceService {
  private cachePrefix = 'user_sort_prefs:'
  private cacheTtl = 86400 // 24小时缓存

  /**
   * 获取用户排序偏好
   */
  async getUserSortPreferences(userId: string): Promise<UserSortPreferences> {
    try {
      const cacheKey = `${this.cachePrefix}${userId}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      // 从数据库获取或创建默认偏好
      const preferences = await this.loadOrCreatePreferences(userId)

      // 缓存偏好设置
      await redis.setex(cacheKey, this.cacheTtl, JSON.stringify(preferences))

      return preferences
    } catch (error) {
      console.error('获取用户排序偏好失败:', error)
      return this.getDefaultPreferences(userId)
    }
  }

  /**
   * 更新用户默认排序方式
   */
  async updateDefaultSort(userId: string, defaultSort: SortOption): Promise<void> {
    try {
      const preferences = await this.getUserSortPreferences(userId)
      preferences.defaultSort = defaultSort
      preferences.lastUsedSort = defaultSort

      // 更新使用频率
      preferences.sortFrequency[defaultSort] = (preferences.sortFrequency[defaultSort] || 0) + 1

      await this.savePreferences(userId, preferences)

      console.log(`用户 ${userId} 默认排序已更新为: ${defaultSort}`)
    } catch (error) {
      console.error('更新默认排序失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '更新排序偏好失败'
      })
    }
  }

  /**
   * 保存自定义排序方案
   */
  async saveSortConfiguration(
    userId: string,
    name: string,
    sort: SortOption,
    weights?: ScoringWeights
  ): Promise<void> {
    try {
      // 验证权重配置
      if (weights && !this.validateWeights(weights)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '权重配置无效，总和必须等于1.0'
        })
      }

      const preferences = await this.getUserSortPreferences(userId)

      // 检查是否已存在同名配置
      const existingIndex = preferences.savedSorts.findIndex(s => s.name === name)

      const sortConfig = {
        name,
        sort,
        weights,
        createdAt: new Date()
      }

      if (existingIndex >= 0) {
        // 更新现有配置
        preferences.savedSorts[existingIndex] = sortConfig
      } else {
        // 添加新配置
        preferences.savedSorts.push(sortConfig)

        // 限制保存的配置数量（最多10个）
        if (preferences.savedSorts.length > 10) {
          preferences.savedSorts = preferences.savedSorts
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 10)
        }
      }

      await this.savePreferences(userId, preferences)

      console.log(`用户 ${userId} 排序配置 "${name}" 已保存`)
    } catch (error) {
      console.error('保存排序配置失败:', error)
      throw error instanceof TRPCError ? error : new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '保存排序配置失败'
      })
    }
  }

  /**
   * 删除已保存的排序方案
   */
  async deleteSortConfiguration(userId: string, name: string): Promise<void> {
    try {
      const preferences = await this.getUserSortPreferences(userId)

      const initialLength = preferences.savedSorts.length
      preferences.savedSorts = preferences.savedSorts.filter(s => s.name !== name)

      if (preferences.savedSorts.length === initialLength) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '排序配置不存在'
        })
      }

      await this.savePreferences(userId, preferences)

      console.log(`用户 ${userId} 排序配置 "${name}" 已删除`)
    } catch (error) {
      console.error('删除排序配置失败:', error)
      throw error instanceof TRPCError ? error : new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '删除排序配置失败'
      })
    }
  }

  /**
   * 记录排序使用情况
   */
  async recordSortUsage(userId: string, sortMethod: SortOption): Promise<void> {
    try {
      const preferences = await this.getUserSortPreferences(userId)

      // 更新使用频率
      preferences.sortFrequency[sortMethod] = (preferences.sortFrequency[sortMethod] || 0) + 1
      preferences.lastUsedSort = sortMethod

      await this.savePreferences(userId, preferences)

      console.log(`用户 ${userId} 排序使用记录已更新: ${sortMethod}`)
    } catch (error) {
      console.error('记录排序使用情况失败:', error)
    }
  }

  /**
   * 获取排序使用统计
   */
  async getSortUsageStats(userId: string): Promise<{
    totalUsage: number
    mostUsedSort: SortOption
    usageDistribution: Array<{
      sort: SortOption
      count: number
      percentage: number
    }>
    lastUsedSort?: SortOption
    trends: Array<{
      sort: SortOption
      trend: 'increasing' | 'decreasing' | 'stable'
      changeRate: number
    }>
  }> {
    try {
      const preferences = await this.getUserSortPreferences(userId)

      const totalUsage = Object.values(preferences.sortFrequency).reduce((sum, count) => sum + count, 0)

      if (totalUsage === 0) {
        return {
          totalUsage: 0,
          mostUsedSort: 'relevance',
          usageDistribution: [],
          trends: []
        }
      }

      // 计算使用分布
      const usageDistribution = Object.entries(preferences.sortFrequency)
        .map(([sort, count]) => ({
          sort: sort as SortOption,
          count,
          percentage: (count / totalUsage) * 100
        }))
        .sort((a, b) => b.count - a.count)

      // 找出最常用的排序方式
      const mostUsedSort = usageDistribution[0]?.sort || 'relevance'

      // 简化的趋势分析（实际应用中可以基于时间序列数据）
      const trends = usageDistribution.map(item => ({
        sort: item.sort,
        trend: item.percentage > 20 ? 'increasing' :
               item.percentage < 5 ? 'decreasing' : 'stable' as 'increasing' | 'decreasing' | 'stable',
        changeRate: Math.random() * 20 - 10 // 模拟变化率
      }))

      return {
        totalUsage,
        mostUsedSort,
        usageDistribution,
        lastUsedSort: preferences.lastUsedSort,
        trends
      }
    } catch (error) {
      console.error('获取排序使用统计失败:', error)
      return {
        totalUsage: 0,
        mostUsedSort: 'relevance',
        usageDistribution: [],
        trends: []
      }
    }
  }

  /**
   * 推荐排序配置
   */
  async recommendSortConfiguration(userId: string): Promise<{
    recommendedSort: SortOption
    reason: string
    confidence: number
    alternativeOptions: Array<{
      sort: SortOption
      reason: string
      score: number
    }>
  }> {
    try {
      const preferences = await this.getUserSortPreferences(userId)
      const stats = await this.getSortUsageStats(userId)

      // 基于使用统计推荐
      if (stats.totalUsage > 10) {
        const topUsed = stats.usageDistribution[0]
        if (topUsed && topUsed.percentage > 40) {
          return {
            recommendedSort: topUsed.sort,
            reason: `基于您的使用习惯，您${topUsed.percentage.toFixed(1)}%的时间使用此排序方式`,
            confidence: Math.min(topUsed.percentage / 100, 0.9),
            alternativeOptions: stats.usageDistribution.slice(1, 3).map(item => ({
              sort: item.sort,
              reason: `使用频率${item.percentage.toFixed(1)}%`,
              score: item.percentage / 100
            }))
          }
        }
      }

      // 基于最近使用推荐
      if (preferences.lastUsedSort && preferences.lastUsedSort !== 'relevance') {
        return {
          recommendedSort: preferences.lastUsedSort,
          reason: '基于您最近的使用偏好',
          confidence: 0.7,
          alternativeOptions: [
            {
              sort: 'relevance',
              reason: '通用相关性排序',
              score: 0.8
            },
            {
              sort: 'popularity',
              reason: '热门资产优先',
              score: 0.6
            }
          ]
        }
      }

      // 默认推荐
      return {
        recommendedSort: 'relevance',
        reason: '推荐相关性排序，适合大多数搜索场景',
        confidence: 0.6,
        alternativeOptions: [
          {
            sort: 'popularity',
            reason: '发现热门资产',
            score: 0.7
          },
          {
            sort: 'personalized',
            reason: '个性化推荐',
            score: 0.8
          }
        ]
      }
    } catch (error) {
      console.error('推荐排序配置失败:', error)
      return {
        recommendedSort: 'relevance',
        reason: '默认推荐',
        confidence: 0.5,
        alternativeOptions: []
      }
    }
  }

  /**
   * 批量导入排序偏好
   */
  async importSortPreferences(
    userId: string,
    preferences: Partial<UserSortPreferences>
  ): Promise<void> {
    try {
      const currentPrefs = await this.getUserSortPreferences(userId)

      // 合并偏好设置
      const updatedPrefs: UserSortPreferences = {
        ...currentPrefs,
        ...preferences,
        userId, // 确保用户ID正确
        savedSorts: preferences.savedSorts || currentPrefs.savedSorts,
        sortFrequency: {
          ...currentPrefs.sortFrequency,
          ...(preferences.sortFrequency || {})
        }
      }

      // 验证保存的排序配置
      if (updatedPrefs.savedSorts) {
        for (const sortConfig of updatedPrefs.savedSorts) {
          if (sortConfig.weights && !this.validateWeights(sortConfig.weights)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `排序配置 "${sortConfig.name}" 的权重配置无效`
            })
          }
        }
      }

      await this.savePreferences(userId, updatedPrefs)

      console.log(`用户 ${userId} 排序偏好批量导入完成`)
    } catch (error) {
      console.error('批量导入排序偏好失败:', error)
      throw error instanceof TRPCError ? error : new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '导入排序偏好失败'
      })
    }
  }

  /**
   * 导出用户排序偏好
   */
  async exportSortPreferences(userId: string): Promise<UserSortPreferences> {
    try {
      return await this.getUserSortPreferences(userId)
    } catch (error) {
      console.error('导出排序偏好失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '导出排序偏好失败'
      })
    }
  }

  /**
   * 重置用户排序偏好
   */
  async resetSortPreferences(userId: string): Promise<void> {
    try {
      const defaultPrefs = this.getDefaultPreferences(userId)
      await this.savePreferences(userId, defaultPrefs)

      console.log(`用户 ${userId} 排序偏好已重置`)
    } catch (error) {
      console.error('重置排序偏好失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '重置排序偏好失败'
      })
    }
  }

  /**
   * 从数据库加载或创建偏好设置
   */
  private async loadOrCreatePreferences(userId: string): Promise<UserSortPreferences> {
    try {
      // 这里可以从数据库查询用户偏好
      // 目前返回默认偏好，实际应用中应该从数据库获取
      return this.getDefaultPreferences(userId)
    } catch (error) {
      console.error('加载用户偏好失败:', error)
      return this.getDefaultPreferences(userId)
    }
  }

  /**
   * 保存偏好设置
   */
  private async savePreferences(userId: string, preferences: UserSortPreferences): Promise<void> {
    try {
      const cacheKey = `${this.cachePrefix}${userId}`
      await redis.setex(cacheKey, this.cacheTtl, JSON.stringify(preferences))

      // 这里可以异步保存到数据库
      // await prisma.userSortPreferences.upsert({
      //   where: { userId },
      //   update: { preferences: JSON.stringify(preferences) },
      //   create: { userId, preferences: JSON.stringify(preferences) }
      // })
    } catch (error) {
      console.error('保存用户偏好失败:', error)
      throw error
    }
  }

  /**
   * 获取默认偏好设置
   */
  private getDefaultPreferences(userId: string): UserSortPreferences {
    return {
      userId,
      defaultSort: 'relevance',
      savedSorts: [],
      sortFrequency: {
        relevance: 1,
        popularity: 0,
        recency: 0,
        created: 0,
        quality: 0,
        personalized: 0
      }
    }
  }

  /**
   * 验证权重配置
   */
  private validateWeights(weights: ScoringWeights): boolean {
    try {
      ScoringWeightsSchema.parse(weights)
      return true
    } catch {
      return false
    }
  }

  /**
   * 清除用户偏好缓存
   */
  async clearPreferencesCache(userId: string): Promise<void> {
    try {
      const cacheKey = `${this.cachePrefix}${userId}`
      await redis.del(cacheKey)
      console.log(`用户 ${userId} 排序偏好缓存已清除`)
    } catch (error) {
      console.error('清除偏好缓存失败:', error)
    }
  }

  /**
   * 获取所有用户的偏好统计
   */
  async getGlobalSortPreferenceStats(): Promise<{
    totalUsers: number
    sortPopularity: Record<SortOption, number>
    averageConfigurationsPerUser: number
    mostPopularSort: SortOption
  }> {
    try {
      // 这里应该从数据库统计所有用户的偏好
      // 目前返回模拟数据
      return {
        totalUsers: 100,
        sortPopularity: {
          relevance: 45,
          popularity: 25,
          recency: 15,
          quality: 8,
          created: 4,
          personalized: 3
        },
        averageConfigurationsPerUser: 2.3,
        mostPopularSort: 'relevance'
      }
    } catch (error) {
      console.error('获取全局偏好统计失败:', error)
      return {
        totalUsers: 0,
        sortPopularity: {
          relevance: 0,
          popularity: 0,
          recency: 0,
          quality: 0,
          created: 0,
          personalized: 0
        },
        averageConfigurationsPerUser: 0,
        mostPopularSort: 'relevance'
      }
    }
  }
}

export const userSortPreferenceService = new UserSortPreferenceService()