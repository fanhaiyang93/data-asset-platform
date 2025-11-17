/**
 * 冲突解决器
 * 处理本地和远程数据同步时的冲突
 */

import { StatusUpdate } from '@/types/integration'
import { LocalApplication } from './statusSyncService'

/**
 * 冲突解决策略
 */
export enum ConflictResolutionStrategy {
  USE_REMOTE = 'use_remote',       // 使用远程数据
  USE_LOCAL = 'use_local',         // 使用本地数据
  USE_LATEST = 'use_latest',       // 使用最新的数据
  MERGE = 'merge',                 // 合并数据
  MANUAL = 'manual'                // 需要人工干预
}

/**
 * 冲突解决结果
 */
export interface ConflictResolution {
  strategy: ConflictResolutionStrategy
  useRemote: boolean
  useLocal: boolean
  merge: boolean
  requiresManualIntervention: boolean
  reason: string
  mergedData?: any
}

/**
 * 冲突类型
 */
export enum ConflictType {
  TIMESTAMP_MISMATCH = 'timestamp_mismatch',     // 时间戳不匹配
  VERSION_CONFLICT = 'version_conflict',          // 版本冲突
  STATUS_INCONSISTENT = 'status_inconsistent',    // 状态不一致
  DATA_DIVERGED = 'data_diverged'                // 数据分歧
}

/**
 * 冲突信息
 */
export interface ConflictInfo {
  type: ConflictType
  local: LocalApplication
  remote: StatusUpdate
  severity: 'low' | 'medium' | 'high'
  description: string
}

/**
 * 冲突解决器类
 */
export class ConflictResolver {
  private defaultStrategy: ConflictResolutionStrategy

  constructor(defaultStrategy: ConflictResolutionStrategy = ConflictResolutionStrategy.USE_LATEST) {
    this.defaultStrategy = defaultStrategy
  }

  /**
   * 解决冲突
   */
  async resolve(
    local: LocalApplication,
    remote: StatusUpdate
  ): Promise<ConflictResolution> {
    // 分析冲突类型
    const conflictInfo = this.analyzeConflict(local, remote)

    console.log('[ConflictResolver] 冲突分析:', conflictInfo)

    // 根据冲突类型选择解决策略
    const strategy = this.selectStrategy(conflictInfo)

    // 执行解决策略
    return this.executeStrategy(strategy, local, remote, conflictInfo)
  }

  /**
   * 分析冲突类型
   */
  private analyzeConflict(
    local: LocalApplication,
    remote: StatusUpdate
  ): ConflictInfo {
    // 检查时间戳
    const timeDiff = local.lastUpdated.getTime() - remote.updatedAt.getTime()

    // 时间戳冲突(本地更新时间晚于远程)
    if (timeDiff > 0) {
      return {
        type: ConflictType.TIMESTAMP_MISMATCH,
        local,
        remote,
        severity: 'medium',
        description: `本地更新时间(${local.lastUpdated.toISOString()})晚于远程(${remote.updatedAt.toISOString()})`
      }
    }

    // 版本冲突
    if (local.version !== undefined) {
      return {
        type: ConflictType.VERSION_CONFLICT,
        local,
        remote,
        severity: 'high',
        description: `版本不一致: 本地版本${local.version}`
      }
    }

    // 状态不一致
    if (local.status !== remote.oldStatus) {
      return {
        type: ConflictType.STATUS_INCONSISTENT,
        local,
        remote,
        severity: 'high',
        description: `状态不一致: 本地${local.status}, 远程期望${remote.oldStatus}`
      }
    }

    // 数据分歧
    return {
      type: ConflictType.DATA_DIVERGED,
      local,
      remote,
      severity: 'low',
      description: '数据存在分歧'
    }
  }

  /**
   * 选择解决策略
   */
  private selectStrategy(conflictInfo: ConflictInfo): ConflictResolutionStrategy {
    switch (conflictInfo.type) {
      case ConflictType.TIMESTAMP_MISMATCH:
        // 时间戳冲突: 使用最新的数据
        return ConflictResolutionStrategy.USE_LATEST

      case ConflictType.VERSION_CONFLICT:
        // 版本冲突: 需要人工干预(高严重性)
        if (conflictInfo.severity === 'high') {
          return ConflictResolutionStrategy.MANUAL
        }
        return ConflictResolutionStrategy.USE_REMOTE

      case ConflictType.STATUS_INCONSISTENT:
        // 状态不一致: 使用远程状态(数据平台为权威源)
        return ConflictResolutionStrategy.USE_REMOTE

      case ConflictType.DATA_DIVERGED:
        // 数据分歧: 尝试合并
        return ConflictResolutionStrategy.MERGE

      default:
        // 使用默认策略
        return this.defaultStrategy
    }
  }

  /**
   * 执行解决策略
   */
  private async executeStrategy(
    strategy: ConflictResolutionStrategy,
    local: LocalApplication,
    remote: StatusUpdate,
    conflictInfo: ConflictInfo
  ): Promise<ConflictResolution> {
    switch (strategy) {
      case ConflictResolutionStrategy.USE_REMOTE:
        return {
          strategy,
          useRemote: true,
          useLocal: false,
          merge: false,
          requiresManualIntervention: false,
          reason: '使用远程数据作为权威源'
        }

      case ConflictResolutionStrategy.USE_LOCAL:
        return {
          strategy,
          useRemote: false,
          useLocal: true,
          merge: false,
          requiresManualIntervention: false,
          reason: '保留本地数据'
        }

      case ConflictResolutionStrategy.USE_LATEST:
        const useRemote = remote.updatedAt > local.lastUpdated
        return {
          strategy,
          useRemote,
          useLocal: !useRemote,
          merge: false,
          requiresManualIntervention: false,
          reason: `使用更新时间更晚的数据: ${useRemote ? '远程' : '本地'}`
        }

      case ConflictResolutionStrategy.MERGE:
        return {
          strategy,
          useRemote: false,
          useLocal: false,
          merge: true,
          requiresManualIntervention: false,
          reason: '合并本地和远程数据',
          mergedData: this.mergeData(local, remote)
        }

      case ConflictResolutionStrategy.MANUAL:
        return {
          strategy,
          useRemote: false,
          useLocal: false,
          merge: false,
          requiresManualIntervention: true,
          reason: `需要人工干预: ${conflictInfo.description}`
        }

      default:
        throw new Error(`未知的冲突解决策略: ${strategy}`)
    }
  }

  /**
   * 合并数据
   */
  private mergeData(
    local: LocalApplication,
    remote: StatusUpdate
  ): LocalApplication {
    // 简单的合并策略:
    // 1. 状态使用远程的新状态
    // 2. 其他字段保留本地数据
    return {
      ...local,
      status: remote.newStatus,
      platformApplicationId: remote.platformApplicationId,
      lastUpdated: new Date(Math.max(
        local.lastUpdated.getTime(),
        remote.updatedAt.getTime()
      ))
    }
  }

  /**
   * 记录冲突
   */
  private logConflict(conflictInfo: ConflictInfo, resolution: ConflictResolution): void {
    console.log('[ConflictResolver] 冲突记录:', {
      type: conflictInfo.type,
      severity: conflictInfo.severity,
      description: conflictInfo.description,
      strategy: resolution.strategy,
      reason: resolution.reason
    })

    // TODO: 在实际项目中,应该将冲突记录存储到数据库
    // await database.conflictLogs.create({
    //   data: {
    //     type: conflictInfo.type,
    //     applicationId: conflictInfo.local.id,
    //     localData: conflictInfo.local,
    //     remoteData: conflictInfo.remote,
    //     strategy: resolution.strategy,
    //     resolution: resolution,
    //     timestamp: new Date()
    //   }
    // })
  }

  /**
   * 设置默认策略
   */
  setDefaultStrategy(strategy: ConflictResolutionStrategy): void {
    this.defaultStrategy = strategy
  }

  /**
   * 获取默认策略
   */
  getDefaultStrategy(): ConflictResolutionStrategy {
    return this.defaultStrategy
  }

  /**
   * 检查冲突严重性
   */
  isHighSeverity(conflictInfo: ConflictInfo): boolean {
    return conflictInfo.severity === 'high'
  }

  /**
   * 获取冲突建议
   */
  getSuggestion(conflictInfo: ConflictInfo): string {
    const suggestions: Record<ConflictType, string> = {
      [ConflictType.TIMESTAMP_MISMATCH]: '建议使用时间戳更晚的数据',
      [ConflictType.VERSION_CONFLICT]: '建议检查版本历史并手动解决',
      [ConflictType.STATUS_INCONSISTENT]: '建议使用数据平台的状态作为权威源',
      [ConflictType.DATA_DIVERGED]: '建议合并本地和远程的变更'
    }

    return suggestions[conflictInfo.type] || '建议联系管理员处理'
  }
}

/**
 * 创建冲突解决器实例
 */
export function createConflictResolver(
  defaultStrategy?: ConflictResolutionStrategy
): ConflictResolver {
  return new ConflictResolver(defaultStrategy)
}
