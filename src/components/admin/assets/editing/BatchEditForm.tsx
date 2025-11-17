/**
 * 批量编辑表单组件
 * Story 5.3: 资产编辑与维护
 *
 * 支持批量编辑功能:
 * - 多选资产批量操作
 * - 批量状态更新
 * - 批量标签和分类修改
 * - 批量操作进度显示
 */

'use client'

import React, { useState } from 'react'
import { AssetStatus, BatchEditConfig, BatchOperationType, BatchOperationResult } from '@/types/assetMaintenance'
import { AssetFormData } from '@/types/assetOnboarding'
import TagEditor from './TagEditor'

interface BatchEditFormProps {
  assetIds: string[]
  onSubmit: (changes: Partial<AssetFormData>) => Promise<BatchOperationResult>
  onCancel?: () => void
}

export function BatchEditForm({
  assetIds,
  onSubmit,
  onCancel
}: BatchEditFormProps) {
  const [operationType, setOperationType] = useState<BatchOperationType>(BatchOperationType.STATUS_UPDATE)
  const [changes, setChanges] = useState<Partial<AssetFormData>>({})
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showProgress, setShowProgress] = useState(false)
  const [result, setResult] = useState<BatchOperationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const operationTypeLabels = {
    [BatchOperationType.STATUS_UPDATE]: '批量状态更新',
    [BatchOperationType.TAG_MANAGEMENT]: '批量标签管理',
    [BatchOperationType.CATEGORY_CHANGE]: '批量分类变更',
    [BatchOperationType.METADATA_UPDATE]: '批量元数据更新',
    [BatchOperationType.BULK_DELETE]: '批量删除'
  }

  const handleOperationTypeChange = (type: BatchOperationType) => {
    setOperationType(type)
    setChanges({})
    setError(null)
  }

  const handleStatusChange = (status: AssetStatus) => {
    setChanges({ ...changes, status: status as any })
  }

  const handleTagsChange = (tags: string[]) => {
    setChanges({
      ...changes,
      metadata: { ...changes.metadata, tags }
    })
  }

  const handleCategoryChange = (categoryId: string) => {
    setChanges({ ...changes, categoryId })
  }

  const handleSubmit = async () => {
    if (Object.keys(changes).length === 0) {
      setError('请至少选择一项要修改的内容')
      return
    }

    try {
      setIsSubmitting(true)
      setShowProgress(true)
      setError(null)

      const batchResult = await onSubmit(changes)
      setResult(batchResult)

      if (batchResult.successCount === assetIds.length) {
        setTimeout(() => {
          setShowProgress(false)
          if (onCancel) onCancel()
        }, 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量操作失败')
      console.error('Error in batch edit:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (showProgress && result) {
    return (
      <div className="batch-edit-progress">
        <div className="bg-white rounded-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">批量操作进度</h3>

          {/* 进度条 */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>处理进度</span>
              <span>
                {result.successCount + result.failedCount + result.skippedCount} / {result.totalAssets}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${((result.successCount + result.failedCount + result.skippedCount) / result.totalAssets) * 100}%`
                }}
              />
            </div>
          </div>

          {/* 统计结果 */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{result.successCount}</div>
              <div className="text-sm text-green-800">成功</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{result.failedCount}</div>
              <div className="text-sm text-red-800">失败</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">{result.skippedCount}</div>
              <div className="text-sm text-gray-800">跳过</div>
            </div>
          </div>

          {/* 详细结果 */}
          {result.results.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-gray-900 mb-2">详细结果</h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {result.results.map((item, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded border ${
                      item.status === 'success'
                        ? 'bg-green-50 border-green-200'
                        : item.status === 'failed'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{item.assetName}</span>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          item.status === 'success'
                            ? 'bg-green-200 text-green-800'
                            : item.status === 'failed'
                            ? 'bg-red-200 text-red-800'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {item.status === 'success' ? '成功' : item.status === 'failed' ? '失败' : '跳过'}
                      </span>
                    </div>
                    {item.message && (
                      <p className="text-xs text-gray-600 mt-1">{item.message}</p>
                    )}
                    {item.error && (
                      <p className="text-xs text-red-600 mt-1">{item.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 错误列表 */}
          {result.errors.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-red-800 mb-2">错误详情</h4>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {result.errors.map((err, index) => (
                  <div key={index} className="bg-red-50 border border-red-200 rounded p-3">
                    <div className="font-medium text-sm text-red-800">{err.assetName}</div>
                    <div className="text-xs text-red-600">{err.error}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setShowProgress(false)
              if (onCancel) onCancel()
            }}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            完成
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="batch-edit-form">
      <div className="bg-white rounded-lg">
        {/* 表单头部 */}
        <div className="border-b px-6 py-4">
          <h2 className="text-2xl font-bold text-gray-900">批量编辑</h2>
          <p className="text-sm text-gray-600 mt-1">
            已选择 {assetIds.length} 个资产
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* 表单内容 */}
        <div className="p-6 space-y-6">
          {/* 操作类型选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              操作类型 <span className="text-red-500">*</span>
            </label>
            <select
              value={operationType}
              onChange={(e) => handleOperationTypeChange(e.target.value as BatchOperationType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Object.entries(operationTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* 基于操作类型的表单字段 */}
          {operationType === BatchOperationType.STATUS_UPDATE && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                新状态 <span className="text-red-500">*</span>
              </label>
              <select
                value={(changes.status as any) || ''}
                onChange={(e) => handleStatusChange(e.target.value as AssetStatus)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">请选择状态</option>
                <option value={AssetStatus.ACTIVE}>可用</option>
                <option value={AssetStatus.MAINTENANCE}>维护中</option>
                <option value={AssetStatus.INACTIVE}>已下线</option>
                <option value={AssetStatus.DEPRECATED}>已弃用</option>
              </select>
            </div>
          )}

          {operationType === BatchOperationType.TAG_MANAGEMENT && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                标签 <span className="text-red-500">*</span>
              </label>
              <TagEditor
                assetId=""
                currentTags={changes.metadata?.tags || []}
                onChange={handleTagsChange}
                placeholder="添加标签..."
                maxTags={20}
              />
              <p className="text-xs text-gray-500 mt-1">
                这些标签将添加到所有选中的资产中
              </p>
            </div>
          )}

          {operationType === BatchOperationType.CATEGORY_CHANGE && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                新分类 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={changes.categoryId || ''}
                onChange={(e) => handleCategoryChange(e.target.value)}
                placeholder="输入分类ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {operationType === BatchOperationType.METADATA_UPDATE && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  更新频率
                </label>
                <select
                  value={changes.metadata?.updateFrequency || ''}
                  onChange={(e) =>
                    setChanges({
                      ...changes,
                      metadata: { ...changes.metadata, updateFrequency: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">不修改</option>
                  <option value="realtime">实时</option>
                  <option value="daily">每日</option>
                  <option value="weekly">每周</option>
                  <option value="monthly">每月</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  敏感级别
                </label>
                <select
                  value={changes.metadata?.sensitivityLevel || ''}
                  onChange={(e) =>
                    setChanges({
                      ...changes,
                      metadata: { ...changes.metadata, sensitivityLevel: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">不修改</option>
                  <option value="public">公开</option>
                  <option value="internal">内部</option>
                  <option value="confidential">机密</option>
                  <option value="restricted">受限</option>
                </select>
              </div>
            </div>
          )}

          {operationType === BatchOperationType.BULK_DELETE && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium mb-2">⚠ 警告</p>
              <p className="text-sm text-red-700">
                此操作将删除所有选中的资产,且无法恢复。请谨慎操作!
              </p>
            </div>
          )}

          {/* 操作原因 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              操作原因 {operationType === BatchOperationType.BULK_DELETE && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请说明批量操作的原因..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* 表单底部操作按钮 */}
        <div className="bg-gray-50 border-t px-6 py-4 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || Object.keys(changes).length === 0}
            className={`px-4 py-2 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed ${
              operationType === BatchOperationType.BULK_DELETE
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSubmitting ? '处理中...' : operationType === BatchOperationType.BULK_DELETE ? '确认删除' : '执行批量操作'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BatchEditForm
