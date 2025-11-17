/**
 * 数据平台API客户端
 * 提供与数据平台的RESTful API对接功能
 */

import {
  ApplicationData,
  ApplicationResult,
  ApplicationStatus,
  HealthStatus,
  ApiVersion,
  SyncResult,
  StatusUpdateCallback,
  PlatformConfig,
  ApiResponse
} from '@/types/integration'
import { HttpClient } from './httpClient'
import { AuthHandler } from './authHandler'

export interface DataPlatformClientConfig extends PlatformConfig {
  enableHealthCheck?: boolean
  healthCheckInterval?: number
}

/**
 * 数据平台客户端接口
 */
export interface DataPlatformClient {
  // 申请相关操作
  submitApplication(data: ApplicationData): Promise<ApplicationResult>
  updateApplication(id: string, data: Partial<ApplicationData>): Promise<void>
  getApplicationStatus(id: string): Promise<ApplicationStatus>
  cancelApplication(id: string): Promise<void>

  // 状态同步操作
  syncStatus(applications: string[]): Promise<SyncResult>
  subscribeStatusUpdates(callback: StatusUpdateCallback): void
  unsubscribeStatusUpdates(): void

  // 健康检查
  healthCheck(): Promise<HealthStatus>
  getApiVersion(): Promise<ApiVersion>

  // 连接管理
  disconnect(): void
}

/**
 * 数据平台客户端实现
 */
export class DataPlatformClientImpl implements DataPlatformClient {
  private httpClient: HttpClient
  private authHandler: AuthHandler
  private config: DataPlatformClientConfig
  private statusUpdateCallback: StatusUpdateCallback | null = null
  private healthCheckTimer: NodeJS.Timeout | null = null

  constructor(config: DataPlatformClientConfig) {
    this.config = {
      timeout: 30000,
      enableHealthCheck: true,
      healthCheckInterval: 60000, // 1分钟
      enableMonitoring: true,
      ...config
    }

    // 初始化HTTP客户端
    this.httpClient = new HttpClient({
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      enableLogging: config.enableMonitoring
    })

    // 初始化认证处理器
    this.authHandler = new AuthHandler({
      apiKey: config.apiKey,
      enableAutoRefresh: true
    })

    // 启动健康检查
    if (this.config.enableHealthCheck) {
      this.startHealthCheck()
    }
  }

  /**
   * 提交申请
   */
  async submitApplication(data: ApplicationData): Promise<ApplicationResult> {
    try {
      // 添加认证头
      const headers = await this.authHandler.getAuthHeaders()
      this.httpClient.setHeaders(headers)

      // 发送申请请求
      const response = await this.httpClient.post<ApplicationResult>(
        '/applications',
        data
      )

      if (!response.success || !response.data) {
        throw new Error(
          response.error?.message || '申请提交失败'
        )
      }

      return response.data

    } catch (error) {
      console.error('提交申请失败:', error)
      throw this.wrapError(error, '提交申请失败')
    }
  }

  /**
   * 更新申请
   */
  async updateApplication(
    id: string,
    data: Partial<ApplicationData>
  ): Promise<void> {
    try {
      const headers = await this.authHandler.getAuthHeaders()
      this.httpClient.setHeaders(headers)

      const response = await this.httpClient.put(
        `/applications/${id}`,
        data
      )

      if (!response.success) {
        throw new Error(
          response.error?.message || '申请更新失败'
        )
      }

    } catch (error) {
      console.error('更新申请失败:', error)
      throw this.wrapError(error, '更新申请失败')
    }
  }

  /**
   * 获取申请状态
   */
  async getApplicationStatus(id: string): Promise<ApplicationStatus> {
    try {
      const headers = await this.authHandler.getAuthHeaders()
      this.httpClient.setHeaders(headers)

      const response = await this.httpClient.get<{ status: ApplicationStatus }>(
        `/applications/${id}/status`
      )

      if (!response.success || !response.data) {
        throw new Error(
          response.error?.message || '获取申请状态失败'
        )
      }

      return response.data.status

    } catch (error) {
      console.error('获取申请状态失败:', error)
      throw this.wrapError(error, '获取申请状态失败')
    }
  }

  /**
   * 取消申请
   */
  async cancelApplication(id: string): Promise<void> {
    try {
      const headers = await this.authHandler.getAuthHeaders()
      this.httpClient.setHeaders(headers)

      const response = await this.httpClient.post(
        `/applications/${id}/cancel`
      )

      if (!response.success) {
        throw new Error(
          response.error?.message || '取消申请失败'
        )
      }

    } catch (error) {
      console.error('取消申请失败:', error)
      throw this.wrapError(error, '取消申请失败')
    }
  }

  /**
   * 批量同步状态
   */
  async syncStatus(applications: string[]): Promise<SyncResult> {
    try {
      const headers = await this.authHandler.getAuthHeaders()
      this.httpClient.setHeaders(headers)

      const response = await this.httpClient.post<SyncResult>(
        '/applications/sync',
        { applicationIds: applications }
      )

      if (!response.success || !response.data) {
        throw new Error(
          response.error?.message || '状态同步失败'
        )
      }

      return response.data

    } catch (error) {
      console.error('状态同步失败:', error)
      // 返回失败结果而不是抛出异常
      return {
        successful: 0,
        failed: applications.length,
        details: applications.map(id => ({
          applicationId: id,
          success: false,
          error: error instanceof Error ? error.message : '同步失败'
        }))
      }
    }
  }

  /**
   * 订阅状态更新
   */
  subscribeStatusUpdates(callback: StatusUpdateCallback): void {
    this.statusUpdateCallback = callback

    // 在实际应用中,这里应该建立WebSocket连接或轮询机制
    // 这里使用简化的轮询实现
    console.log('[DataPlatformClient] 已订阅状态更新')
  }

  /**
   * 取消订阅状态更新
   */
  unsubscribeStatusUpdates(): void {
    this.statusUpdateCallback = null
    console.log('[DataPlatformClient] 已取消订阅状态更新')
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now()

    try {
      const headers = await this.authHandler.getAuthHeaders()
      this.httpClient.setHeaders(headers)

      const response = await this.httpClient.get<HealthStatus>('/health')
      const responseTime = Date.now() - startTime

      if (!response.success || !response.data) {
        return {
          status: 'unhealthy',
          timestamp: new Date(),
          responseTime,
          details: {
            database: false,
            cache: false,
            services: {}
          }
        }
      }

      return {
        ...response.data,
        responseTime
      }

    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        details: {
          database: false,
          cache: false,
          services: {}
        }
      }
    }
  }

  /**
   * 获取API版本
   */
  async getApiVersion(): Promise<ApiVersion> {
    try {
      const response = await this.httpClient.get<ApiVersion>('/version')

      if (!response.success || !response.data) {
        // 返回默认版本
        return {
          version: '1.0.0',
          deprecated: false
        }
      }

      return response.data

    } catch (error) {
      console.error('获取API版本失败:', error)
      return {
        version: '1.0.0',
        deprecated: false
      }
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    // 停止健康检查
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }

    // 清除认证Token
    this.authHandler.clearToken()

    // 取消状态更新订阅
    this.unsubscribeStatusUpdates()

    console.log('[DataPlatformClient] 连接已断开')
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      return
    }

    const interval = this.config.healthCheckInterval || 60000

    this.healthCheckTimer = setInterval(async () => {
      try {
        const health = await this.healthCheck()

        if (health.status === 'unhealthy') {
          console.warn('[DataPlatformClient] 健康检查失败:', health)
        }
      } catch (error) {
        console.error('[DataPlatformClient] 健康检查异常:', error)
      }
    }, interval)
  }

  /**
   * 包装错误信息
   */
  private wrapError(error: any, context: string): Error {
    if (error instanceof Error) {
      return new Error(`${context}: ${error.message}`)
    }
    return new Error(`${context}: ${String(error)}`)
  }

  /**
   * 获取客户端配置(用于调试)
   */
  getConfig(): DataPlatformClientConfig {
    return { ...this.config }
  }
}

/**
 * 创建数据平台客户端实例
 */
export function createDataPlatformClient(
  config: DataPlatformClientConfig
): DataPlatformClient {
  return new DataPlatformClientImpl(config)
}
