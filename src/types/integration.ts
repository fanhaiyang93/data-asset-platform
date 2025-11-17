/**
 * 数据平台集成相关类型定义
 */

// ============= API客户端配置 =============
export interface PlatformConfig {
  baseUrl: string
  apiKey: string
  timeout?: number
  retryConfig?: RetryConfig
  enableMonitoring?: boolean
}

export interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
}

// ============= 认证相关 =============
export interface AuthConfig {
  apiKey: string
  apiSecret?: string
}

export interface AuthToken {
  token: string
  expiresAt: Date
  refreshToken?: string
}

// ============= 申请数据相关 =============
export interface ApplicationData {
  assetId: string
  purpose: string
  duration: string
  accessType: 'read' | 'write' | 'full'
  department: string
  supervisor: string
  additionalNotes?: string
  applicant: {
    id: string
    name: string
    email: string
  }
}

export interface PlatformApplication {
  asset_id: string
  asset_name: string
  reason: string
  business_purpose: string
  access_level: string
  duration_days: number
  department: string
  supervisor: string
  notes?: string
  applicant_info: {
    user_id: string
    username: string
    email: string
  }
  metadata?: Record<string, any>
}

export interface ApplicationResult {
  applicationId: string
  status: ApplicationStatus
  platformApplicationId?: string
  message?: string
  createdAt: Date
  estimatedProcessingTime?: number
}

// ============= 状态相关 =============
export enum ApplicationStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

export interface StatusUpdate {
  applicationId: string
  platformApplicationId: string
  oldStatus: ApplicationStatus
  newStatus: ApplicationStatus
  updatedAt: Date
  updatedBy?: string
  reason?: string
}

export interface SyncResult {
  successful: number
  failed: number
  details: Array<{
    applicationId: string
    success: boolean
    error?: string
  }>
}

// ============= API响应相关 =============
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: ApiError
  metadata?: ResponseMetadata
}

export interface ResponseMetadata {
  timestamp: Date
  requestId: string
  apiVersion: string
}

export interface ApiError {
  code: number
  message: string
  details?: any
  timestamp?: Date
}

// ============= 健康检查 =============
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: Date
  responseTime: number
  details?: {
    database?: boolean
    cache?: boolean
    services?: Record<string, boolean>
  }
}

export interface ApiVersion {
  version: string
  deprecated: boolean
  deprecationDate?: Date
  migrationGuide?: string
}

// ============= 错误处理 =============
export enum ErrorSeverity {
  RECOVERABLE = 'recoverable',
  DEGRADED = 'degraded',
  CRITICAL = 'critical'
}

export interface ErrorHandleResult {
  handled: boolean
  action: 'retry' | 'fallback' | 'escalate' | 'fail'
  retryAfter?: number
  fallbackData?: any
  error: ApiError
}

// ============= 调用上下文 =============
export interface CallContext {
  requestId: string
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  startTime: Date
  timeout: number
  retryCount?: number
  requestSize?: number
  metadata?: Record<string, any>
}

export interface CallResult {
  statusCode?: number
  duration: number
  success: boolean
  responseSize?: number
  error?: ApiError
}

// ============= 监控相关 =============
export interface ApiMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  errorRate: number
  throughput: number
  lastUpdated: Date
}

export interface APILogEntry {
  timestamp: string
  requestId: string
  endpoint: string
  method: string
  statusCode?: number
  responseTime?: number
  requestSize?: number
  responseSize?: number
  error?: ErrorInfo
  metadata?: Record<string, any>
}

export interface ErrorInfo {
  code: number
  message: string
  stack?: string
  context?: any
}

export interface MonitoringReport {
  timestamp: Date
  endpoints: Array<{
    endpoint: string
  } & ApiMetrics>
  overallHealth: 'healthy' | 'degraded' | 'unhealthy'
  alerts: Alert[]
}

export interface Alert {
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  endpoint?: string
  metric?: string
  threshold?: number
  currentValue?: number
  timestamp: Date
}

// ============= 数据映射相关 =============
export interface ValidationResult {
  valid: boolean
  errors: Array<{
    field: string
    message: string
  }>
}

export interface DataMapper<TSource, TTarget> {
  map(source: TSource): TTarget
  reverseMap(target: TTarget): TSource
  validate(data: TSource | TTarget): ValidationResult
}

// ============= 版本管理 =============
export interface VersionInfo {
  version: string
  releaseDate: Date
  deprecated: boolean
  deprecationDate?: Date
  supportedUntil?: Date
  breakingChanges?: string[]
  migrationGuide?: string
}

export interface VersionCompatibility {
  currentVersion: string
  targetVersion: string
  compatible: boolean
  migrationRequired: boolean
  migrationSteps?: string[]
}

// ============= 回调函数类型 =============
export type StatusUpdateCallback = (update: StatusUpdate) => Promise<void>

export interface RetryOptions {
  maxRetries?: number
  baseDelay?: number
  shouldRetry?: (error: ApiError) => boolean
}
