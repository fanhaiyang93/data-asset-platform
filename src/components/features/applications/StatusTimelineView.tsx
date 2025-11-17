'use client'

import { useState, useEffect } from 'react'
import { ApplicationStatus } from '@prisma/client'
import { CheckCircle, Clock, XCircle, FileText, User, MessageSquare } from 'lucide-react'
import { StatusChangeLog } from '@/types/statusTracking'
import { cn } from '@/lib/utils'

interface TimelineEvent extends StatusChangeLog {
  operatorName?: string
}

interface StatusTimelineViewProps {
  applicationId: string
  className?: string
}

export function StatusTimelineView({
  applicationId,
  className
}: StatusTimelineViewProps) {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 加载时间线数据
  useEffect(() => {
    const loadTimeline = async () => {
      try {
        const response = await fetch(`/api/applications/${applicationId}/timeline`)
        if (!response.ok) {
          throw new Error('Failed to load timeline')
        }
        const data = await response.json()
        setTimeline(data.timeline)
      } catch (error) {
        console.error('Failed to load timeline:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadTimeline()
  }, [applicationId])

  // 获取状态图标
  const getStatusIcon = (status: ApplicationStatus) => {
    const icons = {
      DRAFT: FileText,
      PENDING: Clock,
      APPROVED: CheckCircle,
      REJECTED: XCircle
    }
    return icons[status] || FileText
  }

  // 获取状态颜色
  const getStatusColor = (status: ApplicationStatus) => {
    const colors = {
      DRAFT: 'text-gray-500 bg-gray-100',
      PENDING: 'text-blue-500 bg-blue-100',
      APPROVED: 'text-green-500 bg-green-100',
      REJECTED: 'text-red-500 bg-red-100'
    }
    return colors[status] || 'text-gray-500 bg-gray-100'
  }

  // 获取状态标签
  const getStatusLabel = (status: ApplicationStatus) => {
    const labels = {
      DRAFT: '草稿编辑',
      PENDING: '提交审核',
      APPROVED: '审核通过',
      REJECTED: '审核拒绝'
    }
    return labels[status]
  }

  // 获取状态描述
  const getStatusDescription = (fromStatus: ApplicationStatus, toStatus: ApplicationStatus, reason?: string) => {
    if (fromStatus === 'DRAFT' && toStatus === 'PENDING') {
      return '申请已提交，等待审核人员处理'
    }
    if (fromStatus === 'PENDING' && toStatus === 'APPROVED') {
      return reason || '申请审核通过，可以开始使用资产'
    }
    if (fromStatus === 'PENDING' && toStatus === 'REJECTED') {
      return reason || '申请审核未通过'
    }
    if (toStatus === 'DRAFT') {
      return reason || '申请已保存为草稿'
    }
    return reason || '状态已更新'
  }

  // 格式化时间
  const formatTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMinutes < 1) {
      return '刚刚'
    }
    if (diffMinutes < 60) {
      return `${diffMinutes} 分钟前`
    }
    if (diffHours < 24) {
      return `${diffHours} 小时前`
    }
    if (diffDays < 7) {
      return `${diffDays} 天前`
    }

    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse flex items-start space-x-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (timeline.length === 0) {
    return (
      <div className={cn('text-center py-8 text-gray-500', className)}>
        <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>暂无状态变更记录</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="relative">
        {/* 时间线主轴 */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        {/* 时间线事件 */}
        <div className="space-y-6">
          {timeline.map((event, index) => {
            const StatusIcon = getStatusIcon(event.toStatus)
            const isLast = index === timeline.length - 1

            return (
              <div key={event.id} className="relative flex items-start space-x-4">
                {/* 状态图标 */}
                <div
                  className={cn(
                    'relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 border-white',
                    getStatusColor(event.toStatus)
                  )}
                >
                  <StatusIcon className="w-4 h-4" />
                </div>

                {/* 事件内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {getStatusLabel(event.toStatus)}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {formatTime(event.timestamp)}
                      </span>
                    </div>

                    {/* 操作人信息 */}
                    {event.operatorName && (
                      <div className="flex items-center space-x-1 text-xs text-gray-500">
                        <User className="w-3 h-3" />
                        <span>{event.operatorName}</span>
                      </div>
                    )}
                  </div>

                  {/* 事件描述 */}
                  <p className="mt-1 text-sm text-gray-600">
                    {getStatusDescription(event.fromStatus, event.toStatus, event.reason)}
                  </p>

                  {/* 详细原因或备注 */}
                  {event.reason && event.toStatus === 'REJECTED' && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <MessageSquare className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-red-800 mb-1">拒绝原因：</p>
                          <p className="text-sm text-red-700">{event.reason}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 元数据信息 */}
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      <details className="group">
                        <summary className="cursor-pointer hover:text-gray-700">
                          查看详细信息
                        </summary>
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs font-mono">
                          <pre>{JSON.stringify(event.metadata, null, 2)}</pre>
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 时间线说明 */}
      <div className="text-xs text-gray-500 text-center pt-4 border-t">
        <p>状态变更按时间倒序显示，最新的变更在上方</p>
      </div>
    </div>
  )
}