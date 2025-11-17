/**
 * 申请成功确认页面
 * 显示申请ID、提交时间、资产信息等
 */

'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CheckCircleIcon, ClockIcon, DocumentTextIcon, ArrowLeftIcon } from '@heroicons/react/24/solid'
import { format } from 'date-fns'
import { ApplicationDetail } from '@/types/application'

interface ApplicationSuccessProps {
  applicationId: string
}

function ApplicationSuccessContent({ applicationId }: ApplicationSuccessProps) {
  const router = useRouter()
  const [application, setApplication] = useState<ApplicationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 获取申请详情
  const { data, isLoading, error: queryError } = trpc.application.getApplication.useQuery(
    { applicationId },
    {
      enabled: !!applicationId,
      retry: 1,
    }
  )

  useEffect(() => {
    if (data) {
      setApplication(data)
      setLoading(false)
    }

    if (queryError) {
      setError(queryError.message || '获取申请信息失败')
      setLoading(false)
    }
  }, [data, queryError])

  // 获取状态显示信息
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'PENDING':
        return {
          label: '待审批',
          color: 'bg-yellow-100 text-yellow-800',
          icon: ClockIcon,
        }
      case 'APPROVED':
        return {
          label: '已批准',
          color: 'bg-green-100 text-green-800',
          icon: CheckCircleIcon,
        }
      case 'REJECTED':
        return {
          label: '已拒绝',
          color: 'bg-red-100 text-red-800',
          icon: DocumentTextIcon,
        }
      default:
        return {
          label: '处理中',
          color: 'bg-blue-100 text-blue-800',
          icon: ClockIcon,
        }
    }
  }

  // 获取业务用途显示文本
  const getPurposeLabel = (purpose: string) => {
    const purposeMap: Record<string, string> = {
      REPORT_CREATION: '报表制作',
      DATA_ANALYSIS: '数据分析',
      BUSINESS_MONITOR: '业务监控',
      MODEL_TRAINING: '模型训练',
      SYSTEM_INTEGRATION: '系统集成',
      RESEARCH_ANALYSIS: '研究分析',
      OTHER: '其他用途',
    }
    return purposeMap[purpose] || purpose
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载申请信息...</p>
        </div>
      </div>
    )
  }

  if (error || !application) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">获取申请信息失败</CardTitle>
            <CardDescription>
              {error || '未找到指定的申请信息'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button
              onClick={() => router.push('/applications')}
              className="w-full"
            >
              返回申请列表
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusInfo = getStatusInfo(application.status)
  const StatusIcon = statusInfo.icon

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 返回按钮 */}
        <div className="mb-6">
          <Button
            variant="ghost"             onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            返回
          </Button>
        </div>

        {/* 成功提示 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircleIcon className="h-8 w-8 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">申请提交成功！</h1>
          <p className="text-lg text-gray-600">
            您的申请已成功提交，我们将尽快处理您的申请。
          </p>
        </div>

        {/* 申请信息卡片 */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl font-semibold">申请详情</CardTitle>
                <CardDescription>申请编号：{application.applicationNumber}</CardDescription>
              </div>
              <Badge className={statusInfo.color}>
                <StatusIcon className="h-4 w-4 mr-1" />
                {statusInfo.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 基本信息 */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">基本信息</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">申请人：</span>
                  <span className="ml-2 font-medium">{application.applicantName}</span>
                </div>
                {application.department && (
                  <div>
                    <span className="text-gray-500">部门：</span>
                    <span className="ml-2 font-medium">{application.department}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">联系邮箱：</span>
                  <span className="ml-2 font-medium">{application.contactEmail}</span>
                </div>
                {application.contactPhone && (
                  <div>
                    <span className="text-gray-500">联系电话：</span>
                    <span className="ml-2 font-medium">{application.contactPhone}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">提交时间：</span>
                  <span className="ml-2 font-medium">
                    {application.submittedAt
                      ? format(new Date(application.submittedAt), 'yyyy-MM-dd HH:mm:ss')
                      : '处理中'
                    }
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* 资产信息 */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">申请资产</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-gray-900">{application.asset.name}</h4>
                  <Badge variant="outline">{application.asset.category.name}</Badge>
                </div>
                {application.asset.description && (
                  <p className="text-gray-600 text-sm">{application.asset.description}</p>
                )}
              </div>
            </div>

            <Separator />

            {/* 申请详情 */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">申请详情</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-500">业务用途：</span>
                  <span className="ml-2 font-medium">{getPurposeLabel(application.purpose)}</span>
                </div>
                <div>
                  <span className="text-gray-500">使用期限：</span>
                  <span className="ml-2 font-medium">
                    {format(new Date(application.startDate), 'yyyy-MM-dd')} 至{' '}
                    {format(new Date(application.endDate), 'yyyy-MM-dd')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-1">申请理由：</span>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-900 whitespace-pre-wrap">{application.reason}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 审核信息（如果有） */}
            {application.reviewComment && (
              <>
                <Separator />
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">审核意见</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-900 whitespace-pre-wrap">{application.reviewComment}</p>
                    {application.reviewedAt && (
                      <p className="text-sm text-gray-500 mt-2">
                        审核时间：{format(new Date(application.reviewedAt), 'yyyy-MM-dd HH:mm:ss')}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 后续操作指引 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">后续操作指引</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-xs">1</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">等待审核</p>
                  <p className="text-gray-600">
                    您的申请已进入审核队列，资产管理员会在1-3个工作日内完成审核。
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-xs">2</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">查看进度</p>
                  <p className="text-gray-600">
                    您可以随时在"我的申请"页面查看申请状态和审核进度。
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-xs">3</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">获取结果</p>
                  <p className="text-gray-600">
                    审核完成后，我们会发送邮件通知您审核结果。
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <Button
                onClick={() => router.push('/applications')}
                className="flex-1"
              >
                查看我的申请
              </Button>
              <Button
                variant="outline"                 onClick={() => router.push('/applications/receipt/' + application.applicationNumber)}
                className="flex-1"
              >
                查看申请凭证
              </Button>
            </div>

            {/* 联系信息 */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">需要帮助？</h4>
              <p className="text-blue-700 text-sm">
                如有疑问，请联系我们：
                <a href="mailto:support@example.com" className="underline ml-1">
                  support@example.com
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ApplicationSuccessPage() {
  const params = useParams()
  const applicationId = params.applicationId as string

  if (!applicationId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">参数错误</CardTitle>
            <CardDescription>申请ID不能为空</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => window.history.back()}>
              返回
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <ApplicationSuccessContent applicationId={applicationId} />
}