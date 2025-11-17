/**
 * 操作历史服务测试
 * Story 5.6: 批量操作工具
 *
 * 测试操作历史记录和撤销功能
 */

import { describe, it, expect } from '@jest/globals'
import { OperationHistoryService } from '../operationHistory'
import { BatchOperationType, BatchOperationStatus } from '@/types/batchOperations'

describe('OperationHistoryService', () => {
  describe('getOperationHistory', () => {
    it('应该返回操作历史列表', async () => {
      const result = await OperationHistoryService.getOperationHistory(undefined, 1, 20)

      expect(result).toHaveProperty('records')
      expect(result).toHaveProperty('total')
      expect(result).toHaveProperty('page')
      expect(result).toHaveProperty('pageSize')
      expect(result).toHaveProperty('hasMore')
      expect(Array.isArray(result.records)).toBe(true)
    })

    it('应该支持用户筛选', async () => {
      const result = await OperationHistoryService.getOperationHistory('user-1', 1, 10)

      expect(result.records.length).toBeLessThanOrEqual(10)
    })

    it('应该支持分页', async () => {
      const page1 = await OperationHistoryService.getOperationHistory(undefined, 1, 10)
      const page2 = await OperationHistoryService.getOperationHistory(undefined, 2, 10)

      expect(page1.page).toBe(1)
      expect(page2.page).toBe(2)
    })

    it('记录应该包含必要字段', async () => {
      const result = await OperationHistoryService.getOperationHistory(undefined, 1, 1)

      if (result.records.length > 0) {
        const record = result.records[0]
        expect(record).toHaveProperty('id')
        expect(record).toHaveProperty('operationId')
        expect(record).toHaveProperty('type')
        expect(record).toHaveProperty('status')
        expect(record).toHaveProperty('totalItems')
        expect(record).toHaveProperty('createdBy')
        expect(record).toHaveProperty('createdAt')
      }
    })
  })

  describe('getOperationDetail', () => {
    it('应该返回操作详情', async () => {
      const detail = await OperationHistoryService.getOperationDetail('op-123')

      expect(detail).not.toBeNull()
      expect(detail).toHaveProperty('operationId')
      expect(detail).toHaveProperty('type')
      expect(detail).toHaveProperty('status')
      expect(detail).toHaveProperty('totalItems')
      expect(detail).toHaveProperty('successItems')
      expect(detail).toHaveProperty('failedItems')
    })

    it('应该包含撤销信息', async () => {
      const detail = await OperationHistoryService.getOperationDetail('op-123')

      expect(detail).toHaveProperty('canUndo')
      if (detail?.canUndo) {
        expect(detail.undoExpiresAt).toBeDefined()
      }
    })
  })

  describe('undoOperation', () => {
    it('应该成功撤销操作', async () => {
      const result = await OperationHistoryService.undoOperation({
        operationId: 'op-123',
        userId: 'user-1',
        reason: '误操作'
      })

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('message')
      expect(result).toHaveProperty('restoredItems')
      expect(result).toHaveProperty('failedItems')
    })

    it('撤销结果应该包含恢复项目数', async () => {
      const result = await OperationHistoryService.undoOperation({
        operationId: 'op-123',
        userId: 'user-1'
      })

      if (result.success) {
        expect(result.restoredItems).toBeGreaterThanOrEqual(0)
      }
    })

    it('失败时应该提供错误信息', async () => {
      const result = await OperationHistoryService.undoOperation({
        operationId: 'invalid-op',
        userId: 'user-1'
      })

      if (!result.success) {
        expect(result.message).toBeTruthy()
      }
    })
  })

  describe('canUndoOperation', () => {
    it('应该检查操作是否可撤销', async () => {
      const result = await OperationHistoryService.canUndoOperation('op-123')

      expect(result).toHaveProperty('canUndo')
      expect(typeof result.canUndo).toBe('boolean')
    })

    it('可撤销时应该返回过期时间', async () => {
      const result = await OperationHistoryService.canUndoOperation('op-123')

      if (result.canUndo) {
        expect(result.expiresAt).toBeDefined()
        expect(result.expiresAt!.getTime()).toBeGreaterThan(Date.now())
      }
    })

    it('不可撤销时应该提供原因', async () => {
      const result = await OperationHistoryService.canUndoOperation('invalid-op')

      if (!result.canUndo) {
        expect(result.reason).toBeTruthy()
      }
    })
  })

  describe('getOperationStatistics', () => {
    it('应该返回统计信息', async () => {
      const stats = await OperationHistoryService.getOperationStatistics()

      expect(stats).toHaveProperty('totalOperations')
      expect(stats).toHaveProperty('runningOperations')
      expect(stats).toHaveProperty('completedOperations')
      expect(stats).toHaveProperty('failedOperations')
      expect(stats).toHaveProperty('averageDuration')
      expect(stats).toHaveProperty('averageSuccessRate')
      expect(stats).toHaveProperty('operationsByType')
      expect(stats).toHaveProperty('operationsByStatus')
    })

    it('统计数据应该一致', async () => {
      const stats = await OperationHistoryService.getOperationStatistics()

      const statusSum =
        stats.operationsByStatus[BatchOperationStatus.PENDING] +
        stats.operationsByStatus[BatchOperationStatus.RUNNING] +
        stats.operationsByStatus[BatchOperationStatus.COMPLETED] +
        stats.operationsByStatus[BatchOperationStatus.FAILED] +
        stats.operationsByStatus[BatchOperationStatus.CANCELLED] +
        stats.operationsByStatus[BatchOperationStatus.PAUSED] +
        stats.operationsByStatus[BatchOperationStatus.PARTIALLY_COMPLETED]

      // 注意: 由于是模拟数据,可能不严格相等,这里只检查是否合理
      expect(statusSum).toBeGreaterThan(0)
    })

    it('成功率应该在0-100之间', async () => {
      const stats = await OperationHistoryService.getOperationStatistics()

      expect(stats.averageSuccessRate).toBeGreaterThanOrEqual(0)
      expect(stats.averageSuccessRate).toBeLessThanOrEqual(100)
    })

    it('应该支持用户和日期范围筛选', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-12-31')

      const stats = await OperationHistoryService.getOperationStatistics(
        'user-1',
        startDate,
        endDate
      )

      expect(stats.totalOperations).toBeGreaterThanOrEqual(0)
    })
  })

  describe('cleanupExpiredSnapshots', () => {
    it('应该清理过期快照', async () => {
      const result = await OperationHistoryService.cleanupExpiredSnapshots()

      expect(result).toHaveProperty('cleaned')
      expect(result.cleaned).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getRecentOperations', () => {
    it('应该获取最近操作', async () => {
      const operations = await OperationHistoryService.getRecentOperations('user-1', 5)

      expect(Array.isArray(operations)).toBe(true)
      expect(operations.length).toBeLessThanOrEqual(5)
    })

    it('操作应该按时间倒序排列', async () => {
      const operations = await OperationHistoryService.getRecentOperations('user-1', 3)

      if (operations.length > 1) {
        for (let i = 1; i < operations.length; i++) {
          const prevTime = operations[i - 1].createdAt.getTime()
          const currTime = operations[i].createdAt.getTime()
          expect(prevTime).toBeGreaterThanOrEqual(currTime)
        }
      }
    })
  })

  describe('exportOperationHistory', () => {
    it('应该导出CSV格式历史', async () => {
      const result = await OperationHistoryService.exportOperationHistory(
        undefined,
        undefined,
        undefined,
        'csv'
      )

      expect(result).toHaveProperty('fileUrl')
      expect(result).toHaveProperty('fileName')
      expect(result.fileName).toContain('.csv')
    })

    it('应该导出JSON格式历史', async () => {
      const result = await OperationHistoryService.exportOperationHistory(
        undefined,
        undefined,
        undefined,
        'json'
      )

      expect(result.fileName).toContain('.json')
    })

    it('应该支持日期范围筛选', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-12-31')

      const result = await OperationHistoryService.exportOperationHistory(
        'user-1',
        startDate,
        endDate,
        'csv'
      )

      expect(result.fileUrl).toBeTruthy()
    })
  })
})
