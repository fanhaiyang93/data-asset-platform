'use client'

/**
 * 申请时间线组件
 * 展示申请提交、审批节点、状态变更的完整流程
 */

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ApplicationStatus, BusinessPurpose } from '@prisma/client'
import {
  Clock,
  FileText,
  Send,
  Eye,
  CheckCircle2,
  XCircle,
  User,
  Calendar,
  MessageSquare,
  AlertCircle,
  Timer,
} from 'lucide-react'
import { format, formatDistanceToNow, differenceInDays, differenceInHours } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { cn } from '@/lib/utils'

// 时间线节点类型
export interface TimelineNode {
  id: string
  type: 'created' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'estimated'
  title: string
  description?: string
  timestamp?: Date
  estimatedDate?: Date
  status: 'completed' | 'current' | 'pending' | 'skipped'
  actor?: {
    name?: string
    email: string
    role?: string
  }
  metadata?: {
    comment?: string
    duration?: number // 处理时长（小时）
    expectedDuration?: number // 预期时长（小时）
  }
}

// 申请详情接口
export interface ApplicationDetail {
  id: string
  applicationNumber: string
  status: ApplicationStatus
  purpose: BusinessPurpose
  reason: string
  startDate: Date
  endDate: Date
  applicantName: string
  department?: string | null
  contactEmail: string
  contactPhone?: string | null
  reviewComment?: string | null
  reviewedAt?: Date | null
  submittedAt?: Date | null
  createdAt: Date
  updatedAt: Date
  asset: {
    id: string
    name: string
    description?: string | null
    category: {
      name: string
    }
  }
  reviewer?: {
    name?: string | null
    email: string
  } | null
}

// 节点配置
const NODE_CONFIG = {
  created: {
    icon: FileText,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-200',
  },
  submitted: {
    icon: Send,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    borderColor: 'border-indigo-200',
  },
  under_review: {
    icon: Eye,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-200',
  },
  approved: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-200',
  },
  rejected: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-200',
  },
  estimated: {
    icon: Timer,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-200',
  },
}

// 状态配置
const STATUS_CONFIG = {
  completed: {
    nodeStyle: 'opacity-100',
    lineStyle: 'bg-primary',
  },
  current: {
    nodeStyle: 'opacity-100 ring-2 ring-primary ring-offset-2',
    lineStyle: 'bg-gradient-to-b from-primary to-gray-200',
  },
  pending: {
    nodeStyle: 'opacity-60',
    lineStyle: 'bg-gray-200',
  },
  skipped: {
    nodeStyle: 'opacity-40',
    lineStyle: 'bg-gray-200',
  },
}

interface ApplicationTimelineProps {
  application: ApplicationDetail
  isLoading?: boolean
  showEstimatedCompletion?: boolean
}

export function ApplicationTimeline({
  application,
  isLoading = false,
  showEstimatedCompletion = true,
}: ApplicationTimelineProps) {
  // 生成时间线节点
  const timelineNodes = useMemo((): TimelineNode[] => {
    if (!application) return []

    const nodes: TimelineNode[] = []

    // 1. 创建申请节点
    nodes.push({
      id: 'created',
      type: 'created',
      title: '创建申请',
      description: `申请访问资产：${application.asset.name}`,
      timestamp: application.createdAt,
      status: 'completed',
      actor: {
        name: application.applicantName,
        email: application.contactEmail,
        role: '申请人',
      },
      metadata: {
        comment: `业务用途：${getPurposeDisplay(application.purpose)}`,
      },
    })

    // 2. 提交申请节点
    if (application.submittedAt) {
      const submitDuration = differenceInHours(application.submittedAt, application.createdAt)

      nodes.push({
        id: 'submitted',
        type: 'submitted',
        title: '提交申请',
        description: '申请已正式提交，等待审核',
        timestamp: application.submittedAt,
        status: 'completed',
        actor: {
          name: application.applicantName,
          email: application.contactEmail,
          role: '申请人',
        },
        metadata: {
          duration: submitDuration,
          comment: submitDuration > 24
            ? '从创建到提交耗时较长，建议及时提交申请'
            : undefined,
        },
      })

      // 3. 审核中节点
      const isUnderReview = application.status === ApplicationStatus.PENDING
      const reviewStatus: TimelineNode['status'] = isUnderReview ? 'current' : 'completed'

      nodes.push({
        id: 'under_review',
        type: 'under_review',
        title: '审核中',
        description: isUnderReview
          ? '申请正在审核中，请耐心等待'
          : '申请审核已完成',
        timestamp: application.submittedAt,
        status: reviewStatus,
        metadata: {
          duration: application.reviewedAt
            ? differenceInHours(application.reviewedAt, application.submittedAt)
            : differenceInHours(new Date(), application.submittedAt),
          expectedDuration: 48, // 预期48小时内完成审核
        },
      })

      // 4. 审核结果节点
      if (application.reviewedAt) {
        const isApproved = application.status === ApplicationStatus.APPROVED
        const reviewDuration = differenceInHours(application.reviewedAt, application.submittedAt)

        nodes.push({
          id: isApproved ? 'approved' : 'rejected',
          type: isApproved ? 'approved' : 'rejected',
          title: isApproved ? '申请通过' : '申请被拒绝',
          description: isApproved
            ? '恭喜！您的申请已通过审核'
            : '很抱歉，您的申请未通过审核',
          timestamp: application.reviewedAt,
          status: 'completed',
          actor: application.reviewer ? {
            name: application.reviewer.name || undefined,
            email: application.reviewer.email,
            role: '审核人',
          } : undefined,
          metadata: {
            comment: application.reviewComment || undefined,
            duration: reviewDuration,
          },
        })
      } else if (showEstimatedCompletion && application.status === ApplicationStatus.PENDING) {
        // 5. 预计完成时间节点
        const estimatedCompletionDate = new Date(application.submittedAt)
        estimatedCompletionDate.setHours(estimatedCompletionDate.getHours() + 48)

        const isOverdue = new Date() > estimatedCompletionDate
        const hoursElapsed = differenceInHours(new Date(), application.submittedAt)

        nodes.push({
          id: 'estimated',
          type: 'estimated',
          title: isOverdue ? '预期时间已过' : '预计完成时间',
          description: isOverdue
            ? `审核时间已超过预期 ${hoursElapsed - 48} 小时`
            : `预计在 ${format(estimatedCompletionDate, 'MM月dd日 HH:mm', { locale: zhCN })} 前完成审核`,
          estimatedDate: estimatedCompletionDate,
          status: isOverdue ? 'current' : 'pending',
          metadata: {
            expectedDuration: 48,
            comment: isOverdue
              ? '建议联系管理员了解审核进度'
              : '审核时间可能因申请复杂程度而有所不同',
          },
        })
      }
    }

    return nodes
  }, [application, showEstimatedCompletion])

  // 获取用途显示文本
  function getPurposeDisplay(purpose: BusinessPurpose): string {
    const map: Record<BusinessPurpose, string> = {
      REPORT_CREATION: '报表制作',
      DATA_ANALYSIS: '数据分析',
      BUSINESS_MONITOR: '业务监控',
      MODEL_TRAINING: '模型训练',
      SYSTEM_INTEGRATION: '系统集成',
      RESEARCH_ANALYSIS: '研究分析',
      OTHER: '其他用途',
    }
    return map[purpose] || purpose
  }

  // 计算总体进度
  const overallProgress = useMemo(() => {
    const completedNodes = timelineNodes.filter(node => node.status === 'completed').length
    const totalNodes = timelineNodes.filter(node => node.type !== 'estimated').length
    return totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0
  }, [timelineNodes])

  // 加载状态
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <span>申请进度时间线</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  {i < 2 && <Skeleton className="h-12 w-0.5 mt-2" />}
                </div>
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // 空状态
  if (timelineNodes.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          无法加载申请时间线信息
        </AlertDescription>
      </Alert>
    )
  }

  // 时间线节点组件
  const TimelineNodeComponent = ({ node, isLast }: { node: TimelineNode; isLast: boolean }) => {
    const nodeConfig = NODE_CONFIG[node.type]
    const statusConfig = STATUS_CONFIG[node.status]
    const IconComponent = nodeConfig.icon

    const isOverdue = node.metadata?.duration && node.metadata?.expectedDuration &&
      node.metadata.duration > node.metadata.expectedDuration

    return (
      <div className="flex gap-4">
        {/* 时间线左侧：图标和连线 */}
        <div className="flex flex-col items-center">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full border-2',
              nodeConfig.bgColor,
              nodeConfig.borderColor,
              statusConfig.nodeStyle
            )}
          >
            <IconComponent className={cn('h-4 w-4', nodeConfig.color)} />
          </div>
          {!isLast && (
            <div
              className={cn(
                'mt-2 h-12 w-0.5 rounded-full',
                statusConfig.lineStyle
              )}
            />
          )}
        </div>

        {/* 时间线右侧：内容 */}
        <div className="flex-1 pb-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-foreground">{node.title}</h4>
                <Badge
                  variant={node.status === 'completed' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {node.status === 'completed' && '已完成'}
                  {node.status === 'current' && '进行中'}
                  {node.status === 'pending' && '待处理'}
                  {node.status === 'skipped' && '已跳过'}
                </Badge>
                {isOverdue && (
                  <Badge variant="destructive" className="text-xs">
                    超时
                  </Badge>
                )}
              </div>

              {node.description && (
                <p className="text-sm text-muted-foreground">{node.description}</p>
              )}

              {node.metadata?.comment && (
                <div className="flex items-start gap-2 mt-2">
                  <MessageSquare className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    {node.metadata.comment}
                  </p>
                </div>
              )}

              {node.actor && (
                <div className="flex items-center gap-2 mt-2">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {node.actor.role}: {node.actor.name || node.actor.email}
                  </span>
                </div>
              )}

              {node.metadata?.duration && (
                <div className="flex items-center gap-2 mt-1">
                  <Timer className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    处理时长: {formatDuration(node.metadata.duration)}
                    {node.metadata.expectedDuration && (
                      <span className={cn(
                        'ml-1',
                        isOverdue ? 'text-red-600' : 'text-green-600'
                      )}>
                        (预期: {formatDuration(node.metadata.expectedDuration)})
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* 时间戳 */}
            <div className="text-right text-xs text-muted-foreground ml-4 flex-shrink-0">
              {node.timestamp && (
                <>
                  <div>{format(node.timestamp, 'MM月dd日 HH:mm', { locale: zhCN })}</div>
                  <div className="mt-1">
                    {formatDistanceToNow(node.timestamp, { addSuffix: true, locale: zhCN })}
                  </div>
                </>
              )}
              {node.estimatedDate && !node.timestamp && (
                <>
                  <div>预计时间</div>
                  <div className="mt-1">
                    {format(node.estimatedDate, 'MM月dd日 HH:mm', { locale: zhCN })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 格式化时长
  function formatDuration(hours: number): string {
    if (hours < 1) {
      return '不到1小时'
    } else if (hours < 24) {
      return `${Math.round(hours)}小时`
    } else {
      const days = Math.floor(hours / 24)
      const remainingHours = Math.round(hours % 24)
      return `${days}天${remainingHours > 0 ? remainingHours + '小时' : ''}`
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <span>申请进度时间线</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">整体进度</span>
            <Badge variant="outline">
              {overallProgress}%
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {timelineNodes.map((node, index) => (
            <TimelineNodeComponent
              key={node.id}
              node={node}
              isLast={index === timelineNodes.length - 1}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}