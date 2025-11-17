/**
 * 申请管理类型定义
 * Story 5.5: 申请记录管理
 *
 * 定义管理员查看和分析申请记录所需的类型
 */

/**
 * 申请状态枚举
 * 复用Epic 4的申请状态定义
 */
export enum ApplicationStatus {
  DRAFT = 'draft',                    // 草稿
  PENDING = 'pending',                // 待处理
  APPROVED = 'approved',              // 已批准
  REJECTED = 'rejected',              // 已拒绝
  PROCESSING = 'processing',          // 处理中
  COMPLETED = 'completed',            // 已完成
  CANCELLED = 'cancelled'             // 已取消
}

/**
 * 申请状态标签和颜色
 */
export const ApplicationStatusLabels: Record<ApplicationStatus, string> = {
  [ApplicationStatus.DRAFT]: '草稿',
  [ApplicationStatus.PENDING]: '待处理',
  [ApplicationStatus.APPROVED]: '已批准',
  [ApplicationStatus.REJECTED]: '已拒绝',
  [ApplicationStatus.PROCESSING]: '处理中',
  [ApplicationStatus.COMPLETED]: '已完成',
  [ApplicationStatus.CANCELLED]: '已取消'
}

export const ApplicationStatusColors: Record<ApplicationStatus, string> = {
  [ApplicationStatus.DRAFT]: 'gray',
  [ApplicationStatus.PENDING]: 'yellow',
  [ApplicationStatus.APPROVED]: 'green',
  [ApplicationStatus.REJECTED]: 'red',
  [ApplicationStatus.PROCESSING]: 'blue',
  [ApplicationStatus.COMPLETED]: 'green',
  [ApplicationStatus.CANCELLED]: 'gray'
}

/**
 * 申请记录详情
 * 用于管理员查看和管理
 */
export interface ApplicationRecord {
  id: string
  applicationId: string              // 申请单号
  assetId: string
  assetName: string
  assetCategory: string
  userId: string
  userName: string
  userEmail: string
  status: ApplicationStatus
  createdAt: Date
  updatedAt: Date
  submittedAt?: Date
  approvedAt?: Date
  rejectedAt?: Date
  completedAt?: Date
  cancelledAt?: Date
  description: string                // 申请说明
  businessPurpose: string           // 业务用途
  formData: Record<string, unknown> // 申请表单数据
  processingNotes?: string          // 处理备注
  rejectionReason?: string          // 拒绝原因
  processingTime?: number           // 处理时长(小时)
  metadata: {
    priority?: 'low' | 'medium' | 'high'
    tags?: string[]
    requestIp?: string
    userAgent?: string
  }
}

/**
 * 申请筛选条件
 */
export interface ApplicationFilters {
  dateRange?: {
    start: Date
    end: Date
  }
  status?: ApplicationStatus[]
  assetIds?: string[]
  assetCategories?: string[]
  userIds?: string[]
  priority?: ('low' | 'medium' | 'high')[]
  searchQuery?: string               // 全文搜索关键词
  sortBy?: 'createdAt' | 'updatedAt' | 'processingTime'
  sortOrder?: 'asc' | 'desc'
}

/**
 * 申请筛选预设
 */
export interface ApplicationFilterPreset {
  id: string
  name: string
  description?: string
  filters: ApplicationFilters
  isDefault?: boolean
}

/**
 * 常用筛选预设
 */
export const DEFAULT_FILTER_PRESETS: Omit<ApplicationFilterPreset, 'id'>[] = [
  {
    name: '今日申请',
    description: '查看今天提交的所有申请',
    filters: {
      dateRange: {
        start: new Date(new Date().setHours(0, 0, 0, 0)),
        end: new Date(new Date().setHours(23, 59, 59, 999))
      },
      sortBy: 'createdAt',
      sortOrder: 'desc'
    },
    isDefault: true
  },
  {
    name: '待处理申请',
    description: '所有待处理状态的申请',
    filters: {
      status: [ApplicationStatus.PENDING],
      sortBy: 'createdAt',
      sortOrder: 'asc'
    }
  },
  {
    name: '本周新申请',
    description: '本周提交的所有申请',
    filters: {
      dateRange: {
        start: new Date(new Date().setDate(new Date().getDate() - 7)),
        end: new Date()
      },
      sortBy: 'createdAt',
      sortOrder: 'desc'
    }
  },
  {
    name: '高优先级申请',
    description: '所有高优先级的申请',
    filters: {
      priority: ['high'],
      status: [ApplicationStatus.PENDING, ApplicationStatus.PROCESSING],
      sortBy: 'createdAt',
      sortOrder: 'asc'
    }
  }
]

/**
 * 申请分页结果
 */
export interface ApplicationRecordsResult {
  records: ApplicationRecord[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

/**
 * 申请统计指标
 */
export interface ApplicationMetrics {
  totalApplications: number           // 总申请数
  approvedCount: number              // 已批准数
  rejectedCount: number              // 已拒绝数
  pendingCount: number               // 待处理数
  processingCount: number            // 处理中数
  completedCount: number             // 已完成数
  approvalRate: number               // 通过率 (%)
  avgProcessingTime: number          // 平均处理时长 (小时)
  medianProcessingTime: number       // 中位处理时长 (小时)
  periodComparison?: {               // 环比数据
    applicationsChange: number       // 申请数变化 (%)
    approvalRateChange: number       // 通过率变化 (百分点)
    processingTimeChange: number     // 处理时长变化 (%)
  }
}

/**
 * 趋势数据点
 */
export interface TrendPoint {
  date: string                       // 日期 YYYY-MM-DD
  timestamp: Date
  totalApplications: number
  approvedCount: number
  rejectedCount: number
  pendingCount: number
  avgProcessingTime: number
}

/**
 * 资产热度统计
 */
export interface AssetPopularity {
  assetId: string
  assetName: string
  assetCategory: string
  applicationCount: number           // 申请次数
  approvedCount: number              // 批准次数
  rejectedCount: number              // 拒绝次数
  uniqueUsers: number                // 唯一申请用户数
  approvalRate: number               // 通过率
  avgProcessingTime: number          // 平均处理时长
  trendDirection: 'up' | 'down' | 'stable' // 趋势方向
}

/**
 * 用户申请活跃度
 */
export interface UserActivity {
  userId: string
  userName: string
  userEmail: string
  totalApplications: number          // 总申请数
  approvedCount: number              // 批准数
  rejectedCount: number              // 拒绝数
  approvalRate: number               // 通过率
  lastApplicationDate: Date          // 最后申请时间
  favoriteAssets: string[]           // 常申请资产
}

/**
 * 申请统计结果
 */
export interface ApplicationStatistics {
  metrics: ApplicationMetrics
  trendData: TrendPoint[]
  topAssets: AssetPopularity[]
  activeUsers: UserActivity[]
  statusDistribution: Record<ApplicationStatus, number>
  categoryDistribution: Record<string, number>
  timeRange: {
    start: Date
    end: Date
  }
}

/**
 * 数据导出格式
 */
export enum ExportFormat {
  CSV = 'csv',
  EXCEL = 'excel',
  JSON = 'json'
}

/**
 * 数据导出选项
 */
export interface ExportOptions {
  format: ExportFormat
  includeColumns: string[]           // 要导出的列
  filters: ApplicationFilters        // 应用的筛选条件
  maxRows?: number                   // 最大导出行数
  includeMetadata?: boolean          // 是否包含元数据
}

/**
 * 导出任务状态
 */
export enum ExportStatus {
  PENDING = 'pending',               // 等待中
  PROCESSING = 'processing',         // 处理中
  COMPLETED = 'completed',           // 已完成
  FAILED = 'failed',                 // 失败
  CANCELLED = 'cancelled'            // 已取消
}

/**
 * 导出任务
 */
export interface ExportTask {
  id: string
  userId: string
  status: ExportStatus
  options: ExportOptions
  progress: number                   // 进度 0-100
  totalRows: number
  processedRows: number
  fileUrl?: string                   // 下载链接
  fileName?: string
  fileSize?: number                  // 文件大小 (bytes)
  error?: string                     // 错误信息
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  expiresAt?: Date                   // 下载链接过期时间
}

/**
 * 申请详情时间线事件
 */
export interface ApplicationTimelineEvent {
  id: string
  timestamp: Date
  type: 'created' | 'submitted' | 'approved' | 'rejected' | 'processing' | 'completed' | 'cancelled' | 'note_added' | 'status_changed'
  title: string
  description?: string
  userId?: string
  userName?: string
  metadata?: Record<string, unknown>
}

/**
 * 申请详情完整信息
 */
export interface ApplicationDetailInfo extends ApplicationRecord {
  timeline: ApplicationTimelineEvent[]
  relatedApplications?: {            // 关联申请
    sameAsset: number                // 同资产申请数
    sameUser: number                 // 同用户申请数
  }
  assetInfo?: {                      // 资产详细信息
    description: string
    owner: string
    category: string
    tags: string[]
    popularity: number
  }
}

/**
 * 批量操作结果
 */
export interface BatchOperationResult {
  total: number
  succeeded: number
  failed: number
  results: {
    id: string
    success: boolean
    error?: string
  }[]
}
