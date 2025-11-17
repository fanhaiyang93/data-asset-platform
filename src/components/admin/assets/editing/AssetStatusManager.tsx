/**
 * 资产状态管理组件
 * Story 5.3: 资产编辑与维护
 *
 * 支持资产状态的快速切换功能:
 * - 状态下拉选择器
 * - 状态变更确认对话框
 * - 状态变更原因填写
 * - 即时生效机制
 */

'use client'

import React, { useState } from 'react'
import { AssetStatus, ChangeType } from '@/types/assetMaintenance'

interface StatusChangeRequest {
  fromStatus: AssetStatus
  toStatus: AssetStatus
  reason: string
  requireApproval: boolean
}

interface AssetStatusManagerProps {
  assetId: string
  currentStatus: AssetStatus
  onChange: (status: AssetStatus, reason: string) => Promise<void>
  readOnly?: boolean
  requireConfirmation?: boolean
}

export function AssetStatusManager({
  assetId,
  currentStatus,
  onChange,
  readOnly = false,
  requireConfirmation = true
}: AssetStatusManagerProps) {
  const [selectedStatus, setSelectedStatus] = useState<AssetStatus>(currentStatus)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [changeReason, setChangeReason] = useState('')
  const [isChanging, setIsChanging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 状态标签和颜色映射
  const statusConfig = {
    [AssetStatus.ACTIVE]: {
      label: '可用',
      color: 'bg-green-100 text-green-800 border-green-200',
      icon: '✓',
      description: '资产正常可用'
    },
    [AssetStatus.MAINTENANCE]: {
      label: '维护中',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: '⚠',
      description: '资产正在维护,可能暂时不可用'
    },
    [AssetStatus.INACTIVE]: {
      label: '已下线',
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      icon: '✕',
      description: '资产已停用'
    },
    [AssetStatus.DEPRECATED]: {
      label: '已弃用',
      color: 'bg-red-100 text-red-800 border-red-200',
      icon: '⊗',
      description: '资产已废弃,不再使用'
    }
  }

  // 检查状态变更是否需要审核
  const requiresApproval = (from: AssetStatus, to: AssetStatus): boolean => {
    // 从可用状态变更到下线或弃用需要审核
    if (from === AssetStatus.ACTIVE) {
      return to === AssetStatus.INACTIVE || to === AssetStatus.DEPRECATED
    }
    // 从弃用状态恢复到可用也需要审核
    if (from === AssetStatus.DEPRECATED && to === AssetStatus.ACTIVE) {
      return true
    }
    return false
  }

  const handleStatusChange = (newStatus: AssetStatus) => {
    if (newStatus === currentStatus) return

    setSelectedStatus(newStatus)

    if (requireConfirmation) {
      setShowConfirmDialog(true)
    } else {
      confirmStatusChange(newStatus)
    }
  }

  const confirmStatusChange = async (status: AssetStatus = selectedStatus) => {
    if (!changeReason.trim() && requiresApproval(currentStatus, status)) {
      setError('状态变更需要填写原因')
      return
    }

    setIsChanging(true)
    setError(null)

    try {
      await onChange(status, changeReason)

      // 重置状态
      setShowConfirmDialog(false)
      setChangeReason('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '状态变更失败')
      console.error('Error changing status:', err)
    } finally {
      setIsChanging(false)
    }
  }

  const cancelStatusChange = () => {
    setSelectedStatus(currentStatus)
    setShowConfirmDialog(false)
    setChangeReason('')
    setError(null)
  }

  const currentConfig = statusConfig[currentStatus]
  const selectedConfig = statusConfig[selectedStatus]

  return (
    <div className="asset-status-manager">
      <div className="flex items-center space-x-4">
        {/* 当前状态显示 */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            资产状态
          </label>
          <select
            value={currentStatus}
            onChange={(e) => handleStatusChange(e.target.value as AssetStatus)}
            disabled={readOnly || isChanging}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            {Object.entries(statusConfig).map(([status, config]) => (
              <option key={status} value={status}>
                {config.icon} {config.label}
              </option>
            ))}
          </select>
        </div>

        {/* 当前状态徽章 */}
        <div className={`px-4 py-2 rounded-lg border ${currentConfig.color}`}>
          <div className="flex items-center space-x-2">
            <span className="text-lg">{currentConfig.icon}</span>
            <div>
              <div className="font-medium">{currentConfig.label}</div>
              <div className="text-xs">{currentConfig.description}</div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 状态变更确认对话框 */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              确认状态变更
            </h3>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`px-3 py-1 rounded border ${currentConfig.color}`}>
                  {currentConfig.icon} {currentConfig.label}
                </div>
                <span className="text-gray-400">→</span>
                <div className={`px-3 py-1 rounded border ${selectedConfig.color}`}>
                  {selectedConfig.icon} {selectedConfig.label}
                </div>
              </div>
              <p className="text-sm text-gray-600">
                {selectedConfig.description}
              </p>
            </div>

            {requiresApproval(currentStatus, selectedStatus) && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">
                  ⚠ 此状态变更需要审核批准
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                变更原因 {requiresApproval(currentStatus, selectedStatus) && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="请说明状态变更的原因..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {error && (
                <p className="mt-1 text-sm text-red-600">{error}</p>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={cancelStatusChange}
                disabled={isChanging}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => confirmStatusChange()}
                disabled={isChanging}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isChanging ? '变更中...' : '确认变更'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AssetStatusManager
