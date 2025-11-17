/**
 * 申请相关类型定义
 */

import { ApplicationStatus, BusinessPurpose } from '@prisma/client'

// 申请状态类型映射
export type { ApplicationStatus, BusinessPurpose }

/**
 * 申请提交输入数据类型
 */
export interface ApplicationSubmitInput {
  assetId: string
  purpose: BusinessPurpose
  reason: string
  startDate: Date
  endDate: Date
  applicantName: string
  department?: string
  contactEmail: string
  contactPhone?: string
}

/**
 * 申请提交响应数据类型
 */
export interface ApplicationSubmitResponse {
  id: string
  applicationId: string
  status: ApplicationStatus
  submittedAt: Date
}

/**
 * 申请详情数据类型
 */
export interface ApplicationDetail {
  id: string
  applicationNumber: string
  status: ApplicationStatus
  purpose: BusinessPurpose
  reason: string
  startDate: Date
  endDate: Date
  applicantName: string
  department?: string
  contactEmail: string
  contactPhone?: string
  reviewComment?: string
  reviewedAt?: Date
  submittedAt?: Date
  createdAt: Date
  updatedAt: Date
  asset: {
    id: string
    name: string
    description?: string
    category: {
      name: string
    }
  }
  reviewer?: {
    name?: string
    email: string
  }
}

/**
 * 申请状态日志记录
 */
export interface ApplicationStatusLog {
  id: string
  applicationId: string
  fromStatus: ApplicationStatus
  toStatus: ApplicationStatus
  comment?: string
  changedBy: string
  changedAt: Date
}

/**
 * 申请凭证信息
 */
export interface ApplicationReceipt {
  applicationNumber: string
  applicantName: string
  contactEmail: string
  department?: string
  asset: {
    name: string
    description?: string
    category: string
  }
  purpose: BusinessPurpose
  reason: string
  startDate: Date
  endDate: Date
  submittedAt: Date
  status: ApplicationStatus
  qrCodeData?: string // 用于生成QR码的数据
}

/**
 * 邮件通知数据类型
 */
export interface ApplicationEmailNotification {
  to: string
  applicationNumber: string
  applicantName: string
  assetName: string
  status: ApplicationStatus
  submittedAt: Date
  reviewComment?: string
  actionUrl?: string // 用于查看申请详情的链接
}

/**
 * 申请搜索筛选参数
 */
export interface ApplicationSearchParams {
  status?: ApplicationStatus[]
  purpose?: BusinessPurpose[]
  dateRange?: {
    start: Date
    end: Date
  }
  applicantName?: string
  assetName?: string
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'submittedAt' | 'applicantName' | 'status'
  sortOrder?: 'asc' | 'desc'
}

/**
 * 申请列表响应
 */
export interface ApplicationListResponse {
  applications: ApplicationDetail[]
  total: number
  hasMore: boolean
  page: number
  limit: number
}

/**
 * 申请统计数据
 */
export interface ApplicationStatistics {
  total: number
  byStatus: Record<ApplicationStatus, number>
  byPurpose: Record<BusinessPurpose, number>
  dailySubmissions: Array<{
    date: string
    count: number
  }>
  averageProcessingTime: number // 平均处理时间（小时）
}