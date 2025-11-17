'use client'

import { ApplicationStatus } from '@prisma/client'
import { CheckCircle, Clock, XCircle, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TimeEstimation } from '@/types/statusTracking'

interface StatusStep {
  status: ApplicationStatus
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const statusSteps: StatusStep[] = [
  {
    status: 'DRAFT',
    label: '草稿编辑',
    description: '正在编辑申请信息',
    icon: FileText
  },
  {
    status: 'PENDING',
    label: '待审核',
    description: '申请已提交，等待审核',
    icon: Clock
  },
  {
    status: 'APPROVED',
    label: '已批准',
    description: '申请审核通过',
    icon: CheckCircle
  },
  {
    status: 'REJECTED',
    label: '已拒绝',
    description: '申请审核未通过',
    icon: XCircle
  }
]

interface StatusProgressBarProps {
  currentStatus: ApplicationStatus
  estimatedTime?: Date
  className?: string
}

export function StatusProgressBar({
  currentStatus,
  estimatedTime,
  className
}: StatusProgressBarProps) {
  const currentStepIndex = statusSteps.findIndex(step => step.status === currentStatus)
  const isRejected = currentStatus === 'REJECTED'

  // 获取状态颜色
  const getStatusColor = (status: ApplicationStatus, isActive: boolean, isPast: boolean) => {
    if (status === 'REJECTED' && (isActive || isPast)) {
      return 'text-red-600 border-red-600 bg-red-50'
    }
    if (status === 'APPROVED' && (isActive || isPast)) {
      return 'text-green-600 border-green-600 bg-green-50'
    }
    if (isActive) {
      return 'text-blue-600 border-blue-600 bg-blue-50'
    }
    if (isPast) {
      return 'text-green-600 border-green-600 bg-green-50'
    }
    return 'text-gray-400 border-gray-300 bg-gray-50'
  }

  // 获取连线颜色
  const getLineColor = (index: number) => {
    if (isRejected) {
      return index === 0 ? 'bg-green-600' : 'bg-red-600'
    }
    return index < currentStepIndex ? 'bg-green-600' : 'bg-gray-300'
  }

  // 格式化预计时间
  const formatEstimatedTime = (time?: Date) => {
    if (!time || currentStatus === 'APPROVED' || currentStatus === 'REJECTED') {
      return null
    }

    const now = new Date()
    const diffMs = time.getTime() - now.getTime()
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    if (diffMs <= 0) {
      return '即将完成'
    }

    if (diffHours <= 24) {
      return `预计 ${diffHours} 小时内完成`
    }

    return `预计 ${diffDays} 天内完成`
  }

  return (
    <div className={cn('w-full', className)}>
      {/* 预计时间显示 */}
      {estimatedTime && (
        <div className="mb-6 text-center">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
            <Clock className="w-4 h-4 mr-1" />
            {formatEstimatedTime(estimatedTime)}
          </div>
        </div>
      )}

      {/* 进度条 */}
      <div className="relative">
        {/* 连接线 */}
        <div className="absolute top-6 left-6 right-6 flex">
          {statusSteps.slice(0, -1).map((_, index) => (
            <div key={index} className="flex-1 flex items-center">
              <div
                className={cn(
                  'h-0.5 flex-1 transition-colors duration-300',
                  getLineColor(index)
                )}
              />
            </div>
          ))}
        </div>

        {/* 状态步骤 */}
        <div className="relative flex justify-between">
          {statusSteps.map((step, index) => {
            const isActive = step.status === currentStatus
            const isPast = !isRejected && index < currentStepIndex
            const isRelevant = !isRejected || index <= 1 || step.status === 'REJECTED'

            // 如果是被拒绝状态，隐藏批准步骤
            if (isRejected && step.status === 'APPROVED') {
              return null
            }

            const Icon = step.icon
            const colorClasses = getStatusColor(step.status, isActive, isPast)

            return (
              <div
                key={step.status}
                className={cn(
                  'flex flex-col items-center space-y-2 transition-all duration-300',
                  !isRelevant && 'opacity-50'
                )}
              >
                {/* 图标圆圈 */}
                <div
                  className={cn(
                    'w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300',
                    colorClasses
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>

                {/* 标签和描述 */}
                <div className="text-center space-y-1">
                  <div
                    className={cn(
                      'text-sm font-medium transition-colors duration-300',
                      isActive ? 'text-gray-900' : 'text-gray-600'
                    )}
                  >
                    {step.label}
                  </div>
                  <div
                    className={cn(
                      'text-xs transition-colors duration-300',
                      isActive ? 'text-gray-600' : 'text-gray-500'
                    )}
                  >
                    {step.description}
                  </div>
                </div>

                {/* 当前状态指示器 */}
                {isActive && (
                  <div className="absolute -bottom-2 w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 状态描述 */}
      <div className="mt-6 text-center">
        <div className="text-lg font-semibold text-gray-900 mb-1">
          {statusSteps.find(step => step.status === currentStatus)?.label}
        </div>
        <div className="text-sm text-gray-600">
          {currentStatus === 'DRAFT' && '请完善申请信息并提交'}
          {currentStatus === 'PENDING' && '我们正在审核您的申请，请耐心等待'}
          {currentStatus === 'APPROVED' && '恭喜！您的申请已通过审核'}
          {currentStatus === 'REJECTED' && '您的申请未通过审核，请查看拒绝原因'}
        </div>
      </div>
    </div>
  )
}