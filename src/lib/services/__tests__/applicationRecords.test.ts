/**
 * 申请记录服务测试
 * Story 5.5: 申请记录管理
 *
 * 测试申请记录查询和筛选功能
 */

import { describe, it, expect } from '@jest/globals'
import { ApplicationRecordsService } from '../applicationRecords'
import { ApplicationStatus, ApplicationFilters } from '@/types/applicationManagement'

describe('ApplicationRecordsService', () => {
  describe('buildWhereClause', () => {
    it('应该正确构建日期范围过滤条件', () => {
      const filters: ApplicationFilters = {
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31')
        }
      }

      const whereClause = ApplicationRecordsService.buildWhereClause(filters)

      expect(whereClause.createdAt).toBeDefined()
      expect((whereClause.createdAt as Record<string, Date>).gte).toEqual(filters.dateRange!.start)
      expect((whereClause.createdAt as Record<string, Date>).lte).toEqual(filters.dateRange!.end)
    })

    it('应该正确构建状态过滤条件', () => {
      const filters: ApplicationFilters = {
        status: [ApplicationStatus.PENDING, ApplicationStatus.APPROVED]
      }

      const whereClause = ApplicationRecordsService.buildWhereClause(filters)

      expect(whereClause.status).toBeDefined()
      expect((whereClause.status as Record<string, ApplicationStatus[]>).in).toEqual(filters.status)
    })

    it('应该正确构建资产ID过滤条件', () => {
      const filters: ApplicationFilters = {
        assetIds: ['asset-1', 'asset-2']
      }

      const whereClause = ApplicationRecordsService.buildWhereClause(filters)

      expect(whereClause.assetId).toBeDefined()
      expect((whereClause.assetId as Record<string, string[]>).in).toEqual(filters.assetIds)
    })

    it('应该正确构建搜索查询条件', () => {
      const filters: ApplicationFilters = {
        searchQuery: 'test'
      }

      const whereClause = ApplicationRecordsService.buildWhereClause(filters)

      expect(whereClause.OR).toBeDefined()
      expect(Array.isArray(whereClause.OR)).toBe(true)
      expect((whereClause.OR as unknown[]).length).toBeGreaterThan(0)
    })

    it('空筛选条件应该返回空对象', () => {
      const filters: ApplicationFilters = {}

      const whereClause = ApplicationRecordsService.buildWhereClause(filters)

      expect(Object.keys(whereClause)).toHaveLength(0)
    })
  })

  describe('buildOrderByClause', () => {
    it('应该使用默认排序(createdAt desc)', () => {
      const filters: ApplicationFilters = {}

      const orderBy = ApplicationRecordsService.buildOrderByClause(filters)

      expect(orderBy.createdAt).toBe('desc')
    })

    it('应该正确应用自定义排序', () => {
      const filters: ApplicationFilters = {
        sortBy: 'updatedAt',
        sortOrder: 'asc'
      }

      const orderBy = ApplicationRecordsService.buildOrderByClause(filters)

      expect(orderBy.updatedAt).toBe('asc')
    })
  })

  describe('getApplicationRecords', () => {
    it('应该返回分页结果', async () => {
      const filters: ApplicationFilters = {}
      const result = await ApplicationRecordsService.getApplicationRecords(filters, 1, 20)

      expect(result).toHaveProperty('records')
      expect(result).toHaveProperty('total')
      expect(result).toHaveProperty('page')
      expect(result).toHaveProperty('pageSize')
      expect(result).toHaveProperty('hasMore')
      expect(Array.isArray(result.records)).toBe(true)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(20)
    })

    it('记录应该包含必要字段', async () => {
      const result = await ApplicationRecordsService.getApplicationRecords({}, 1, 1)

      if (result.records.length > 0) {
        const record = result.records[0]
        expect(record).toHaveProperty('id')
        expect(record).toHaveProperty('applicationId')
        expect(record).toHaveProperty('assetName')
        expect(record).toHaveProperty('userName')
        expect(record).toHaveProperty('status')
        expect(record).toHaveProperty('createdAt')
      }
    })
  })

  describe('validateFilters', () => {
    it('应该验证日期范围', () => {
      const filters: ApplicationFilters = {
        dateRange: {
          start: new Date('2024-12-31'),
          end: new Date('2024-01-01')  // 结束日期早于开始日期
        }
      }

      const result = ApplicationRecordsService.validateFilters(filters)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('开始日期不能晚于结束日期')
    })

    it('应该验证搜索关键词长度', () => {
      const filters: ApplicationFilters = {
        searchQuery: 'a'  // 只有1个字符
      }

      const result = ApplicationRecordsService.validateFilters(filters)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('搜索关键词至少需要2个字符')
    })

    it('应该验证日期范围不超过365天', () => {
      const filters: ApplicationFilters = {
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2024-12-31')  // 超过365天
        }
      }

      const result = ApplicationRecordsService.validateFilters(filters)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('日期范围不能超过365天')
    })

    it('有效的筛选条件应该通过验证', () => {
      const filters: ApplicationFilters = {
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-03-31')
        },
        searchQuery: 'test',
        status: [ApplicationStatus.PENDING]
      }

      const result = ApplicationRecordsService.validateFilters(filters)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('getFilterStatistics', () => {
    it('应该返回统计信息', async () => {
      const filters: ApplicationFilters = {}

      const stats = await ApplicationRecordsService.getFilterStatistics(filters)

      expect(stats).toHaveProperty('totalMatched')
      expect(stats).toHaveProperty('statusCounts')
      expect(stats).toHaveProperty('categoryCounts')
      expect(typeof stats.totalMatched).toBe('number')
      expect(typeof stats.statusCounts).toBe('object')
      expect(typeof stats.categoryCounts).toBe('object')
    })

    it('状态统计应该包含所有状态', async () => {
      const filters: ApplicationFilters = {}

      const stats = await ApplicationRecordsService.getFilterStatistics(filters)

      expect(stats.statusCounts).toHaveProperty(ApplicationStatus.PENDING)
      expect(stats.statusCounts).toHaveProperty(ApplicationStatus.APPROVED)
      expect(stats.statusCounts).toHaveProperty(ApplicationStatus.REJECTED)
    })
  })
})
