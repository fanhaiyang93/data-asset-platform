/**
 * 申请凭证页面
 * 显示申请的完整凭证信息
 */

'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeftIcon } from '@heroicons/react/24/solid'
import { ApplicationDetail } from '@/types/application'
import { ApplicationReceipt } from '@/components/features/applications/ApplicationReceipt'

interface ApplicationReceiptProps {
  applicationId: string
}

function ApplicationReceiptContent({ applicationId }: ApplicationReceiptProps) {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载申请凭证...</p>
        </div>
      </div>
    )
  }

  if (error || !application) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">获取申请凭证失败</CardTitle>
            <CardDescription>
              {error || '未找到指定的申请信息'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button
              onClick={() => router.push('/applications')}
              className="w-full\"
            >
              返回申请列表
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 返回按钮 */}
        <div className="mb-6 no-print">
          <Button
            variant=\"ghost\"
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900\"
          >
            <ArrowLeftIcon className="h-4 w-4\" />
            返回
          </Button>
        </div>

        {/* 申请凭证 */}
        <ApplicationReceipt application={application} />

        {/* 页面底部操作区域 */}
        <div className="mt-8 text-center no-print">
          <div className="flex justify-center gap-4">
            <Button
              variant=\"outline\"
              onClick={() => router.push('/applications')}
            >
              查看我的申请
            </Button>
            <Button
              onClick={() => router.push('/applications/success/' + application.applicationNumber)}
            >
              查看申请详情
            </Button>
          </div>

          {/* 帮助信息 */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg max-w-2xl mx-auto">
            <h4 className="font-medium text-blue-900 mb-2">关于申请凭证</h4>
            <p className="text-blue-700 text-sm leading-relaxed">
              本凭证包含您的完整申请信息，可用于查询申请状态、联系客服或作为申请记录保存。
              凭证具有唯一性，请妥善保管。如有疑问，请联系我们：
              <a href=\"mailto:support@example.com\" className="underline ml-1">
                support@example.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ApplicationReceiptPage() {
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

  return <ApplicationReceiptContent applicationId={applicationId} />
}