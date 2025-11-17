/**
 * 版本对比组件
 * Story 5.3: 资产编辑与维护
 *
 * 显示两个版本之间的差异:
 * - 并排显示两个版本
 * - 高亮显示差异字段
 * - 支持字段级别的详细对比
 * - 影响分析展示
 */

'use client'

import React, { useState, useEffect } from 'react'
import { AssetVersion, VersionComparison as VersionComparisonType, FieldDifference } from '@/types/assetMaintenance'
import { versionControlService } from '@/lib/services/versionControl'

interface VersionComparisonProps {
  versionAId: string
  versionBId: string
  onClose: () => void
}

export function VersionComparison({
  versionAId,
  versionBId,
  onClose
}: VersionComparisonProps) {
  const [comparison, setComparison] = useState<VersionComparisonType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedField, setSelectedField] = useState<string | null>(null)

  useEffect(() => {
    loadComparison()
  }, [versionAId, versionBId])

  const loadComparison = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await versionControlService.compareVersions(versionAId, versionBId)

      if (!result) {
        throw new Error('无法加载版本对比数据')
      }

      setComparison(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载版本对比失败')
      console.error('Error loading version comparison:', err)
    } finally {
      setLoading(false)
    }
  }

  const getChangeTypeColor = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return 'bg-green-100 border-green-300 text-green-800'
      case 'removed':
        return 'bg-red-100 border-red-300 text-red-800'
      case 'modified':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800'
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800'
    }
  }

  const getChangeTypeLabel = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return '新增'
      case 'removed':
        return '删除'
      case 'modified':
        return '修改'
      default:
        return '未知'
    }
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

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-center text-gray-600 mt-4">加载版本对比中...</p>
        </div>
      </div>
    )
  }

  if (error || !comparison) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md">
          <h3 className="text-xl font-bold text-red-800 mb-4">加载失败</h3>
          <p className="text-red-600 mb-4">{error || '无法加载版本对比'}</p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            关闭
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-screen overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">版本对比</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="关闭"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 版本信息 */}
        <div className="border-b px-6 py-4 bg-gray-50">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-gray-900 mb-1">版本 {comparison.versionA.versionNumber}</h3>
              <p className="text-sm text-gray-600">
                {comparison.versionA.changedByName || comparison.versionA.changedBy} • {new Date(comparison.versionA.changedAt).toLocaleString('zh-CN')}
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-1">版本 {comparison.versionB.versionNumber}</h3>
              <p className="text-sm text-gray-600">
                {comparison.versionB.changedByName || comparison.versionB.changedBy} • {new Date(comparison.versionB.changedAt).toLocaleString('zh-CN')}
              </p>
            </div>
          </div>
        </div>

        {/* 差异统计 */}
        <div className="px-6 py-4 bg-blue-50 border-b">
          <div className="flex items-center space-x-6 text-sm">
            <div>
              <span className="font-medium text-gray-700">变更字段: </span>
              <span className="text-gray-900">{comparison.differences.length}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 bg-green-200 text-green-800 rounded text-xs">
                新增: {comparison.differences.filter(d => d.changeType === 'added').length}
              </span>
              <span className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded text-xs">
                修改: {comparison.differences.filter(d => d.changeType === 'modified').length}
              </span>
              <span className="px-2 py-1 bg-red-200 text-red-800 rounded text-xs">
                删除: {comparison.differences.filter(d => d.changeType === 'removed').length}
              </span>
            </div>
          </div>
        </div>

        {/* 差异列表 */}
        <div className="flex-1 overflow-y-auto p-6">
          {comparison.differences.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              两个版本之间没有差异
            </div>
          ) : (
            <div className="space-y-4">
              {comparison.differences.map((diff, index) => (
                <div
                  key={index}
                  className={`border rounded-lg overflow-hidden ${selectedField === diff.field ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => setSelectedField(selectedField === diff.field ? null : diff.field)}
                >
                  {/* 字段头部 */}
                  <div className={`px-4 py-3 border-b ${getChangeTypeColor(diff.changeType)} flex items-center justify-between cursor-pointer`}>
                    <div className="flex items-center space-x-3">
                      <span className="font-medium">{diff.fieldLabel}</span>
                      <span className="text-xs px-2 py-0.5 bg-white bg-opacity-50 rounded">
                        {diff.field}
                      </span>
                    </div>
                    <span className="text-sm font-medium">
                      {getChangeTypeLabel(diff.changeType)}
                    </span>
                  </div>

                  {/* 值对比 */}
                  <div className="grid grid-cols-2 divide-x bg-white">
                    {/* 旧值 */}
                    <div className="p-4">
                      <p className="text-xs text-gray-500 mb-2">版本 {comparison.versionA.versionNumber}</p>
                      <div className={`p-3 rounded text-sm font-mono ${
                        diff.changeType === 'removed' ? 'bg-red-50 text-red-800' : 'bg-gray-50 text-gray-800'
                      }`}>
                        <pre className="whitespace-pre-wrap break-words">
                          {formatValue(diff.oldValue)}
                        </pre>
                      </div>
                    </div>

                    {/* 新值 */}
                    <div className="p-4">
                      <p className="text-xs text-gray-500 mb-2">版本 {comparison.versionB.versionNumber}</p>
                      <div className={`p-3 rounded text-sm font-mono ${
                        diff.changeType === 'added' ? 'bg-green-50 text-green-800' :
                        diff.changeType === 'modified' ? 'bg-yellow-50 text-yellow-800' :
                        'bg-gray-50 text-gray-800'
                      }`}>
                        <pre className="whitespace-pre-wrap break-words">
                          {formatValue(diff.newValue)}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 影响分析 */}
        {comparison.impactAnalysis && (
          <div className="border-t px-6 py-4 bg-gray-50">
            <h3 className="font-medium text-gray-900 mb-3">影响分析</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">风险等级</p>
                <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                  comparison.impactAnalysis.riskLevel === 'high' ? 'bg-red-100 text-red-800' :
                  comparison.impactAnalysis.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {comparison.impactAnalysis.riskLevel === 'high' ? '高风险' :
                   comparison.impactAnalysis.riskLevel === 'medium' ? '中等风险' : '低风险'}
                </span>
              </div>

              {comparison.impactAnalysis.affectedSystems.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">受影响的系统</p>
                  <div className="flex flex-wrap gap-2">
                    {comparison.impactAnalysis.affectedSystems.map((system, idx) => (
                      <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {system}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {comparison.impactAnalysis.recommendations.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">建议</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  {comparison.impactAnalysis.recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 底部操作 */}
        <div className="border-t px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

export default VersionComparison
