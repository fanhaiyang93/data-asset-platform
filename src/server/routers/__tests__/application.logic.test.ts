/**
 * Application 业务逻辑测试
 * 测试申请提交的核心业务逻辑
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

// 简化的申请提交业务逻辑函数
async function submitApplicationLogic(input: any, userId: string) {
  // 验证资产是否存在且可申请
  const asset = await prisma.asset.findUnique({
    where: { id: input.assetId },
    include: { category: true },
  })

  if (!asset) {
    throw new Error('找不到指定的资产')
  }

  if (asset.status !== 'AVAILABLE') {
    throw new Error('该资产当前不可申请')
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
    throw new Error('您已有该资产的申请正在处理中，请勿重复申请')
  }

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
    actionUrl: `http://localhost:3000/applications/success/${result.applicationNumber}`,
  }

  // 异步发送邮件，不等待结果
  EmailNotificationService.sendApplicationConfirmation(emailData).catch(error => {
    console.error('发送申请确认邮件失败:', error)
  })

  // 返回申请结果
  return {
    id: result.id,
    applicationId: result.applicationNumber,
    status: result.status,
    submittedAt: result.submittedAt!,
  }
}

describe('Application 业务逻辑测试', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEmailNotificationService.sendApplicationConfirmation.mockResolvedValue(true)
  })

  describe('申请提交逻辑', () => {
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

      const result = await submitApplicationLogic(validInput, mockUser.id)

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

      await expect(submitApplicationLogic(validInput, mockUser.id))
        .rejects.toThrow('找不到指定的资产')
    })

    it('应该拒绝不可用的资产申请', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        id: 'asset-123',
        status: 'MAINTENANCE',
      } as any)

      await expect(submitApplicationLogic(validInput, mockUser.id))
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

      await expect(submitApplicationLogic(validInput, mockUser.id))
        .rejects.toThrow('您已有该资产的申请正在处理中')
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

      await expect(submitApplicationLogic(validInput, mockUser.id))
        .rejects.toThrow('申请ID生成失败')
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
        ...validInput,
        asset: {
          category: { name: '测试分类' },
          name: '用户行为数据',
        },
      }

      mockPrisma.$transaction.mockResolvedValue(createdApplication)

      // 邮件发送失败
      mockEmailNotificationService.sendApplicationConfirmation.mockRejectedValue(
        new Error('邮件发送失败')
      )

      const result = await submitApplicationLogic(validInput, mockUser.id)

      // 申请应该成功，即使邮件失败
      expect(result.applicationId).toBe('DA-20241201-0001')
    })
  })
})