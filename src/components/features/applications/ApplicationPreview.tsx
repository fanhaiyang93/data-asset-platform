'use client'

import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ApplicationFormData } from '@/lib/schemas/application'
import { BusinessPurpose } from '@prisma/client'
import { CheckCircle, Edit, ArrowLeft } from 'lucide-react'

// 业务用途标签映射
const businessPurposeLabels: Record<BusinessPurpose, string> = {
  [BusinessPurpose.REPORT_CREATION]: '报表制作',
  [BusinessPurpose.DATA_ANALYSIS]: '数据分析',
  [BusinessPurpose.BUSINESS_MONITOR]: '业务监控',
  [BusinessPurpose.MODEL_TRAINING]: '模型训练',
  [BusinessPurpose.SYSTEM_INTEGRATION]: '系统集成',
  [BusinessPurpose.RESEARCH_ANALYSIS]: '研究分析',
  [BusinessPurpose.OTHER]: '其他用途'
}

// 业务用途颜色映射
const businessPurposeColors: Record<BusinessPurpose, string> = {
  [BusinessPurpose.REPORT_CREATION]: 'bg-blue-100 text-blue-800',
  [BusinessPurpose.DATA_ANALYSIS]: 'bg-green-100 text-green-800',
  [BusinessPurpose.BUSINESS_MONITOR]: 'bg-yellow-100 text-yellow-800',
  [BusinessPurpose.MODEL_TRAINING]: 'bg-purple-100 text-purple-800',
  [BusinessPurpose.SYSTEM_INTEGRATION]: 'bg-orange-100 text-orange-800',
  [BusinessPurpose.RESEARCH_ANALYSIS]: 'bg-indigo-100 text-indigo-800',
  [BusinessPurpose.OTHER]: 'bg-gray-100 text-gray-800'
}

interface ApplicationPreviewProps {
  data: ApplicationFormData
  assetName?: string
  onEdit: () => void
  onConfirm: () => void
  loading?: boolean
  className?: string
}

export function ApplicationPreview({
  data,
  assetName,
  onEdit,
  onConfirm,
  loading = false,
  className
}: ApplicationPreviewProps) {
  // 计算申请期限
  const calculateDuration = () => {
    const diffTime = data.endDate.getTime() - data.startDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 1) return '1天'
    if (diffDays < 30) return `${diffDays}天`
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30)
      const remainingDays = diffDays % 30
      return remainingDays > 0 ? `${months}个月${remainingDays}天` : `${months}个月`
    }
    const years = Math.floor(diffDays / 365)
    const remainingDays = diffDays % 365
    return remainingDays > 0 ? `${years}年${remainingDays}天` : `${years}年`
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <CardTitle>确认申请信息</CardTitle>
        </div>
        <CardDescription>
          请仔细核对以下申请信息，确认无误后提交申请。提交后将无法修改。
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 申请资产信息 */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium">申请资产</h3>
          <div className="p-4 bg-muted rounded-lg">
            <p className="font-medium">{assetName || `资产ID: ${data.assetId}`}</p>
            <p className="text-sm text-muted-foreground mt-1">
              数据资产访问申请
            </p>
          </div>
        </div>

        <Separator />

        {/* 申请目的和理由 */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium">申请目的</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">业务用途:</span>
              <Badge
                variant="secondary"
                className={businessPurposeColors[data.purpose]}
              >
                {businessPurposeLabels[data.purpose]}
              </Badge>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium">申请理由:</span>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{data.reason}</p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* 使用期限 */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium">使用期限</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <span className="text-sm font-medium text-muted-foreground">开始日期</span>
              <p className="text-sm">{format(data.startDate, 'yyyy年MM月dd日')}</p>
            </div>

            <div className="space-y-1">
              <span className="text-sm font-medium text-muted-foreground">结束日期</span>
              <p className="text-sm">{format(data.endDate, 'yyyy年MM月dd日')}</p>
            </div>

            <div className="space-y-1">
              <span className="text-sm font-medium text-muted-foreground">申请期限</span>
              <p className="text-sm font-medium text-primary">{calculateDuration()}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* 申请人信息 */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium">申请人信息</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-sm font-medium text-muted-foreground">姓名</span>
              <p className="text-sm">{data.applicantName}</p>
            </div>

            {data.department && (
              <div className="space-y-1">
                <span className="text-sm font-medium text-muted-foreground">部门</span>
                <p className="text-sm">{data.department}</p>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-sm font-medium text-muted-foreground">联系邮箱</span>
              <p className="text-sm">{data.contactEmail}</p>
            </div>

            {data.contactPhone && (
              <div className="space-y-1">
                <span className="text-sm font-medium text-muted-foreground">联系电话</span>
                <p className="text-sm">{data.contactPhone}</p>
              </div>
            )}
          </div>
        </div>

        {/* 申请提示 */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-900">申请提示</p>
              <p className="text-sm text-blue-700">
                申请提交后，系统将生成唯一的申请编号，并通知资产管理员进行审核。
                您可以在申请历史中查看申请状态和审核结果。
              </p>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={onEdit}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <Edit className="h-4 w-4" />
          返回编辑
        </Button>

        <Button
          onClick={onConfirm}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          {loading ? '提交中...' : '确认提交申请'}
        </Button>
      </CardFooter>
    </Card>
  )
}