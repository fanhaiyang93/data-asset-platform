/**
 * 状态同步服务
 * 负责申请状态的双向同步,实时监听状态变更
 */

import {
  ApplicationStatus,
  StatusUpdate,
  StatusUpdateCallback,
  SyncResult
} from '@/types/integration'
import { DataPlatformClient } from '../client/dataPlatformClient'
import { StatusMapper } from '../mapping/statusMapper'
import { ConflictResolver } from './conflictResolver'

/**
 * 同步配置
 */
export interface SyncConfig {
  syncInterval?: number // 同步间隔(毫秒),默认30秒
  enableRealTime?: boolean // 是否启用实时同步,默认true
  batchSize?: number // 批量同步的最大数量,默认50
  retryOnError?: boolean // 错误时是否重试,默认true
  maxRetries?: number // 最大重试次数,默认3
}

/**
 * 本地申请数据接口
 */
export interface LocalApplication {
  id: string
  platformApplicationId?: string
  status: ApplicationStatus
  lastUpdated: Date
  version?: number
}

/**
 * 同步统计
 */
export interface SyncStatistics {
  totalSynced: number
  successCount: number
  failureCount: number
  conflictCount: number
  lastSyncTime: Date
  averageSyncDuration: number
}

/**
 * 状态同步服务类
 */
export class StatusSyncService {
  private client: DataPlatformClient
  private statusMapper: StatusMapper
  private conflictResolver: ConflictResolver
  private config: SyncConfig
  private syncTimer: NodeJS.Timeout | null = null
  private isRunning: boolean = false
  private statistics: SyncStatistics

  constructor(
    client: DataPlatformClient,
    config: SyncConfig = {}
  ) {
    this.client = client
    this.statusMapper = new StatusMapper()
    this.conflictResolver = new ConflictResolver()

    this.config = {
      syncInterval: 30000, // 30秒
      enableRealTime: true,
      batchSize: 50,
      retryOnError: true,
      maxRetries: 3,
      ...config
    }

    this.statistics = {
      totalSynced: 0,
      successCount: 0,
      failureCount: 0,
      conflictCount: 0,
      lastSyncTime: new Date(),
      averageSyncDuration: 0
    }
  }

  /**
   * 启动同步服务
   */
  async startSync(): Promise<void> {
    if (this.isRunning) {
      console.warn('[StatusSyncService] 同步服务已在运行')
      return
    }

    this.isRunning = true
    console.log('[StatusSyncService] 同步服务启动')

    // 订阅实时更新
    if (this.config.enableRealTime) {
      this.subscribeToRemoteUpdates()
    }

    // 启动定期全量同步
    this.startPeriodicSync()
  }

  /**
   * 停止同步服务
   */
  stopSync(): void {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false

    // 停止定期同步
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }

    // 取消订阅
    this.client.unsubscribeStatusUpdates()

    console.log('[StatusSyncService] 同步服务已停止')
  }

  /**
   * 手动触发全量同步
   */
  async performFullSync(applicationIds: string[]): Promise<SyncResult> {
    const startTime = Date.now()
    console.log(`[StatusSyncService] 开始全量同步,共 ${applicationIds.length} 个申请`)

    try {
      // 批量同步
      const result = await this.client.syncStatus(applicationIds)

      // 更新统计信息
      this.updateStatistics(result, Date.now() - startTime)

      console.log('[StatusSyncService] 全量同步完成:', result)
      return result

    } catch (error) {
      console.error('[StatusSyncService] 全量同步失败:', error)
      return {
        successful: 0,
        failed: applicationIds.length,
        details: applicationIds.map(id => ({
          applicationId: id,
          success: false,
          error: error instanceof Error ? error.message : '同步失败'
        }))
      }
    }
  }

  /**
   * 同步单个申请状态
   */
  async syncSingleApplication(applicationId: string): Promise<boolean> {
    try {
      const status = await this.client.getApplicationStatus(applicationId)

      // TODO: 更新本地数据库
      console.log(`[StatusSyncService] 申请 ${applicationId} 状态已同步: ${status}`)

      return true

    } catch (error) {
      console.error(`[StatusSyncService] 申请 ${applicationId} 状态同步失败:`, error)
      return false
    }
  }

  /**
   * 处理状态更新
   */
  async handleStatusUpdate(update: StatusUpdate): Promise<void> {
    console.log('[StatusSyncService] 收到状态更新:', update)

    try {
      // 获取本地申请数据
      const localApplication = await this.getLocalApplication(update.applicationId)

      if (!localApplication) {
        console.warn(`[StatusSyncService] 未找到本地申请: ${update.applicationId}`)
        return
      }

      // 检测冲突
      if (this.hasConflict(localApplication, update)) {
        await this.resolveConflict(localApplication, update)
      } else {
        await this.updateLocalStatus(update)
      }

      // 更新统计
      this.statistics.successCount++
      this.statistics.totalSynced++

    } catch (error) {
      console.error('[StatusSyncService] 处理状态更新失败:', error)
      this.statistics.failureCount++
      throw error
    }
  }

  /**
   * 订阅远程状态更新
   */
  private subscribeToRemoteUpdates(): void {
    const callback: StatusUpdateCallback = async (update) => {
      try {
        await this.handleStatusUpdate(update)
      } catch (error) {
        console.error('[StatusSyncService] 状态更新处理错误:', error)

        // 如果启用重试,加入重试队列
        if (this.config.retryOnError) {
          await this.retryStatusUpdate(update)
        }
      }
    }

    this.client.subscribeStatusUpdates(callback)
    console.log('[StatusSyncService] 已订阅实时状态更新')
  }

  /**
   * 启动定期同步
   */
  private startPeriodicSync(): void {
    if (this.syncTimer) {
      return
    }

    const interval = this.config.syncInterval || 30000

    this.syncTimer = setInterval(async () => {
      if (!this.isRunning) {
        return
      }

      try {
        // 获取需要同步的申请ID列表
        const applicationIds = await this.getPendingApplicationIds()

        if (applicationIds.length > 0) {
          await this.performFullSync(applicationIds)
        }
      } catch (error) {
        console.error('[StatusSyncService] 定期同步错误:', error)
      }
    }, interval)

    console.log(`[StatusSyncService] 定期同步已启动,间隔: ${interval}ms`)
  }

  /**
   * 检测同步冲突
   */
  private hasConflict(
    localApplication: LocalApplication,
    remoteUpdate: StatusUpdate
  ): boolean {
    // 检查本地和远程状态是否不一致
    if (localApplication.status === remoteUpdate.newStatus) {
      return false
    }

    // 检查更新时间
    if (localApplication.lastUpdated > remoteUpdate.updatedAt) {
      console.warn('[StatusSyncService] 检测到同步冲突: 本地更新时间晚于远程')
      return true
    }

    // 检查版本号
    if (localApplication.version !== undefined) {
      console.warn('[StatusSyncService] 检测到同步冲突: 版本不一致')
      return true
    }

    return false
  }

  /**
   * 解决同步冲突
   */
  private async resolveConflict(
    localApplication: LocalApplication,
    remoteUpdate: StatusUpdate
  ): Promise<void> {
    console.log('[StatusSyncService] 开始解决同步冲突')

    try {
      const resolution = await this.conflictResolver.resolve(
        localApplication,
        remoteUpdate
      )

      if (resolution.useRemote) {
        // 使用远程状态
        await this.updateLocalStatus(remoteUpdate)
        console.log('[StatusSyncService] 冲突解决: 使用远程状态')
      } else if (resolution.useLocal) {
        // 使用本地状态,推送到远程
        await this.pushLocalStatusToRemote(localApplication)
        console.log('[StatusSyncService] 冲突解决: 使用本地状态')
      } else if (resolution.merge) {
        // 合并状态
        await this.mergeStatuses(localApplication, remoteUpdate)
        console.log('[StatusSyncService] 冲突解决: 合并状态')
      }

      this.statistics.conflictCount++

    } catch (error) {
      console.error('[StatusSyncService] 冲突解决失败:', error)
      throw error
    }
  }

  /**
   * 更新本地状态
   */
  private async updateLocalStatus(update: StatusUpdate): Promise<void> {
    console.log(`[StatusSyncService] 更新本地状态: ${update.applicationId} -> ${update.newStatus}`)

    // TODO: 实际项目中应该更新数据库
    // await database.applications.update({
    //   where: { id: update.applicationId },
    //   data: {
    //     status: update.newStatus,
    //     lastUpdated: update.updatedAt
    //   }
    // })
  }

  /**
   * 推送本地状态到远程
   */
  private async pushLocalStatusToRemote(
    localApplication: LocalApplication
  ): Promise<void> {
    console.log(`[StatusSyncService] 推送本地状态到远程: ${localApplication.id}`)

    // TODO: 实际项目中应该调用API推送状态
    // await this.client.updateApplicationStatus(
    //   localApplication.id,
    //   localApplication.status
    // )
  }

  /**
   * 合并状态
   */
  private async mergeStatuses(
    localApplication: LocalApplication,
    remoteUpdate: StatusUpdate
  ): Promise<void> {
    console.log(`[StatusSyncService] 合并状态: ${localApplication.id}`)

    // 简单的合并策略: 使用更新时间晚的状态
    if (localApplication.lastUpdated > remoteUpdate.updatedAt) {
      await this.pushLocalStatusToRemote(localApplication)
    } else {
      await this.updateLocalStatus(remoteUpdate)
    }
  }

  /**
   * 重试状态更新
   */
  private async retryStatusUpdate(
    update: StatusUpdate,
    retryCount: number = 0
  ): Promise<void> {
    const maxRetries = this.config.maxRetries || 3

    if (retryCount >= maxRetries) {
      console.error(`[StatusSyncService] 状态更新重试失败,已达到最大次数: ${update.applicationId}`)
      return
    }

    // 指数退避延迟
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000)
    await new Promise(resolve => setTimeout(resolve, delay))

    try {
      await this.handleStatusUpdate(update)
      console.log(`[StatusSyncService] 状态更新重试成功: ${update.applicationId}`)
    } catch (error) {
      console.error(`[StatusSyncService] 状态更新重试失败(${retryCount + 1}/${maxRetries}):`, error)
      await this.retryStatusUpdate(update, retryCount + 1)
    }
  }

  /**
   * 获取本地申请数据(模拟实现)
   */
  private async getLocalApplication(applicationId: string): Promise<LocalApplication | null> {
    // TODO: 实际项目中应该从数据库读取
    // return await database.applications.findUnique({
    //   where: { id: applicationId }
    // })

    // 模拟数据
    return {
      id: applicationId,
      status: ApplicationStatus.PENDING,
      lastUpdated: new Date(),
      version: 1
    }
  }

  /**
   * 获取待同步的申请ID列表(模拟实现)
   */
  private async getPendingApplicationIds(): Promise<string[]> {
    // TODO: 实际项目中应该从数据库查询活跃的申请
    // return await database.applications.findMany({
    //   where: {
    //     status: {
    //       in: [ApplicationStatus.PENDING, ApplicationStatus.IN_REVIEW]
    //     }
    //   },
    //   select: { id: true }
    // }).then(apps => apps.map(app => app.id))

    return []
  }

  /**
   * 更新统计信息
   */
  private updateStatistics(result: SyncResult, duration: number): void {
    this.statistics.totalSynced += result.successful + result.failed
    this.statistics.successCount += result.successful
    this.statistics.failureCount += result.failed
    this.statistics.lastSyncTime = new Date()

    // 计算平均同步时长
    const totalDuration = this.statistics.averageSyncDuration * (this.statistics.totalSynced - result.successful - result.failed)
    this.statistics.averageSyncDuration = (totalDuration + duration) / this.statistics.totalSynced
  }

  /**
   * 获取同步统计信息
   */
  getStatistics(): SyncStatistics {
    return { ...this.statistics }
  }

  /**
   * 重置统计信息
   */
  resetStatistics(): void {
    this.statistics = {
      totalSynced: 0,
      successCount: 0,
      failureCount: 0,
      conflictCount: 0,
      lastSyncTime: new Date(),
      averageSyncDuration: 0
    }
  }

  /**
   * 检查同步服务是否运行中
   */
  isActive(): boolean {
    return this.isRunning
  }
}

/**
 * 创建状态同步服务实例
 */
export function createStatusSyncService(
  client: DataPlatformClient,
  config?: SyncConfig
): StatusSyncService {
  return new StatusSyncService(client, config)
}
