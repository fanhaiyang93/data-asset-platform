/**
 * 申请ID生成服务
 * 实现DA-YYYYMMDD-XXXX格式的唯一ID生成
 */

import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

export class ApplicationIdService {
  private static readonly PREFIX = 'DA' // 数据申请前缀
  private static readonly SEQUENCE_LENGTH = 4 // 序号长度

  /**
   * 生成申请ID
   * 格式：DA-YYYYMMDD-XXXX
   *
   * @param date 可选的日期，默认为当前日期
   * @returns Promise<string> 生成的申请ID
   */
  static async generateApplicationId(date?: Date): Promise<string> {
    const targetDate = date || new Date()

    // 验证日期有效性
    if (isNaN(targetDate.getTime())) {
      throw new Error('无效的日期参数')
    }

    const dateStr = format(targetDate, 'yyyyMMdd')

    // 获取当日申请的最大序号
    const todayStart = new Date(targetDate)
    todayStart.setHours(0, 0, 0, 0)

    const todayEnd = new Date(targetDate)
    todayEnd.setHours(23, 59, 59, 999)

    // 查询当日最后一个申请的序号
    const lastApplication = await prisma.application.findFirst({
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
        applicationNumber: {
          startsWith: `${this.PREFIX}-${dateStr}-`,
        },
      },
      orderBy: {
        applicationNumber: 'desc',
      },
    })

    let nextSequence = 1

    if (lastApplication) {
      // 从最后一个申请编号中提取序号
      const lastSequenceStr = lastApplication.applicationNumber.split('-')[2]
      if (lastSequenceStr) {
        const lastSequence = parseInt(lastSequenceStr, 10)
        nextSequence = lastSequence + 1
      }
    }

    // 生成新的申请ID
    const sequenceStr = nextSequence.toString().padStart(this.SEQUENCE_LENGTH, '0')
    const applicationId = `${this.PREFIX}-${dateStr}-${sequenceStr}`

    // 验证唯一性（防止并发冲突）
    await this.validateUniqueness(applicationId)

    return applicationId
  }

  /**
   * 验证申请ID的唯一性
   *
   * @param applicationId 待验证的申请ID
   * @throws Error 如果ID已存在
   */
  private static async validateUniqueness(applicationId: string): Promise<void> {
    const existing = await prisma.application.findUnique({
      where: {
        applicationNumber: applicationId,
      },
    })

    if (existing) {
      throw new Error(`申请ID ${applicationId} 已存在，无法创建重复的申请编号`)
    }
  }

  /**
   * 处理并发冲突的ID生成
   * 使用乐观锁机制重试生成
   *
   * @param date 可选的日期
   * @param maxRetries 最大重试次数
   * @returns Promise<string> 生成的申请ID
   */
  static async generateWithRetry(date?: Date, maxRetries: number = 3): Promise<string> {
    let attempt = 0

    while (attempt < maxRetries) {
      try {
        return await this.generateApplicationId(date)
      } catch (error) {
        attempt++

        if (attempt >= maxRetries) {
          throw new Error(`在${maxRetries}次尝试后仍无法生成唯一的申请ID: ${error}`)
        }

        // 短暂延迟后重试，避免高并发冲突
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100))
      }
    }

    throw new Error('意外错误：重试循环异常退出')
  }

  /**
   * 验证申请ID格式是否正确
   *
   * @param applicationId 待验证的申请ID
   * @returns boolean 格式是否正确
   */
  static validateFormat(applicationId: string): boolean {
    // 支持4位或更多位的序号，以适应大量申请的情况
    const pattern = /^DA-\d{8}-\d{4,}$/
    return pattern.test(applicationId)
  }

  /**
   * 解析申请ID获取日期和序号信息
   *
   * @param applicationId 申请ID
   * @returns 解析结果，包含日期字符串和序号
   */
  static parseApplicationId(applicationId: string): {
    dateStr: string;
    sequence: number;
    date: Date
  } | null {
    if (!this.validateFormat(applicationId)) {
      return null
    }

    const parts = applicationId.split('-')
    const dateStr = parts[1]
    const sequenceStr = parts[2]

    try {
      const year = parseInt(dateStr.substring(0, 4), 10)
      const month = parseInt(dateStr.substring(4, 6), 10) - 1 // Date构造函数月份从0开始
      const day = parseInt(dateStr.substring(6, 8), 10)

      const date = new Date(year, month, day)
      const sequence = parseInt(sequenceStr, 10)

      return {
        dateStr,
        sequence,
        date,
      }
    } catch (error) {
      return null
    }
  }

  /**
   * 获取指定日期的申请数量统计
   *
   * @param date 查询日期
   * @returns Promise<number> 该日期的申请数量
   */
  static async getDailyApplicationCount(date: Date): Promise<number> {
    const dateStr = format(date, 'yyyyMMdd')

    const count = await prisma.application.count({
      where: {
        applicationNumber: {
          startsWith: `${this.PREFIX}-${dateStr}-`,
        },
      },
    })

    return count
  }
}