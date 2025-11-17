import { ApplicationStatus, Application, Asset } from '@prisma/client'
import { TimeEstimation } from '@/types/statusTracking'
import { prisma } from '@/lib/prisma'

// 扩展Application类型
type ApplicationWithAsset = Application & {
  asset: Asset
}

// 工作日计算配置
interface WorkingDayConfig {
  workingDays: number[] // 0=周日，1=周一...6=周六
  workingHours: {
    start: number // 24小时制，如9表示9:00
    end: number   // 24小时制，如18表示18:00
  }
  holidays: Date[] // 节假日列表
}

// 默认工作日配置（周一到周五，9:00-18:00）
const defaultWorkingDayConfig: WorkingDayConfig = {
  workingDays: [1, 2, 3, 4, 5],
  workingHours: {
    start: 9,
    end: 18
  },
  holidays: [] // 实际项目中应该从配置或API获取
}

// 时间预估服务类
export class TimeEstimationService {
  private workingDayConfig: WorkingDayConfig

  constructor(config?: Partial<WorkingDayConfig>) {
    this.workingDayConfig = { ...defaultWorkingDayConfig, ...config }
  }

  // 预估申请完成时间
  public async estimateCompletionTime(application: ApplicationWithAsset): Promise<TimeEstimation> {
    try {
      // 如果申请已经完成，返回实际完成时间
      if (application.status === 'APPROVED' || application.status === 'REJECTED') {
        return {
          estimatedCompletionTime: application.reviewedAt || application.updatedAt,
          confidence: 1.0,
          baseProcessingTime: 0,
          queueDelay: 0,
          holidayAdjustment: 0,
          factors: {
            assetType: application.asset.type,
            reviewerWorkload: 0,
            historicalAverage: 0
          }
        }
      }

      // 计算基础处理时间
      const baseProcessingTime = await this.calculateBaseProcessingTime(application.asset.type)

      // 计算队列延迟
      const queueDelay = await this.calculateQueueDelay()

      // 计算节假日调整
      const holidayAdjustment = this.calculateHolidayAdjustment(baseProcessingTime + queueDelay)

      // 计算审核人工作负载
      const reviewerWorkload = await this.calculateReviewerWorkload()

      // 计算历史平均时间
      const historicalAverage = await this.calculateHistoricalAverage(application.asset.type)

      // 总预估时间（分钟）
      const totalMinutes = baseProcessingTime + queueDelay + holidayAdjustment

      // 计算预估完成时间
      const estimatedCompletionTime = this.calculateWorkingDateTime(new Date(), totalMinutes)

      // 计算置信度
      const confidence = this.calculateConfidence({
        baseProcessingTime,
        queueDelay,
        reviewerWorkload,
        historicalAverage
      })

      return {
        estimatedCompletionTime,
        confidence,
        baseProcessingTime,
        queueDelay,
        holidayAdjustment,
        factors: {
          assetType: application.asset.type,
          reviewerWorkload,
          historicalAverage
        }
      }
    } catch (error) {
      console.error('Failed to estimate completion time:', error)

      // 返回默认预估（24小时）
      return {
        estimatedCompletionTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        confidence: 0.5,
        baseProcessingTime: 1440, // 24小时
        queueDelay: 0,
        holidayAdjustment: 0,
        factors: {
          assetType: application.asset.type,
          reviewerWorkload: 0,
          historicalAverage: 0
        }
      }
    }
  }

  // 计算基础处理时间
  private async calculateBaseProcessingTime(assetType: string): Promise<number> {
    try {
      // 查询历史数据计算基础处理时间
      const historicalData = await prisma.applicationStatusLog.findMany({
        where: {
          fromStatus: 'PENDING',
          toStatus: { in: ['APPROVED', 'REJECTED'] },
          application: {
            asset: { type: assetType }
          }
        },
        include: {
          application: {
            select: {
              submittedAt: true,
              reviewedAt: true
            }
          }
        },
        orderBy: { timestamp: 'desc' },
        take: 50 // 取最近50条记录
      })

      if (historicalData.length === 0) {
        // 没有历史数据时返回默认值
        return this.getDefaultProcessingTime(assetType)
      }

      // 计算实际处理时间
      const processingTimes = historicalData
        .filter(log => log.application.submittedAt && log.application.reviewedAt)
        .map(log => {
          const submitted = log.application.submittedAt!
          const reviewed = log.application.reviewedAt!
          return this.calculateWorkingMinutes(submitted, reviewed)
        })

      if (processingTimes.length === 0) {
        return this.getDefaultProcessingTime(assetType)
      }

      // 计算平均处理时间，并过滤异常值
      const sorted = processingTimes.sort((a, b) => a - b)
      const q1 = sorted[Math.floor(sorted.length * 0.25)]
      const q3 = sorted[Math.floor(sorted.length * 0.75)]
      const iqr = q3 - q1
      const lowerBound = q1 - 1.5 * iqr
      const upperBound = q3 + 1.5 * iqr

      const filteredTimes = sorted.filter(time => time >= lowerBound && time <= upperBound)
      const averageTime = filteredTimes.reduce((sum, time) => sum + time, 0) / filteredTimes.length

      return Math.max(averageTime, 60) // 最少1小时
    } catch (error) {
      console.error('Failed to calculate base processing time:', error)
      return this.getDefaultProcessingTime(assetType)
    }
  }

  // 获取默认处理时间
  private getDefaultProcessingTime(assetType: string): number {
    const defaultTimes = {
      'database': 4 * 60,      // 4小时
      'api': 2 * 60,           // 2小时
      'file': 1 * 60,          // 1小时
      'service': 3 * 60,       // 3小时
      'report': 6 * 60,        // 6小时
    }

    return defaultTimes[assetType as keyof typeof defaultTimes] || 2 * 60 // 默认2小时
  }

  // 计算队列延迟
  private async calculateQueueDelay(): Promise<number> {
    try {
      // 查询当前待审核申请数量
      const pendingCount = await prisma.application.count({
        where: { status: 'PENDING' }
      })

      // 查询活跃审核人数量
      const activeReviewers = await prisma.user.count({
        where: {
          role: { in: ['ASSET_MANAGER', 'SYSTEM_ADMIN'] },
          lastLoginAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 一周内活跃
          }
        }
      })

      if (activeReviewers === 0) {
        return pendingCount * 60 // 每个申请1小时延迟
      }

      // 计算平均每个审核人的负载
      const averageLoad = pendingCount / activeReviewers

      // 队列延迟 = 平均负载 * 平均处理时间
      const averageProcessingTime = 2 * 60 // 2小时
      return Math.floor(averageLoad * averageProcessingTime * 0.5) // 50%的负载影响
    } catch (error) {
      console.error('Failed to calculate queue delay:', error)
      return 0
    }
  }

  // 计算节假日调整
  private calculateHolidayAdjustment(baseMinutes: number): number {
    const now = new Date()
    const estimatedEnd = new Date(now.getTime() + baseMinutes * 60 * 1000)

    // 计算期间的非工作时间
    let adjustmentMinutes = 0
    const current = new Date(now)

    while (current < estimatedEnd) {
      // 检查是否是工作日
      const dayOfWeek = current.getDay()
      if (!this.workingDayConfig.workingDays.includes(dayOfWeek)) {
        adjustmentMinutes += 24 * 60 // 非工作日加24小时
      } else {
        // 检查是否是节假日
        if (this.isHoliday(current)) {
          adjustmentMinutes += 24 * 60 // 节假日加24小时
        } else {
          // 检查是否在工作时间外
          const hour = current.getHours()
          if (hour < this.workingDayConfig.workingHours.start ||
              hour >= this.workingDayConfig.workingHours.end) {
            // 非工作时间不计入处理时间
          }
        }
      }
      current.setDate(current.getDate() + 1)
    }

    return adjustmentMinutes
  }

  // 计算审核人工作负载
  private async calculateReviewerWorkload(): Promise<number> {
    try {
      const recentReviews = await prisma.application.count({
        where: {
          reviewedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 最近24小时
          }
        }
      })

      const activeReviewers = await prisma.user.count({
        where: {
          role: { in: ['ASSET_MANAGER', 'SYSTEM_ADMIN'] },
          lastLoginAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      })

      return activeReviewers > 0 ? recentReviews / activeReviewers : 0
    } catch (error) {
      console.error('Failed to calculate reviewer workload:', error)
      return 0
    }
  }

  // 计算历史平均时间
  private async calculateHistoricalAverage(assetType: string): Promise<number> {
    try {
      const recentApplications = await prisma.application.findMany({
        where: {
          asset: { type: assetType },
          status: { in: ['APPROVED', 'REJECTED'] },
          submittedAt: { not: null },
          reviewedAt: { not: null }
        },
        select: {
          submittedAt: true,
          reviewedAt: true
        },
        orderBy: { reviewedAt: 'desc' },
        take: 30
      })

      if (recentApplications.length === 0) {
        return 0
      }

      const totalMinutes = recentApplications.reduce((sum, app) => {
        if (app.submittedAt && app.reviewedAt) {
          return sum + this.calculateWorkingMinutes(app.submittedAt, app.reviewedAt)
        }
        return sum
      }, 0)

      return totalMinutes / recentApplications.length
    } catch (error) {
      console.error('Failed to calculate historical average:', error)
      return 0
    }
  }

  // 计算置信度
  private calculateConfidence(factors: {
    baseProcessingTime: number
    queueDelay: number
    reviewerWorkload: number
    historicalAverage: number
  }): number {
    let confidence = 0.8 // 基础置信度

    // 历史数据越多，置信度越高
    if (factors.historicalAverage > 0) {
      confidence += 0.1
    }

    // 队列延迟较少时置信度更高
    if (factors.queueDelay < 60) { // 少于1小时
      confidence += 0.1
    }

    // 审核人工作负载适中时置信度更高
    if (factors.reviewerWorkload > 0 && factors.reviewerWorkload < 5) {
      confidence += 0.05
    }

    return Math.min(confidence, 1.0)
  }

  // 计算工作时间内的分钟数
  private calculateWorkingMinutes(startDate: Date, endDate: Date): number {
    let workingMinutes = 0
    const current = new Date(startDate)

    while (current < endDate) {
      const dayOfWeek = current.getDay()
      const hour = current.getHours()

      // 检查是否是工作日和工作时间
      if (this.workingDayConfig.workingDays.includes(dayOfWeek) &&
          !this.isHoliday(current) &&
          hour >= this.workingDayConfig.workingHours.start &&
          hour < this.workingDayConfig.workingHours.end) {
        workingMinutes++
      }

      current.setMinutes(current.getMinutes() + 1)
    }

    return workingMinutes
  }

  // 计算工作时间内的日期时间
  private calculateWorkingDateTime(startDate: Date, minutes: number): Date {
    const result = new Date(startDate)
    let remainingMinutes = minutes

    while (remainingMinutes > 0) {
      const dayOfWeek = result.getDay()
      const hour = result.getHours()

      // 如果是工作时间，减少剩余分钟数
      if (this.workingDayConfig.workingDays.includes(dayOfWeek) &&
          !this.isHoliday(result) &&
          hour >= this.workingDayConfig.workingHours.start &&
          hour < this.workingDayConfig.workingHours.end) {
        remainingMinutes--
      }

      result.setMinutes(result.getMinutes() + 1)

      // 避免无限循环
      if (result.getTime() > startDate.getTime() + 30 * 24 * 60 * 60 * 1000) {
        break
      }
    }

    return result
  }

  // 检查是否是节假日
  private isHoliday(date: Date): boolean {
    return this.workingDayConfig.holidays.some(holiday =>
      holiday.toDateString() === date.toDateString()
    )
  }

  // 更新工作日配置
  public updateWorkingDayConfig(config: Partial<WorkingDayConfig>): void {
    this.workingDayConfig = { ...this.workingDayConfig, ...config }
  }

  // 获取当前工作日配置
  public getWorkingDayConfig(): WorkingDayConfig {
    return { ...this.workingDayConfig }
  }
}

// 全局时间预估服务实例
let globalTimeEstimationService: TimeEstimationService | null = null

// 获取全局时间预估服务实例
export function getTimeEstimationService(config?: Partial<WorkingDayConfig>): TimeEstimationService {
  if (!globalTimeEstimationService) {
    globalTimeEstimationService = new TimeEstimationService(config)
  }
  return globalTimeEstimationService
}

// 重置全局实例（用于测试）
export function resetTimeEstimationService(): void {
  globalTimeEstimationService = null
}