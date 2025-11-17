/**
 * 申请分析服务
 * Story 5.5: 申请记录管理
 *
 * 提供申请数据的统计分析和趋势分析功能
 */

import {
  ApplicationMetrics,
  ApplicationStatistics,
  TrendPoint,
  AssetPopularity,
  UserActivity,
  ApplicationStatus,
  ApplicationFilters
} from '@/types/applicationManagement'

/**
 * 申请分析服务
 */
export class ApplicationAnalyticsService {
  /**
   * 获取申请统计指标
   */
  static async getApplicationMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<ApplicationMetrics> {
    // TODO: 集成Prisma后实现数据库查询
    // const applications = await db.applications.findMany({
    //   where: {
    //     createdAt: { gte: startDate, lte: endDate }
    //   },
    //   select: {
    //     status: true,
    //     processingTime: true,
    //     createdAt: true,
    //     approvedAt: true
    //   }
    // })

    // 模拟数据计算
    const totalApplications = 150
    const approvedCount = 80
    const rejectedCount = 20
    const pendingCount = 30
    const processingCount = 15
    const completedCount = 5

    const approvalRate = (approvedCount / (approvedCount + rejectedCount)) * 100
    const avgProcessingTime = 2.5 // 小时
    const medianProcessingTime = 2.0 // 小时

    // 计算环比数据(与上个周期对比)
    const periodComparison = {
      applicationsChange: 15.5,      // 增长15.5%
      approvalRateChange: 2.3,       // 通过率提升2.3个百分点
      processingTimeChange: -10.2    // 处理时长减少10.2%
    }

    return {
      totalApplications,
      approvedCount,
      rejectedCount,
      pendingCount,
      processingCount,
      completedCount,
      approvalRate,
      avgProcessingTime,
      medianProcessingTime,
      periodComparison
    }
  }

  /**
   * 获取趋势数据
   */
  static async getTrendData(
    startDate: Date,
    endDate: Date,
    granularity: 'day' | 'week' | 'month' = 'day'
  ): Promise<TrendPoint[]> {
    // TODO: 集成Prisma后实现数据库查询
    // const trendData = await db.$queryRaw`
    //   SELECT
    //     DATE_TRUNC(${granularity}, created_at) as date,
    //     COUNT(*) as total_applications,
    //     COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
    //     COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
    //     COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    //     AVG(processing_time) as avg_processing_time
    //   FROM applications
    //   WHERE created_at BETWEEN ${startDate} AND ${endDate}
    //   GROUP BY DATE_TRUNC(${granularity}, created_at)
    //   ORDER BY date ASC
    // `

    // 模拟7天的趋势数据
    const trendData: TrendPoint[] = []
    const days = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24))

    for (let i = 0; i <= Math.min(days, 30); i++) {
      const date = new Date(startDate.getTime() + i * 24 * 3600 * 1000)
      trendData.push({
        date: date.toISOString().split('T')[0],
        timestamp: date,
        totalApplications: Math.floor(Math.random() * 20) + 5,
        approvedCount: Math.floor(Math.random() * 10) + 3,
        rejectedCount: Math.floor(Math.random() * 3),
        pendingCount: Math.floor(Math.random() * 5) + 2,
        avgProcessingTime: Math.random() * 2 + 1
      })
    }

    return trendData
  }

  /**
   * 获取热门资产排行
   */
  static async getTopAssets(
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<AssetPopularity[]> {
    // TODO: 集成Prisma后实现数据库查询
    // const topAssets = await db.applications.groupBy({
    //   by: ['assetId'],
    //   where: {
    //     createdAt: { gte: startDate, lte: endDate }
    //   },
    //   _count: { assetId: true },
    //   _avg: { processingTime: true },
    //   orderBy: { _count: { assetId: 'desc' } },
    //   take: limit
    // })

    // 模拟热门资产数据
    const mockAssets: AssetPopularity[] = [
      {
        assetId: 'asset-1',
        assetName: '用户行为数据表',
        assetCategory: '数据表',
        applicationCount: 45,
        approvedCount: 38,
        rejectedCount: 5,
        uniqueUsers: 25,
        approvalRate: 88.4,
        avgProcessingTime: 2.1,
        trendDirection: 'up'
      },
      {
        assetId: 'asset-2',
        assetName: '交易数据接口',
        assetCategory: '数据接口',
        applicationCount: 32,
        approvedCount: 28,
        rejectedCount: 3,
        uniqueUsers: 18,
        approvalRate: 90.3,
        avgProcessingTime: 1.8,
        trendDirection: 'stable'
      },
      {
        assetId: 'asset-3',
        assetName: '商品库存数据',
        assetCategory: '数据表',
        applicationCount: 28,
        approvedCount: 20,
        rejectedCount: 6,
        uniqueUsers: 15,
        approvalRate: 76.9,
        avgProcessingTime: 3.2,
        trendDirection: 'down'
      },
      {
        assetId: 'asset-4',
        assetName: '订单明细表',
        assetCategory: '数据表',
        applicationCount: 25,
        approvedCount: 22,
        rejectedCount: 2,
        uniqueUsers: 12,
        approvalRate: 91.7,
        avgProcessingTime: 1.5,
        trendDirection: 'up'
      },
      {
        assetId: 'asset-5',
        assetName: '用户画像数据',
        assetCategory: '数据文件',
        applicationCount: 20,
        approvedCount: 16,
        rejectedCount: 3,
        uniqueUsers: 10,
        approvalRate: 84.2,
        avgProcessingTime: 2.8,
        trendDirection: 'stable'
      }
    ]

    return mockAssets.slice(0, limit)
  }

  /**
   * 获取活跃用户排行
   */
  static async getActiveUsers(
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<UserActivity[]> {
    // TODO: 集成Prisma后实现数据库查询
    // const activeUsers = await db.applications.groupBy({
    //   by: ['userId'],
    //   where: {
    //     createdAt: { gte: startDate, lte: endDate }
    //   },
    //   _count: { userId: true },
    //   orderBy: { _count: { userId: 'desc' } },
    //   take: limit
    // })

    // 模拟活跃用户数据
    const mockUsers: UserActivity[] = [
      {
        userId: 'user-1',
        userName: '张三',
        userEmail: 'zhangsan@example.com',
        totalApplications: 15,
        approvedCount: 12,
        rejectedCount: 2,
        approvalRate: 85.7,
        lastApplicationDate: new Date(Date.now() - 3600000),
        favoriteAssets: ['asset-1', 'asset-2', 'asset-3']
      },
      {
        userId: 'user-2',
        userName: '李四',
        userEmail: 'lisi@example.com',
        totalApplications: 12,
        approvedCount: 10,
        rejectedCount: 1,
        approvalRate: 90.9,
        lastApplicationDate: new Date(Date.now() - 7200000),
        favoriteAssets: ['asset-2', 'asset-4']
      },
      {
        userId: 'user-3',
        userName: '王五',
        userEmail: 'wangwu@example.com',
        totalApplications: 10,
        approvedCount: 8,
        rejectedCount: 2,
        approvalRate: 80.0,
        lastApplicationDate: new Date(Date.now() - 10800000),
        favoriteAssets: ['asset-1', 'asset-5']
      },
      {
        userId: 'user-4',
        userName: '赵六',
        userEmail: 'zhaoliu@example.com',
        totalApplications: 8,
        approvedCount: 7,
        rejectedCount: 1,
        approvalRate: 87.5,
        lastApplicationDate: new Date(Date.now() - 14400000),
        favoriteAssets: ['asset-3']
      },
      {
        userId: 'user-5',
        userName: '钱七',
        userEmail: 'qianqi@example.com',
        totalApplications: 7,
        approvedCount: 6,
        rejectedCount: 1,
        approvalRate: 85.7,
        lastApplicationDate: new Date(Date.now() - 18000000),
        favoriteAssets: ['asset-4', 'asset-5']
      }
    ]

    return mockUsers.slice(0, limit)
  }

  /**
   * 获取完整统计数据
   */
  static async getApplicationStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<ApplicationStatistics> {
    const [metrics, trendData, topAssets, activeUsers] = await Promise.all([
      this.getApplicationMetrics(startDate, endDate),
      this.getTrendData(startDate, endDate),
      this.getTopAssets(startDate, endDate),
      this.getActiveUsers(startDate, endDate)
    ])

    // 状态分布
    const statusDistribution: Record<ApplicationStatus, number> = {
      [ApplicationStatus.DRAFT]: 5,
      [ApplicationStatus.PENDING]: metrics.pendingCount,
      [ApplicationStatus.APPROVED]: metrics.approvedCount,
      [ApplicationStatus.REJECTED]: metrics.rejectedCount,
      [ApplicationStatus.PROCESSING]: metrics.processingCount,
      [ApplicationStatus.COMPLETED]: metrics.completedCount,
      [ApplicationStatus.CANCELLED]: 3
    }

    // 分类分布
    const categoryDistribution: Record<string, number> = {
      '数据表': 85,
      '数据接口': 45,
      '数据文件': 20
    }

    return {
      metrics,
      trendData,
      topAssets,
      activeUsers,
      statusDistribution,
      categoryDistribution,
      timeRange: {
        start: startDate,
        end: endDate
      }
    }
  }

  /**
   * 计算申请通过率
   */
  static calculateApprovalRate(approvedCount: number, totalCount: number): number {
    if (totalCount === 0) return 0
    return Math.round((approvedCount / totalCount) * 1000) / 10 // 保留1位小数
  }

  /**
   * 计算平均处理时间
   */
  static calculateAvgProcessingTime(processingTimes: number[]): number {
    if (processingTimes.length === 0) return 0
    const sum = processingTimes.reduce((acc, time) => acc + time, 0)
    return Math.round((sum / processingTimes.length) * 10) / 10 // 保留1位小数
  }

  /**
   * 计算中位处理时间
   */
  static calculateMedianProcessingTime(processingTimes: number[]): number {
    if (processingTimes.length === 0) return 0

    const sorted = [...processingTimes].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2
    } else {
      return sorted[mid]
    }
  }

  /**
   * 分析趋势方向
   */
  static analyzeTrendDirection(
    currentValue: number,
    previousValue: number
  ): 'up' | 'down' | 'stable' {
    const changeRate = ((currentValue - previousValue) / previousValue) * 100

    if (changeRate > 10) return 'up'
    if (changeRate < -10) return 'down'
    return 'stable'
  }

  /**
   * 生成业务洞察
   */
  static generateInsights(statistics: ApplicationStatistics): string[] {
    const insights: string[] = []

    // 通过率洞察
    if (statistics.metrics.approvalRate > 90) {
      insights.push('✅ 申请通过率较高,资产申请流程运转良好')
    } else if (statistics.metrics.approvalRate < 70) {
      insights.push('⚠️ 申请通过率偏低,建议优化申请流程或资产说明')
    }

    // 处理时间洞察
    if (statistics.metrics.avgProcessingTime < 2) {
      insights.push('⚡ 平均处理时间较短,响应效率高')
    } else if (statistics.metrics.avgProcessingTime > 5) {
      insights.push('🐌 平均处理时间较长,建议增加审核人员或优化流程')
    }

    // 待处理数量洞察
    if (statistics.metrics.pendingCount > 50) {
      insights.push('📋 待处理申请数量较多,请及时处理')
    }

    // 趋势洞察
    if (statistics.metrics.periodComparison) {
      const change = statistics.metrics.periodComparison.applicationsChange
      if (change > 20) {
        insights.push('📈 申请数量大幅增长,资产热度上升')
      } else if (change < -20) {
        insights.push('📉 申请数量明显下降,需关注资产使用情况')
      }
    }

    // 热门资产洞察
    if (statistics.topAssets.length > 0) {
      const topAsset = statistics.topAssets[0]
      insights.push(`🔥 最热门资产: ${topAsset.assetName} (${topAsset.applicationCount}次申请)`)
    }

    return insights
  }

  /**
   * 导出统计报告
   */
  static async exportStatisticsReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    summary: string
    statistics: ApplicationStatistics
    insights: string[]
  }> {
    const statistics = await this.getApplicationStatistics(startDate, endDate)
    const insights = this.generateInsights(statistics)

    const summary = `
申请统计报告
=============
时间范围: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}

核心指标:
- 总申请数: ${statistics.metrics.totalApplications}
- 批准数: ${statistics.metrics.approvedCount}
- 拒绝数: ${statistics.metrics.rejectedCount}
- 待处理数: ${statistics.metrics.pendingCount}
- 通过率: ${statistics.metrics.approvalRate}%
- 平均处理时长: ${statistics.metrics.avgProcessingTime}小时

热门资产TOP3:
${statistics.topAssets.slice(0, 3).map((asset, i) =>
  `${i + 1}. ${asset.assetName} - ${asset.applicationCount}次申请`
).join('\n')}

活跃用户TOP3:
${statistics.activeUsers.slice(0, 3).map((user, i) =>
  `${i + 1}. ${user.userName} - ${user.totalApplications}次申请`
).join('\n')}
    `.trim()

    return {
      summary,
      statistics,
      insights
    }
  }
}
