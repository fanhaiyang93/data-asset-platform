/**
 * 资产恢复组件
 * Story 5.4: 资产下架管理
 *
 * 提供已下架资产的恢复功能
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import {
  ExtendedAssetStatus,
  AssetRestoreConfig,
  AssetRestoreResult
} from '@/types/assetLifecycle'
import { AssetDecommissionService } from '@/lib/services/assetDecommission'
import { getStatusLabel } from '@/lib/services/softDelete'

interface AssetRestoreProps {
  assetId: string
  assetName: string
  currentStatus: ExtendedAssetStatus
  open: boolean
  onOpenChange: (open: boolean) => void
  onRestoreComplete?: (result: AssetRestoreResult) => void
}

export function AssetRestore({
  assetId,
  assetName,
  currentStatus,
  open,
  onOpenChange,
  onRestoreComplete
}: AssetRestoreProps) {
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState('')
  const [restoreStatus, setRestoreStatus] = useState<ExtendedAssetStatus>(
    ExtendedAssetStatus.ACTIVE
  )
  const [notifyUsers, setNotifyUsers] = useState(true)
  const [result, setResult] = useState<AssetRestoreResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRestore = async () => {
    setLoading(true)
    setError(null)

    try {
      const config: AssetRestoreConfig = {
        assetId,
        reason: reason || undefined,
        restoreStatus,
        notifyUsers,
        resetMetrics: true
      }

      // TODO: 替换为实际的用户ID获取
      const userId = 'current-user-id'

      const restoreResult = await AssetDecommissionService.restoreAsset(
        config,
        userId
      )

      setResult(restoreResult)

      if (restoreResult.success) {
        // 延迟关闭对话框,让用户看到成功消息
        setTimeout(() => {
          onRestoreComplete?.(restoreResult)
          onOpenChange(false)
          handleReset()
        }, 2000)
      } else {
        setError(restoreResult.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '恢复操作失败')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setReason('')
    setRestoreStatus(ExtendedAssetStatus.ACTIVE)
    setNotifyUsers(true)
    setResult(null)
    setError(null)
  }

  const handleCancel = () => {
    onOpenChange(false)
    handleReset()
  }

  // 可用的恢复状态选项
  const availableStatuses = [
    ExtendedAssetStatus.ACTIVE,
    ExtendedAssetStatus.MAINTENANCE,
    ExtendedAssetStatus.INACTIVE,
    ExtendedAssetStatus.DEPRECATED
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>恢复资产</DialogTitle>
          <DialogDescription>
            将已下架的资产恢复为活跃状态,使其重新对用户可见
          </DialogDescription>
        </DialogHeader>

        {/* 成功提示 */}
        {result && result.success && (
          <Alert className="border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {result.message}
            </AlertDescription>
          </Alert>
        )}

        {/* 错误提示 */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 警告信息 */}
        {result && result.warnings && result.warnings.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                {result.warnings.map((warning, idx) => (
                  <div key={idx}>{warning}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {!result?.success && (
          <div className="space-y-4">
            {/* 资产信息 */}
            <div className="rounded-lg border p-4 bg-gray-50">
              <h4 className="font-medium mb-2">资产信息</h4>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-gray-500">名称:</span>
                  <span className="ml-2 font-medium">{assetName}</span>
                </div>
                <div>
                  <span className="text-gray-500">当前状态:</span>
                  <span className="ml-2 font-medium text-red-600">
                    {getStatusLabel(currentStatus)}
                  </span>
                </div>
              </div>
            </div>

            {/* 恢复状态选择 */}
            <div className="space-y-2">
              <Label htmlFor="restore-status">恢复后状态 *</Label>
              <Select
                value={restoreStatus}
                onValueChange={(value) => setRestoreStatus(value as ExtendedAssetStatus)}
              >
                <SelectTrigger id="restore-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {getStatusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500">
                选择资产恢复后的状态,默认为"活跃"
              </p>
            </div>

            {/* 恢复原因 */}
            <div className="space-y-2">
              <Label htmlFor="restore-reason">恢复原因(可选)</Label>
              <Textarea
                id="restore-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请说明恢复此资产的原因..."
                rows={3}
                disabled={loading}
              />
            </div>

            {/* 通知选项 */}
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
                通知相关用户资产已恢复
              </Label>
            </div>
          </div>
        )}

        <DialogFooter>
          {!result?.success && (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={loading}
              >
                取消
              </Button>
              <Button
                onClick={handleRestore}
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                确认恢复
              </Button>
            </>
          )}
          {result?.success && (
            <Button onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
