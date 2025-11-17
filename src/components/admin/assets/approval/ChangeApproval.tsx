/**
 * 变更审核组件
 * Story 5.3: 资产编辑与维护
 *
 * 提供变更审核功能:
 * - 审核请求详情展示
 * - 变更前后对比
 * - 审核操作(批准/拒绝/请求修改)
 * - 审核意见填写
 */

'use client'

import React, { useState } from 'react'
import {
  ChangeApprovalRequest,
  ApprovalStatus,
  ApprovalAction,
  FieldDifference
} from '@/types/assetMaintenance'

interface ChangeApprovalProps {
  request: ChangeApprovalRequest
  onApprove: (comments?: string) => Promise<void>
  onReject: (comments: string) => Promise<void>
  onRequestChanges: (comments: string) => Promise<void>
  onClose?: () => void
}

export function ChangeApproval({
  request,
  onApprove,
  onReject,
  onRequestChanges,
  onClose
}: ChangeApprovalProps) {
  const [action, setAction] = useState<'approve' | 'reject' | 'request_changes' | null>(null)
  const [comments, setComments] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!action) return

    if ((action === 'reject' || action === 'request_changes') && !comments.trim()) {
      setError('请填写审核意见')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      switch (action) {
        case 'approve':
          await onApprove(comments || undefined)
          break
        case 'reject':
          await onReject(comments)
          break
        case 'request_changes':
          await onRequestChanges(comments)
          break
      }

      if (onClose) {
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '审核操作失败')
      console.error('Error submitting approval:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status: ApprovalStatus) => {
    const badges = {
      [ApprovalStatus.PENDING]: 'bg-yellow-100 text-yellow-800',
      [ApprovalStatus.APPROVED]: 'bg-green-100 text-green-800',
      [ApprovalStatus.REJECTED]: 'bg-red-100 text-red-800',
      [ApprovalStatus.CANCELLED]: 'bg-gray-100 text-gray-800'
    }

    const labels = {
      [ApprovalStatus.PENDING]: '待审核',
      [ApprovalStatus.APPROVED]: '已批准',
      [ApprovalStatus.REJECTED]: '已拒绝',
      [ApprovalStatus.CANCELLED]: '已取消'
    }

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badges[status]}`}>
        {labels[status]}
      </span>
    )
  }

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '(空)'
    }
    if (Array.isArray(value)) {
      return value.join(', ')
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  const getChangedFields = (): FieldDifference[] => {
    if (!request.previousData) return []

    const differences: FieldDifference[] = []
    const allFields = new Set([
      ...Object.keys(request.changes),
      ...Object.keys(request.previousData)
    ])

    for (const field of allFields) {
      const oldValue = (request.previousData as any)[field]
      const newValue = (request.changes as any)[field]

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        let changeType: 'added' | 'removed' | 'modified' = 'modified'

        if (oldValue === undefined) changeType = 'added'
        else if (newValue === undefined) changeType = 'removed'

        differences.push({
          field,
          fieldLabel: field,
          oldValue,
          newValue,
          changeType
        })
      }
    }

    return differences
  }

  const changedFields = getChangedFields()

  return (
    <div className="change-approval bg-white rounded-lg">
      {/* 头部 */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">变更审核</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="关闭"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* 基本信息 */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">审核状态</span>
              {getStatusBadge(request.status)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">请求类型</span>
              <span className="text-sm font-medium text-gray-900">{request.type}</span>
            </div>
            {request.assetName && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">资产名称</span>
                <span className="text-sm font-medium text-gray-900">{request.assetName}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">请求人</span>
              <span className="text-sm font-medium text-gray-900">
                {request.requestedByName || request.requestedBy}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">请求时间</span>
              <span className="text-sm font-medium text-gray-900">
                {new Date(request.requestedAt).toLocaleString('zh-CN')}
              </span>
            </div>
            {request.reason && (
              <div>
                <span className="text-sm text-gray-600 block mb-1">变更原因</span>
                <p className="text-sm text-gray-900 bg-white p-3 rounded border">
                  {request.reason}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* 变更内容 */}
        {changedFields.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              变更内容 ({changedFields.length} 个字段)
            </h3>
            <div className="space-y-3">
              {changedFields.map((diff, index) => (
                <div key={index} className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b">
                    <span className="font-medium text-gray-900">{diff.fieldLabel}</span>
                    <span className="ml-2 text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                      {diff.changeType === 'added' ? '新增' : diff.changeType === 'removed' ? '删除' : '修改'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 divide-x">
                    <div className="p-3">
                      <p className="text-xs text-gray-500 mb-2">原值</p>
                      <div className="bg-red-50 p-2 rounded text-sm font-mono">
                        <pre className="whitespace-pre-wrap break-words">
                          {formatValue(diff.oldValue)}
                        </pre>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-gray-500 mb-2">新值</p>
                      <div className="bg-green-50 p-2 rounded text-sm font-mono">
                        <pre className="whitespace-pre-wrap break-words">
                          {formatValue(diff.newValue)}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 审核历史 */}
        {request.approvalHistory.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">审核历史</h3>
            <div className="space-y-3">
              {request.approvalHistory.map((history, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">
                      {history.approverName || history.approver}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      history.action === 'approve' ? 'bg-green-100 text-green-800' :
                      history.action === 'reject' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {history.action === 'approve' ? '批准' :
                       history.action === 'reject' ? '拒绝' : '请求修改'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    {new Date(history.timestamp).toLocaleString('zh-CN')}
                  </p>
                  {history.comments && (
                    <p className="text-sm text-gray-700 bg-white p-2 rounded border">
                      {history.comments}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 审核操作 */}
        {request.status === ApprovalStatus.PENDING && (
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">审核操作</h3>

            {/* 操作选择 */}
            <div className="flex space-x-3 mb-4">
              <button
                onClick={() => setAction('approve')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                  action === 'approve'
                    ? 'border-green-500 bg-green-50 text-green-800'
                    : 'border-gray-300 hover:border-green-300'
                }`}
              >
                <div className="text-center">
                  <div className="text-lg mb-1">✓</div>
                  <div className="font-medium">批准</div>
                </div>
              </button>

              <button
                onClick={() => setAction('request_changes')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                  action === 'request_changes'
                    ? 'border-yellow-500 bg-yellow-50 text-yellow-800'
                    : 'border-gray-300 hover:border-yellow-300'
                }`}
              >
                <div className="text-center">
                  <div className="text-lg mb-1">⟲</div>
                  <div className="font-medium">请求修改</div>
                </div>
              </button>

              <button
                onClick={() => setAction('reject')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                  action === 'reject'
                    ? 'border-red-500 bg-red-50 text-red-800'
                    : 'border-gray-300 hover:border-red-300'
                }`}
              >
                <div className="text-center">
                  <div className="text-lg mb-1">✕</div>
                  <div className="font-medium">拒绝</div>
                </div>
              </button>
            </div>

            {/* 审核意见 */}
            {action && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  审核意见
                  {(action === 'reject' || action === 'request_changes') && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder={
                    action === 'approve' ? '可选:添加批准意见...' :
                    action === 'reject' ? '请说明拒绝原因...' :
                    '请说明需要修改的内容...'
                  }
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
          </section>
        )}
      </div>

      {/* 底部操作按钮 */}
      {request.status === ApprovalStatus.PENDING && (
        <div className="bg-gray-50 border-t px-6 py-4 flex justify-end space-x-3">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              取消
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !action}
            className={`px-4 py-2 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed ${
              action === 'approve' ? 'bg-green-600 hover:bg-green-700' :
              action === 'reject' ? 'bg-red-600 hover:bg-red-700' :
              'bg-yellow-600 hover:bg-yellow-700'
            }`}
          >
            {isSubmitting ? '提交中...' :
             action === 'approve' ? '确认批准' :
             action === 'reject' ? '确认拒绝' :
             action === 'request_changes' ? '请求修改' : '提交审核'}
          </button>
        </div>
      )}
    </div>
  )
}

export default ChangeApproval
