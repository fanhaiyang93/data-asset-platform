/**
 * 申请分析服务测试
 * Story 5.5: 申请记录管理
 *
 * 测试申请数据统计和分析功能
 */

import { describe, it, expect } from '@jest/globals'
import { ApplicationAnalyticsService } from '../applicationAnalytics'

describe('ApplicationAnalyticsService', () => {
  describe('getApplicationMetrics', () => {
    it('应该返回统计指标', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-12-31')

      const metrics = await ApplicationAnalyticsService.getApplicationMetrics(startDate, endDate)

      expect(metrics).toHaveProperty('totalApplications')
      expect(metrics).toHaveProperty('approvedCount')
      expect(metrics).toHaveProperty('rejectedCount')
      expect(metrics).toHaveProperty('pendingCount')
      expect(metrics).toHaveProperty('approvalRate')
      expect(metrics).toHaveProperty('avgProcessingTime')
      expect(metrics).toHaveProperty('medianProcessingTime')
      expect(typeof metrics.totalApplications).toBe('number')
      expect(typeof metrics.approvalRate).toBe('number')
    })

    it('通过率应该在0-100之间', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-12-31')

      const metrics = await ApplicationAnalyticsService.getApplicationMetrics(startDate, endDate)

      expect(metrics.approvalRate).toBeGreaterThanOrEqual(0)
      expect(metrics.approvalRate).toBeLessThanOrEqual(100)
    })

    it('应该包含环比数据', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-12-31')

      const metrics = await ApplicationAnalyticsService.getApplicationMetrics(startDate, endDate)

      expect(metrics.periodComparison).toBeDefined()
      expect(metrics.periodComparison).toHaveProperty('applicationsChange')
      expect(metrics.periodComparison).toHaveProperty('approvalRateChange')
      expect(metrics.periodComparison).toHaveProperty('processingTimeChange')
    })
  })

  describe('getTrendData', () => {
    it('应该返回趋势数据点', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-07')

      const trendData = await ApplicationAnalyticsService.getTrendData(startDate, endDate)

      expect(Array.isArray(trendData)).toBe(true)
      expect(trendData.length).toBeGreaterThan(0)
    })

    it('趋势数据点应该包含必要字段', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-07')

      const trendData = await ApplicationAnalyticsService.getTrendData(startDate, endDate)
      const point = trendData[0]

      expect(point).toHaveProperty('date')
      expect(point).toHaveProperty('timestamp')
      expect(point).toHaveProperty('totalApplications')
      expect(point).toHaveProperty('approvedCount')
      expect(point).toHaveProperty('rejectedCount')
      expect(point).toHaveProperty('avgProcessingTime')
    })

    it('趋势数据应该按时间升序排列', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-07')

      const trendData = await ApplicationAnalyticsService.getTrendData(startDate, endDate)

      for (let i = 1; i < trendData.length; i++) {
        const prevTime = trendData[i - 1].timestamp.getTime()
        const currTime = trendData[i].timestamp.getTime()
        expect(currTime).toBeGreaterThanOrEqual(prevTime)
      }
    })
  })

  describe('getTopAssets', () => {
    it('应该返回热门资产列表', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-12-31')

      const topAssets = await ApplicationAnalyticsService.getTopAssets(startDate, endDate, 5)

      expect(Array.isArray(topAssets)).toBe(true)
      expect(topAssets.length).toBeLessThanOrEqual(5)
    })

    it('热门资产应该包含必要字段', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-12-31')

      const topAssets = await ApplicationAnalyticsService.getTopAssets(startDate, endDate, 1)

      if (topAssets.length > 0) {
        const asset = topAssets[0]
        expect(asset).toHaveProperty('assetId')
        expect(asset).toHaveProperty('assetName')
        expect(asset).toHaveProperty('applicationCount')
        expect(asset).toHaveProperty('approvalRate')
        expect(asset).toHaveProperty('trendDirection')
      }
    })

    it('热门资产应该按申请次数降序排列', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-12-31')

      const topAssets = await ApplicationAnalyticsService.getTopAssets(startDate, endDate, 10)

      for (let i = 1; i < topAssets.length; i++) {
        expect(topAssets[i - 1].applicationCount).toBeGreaterThanOrEqual(
          topAssets[i].applicationCount
        )
      }
    })
  })

  describe('getActiveUsers', () => {
    it('应该返回活跃用户列表', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-12-31')

      const activeUsers = await ApplicationAnalyticsService.getActiveUsers(startDate, endDate, 5)

      expect(Array.isArray(activeUsers)).toBe(true)
      expect(activeUsers.length).toBeLessThanOrEqual(5)
    })

    it('活跃用户应该包含必要字段', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-12-31')

      const activeUsers = await ApplicationAnalyticsService.getActiveUsers(startDate, endDate, 1)

      if (activeUsers.length > 0) {
        const user = activeUsers[0]
        expect(user).toHaveProperty('userId')
        expect(user).toHaveProperty('userName')
        expect(user).toHaveProperty('totalApplications')
        expect(user).toHaveProperty('approvalRate')
        expect(user).toHaveProperty('lastApplicationDate')
      }
    })
  })

  describe('calculateApprovalRate', () => {
    it('应该正确计算通过率', () => {
      const rate = ApplicationAnalyticsService.calculateApprovalRate(80, 100)
      expect(rate).toBe(80.0)
    })

    it('总数为0时应该返回0', () => {
      const rate = ApplicationAnalyticsService.calculateApprovalRate(0, 0)
      expect(rate).toBe(0)
    })

    it('应该保留1位小数', () => {
      const rate = ApplicationAnalyticsService.calculateApprovalRate(1, 3)
      expect(rate).toBe(33.3)
    })
  })

  describe('calculateAvgProcessingTime', () => {
    it('应该正确计算平均处理时间', () => {
      const times = [1.5, 2.0, 2.5, 3.0]
      const avg = ApplicationAnalyticsService.calculateAvgProcessingTime(times)
      expect(avg).toBe(2.3)  // (1.5+2.0+2.5+3.0)/4 = 2.25 ≈ 2.3
    })

    it('空数组应该返回0', () => {
      const avg = ApplicationAnalyticsService.calculateAvgProcessingTime([])
      expect(avg).toBe(0)
    })
  })

  describe('calculateMedianProcessingTime', () => {
    it('应该正确计算奇数个元素的中位数', () => {
      const times = [1.0, 2.0, 3.0]
      const median = ApplicationAnalyticsService.calculateMedianProcessingTime(times)
      expect(median).toBe(2.0)
    })

    it('应该正确计算偶数个元素的中位数', () => {
      const times = [1.0, 2.0, 3.0, 4.0]
      const median = ApplicationAnalyticsService.calculateMedianProcessingTime(times)
      expect(median).toBe(2.5)  // (2.0+3.0)/2
    })

    it('空数组应该返回0', () => {
      const median = ApplicationAnalyticsService.calculateMedianProcessingTime([])
      expect(median).toBe(0)
    })
  })

  describe('analyzeTrendDirection', () => {
    it('增长超过10%应该返回up', () => {
      const direction = ApplicationAnalyticsService.analyzeTrendDirection(120, 100)
      expect(direction).toBe('up')
    })

    it('下降超过10%应该返回down', () => {
      const direction = ApplicationAnalyticsService.analyzeTrendDirection(80, 100)
      expect(direction).toBe('down')
    })

    it('变化在±10%内应该返回stable', () => {
      const direction = ApplicationAnalyticsService.analyzeTrendDirection(105, 100)
      expect(direction).toBe('stable')
    })
  })

  describe('generateInsights', () => {
    it('应该生成业务洞察', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-12-31')
      const statistics = await ApplicationAnalyticsService.getApplicationStatistics(
        startDate,
        endDate
      )

      const insights = ApplicationAnalyticsService.generateInsights(statistics)

      expect(Array.isArray(insights)).toBe(true)
      expect(insights.length).toBeGreaterThan(0)
      insights.forEach(insight => {
        expect(typeof insight).toBe('string')
        expect(insight.length).toBeGreaterThan(0)
      })
    })
  })
})
