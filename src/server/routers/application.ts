/**
 * 申请相关的 tRPC 路由
 */

import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/lib/trpc'
import { prisma } from '@/lib/prisma'
import { ApplicationIdService } from '@/lib/services/applicationId'
import { EmailNotificationService } from '@/lib/services/emailNotification'
import { ApplicationExportService, type ExportApplicationData } from '@/lib/services/applicationExport'
import { ApplicationStatus, BusinessPurpose } from '@prisma/client'
import { TRPCError } from '@trpc/server'

// 申请提交输入验证schema
const applicationSubmitSchema = z.object({
  assetId: z.string().min(1, '资产ID不能为空'),
  purpose: z.nativeEnum(BusinessPurpose, {
    errorMap: () => ({ message: '请选择有效的业务用途' }),
  }),
  reason: z.string().min(10, '申请理由至少需要10个字符').max(1000, '申请理由不能超过1000个字符'),
  startDate: z.date({
    required_error: '请选择使用开始日期',
    invalid_type_error: '使用开始日期格式不正确',
  }),
  endDate: z.date({
    required_error: '请选择使用结束日期',
    invalid_type_error: '使用结束日期格式不正确',
  }),
  applicantName: z.string().min(1, '申请人姓名不能为空').max(50, '申请人姓名不能超过50个字符'),
  department: z.string().max(100, '部门名称不能超过100个字符').optional(),
  contactEmail: z.string().email('请输入有效的邮箱地址'),
  contactPhone: z.string().max(20, '联系电话不能超过20个字符').optional(),
}).refine(
  (data) => data.endDate > data.startDate,
  {
    message: '使用结束日期必须晚于开始日期',
    path: ['endDate'],
  }
).refine(
  (data) => data.startDate >= new Date(new Date().setHours(0, 0, 0, 0)),
  {
    message: '使用开始日期不能早于今天',
    path: ['startDate'],
  }
)

// 申请查询参数schema
const applicationListSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  status: z.array(z.nativeEnum(ApplicationStatus)).optional(),
  purpose: z.array(z.nativeEnum(BusinessPurpose)).optional(),
  applicantName: z.string().optional(),
  assetName: z.string().optional(),
  sortBy: z.enum(['createdAt', 'submittedAt', 'applicantName', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const applicationRouter = createTRPCRouter({
  /**
   * 提交申请
   */
  submitApplication: protectedProcedure
    .input(applicationSubmitSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id

      // 验证资产是否存在且可申请
      const asset = await prisma.asset.findUnique({
        where: { id: input.assetId },
        include: { category: true },
      })

      if (!asset) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '找不到指定的资产',
        })
      }

      if (asset.status !== 'AVAILABLE') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '该资产当前不可申请',
        })
      }

      // 检查用户是否已有该资产的未完成申请
      const existingApplication = await prisma.application.findFirst({
        where: {
          userId,
          assetId: input.assetId,
          status: {
            in: [ApplicationStatus.DRAFT, ApplicationStatus.PENDING],
          },
        },
      })

      if (existingApplication) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '您已有该资产的申请正在处理中，请勿重复申请',
        })
      }

      try {
        // 使用事务确保原子性
        const result = await prisma.$transaction(async (tx) => {
          // 生成申请ID
          const applicationNumber = await ApplicationIdService.generateWithRetry()

          // 创建申请记录
          const application = await tx.application.create({
            data: {
              applicationNumber,
              assetId: input.assetId,
              userId,
              status: ApplicationStatus.PENDING,
              purpose: input.purpose,
              reason: input.reason,
              startDate: input.startDate,
              endDate: input.endDate,
              applicantName: input.applicantName,
              department: input.department,
              contactEmail: input.contactEmail,
              contactPhone: input.contactPhone,
              isDraft: false,
              submittedAt: new Date(),
            },
            include: {
              asset: {
                include: {
                  category: true,
                },
              },
              user: true,
            },
          })

          return application
        })

        // 异步发送邮件通知（不阻塞响应）
        const emailData = {
          applicationNumber: result.applicationNumber,
          applicantName: result.applicantName,
          applicantEmail: result.contactEmail,
          assetName: result.asset.name,
          assetCategory: result.asset.category.name,
          purpose: result.purpose,
          reason: result.reason,
          startDate: result.startDate,
          endDate: result.endDate,
          submittedAt: result.submittedAt!,
          status: result.status,
          actionUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/applications/success/${result.applicationNumber}`,
        }

        // 异步发送邮件，不等待结果
        EmailNotificationService.sendApplicationConfirmation(emailData).catch(error => {
          console.error('发送申请确认邮件失败:', error)
          // 这里可以添加到重试队列或记录日志
        })

        // 返回申请结果
        return {
          id: result.id,
          applicationId: result.applicationNumber,
          status: result.status,
          submittedAt: result.submittedAt!,
        }
      } catch (error) {
        console.error('申请提交失败:', error)

        if (error instanceof Error && error.message.includes('申请ID')) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: '申请编号生成失败，请重试',
          })
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '申请提交失败，请重试',
        })
      }
    }),

  /**
   * 获取申请详情
   */
  getApplication: protectedProcedure
    .input(z.object({
      applicationId: z.string().min(1, '申请ID不能为空'),
    }))
    .query(async ({ input, ctx }) => {
      const application = await prisma.application.findUnique({
        where: { applicationNumber: input.applicationId },
        include: {
          asset: {
            include: {
              category: true,
            },
          },
          user: true,
          reviewer: true,
        },
      })

      if (!application) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '找不到指定的申请',
        })
      }

      // 检查权限：只有申请人、审核人或管理员可以查看
      const isOwner = application.userId === ctx.user.id
      const isReviewer = application.reviewerId === ctx.user.id
      const isAdmin = ctx.user.role === 'SYSTEM_ADMIN' || ctx.user.role === 'ASSET_MANAGER'

      if (!isOwner && !isReviewer && !isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '您没有权限查看该申请',
        })
      }

      return {
        id: application.id,
        applicationNumber: application.applicationNumber,
        status: application.status,
        purpose: application.purpose,
        reason: application.reason,
        startDate: application.startDate,
        endDate: application.endDate,
        applicantName: application.applicantName,
        department: application.department,
        contactEmail: application.contactEmail,
        contactPhone: application.contactPhone,
        reviewComment: application.reviewComment,
        reviewedAt: application.reviewedAt,
        submittedAt: application.submittedAt,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
        asset: {
          id: application.asset.id,
          name: application.asset.name,
          description: application.asset.description,
          category: {
            name: application.asset.category.name,
          },
        },
        reviewer: application.reviewer ? {
          name: application.reviewer.name,
          email: application.reviewer.email,
        } : undefined,
      }
    }),

  /**
   * 获取申请列表
   */
  getApplications: protectedProcedure
    .input(applicationListSchema)
    .query(async ({ input, ctx }) => {
      const { page, limit, status, purpose, applicantName, assetName, sortBy, sortOrder } = input

      // 构建查询条件
      const where: any = {}

      // 权限过滤：普通用户只能看到自己的申请
      if (ctx.user.role === 'BUSINESS_USER') {
        where.userId = ctx.user.id
      }

      if (status && status.length > 0) {
        where.status = { in: status }
      }

      if (purpose && purpose.length > 0) {
        where.purpose = { in: purpose }
      }

      if (applicantName) {
        where.applicantName = { contains: applicantName, mode: 'insensitive' }
      }

      if (assetName) {
        where.asset = {
          name: { contains: assetName, mode: 'insensitive' }
        }
      }

      // 构建排序
      const orderBy: any = {}
      orderBy[sortBy] = sortOrder

      // 查询总数和数据
      const [total, applications] = await Promise.all([
        prisma.application.count({ where }),
        prisma.application.findMany({
          where,
          include: {
            asset: {
              include: {
                category: true,
              },
            },
            reviewer: true,
          },
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
      ])

      return {
        applications: applications.map(app => ({
          id: app.id,
          applicationNumber: app.applicationNumber,
          status: app.status,
          purpose: app.purpose,
          reason: app.reason,
          startDate: app.startDate,
          endDate: app.endDate,
          applicantName: app.applicantName,
          department: app.department,
          contactEmail: app.contactEmail,
          contactPhone: app.contactPhone,
          reviewComment: app.reviewComment,
          reviewedAt: app.reviewedAt,
          submittedAt: app.submittedAt,
          createdAt: app.createdAt,
          updatedAt: app.updatedAt,
          asset: {
            id: app.asset.id,
            name: app.asset.name,
            description: app.asset.description,
            category: {
              name: app.asset.category.name,
            },
          },
          reviewer: app.reviewer ? {
            name: app.reviewer.name,
            email: app.reviewer.email,
          } : undefined,
        })),
        total,
        hasMore: (page * limit) < total,
        page,
        limit,
      }
    }),

  /**
   * 获取用户的申请统计
   */
  getApplicationStatistics: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id

      // 构建查询条件
      const where: any = {}
      if (ctx.user.role === 'BUSINESS_USER') {
        where.userId = userId
      }

      // 获取各状态的申请数量
      const statusCounts = await prisma.application.groupBy({
        by: ['status'],
        where,
        _count: {
          status: true,
        },
      })

      // 获取各用途的申请数量
      const purposeCounts = await prisma.application.groupBy({
        by: ['purpose'],
        where,
        _count: {
          purpose: true,
        },
      })

      // 获取总数
      const total = await prisma.application.count({ where })

      // 格式化状态统计
      const byStatus: Record<ApplicationStatus, number> = {
        DRAFT: 0,
        PENDING: 0,
        APPROVED: 0,
        REJECTED: 0,
      }

      statusCounts.forEach(({ status, _count }) => {
        byStatus[status] = _count.status
      })

      // 格式化用途统计
      const byPurpose: Record<BusinessPurpose, number> = {
        REPORT_CREATION: 0,
        DATA_ANALYSIS: 0,
        BUSINESS_MONITOR: 0,
        MODEL_TRAINING: 0,
        SYSTEM_INTEGRATION: 0,
        RESEARCH_ANALYSIS: 0,
        OTHER: 0,
      }

      purposeCounts.forEach(({ purpose, _count }) => {
        byPurpose[purpose] = _count.purpose
      })

      return {
        total,
        byStatus,
        byPurpose,
      }
    }),

  /**
   * 获取用户申请历史记录 - cursor-based分页
   */
  getUserApplicationHistory: protectedProcedure
    .input(z.object({
      // cursor-based分页参数
      cursor: z.string().optional(), // 使用申请ID作为cursor
      limit: z.number().min(1).max(50).default(20),

      // 筛选参数
      status: z.array(z.nativeEnum(ApplicationStatus)).optional(),
      purpose: z.array(z.nativeEnum(BusinessPurpose)).optional(),
      assetType: z.string().optional(),

      // 时间范围筛选
      startDate: z.date().optional(),
      endDate: z.date().optional(),

      // 关键词搜索
      searchKeyword: z.string().optional(),

      // 排序方式
      sortBy: z.enum(['createdAt', 'submittedAt', 'updatedAt']).default('createdAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    }))
    .query(async ({ input, ctx }) => {
      const {
        cursor,
        limit,
        status,
        purpose,
        assetType,
        startDate,
        endDate,
        searchKeyword,
        sortBy,
        sortOrder
      } = input

      // 构建查询条件
      const where: any = {
        userId: ctx.user.id, // 用户只能查看自己的申请历史
        isDraft: false, // 排除草稿状态
      }

      // 状态筛选
      if (status && status.length > 0) {
        where.status = { in: status }
      }

      // 用途筛选
      if (purpose && purpose.length > 0) {
        where.purpose = { in: purpose }
      }

      // 时间范围筛选
      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) {
          where.createdAt.gte = startDate
        }
        if (endDate) {
          where.createdAt.lte = endDate
        }
      }

      // 关键词搜索 - 搜索申请原因和资产名称
      if (searchKeyword) {
        where.OR = [
          {
            reason: {
              contains: searchKeyword,
              mode: 'insensitive'
            }
          },
          {
            asset: {
              name: {
                contains: searchKeyword,
                mode: 'insensitive'
              }
            }
          },
          {
            applicationNumber: {
              contains: searchKeyword,
              mode: 'insensitive'
            }
          }
        ]
      }

      // 资产类型筛选
      if (assetType) {
        where.asset = {
          ...where.asset,
          type: assetType
        }
      }

      // cursor-based分页
      if (cursor) {
        where.id = {
          [sortOrder === 'desc' ? 'lt' : 'gt']: cursor
        }
      }

      // 构建排序
      const orderBy: any = {}
      orderBy[sortBy] = sortOrder

      // 添加id作为第二排序字段确保一致性
      if (sortBy !== 'id') {
        orderBy.id = sortOrder
      }

      try {
        // 查询申请记录
        const applications = await prisma.application.findMany({
          where,
          include: {
            asset: {
              include: {
                category: true,
              },
            },
            reviewer: {
              select: {
                id: true,
                name: true,
                email: true,
              }
            },
          },
          orderBy,
          take: limit + 1, // 多取一条用于判断是否有下一页
        })

        // 分离数据和hasMore判断
        const hasMore = applications.length > limit
        const items = hasMore ? applications.slice(0, -1) : applications

        // 获取下一页的cursor
        const nextCursor = hasMore ? items[items.length - 1]?.id : null

        return {
          items: items.map(app => ({
            id: app.id,
            applicationNumber: app.applicationNumber,
            status: app.status,
            purpose: app.purpose,
            reason: app.reason,
            startDate: app.startDate,
            endDate: app.endDate,
            applicantName: app.applicantName,
            department: app.department,
            contactEmail: app.contactEmail,
            contactPhone: app.contactPhone,
            reviewComment: app.reviewComment,
            reviewedAt: app.reviewedAt,
            submittedAt: app.submittedAt,
            createdAt: app.createdAt,
            updatedAt: app.updatedAt,
            asset: {
              id: app.asset.id,
              name: app.asset.name,
              description: app.asset.description,
              type: app.asset.type,
              category: {
                id: app.asset.category.id,
                name: app.asset.category.name,
              },
            },
            reviewer: app.reviewer ? {
              id: app.reviewer.id,
              name: app.reviewer.name,
              email: app.reviewer.email,
            } : null,
            // 计算申请状态相对时间
            statusDisplayText: getStatusDisplayText(app.status, app.createdAt, app.submittedAt, app.reviewedAt),
            // 申请进度百分比
            progressPercentage: getProgressPercentage(app.status),
          })),
          nextCursor,
          hasMore,
        }
      } catch (error) {
        console.error('获取申请历史失败:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '获取申请历史失败，请重试',
        })
      }
    }),

  /**
   * 获取申请历史统计信息
   */
  getApplicationHistoryStats: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id

      // 获取用户所有非草稿申请
      const where = {
        userId,
        isDraft: false,
      }

      // 获取总体统计
      const [totalCount, statusStats, purposeStats, monthlyStats] = await Promise.all([
        // 总申请数
        prisma.application.count({ where }),

        // 按状态统计
        prisma.application.groupBy({
          by: ['status'],
          where,
          _count: { id: true },
        }),

        // 按用途统计
        prisma.application.groupBy({
          by: ['purpose'],
          where,
          _count: { id: true },
        }),

        // 按月统计最近12个月
        prisma.application.groupBy({
          by: ['createdAt'],
          where: {
            ...where,
            createdAt: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - 12))
            }
          },
          _count: { id: true },
        })
      ])

      return {
        totalCount,
        statusDistribution: statusStats.map(stat => ({
          status: stat.status,
          count: stat._count.id,
          percentage: Math.round((stat._count.id / totalCount) * 100),
        })),
        purposeDistribution: purposeStats.map(stat => ({
          purpose: stat.purpose,
          count: stat._count.id,
          percentage: Math.round((stat._count.id / totalCount) * 100),
        })),
        monthlyTrend: monthlyStats.map(stat => ({
          month: stat.createdAt,
          count: stat._count.id,
        })),
      }
    }),

  /**
   * 导出申请记录预览信息
   */
  getExportPreview: protectedProcedure
    .input(z.object({
      // 筛选参数（与getUserApplicationHistory相同）
      status: z.array(z.nativeEnum(ApplicationStatus)).optional(),
      purpose: z.array(z.nativeEnum(BusinessPurpose)).optional(),
      assetType: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      searchKeyword: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const {
        status,
        purpose,
        assetType,
        startDate,
        endDate,
        searchKeyword,
      } = input

      // 构建与getUserApplicationHistory相同的查询条件
      const where: any = {
        userId: ctx.user.id,
        isDraft: false,
      }

      if (status && status.length > 0) {
        where.status = { in: status }
      }

      if (purpose && purpose.length > 0) {
        where.purpose = { in: purpose }
      }

      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) {
          where.createdAt.gte = startDate
        }
        if (endDate) {
          where.createdAt.lte = endDate
        }
      }

      if (searchKeyword) {
        where.OR = [
          {
            reason: {
              contains: searchKeyword,
              mode: 'insensitive'
            }
          },
          {
            asset: {
              name: {
                contains: searchKeyword,
                mode: 'insensitive'
              }
            }
          },
          {
            applicationNumber: {
              contains: searchKeyword,
              mode: 'insensitive'
            }
          }
        ]
      }

      if (assetType) {
        where.asset = {
          ...where.asset,
          type: assetType
        }
      }

      try {
        // 获取符合条件的申请记录
        const applications = await prisma.application.findMany({
          where,
          include: {
            asset: {
              include: {
                category: true,
              },
            },
            reviewer: {
              select: {
                id: true,
                name: true,
                email: true,
              }
            },
          },
          orderBy: {
            createdAt: 'desc'
          },
        })

        // 转换为导出数据格式
        const exportData: ExportApplicationData[] = applications.map(app => ({
          id: app.id,
          applicationNumber: app.applicationNumber,
          status: app.status,
          purpose: app.purpose,
          reason: app.reason,
          startDate: app.startDate,
          endDate: app.endDate,
          applicantName: app.applicantName,
          department: app.department,
          contactEmail: app.contactEmail,
          contactPhone: app.contactPhone,
          reviewComment: app.reviewComment,
          reviewedAt: app.reviewedAt,
          submittedAt: app.submittedAt,
          createdAt: app.createdAt,
          updatedAt: app.updatedAt,
          asset: {
            id: app.asset.id,
            name: app.asset.name,
            description: app.asset.description,
            type: app.asset.type,
            category: {
              id: app.asset.category.id,
              name: app.asset.category.name,
            },
          },
          reviewer: app.reviewer ? {
            id: app.reviewer.id,
            name: app.reviewer.name,
            email: app.reviewer.email,
          } : null,
        }))

        // 获取导出预览信息
        const preview = ApplicationExportService.getExportPreview(exportData)

        return {
          ...preview,
          // 生成建议的文件名
          suggestedFilenames: {
            csv: ApplicationExportService.generateFilename('csv', {
              totalCount: preview.totalCount,
              dateRange: preview.dateRange ? {
                start: preview.dateRange.earliest,
                end: preview.dateRange.latest
              } : undefined
            }),
            excel: ApplicationExportService.generateFilename('excel', {
              totalCount: preview.totalCount,
              dateRange: preview.dateRange ? {
                start: preview.dateRange.earliest,
                end: preview.dateRange.latest
              } : undefined
            })
          }
        }
      } catch (error) {
        console.error('获取导出预览失败:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '获取导出预览失败，请重试',
        })
      }
    }),

  /**
   * 导出申请记录数据（返回处理过的数据，客户端负责生成文件）
   */
  exportApplications: protectedProcedure
    .input(z.object({
      // 筛选参数
      status: z.array(z.nativeEnum(ApplicationStatus)).optional(),
      purpose: z.array(z.nativeEnum(BusinessPurpose)).optional(),
      assetType: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      searchKeyword: z.string().optional(),

      // 导出选项
      format: z.enum(['csv', 'excel']).default('csv'),
      selectedIds: z.array(z.string()).optional(), // 如果提供，只导出选中的记录
      includeFields: z.array(z.string()).optional(), // 指定要导出的字段
    }))
    .mutation(async ({ input, ctx }) => {
      const {
        status,
        purpose,
        assetType,
        startDate,
        endDate,
        searchKeyword,
        format,
        selectedIds,
        includeFields,
      } = input

      // 构建查询条件
      const where: any = {
        userId: ctx.user.id,
        isDraft: false,
      }

      // 如果指定了selectedIds，直接按ID查询
      if (selectedIds && selectedIds.length > 0) {
        where.id = { in: selectedIds }
      } else {
        // 否则使用筛选条件
        if (status && status.length > 0) {
          where.status = { in: status }
        }

        if (purpose && purpose.length > 0) {
          where.purpose = { in: purpose }
        }

        if (startDate || endDate) {
          where.createdAt = {}
          if (startDate) {
            where.createdAt.gte = startDate
          }
          if (endDate) {
            where.createdAt.lte = endDate
          }
        }

        if (searchKeyword) {
          where.OR = [
            {
              reason: {
                contains: searchKeyword,
                mode: 'insensitive'
              }
            },
            {
              asset: {
                name: {
                  contains: searchKeyword,
                  mode: 'insensitive'
                }
              }
            },
            {
              applicationNumber: {
                contains: searchKeyword,
                mode: 'insensitive'
              }
            }
          ]
        }

        if (assetType) {
          where.asset = {
            ...where.asset,
            type: assetType
          }
        }
      }

      try {
        // 获取申请记录
        const applications = await prisma.application.findMany({
          where,
          include: {
            asset: {
              include: {
                category: true,
              },
            },
            reviewer: {
              select: {
                id: true,
                name: true,
                email: true,
              }
            },
          },
          orderBy: {
            createdAt: 'desc'
          },
        })

        if (applications.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '没有找到符合条件的申请记录',
          })
        }

        // 转换为导出数据格式
        const exportData: ExportApplicationData[] = applications.map(app => ({
          id: app.id,
          applicationNumber: app.applicationNumber,
          status: app.status,
          purpose: app.purpose,
          reason: app.reason,
          startDate: app.startDate,
          endDate: app.endDate,
          applicantName: app.applicantName,
          department: app.department,
          contactEmail: app.contactEmail,
          contactPhone: app.contactPhone,
          reviewComment: app.reviewComment,
          reviewedAt: app.reviewedAt,
          submittedAt: app.submittedAt,
          createdAt: app.createdAt,
          updatedAt: app.updatedAt,
          asset: {
            id: app.asset.id,
            name: app.asset.name,
            description: app.asset.description,
            type: app.asset.type,
            category: {
              id: app.asset.category.id,
              name: app.asset.category.name,
            },
          },
          reviewer: app.reviewer ? {
            id: app.reviewer.id,
            name: app.reviewer.name,
            email: app.reviewer.email,
          } : null,
        }))

        // 返回导出数据和元信息，客户端负责生成文件
        return {
          data: exportData,
          format,
          totalCount: exportData.length,
          filename: ApplicationExportService.generateFilename(format, {
            totalCount: exportData.length,
            dateRange: exportData.length > 0 ? {
              start: exportData[exportData.length - 1].createdAt,
              end: exportData[0].createdAt
            } : undefined
          }),
          exportedAt: new Date(),
        }
      } catch (error) {
        console.error('导出申请记录失败:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '导出申请记录失败，请重试',
        })
      }
    }),
})

// 辅助函数：获取状态显示文本
function getStatusDisplayText(
  status: ApplicationStatus,
  createdAt: Date,
  submittedAt: Date | null,
  reviewedAt: Date | null
): string {
  const now = new Date()

  switch (status) {
    case ApplicationStatus.DRAFT:
      const draftDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      return `草稿已保存 ${draftDays} 天`

    case ApplicationStatus.PENDING:
      if (submittedAt) {
        const pendingDays = Math.floor((now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60 * 24))
        return `审核中，已等待 ${pendingDays} 天`
      }
      return '等待审核'

    case ApplicationStatus.APPROVED:
      if (reviewedAt) {
        const approvedDays = Math.floor((now.getTime() - reviewedAt.getTime()) / (1000 * 60 * 60 * 24))
        return `已通过，${approvedDays} 天前`
      }
      return '已通过'

    case ApplicationStatus.REJECTED:
      if (reviewedAt) {
        const rejectedDays = Math.floor((now.getTime() - reviewedAt.getTime()) / (1000 * 60 * 60 * 24))
        return `已拒绝，${rejectedDays} 天前`
      }
      return '已拒绝'

    default:
      return '未知状态'
  }
}

// 辅助函数：获取申请进度百分比
function getProgressPercentage(status: ApplicationStatus): number {
  switch (status) {
    case ApplicationStatus.DRAFT:
      return 25
    case ApplicationStatus.PENDING:
      return 50
    case ApplicationStatus.APPROVED:
      return 100
    case ApplicationStatus.REJECTED:
      return 100
    default:
      return 0
  }
}