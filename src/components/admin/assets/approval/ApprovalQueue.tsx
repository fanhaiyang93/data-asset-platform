/**
 * 审核队列组件
 * Story 5.3: 资产编辑与维护
 *
 * 显示待审核的变更请求列表:
 * - 审核请求列表展示
 * - 按状态筛选
 * - 按优先级排序
 * - 批量审核操作
 */

'use client'

import React, { useState, useEffect } from 'react'
import {
  ChangeApprovalRequest,
  ApprovalStatus,
  ChangeType
} from '@/types/assetMaintenance'
import ChangeApproval from './ChangeApproval'

interface ApprovalQueueProps {
  requests?: ChangeApprovalRequest[]
  onRefresh?: () => void
}

export function ApprovalQueue({
  requests: initialRequests,
  onRefresh
}: ApprovalQueueProps) {
  const [requests, setRequests] = useState<ChangeApprovalRequest[]>(initialRequests || [])
  const [loading, setLoading] = useState(!initialRequests)
  const [selectedStatus, setSelectedStatus] = useState<ApprovalStatus | 'all'>('all')
  const [selectedRequest, setSelectedRequest] = useState<ChangeApprovalRequest | null>(null)
  const [showApprovalModal, setShowApprovalModal] = useState(false)

  useEffect(() => {
    if (!initialRequests) {
      loadRequests()
    }
  }, [])

  const loadRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/assets/approvals')

      if (!response.ok) {
        throw new Error('Failed to load approval requests')
      }

      const data = await response.json()
      setRequests(data.requests || [])
    } catch (error) {
      console.error('Error loading approval requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (requestId: string, comments?: string) => {
    try {
      const response = await fetch(`/api/assets/approvals/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ comments })
      })

      if (!response.ok) {
        throw new Error('Failed to approve request')
      }

      // 刷新列表
      if (onRefresh) {
        onRefresh()
      } else {
        await loadRequests()
      }

      setShowApprovalModal(false)
      setSelectedRequest(null)
    } catch (error) {
      console.error('Error approving request:', error)
      throw error
    }
  }

  const handleReject = async (requestId: string, comments: string) => {
    try {
      const response = await fetch(`/api/assets/approvals/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ comments })
      })

      if (!response.ok) {
        throw new Error('Failed to reject request')
      }

      // 刷新列表
      if (onRefresh) {
        onRefresh()
      } else {
        await loadRequests()
      }

      setShowApprovalModal(false)
      setSelectedRequest(null)
    } catch (error) {
      console.error('Error rejecting request:', error)
      throw error
    }
  }

  const handleRequestChanges = async (requestId: string, comments: string) => {
    try {
      const response = await fetch(`/api/assets/approvals/${requestId}/request-changes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ comments })
      })

      if (!response.ok) {
        throw new Error('Failed to request changes')
      }

      // 刷新列表
      if (onRefresh) {
        onRefresh()
      } else {
        await loadRequests()
      }

      setShowApprovalModal(false)
      setSelectedRequest(null)
    } catch (error) {
      console.error('Error requesting changes:', error)
      throw error
    }
  }

  const handleSelectRequest = (request: ChangeApprovalRequest) => {
    setSelectedRequest(request)
    setShowApprovalModal(true)
  }

  const getStatusBadge = (status: ApprovalStatus) => {
    const badges = {
      [ApprovalStatus.PENDING]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      [ApprovalStatus.APPROVED]: 'bg-green-100 text-green-800 border-green-200',
      [ApprovalStatus.REJECTED]: 'bg-red-100 text-red-800 border-red-200',
      [ApprovalStatus.CANCELLED]: 'bg-gray-100 text-gray-800 border-gray-200'
    }

    const labels = {
      [ApprovalStatus.PENDING]: '待审核',
      [ApprovalStatus.APPROVED]: '已批准',
      [ApprovalStatus.REJECTED]: '已拒绝',
      [ApprovalStatus.CANCELLED]: '已取消'
    }

    return (
      <span className={`px-2 py-1 rounded border text-xs font-medium ${badges[status]}`}>
        {labels[status]}
      </span>
    )
  }

  const getChangeTypeLabel = (type: ChangeType) => {
    const labels = {
      [ChangeType.CREATE]: '创建',
      [ChangeType.UPDATE]: '更新',
      [ChangeType.STATUS_CHANGE]: '状态变更',
      [ChangeType.DELETE]: '删除',
      [ChangeType.BULK_UPDATE]: '批量更新'
    }
    return labels[type] || type
  }

  const filteredRequests = selectedStatus === 'all'
    ? requests
    : requests.filter(r => r.status === selectedStatus)

  const pendingCount = requests.filter(r => r.status === ApprovalStatus.PENDING).length
  const approvedCount = requests.filter(r => r.status === ApprovalStatus.APPROVED).length
  const rejectedCount = requests.filter(r => r.status === ApprovalStatus.REJECTED).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载审核队列中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="approval-queue">
      {/* 统计栏 */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">审核队列</h2>
          <button
            onClick={() => onRefresh ? onRefresh() : loadRequests()}
            className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            刷新
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <button
            onClick={() => setSelectedStatus('all')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              selectedStatus === 'all'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="text-2xl font-bold text-gray-900">{requests.length}</div>
            <div className="text-sm text-gray-600">全部请求</div>
          </button>

          <button
            onClick={() => setSelectedStatus(ApprovalStatus.PENDING)}
            className={`p-4 rounded-lg border-2 transition-colors ${
              selectedStatus === ApprovalStatus.PENDING
                ? 'border-yellow-500 bg-yellow-50'
                : 'border-gray-200 hover:border-yellow-300'
            }`}
          >
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            <div className="text-sm text-gray-600">待审核</div>
          </button>

          <button
            onClick={() => setSelectedStatus(ApprovalStatus.APPROVED)}
            className={`p-4 rounded-lg border-2 transition-colors ${
              selectedStatus === ApprovalStatus.APPROVED
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-green-300'
            }`}
          >
            <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
            <div className="text-sm text-gray-600">已批准</div>
          </button>

          <button
            onClick={() => setSelectedStatus(ApprovalStatus.REJECTED)}
            className={`p-4 rounded-lg border-2 transition-colors ${
              selectedStatus === ApprovalStatus.REJECTED
                ? 'border-red-500 bg-red-50'
                : 'border-gray-200 hover:border-red-300'
            }`}
          >
            <div className="text-2xl font-bold text-red-600">{rejectedCount}</div>
            <div className="text-sm text-gray-600">已拒绝</div>
          </button>
        </div>
      </div>

      {/* 审核请求列表 */}
      <div className="p-6">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            暂无审核请求
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <div
                key={request.id}
                className="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleSelectRequest(request)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {request.assetName || `审核请求 #${request.id.substring(0, 8)}`}
                        </h3>
                        {getStatusBadge(request.status)}
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                          {getChangeTypeLabel(request.type)}
                        </span>
                      </div>

                      {request.reason && (
                        <p className="text-sm text-gray-600 mb-3">
                          {request.reason}
                        </p>
                      )}

                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>
                          请求人: {request.requestedByName || request.requestedBy}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(request.requestedAt).toLocaleString('zh-CN')}
                        </span>
                      </div>
                    </div>

                    {request.status === ApprovalStatus.PENDING && (
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelectRequest(request)
                          }}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          处理
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 审批进度 */}
                  {request.requiredApprovers.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center space-x-2 text-sm">
                        <span className="text-gray-600">审批进度:</span>
                        <span className="font-medium text-gray-900">
                          {request.currentApprovers.length} / {request.requiredApprovers.length}
                        </span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2 ml-4">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{
                              width: `${(request.currentApprovers.length / request.requiredApprovers.length) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 审核对话框 */}
      {showApprovalModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-y-auto">
            <ChangeApproval
              request={selectedRequest}
              onApprove={(comments) => handleApprove(selectedRequest.id, comments)}
              onReject={(comments) => handleReject(selectedRequest.id, comments)}
              onRequestChanges={(comments) => handleRequestChanges(selectedRequest.id, comments)}
              onClose={() => {
                setShowApprovalModal(false)
                setSelectedRequest(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default ApprovalQueue
