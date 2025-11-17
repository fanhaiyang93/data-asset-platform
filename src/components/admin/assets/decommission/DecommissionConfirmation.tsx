/**
 * 下架确认对话框组件
 * Story 5.4: 资产下架管理
 *
 * 提供多级确认和影响评估的下架确认机制
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react'
import {
  DecommissionReason,
  DecommissionReasonLabels,
  DecommissionImpact,
  DecommissionConfirmation
} from '@/types/assetLifecycle'
import { AssetDecommissionService } from '@/lib/services/assetDecommission'

interface DecommissionConfirmationProps {
  assetId: string
  assetName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDecommissionConfirm?: () => void
}

export function DecommissionConfirmationDialog({
  assetId,
  assetName,
  open,
  onOpenChange,
  onDecommissionConfirm
}: DecommissionConfirmationProps) {
  const [step, setStep] = useState<'reason' | 'assessment' | 'confirmation' | 'result'>('reason')
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState<DecommissionReason>(DecommissionReason.DATA_EXPIRED)
  const [reasonDetail, setReasonDetail] = useState('')
  const [impact, setImpact] = useState<DecommissionImpact | null>(null)
  const [nameConfirmation, setNameConfirmation] = useState('')
  const [notifyUsers, setNotifyUsers] = useState(true)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  // 重置状态
  const handleReset = () => {
    setStep('reason')
    setReason(DecommissionReason.DATA_EXPIRED)
    setReasonDetail('')
    setImpact(null)
    setNameConfirmation('')
    setNotifyUsers(true)
    setResult(null)
  }

  // 第一步: 选择下架原因
  const handleReasonNext = async () => {
    if (!reasonDetail.trim()) {
      return
    }

    setLoading(true)
    setStep('assessment')

    try {
      // 执行影响评估
      const impactResult = await AssetDecommissionService.assessDecommissionImpact(assetId)
      setImpact(impactResult)
      setLoading(false)
    } catch (error) {
      setLoading(false)
      console.error('Impact assessment failed:', error)
    }
  }

  // 第二步: 审查影响评估
  const handleAssessmentNext = () => {
    if (!impact) return

    // 高风险需要严格确认
    if (impact.riskLevel === 'HIGH') {
      setStep('confirmation')
    } else if (impact.canSafelyDecommission) {
      // 低风险可以直接下架
      handleDecommission()
    } else {
      setStep('confirmation')
    }
  }

  // 第三步: 最终确认并执行下架
  const handleDecommission = async () => {
    // 高风险资产需要输入名称确认
    if (impact?.riskLevel === 'HIGH' && nameConfirmation !== assetName) {
      return
    }

    setLoading(true)

    try {
      // TODO: 替换为实际的用户ID
      const userId = 'current-user-id'

      const decommissionResult = await AssetDecommissionService.decommissionAsset(
        assetId,
        reason,
        reasonDetail,
        userId
      )

      setResult(decommissionResult)
      setStep('result')

      if (decommissionResult.success) {
        // 延迟关闭对话框
        setTimeout(() => {
          onDecommissionConfirm?.()
          onOpenChange(false)
          handleReset()
        }, 2000)
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : '下架操作失败'
      })
      setStep('result')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
    handleReset()
  }

  const getRiskLevelColor = (level: 'LOW' | 'MEDIUM' | 'HIGH') => {
    switch (level) {
      case 'LOW':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'HIGH':
        return 'text-red-600 bg-red-50 border-red-200'
    }
  }

  const getRiskLevelLabel = (level: 'LOW' | 'MEDIUM' | 'HIGH') => {
    switch (level) {
      case 'LOW':
        return '低风险'
      case 'MEDIUM':
        return '中等风险'
      case 'HIGH':
        return '高风险'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>下架资产确认</DialogTitle>
          <DialogDescription>
            请仔细阅读下架影响评估,确认后资产将不再对用户可见
          </DialogDescription>
        </DialogHeader>

        {/* 步骤 1: 选择下架原因 */}
        {step === 'reason' && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 bg-gray-50">
              <h4 className="font-medium mb-2">资产信息</h4>
              <div className="text-sm">
                <span className="text-gray-500">名称:</span>
                <span className="ml-2 font-medium">{assetName}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="decommission-reason">下架原因 *</Label>
              <Select
                value={reason}
                onValueChange={(value) => setReason(value as DecommissionReason)}
              >
                <SelectTrigger id="decommission-reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DecommissionReasonLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason-detail">详细说明 *</Label>
              <Textarea
                id="reason-detail"
                value={reasonDetail}
                onChange={(e) => setReasonDetail(e.target.value)}
                placeholder="请详细说明下架原因,至少20个字..."
                rows={4}
                disabled={loading}
              />
              <p className="text-sm text-gray-500">
                已输入 {reasonDetail.length} 字 (最少20字)
              </p>
            </div>
          </div>
        )}

        {/* 步骤 2: 影响评估 */}
        {step === 'assessment' && impact && (
          <div className="space-y-4">
            {/* 风险等级 */}
            <Alert className={getRiskLevelColor(impact.riskLevel)}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>风险等级: {getRiskLevelLabel(impact.riskLevel)}</AlertTitle>
              <AlertDescription>
                {impact.canSafelyDecommission
                  ? '此资产可以安全下架'
                  : '下架此资产存在风险,请仔细检查影响评估'}
              </AlertDescription>
            </Alert>

            {/* 影响统计 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {impact.activeApplications}
                </div>
                <div className="text-sm text-gray-600 mt-1">活跃申请</div>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {impact.dependentAssets.length}
                </div>
                <div className="text-sm text-gray-600 mt-1">依赖资产</div>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {impact.affectedUsers.length}
                </div>
                <div className="text-sm text-gray-600 mt-1">受影响用户</div>
              </div>
            </div>

            {/* 警告信息 */}
            {impact.warningMessages.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>注意事项</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    {impact.warningMessages.map((warning, idx) => (
                      <li key={idx} className="text-sm">{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* 建议措施 */}
            {impact.recommendations.length > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>建议措施</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    {impact.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-sm">{rec}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* 步骤 3: 最终确认 */}
        {step === 'confirmation' && impact && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>警告:此操作无法轻易撤销</AlertTitle>
              <AlertDescription>
                下架后资产将对所有用户不可见,请确认您了解下架的影响
              </AlertDescription>
            </Alert>

            {/* 高风险需要输入资产名称 */}
            {impact.riskLevel === 'HIGH' && (
              <div className="space-y-2">
                <Label htmlFor="name-confirmation">
                  请输入资产名称 "{assetName}" 以确认下架 *
                </Label>
                <Input
                  id="name-confirmation"
                  value={nameConfirmation}
                  onChange={(e) => setNameConfirmation(e.target.value)}
                  placeholder={assetName}
                  disabled={loading}
                />
                {nameConfirmation && nameConfirmation !== assetName && (
                  <p className="text-sm text-red-600">资产名称不匹配</p>
                )}
              </div>
            )}

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="notify-users"
                checked={notifyUsers}
                onChange={(e) => setNotifyUsers(e.target.checked)}
                disabled={loading}
                className="rounded"
              />
              <Label htmlFor="notify-users" className="cursor-pointer">
                通知受影响的用户
              </Label>
            </div>
          </div>
        )}

        {/* 步骤 4: 结果 */}
        {step === 'result' && result && (
          <Alert className={result.success ? 'border-green-500 bg-green-50' : ''}>
            {result.success ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertTitle>
              {result.success ? '下架成功' : '下架失败'}
            </AlertTitle>
            <AlertDescription className={result.success ? 'text-green-800' : ''}>
              {result.message}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {step === 'reason' && (
            <>
              <Button variant="outline" onClick={handleCancel}>
                取消
              </Button>
              <Button
                onClick={handleReasonNext}
                disabled={!reasonDetail.trim() || reasonDetail.length < 20 || loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                下一步
              </Button>
            </>
          )}

          {step === 'assessment' && (
            <>
              <Button variant="outline" onClick={() => setStep('reason')}>
                返回
              </Button>
              <Button onClick={handleAssessmentNext} disabled={loading}>
                {impact?.canSafelyDecommission ? '确认下架' : '继续确认'}
              </Button>
            </>
          )}

          {step === 'confirmation' && (
            <>
              <Button variant="outline" onClick={() => setStep('assessment')}>
                返回
              </Button>
              <Button
                variant="destructive"
                onClick={handleDecommission}
                disabled={
                  loading ||
                  (impact?.riskLevel === 'HIGH' && nameConfirmation !== assetName)
                }
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                确认下架
              </Button>
            </>
          )}

          {step === 'result' && (
            <Button onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
