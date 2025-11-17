'use client'

import { Clock, TrendingUp, Calendar, Info } from 'lucide-react'
import { TimeEstimation as TimeEstimationType } from '@/types/statusTracking'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface TimeEstimationProps {
  estimation: TimeEstimationType
  className?: string
}

export function TimeEstimation({
  estimation,
  className
}: TimeEstimationProps) {
  // 格式化剩余时间
  const formatRemainingTime = () => {
    const now = new Date()
    const diffMs = estimation.estimatedCompletionTime.getTime() - now.getTime()

    if (diffMs <= 0) {
      return {
        text: '预计已完成',
        color: 'text-green-600',
        isOverdue: true
      }
    }

    const diffMinutes = Math.ceil(diffMs / (1000 * 60))
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    if (diffMinutes <= 60) {
      return {
        text: `约 ${diffMinutes} 分钟`,
        color: 'text-orange-600',
        isOverdue: false
      }
    }

    if (diffHours <= 24) {
      return {
        text: `约 ${diffHours} 小时`,
        color: 'text-blue-600',
        isOverdue: false
      }
    }

    return {
      text: `约 ${diffDays} 天`,
      color: 'text-gray-600',
      isOverdue: false
    }
  }

  // 获取置信度标签
  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.9) return { text: '很高', color: 'bg-green-100 text-green-800' }
    if (confidence >= 0.7) return { text: '较高', color: 'bg-blue-100 text-blue-800' }
    if (confidence >= 0.5) return { text: '中等', color: 'bg-yellow-100 text-yellow-800' }
    return { text: '较低', color: 'bg-red-100 text-red-800' }
  }

  // 格式化时间（分钟转换为小时和天）
  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} 分钟`
    }
    if (minutes < 24 * 60) {
      const hours = Math.round(minutes / 60 * 10) / 10
      return `${hours} 小时`
    }
    const days = Math.round(minutes / (24 * 60) * 10) / 10
    return `${days} 天`
  }

  const remainingTime = formatRemainingTime()
  const confidenceLabel = getConfidenceLabel(estimation.confidence)

  return (
    <Card className={cn('', className)}>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* 标题和主要信息 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-gray-900">预计完成时间</h3>
            </div>
            <Badge className={confidenceLabel.color}>
              置信度: {confidenceLabel.text}
            </Badge>
          </div>

          {/* 预计完成时间 */}
          <div className="text-center py-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {estimation.estimatedCompletionTime.toLocaleDateString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            <div className={cn('text-sm font-medium', remainingTime.color)}>
              {remainingTime.text}
            </div>
          </div>

          {/* 进度指示器 */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>处理进度</span>
              <span>{Math.round(estimation.confidence * 100)}% 可信度</span>
            </div>
            <Progress
              value={estimation.confidence * 100}
              className="h-2"
            />
          </div>

          {/* 时间分解 */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700 flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              时间分解
            </h4>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex justify-between p-2 bg-blue-50 rounded">
                      <span className="text-gray-600">基础处理</span>
                      <span className="font-medium">
                        {formatDuration(estimation.baseProcessingTime)}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>基于历史数据计算的标准处理时间</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex justify-between p-2 bg-yellow-50 rounded">
                      <span className="text-gray-600">队列延迟</span>
                      <span className="font-medium">
                        {formatDuration(estimation.queueDelay)}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>当前待处理申请数量导致的延迟</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {estimation.holidayAdjustment > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex justify-between p-2 bg-red-50 rounded col-span-2">
                        <span className="text-gray-600 flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          节假日调整
                        </span>
                        <span className="font-medium">
                          {formatDuration(estimation.holidayAdjustment)}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>考虑工作日和节假日的时间调整</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* 详细因素 */}
          <div className="space-y-3 pt-3 border-t">
            <h4 className="text-sm font-medium text-gray-700 flex items-center">
              <Info className="w-4 h-4 mr-1" />
              影响因素
            </h4>

            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>资产类型：</span>
                <span className="font-medium">{estimation.factors.assetType}</span>
              </div>

              <div className="flex justify-between text-gray-600">
                <span>审核人负载：</span>
                <span className="font-medium">
                  {estimation.factors.reviewerWorkload > 0
                    ? `${estimation.factors.reviewerWorkload.toFixed(1)} 个/天`
                    : '正常'
                  }
                </span>
              </div>

              {estimation.factors.historicalAverage > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>历史平均：</span>
                  <span className="font-medium">
                    {formatDuration(estimation.factors.historicalAverage)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 免责声明 */}
          <div className="text-xs text-gray-500 text-center pt-2 border-t">
            <p>* 预计时间基于历史数据和当前负载计算，仅供参考</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}