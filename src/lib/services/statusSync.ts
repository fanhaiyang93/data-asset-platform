import { EventEmitter } from 'events'
import { ApplicationStatus } from '@prisma/client'
import { StatusWebSocket, createStatusWebSocket } from '@/lib/websocket/statusWebSocket'
import {
  StatusUpdateEvent,
  ConnectionState,
  StatusSyncConfig,
  StatusChangeLog
} from '@/types/statusTracking'
import { prisma } from '@/lib/prisma'

// 状态同步服务事件类型
export interface StatusSyncEvents {
  'status_updated': (event: StatusUpdateEvent) => void
  'connection_change': (state: ConnectionState) => void
  'sync_error': (error: Error) => void
}

// 状态同步服务类
export class StatusSyncService extends EventEmitter {
  private webSocket: StatusWebSocket
  private pollingTimer: NodeJS.Timeout | null = null
  private isPolling = false
  private subscribedApplications: Set<string> = new Set()

  constructor(config?: Partial<StatusSyncConfig>) {
    super()
    this.webSocket = createStatusWebSocket(config)
    this.setupWebSocketHandlers()
  }

  // 初始化服务
  public async initialize(): Promise<void> {
    try {
      // 尝试建立WebSocket连接
      this.webSocket.connect()

      // 如果WebSocket连接失败，启动轮询备选方案
      setTimeout(() => {
        if (!this.webSocket.isConnected()) {
          console.warn('WebSocket connection failed, falling back to polling')
          this.startPolling()
        }
      }, 5000)
    } catch (error) {
      console.error('Failed to initialize StatusSyncService:', error)
      this.emit('sync_error', error as Error)
      // 启动轮询作为备选方案
      this.startPolling()
    }
  }

  // 订阅申请状态更新
  public subscribeToApplication(applicationId: string): void {
    this.subscribedApplications.add(applicationId)

    // 如果WebSocket已连接，发送订阅消息
    if (this.webSocket.isConnected()) {
      this.webSocket.send({
        type: 'subscribe',
        data: { applicationId },
        timestamp: new Date()
      } as any)
    }
  }

  // 取消订阅申请状态更新
  public unsubscribeFromApplication(applicationId: string): void {
    this.subscribedApplications.delete(applicationId)

    // 如果WebSocket已连接，发送取消订阅消息
    if (this.webSocket.isConnected()) {
      this.webSocket.send({
        type: 'unsubscribe',
        data: { applicationId },
        timestamp: new Date()
      } as any)
    }
  }

  // 广播状态更新
  public async broadcastStatusUpdate(
    applicationId: string,
    newStatus: ApplicationStatus,
    operator?: string,
    reason?: string
  ): Promise<void> {
    const statusUpdate: StatusUpdateEvent = {
      applicationId,
      newStatus,
      timestamp: new Date(),
      operator,
      reason
    }

    try {
      // 记录状态变更日志
      await this.logStatusChange(statusUpdate)

      // 通过WebSocket广播
      if (this.webSocket.isConnected()) {
        this.webSocket.send({
          type: 'status_update',
          data: statusUpdate,
          timestamp: new Date()
        })
      }

      // 触发本地事件
      this.emit('status_updated', statusUpdate)
    } catch (error) {
      console.error('Failed to broadcast status update:', error)
      this.emit('sync_error', error as Error)
    }
  }

  // 手动刷新状态
  public async refreshStatus(applicationId: string): Promise<StatusUpdateEvent | null> {
    try {
      const application = await prisma.application.findUnique({
        where: { id: applicationId },
        select: {
          id: true,
          status: true,
          updatedAt: true,
          reviewerId: true
        }
      })

      if (!application) {
        throw new Error(`Application ${applicationId} not found`)
      }

      const statusUpdate: StatusUpdateEvent = {
        applicationId: application.id,
        newStatus: application.status,
        timestamp: application.updatedAt,
        operator: application.reviewerId || undefined
      }

      this.emit('status_updated', statusUpdate)
      return statusUpdate
    } catch (error) {
      console.error('Failed to refresh status:', error)
      this.emit('sync_error', error as Error)
      return null
    }
  }

  // 获取连接状态
  public getConnectionState(): ConnectionState {
    return this.webSocket.getConnectionState()
  }

  // 启动轮询备选方案
  private startPolling(): void {
    if (this.isPolling) return

    this.isPolling = true
    const pollInterval = 5000 // 5秒轮询一次

    this.pollingTimer = setInterval(async () => {
      try {
        // 轮询已订阅的申请状态
        for (const applicationId of this.subscribedApplications) {
          await this.refreshStatus(applicationId)
        }
      } catch (error) {
        console.error('Polling error:', error)
        this.emit('sync_error', error as Error)
      }
    }, pollInterval)

    console.log('Started status polling fallback')
  }

  // 停止轮询
  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = null
    }
    this.isPolling = false
    console.log('Stopped status polling')
  }

  // 记录状态变更日志
  private async logStatusChange(statusUpdate: StatusUpdateEvent): Promise<void> {
    try {
      // 获取当前状态
      const currentApplication = await prisma.application.findUnique({
        where: { id: statusUpdate.applicationId },
        select: { status: true }
      })

      if (!currentApplication) {
        throw new Error(`Application ${statusUpdate.applicationId} not found`)
      }

      // 如果状态有变化，记录日志
      if (currentApplication.status !== statusUpdate.newStatus) {
        await prisma.applicationStatusLog.create({
          data: {
            applicationId: statusUpdate.applicationId,
            fromStatus: currentApplication.status,
            toStatus: statusUpdate.newStatus,
            operator: statusUpdate.operator,
            reason: statusUpdate.reason,
            timestamp: statusUpdate.timestamp,
            metadata: statusUpdate.metadata as any
          }
        })
      }
    } catch (error) {
      console.error('Failed to log status change:', error)
      // 不抛出错误，因为日志记录失败不应该影响主要功能
    }
  }

  // 设置WebSocket事件处理器
  private setupWebSocketHandlers(): void {
    this.webSocket.on('status_update', (event: StatusUpdateEvent) => {
      this.emit('status_updated', event)
    })

    this.webSocket.on('connection_change', (state: ConnectionState) => {
      this.emit('connection_change', state)

      // 根据连接状态调整同步策略
      if (state.isConnected) {
        this.stopPolling()
        // 重新订阅所有申请
        for (const applicationId of this.subscribedApplications) {
          this.subscribeToApplication(applicationId)
        }
      } else {
        // 连接断开时启动轮询备选方案
        this.startPolling()
      }
    })

    this.webSocket.on('error', (error: Error) => {
      this.emit('sync_error', error)
    })
  }

  // 销毁服务
  public destroy(): void {
    this.stopPolling()
    this.webSocket.destroy()
    this.subscribedApplications.clear()
    this.removeAllListeners()
  }
}

// 全局状态同步服务实例
let globalStatusSyncService: StatusSyncService | null = null

// 获取全局状态同步服务实例
export function getStatusSyncService(config?: Partial<StatusSyncConfig>): StatusSyncService {
  if (!globalStatusSyncService) {
    globalStatusSyncService = new StatusSyncService(config)
  }
  return globalStatusSyncService
}

// 清理全局实例（主要用于测试）
export function resetStatusSyncService(): void {
  if (globalStatusSyncService) {
    globalStatusSyncService.destroy()
    globalStatusSyncService = null
  }
}