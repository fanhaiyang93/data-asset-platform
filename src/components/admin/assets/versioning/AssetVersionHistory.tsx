/**
 * 资产版本历史组件
 * Story 5.3: 资产编辑与维护
 *
 * 显示资产的完整变更历史:
 * - 版本时间线展示
 * - 变更类型和字段展示
 * - 版本对比功能
 * - 历史版本恢复
 */

'use client'

import React, { useState, useEffect } from 'react'
import { AssetVersion, ChangeType } from '@/types/assetMaintenance'
import { versionControlService } from '@/lib/services/versionControl'
import VersionComparison from './VersionComparison'

interface AssetVersionHistoryProps {
  assetId: string
}

export function AssetVersionHistory({ assetId }: AssetVersionHistoryProps) {
  const [versions, setVersions] = useState<AssetVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVersions, setSelectedVersions] = useState<string[]>([])
  const [showComparison, setShowComparison] = useState(false)

  useEffect(() => {
    loadVersionHistory()
  }, [assetId])

  const loadVersionHistory = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await versionControlService.getVersionHistory(assetId)
      setVersions(result.versions)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载版本历史失败')
      console.error('Error loading version history:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleVersionSelect = (versionId: string) => {
    setSelectedVersions(prev => {
      if (prev.includes(versionId)) {
        return prev.filter(id => id !== versionId)
      } else if (prev.length < 2) {
        return [...prev, versionId]
      } else {
        // 最多选择2个版本进行对比
        return [prev[1], versionId]
      }
    })
  }

  const handleCompare = () => {
    if (selectedVersions.length === 2) {
      setShowComparison(true)
    }
  }

  const handleRestore = async (versionId: string) => {
    if (!confirm('确定要恢复到此版本吗?当前未保存的更改将丢失。')) {
      return
    }

    try {
      const result = await versionControlService.restoreVersion({
        versionId,
        assetId,
        requireApproval: false
      })

      if (result.success) {
        alert('版本恢复成功!')
        loadVersionHistory()
      } else {
        alert('版本恢复失败: ' + result.message)
      }
    } catch (err) {
      console.error('Error restoring version:', err)
      alert('版本恢复失败')
    }
  }

  const getChangeTypeIcon = (changeType: ChangeType) => {
    switch (changeType) {
      case ChangeType.CREATE:
        return '+'
      case ChangeType.UPDATE:
        return '✎'
      case ChangeType.STATUS_CHANGE:
        return '⚡'
      case ChangeType.DELETE:
        return '×'
      case ChangeType.BULK_UPDATE:
        return '⚙'
      default:
        return '•'
    }
  }

  const getChangeTypeColor = (changeType: ChangeType) => {
    switch (changeType) {
      case ChangeType.CREATE:
        return 'text-green-600 bg-green-100'
      case ChangeType.UPDATE:
        return 'text-blue-600 bg-blue-100'
      case ChangeType.STATUS_CHANGE:
        return 'text-yellow-600 bg-yellow-100'
      case ChangeType.DELETE:
        return 'text-red-600 bg-red-100'
      case ChangeType.BULK_UPDATE:
        return 'text-purple-600 bg-purple-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        暂无版本历史记录
      </div>
    )
  }

  return (
    <div className="asset-version-history">
      {/* 操作栏 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          版本历史 ({versions.length})
        </h3>
        {selectedVersions.length === 2 && (
          <button
            onClick={handleCompare}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            对比版本
          </button>
        )}
      </div>

      {/* 版本时间线 */}
      <div className="relative">
        {/* 时间线轴 */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        <div className="space-y-4">
          {versions.map((version, index) => (
            <div key={version.id} className="relative pl-16">
              {/* 时间线节点 */}
              <div
                className={`absolute left-6 w-5 h-5 rounded-full border-2 border-white ${getChangeTypeColor(version.changeType)}`}
                style={{ top: '8px' }}
              >
                <span className="flex items-center justify-center w-full h-full text-xs font-bold">
                  {getChangeTypeIcon(version.changeType)}
                </span>
              </div>

              {/* 版本卡片 */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedVersions.includes(version.id)}
                      onChange={() => handleVersionSelect(version.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div>
                      <h4 className="font-medium text-gray-900">
                        版本 {version.versionNumber}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {versionControlService.formatChangeSummary(version)}
                      </p>
                    </div>
                  </div>

                  {version.approved && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                      已审核
                    </span>
                  )}
                </div>

                {/* 变更字段 */}
                {version.changedFields.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-500 mb-1">变更字段:</p>
                    <div className="flex flex-wrap gap-1">
                      {version.changedFields.map((field, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 变更原因 */}
                {version.changeReason && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-500">原因:</p>
                    <p className="text-sm text-gray-700">{version.changeReason}</p>
                  </div>
                )}

                {/* 元信息 */}
                <div className="flex items-center justify-between text-xs text-gray-500 mt-3 pt-3 border-t">
                  <div>
                    <span className="font-medium">{version.changedByName || version.changedBy}</span>
                    <span className="mx-1">•</span>
                    <span>{new Date(version.changedAt).toLocaleString('zh-CN')}</span>
                  </div>

                  <button
                    onClick={() => handleRestore(version.id)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    恢复此版本
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 版本对比对话框 */}
      {showComparison && selectedVersions.length === 2 && (
        <VersionComparison
          versionAId={selectedVersions[0]}
          versionBId={selectedVersions[1]}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  )
}

export default AssetVersionHistory
