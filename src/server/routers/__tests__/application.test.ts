/**
 * Application tRPC路由测试
 * 测试申请提交、查询等API功能
 */

import { prisma } from '@/lib/prisma'
import { ApplicationIdService } from '@/lib/services/applicationId'
import { EmailNotificationService } from '@/lib/services/emailNotification'
import { ApplicationStatus, BusinessPurpose } from '@prisma/client'

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    application: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
    asset: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/services/applicationId')
jest.mock('@/lib/services/emailNotification')

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockApplicationIdService = ApplicationIdService as jest.Mocked<typeof ApplicationIdService>
const mockEmailNotificationService = EmailNotificationService as jest.Mocked<typeof EmailNotificationService>

// Mock user context
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  role: 'BUSINESS_USER',
  name: 'Test User',
}

const mockContext = {
  user: mockUser,
}

describe('Application tRPC Router', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEmailNotificationService.sendApplicationConfirmation.mockResolvedValue(true)
  })

  describe('submitApplication', () => {
    const validInput = {
      assetId: 'asset-123',
      purpose: BusinessPurpose.DATA_ANALYSIS,
      reason: '需要分析用户行为数据以优化产品功能',
      startDate: new Date('2024-12-01'),
      endDate: new Date('2024-12-31'),
      applicantName: '张三',
      department: '产品部',
      contactEmail: 'zhangsan@example.com',
      contactPhone: '13800138000',
    }

    it('应该成功提交申请', async () => {
      // Mock asset查询
      mockPrisma.asset.findUnique.mockResolvedValue({
        id: 'asset-123',
        name: '用户行为数据',
        status: 'AVAILABLE',
        category: { name: '用户数据' },
      } as any)

      // Mock没有现有申请
      mockPrisma.application.findFirst.mockResolvedValue(null)

      // Mock ID生成
      mockApplicationIdService.generateWithRetry.mockResolvedValue('DA-20241201-0001')

      // Mock transaction
      const createdApplication = {
        id: 'app-123',
        applicationNumber: 'DA-20241201-0001',
        status: ApplicationStatus.PENDING,
        submittedAt: new Date('2024-12-01T10:00:00Z'),
        ...validInput,
        asset: {
          id: 'asset-123',
          name: '用户行为数据',
          category: { name: '用户数据' },
        },
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          application: {
            create: jest.fn().mockResolvedValue(createdApplication),
          },
        })
      })

      const caller = appRouter.createCaller(mockContext)
      const result = await caller.application.submitApplication(validInput)

      expect(result).toEqual({
        id: 'app-123',
        applicationId: 'DA-20241201-0001',
        status: ApplicationStatus.PENDING,
        submittedAt: new Date('2024-12-01T10:00:00Z'),
      })

      expect(mockApplicationIdService.generateWithRetry).toHaveBeenCalled()
      expect(mockEmailNotificationService.sendApplicationConfirmation).toHaveBeenCalled()
    })

    it('应该拒绝不存在的资产申请', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null)

      const caller = appRouter.createCaller(mockContext)

      await expect(caller.application.submitApplication(validInput))
        .rejects.toThrow('找不到指定的资产')
    })

    it('应该拒绝不可用的资产申请', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        id: 'asset-123',
        status: 'MAINTENANCE',
      } as any)

      const caller = appRouter.createCaller(mockContext)

      await expect(caller.application.submitApplication(validInput))
        .rejects.toThrow('该资产当前不可申请')
    })

    it('应该防止重复申请', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        id: 'asset-123',
        status: 'AVAILABLE',
      } as any)

      mockPrisma.application.findFirst.mockResolvedValue({
        id: 'existing-app',
        status: ApplicationStatus.PENDING,
      } as any)

      const caller = appRouter.createCaller(mockContext)

      await expect(caller.application.submitApplication(validInput))
        .rejects.toThrow('您已有该资产的申请正在处理中')
    })

    it('应该验证输入数据格式', async () => {
      const caller = appRouter.createCaller(mockContext)

      // 测试空资产ID
      await expect(caller.application.submitApplication({
        ...validInput,
        assetId: '',
      })).rejects.toThrow('资产ID不能为空')

      // 测试申请理由太短
      await expect(caller.application.submitApplication({
        ...validInput,
        reason: '太短',
      })).rejects.toThrow('申请理由至少需要10个字符')

      // 测试无效邮箱
      await expect(caller.application.submitApplication({
        ...validInput,
        contactEmail: 'invalid-email',
      })).rejects.toThrow('请输入有效的邮箱地址')

      // 测试结束日期早于开始日期
      await expect(caller.application.submitApplication({
        ...validInput,
        startDate: new Date('2024-12-31'),
        endDate: new Date('2024-12-01'),
      })).rejects.toThrow('使用结束日期必须晚于开始日期')
    })
  })

  describe('getApplication', () => {
    it('应该返回申请详情', async () => {
      const mockApplication = {
        id: 'app-123',
        applicationNumber: 'DA-20241201-0001',
        status: ApplicationStatus.PENDING,
        purpose: BusinessPurpose.DATA_ANALYSIS,
        reason: '测试申请',
        startDate: new Date('2024-12-01'),
        endDate: new Date('2024-12-31'),
        applicantName: '张三',
        contactEmail: 'test@example.com',
        submittedAt: new Date('2024-12-01T10:00:00Z'),
        createdAt: new Date('2024-12-01T09:00:00Z'),
        updatedAt: new Date('2024-12-01T10:00:00Z'),
        userId: 'user-123',
        asset: {
          id: 'asset-123',
          name: '测试资产',
          description: '测试描述',
          category: { name: '测试分类' },
        },
        reviewer: null,
      }

      mockPrisma.application.findUnique.mockResolvedValue(mockApplication as any)

      const caller = appRouter.createCaller(mockContext)
      const result = await caller.application.getApplication({
        applicationId: 'DA-20241201-0001',
      })

      expect(result.applicationNumber).toBe('DA-20241201-0001')
      expect(result.asset.name).toBe('测试资产')
    })

    it('应该拒绝不存在的申请', async () => {
      mockPrisma.application.findUnique.mockResolvedValue(null)

      const caller = appRouter.createCaller(mockContext)

      await expect(caller.application.getApplication({
        applicationId: 'non-existent',
      })).rejects.toThrow('找不到指定的申请')
    })

    it('应该检查访问权限', async () => {
      const mockApplication = {
        userId: 'other-user',
        reviewerId: null,
      }

      mockPrisma.application.findUnique.mockResolvedValue(mockApplication as any)

      const caller = appRouter.createCaller(mockContext)

      await expect(caller.application.getApplication({
        applicationId: 'DA-20241201-0001',
      })).rejects.toThrow('您没有权限查看该申请')
    })

    it('应该允许管理员访问所有申请', async () => {
      const mockApplication = {
        id: 'app-123',
        applicationNumber: 'DA-20241201-0001',
        userId: 'other-user',
        reviewerId: null,
        asset: {
          id: 'asset-123',
          name: '测试资产',
          category: { name: '测试分类' },
        },
        reviewer: null,
      }

      mockPrisma.application.findUnique.mockResolvedValue(mockApplication as any)

      const adminContext = {
        user: { ...mockUser, role: 'SYSTEM_ADMIN' },
      }

      const caller = appRouter.createCaller(adminContext)
      const result = await caller.application.getApplication({
        applicationId: 'DA-20241201-0001',
      })

      expect(result.applicationNumber).toBe('DA-20241201-0001')
    })
  })

  describe('getApplications', () => {
    it('应该返回用户的申请列表', async () => {
      const mockApplications = [
        {
          id: 'app-123',
          applicationNumber: 'DA-20241201-0001',
          status: ApplicationStatus.PENDING,
          applicantName: '张三',
          createdAt: new Date('2024-12-01'),
          asset: {
            id: 'asset-123',
            name: '测试资产',
            category: { name: '测试分类' },
          },
          reviewer: null,
        },
      ]

      mockPrisma.application.count.mockResolvedValue(1)
      mockPrisma.application.findMany.mockResolvedValue(mockApplications as any)

      const caller = appRouter.createCaller(mockContext)
      const result = await caller.application.getApplications({
        page: 1,
        limit: 20,
      })

      expect(result.applications).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.hasMore).toBe(false)
    })

    it('应该支持分页', async () => {
      mockPrisma.application.count.mockResolvedValue(25)
      mockPrisma.application.findMany.mockResolvedValue([])

      const caller = appRouter.createCaller(mockContext)
      const result = await caller.application.getApplications({
        page: 2,
        limit: 10,
      })

      expect(result.hasMore).toBe(true)
      expect(mockPrisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      )
    })

    it('应该支持状态筛选', async () => {
      mockPrisma.application.count.mockResolvedValue(0)
      mockPrisma.application.findMany.mockResolvedValue([])

      const caller = appRouter.createCaller(mockContext)
      await caller.application.getApplications({
        status: [ApplicationStatus.APPROVED],
      })

      expect(mockPrisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [ApplicationStatus.APPROVED] },
          }),
        })
      )
    })

    it('普通用户只能看到自己的申请', async () => {
      mockPrisma.application.count.mockResolvedValue(0)
      mockPrisma.application.findMany.mockResolvedValue([])

      const caller = appRouter.createCaller(mockContext)
      await caller.application.getApplications({})

      expect(mockPrisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
          }),
        })
      )
    })

    it('管理员可以看到所有申请', async () => {
      mockPrisma.application.count.mockResolvedValue(0)
      mockPrisma.application.findMany.mockResolvedValue([])

      const adminContext = {
        user: { ...mockUser, role: 'SYSTEM_ADMIN' },
      }

      const caller = appRouter.createCaller(adminContext)
      await caller.application.getApplications({})

      expect(mockPrisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            userId: expect.anything(),
          }),
        })
      )
    })
  })

  describe('getApplicationStatistics', () => {
    it('应该返回申请统计信息', async () => {
      mockPrisma.application.groupBy
        .mockResolvedValueOnce([
          { status: ApplicationStatus.PENDING, _count: { status: 5 } },
          { status: ApplicationStatus.APPROVED, _count: { status: 3 } },
        ] as any)
        .mockResolvedValueOnce([
          { purpose: BusinessPurpose.DATA_ANALYSIS, _count: { purpose: 4 } },
          { purpose: BusinessPurpose.REPORT_CREATION, _count: { purpose: 4 } },
        ] as any)

      mockPrisma.application.count.mockResolvedValue(8)

      const caller = appRouter.createCaller(mockContext)
      const result = await caller.application.getApplicationStatistics()

      expect(result.total).toBe(8)
      expect(result.byStatus.PENDING).toBe(5)
      expect(result.byStatus.APPROVED).toBe(3)
      expect(result.byPurpose.DATA_ANALYSIS).toBe(4)
    })

    it('应该处理空统计数据', async () => {
      mockPrisma.application.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
      mockPrisma.application.count.mockResolvedValue(0)

      const caller = appRouter.createCaller(mockContext)
      const result = await caller.application.getApplicationStatistics()

      expect(result.total).toBe(0)
      expect(result.byStatus.PENDING).toBe(0)
      expect(result.byPurpose.DATA_ANALYSIS).toBe(0)
    })
  })

  describe('错误处理', () => {
    it('应该处理数据库错误', async () => {
      mockPrisma.asset.findUnique.mockRejectedValue(new Error('数据库连接失败'))

      const caller = appRouter.createCaller(mockContext)

      await expect(caller.application.submitApplication({
        assetId: 'asset-123',
        purpose: BusinessPurpose.DATA_ANALYSIS,
        reason: '测试申请理由，足够长度',
        startDate: new Date('2024-12-01'),
        endDate: new Date('2024-12-31'),
        applicantName: '张三',
        contactEmail: 'test@example.com',
      })).rejects.toThrow('数据库连接失败')
    })

    it('应该处理ID生成失败', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        id: 'asset-123',
        status: 'AVAILABLE',
      } as any)
      mockPrisma.application.findFirst.mockResolvedValue(null)

      mockApplicationIdService.generateWithRetry.mockRejectedValue(
        new Error('申请ID生成失败')
      )

      const caller = appRouter.createCaller(mockContext)

      await expect(caller.application.submitApplication({
        assetId: 'asset-123',
        purpose: BusinessPurpose.DATA_ANALYSIS,
        reason: '测试申请理由，足够长度',
        startDate: new Date('2024-12-01'),
        endDate: new Date('2024-12-31'),
        applicantName: '张三',
        contactEmail: 'test@example.com',
      })).rejects.toThrow('申请编号生成失败，请重试')
    })

    it('邮件发送失败不应该影响申请提交', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        id: 'asset-123',
        status: 'AVAILABLE',
        category: { name: '测试分类' },
      } as any)
      mockPrisma.application.findFirst.mockResolvedValue(null)
      mockApplicationIdService.generateWithRetry.mockResolvedValue('DA-20241201-0001')

      const createdApplication = {
        id: 'app-123',
        applicationNumber: 'DA-20241201-0001',
        status: ApplicationStatus.PENDING,
        submittedAt: new Date(),
        asset: {
          category: { name: '测试分类' },
        },
      }

      mockPrisma.$transaction.mockResolvedValue(createdApplication)

      // 邮件发送失败
      mockEmailNotificationService.sendApplicationConfirmation.mockRejectedValue(
        new Error('邮件发送失败')
      )

      const caller = appRouter.createCaller(mockContext)
      const result = await caller.application.submitApplication({
        assetId: 'asset-123',
        purpose: BusinessPurpose.DATA_ANALYSIS,
        reason: '测试申请理由，足够长度',
        startDate: new Date('2024-12-01'),
        endDate: new Date('2024-12-31'),
        applicantName: '张三',
        contactEmail: 'test@example.com',
      })

      // 申请应该成功，即使邮件失败
      expect(result.applicationId).toBe('DA-20241201-0001')
    })
  })
})