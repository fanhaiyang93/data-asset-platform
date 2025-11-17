/**
 * 资产编辑表单组件
 * Story 5.3: 资产编辑与维护
 *
 * 支持资产信息的完整编辑功能:
 * - 所有字段的在线编辑
 * - 表单字段的增量更新
 * - 实时验证和错误提示
 * - 标签和关键词管理
 * - 富文本描述编辑
 * - 乐观锁和冲突检测
 */

'use client'

import React, { useState, useEffect } from 'react'
import { AssetFormData, AssetType, DataSourceType } from '@/types/assetOnboarding'
import { AssetEditState, EditConflict } from '@/types/assetMaintenance'
import { assetEditingService } from '@/lib/services/assetEditing'
import TagEditor from './TagEditor'
import RichTextEditor from '../onboarding/RichTextEditor'
import { trpc } from '@/lib/trpc-client'

interface AssetEditFormProps {
  assetId: string
  onSave: (data: AssetFormData) => Promise<void>
  onCancel?: () => void
  readOnly?: boolean
}

export function AssetEditForm({
  assetId,
  onSave,
  onCancel,
  readOnly = false
}: AssetEditFormProps) {
  const [editState, setEditState] = useState<AssetEditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<EditConflict[]>([])
  const [showConflictDialog, setShowConflictDialog] = useState(false)

  // 使用 tRPC 查询资产详情
  const { data: assetData, isLoading: loading, error: loadError } = trpc.assets.getAsset.useQuery({ id: assetId })

  // 使用 tRPC mutation 更新资产
  const updateAsset = trpc.assets.updateAsset.useMutation()

  // 当资产数据加载完成时,初始化编辑状态
  useEffect(() => {
    if (assetData) {
      const formData: AssetFormData = {
        name: assetData.name,
        displayName: assetData.name,
        description: assetData.description || '',
        code: assetData.code,
        assetType: (assetData.type as any) || 'table',
        categoryId: assetData.categoryId,
        ownerId: assetData.createdBy,
        status: assetData.status,
        metadata: {
          dataSource: (assetData.databaseName as any) || 'mysql',
          updateFrequency: 'daily',
          sensitivityLevel: 'internal',
          tags: assetData.tags ? assetData.tags.split(',') : [],
          dataVolume: 0
        },
        schema: {
          databaseName: assetData.databaseName || '',
          tableName: assetData.tableName || ''
        }
      }

      setEditState({
        assetId,
        originalData: formData,
        currentData: {},
        changedFields: [],
        isDirty: false,
        isValid: true,
        isSaving: false,
        validationErrors: {},
        optimisticLockVersion: 1
      })
    }
  }, [assetData, assetId])

  // 处理加载错误
  useEffect(() => {
    if (loadError) {
      setError(loadError.message || '加载资产失败')
    }
  }, [loadError])

  const handleFieldChange = (field: string, value: any) => {
    if (!editState) return

    const updates = { [field]: value }
    const newState = assetEditingService.updateFields(editState, updates)

    // 实时验证
    const validation = assetEditingService.validateEditData(newState)
    newState.validationErrors = validation.errors
    newState.isValid = validation.isValid

    setEditState(newState)
  }

  const handleMetadataChange = (field: string, value: any) => {
    if (!editState) return

    const metadata = { ...editState.originalData.metadata, ...editState.currentData.metadata }
    metadata[field as keyof typeof metadata] = value

    handleFieldChange('metadata', metadata)
  }

  const handleTagsChange = (tags: string[]) => {
    handleMetadataChange('tags', tags)
  }

  const handleSave = async () => {
    if (!editState) return

    try {
      setSaving(true)
      setError(null)

      // 最终验证
      const validation = assetEditingService.validateEditData(editState)
      if (!validation.isValid) {
        setError('请修正表单中的错误后再提交')
        setEditState({
          ...editState,
          validationErrors: validation.errors,
          isValid: false
        })
        return
      }

      // 准备更新数据
      const updates = { ...editState.currentData }
      const finalData = { ...editState.originalData, ...updates }

      // 使用 tRPC 保存资产
      await updateAsset.mutateAsync({
        id: assetId,
        data: {
          name: finalData.name,
          description: finalData.description,
          categoryId: finalData.categoryId,
          status: finalData.status,
          tags: finalData.metadata?.tags?.join(','),
          databaseName: finalData.schema?.databaseName,
          tableName: finalData.schema?.tableName
        }
      })

      // 调用父组件回调
      await onSave(finalData)

      // 重置编辑状态
      const resetState = assetEditingService.resetEditState(editState)
      setEditState(resetState)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存资产失败')
      console.error('Error saving asset:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (editState?.isDirty) {
      if (confirm('您有未保存的更改,确定要取消吗?')) {
        if (onCancel) {
          onCancel()
        } else {
          const resetState = assetEditingService.discardChanges(editState)
          setEditState(resetState)
        }
      }
    } else {
      if (onCancel) {
        onCancel()
      }
    }
  }

  const resolveConflict = (conflict: EditConflict, resolution: 'keep_yours' | 'use_current') => {
    if (!editState) return

    const resolvedValue = assetEditingService.resolveConflict(conflict, resolution)
    handleFieldChange(conflict.field, resolvedValue)

    // 移除已解决的冲突
    const remainingConflicts = conflicts.filter(c => c.field !== conflict.field)
    setConflicts(remainingConflicts)

    if (remainingConflicts.length === 0) {
      setShowConflictDialog(false)
      // 重新尝试保存
      handleSave()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载资产数据中...</p>
        </div>
      </div>
    )
  }

  if (error && !editState) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-medium mb-2">加载失败</h3>
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  if (!editState) return null

  const asset = { ...editState.originalData, ...editState.currentData }

  return (
    <div className="asset-edit-form">
      {/* 表单头部 */}
      <div className="bg-white border-b px-6 py-4">
        <h2 className="text-2xl font-bold text-gray-900">编辑资产</h2>
        {editState.isDirty && (
          <p className="text-sm text-orange-600 mt-1">
            * 您有未保存的更改
          </p>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* 表单内容 */}
      <div className="p-6 space-y-6">
        {/* 基本信息 */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                资产名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={asset.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              />
              {editState.validationErrors.name && (
                <p className="mt-1 text-sm text-red-600">
                  {editState.validationErrors.name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                显示名称
              </label>
              <input
                type="text"
                value={asset.displayName || ''}
                onChange={(e) => handleFieldChange('displayName', e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                资产类型 <span className="text-red-500">*</span>
              </label>
              <select
                value={asset.assetType || ''}
                onChange={(e) => handleFieldChange('assetType', e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              >
                <option value="">请选择</option>
                {Object.values(AssetType).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                负责人 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={asset.ownerId || ''}
                onChange={(e) => handleFieldChange('ownerId', e.target.value)}
                disabled={readOnly}
                placeholder="输入负责人ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              />
              {editState.validationErrors.ownerId && (
                <p className="mt-1 text-sm text-red-600">
                  {editState.validationErrors.ownerId}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              描述 <span className="text-red-500">*</span>
            </label>
            <RichTextEditor
              value={asset.description || ''}
              onChange={(value) => handleFieldChange('description', value)}
              placeholder="请输入资产描述..."
              readOnly={readOnly}
            />
            {editState.validationErrors.description && (
              <p className="mt-1 text-sm text-red-600">
                {editState.validationErrors.description}
              </p>
            )}
          </div>
        </section>

        {/* 元数据信息 */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">元数据信息</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                数据源类型 <span className="text-red-500">*</span>
              </label>
              <select
                value={asset.metadata?.dataSource || ''}
                onChange={(e) => handleMetadataChange('dataSource', e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              >
                <option value="">请选择</option>
                {Object.values(DataSourceType).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                更新频率 <span className="text-red-500">*</span>
              </label>
              <select
                value={asset.metadata?.updateFrequency || ''}
                onChange={(e) => handleMetadataChange('updateFrequency', e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              >
                <option value="">请选择</option>
                <option value="realtime">实时</option>
                <option value="daily">每日</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
                <option value="manual">手动</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                敏感级别 <span className="text-red-500">*</span>
              </label>
              <select
                value={asset.metadata?.sensitivityLevel || ''}
                onChange={(e) => handleMetadataChange('sensitivityLevel', e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              >
                <option value="">请选择</option>
                <option value="public">公开</option>
                <option value="internal">内部</option>
                <option value="confidential">机密</option>
                <option value="restricted">受限</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                数据量 (行)
              </label>
              <input
                type="number"
                value={asset.metadata?.dataVolume || ''}
                onChange={(e) => handleMetadataChange('dataVolume', parseInt(e.target.value))}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              标签 <span className="text-red-500">*</span>
            </label>
            <TagEditor
              assetId={assetId}
              currentTags={asset.metadata?.tags || []}
              onChange={handleTagsChange}
              placeholder="添加标签..."
              maxTags={20}
            />
            {editState.validationErrors['metadata.tags'] && (
              <p className="mt-1 text-sm text-red-600">
                {editState.validationErrors['metadata.tags']}
              </p>
            )}
          </div>
        </section>
      </div>

      {/* 表单底部操作按钮 */}
      <div className="bg-gray-50 border-t px-6 py-4 flex justify-end space-x-3">
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !editState.isDirty || readOnly}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? '保存中...' : '保存更改'}
        </button>
      </div>

      {/* 冲突解决对话框 */}
      {showConflictDialog && conflicts.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                检测到编辑冲突
              </h3>
              <p className="text-gray-600 mb-4">
                其他用户在您编辑期间也修改了以下字段,请选择要保留的版本:
              </p>

              <div className="space-y-4">
                {conflicts.map((conflict, index) => (
                  <div key={index} className="border border-gray-300 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">
                      字段: {conflict.field}
                    </h4>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">您的版本:</p>
                        <div className="bg-blue-50 p-2 rounded">
                          {JSON.stringify(conflict.yourValue)}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">当前版本:</p>
                        <div className="bg-green-50 p-2 rounded">
                          {JSON.stringify(conflict.currentValue)}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      最后修改: {conflict.lastModifiedBy} 于 {new Date(conflict.lastModifiedAt).toLocaleString()}
                    </p>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => resolveConflict(conflict, 'keep_yours')}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        保留我的版本
                      </button>
                      <button
                        onClick={() => resolveConflict(conflict, 'use_current')}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        使用当前版本
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AssetEditForm
