/**
 * ApplicationIdService 单元测试
 * 测试申请ID生成算法的正确性和可靠性
 */

import { ApplicationIdService } from '@/lib/services/applicationId'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    application: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  },
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('ApplicationIdService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  describe('generateApplicationId', () => {
    it('应该生成正确格式的申请ID', async () => {
      // Mock：没有找到当日申请
      mockPrisma.application.findFirst.mockResolvedValue(null)
      mockPrisma.application.findUnique.mockResolvedValue(null)

      const testDate = new Date('2024-12-01')
      const applicationId = await ApplicationIdService.generateApplicationId(testDate)

      expect(applicationId).toBe('DA-20241201-0001')
      expect(ApplicationIdService.validateFormat(applicationId)).toBe(true)
    })

    it('应该正确递增序号', async () => {
      // Mock：找到一个现有申请
      mockPrisma.application.findFirst.mockResolvedValue({
        applicationNumber: 'DA-20241201-0005',
      } as any)
      mockPrisma.application.findUnique.mockResolvedValue(null)

      const testDate = new Date('2024-12-01')
      const applicationId = await ApplicationIdService.generateApplicationId(testDate)

      expect(applicationId).toBe('DA-20241201-0006')
    })

    it('应该处理序号达到最大值的情况', async () => {
      // Mock：找到一个序号为9999的申请
      mockPrisma.application.findFirst.mockResolvedValue({
        applicationNumber: 'DA-20241201-9999',
      } as any)
      mockPrisma.application.findUnique.mockResolvedValue(null)

      const testDate = new Date('2024-12-01')
      const applicationId = await ApplicationIdService.generateApplicationId(testDate)

      // 应该生成10000，虽然超出4位，但仍然能生成
      expect(applicationId).toBe('DA-20241201-10000')
    })

    it('应该验证ID唯一性', async () => {
      mockPrisma.application.findFirst.mockResolvedValue(null)
      // 第一次查询唯一性时返回存在，第二次返回不存在
      mockPrisma.application.findUnique
        .mockResolvedValueOnce({ applicationNumber: 'DA-20241201-0001' } as any)
        .mockResolvedValueOnce(null)

      const testDate = new Date('2024-12-01')

      await expect(ApplicationIdService.generateApplicationId(testDate))
        .rejects.toThrow('申请ID DA-20241201-0001 已存在')
    })

    it('应该使用当前日期作为默认值', async () => {
      mockPrisma.application.findFirst.mockResolvedValue(null)
      mockPrisma.application.findUnique.mockResolvedValue(null)

      const applicationId = await ApplicationIdService.generateApplicationId()
      const today = format(new Date(), 'yyyyMMdd')

      expect(applicationId).toBe(`DA-${today}-0001`)
    })
  })

  describe('generateWithRetry', () => {
    it('应该在冲突时重试生成', async () => {
      mockPrisma.application.findFirst.mockResolvedValue(null)

      // 第一次尝试失败，第二次成功
      mockPrisma.application.findUnique
        .mockResolvedValueOnce({ applicationNumber: 'DA-20241201-0001' } as any)
        .mockResolvedValueOnce(null)

      const testDate = new Date('2024-12-01')

      // 在第一次验证唯一性时抛出错误，应该重试
      jest.spyOn(ApplicationIdService, 'generateApplicationId')
        .mockRejectedValueOnce(new Error('申请ID DA-20241201-0001 已存在'))
        .mockResolvedValueOnce('DA-20241201-0001')

      const applicationId = await ApplicationIdService.generateWithRetry(testDate, 3)
      expect(applicationId).toBe('DA-20241201-0001')
    })

    it('应该在达到最大重试次数后抛出错误', async () => {
      const error = new Error('申请ID已存在')
      jest.spyOn(ApplicationIdService, 'generateApplicationId')
        .mockRejectedValue(error)

      const testDate = new Date('2024-12-01')

      await expect(ApplicationIdService.generateWithRetry(testDate, 2))
        .rejects.toThrow('在2次尝试后仍无法生成唯一的申请ID')
    })
  })

  describe('validateFormat', () => {
    it('应该验证正确的ID格式', () => {
      expect(ApplicationIdService.validateFormat('DA-20241201-0001')).toBe(true)
      expect(ApplicationIdService.validateFormat('DA-20241201-9999')).toBe(true)
      expect(ApplicationIdService.validateFormat('DA-20200229-0001')).toBe(true) // 闰年
    })

    it('应该拒绝错误的ID格式', () => {
      expect(ApplicationIdService.validateFormat('DA-2024120-0001')).toBe(false) // 日期格式错误
      expect(ApplicationIdService.validateFormat('DA-20241201-001')).toBe(false) // 序号位数不足
      expect(ApplicationIdService.validateFormat('AP-20241201-0001')).toBe(false) // 前缀错误
      expect(ApplicationIdService.validateFormat('DA-20241201-ABCD')).toBe(false) // 序号非数字
      expect(ApplicationIdService.validateFormat('DA20241201-0001')).toBe(false) // 缺少分隔符
      expect(ApplicationIdService.validateFormat('')).toBe(false) // 空字符串
      // 支持5位或更多位序号
      expect(ApplicationIdService.validateFormat('DA-20241201-10000')).toBe(true) // 5位序号应该通过
    })
  })

  describe('parseApplicationId', () => {
    it('应该正确解析有效的申请ID', () => {
      const result = ApplicationIdService.parseApplicationId('DA-20241201-0123')

      expect(result).not.toBeNull()
      expect(result!.dateStr).toBe('20241201')
      expect(result!.sequence).toBe(123)
      expect(result!.date).toEqual(new Date(2024, 11, 1)) // 月份从0开始
    })

    it('应该处理边界日期', () => {
      const result = ApplicationIdService.parseApplicationId('DA-20200229-0001')

      expect(result).not.toBeNull()
      expect(result!.dateStr).toBe('20200229')
      expect(result!.sequence).toBe(1)
      expect(result!.date).toEqual(new Date(2020, 1, 29)) // 闰年2月29日
    })

    it('应该返回null对于无效的申请ID', () => {
      expect(ApplicationIdService.parseApplicationId('invalid-id')).toBeNull()
      expect(ApplicationIdService.parseApplicationId('DA-2024120-0001')).toBeNull()
      expect(ApplicationIdService.parseApplicationId('DA-20241201-ABC')).toBeNull()
      expect(ApplicationIdService.parseApplicationId('')).toBeNull()
    })

    it('应该处理大序号', () => {
      const result = ApplicationIdService.parseApplicationId('DA-20241201-10000')

      expect(result).not.toBeNull()
      expect(result!.sequence).toBe(10000)
    })
  })

  describe('getDailyApplicationCount', () => {
    it('应该返回指定日期的申请数量', async () => {
      mockPrisma.application.count.mockResolvedValue(25)

      const testDate = new Date('2024-12-01')
      const count = await ApplicationIdService.getDailyApplicationCount(testDate)

      expect(count).toBe(25)
      expect(mockPrisma.application.count).toHaveBeenCalledWith({
        where: {
          applicationNumber: {
            startsWith: 'DA-20241201-',
          },
        },
      })
    })

    it('应该在没有申请时返回0', async () => {
      mockPrisma.application.count.mockResolvedValue(0)

      const testDate = new Date('2024-12-01')
      const count = await ApplicationIdService.getDailyApplicationCount(testDate)

      expect(count).toBe(0)
    })
  })

  describe('并发测试', () => {
    it('应该处理并发ID生成请求', async () => {
      let callCount = 0
      mockPrisma.application.findFirst.mockImplementation(() => {
        callCount++
        return Promise.resolve(callCount === 1 ? null : {
          applicationNumber: `DA-20241201-${String(callCount - 1).padStart(4, '0')}`,
        } as any)
      })
      // 确保唯一性检查总是通过
      mockPrisma.application.findUnique.mockResolvedValue(null)

      const testDate = new Date('2024-12-01')

      // 使用 Promise.allSettled 来避免单个失败影响其他请求
      const promises = Array.from({ length: 3 }, (_, index) =>
        ApplicationIdService.generateApplicationId(testDate)
      )

      const results = await Promise.allSettled(promises)
      const successfulResults = results
        .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
        .map(result => result.value)

      // 至少应该有一些成功的结果
      expect(successfulResults.length).toBeGreaterThan(0)
      successfulResults.forEach(id => {
        expect(ApplicationIdService.validateFormat(id)).toBe(true)
        expect(id.startsWith('DA-20241201-')).toBe(true)
      })
    })
  })

  describe('错误处理', () => {
    it('应该处理数据库查询错误', async () => {
      mockPrisma.application.findFirst.mockRejectedValue(new Error('数据库连接失败'))

      const testDate = new Date('2024-12-01')

      await expect(ApplicationIdService.generateApplicationId(testDate))
        .rejects.toThrow('数据库连接失败')
    })

    it('应该处理无效日期', async () => {
      mockPrisma.application.findFirst.mockResolvedValue(null)
      mockPrisma.application.findUnique.mockResolvedValue(null)

      const invalidDate = new Date('invalid')

      // 传入无效日期应该抛出错误
      await expect(ApplicationIdService.generateApplicationId(invalidDate))
        .rejects.toThrow('无效的日期参数')
    })
  })
})