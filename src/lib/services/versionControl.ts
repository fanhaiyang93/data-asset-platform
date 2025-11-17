/**
 * 版本控制服务
 * Story 5.3: 资产编辑与维护
 *
 * 提供资产版本控制的核心功能:
 * - 自动记录资产变更
 * - 版本对比和差异展示
 * - 历史版本恢复
 * - 变更日志管理
 */

import { AssetFormData } from '@/types/assetOnboarding'
import {
  AssetVersion,
  ChangeType,
  VersionComparison,
  FieldDifference,
  ChangeLogEntry,
  ChangeLogFilter,
  VersionRestoreConfig,
  VersionRestoreResult
} from '@/types/assetMaintenance'

export class VersionControlService {
  /**
   * 获取资产的版本历史
   */
  async getVersionHistory(
    assetId: string,
    options?: {
      limit?: number
      offset?: number
      changeType?: ChangeType
    }
  ): Promise<{ versions: AssetVersion[]; total: number }> {
    try {
      const params = new URLSearchParams()
      if (options?.limit) params.append('limit', options.limit.toString())
      if (options?.offset) params.append('offset', options.offset.toString())
      if (options?.changeType) params.append('changeType', options.changeType)

      const response = await fetch(
        `/api/assets/${assetId}/versions?${params.toString()}`
      )

      if (!response.ok) {
        throw new Error(`Failed to get version history: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting version history:', error)
      return { versions: [], total: 0 }
    }
  }

  /**
   * 获取特定版本详情
   */
  async getVersion(versionId: string): Promise<AssetVersion | null> {
    try {
      const response = await fetch(`/api/assets/versions/${versionId}`)

      if (!response.ok) {
        throw new Error(`Failed to get version: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting version:', error)
      return null
    }
  }

  /**
   * 对比两个版本
   */
  async compareVersions(
    versionAId: string,
    versionBId: string
  ): Promise<VersionComparison | null> {
    try {
      const response = await fetch(
        `/api/assets/versions/compare?versionA=${versionAId}&versionB=${versionBId}`
      )

      if (!response.ok) {
        throw new Error(`Failed to compare versions: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error comparing versions:', error)
      return null
    }
  }

  /**
   * 计算字段差异 (客户端版本)
   */
  calculateFieldDifferences(
    versionA: AssetVersion,
    versionB: AssetVersion
  ): FieldDifference[] {
    const differences: FieldDifference[] = []
    const allFields = new Set([
      ...Object.keys(versionA.newData),
      ...Object.keys(versionB.newData)
    ])

    for (const field of allFields) {
      const valueA = (versionA.newData as any)[field]
      const valueB = (versionB.newData as any)[field]

      if (JSON.stringify(valueA) !== JSON.stringify(valueB)) {
        let changeType: 'added' | 'removed' | 'modified' = 'modified'

        if (valueA === undefined) changeType = 'added'
        else if (valueB === undefined) changeType = 'removed'

        differences.push({
          field,
          fieldLabel: this.getFieldLabel(field),
          oldValue: valueA,
          newValue: valueB,
          changeType
        })
      }
    }

    return differences
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
      return {
        success: false,
        restoredVersion: 0,
        conflicts: [],
        message: error instanceof Error ? error.message : '版本恢复失败'
      }
    }
  }

  /**
   * 获取变更日志
   */
  async getChangeLog(
    filter: ChangeLogFilter
  ): Promise<{ entries: ChangeLogEntry[]; total: number }> {
    try {
      const response = await fetch('/api/assets/changelog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(filter)
      })

      if (!response.ok) {
        throw new Error(`Failed to get change log: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting change log:', error)
      return { entries: [], total: 0 }
    }
  }

  /**
   * 搜索变更日志
   */
  async searchChangeLog(
    query: string,
    options?: {
      assetIds?: string[]
      dateRange?: { start: Date; end: Date }
    }
  ): Promise<ChangeLogEntry[]> {
    try {
      const filter: ChangeLogFilter = {
        searchQuery: query,
        assetIds: options?.assetIds,
        dateRange: options?.dateRange
      }

      const result = await this.getChangeLog(filter)
      return result.entries
    } catch (error) {
      console.error('Error searching change log:', error)
      return []
    }
  }

  /**
   * 创建版本快照
   */
  async createSnapshot(
    assetId: string,
    reason?: string
  ): Promise<{ success: boolean; versionId?: string }> {
    try {
      const response = await fetch(`/api/assets/${assetId}/snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      })

      if (!response.ok) {
        throw new Error(`Failed to create snapshot: ${response.statusText}`)
      }

      const result = await response.json()
      return { success: true, versionId: result.versionId }
    } catch (error) {
      console.error('Error creating snapshot:', error)
      return { success: false }
    }
  }

  /**
   * 获取字段的友好标签
   */
  private getFieldLabel(field: string): string {
    const labelMap: Record<string, string> = {
      name: '资产名称',
      displayName: '显示名称',
      description: '描述',
      assetType: '资产类型',
      categoryId: '分类',
      ownerId: '负责人',
      status: '状态',
      'metadata.dataSource': '数据源',
      'metadata.updateFrequency': '更新频率',
      'metadata.sensitivityLevel': '敏感级别',
      'metadata.tags': '标签'
    }

    return labelMap[field] || field
  }

  /**
   * 格式化变更摘要
   */
  formatChangeSummary(version: AssetVersion): string {
    const { changeType, changedFields } = version

    switch (changeType) {
      case ChangeType.CREATE:
        return '创建资产'
      case ChangeType.DELETE:
        return '删除资产'
      case ChangeType.STATUS_CHANGE:
        return `状态变更: ${(version.previousData as any)?.status} → ${(version.newData as any)?.status}`
      case ChangeType.UPDATE:
        return `更新了 ${changedFields.length} 个字段: ${changedFields.map(f => this.getFieldLabel(f)).join(', ')}`
      case ChangeType.BULK_UPDATE:
        return '批量更新'
      default:
        return '未知变更'
    }
  }

  /**
   * 导出版本历史为JSON
   */
  async exportVersionHistory(assetId: string): Promise<Blob> {
    try {
      const { versions } = await this.getVersionHistory(assetId, { limit: 1000 })

      const data = {
        assetId,
        exportDate: new Date().toISOString(),
        totalVersions: versions.length,
        versions
      }

      return new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      })
    } catch (error) {
      console.error('Error exporting version history:', error)
      throw error
    }
  }
}

// 导出单例实例
export const versionControlService = new VersionControlService()
