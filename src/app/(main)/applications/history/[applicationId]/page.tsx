'use client'

/**
 * 申请详情页面
 * 显示完整的申请信息和审批历程，包含时间线展示
 */

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { ApplicationTimeline } from '@/components/features/applications/ApplicationTimeline'
import { trpc } from '@/lib/trpc'
import { ApplicationStatus, BusinessPurpose } from '@prisma/client'
import {
  ArrowLeft,
  FileText,
  User,
  Building,
  Calendar,
  Clock,
  Mail,
  Phone,
  Database,
  Tag,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock3,
  AlertCircle,
  Copy,
  ExternalLink,
} from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// 状态配置
const STATUS_CONFIG: Record<ApplicationStatus, {
  label: string
  color: string
  bgColor: string
  icon: React.ComponentType<{ className?: string }>
}> = {
  DRAFT: {
    label: '草稿',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100 text-gray-800',
    icon: FileText,
  },
  PENDING: {
    label: '待审核',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100 text-yellow-800',
    icon: Clock3,
  },
  APPROVED: {
    label: '已通过',
    color: 'text-green-600',
    bgColor: 'bg-green-100 text-green-800',
    icon: CheckCircle2,
  },
  REJECTED: {
    label: '已拒绝',
    color: 'text-red-600',
    bgColor: 'bg-red-100 text-red-800',
    icon: XCircle,
  },
}

// 用途显示映射
const PURPOSE_DISPLAY: Record<BusinessPurpose, string> = {
  REPORT_CREATION: '报表制作',
  DATA_ANALYSIS: '数据分析',
  BUSINESS_MONITOR: '业务监控',
  MODEL_TRAINING: '模型训练',
  SYSTEM_INTEGRATION: '系统集成',
  RESEARCH_ANALYSIS: '研究分析',
  OTHER: '其他用途',
}

export default function ApplicationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const applicationId = params.applicationId as string

  // 获取申请详情
  const {
    data: application,
    isLoading,
    error,
    refetch
  } = trpc.application.getApplication.useQuery(
    { applicationId },
    { enabled: !!applicationId }
  )

  // 复制到剪贴板
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label}已复制到剪贴板`)
    } catch (error) {
      toast.error('复制失败')
    }
  }

  // 加载状态
  if (isLoading) {
    return (
      <div className="container max-w-6xl mx-auto py-6 space-y-6">
        {/* 头部骨架 */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-20" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* 内容骨架 */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className="container max-w-6xl mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              加载申请详情失败: {error.message}
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              重试
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // 数据不存在
  if (!application) {
    return (
      <div className="container max-w-6xl mx-auto py-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            找不到申请记录，请检查申请编号是否正确。
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[application.status]
  const StatusIcon = statusConfig.icon

  return (
    <div className="container max-w-6xl mx-auto py-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">申请详情</h1>
              <Badge variant="secondary" className={cn('text-sm', statusConfig.bgColor)}>
                <StatusIcon className="h-4 w-4 mr-1" />
                {statusConfig.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-muted-foreground font-mono text-sm">
                {application.applicationNumber}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(application.applicationNumber, '申请编号')}
                className="h-6 w-6 p-0"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/assets/${application.asset.id}`)}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            查看资产
          </Button>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左侧：申请详情 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                基本信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">申请资产</label>
                  <div className="mt-1 p-3 border rounded-lg">
                    <div className="font-medium">{application.asset.name}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {application.asset.category.name}
                    </div>
                    {application.asset.description && (
                      <div className="text-xs text-muted-foreground mt-2">
                        {application.asset.description}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">业务用途</label>
                  <div className="mt-1 p-3 border rounded-lg">
                    <Badge variant="outline">
                      {PURPOSE_DISPLAY[application.purpose]}
                    </Badge>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">使用时间</label>
                  <div className="mt-1 p-3 border rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {format(application.startDate, 'yyyy年MM月dd日', { locale: zhCN })}
                        {' 至 '}
                        {format(application.endDate, 'yyyy年MM月dd日', { locale: zhCN })}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">申请时间</label>
                  <div className="mt-1 p-3 border rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {format(application.createdAt, 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
                      </span>
                    </div>
                    {application.submittedAt && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <span>提交时间：</span>
                        <span>
                          {format(application.submittedAt, 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">申请理由</label>
                <div className="mt-1 p-3 border rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{application.reason}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 申请人信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                申请人信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{application.applicantName}</div>
                      <div className="text-sm text-muted-foreground">申请人</div>
                    </div>
                  </div>

                  {application.department && (
                    <div className="flex items-center gap-3">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{application.department}</div>
                        <div className="text-sm text-muted-foreground">所属部门</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{application.contactEmail}</div>
                      <div className="text-sm text-muted-foreground">联系邮箱</div>
                    </div>
                  </div>

                  {application.contactPhone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{application.contactPhone}</div>
                        <div className="text-sm text-muted-foreground">联系电话</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 审核信息 */}
          {(application.reviewer || application.reviewComment) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  审核信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {application.reviewer && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">审核人</label>
                    <div className="mt-1 p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {application.reviewer.name || application.reviewer.email}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {application.reviewedAt &&
                              `审核时间：${format(application.reviewedAt, 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}`
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {application.reviewComment && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">审核意见</label>
                    <div className="mt-1 p-3 border rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{application.reviewComment}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右侧：时间线 */}
        <div className="space-y-6">
          <ApplicationTimeline
            application={application}
            showEstimatedCompletion={true}
          />

          {/* 快速操作 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">快速操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => copyToClipboard(application.applicationNumber, '申请编号')}
              >
                <Copy className="h-4 w-4" />
                复制申请编号
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => router.push(`/assets/${application.asset.id}`)}
              >
                <Database className="h-4 w-4" />
                查看关联资产
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => router.push('/applications/history')}
              >
                <ArrowLeft className="h-4 w-4" />
                返回申请列表
              </Button>
            </CardContent>
          </Card>

          {/* 申请摘要 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">申请摘要</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">申请编号</span>
                <span className="font-mono">{application.applicationNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">申请状态</span>
                <Badge variant="secondary" className={cn('text-xs', statusConfig.bgColor)}>
                  {statusConfig.label}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">申请资产</span>
                <span className="text-right">{application.asset.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">业务用途</span>
                <span>{PURPOSE_DISPLAY[application.purpose]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">申请人</span>
                <span>{application.applicantName}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}