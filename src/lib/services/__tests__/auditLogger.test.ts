/**
 * 审计日志服务测试
 * Story 5.4: 资产下架管理
 *
 * 测试审计日志记录和查询功能
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { AuditLoggerService } from '../auditLogger'
import { ExtendedAssetStatus, DecommissionAuditLog } from '@/types/assetLifecycle'

describe('AuditLoggerService', () => {
  describe('logAssetDecommission', () => {
    it('应该正确记录资产下架操作', async () => {
      const log = await AuditLoggerService.logAssetDecommission(
        'asset-1',
        'Test Asset',
        'user-1',
        'John Doe',
        'data_expired',
        'Data has expired and is no longer valid',
        {
          previousStatus: ExtendedAssetStatus.ACTIVE,
          affectedApplications: 5,
          affectedUsers: 10,
          dependentAssets: 2,
          approvalRequired: false,
          notificationsSent: 10
        }
      )

      expect(log).toBeDefined()
      expect(log.operation).toBe('DECOMMISSION')
      expect(log.assetId).toBe('asset-1')
      expect(log.assetName).toBe('Test Asset')
      expect(log.operatorId).toBe('user-1')
      expect(log.operatorName).toBe('John Doe')
      expect(log.impactLevel).toBe('MEDIUM') // 5 active applications and 2 dependent assets
      expect(log.metadata.affectedApplications).toBe(5)
    })

    it('低影响操作应该标记为 LOW 风险', async () => {
      const log = await AuditLoggerService.logAssetDecommission(
        'asset-2',
        'Low Impact Asset',
        'user-1',
        'Jane Doe',
        'other',
        'No longer needed',
        {
          previousStatus: ExtendedAssetStatus.INACTIVE,
          affectedApplications: 0,
          affectedUsers: 0,
          dependentAssets: 0,
          approvalRequired: false,
          notificationsSent: 0
        }
      )

      expect(log.impactLevel).toBe('LOW')
    })

    it('中等影响操作应该标记为 MEDIUM 风险', async () => {
      const log = await AuditLoggerService.logAssetDecommission(
        'asset-3',
        'Medium Impact Asset',
        'user-1',
        'Alice Smith',
        'business_change',
        'Business requirements changed',
        {
          previousStatus: ExtendedAssetStatus.ACTIVE,
          affectedApplications: 2,
          affectedUsers: 5,
          dependentAssets: 3, // > 0 dependent assets
          approvalRequired: true,
          notificationsSent: 5
        }
      )

      expect(log.impactLevel).toBe('MEDIUM')
    })
  })

  describe('logAssetRestore', () => {
    it('应该正确记录资产恢复操作', async () => {
      const log = await AuditLoggerService.logAssetRestore(
        'asset-1',
        'Test Asset',
        'user-1',
        'John Doe',
        'Business needs restored',
        {
          newStatus: ExtendedAssetStatus.ACTIVE,
          affectedUsers: 5,
          notificationsSent: 5
        }
      )

      expect(log).toBeDefined()
      expect(log.operation).toBe('RESTORE')
      expect(log.impactLevel).toBe('LOW')
      expect(log.metadata.previousStatus).toBe(ExtendedAssetStatus.DECOMMISSIONED)
      expect(log.metadata.newStatus).toBe(ExtendedAssetStatus.ACTIVE)
    })

    it('恢复操作的原因可以是可选的', async () => {
      const log = await AuditLoggerService.logAssetRestore(
        'asset-1',
        'Test Asset',
        'user-1',
        'John Doe',
        undefined,
        {
          newStatus: ExtendedAssetStatus.ACTIVE,
          affectedUsers: 0,
          notificationsSent: 0
        }
      )

      expect(log.reason).toBeUndefined()
    })
  })

  describe('logScheduledDecommission', () => {
    it('应该正确记录定时下架操作', async () => {
      const scheduledDate = new Date('2024-12-31')

      const log = await AuditLoggerService.logScheduledDecommission(
        'asset-1',
        'Test Asset',
        'user-1',
        'John Doe',
        scheduledDate,
        'data_expired',
        'Will be expired by end of year'
      )

      expect(log).toBeDefined()
      expect(log.operation).toBe('SCHEDULE_DECOMMISSION')
      expect(log.impactLevel).toBe('LOW')
    })
  })

  describe('generateStatistics', () => {
    it('应该正确生成统计数据', async () => {
      const mockLogs: DecommissionAuditLog[] = [
        {
          id: '1',
          assetId: 'asset-1',
          assetName: 'Asset 1',
          operation: 'DECOMMISSION',
          operatorId: 'user-1',
          operatorName: 'John Doe',
          timestamp: new Date('2024-01-01'),
          impactLevel: 'HIGH',
          metadata: {
            previousStatus: ExtendedAssetStatus.ACTIVE,
            newStatus: ExtendedAssetStatus.DECOMMISSIONED,
            affectedApplications: 10,
            affectedUsers: 20,
            dependentAssets: 5,
            approvalRequired: true,
            notificationsSent: 20
          }
        },
        {
          id: '2',
          assetId: 'asset-2',
          assetName: 'Asset 2',
          operation: 'DECOMMISSION',
          operatorId: 'user-2',
          operatorName: 'Jane Doe',
          timestamp: new Date('2024-01-02'),
          impactLevel: 'LOW',
          metadata: {
            previousStatus: ExtendedAssetStatus.ACTIVE,
            newStatus: ExtendedAssetStatus.DECOMMISSIONED,
            affectedApplications: 0,
            affectedUsers: 0,
            dependentAssets: 0,
            approvalRequired: false,
            notificationsSent: 0
          }
        },
        {
          id: '3',
          assetId: 'asset-1',
          assetName: 'Asset 1',
          operation: 'RESTORE',
          operatorId: 'user-1',
          operatorName: 'John Doe',
          timestamp: new Date('2024-01-03'),
          impactLevel: 'LOW',
          metadata: {
            previousStatus: ExtendedAssetStatus.DECOMMISSIONED,
            newStatus: ExtendedAssetStatus.ACTIVE,
            affectedApplications: 0,
            affectedUsers: 5,
            dependentAssets: 0,
            approvalRequired: false,
            notificationsSent: 5
          }
        }
      ]

      const statistics = await AuditLoggerService.generateStatistics(
        mockLogs,
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') }
      )

      expect(statistics.totalDecommissioned).toBe(2)
      expect(statistics.totalRestored).toBe(1)
      expect(statistics.byImpactLevel.HIGH).toBe(1)
      expect(statistics.byImpactLevel.LOW).toBe(2)
      expect(statistics.topOperators).toHaveLength(2)
    })

    it('应该正确排序操作员统计', async () => {
      const mockLogs: DecommissionAuditLog[] = [
        {
          id: '1',
          assetId: 'asset-1',
          assetName: 'Asset 1',
          operation: 'DECOMMISSION',
          operatorId: 'user-1',
          operatorName: 'High Activity User',
          timestamp: new Date(),
          impactLevel: 'LOW',
          metadata: {
            previousStatus: ExtendedAssetStatus.ACTIVE,
            newStatus: ExtendedAssetStatus.DECOMMISSIONED,
            affectedApplications: 0,
            affectedUsers: 0,
            dependentAssets: 0,
            approvalRequired: false,
            notificationsSent: 0
          }
        },
        {
          id: '2',
          assetId: 'asset-2',
          assetName: 'Asset 2',
          operation: 'DECOMMISSION',
          operatorId: 'user-1',
          operatorName: 'High Activity User',
          timestamp: new Date(),
          impactLevel: 'LOW',
          metadata: {
            previousStatus: ExtendedAssetStatus.ACTIVE,
            newStatus: ExtendedAssetStatus.DECOMMISSIONED,
            affectedApplications: 0,
            affectedUsers: 0,
            dependentAssets: 0,
            approvalRequired: false,
            notificationsSent: 0
          }
        },
        {
          id: '3',
          assetId: 'asset-3',
          assetName: 'Asset 3',
          operation: 'DECOMMISSION',
          operatorId: 'user-2',
          operatorName: 'Low Activity User',
          timestamp: new Date(),
          impactLevel: 'LOW',
          metadata: {
            previousStatus: ExtendedAssetStatus.ACTIVE,
            newStatus: ExtendedAssetStatus.DECOMMISSIONED,
            affectedApplications: 0,
            affectedUsers: 0,
            dependentAssets: 0,
            approvalRequired: false,
            notificationsSent: 0
          }
        }
      ]

      const statistics = await AuditLoggerService.generateStatistics(
        mockLogs,
        { start: new Date(), end: new Date() }
      )

      // 高活跃度用户应该排在第一
      expect(statistics.topOperators[0].operatorName).toBe('High Activity User')
      expect(statistics.topOperators[0].decommissionCount).toBe(2)
    })

    it('空日志应该返回零统计', async () => {
      const statistics = await AuditLoggerService.generateStatistics(
        [],
        { start: new Date(), end: new Date() }
      )

      expect(statistics.totalDecommissioned).toBe(0)
      expect(statistics.totalRestored).toBe(0)
      expect(statistics.topOperators).toHaveLength(0)
    })
  })
})
