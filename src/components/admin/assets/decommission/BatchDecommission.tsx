/**
 * 批量下架组件
 * Story 5.4: 资产下架管理
 *
 * 提供资产批量下架功能,支持进度显示和错误处理
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react'
import {
  DecommissionReason,
  DecommissionReasonLabels,
  BatchDecommissionConfig,
  BatchDecommissionResult,
  DecommissionItemResult
} from '@/types/assetLifecycle'
import { AssetDecommissionService } from '@/lib/services/assetDecommission'

interface BatchDecommissionProps {
  assetIds: string[]
  assetNames: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onBatchComplete?: (result: BatchDecommissionResult) => void
}

export function BatchDecommission({
  assetIds,
  assetNames,
  open,
  onOpenChange,
  onBatchComplete
}: BatchDecommissionProps) {
  const [step, setStep] = useState<'config' | 'processing' | 'result'>('config')
  const [reason, setReason] = useState<DecommissionReason>(DecommissionReason.DATA_EXPIRED)
  const [reasonDetail, setReasonDetail] = useState('')
  const [notifyUsers, setNotifyUsers] = useState(false)
  const [skipImpactCheck, setSkipImpactCheck] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentAsset, setCurrentAsset] = useState('')
  const [result, setResult] = useState<BatchDecommissionResult | null>(null)

  const totalAssets = assetIds.length

  const handleStartBatch = async () => {
    if (!reasonDetail.trim()) {
      return
    }

    setStep('processing')
    setProgress(0)

    try {
      const config: BatchDecommissionConfig = {
        assetIds,
        reason,
        reasonDetail,
        notifyUsers,
        skipImpactCheck,
        batchSize: 5, // 每批处理5个
        delayBetweenBatches: 200 // 批次间延迟200ms
      }

      // TODO: 替换为实际的用户ID
      const userId = 'current-user-id'

      // 执行批量下架
      const batchResult = await AssetDecommissionService.batchDecommissionAssets(
        config,
        userId
      )

      setResult(batchResult)
      setProgress(100)
      setStep('result')

      // 通知完成
      onBatchComplete?.(batchResult)
    } catch (error) {
      console.error('Batch decommission failed:', error)
    }
  }

  const handleReset = () => {
    setStep('config')
    setReason(DecommissionReason.DATA_EXPIRED)
    setReasonDetail('')
    setNotifyUsers(false)
    setSkipImpactCheck(false)
    setProgress(0)
    setCurrentAsset('')
    setResult(null)
  }

  const handleCancel = () => {
    onOpenChange(false)
    handleReset()
  }

  const getStatusIcon = (status: 'success' | 'failed' | 'skipped') => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'skipped':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>批量下架资产</DialogTitle>
          <DialogDescription>
            批量下架 {totalAssets} 个资产,请配置下架参数
          </DialogDescription>
        </DialogHeader>

        {/* 步骤 1: 配置 */}
        {step === 'config' && (
          <div className="space-y-4">
            {/* 资产列表预览 */}
            <div className="rounded-lg border p-4 bg-gray-50 max-h-40 overflow-y-auto">
              <h4 className="font-medium mb-2">待下架资产 ({totalAssets})</h4>
              <ul className="text-sm space-y-1">
                {assetNames.slice(0, 5).map((name, idx) => (
                  <li key={idx} className="text-gray-700">• {name}</li>
                ))}
                {assetNames.length > 5 && (
                  <li className="text-gray-500">... 及其他 {assetNames.length - 5} 个资产</li>
                )}
              </ul>
            </div>

            {/* 下架原因 */}
            <div className="space-y-2">
              <Label htmlFor="batch-reason">统一下架原因 *</Label>
              <Select
                value={reason}
                onValueChange={(value) => setReason(value as DecommissionReason)}
              >
                <SelectTrigger id="batch-reason">
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

            {/* 详细说明 */}
            <div className="space-y-2">
              <Label htmlFor="batch-detail">详细说明 *</Label>
              <Textarea
                id="batch-detail"
                value={reasonDetail}
                onChange={(e) => setReasonDetail(e.target.value)}
                placeholder="请说明批量下架的原因..."
                rows={4}
              />
            </div>

            {/* 选项 */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="batch-notify"
                  checked={notifyUsers}
                  onChange={(e) => setNotifyUsers(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="batch-notify" className="cursor-pointer">
                  通知受影响用户(可能发送大量通知)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="skip-check"
                  checked={skipImpactCheck}
                  onChange={(e) => setSkipImpactCheck(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="skip-check" className="cursor-pointer">
                  跳过影响检查(高风险资产将被跳过)
                </Label>
              </div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                批量操作将分批执行,高风险资产会被自动跳过
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* 步骤 2: 处理中 */}
        {step === 'processing' && (
          <div className="space-y-4">
            <div className="text-center py-8">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
              <p className="mt-4 font-medium">正在批量下架资产...</p>
              {currentAsset && (
                <p className="mt-2 text-sm text-gray-600">
                  当前处理: {currentAsset}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>处理进度</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                请勿关闭此窗口,批量操作正在进行中...
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* 步骤 3: 结果 */}
        {step === 'result' && result && (
          <div className="space-y-4">
            {/* 统计摘要 */}
            <div className="grid grid-cols-4 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-700">
                  {result.totalAssets}
                </div>
                <div className="text-sm text-gray-600 mt-1">总计</div>
              </div>
              <div className="border rounded-lg p-4 text-center bg-green-50">
                <div className="text-2xl font-bold text-green-600">
                  {result.successCount}
                </div>
                <div className="text-sm text-gray-600 mt-1">成功</div>
              </div>
              <div className="border rounded-lg p-4 text-center bg-red-50">
                <div className="text-2xl font-bold text-red-600">
                  {result.failedCount}
                </div>
                <div className="text-sm text-gray-600 mt-1">失败</div>
              </div>
              <div className="border rounded-lg p-4 text-center bg-yellow-50">
                <div className="text-2xl font-bold text-yellow-600">
                  {result.skippedCount}
                </div>
                <div className="text-sm text-gray-600 mt-1">跳过</div>
              </div>
            </div>

            {/* 执行时长 */}
            <div className="text-center text-sm text-gray-600">
              执行时长: {(result.duration / 1000).toFixed(2)} 秒
            </div>

            {/* 操作结果列表 */}
            {result.results.length > 0 && (
              <div className="border rounded-lg max-h-60 overflow-y-auto">
                <div className="divide-y">
                  {result.results.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-start gap-3">
                      {getStatusIcon(item.status)}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.assetName}</div>
                        {item.message && (
                          <div className="text-sm text-gray-600 mt-1">
                            {item.message}
                          </div>
                        )}
                        {item.error && (
                          <div className="text-sm text-red-600 mt-1">
                            {item.error}
                          </div>
                        )}
                        {item.warnings && item.warnings.length > 0 && (
                          <div className="text-sm text-yellow-600 mt-1">
                            {item.warnings.join('; ')}
                          </div>
                        )}
                      </div>
                      <Badge
                        variant={
                          item.status === 'success'
                            ? 'default'
                            : item.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {item.status === 'success'
                          ? '成功'
                          : item.status === 'failed'
                            ? '失败'
                            : '跳过'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 错误详情 */}
            {result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>发现 {result.errors.length} 个错误</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 space-y-1 text-sm">
                    {result.errors.slice(0, 3).map((error, idx) => (
                      <div key={idx}>
                        • {error.assetName}: {error.error}
                      </div>
                    ))}
                    {result.errors.length > 3 && (
                      <div className="text-gray-600">
                        ... 及其他 {result.errors.length - 3} 个错误
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* 成功提示 */}
            {result.successCount === result.totalAssets && (
              <Alert className="border-green-500 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">批量下架完成</AlertTitle>
                <AlertDescription className="text-green-700">
                  所有资产已成功下架
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'config' && (
            <>
              <Button variant="outline" onClick={handleCancel}>
                取消
              </Button>
              <Button
                onClick={handleStartBatch}
                disabled={!reasonDetail.trim()}
              >
                开始批量下架
              </Button>
            </>
          )}

          {step === 'processing' && (
            <Button variant="outline" disabled>
              处理中...
            </Button>
          )}

          {step === 'result' && (
            <Button onClick={() => {
              onOpenChange(false)
              handleReset()
            }}>
              关闭
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
