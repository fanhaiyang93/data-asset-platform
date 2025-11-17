/**
 * 软删除服务
 * Story 5.4: 资产下架管理
 *
 * 提供资产软删除机制,实现下架后的数据过滤逻辑
 */

import { ExtendedAssetStatus, SoftDeleteQueryOptions } from '@/types/assetLifecycle'

/**
 * 软删除服务类
 */
export class SoftDeleteService {
  /**
   * 生成用户端查询的状态过滤条件
   * 排除已下架和已归档的资产
   */
  static getUserAssetFilter(): { status: { notIn: ExtendedAssetStatus[] } } {
    return {
      status: {
        notIn: [
          ExtendedAssetStatus.DECOMMISSIONED,
          ExtendedAssetStatus.ARCHIVED
        ]
      }
    }
  }

  /**
   * 生成管理端查询的状态过滤条件
   * 根据选项决定是否包含已下架资产
   */
  static getAdminAssetFilter(options: SoftDeleteQueryOptions = {
    includeDecommissioned: false,
    includeArchived: false,
    onlyActive: false
  }): Record<string, any> {
    const { includeDecommissioned, includeArchived, onlyActive } = options

    // 仅显示活跃资产
    if (onlyActive) {
      return {
        status: ExtendedAssetStatus.ACTIVE
      }
    }

    // 排除的状态列表
    const excludedStatuses: ExtendedAssetStatus[] = []

    if (!includeDecommissioned) {
      excludedStatuses.push(ExtendedAssetStatus.DECOMMISSIONED)
    }

    if (!includeArchived) {
      excludedStatuses.push(ExtendedAssetStatus.ARCHIVED)
    }

    // 如果有要排除的状态,返回 notIn 过滤器
    if (excludedStatuses.length > 0) {
      return {
        status: {
          notIn: excludedStatuses
        }
      }
    }

    // 包含所有状态
    return {}
  }

  /**
   * 检查资产是否已被软删除
   */
  static isDecommissioned(status: ExtendedAssetStatus): boolean {
    return status === ExtendedAssetStatus.DECOMMISSIONED ||
           status === ExtendedAssetStatus.ARCHIVED
  }

  /**
   * 检查资产是否对用户可见
   */
  static isVisibleToUser(status: ExtendedAssetStatus): boolean {
    return !this.isDecommissioned(status)
  }

  /**
   * 获取搜索查询的状态过滤条件
   * 搜索功能默认排除已下架资产
   */
  static getSearchFilter(includeDecommissioned: boolean = false): Record<string, any> {
    if (includeDecommissioned) {
      return {}
    }

    return {
      status: {
        notIn: [
          ExtendedAssetStatus.DECOMMISSIONED,
          ExtendedAssetStatus.ARCHIVED
        ]
      }
    }
  }

  /**
   * 检查资产状态是否可以转换
   */
  static canTransitionStatus(
    currentStatus: ExtendedAssetStatus,
    targetStatus: ExtendedAssetStatus
  ): { allowed: boolean; reason?: string } {
    // 已归档的资产不能直接恢复,需要先恢复到下架状态
    if (currentStatus === ExtendedAssetStatus.ARCHIVED &&
        targetStatus !== ExtendedAssetStatus.DECOMMISSIONED) {
      return {
        allowed: false,
        reason: '已归档的资产需要先恢复到下架状态'
      }
    }

    // 已下架的资产可以恢复到任何活跃状态
    if (currentStatus === ExtendedAssetStatus.DECOMMISSIONED) {
      const activeStatuses = [
        ExtendedAssetStatus.ACTIVE,
        ExtendedAssetStatus.MAINTENANCE,
        ExtendedAssetStatus.INACTIVE,
        ExtendedAssetStatus.DEPRECATED
      ]

      if (activeStatuses.includes(targetStatus)) {
        return { allowed: true }
      }

      // 也可以归档
      if (targetStatus === ExtendedAssetStatus.ARCHIVED) {
        return { allowed: true }
      }

      return {
        allowed: false,
        reason: '不支持的状态转换'
      }
    }

    // 活跃状态可以下架
    const activeStatuses = [
      ExtendedAssetStatus.ACTIVE,
      ExtendedAssetStatus.MAINTENANCE,
      ExtendedAssetStatus.INACTIVE,
      ExtendedAssetStatus.DEPRECATED
    ]

    if (activeStatuses.includes(currentStatus) &&
        targetStatus === ExtendedAssetStatus.DECOMMISSIONED) {
      return { allowed: true }
    }

    // 其他状态转换检查
    if (activeStatuses.includes(currentStatus) &&
        activeStatuses.includes(targetStatus)) {
      return { allowed: true }
    }

    return {
      allowed: false,
      reason: '不支持的状态转换'
    }
  }

  /**
   * 获取资产的可用状态转换列表
   */
  static getAvailableTransitions(
    currentStatus: ExtendedAssetStatus
  ): ExtendedAssetStatus[] {
    const allStatuses = Object.values(ExtendedAssetStatus)

    return allStatuses.filter(targetStatus => {
      if (targetStatus === currentStatus) {
        return false
      }

      const result = this.canTransitionStatus(currentStatus, targetStatus)
      return result.allowed
    })
  }

  /**
   * 验证批量操作的资产状态
   */
  static validateBatchDecommission(
    assetStatuses: Array<{ assetId: string; status: ExtendedAssetStatus }>
  ): {
    valid: Array<{ assetId: string; status: ExtendedAssetStatus }>
    invalid: Array<{ assetId: string; status: ExtendedAssetStatus; reason: string }>
  } {
    const valid: Array<{ assetId: string; status: ExtendedAssetStatus }> = []
    const invalid: Array<{ assetId: string; status: ExtendedAssetStatus; reason: string }> = []

    for (const asset of assetStatuses) {
      const transitionResult = this.canTransitionStatus(
        asset.status,
        ExtendedAssetStatus.DECOMMISSIONED
      )

      if (transitionResult.allowed) {
        valid.push(asset)
      } else {
        invalid.push({
          ...asset,
          reason: transitionResult.reason || '无法下架此资产'
        })
      }
    }

    return { valid, invalid }
  }

  /**
   * 生成资产列表的状态统计
   */
  static generateStatusStatistics(
    statuses: ExtendedAssetStatus[]
  ): Record<ExtendedAssetStatus, number> {
    const statistics: Record<string, number> = {}

    // 初始化所有状态为0
    Object.values(ExtendedAssetStatus).forEach(status => {
      statistics[status] = 0
    })

    // 统计每个状态的数量
    statuses.forEach(status => {
      statistics[status] = (statistics[status] || 0) + 1
    })

    return statistics as Record<ExtendedAssetStatus, number>
  }

  /**
   * 检查资产是否可以安全删除(物理删除)
   * 只有已归档超过指定时间的资产才能物理删除
   */
  static canPhysicallyDelete(
    status: ExtendedAssetStatus,
    archivedAt: Date | null,
    retentionDays: number = 90
  ): { allowed: boolean; reason?: string } {
    if (status !== ExtendedAssetStatus.ARCHIVED) {
      return {
        allowed: false,
        reason: '只有已归档的资产才能物理删除'
      }
    }

    if (!archivedAt) {
      return {
        allowed: false,
        reason: '归档时间未设置'
      }
    }

    const daysSinceArchived = Math.floor(
      (Date.now() - archivedAt.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysSinceArchived < retentionDays) {
      return {
        allowed: false,
        reason: `资产需要归档至少 ${retentionDays} 天才能物理删除(当前: ${daysSinceArchived} 天)`
      }
    }

    return { allowed: true }
  }
}

/**
 * 软删除辅助函数
 */

/**
 * 生成用户端资产查询条件
 */
export function getUserAssetWhereClause(): Record<string, any> {
  return {
    ...SoftDeleteService.getUserAssetFilter(),
    // 可以添加其他默认条件,如 isActive: true
  }
}

/**
 * 生成管理端资产查询条件
 */
export function getAdminAssetWhereClause(
  includeDecommissioned: boolean = false,
  includeArchived: boolean = false
): Record<string, any> {
  return {
    ...SoftDeleteService.getAdminAssetFilter({
      includeDecommissioned,
      includeArchived,
      onlyActive: false
    })
  }
}

/**
 * 检查状态转换是否有效
 */
export function isValidStatusTransition(
  from: ExtendedAssetStatus,
  to: ExtendedAssetStatus
): boolean {
  const result = SoftDeleteService.canTransitionStatus(from, to)
  return result.allowed
}

/**
 * 获取状态显示标签
 */
export function getStatusLabel(status: ExtendedAssetStatus): string {
  const labels: Record<ExtendedAssetStatus, string> = {
    [ExtendedAssetStatus.ACTIVE]: '活跃',
    [ExtendedAssetStatus.MAINTENANCE]: '维护中',
    [ExtendedAssetStatus.INACTIVE]: '暂停',
    [ExtendedAssetStatus.DEPRECATED]: '已弃用',
    [ExtendedAssetStatus.DECOMMISSIONED]: '已下架',
    [ExtendedAssetStatus.ARCHIVED]: '已归档'
  }

  return labels[status] || status
}

/**
 * 获取状态的颜色标识
 */
export function getStatusColor(status: ExtendedAssetStatus): string {
  const colors: Record<ExtendedAssetStatus, string> = {
    [ExtendedAssetStatus.ACTIVE]: 'green',
    [ExtendedAssetStatus.MAINTENANCE]: 'yellow',
    [ExtendedAssetStatus.INACTIVE]: 'gray',
    [ExtendedAssetStatus.DEPRECATED]: 'orange',
    [ExtendedAssetStatus.DECOMMISSIONED]: 'red',
    [ExtendedAssetStatus.ARCHIVED]: 'purple'
  }

  return colors[status] || 'gray'
}
