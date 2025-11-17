/**
 * 资产编辑服务
 * Story 5.3: 资产编辑与维护
 *
 * 提供资产编辑的核心业务逻辑,包括:
 * - 资产信息更新
 * - 版本控制
 * - 乐观锁机制
 * - 增量更新
 */

import { AssetFormData } from '@/types/assetOnboarding'
import {
  AssetEditState,
  AssetVersion,
  ChangeType,
  EditConflict,
  OptimisticLockConfig,
  AssetValidationResult,
  VersionRestoreConfig,
  VersionRestoreResult
} from '@/types/assetMaintenance'

/**
 * 资产编辑服务类
 */
export class AssetEditingService {
  private optimisticLockConfig: OptimisticLockConfig = {
    enabled: true,
    versionField: 'version',
    conflictResolution: 'prompt'
  }

  /**
   * 加载资产用于编辑
   */
  async loadAssetForEdit(assetId: string): Promise<AssetEditState> {
    try {
      // TODO: 实际实现需要调用API获取资产数据
      const response = await fetch(`/api/assets/${assetId}`)

      if (!response.ok) {
        throw new Error(`Failed to load asset: ${response.statusText}`)
      }

      const asset: AssetFormData = await response.json()

      return {
        assetId,
        originalData: asset,
        currentData: {},
        changedFields: [],
        isDirty: false,
        isValid: true,
        isSaving: false,
        validationErrors: {},
        optimisticLockVersion: (asset as any).version || 1
      }
    } catch (error) {
      console.error('Error loading asset for edit:', error)
      throw error
    }
  }

  /**
   * 更新资产字段 (增量更新)
   */
  updateFields(
    state: AssetEditState,
    updates: Partial<AssetFormData>
  ): AssetEditState {
    const newCurrentData = { ...state.currentData, ...updates }
    const changedFields = this.getChangedFields(state.originalData, newCurrentData)

    return {
      ...state,
      currentData: newCurrentData,
      changedFields,
      isDirty: changedFields.length > 0
    }
  }

  /**
   * 获取已变更的字段
   */
  private getChangedFields(
    original: AssetFormData,
    current: Partial<AssetFormData>
  ): string[] {
    const changed: string[] = []

    for (const key in current) {
      if (current.hasOwnProperty(key)) {
        const originalValue = original[key as keyof AssetFormData]
        const currentValue = current[key as keyof AssetFormData]

        if (JSON.stringify(originalValue) !== JSON.stringify(currentValue)) {
          changed.push(key)
        }
      }
    }

    return changed
  }

  /**
   * 验证编辑数据
   */
  validateEditData(
    state: AssetEditState
  ): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {}
    const data = { ...state.originalData, ...state.currentData }

    // 基本字段验证
    if (!data.name || data.name.trim() === '') {
      errors.name = '资产名称不能为空'
    }

    if (!data.description || data.description.trim() === '') {
      errors.description = '资产描述不能为空'
    }

    if (!data.categoryId) {
      errors.categoryId = '请选择资产分类'
    }

    if (!data.ownerId) {
      errors.ownerId = '请指定资产负责人'
    }

    // 元数据验证
    if (data.metadata) {
      if (!data.metadata.dataSource) {
        errors['metadata.dataSource'] = '请选择数据源类型'
      }

      if (!data.metadata.updateFrequency) {
        errors['metadata.updateFrequency'] = '请选择更新频率'
      }

      if (!data.metadata.sensitivityLevel) {
        errors['metadata.sensitivityLevel'] = '请选择敏感级别'
      }

      if (!data.metadata.tags || data.metadata.tags.length === 0) {
        errors['metadata.tags'] = '请至少添加一个标签'
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    }
  }

  /**
   * 保存资产编辑 (带乐观锁)
   */
  async saveAsset(state: AssetEditState): Promise<{
    success: boolean
    versionId?: string
    conflicts?: EditConflict[]
    error?: string
  }> {
    try {
      // 验证数据
      const validation = this.validateEditData(state)
      if (!validation.isValid) {
        return {
          success: false,
          error: '数据验证失败: ' + Object.values(validation.errors).join(', ')
        }
      }

      // 准备更新数据 (仅包含变更的字段)
      const updates = state.currentData

      // 调用API更新资产
      const response = await fetch(`/api/assets/${state.assetId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          updates,
          version: state.optimisticLockVersion,
          changedFields: state.changedFields
        })
      })

      if (!response.ok) {
        if (response.status === 409) {
          // 版本冲突
          const conflictData = await response.json()
          return {
            success: false,
            conflicts: conflictData.conflicts
          }
        }
        throw new Error(`Failed to save asset: ${response.statusText}`)
      }

      const result = await response.json()

      return {
        success: true,
        versionId: result.versionId
      }
    } catch (error) {
      console.error('Error saving asset:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 创建资产版本记录
   */
  async createVersion(
    assetId: string,
    changeType: ChangeType,
    changedFields: string[],
    previousData: Partial<AssetFormData>,
    newData: Partial<AssetFormData>,
    reason?: string
  ): Promise<AssetVersion> {
    try {
      const response = await fetch('/api/assets/versions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assetId,
          changeType,
          changedFields,
          previousData,
          newData,
          reason
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to create version: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error creating version:', error)
      throw error
    }
  }

  /**
   * 恢复到历史版本
   */
  async restoreVersion(
    config: VersionRestoreConfig
  ): Promise<VersionRestoreResult> {
    try {
      const response = await fetch('/api/assets/versions/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      })

      if (!response.ok) {
        throw new Error(`Failed to restore version: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error restoring version:', error)
      throw {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        conflicts: []
      }
    }
  }

  /**
   * 检查编辑冲突
   */
  async checkConflicts(
    assetId: string,
    version: number,
    changedFields: string[]
  ): Promise<EditConflict[]> {
    try {
      const response = await fetch(
        `/api/assets/${assetId}/conflicts?version=${version}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ changedFields })
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to check conflicts: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error checking conflicts:', error)
      return []
    }
  }

  /**
   * 解决编辑冲突
   */
  resolveConflict(
    conflict: EditConflict,
    resolution: 'keep_yours' | 'use_current' | 'merge'
  ): any {
    switch (resolution) {
      case 'keep_yours':
        return conflict.yourValue
      case 'use_current':
        return conflict.currentValue
      case 'merge':
        // 简单的合并策略,实际场景可能需要更复杂的逻辑
        if (Array.isArray(conflict.yourValue) && Array.isArray(conflict.currentValue)) {
          return [...new Set([...conflict.yourValue, ...conflict.currentValue])]
        }
        return conflict.yourValue
      default:
        return conflict.yourValue
    }
  }

  /**
   * 重置编辑状态
   */
  resetEditState(state: AssetEditState): AssetEditState {
    return {
      ...state,
      currentData: {},
      changedFields: [],
      isDirty: false,
      validationErrors: {}
    }
  }

  /**
   * 丢弃未保存的更改
   */
  discardChanges(state: AssetEditState): AssetEditState {
    return this.resetEditState(state)
  }
}

// 导出单例实例
export const assetEditingService = new AssetEditingService()

/**
 * React Hook: 使用资产编辑服务
 */
export function useAssetEditing(assetId: string) {
  // TODO: 实际实现需要使用 React hooks
  // 这里提供基本的接口定义
  return {
    state: null as AssetEditState | null,
    loading: false,
    error: null as Error | null,
    updateFields: (updates: Partial<AssetFormData>) => {},
    save: async () => {},
    discard: () => {},
    validate: () => ({ isValid: true, errors: {} })
  }
}
