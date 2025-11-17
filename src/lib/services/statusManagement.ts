/**
 * 资产状态管理服务
 * Story 5.3: 资产编辑与维护
 *
 * 提供资产状态变更的核心业务逻辑:
 * - 状态变更即时生效
 * - 状态变更历史记录
 * - 状态变更审核流程
 */

import { AssetStatus, ChangeType, AssetVersion } from '@/types/assetMaintenance'

export interface StatusChangeResult {
  success: boolean
  requireApproval: boolean
  approvalRequestId?: string
  versionId?: string
  message: string
}

export class StatusManagementService {
  /**
   * 变更资产状态
   */
  async changeStatus(
    assetId: string,
    fromStatus: AssetStatus,
    toStatus: AssetStatus,
    reason?: string
  ): Promise<StatusChangeResult> {
    try {
      // 检查状态变更是否需要审核
      const requireApproval = this.requiresApproval(fromStatus, toStatus)

      const response = await fetch(`/api/assets/${assetId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fromStatus,
          toStatus,
          reason,
          requireApproval
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to change status: ${response.statusText}`)
      }

      const result = await response.json()

      return {
        success: true,
        requireApproval,
        approvalRequestId: result.approvalRequestId,
        versionId: result.versionId,
        message: requireApproval
          ? '状态变更请求已提交,等待审核'
          : '状态变更成功'
      }
    } catch (error) {
      console.error('Error changing status:', error)
      return {
        success: false,
        requireApproval: false,
        message: error instanceof Error ? error.message : '状态变更失败'
      }
    }
  }

  /**
   * 批量变更资产状态
   */
  async batchChangeStatus(
    assetIds: string[],
    toStatus: AssetStatus,
    reason?: string
  ): Promise<{
    success: boolean
    successCount: number
    failedCount: number
    results: Array<{ assetId: string; success: boolean; message: string }>
  }> {
    try {
      const response = await fetch('/api/assets/batch/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assetIds,
          toStatus,
          reason
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to batch change status: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error batch changing status:', error)
      return {
        success: false,
        successCount: 0,
        failedCount: assetIds.length,
        results: assetIds.map(id => ({
          assetId: id,
          success: false,
          message: error instanceof Error ? error.message : '批量状态变更失败'
        }))
      }
    }
  }

  /**
   * 获取状态变更历史
   */
  async getStatusHistory(assetId: string): Promise<AssetVersion[]> {
    try {
      const response = await fetch(
        `/api/assets/${assetId}/versions?changeType=${ChangeType.STATUS_CHANGE}`
      )

      if (!response.ok) {
        throw new Error(`Failed to get status history: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting status history:', error)
      return []
    }
  }

  /**
   * 检查状态变更是否需要审核
   */
  private requiresApproval(from: AssetStatus, to: AssetStatus): boolean {
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

  /**
   * 验证状态变更是否合法
   */
  validateStatusChange(from: AssetStatus, to: AssetStatus): {
    isValid: boolean
    message?: string
  } {
    // 状态不能相同
    if (from === to) {
      return {
        isValid: false,
        message: '新状态与当前状态相同'
      }
    }

    // 弃用状态不能直接变更到维护中
    if (from === AssetStatus.DEPRECATED && to === AssetStatus.MAINTENANCE) {
      return {
        isValid: false,
        message: '已弃用的资产需要先恢复为可用状态'
      }
    }

    return { isValid: true }
  }

  /**
   * 获取状态变更的影响分析
   */
  async getStatusChangeImpact(
    assetId: string,
    toStatus: AssetStatus
  ): Promise<{
    affectedUsers: number
    affectedApplications: number
    recommendations: string[]
  }> {
    try {
      const response = await fetch(
        `/api/assets/${assetId}/status-impact?toStatus=${toStatus}`
      )

      if (!response.ok) {
        throw new Error(`Failed to get impact analysis: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting status impact:', error)
      return {
        affectedUsers: 0,
        affectedApplications: 0,
        recommendations: []
      }
    }
  }
}

// 导出单例实例
export const statusManagementService = new StatusManagementService()
