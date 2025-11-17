/**
 * 资产生命周期管理相关的TypeScript类型定义
 * Story 5.4: 资产下架管理
 */

import { AssetStatus } from './assetMaintenance'

// 扩展资产状态,添加下架和归档状态
export enum ExtendedAssetStatus {
  ACTIVE = 'active',
  MAINTENANCE = 'maintenance',
  INACTIVE = 'inactive',
  DEPRECATED = 'deprecated',
  DECOMMISSIONED = 'decommissioned', // 已下架
  ARCHIVED = 'archived' // 已归档
}

// 下架原因枚举
export enum DecommissionReason {
  DATA_EXPIRED = 'data_expired',           // 数据过期
  TABLE_DEPRECATED = 'table_deprecated',   // 表废弃
  PERMISSION_CHANGE = 'permission_change', // 权限变更
  QUALITY_ISSUE = 'quality_issue',         // 质量问题
  BUSINESS_CHANGE = 'business_change',     // 业务变更
  DUPLICATE_ASSET = 'duplicate_asset',     // 重复资产
  SYSTEM_UPGRADE = 'system_upgrade',       // 系统升级
  OTHER = 'other'                          // 其他原因
}

// 下架原因标签映射
export const DecommissionReasonLabels: Record<DecommissionReason, string> = {
  [DecommissionReason.DATA_EXPIRED]: '数据过期',
  [DecommissionReason.TABLE_DEPRECATED]: '表废弃',
  [DecommissionReason.PERMISSION_CHANGE]: '权限变更',
  [DecommissionReason.QUALITY_ISSUE]: '质量问题',
  [DecommissionReason.BUSINESS_CHANGE]: '业务变更',
  [DecommissionReason.DUPLICATE_ASSET]: '重复资产',
  [DecommissionReason.SYSTEM_UPGRADE]: '系统升级',
  [DecommissionReason.OTHER]: '其他原因'
}

// 资产下架信息
export interface AssetDecommissionInfo {
  decommissionedAt: Date
  decommissionedBy: string
  decommissionedByName?: string
  reason: DecommissionReason
  reasonDetail: string
  impactAssessment: string
  canRestore: boolean
  scheduledDecommissionAt?: Date // 定时下架时间
  autoDecommission?: boolean // 是否自动下架
}

// 下架影响评估
export interface DecommissionImpact {
  assetId: string
  assetName: string
  activeApplications: number              // 活跃申请数量
  dependentAssets: AssetDependency[]      // 依赖资产列表
  affectedUsers: UserImpact[]             // 受影响用户
  businessProcesses: string[]             // 受影响业务流程
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'    // 风险等级
  recommendations: string[]               // 建议措施
  canSafelyDecommission: boolean          // 是否可以安全下架
  warningMessages: string[]               // 警告信息
}

// 资产依赖关系
export interface AssetDependency {
  assetId: string
  assetName: string
  dependencyType: 'schema' | 'data' | 'business' | 'technical'
  description?: string
  impact: 'low' | 'medium' | 'high'
  relationshipStrength: number // 0-1 依赖强度
}

// 用户影响分析
export interface UserImpact {
  userId: string
  userName: string
  userEmail?: string
  impactType: 'active_user' | 'pending_application' | 'frequent_user'
  impactLevel: 'low' | 'medium' | 'high'
  lastAccessDate?: Date
  accessCount?: number
}

// 下架确认配置
export interface DecommissionConfirmation {
  assetId: string
  assetName: string
  reason: DecommissionReason
  reasonDetail: string
  confirmationLevel: 'basic' | 'standard' | 'strict' // 确认级别
  requireNameConfirmation: boolean // 是否需要输入资产名称确认
  impactAssessment: DecommissionImpact
  notifyUsers: boolean // 是否通知受影响用户
  notifyChannels?: ('email' | 'system' | 'webhook')[]
}

// 批量下架配置
export interface BatchDecommissionConfig {
  assetIds: string[]
  reason: DecommissionReason
  reasonDetail: string
  notifyUsers: boolean
  skipImpactCheck: boolean // 是否跳过影响检查(高风险操作)
  batchSize?: number // 批次大小
  delayBetweenBatches?: number // 批次间延迟(毫秒)
}

// 批量下架结果
export interface BatchDecommissionResult {
  totalAssets: number
  successCount: number
  failedCount: number
  skippedCount: number
  results: DecommissionItemResult[]
  errors: DecommissionError[]
  startTime: Date
  endTime: Date
  duration: number // 执行时长(毫秒)
}

// 单个下架操作结果
export interface DecommissionItemResult {
  assetId: string
  assetName: string
  status: 'success' | 'failed' | 'skipped'
  message?: string
  error?: string
  impactLevel?: 'LOW' | 'MEDIUM' | 'HIGH'
  warnings?: string[]
}

// 下架操作错误
export interface DecommissionError {
  assetId: string
  assetName: string
  errorType: 'permission_denied' | 'active_applications' | 'critical_dependency' | 'system_error'
  error: string
  code: string
  canRetry: boolean
  suggestion?: string
}

// 资产恢复配置
export interface AssetRestoreConfig {
  assetId: string
  reason?: string
  restoreStatus?: ExtendedAssetStatus // 恢复后的状态,默认为ACTIVE
  notifyUsers: boolean
  resetMetrics: boolean // 是否重置统计指标
}

// 资产恢复结果
export interface AssetRestoreResult {
  success: boolean
  assetId: string
  assetName: string
  previousStatus: ExtendedAssetStatus
  newStatus: ExtendedAssetStatus
  restoredAt: Date
  restoredBy: string
  message: string
  warnings?: string[]
}

// 已下架资产查询参数
export interface ArchivedAssetsQueryParams {
  page?: number
  limit?: number
  sortBy?: 'decommissionedAt' | 'name' | 'reason'
  sortOrder?: 'asc' | 'desc'
  reason?: DecommissionReason[]
  dateRange?: {
    start: Date
    end: Date
  }
  searchQuery?: string
  canRestore?: boolean
}

// 已下架资产列表响应
export interface ArchivedAssetsResponse {
  assets: ArchivedAssetSummary[]
  total: number
  hasMore: boolean
  page: number
  limit: number
}

// 已下架资产摘要
export interface ArchivedAssetSummary {
  id: string
  name: string
  description?: string
  status: ExtendedAssetStatus
  decommissionedAt: Date
  decommissionedBy: string
  decommissionedByName?: string
  reason: DecommissionReason
  reasonDetail?: string
  canRestore: boolean
  category?: {
    id: string
    name: string
    code: string
  }
}

// 下架审计日志
export interface DecommissionAuditLog {
  id: string
  assetId: string
  assetName: string
  operation: 'DECOMMISSION' | 'RESTORE' | 'SCHEDULE_DECOMMISSION' | 'CANCEL_SCHEDULE'
  operatorId: string
  operatorName: string
  timestamp: Date
  reason?: string
  reasonDetail?: string
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  batchId?: string // 批量操作ID
  metadata: DecommissionAuditMetadata
}

// 下架审计元数据
export interface DecommissionAuditMetadata {
  previousStatus: ExtendedAssetStatus
  newStatus: ExtendedAssetStatus
  affectedApplications: number
  affectedUsers: number
  dependentAssets: number
  approvalRequired: boolean
  approvedBy?: string
  approvalTimestamp?: Date
  notificationsSent: number
  ipAddress?: string
  userAgent?: string
}

// 审计日志查询参数
export interface DecommissionAuditQueryParams {
  assetIds?: string[]
  operations?: ('DECOMMISSION' | 'RESTORE' | 'SCHEDULE_DECOMMISSION' | 'CANCEL_SCHEDULE')[]
  operatorIds?: string[]
  dateRange?: {
    start: Date
    end: Date
  }
  impactLevel?: ('LOW' | 'MEDIUM' | 'HIGH')[]
  batchId?: string
  page?: number
  limit?: number
  sortBy?: 'timestamp' | 'impactLevel'
  sortOrder?: 'asc' | 'desc'
}

// 审计报告配置
export interface DecommissionAuditReportConfig {
  reportType: 'summary' | 'detailed' | 'trend'
  dateRange: {
    start: Date
    end: Date
  }
  groupBy?: 'reason' | 'operator' | 'impactLevel' | 'date'
  includeCharts: boolean
  format: 'pdf' | 'excel' | 'csv' | 'json'
}

// 下架统计数据
export interface DecommissionStatistics {
  totalDecommissioned: number
  totalRestored: number
  byReason: Record<DecommissionReason, number>
  byImpactLevel: Record<'LOW' | 'MEDIUM' | 'HIGH', number>
  topOperators: OperatorStatistics[]
  trends: DecommissionTrend[]
}

// 操作员统计
export interface OperatorStatistics {
  operatorId: string
  operatorName: string
  decommissionCount: number
  restoreCount: number
  averageImpactLevel: number
}

// 下架趋势数据
export interface DecommissionTrend {
  date: Date
  decommissionCount: number
  restoreCount: number
  reasons: Record<DecommissionReason, number>
}

// 定时下架任务
export interface ScheduledDecommissionTask {
  id: string
  assetId: string
  assetName: string
  scheduledAt: Date
  createdBy: string
  createdByName?: string
  createdAt: Date
  reason: DecommissionReason
  reasonDetail: string
  status: 'pending' | 'executed' | 'cancelled' | 'failed'
  executedAt?: Date
  cancelledAt?: Date
  cancelledBy?: string
  error?: string
}

// 资产生命周期状态历史
export interface AssetLifecycleHistory {
  assetId: string
  history: LifecycleEvent[]
}

// 生命周期事件
export interface LifecycleEvent {
  id: string
  timestamp: Date
  eventType: 'status_change' | 'decommission' | 'restore' | 'schedule_decommission'
  previousStatus: ExtendedAssetStatus
  newStatus: ExtendedAssetStatus
  operatorId: string
  operatorName?: string
  reason?: string
  metadata?: Record<string, any>
}

// 软删除查询选项
export interface SoftDeleteQueryOptions {
  includeDecommissioned: boolean
  includeArchived: boolean
  onlyActive: boolean
}

// 下架通知配置
export interface DecommissionNotificationConfig {
  enabled: boolean
  channels: ('email' | 'system' | 'webhook')[]
  notifyActiveUsers: boolean
  notifyPendingApplicants: boolean
  notifyAssetOwners: boolean
  notifyAdmins: boolean
  template?: string
  customMessage?: string
}

// 下架通知结果
export interface DecommissionNotificationResult {
  totalNotifications: number
  successCount: number
  failedCount: number
  details: NotificationDetail[]
}

// 通知详情
export interface NotificationDetail {
  userId: string
  userName?: string
  channel: 'email' | 'system' | 'webhook'
  status: 'success' | 'failed'
  sentAt: Date
  error?: string
}
