'use client'

import { useState, useEffect, useCallback } from 'react'
import { ApplicationStatus } from '@prisma/client'
import { RefreshCw, Bell, BellOff, ExternalLink } from 'lucide-react'
import { StatusProgressBar } from './StatusProgressBar'
import { StatusTimelineView } from './StatusTimelineView'
import { RejectionReason } from './RejectionReason'
import { TimeEstimation } from './TimeEstimation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { getStatusSyncService } from '@/lib/services/statusSync'
import { StatusUpdateEvent, TimeEstimation as TimeEstimationType } from '@/types/statusTracking'
import { cn } from '@/lib/utils'

interface ApplicationData {
  id: string
  applicationNumber: string
  status: ApplicationStatus
  assetName: string
  applicantName: string
  submittedAt?: Date
  reviewedAt?: Date
  reviewComment?: string
  estimatedCompletionTime?: Date
}

interface ApplicationStatusTrackerProps {
  applicationId: string
  className?: string
}

export function ApplicationStatusTracker({
  applicationId,
  className
}: ApplicationStatusTrackerProps) {
  const [application, setApplication] = useState<ApplicationData | null>(null)
  const [timeEstimation, setTimeEstimation] = useState<TimeEstimationType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting')
  const { toast } = useToast()

  // 状态同步服务
  const statusSyncService = getStatusSyncService()

  // 加载申请数据
  const loadApplicationData = useCallback(async () => {
    try {
      const response = await fetch(`/api/applications/${applicationId}/status`)
      if (!response.ok) {
        throw new Error('Failed to load application data')
      }
      const data = await response.json()
      setApplication(data.application)
      setTimeEstimation(data.timeEstimation)
    } catch (error) {
      console.error('Failed to load application:', error)
      toast({
        title: '加载失败',
        description: '无法加载申请状态信息，请稍后重试',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }, [applicationId, toast])

  // 手动刷新状态
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const statusUpdate = await statusSyncService.refreshStatus(applicationId)
      if (statusUpdate) {
        await loadApplicationData()
        toast({
          title: '刷新成功',
          description: '申请状态已更新',
        })
      }
    } catch (error) {
      toast({
        title: '刷新失败',
        description: '无法获取最新状态，请稍后重试',
        variant: 'destructive'
      })
    } finally {
      setIsRefreshing(false)
    }
  }, [applicationId, statusSyncService, loadApplicationData, toast])

  // 切换实时通知订阅
  const toggleSubscription = useCallback(() => {
    if (isSubscribed) {
      statusSyncService.unsubscribeFromApplication(applicationId)
      setIsSubscribed(false)
      toast({
        title: '已关闭实时通知',
        description: '您将不再收到此申请的实时状态更新'
      })
    } else {
      statusSyncService.subscribeToApplication(applicationId)
      setIsSubscribed(true)
      toast({
        title: '已开启实时通知',
        description: '您将收到此申请的实时状态更新'
      })
    }
  }, [isSubscribed, applicationId, statusSyncService, toast])

  // 处理状态更新事件
  const handleStatusUpdate = useCallback((event: StatusUpdateEvent) => {
    if (event.applicationId === applicationId) {
      loadApplicationData()
      toast({
        title: '状态已更新',
        description: `申请状态已变更为${getStatusLabel(event.newStatus)}`,
      })
    }
  }, [applicationId, loadApplicationData, toast])

  // 处理连接状态变化
  const handleConnectionChange = useCallback((state: any) => {
    setConnectionStatus(state.isConnected ? 'connected' : 'disconnected')
  }, [])

  // 初始化和清理
  useEffect(() => {
    loadApplicationData()

    // 设置状态同步事件监听
    statusSyncService.on('status_updated', handleStatusUpdate)
    statusSyncService.on('connection_change', handleConnectionChange)

    // 初始化连接
    statusSyncService.initialize()

    return () => {
      statusSyncService.off('status_updated', handleStatusUpdate)
      statusSyncService.off('connection_change', handleConnectionChange)
      statusSyncService.unsubscribeFromApplication(applicationId)
    }
  }, [applicationId, loadApplicationData, handleStatusUpdate, handleConnectionChange, statusSyncService])

  // 获取状态标签
  const getStatusLabel = (status: ApplicationStatus) => {
    const labels = {
      DRAFT: '草稿',
      PENDING: '待审核',
      APPROVED: '已批准',
      REJECTED: '已拒绝'
    }
    return labels[status]
  }

  // 获取状态颜色
  const getStatusColor = (status: ApplicationStatus) => {
    const colors = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING: 'bg-blue-100 text-blue-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800'
    }
    return colors[status]
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!application) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <p className="text-gray-500">未找到申请信息</p>
          <Button onClick={loadApplicationData} variant="outline" className="mt-4">
            重新加载
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* 申请基本信息卡片 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center space-x-4">
            <CardTitle className="text-lg font-semibold">申请状态跟踪</CardTitle>
            <Badge className={getStatusColor(application.status)}>
              {getStatusLabel(application.status)}
            </Badge>
          </div>

          <div className="flex items-center space-x-2">
            {/* 连接状态指示器 */}
            <div className="flex items-center space-x-1">
              <div
                className={cn(
                  'w-2 h-2 rounded-full',
                  connectionStatus === 'connected' ? 'bg-green-500' :
                  connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                  'bg-red-500'
                )}
              />
              <span className="text-xs text-gray-500">
                {connectionStatus === 'connected' ? '实时' :
                 connectionStatus === 'connecting' ? '连接中' : '离线'}
              </span>
            </div>

            {/* 实时通知切换 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSubscription}
              className="p-2"
            >
              {isSubscribed ? (
                <Bell className="h-4 w-4 text-blue-600" />
              ) : (
                <BellOff className="h-4 w-4 text-gray-400" />
              )}
            </Button>

            {/* 刷新按钮 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2"
            >
              <RefreshCw className={cn(
                'h-4 w-4',
                isRefreshing && 'animate-spin'
              )} />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 申请信息摘要 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">申请编号：</span>
              <span className="font-medium">{application.applicationNumber}</span>
            </div>
            <div>
              <span className="text-gray-500">申请资产：</span>
              <span className="font-medium">{application.assetName}</span>
            </div>
            <div>
              <span className="text-gray-500">申请人：</span>
              <span className="font-medium">{application.applicantName}</span>
            </div>
          </div>

          {/* 状态进度条 */}
          <StatusProgressBar
            currentStatus={application.status}
            estimatedTime={timeEstimation?.estimatedCompletionTime}
          />

          {/* 时间预估信息 */}
          {timeEstimation && (
            <TimeEstimation estimation={timeEstimation} />
          )}

          {/* 拒绝原因 */}
          {application.status === 'REJECTED' && application.reviewComment && (
            <RejectionReason
              reason={application.reviewComment}
              reviewedAt={application.reviewedAt}
              applicationId={application.id}
            />
          )}
        </CardContent>
      </Card>

      {/* 详细信息标签页 */}
      <Card>
        <Tabs defaultValue="timeline" className="w-full">
          <CardHeader className="pb-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="timeline">状态时间线</TabsTrigger>
              <TabsTrigger value="details">申请详情</TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent>
            <TabsContent value="timeline" className="mt-0">
              <StatusTimelineView applicationId={applicationId} />
            </TabsContent>

            <TabsContent value="details" className="mt-0">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">申请详情</h3>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    查看完整申请
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {application.submittedAt && (
                    <div>
                      <span className="text-gray-500">提交时间：</span>
                      <span className="font-medium">
                        {application.submittedAt.toLocaleString('zh-CN')}
                      </span>
                    </div>
                  )}
                  {application.reviewedAt && (
                    <div>
                      <span className="text-gray-500">审核时间：</span>
                      <span className="font-medium">
                        {application.reviewedAt.toLocaleString('zh-CN')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  )
}