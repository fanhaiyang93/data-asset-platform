/**
 * 申请记录查询服务
 * Story 5.5: 申请记录管理
 *
 * 提供申请记录的查询、筛选和搜索功能
 */

import {
  ApplicationRecord,
  ApplicationFilters,
  ApplicationRecordsResult,
  ApplicationDetailInfo,
  ApplicationTimelineEvent,
  ApplicationStatus,
  BatchOperationResult
} from '@/types/applicationManagement'

/**
 * 申请记录查询服务
 */
export class ApplicationRecordsService {
  /**
   * 构建查询条件
   */
  static buildWhereClause(filters: ApplicationFilters): Record<string, unknown> {
    const where: Record<string, unknown> = {}

    // 日期范围筛选
    if (filters.dateRange) {
      where.createdAt = {
        gte: filters.dateRange.start,
        lte: filters.dateRange.end
      }
    }

    // 状态筛选
    if (filters.status && filters.status.length > 0) {
      where.status = {
        in: filters.status
      }
    }

    // 资产筛选
    if (filters.assetIds && filters.assetIds.length > 0) {
      where.assetId = {
        in: filters.assetIds
      }
    }

    // 资产分类筛选
    if (filters.assetCategories && filters.assetCategories.length > 0) {
      where.assetCategory = {
        in: filters.assetCategories
      }
    }

    // 用户筛选
    if (filters.userIds && filters.userIds.length > 0) {
      where.userId = {
        in: filters.userIds
      }
    }

    // 优先级筛选
    if (filters.priority && filters.priority.length > 0) {
      where.metadata = {
        path: ['priority'],
        in: filters.priority
      }
    }

    // 全文搜索
    if (filters.searchQuery) {
      const searchTerm = filters.searchQuery.toLowerCase()
      where.OR = [
        { applicationId: { contains: searchTerm, mode: 'insensitive' } },
        { assetName: { contains: searchTerm, mode: 'insensitive' } },
        { userName: { contains: searchTerm, mode: 'insensitive' } },
        { userEmail: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { businessPurpose: { contains: searchTerm, mode: 'insensitive' } }
      ]
    }

    return where
  }

  /**
   * 构建排序条件
   */
  static buildOrderByClause(filters: ApplicationFilters): Record<string, string> {
    const sortBy = filters.sortBy || 'createdAt'
    const sortOrder = filters.sortOrder || 'desc'

    return {
      [sortBy]: sortOrder
    }
  }

  /**
   * 查询申请记录(带分页)
   */
  static async getApplicationRecords(
    filters: ApplicationFilters,
    page: number = 1,
    pageSize: number = 20
  ): Promise<ApplicationRecordsResult> {
    // TODO: 集成Prisma后实现数据库查询
    // const whereClause = this.buildWhereClause(filters)
    // const orderByClause = this.buildOrderByClause(filters)
    // const skip = (page - 1) * pageSize

    // const [records, total] = await Promise.all([
    //   db.applications.findMany({
    //     where: whereClause,
    //     orderBy: orderByClause,
    //     skip,
    //     take: pageSize,
    //     include: {
    //       asset: { select: { name: true, category: true, description: true } },
    //       user: { select: { name: true, email: true } }
    //     }
    //   }),
    //   db.applications.count({ where: whereClause })
    // ])

    // 模拟数据
    const mockRecords: ApplicationRecord[] = Array.from({ length: pageSize }, (_, i) => ({
      id: `app-${page}-${i}`,
      applicationId: `APP${Date.now()}-${i}`,
      assetId: `asset-${i}`,
      assetName: `数据资产 ${i}`,
      assetCategory: i % 2 === 0 ? '数据表' : '数据接口',
      userId: `user-${i}`,
      userName: `用户${i}`,
      userEmail: `user${i}@example.com`,
      status: Object.values(ApplicationStatus)[i % 7] as ApplicationStatus,
      createdAt: new Date(Date.now() - i * 3600000),
      updatedAt: new Date(Date.now() - i * 1800000),
      description: `申请说明 ${i}`,
      businessPurpose: `业务用途 ${i}`,
      formData: {},
      processingTime: i % 2 === 0 ? 2.5 : undefined,
      metadata: {
        priority: ['low', 'medium', 'high'][i % 3] as 'low' | 'medium' | 'high',
        tags: ['tag1', 'tag2']
      }
    }))

    const total = 100 // 模拟总数

    return {
      records: mockRecords,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total
    }
  }

  /**
   * 获取申请详情
   */
  static async getApplicationDetail(applicationId: string): Promise<ApplicationDetailInfo> {
    // TODO: 集成Prisma后实现数据库查询
    // const application = await db.applications.findUnique({
    //   where: { id: applicationId },
    //   include: {
    //     asset: true,
    //     user: true,
    //     timeline: { orderBy: { timestamp: 'asc' } }
    //   }
    // })

    // 模拟数据
    const mockTimeline: ApplicationTimelineEvent[] = [
      {
        id: '1',
        timestamp: new Date(Date.now() - 10000000),
        type: 'created',
        title: '申请创建',
        description: '用户创建了申请',
        userId: 'user-1',
        userName: '张三'
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 9000000),
        type: 'submitted',
        title: '申请提交',
        description: '用户提交了申请',
        userId: 'user-1',
        userName: '张三'
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 8000000),
        type: 'processing',
        title: '开始处理',
        description: '管理员开始处理申请',
        userId: 'admin-1',
        userName: '管理员'
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 7000000),
        type: 'note_added',
        title: '添加备注',
        description: '需要补充业务说明',
        userId: 'admin-1',
        userName: '管理员'
      },
      {
        id: '5',
        timestamp: new Date(Date.now() - 6000000),
        type: 'approved',
        title: '申请批准',
        description: '申请已批准,正在处理中',
        userId: 'admin-1',
        userName: '管理员'
      }
    ]

    const mockDetail: ApplicationDetailInfo = {
      id: applicationId,
      applicationId: 'APP20241114-001',
      assetId: 'asset-1',
      assetName: '用户行为数据表',
      assetCategory: '数据表',
      userId: 'user-1',
      userName: '张三',
      userEmail: 'zhangsan@example.com',
      status: ApplicationStatus.APPROVED,
      createdAt: new Date(Date.now() - 10000000),
      updatedAt: new Date(Date.now() - 6000000),
      submittedAt: new Date(Date.now() - 9000000),
      approvedAt: new Date(Date.now() - 6000000),
      description: '申请访问用户行为数据表用于数据分析',
      businessPurpose: '进行用户行为分析,优化产品功能',
      formData: {
        department: '数据分析部',
        project: '用户行为分析项目',
        expectedDuration: '3个月'
      },
      processingTime: 1.1,
      metadata: {
        priority: 'high',
        tags: ['数据分析', '用户行为']
      },
      timeline: mockTimeline,
      relatedApplications: {
        sameAsset: 5,
        sameUser: 12
      },
      assetInfo: {
        description: '包含用户行为日志的完整数据',
        owner: '数据团队',
        category: '数据表',
        tags: ['用户行为', '日志', 'PII'],
        popularity: 85
      }
    }

    return mockDetail
  }

  /**
   * 搜索申请记录
   */
  static async searchApplications(
    query: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<ApplicationRecordsResult> {
    const filters: ApplicationFilters = {
      searchQuery: query,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    }

    return this.getApplicationRecords(filters, page, pageSize)
  }

  /**
   * 获取用户的所有申请
   */
  static async getUserApplications(
    userId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<ApplicationRecordsResult> {
    const filters: ApplicationFilters = {
      userIds: [userId],
      sortBy: 'createdAt',
      sortOrder: 'desc'
    }

    return this.getApplicationRecords(filters, page, pageSize)
  }

  /**
   * 获取资产的所有申请
   */
  static async getAssetApplications(
    assetId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<ApplicationRecordsResult> {
    const filters: ApplicationFilters = {
      assetIds: [assetId],
      sortBy: 'createdAt',
      sortOrder: 'desc'
    }

    return this.getApplicationRecords(filters, page, pageSize)
  }

  /**
   * 获取待处理的申请
   */
  static async getPendingApplications(
    page: number = 1,
    pageSize: number = 20
  ): Promise<ApplicationRecordsResult> {
    const filters: ApplicationFilters = {
      status: [ApplicationStatus.PENDING],
      sortBy: 'createdAt',
      sortOrder: 'asc'
    }

    return this.getApplicationRecords(filters, page, pageSize)
  }

  /**
   * 更新申请状态
   */
  static async updateApplicationStatus(
    applicationId: string,
    status: ApplicationStatus,
    notes?: string,
    userId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // TODO: 集成Prisma后实现数据库更新
      // await db.applications.update({
      //   where: { id: applicationId },
      //   data: {
      //     status,
      //     processingNotes: notes,
      //     updatedAt: new Date()
      //   }
      // })

      // 添加时间线事件
      // await db.applicationTimeline.create({
      //   data: {
      //     applicationId,
      //     type: 'status_changed',
      //     title: `状态变更为${ApplicationStatusLabels[status]}`,
      //     description: notes,
      //     userId,
      //     timestamp: new Date()
      //   }
      // })

      return {
        success: true,
        message: '状态更新成功'
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '状态更新失败'
      }
    }
  }

  /**
   * 批量更新申请状态
   */
  static async batchUpdateStatus(
    applicationIds: string[],
    status: ApplicationStatus,
    notes?: string,
    userId?: string
  ): Promise<BatchOperationResult> {
    const results = await Promise.allSettled(
      applicationIds.map(id => this.updateApplicationStatus(id, status, notes, userId))
    )

    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    const failed = results.length - succeeded

    return {
      total: applicationIds.length,
      succeeded,
      failed,
      results: results.map((result, index) => ({
        id: applicationIds[index],
        success: result.status === 'fulfilled' && result.value.success,
        error: result.status === 'rejected' ? result.reason : undefined
      }))
    }
  }

  /**
   * 添加申请备注
   */
  static async addApplicationNote(
    applicationId: string,
    note: string,
    userId: string,
    userName: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // TODO: 集成Prisma后实现数据库更新
      // await db.applicationTimeline.create({
      //   data: {
      //     applicationId,
      //     type: 'note_added',
      //     title: '添加备注',
      //     description: note,
      //     userId,
      //     userName,
      //     timestamp: new Date()
      //   }
      // })

      return {
        success: true,
        message: '备注添加成功'
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '备注添加失败'
      }
    }
  }

  /**
   * 验证筛选条件
   */
  static validateFilters(filters: ApplicationFilters): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    // 验证日期范围
    if (filters.dateRange) {
      if (filters.dateRange.start > filters.dateRange.end) {
        errors.push('开始日期不能晚于结束日期')
      }

      // 检查日期范围是否过大(超过1年)
      const daysDiff = Math.floor(
        (filters.dateRange.end.getTime() - filters.dateRange.start.getTime()) / (1000 * 3600 * 24)
      )
      if (daysDiff > 365) {
        errors.push('日期范围不能超过365天')
      }
    }

    // 验证搜索关键词
    if (filters.searchQuery && filters.searchQuery.length < 2) {
      errors.push('搜索关键词至少需要2个字符')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 获取筛选条件的统计信息
   */
  static async getFilterStatistics(
    filters: ApplicationFilters
  ): Promise<{
    totalMatched: number
    statusCounts: Record<ApplicationStatus, number>
    categoryCounts: Record<string, number>
  }> {
    // TODO: 集成Prisma后实现数据库查询
    // const whereClause = this.buildWhereClause(filters)

    // const [totalMatched, statusCounts, categoryCounts] = await Promise.all([
    //   db.applications.count({ where: whereClause }),
    //   db.applications.groupBy({
    //     by: ['status'],
    //     where: whereClause,
    //     _count: true
    //   }),
    //   db.applications.groupBy({
    //     by: ['assetCategory'],
    //     where: whereClause,
    //     _count: true
    //   })
    // ])

    // 模拟数据
    return {
      totalMatched: 100,
      statusCounts: {
        [ApplicationStatus.DRAFT]: 5,
        [ApplicationStatus.PENDING]: 20,
        [ApplicationStatus.APPROVED]: 40,
        [ApplicationStatus.REJECTED]: 10,
        [ApplicationStatus.PROCESSING]: 15,
        [ApplicationStatus.COMPLETED]: 8,
        [ApplicationStatus.CANCELLED]: 2
      },
      categoryCounts: {
        '数据表': 60,
        '数据接口': 30,
        '数据文件': 10
      }
    }
  }
}
