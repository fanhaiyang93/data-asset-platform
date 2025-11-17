import { EventEmitter } from 'events'
import { WebSocketMessage, StatusUpdateEvent, ConnectionState, StatusSyncConfig } from '@/types/statusTracking'

// WebSocket事件类型
export interface StatusWebSocketEvents {
  'status_update': (event: StatusUpdateEvent) => void
  'connection_change': (state: ConnectionState) => void
  'error': (error: Error) => void
  'message': (message: WebSocketMessage) => void
}

// 状态WebSocket管理类
export class StatusWebSocket extends EventEmitter {
  private ws: WebSocket | null = null
  private config: StatusSyncConfig
  private connectionState: ConnectionState = {
    isConnected: false,
    reconnectAttempts: 0
  }
  private heartbeatTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private isReconnecting = false

  constructor(config: StatusSyncConfig) {
    super()
    this.config = config
  }

  // 建立WebSocket连接
  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return
    }

    try {
      this.ws = new WebSocket(this.config.websocketUrl)
      this.setupEventHandlers()
    } catch (error) {
      this.handleError(new Error(`Failed to create WebSocket connection: ${error}`))
    }
  }

  // 断开连接
  public disconnect(): void {
    this.isReconnecting = false
    this.clearTimers()

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }

    this.updateConnectionState({
      isConnected: false,
      lastDisconnected: new Date()
    })
  }

  // 发送消息
  public send(message: WebSocketMessage): void {
    if (!this.isConnected()) {
      throw new Error('WebSocket is not connected')
    }

    try {
      this.ws!.send(JSON.stringify(message))
    } catch (error) {
      this.handleError(new Error(`Failed to send message: ${error}`))
    }
  }

  // 检查连接状态
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  // 获取连接状态
  public getConnectionState(): ConnectionState {
    return { ...this.connectionState }
  }

  // 设置WebSocket事件处理器
  private setupEventHandlers(): void {
    if (!this.ws) return

    this.ws.onopen = () => {
      console.log('WebSocket connected')
      this.updateConnectionState({
        isConnected: true,
        lastConnected: new Date(),
        reconnectAttempts: 0,
        error: undefined
      })

      this.startHeartbeat()
      this.emit('connection_change', this.connectionState)
    }

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        this.handleMessage(message)
      } catch (error) {
        this.handleError(new Error(`Failed to parse message: ${error}`))
      }
    }

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason)
      this.updateConnectionState({
        isConnected: false,
        lastDisconnected: new Date(),
        error: event.code !== 1000 ? `Connection closed: ${event.reason}` : undefined
      })

      this.clearTimers()
      this.emit('connection_change', this.connectionState)

      // 自动重连（除非是主动断开）
      if (!this.isReconnecting && event.code !== 1000) {
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = (event) => {
      const error = new Error('WebSocket error occurred')
      this.handleError(error)
    }
  }

  // 处理收到的消息
  private handleMessage(message: WebSocketMessage): void {
    this.emit('message', message)

    switch (message.type) {
      case 'status_update':
        if (message.data && 'applicationId' in message.data) {
          this.emit('status_update', message.data as StatusUpdateEvent)
        }
        break

      case 'connection_established':
        console.log('Connection established with server')
        break

      case 'ping':
        // 响应心跳ping
        this.send({
          type: 'pong',
          timestamp: new Date()
        })
        break

      case 'error':
        if (message.data && 'message' in message.data) {
          this.handleError(new Error(message.data.message))
        }
        break

      default:
        console.warn('Unknown message type:', message.type)
    }
  }

  // 开始心跳检测
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send({
          type: 'ping',
          timestamp: new Date()
        })
      }
    }, this.config.heartbeatInterval)
  }

  // 调度重连
  private scheduleReconnect(): void {
    if (this.connectionState.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      this.updateConnectionState({
        error: 'Max reconnection attempts reached'
      })
      return
    }

    this.isReconnecting = true
    const delay = Math.min(1000 * Math.pow(2, this.connectionState.reconnectAttempts), 30000)

    console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.connectionState.reconnectAttempts + 1})`)

    this.reconnectTimer = setTimeout(() => {
      this.updateConnectionState({
        reconnectAttempts: this.connectionState.reconnectAttempts + 1
      })
      this.connect()
    }, delay)
  }

  // 更新连接状态
  private updateConnectionState(updates: Partial<ConnectionState>): void {
    this.connectionState = {
      ...this.connectionState,
      ...updates
    }
  }

  // 处理错误
  private handleError(error: Error): void {
    console.error('WebSocket error:', error)
    this.updateConnectionState({
      error: error.message
    })
    this.emit('error', error)
  }

  // 清理定时器
  private clearTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  // 销毁实例
  public destroy(): void {
    this.disconnect()
    this.removeAllListeners()
  }
}

// 默认配置
export const defaultStatusSyncConfig: StatusSyncConfig = {
  websocketUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/status',
  fallbackPollingInterval: 5000,  // 5秒
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000,       // 30秒
  messageTimeout: 10000           // 10秒
}

// 创建WebSocket实例的工厂函数
export function createStatusWebSocket(config?: Partial<StatusSyncConfig>): StatusWebSocket {
  const finalConfig = { ...defaultStatusSyncConfig, ...config }
  return new StatusWebSocket(finalConfig)
}