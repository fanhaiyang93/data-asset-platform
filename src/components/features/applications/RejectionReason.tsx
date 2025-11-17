'use client'

import { useState } from 'react'
import { AlertTriangle, MessageSquare, Clock, HelpCircle, Send, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface RejectionReasonProps {
  reason: string
  reviewedAt?: Date
  applicationId: string
  className?: string
}

// 常见拒绝原因类型
interface RejectionCategory {
  type: string
  label: string
  description: string
  suggestions: string[]
  canAppeal: boolean
}

const rejectionCategories: RejectionCategory[] = [
  {
    type: 'incomplete_info',
    label: '信息不完整',
    description: '申请材料缺少必要信息或文档',
    suggestions: [
      '补充完整的申请表单',
      '提供必要的证明文件',
      '确认联系方式准确性',
      '添加详细的使用说明'
    ],
    canAppeal: true
  },
  {
    type: 'access_level',
    label: '权限等级不足',
    description: '申请的资产需要更高的权限等级',
    suggestions: [
      '联系部门主管进行权限升级',
      '申请临时访问权限',
      '考虑使用权限较低的替代资产',
      '完成相关培训课程'
    ],
    canAppeal: true
  },
  {
    type: 'security_policy',
    label: '安全策略限制',
    description: '违反了数据安全或合规要求',
    suggestions: [
      '阅读并遵守数据安全政策',
      '完成安全培训认证',
      '提供额外的安全保障措施',
      '联系安全团队咨询合规要求'
    ],
    canAppeal: false
  },
  {
    type: 'business_justification',
    label: '业务理由不充分',
    description: '未能提供充分的业务需求理由',
    suggestions: [
      '详细说明业务使用场景',
      '提供ROI分析报告',
      '获得业务负责人支持',
      '明确预期收益和时间规划'
    ],
    canAppeal: true
  },
  {
    type: 'resource_conflict',
    label: '资源冲突',
    description: '申请的资产正在被其他项目使用',
    suggestions: [
      '协调资源使用时间',
      '寻找替代资源',
      '与其他团队协商共享',
      '等待资源释放后重新申请'
    ],
    canAppeal: true
  },
  {
    type: 'other',
    label: '其他原因',
    description: '不属于上述分类的其他原因',
    suggestions: [
      '仔细阅读拒绝理由',
      '联系审核人员了解详情',
      '根据具体情况调整申请',
      '寻求技术支持协助'
    ],
    canAppeal: true
  }
]

export function RejectionReason({
  reason,
  reviewedAt,
  applicationId,
  className
}: RejectionReasonProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [appealText, setAppealText] = useState('')
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false)
  const [showAppealDialog, setShowAppealDialog] = useState(false)
  const { toast } = useToast()

  // 分析拒绝原因类型
  const analyzeRejectionType = (reason: string): RejectionCategory => {
    const lowerReason = reason.toLowerCase()

    if (lowerReason.includes('信息') || lowerReason.includes('材料') || lowerReason.includes('文档')) {
      return rejectionCategories.find(c => c.type === 'incomplete_info') || rejectionCategories[5]
    }
    if (lowerReason.includes('权限') || lowerReason.includes('级别')) {
      return rejectionCategories.find(c => c.type === 'access_level') || rejectionCategories[5]
    }
    if (lowerReason.includes('安全') || lowerReason.includes('合规')) {
      return rejectionCategories.find(c => c.type === 'security_policy') || rejectionCategories[5]
    }
    if (lowerReason.includes('业务') || lowerReason.includes('理由') || lowerReason.includes('需求')) {
      return rejectionCategories.find(c => c.type === 'business_justification') || rejectionCategories[5]
    }
    if (lowerReason.includes('冲突') || lowerReason.includes('占用') || lowerReason.includes('使用中')) {
      return rejectionCategories.find(c => c.type === 'resource_conflict') || rejectionCategories[5]
    }

    return rejectionCategories.find(c => c.type === 'other') || rejectionCategories[5]
  }

  const category = analyzeRejectionType(reason)

  // 提交申诉
  const handleSubmitAppeal = async () => {
    if (!appealText.trim()) {
      toast({
        title: '请填写申诉内容',
        description: '申诉内容不能为空',
        variant: 'destructive'
      })
      return
    }

    setIsSubmittingAppeal(true)
    try {
      const response = await fetch(`/api/applications/${applicationId}/appeal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appealReason: appealText.trim(),
          originalRejectionReason: reason
        })
      })

      if (!response.ok) {
        throw new Error('Failed to submit appeal')
      }

      toast({
        title: '申诉已提交',
        description: '您的申诉已提交，我们会在2个工作日内处理',
      })

      setShowAppealDialog(false)
      setAppealText('')
    } catch (error) {
      console.error('Failed to submit appeal:', error)
      toast({
        title: '提交失败',
        description: '申诉提交失败，请稍后重试',
        variant: 'destructive'
      })
    } finally {
      setIsSubmittingAppeal(false)
    }
  }

  // 重新申请
  const handleReapply = () => {
    // 这里可以跳转到申请页面或打开新申请流程
    window.open(`/applications/new?reference=${applicationId}`, '_blank')
  }

  return (
    <Card className={cn('border-red-200 bg-red-50', className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-red-800">
            <AlertTriangle className="w-5 h-5 mr-2" />
            申请被拒绝
          </CardTitle>
          <Badge variant="destructive" className="text-xs">
            {category.label}
          </Badge>
        </div>
        {reviewedAt && (
          <div className="flex items-center text-sm text-red-700">
            <Clock className="w-4 h-4 mr-1" />
            {reviewedAt.toLocaleString('zh-CN')}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 拒绝原因 */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-red-600" />
            <h4 className="font-medium text-red-900">拒绝原因</h4>
          </div>
          <div className="p-4 bg-white border border-red-200 rounded-lg">
            <p className="text-sm text-gray-800 leading-relaxed">{reason}</p>
          </div>
        </div>

        {/* 问题分类说明 */}
        <div className="space-y-3">
          <h4 className="font-medium text-red-900 flex items-center">
            <HelpCircle className="w-4 h-4 mr-2" />
            问题分类
          </h4>
          <div className="p-3 bg-white border border-red-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900">{category.label}</span>
              <Badge variant={category.canAppeal ? "default" : "secondary"} className="text-xs">
                {category.canAppeal ? "可申诉" : "不可申诉"}
              </Badge>
            </div>
            <p className="text-sm text-gray-600">{category.description}</p>
          </div>
        </div>

        {/* 改进建议 */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between p-0 h-auto font-medium text-red-900 hover:text-red-700"
            >
              <span>改进建议</span>
              <RefreshCw className={cn(
                "w-4 h-4 transition-transform",
                isExpanded && "rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3">
            <div className="mt-4 p-4 bg-white border border-red-200 rounded-lg">
              <ul className="space-y-2">
                {category.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start text-sm text-gray-700">
                    <span className="inline-block w-2 h-2 bg-red-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* 操作按钮 */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleReapply}
            className="flex-1"
            variant="default"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            重新申请
          </Button>

          {category.canAppeal && (
            <Dialog open={showAppealDialog} onOpenChange={setShowAppealDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1">
                  <Send className="w-4 h-4 mr-2" />
                  申诉决定
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                  <DialogTitle>提交申诉</DialogTitle>
                  <DialogDescription>
                    如果您认为拒绝决定存在误解或有新的补充信息，可以提交申诉。我们会重新审核您的申请。
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      申诉理由
                    </label>
                    <Textarea
                      placeholder="请详细说明您的申诉理由，包括任何新的信息或澄清..."
                      value={appealText}
                      onChange={(e) => setAppealText(e.target.value)}
                      rows={4}
                      className="w-full"
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    <p>申诉提交后，我们会在2个工作日内重新审核您的申请。</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowAppealDialog(false)}
                    disabled={isSubmittingAppeal}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleSubmitAppeal}
                    disabled={isSubmittingAppeal}
                  >
                    {isSubmittingAppeal ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        提交中...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        提交申诉
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* 帮助信息 */}
        <div className="text-xs text-gray-600 text-center pt-2 border-t border-red-200">
          <p>如需更多帮助，请联系系统管理员或查看帮助文档</p>
        </div>
      </CardContent>
    </Card>
  )
}