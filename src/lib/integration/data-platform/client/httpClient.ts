/**
 * HTTP客户端封装
 * 提供标准化的HTTP请求处理、错误处理和监控集成
 */

import { ApiError, ApiResponse, CallContext, CallResult } from '@/types/integration'

export interface HttpClientConfig {
  baseUrl: string
  timeout?: number
  headers?: Record<string, string>
  enableLogging?: boolean
}

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  endpoint: string
  body?: any
  headers?: Record<string, string>
  timeout?: number
  retryCount?: number
}

/**
 * HTTP客户端类
 * 封装fetch API,提供统一的错误处理和日志记录
 */
export class HttpClient {
  private config: HttpClientConfig
  private defaultHeaders: Record<string, string>

  constructor(config: HttpClientConfig) {
    this.config = {
      timeout: 30000, // 默认30秒超时
      enableLogging: true,
      ...config
    }

    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...config.headers
    }
  }

  /**
   * 发送GET请求
   */
  async get<T = any>(
    endpoint: string,
    options?: Partial<RequestOptions>
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'GET',
      endpoint,
      ...options
    })
  }

  /**
   * 发送POST请求
   */
  async post<T = any>(
    endpoint: string,
    body?: any,
    options?: Partial<RequestOptions>
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'POST',
      endpoint,
      body,
      ...options
    })
  }

  /**
   * 发送PUT请求
   */
  async put<T = any>(
    endpoint: string,
    body?: any,
    options?: Partial<RequestOptions>
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      endpoint,
      body,
      ...options
    })
  }

  /**
   * 发送DELETE请求
   */
  async delete<T = any>(
    endpoint: string,
    options?: Partial<RequestOptions>
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      endpoint,
      ...options
    })
  }

  /**
   * 发送PATCH请求
   */
  async patch<T = any>(
    endpoint: string,
    body?: any,
    options?: Partial<RequestOptions>
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'PATCH',
      endpoint,
      body,
      ...options
    })
  }

  /**
   * 核心请求方法
   */
  private async request<T = any>(
    options: RequestOptions
  ): Promise<ApiResponse<T>> {
    const requestId = this.generateRequestId()
    const context: CallContext = {
      requestId,
      endpoint: options.endpoint,
      method: options.method,
      startTime: new Date(),
      timeout: options.timeout || this.config.timeout || 30000,
      retryCount: options.retryCount || 0
    }

    const url = this.buildUrl(options.endpoint)
    const headers = {
      ...this.defaultHeaders,
      ...options.headers,
      'X-Request-ID': requestId
    }

    try {
      // 序列化请求体
      const body = options.body ? JSON.stringify(options.body) : undefined
      if (body) {
        context.requestSize = new Blob([body]).size
      }

      // 记录请求开始
      if (this.config.enableLogging) {
        this.logRequest(context, options)
      }

      // 创建超时控制
      const controller = new AbortController()
      const timeoutId = setTimeout(
        () => controller.abort(),
        context.timeout
      )

      try {
        // 发送HTTP请求
        const response = await fetch(url, {
          method: options.method,
          headers,
          body,
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        // 解析响应
        const result = await this.parseResponse<T>(response, context)

        // 记录请求完成
        if (this.config.enableLogging) {
          this.logResponse(context, {
            statusCode: response.status,
            duration: Date.now() - context.startTime.getTime(),
            success: result.success,
            responseSize: result.data ? new Blob([JSON.stringify(result.data)]).size : 0
          })
        }

        return result

      } catch (error) {
        clearTimeout(timeoutId)
        throw error
      }

    } catch (error) {
      // 错误处理
      const apiError = this.handleError(error, context)
      const result: CallResult = {
        duration: Date.now() - context.startTime.getTime(),
        success: false,
        error: apiError
      }

      if (this.config.enableLogging) {
        this.logResponse(context, result)
      }

      return {
        success: false,
        error: apiError
      }
    }
  }

  /**
   * 解析HTTP响应
   */
  private async parseResponse<T>(
    response: Response,
    context: CallContext
  ): Promise<ApiResponse<T>> {
    const contentType = response.headers.get('content-type')

    try {
      let data: any

      // 根据内容类型解析响应
      if (contentType?.includes('application/json')) {
        data = await response.json()
      } else if (contentType?.includes('text/')) {
        data = await response.text()
      } else {
        data = await response.blob()
      }

      // 检查HTTP状态码
      if (!response.ok) {
        const error: ApiError = {
          code: response.status,
          message: data?.message || response.statusText || 'HTTP请求失败',
          details: data,
          timestamp: new Date()
        }

        return {
          success: false,
          error
        }
      }

      // 成功响应
      return {
        success: true,
        data,
        metadata: {
          timestamp: new Date(),
          requestId: context.requestId,
          apiVersion: response.headers.get('X-API-Version') || '1.0'
        }
      }

    } catch (error) {
      // 响应解析错误
      const apiError: ApiError = {
        code: response.status,
        message: `响应解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
        details: error,
        timestamp: new Date()
      }

      return {
        success: false,
        error: apiError
      }
    }
  }

  /**
   * 错误处理
   */
  private handleError(error: any, context: CallContext): ApiError {
    if (error.name === 'AbortError') {
      return {
        code: 408,
        message: `请求超时 (${context.timeout}ms)`,
        timestamp: new Date()
      }
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        code: 0,
        message: '网络连接失败,请检查网络设置',
        details: error,
        timestamp: new Date()
      }
    }

    return {
      code: 500,
      message: error instanceof Error ? error.message : '未知错误',
      details: error,
      timestamp: new Date()
    }
  }

  /**
   * 构建完整URL
   */
  private buildUrl(endpoint: string): string {
    const baseUrl = this.config.baseUrl.replace(/\/$/, '')
    const path = endpoint.replace(/^\//, '')
    return `${baseUrl}/${path}`
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * 记录请求
   */
  private logRequest(context: CallContext, options: RequestOptions): void {
    console.log('[HTTP Client] 请求发送:', {
      requestId: context.requestId,
      method: context.method,
      endpoint: context.endpoint,
      timestamp: context.startTime.toISOString(),
      requestSize: context.requestSize
    })
  }

  /**
   * 记录响应
   */
  private logResponse(context: CallContext, result: CallResult): void {
    const logLevel = result.success ? 'log' : 'error'
    console[logLevel]('[HTTP Client] 请求完成:', {
      requestId: context.requestId,
      method: context.method,
      endpoint: context.endpoint,
      statusCode: result.statusCode,
      duration: `${result.duration}ms`,
      success: result.success,
      responseSize: result.responseSize,
      error: result.error
    })
  }

  /**
   * 更新默认请求头
   */
  setHeaders(headers: Record<string, string>): void {
    this.defaultHeaders = {
      ...this.defaultHeaders,
      ...headers
    }
  }

  /**
   * 获取配置
   */
  getConfig(): HttpClientConfig {
    return { ...this.config }
  }
}
