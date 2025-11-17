/**
 * 资产下架服务
 * Story 5.4: 资产下架管理
 *
 * 提供资产下架、恢复、影响评估等核心功能
 */

import {
  ExtendedAssetStatus,
  DecommissionReason,
  AssetDecommissionInfo,
  DecommissionImpact,
  AssetDependency,
  UserImpact,
  DecommissionConfirmation,
  BatchDecommissionConfig,
  BatchDecommissionResult,
  DecommissionItemResult,
  DecommissionError,
  AssetRestoreConfig,
  AssetRestoreResult,
  ScheduledDecommissionTask
} from '@/types/assetLifecycle'
import { SoftDeleteService } from './softDelete'

/**
 * 资产下架服务类
 */
export class AssetDecommissionService {
  /**
   * 评估资产下架的影响
   * @param assetId 资产ID
   * @returns 下架影响评估结果
   */
  static async assessDecommissionImpact(
    assetId: string
  ): Promise<DecommissionImpact> {
    // TODO: 实现真实的影响评估逻辑
    // 这里提供模拟实现

    const impact: DecommissionImpact = {
      assetId,
      assetName: 'Asset Name', // 从数据库获取
      activeApplications: 0,
      dependentAssets: [],
      affectedUsers: [],
      businessProcesses: [],
      riskLevel: 'LOW',
      recommendations: [],
      canSafelyDecommission: true,
      warningMessages: []
    }

    // 检查活跃申请
    const activeApps = await this.checkActiveApplications(assetId)
    impact.activeApplications = activeApps.count
    if (activeApps.count > 0) {
      impact.warningMessages.push(
        `存在 ${activeApps.count} 个活跃申请,下架后这些申请将无法继续处理`
      )
      impact.riskLevel = activeApps.count > 5 ? 'HIGH' : 'MEDIUM'
    }

    // 检查依赖资产
    const dependencies = await this.checkAssetDependencies(assetId)
    impact.dependentAssets = dependencies
    if (dependencies.length > 0) {
      const highImpactDeps = dependencies.filter(d => d.impact === 'high')
      if (highImpactDeps.length > 0) {
        impact.riskLevel = 'HIGH'
        impact.warningMessages.push(
          `存在 ${highImpactDeps.length} 个高影响依赖资产`
        )
      }
    }

    // 检查受影响用户
    const users = await this.checkAffectedUsers(assetId)
    impact.affectedUsers = users
    if (users.length > 0) {
      const frequentUsers = users.filter(u => u.impactType === 'frequent_user')
      if (frequentUsers.length > 10) {
        impact.riskLevel = 'HIGH'
        impact.warningMessages.push(
          `有 ${frequentUsers.length} 个频繁使用此资产的用户`
        )
      }
    }

    // 生成建议
    impact.recommendations = this.generateRecommendations(impact)

    // 确定是否可以安全下架
    impact.canSafelyDecommission = impact.riskLevel === 'LOW' &&
                                     impact.warningMessages.length === 0

    return impact
  }

  /**
   * 下架资产
   * @param assetId 资产ID
   * @param reason 下架原因
   * @param reasonDetail 详细说明
   * @param userId 操作用户ID
   * @returns 下架操作结果
   */
  static async decommissionAsset(
    assetId: string,
    reason: DecommissionReason,
    reasonDetail: string,
    userId: string
  ): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      // 1. 检查资产当前状态
      const currentStatus = await this.getAssetStatus(assetId)

      // 2. 验证状态转换
      const transitionCheck = SoftDeleteService.canTransitionStatus(
        currentStatus,
        ExtendedAssetStatus.DECOMMISSIONED
      )

      if (!transitionCheck.allowed) {
        return {
          success: false,
          message: '无法下架资产',
          error: transitionCheck.reason
        }
      }

      // 3. 执行影响评估
      const impact = await this.assessDecommissionImpact(assetId)

      if (!impact.canSafelyDecommission && impact.riskLevel === 'HIGH') {
        return {
          success: false,
          message: '资产下架风险过高,请先处理依赖和活跃申请',
          error: impact.warningMessages.join('; ')
        }
      }

      // 4. 创建下架信息
      const decommissionInfo: AssetDecommissionInfo = {
        decommissionedAt: new Date(),
        decommissionedBy: userId,
        reason,
        reasonDetail,
        impactAssessment: JSON.stringify(impact),
        canRestore: true
      }

      // 5. 更新资产状态
      await this.updateAssetStatus(
        assetId,
        ExtendedAssetStatus.DECOMMISSIONED,
        decommissionInfo
      )

      // 6. 记录审计日志
      await this.logDecommission(assetId, userId, reason, reasonDetail, impact)

      return {
        success: true,
        message: '资产已成功下架'
      }
    } catch (error) {
      return {
        success: false,
        message: '下架操作失败',
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 批量下架资产
   * @param config 批量下架配置
   * @param userId 操作用户ID
   * @returns 批量操作结果
   */
  static async batchDecommissionAssets(
    config: BatchDecommissionConfig,
    userId: string
  ): Promise<BatchDecommissionResult> {
    const startTime = new Date()
    const results: DecommissionItemResult[] = []
    const errors: DecommissionError[] = []
    let successCount = 0
    let failedCount = 0
    let skippedCount = 0

    const batchSize = config.batchSize || 10
    const delay = config.delayBetweenBatches || 100

    // 分批处理资产
    for (let i = 0; i < config.assetIds.length; i += batchSize) {
      const batch = config.assetIds.slice(i, i + batchSize)

      // 处理当前批次
      for (const assetId of batch) {
        try {
          // 如果不跳过影响检查,先进行评估
          if (!config.skipImpactCheck) {
            const impact = await this.assessDecommissionImpact(assetId)

            if (impact.riskLevel === 'HIGH' && !config.skipImpactCheck) {
              results.push({
                assetId,
                assetName: impact.assetName,
                status: 'skipped',
                message: '风险等级过高,已跳过',
                impactLevel: 'HIGH',
                warnings: impact.warningMessages
              })
              skippedCount++
              continue
            }
          }

          // 执行下架操作
          const result = await this.decommissionAsset(
            assetId,
            config.reason,
            config.reasonDetail,
            userId
          )

          if (result.success) {
            results.push({
              assetId,
              assetName: 'Asset', // 从数据库获取实际名称
              status: 'success',
              message: result.message
            })
            successCount++
          } else {
            results.push({
              assetId,
              assetName: 'Asset',
              status: 'failed',
              error: result.error
            })
            failedCount++

            errors.push({
              assetId,
              assetName: 'Asset',
              errorType: 'system_error',
              error: result.error || '未知错误',
              code: 'DECOMMISSION_FAILED',
              canRetry: true
            })
          }
        } catch (error) {
          failedCount++
          const errorMessage = error instanceof Error ? error.message : '未知错误'

          results.push({
            assetId,
            assetName: 'Asset',
            status: 'failed',
            error: errorMessage
          })

          errors.push({
            assetId,
            assetName: 'Asset',
            errorType: 'system_error',
            error: errorMessage,
            code: 'UNEXPECTED_ERROR',
            canRetry: true
          })
        }
      }

      // 批次间延迟
      if (i + batchSize < config.assetIds.length) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    const endTime = new Date()

    return {
      totalAssets: config.assetIds.length,
      successCount,
      failedCount,
      skippedCount,
      results,
      errors,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime()
    }
  }

  /**
   * 恢复已下架的资产
   * @param config 恢复配置
   * @param userId 操作用户ID
   * @returns 恢复操作结果
   */
  static async restoreAsset(
    config: AssetRestoreConfig,
    userId: string
  ): Promise<AssetRestoreResult> {
    try {
      // 1. 获取当前状态
      const currentStatus = await this.getAssetStatus(config.assetId)

      // 2. 验证资产是否已下架
      if (!SoftDeleteService.isDecommissioned(currentStatus)) {
        return {
          success: false,
          assetId: config.assetId,
          assetName: 'Asset',
          previousStatus: currentStatus,
          newStatus: currentStatus,
          restoredAt: new Date(),
          restoredBy: userId,
          message: '资产未处于下架状态,无需恢复'
        }
      }

      // 3. 确定恢复后的状态
      const targetStatus = config.restoreStatus || ExtendedAssetStatus.ACTIVE

      // 4. 验证状态转换
      const transitionCheck = SoftDeleteService.canTransitionStatus(
        currentStatus,
        targetStatus
      )

      if (!transitionCheck.allowed) {
        return {
          success: false,
          assetId: config.assetId,
          assetName: 'Asset',
          previousStatus: currentStatus,
          newStatus: currentStatus,
          restoredAt: new Date(),
          restoredBy: userId,
          message: '无法恢复到指定状态',
          warnings: [transitionCheck.reason || '不支持的状态转换']
        }
      }

      // 5. 执行恢复操作
      await this.updateAssetStatus(config.assetId, targetStatus, null)

      // 6. 记录审计日志
      await this.logRestore(config.assetId, userId, config.reason)

      return {
        success: true,
        assetId: config.assetId,
        assetName: 'Asset',
        previousStatus: currentStatus,
        newStatus: targetStatus,
        restoredAt: new Date(),
        restoredBy: userId,
        message: '资产已成功恢复'
      }
    } catch (error) {
      return {
        success: false,
        assetId: config.assetId,
        assetName: 'Asset',
        previousStatus: ExtendedAssetStatus.DECOMMISSIONED,
        newStatus: ExtendedAssetStatus.DECOMMISSIONED,
        restoredAt: new Date(),
        restoredBy: userId,
        message: '恢复操作失败',
        warnings: [error instanceof Error ? error.message : '未知错误']
      }
    }
  }

  /**
   * 创建定时下架任务
   */
  static async scheduleDecommission(
    assetId: string,
    scheduledAt: Date,
    reason: DecommissionReason,
    reasonDetail: string,
    userId: string
  ): Promise<ScheduledDecommissionTask> {
    // TODO: 实现定时任务创建
    const task: ScheduledDecommissionTask = {
      id: `task-${Date.now()}`,
      assetId,
      assetName: 'Asset',
      scheduledAt,
      createdBy: userId,
      createdAt: new Date(),
      reason,
      reasonDetail,
      status: 'pending'
    }

    return task
  }

  // ========== 私有辅助方法 ==========

  /**
   * 检查活跃申请
   */
  private static async checkActiveApplications(
    assetId: string
  ): Promise<{ count: number; applications: any[] }> {
    // TODO: 从数据库查询活跃申请
    return {
      count: 0,
      applications: []
    }
  }

  /**
   * 检查资产依赖关系
   */
  private static async checkAssetDependencies(
    assetId: string
  ): Promise<AssetDependency[]> {
    // TODO: 从数据库查询依赖关系
    return []
  }

  /**
   * 检查受影响用户
   */
  private static async checkAffectedUsers(
    assetId: string
  ): Promise<UserImpact[]> {
    // TODO: 从数据库查询受影响用户
    return []
  }

  /**
   * 生成下架建议
   */
  private static generateRecommendations(
    impact: DecommissionImpact
  ): string[] {
    const recommendations: string[] = []

    if (impact.activeApplications > 0) {
      recommendations.push('建议先处理或拒绝所有活跃申请')
    }

    if (impact.dependentAssets.length > 0) {
      recommendations.push('建议先检查并处理依赖资产')
    }

    if (impact.affectedUsers.length > 10) {
      recommendations.push('建议提前通知受影响用户')
    }

    if (impact.riskLevel === 'HIGH') {
      recommendations.push('建议使用定时下架功能,设置缓冲期')
    }

    return recommendations
  }

  /**
   * 获取资产状态
   */
  private static async getAssetStatus(
    assetId: string
  ): Promise<ExtendedAssetStatus> {
    // TODO: 从数据库获取真实状态
    return ExtendedAssetStatus.ACTIVE
  }

  /**
   * 更新资产状态
   */
  private static async updateAssetStatus(
    assetId: string,
    status: ExtendedAssetStatus,
    decommissionInfo: AssetDecommissionInfo | null
  ): Promise<void> {
    // TODO: 更新数据库中的资产状态
  }

  /**
   * 记录下架审计日志
   */
  private static async logDecommission(
    assetId: string,
    userId: string,
    reason: DecommissionReason,
    reasonDetail: string,
    impact: DecommissionImpact
  ): Promise<void> {
    // TODO: 记录到审计日志表
  }

  /**
   * 记录恢复审计日志
   */
  private static async logRestore(
    assetId: string,
    userId: string,
    reason?: string
  ): Promise<void> {
    // TODO: 记录到审计日志表
  }
}
