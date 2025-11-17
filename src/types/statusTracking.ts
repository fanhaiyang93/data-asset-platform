import { ApplicationStatus } from '@prisma/client'

// 状态更新事件类型
export interface StatusUpdateEvent {
  applicationId: string
  newStatus: ApplicationStatus
  timestamp: Date
  operator?: string
  reason?: string
  metadata?: Record<string, any>
}

// WebSocket消息类型
export interface WebSocketMessage {
  type: 'status_update' | 'connection_established' | 'error' | 'ping' | 'pong'
  data?: StatusUpdateEvent | { message: string } | null
  timestamp: Date
}

// 通知渠道类型
export type NotificationChannel = 'email' | 'wechat' | 'push' | 'in_app'

// 通知偏好设置
export interface NotificationPreference {
  userId: string
  channels: NotificationChannel[]
  silentHours?: {
    start: string // HH:mm格式
    end: string   // HH:mm格式
  }
  forceNotifyOnStatus?: ApplicationStatus[]
}

// 状态变更日志
export interface StatusChangeLog {
  id: string
  applicationId: string
  fromStatus: ApplicationStatus
  toStatus: ApplicationStatus
  operator?: string
  reason?: string
  timestamp: Date
  metadata?: Record<string, any>
}

// 时间预估结果
export interface TimeEstimation {
  estimatedCompletionTime: Date
  confidence: number // 0-1之间的置信度
  baseProcessingTime: number // 基础处理时间（分钟）
  queueDelay: number        // 队列延迟（分钟）
  holidayAdjustment: number // 节假日调整（分钟）
  factors: {
    assetType: string
    reviewerWorkload: number
    historicalAverage: number
  }
}

// WebSocket连接状态
export interface ConnectionState {
  isConnected: boolean
  reconnectAttempts: number
  lastConnected?: Date
  lastDisconnected?: Date
  error?: string
}

// 状态同步配置
export interface StatusSyncConfig {
  websocketUrl: string
  fallbackPollingInterval: number // 毫秒
  maxReconnectAttempts: number
  heartbeatInterval: number // 毫秒
  messageTimeout: number    // 毫秒
}