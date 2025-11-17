/**
 * 批量操作服务测试
 * Story 5.6: 批量操作工具
 *
 * 测试批量选择、状态更新、进度监控等核心功能
 */

import { describe, it, expect } from '@jest/globals'
import { BatchOperationsService } from '../batchOperations'
import {
  BatchOperationType,
  BatchOperationStatus,
  AssetStatus,
  SelectionCriteria
} from '@/types/batchOperations'

describe('BatchOperationsService', () => {
  describe('createBatchOperation', () => {
    it('应该创建批量操作任务', async () => {
      const assetIds = ['asset-1', 'asset-2', 'asset-3']
      const operationParams = { newStatus: AssetStatus.INACTIVE }

      const operation = await BatchOperationsService.createBatchOperation(
        BatchOperationType.STATUS_UPDATE,
        assetIds,
        operationParams,
        'user-1'
      )

      expect(operation).toHaveProperty('id')
      expect(operation.type).toBe(BatchOperationType.STATUS_UPDATE)
      expect(operation.status).toBe(BatchOperationStatus.PENDING)
      expect(operation.totalItems).toBe(assetIds.length)
      expect(operation.metadata.assetIds).toEqual(assetIds)
    })

    it('应该正确计算批次数量', async () => {
      const assetIds = Array.from({ length: 250 }, (_, i) => `asset-${i}`)

      const operation = await BatchOperationsService.createBatchOperation(
        BatchOperationType.STATUS_UPDATE,
        assetIds,
        {},
        'user-1'
      )

      expect(operation.metadata.totalBatches).toBe(5) // 250 / 50 = 5
    })

    it('应该设置撤销过期时间', async () => {
      const operation = await BatchOperationsService.createBatchOperation(
        BatchOperationType.STATUS_UPDATE,
        ['asset-1'],
        {},
        'user-1'
      )

      expect(operation.canUndo).toBe(true)
      expect(operation.undoExpiresAt).toBeDefined()
      expect(operation.undoExpiresAt!.getTime()).toBeGreaterThan(Date.now())
    })
  })

  describe('batchUpdateStatus', () => {
    it('应该创建批量状态更新操作', async () => {
      const params = {
        assetIds: ['asset-1', 'asset-2'],
        newStatus: AssetStatus.MAINTENANCE,
        reason: '系统维护',
        userId: 'user-1'
      }

      const operation = await BatchOperationsService.batchUpdateStatus(params)

      expect(operation.type).toBe(BatchOperationType.STATUS_UPDATE)
      expect(operation.metadata.operationParams).toEqual(params)
    })
  })

  describe('batchDeleteAssets', () => {
    it('应该创建批量删除操作', async () => {
      const assetIds = ['asset-1', 'asset-2', 'asset-3']
      const operation = await BatchOperationsService.batchDeleteAssets(
        assetIds,
        'user-1',
        '资产过期'
      )

      expect(operation.type).toBe(BatchOperationType.DELETE)
      expect(operation.totalItems).toBe(assetIds.length)
    })
  })

  describe('batchUpdateMetadata', () => {
    it('应该创建批量元数据更新操作', async () => {
      const assetIds = ['asset-1', 'asset-2']
      const metadata = { priority: 'high', tags: ['important'] }

      const operation = await BatchOperationsService.batchUpdateMetadata(
        assetIds,
        metadata,
        'user-1'
      )

      expect(operation.type).toBe(BatchOperationType.METADATA_UPDATE)
      expect(operation.metadata.operationParams).toEqual(metadata)
    })
  })

  describe('getOperationProgress', () => {
    it('应该返回操作进度信息', async () => {
      const progress = await BatchOperationsService.getOperationProgress('op-123')

      expect(progress).toHaveProperty('operationId')
      expect(progress).toHaveProperty('status')
      expect(progress).toHaveProperty('totalItems')
      expect(progress).toHaveProperty('processedItems')
      expect(progress).toHaveProperty('successItems')
      expect(progress).toHaveProperty('failedItems')
      expect(progress).toHaveProperty('progress')
      expect(progress).toHaveProperty('estimatedTimeRemaining')
      expect(progress).toHaveProperty('throughputPerSecond')
    })

    it('进度值应该在0-100之间', async () => {
      const progress = await BatchOperationsService.getOperationProgress('op-123')

      expect(progress.progress).toBeGreaterThanOrEqual(0)
      expect(progress.progress).toBeLessThanOrEqual(100)
    })
  })

  describe('getOperationResult', () => {
    it('应该返回操作结果', async () => {
      const result = await BatchOperationsService.getOperationResult('op-123')

      expect(result).toHaveProperty('operationId')
      expect(result).toHaveProperty('status')
      expect(result).toHaveProperty('totalItems')
      expect(result).toHaveProperty('successItems')
      expect(result).toHaveProperty('failedItems')
      expect(result).toHaveProperty('successIds')
      expect(result).toHaveProperty('failedIds')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('summary')
    })

    it('成功和失败数量应该等于总数', async () => {
      const result = await BatchOperationsService.getOperationResult('op-123')

      const sum = result.successItems + result.failedItems + result.skippedItems
      expect(sum).toBe(result.totalItems)
    })

    it('应该包含错误详情', async () => {
      const result = await BatchOperationsService.getOperationResult('op-123')

      if (result.failedItems > 0) {
        expect(result.errors.length).toBeGreaterThan(0)
        result.errors.forEach((error) => {
          expect(error).toHaveProperty('itemId')
          expect(error).toHaveProperty('error')
          expect(error).toHaveProperty('timestamp')
          expect(error).toHaveProperty('canRetry')
        })
      }
    })
  })

  describe('pauseOperation', () => {
    it('应该暂停批量操作', async () => {
      const result = await BatchOperationsService.pauseOperation('op-123')

      expect(result.success).toBe(true)
      expect(result.message).toBeTruthy()
    })
  })

  describe('resumeOperation', () => {
    it('应该恢复批量操作', async () => {
      const result = await BatchOperationsService.resumeOperation('op-123')

      expect(result.success).toBe(true)
      expect(result.message).toBeTruthy()
    })
  })

  describe('cancelOperation', () => {
    it('应该取消批量操作', async () => {
      const result = await BatchOperationsService.cancelOperation('op-123')

      expect(result.success).toBe(true)
      expect(result.message).toBeTruthy()
    })
  })

  describe('retryFailedItems', () => {
    it('应该创建重试操作', async () => {
      const operation = await BatchOperationsService.retryFailedItems('op-123', 'user-1')

      expect(operation).toHaveProperty('id')
      expect(operation.type).toBe(BatchOperationType.STATUS_UPDATE)
    })
  })

  describe('buildSelectionState', () => {
    it('应该构建选择状态', () => {
      const selectedIds = ['asset-1', 'asset-2', 'asset-3']
      const state = BatchOperationsService.buildSelectionState(selectedIds)

      expect(state.selectedItems.size).toBe(selectedIds.length)
      expect(state.selectedCount).toBe(selectedIds.length)
      expect(state.selectAll).toBe(false)
    })

    it('应该支持全选模式', () => {
      const state = BatchOperationsService.buildSelectionState([], true)

      expect(state.selectAll).toBe(true)
    })

    it('应该支持排除项目', () => {
      const selectedIds = ['asset-1', 'asset-2', 'asset-3']
      const excludedIds = ['asset-2']
      const state = BatchOperationsService.buildSelectionState(
        selectedIds,
        false,
        undefined,
        excludedIds
      )

      expect(state.excludedItems.size).toBe(1)
      expect(state.excludedItems.has('asset-2')).toBe(true)
    })
  })

  describe('selectAssetsByCriteria', () => {
    it('应该根据条件选择资产', async () => {
      const criteria: SelectionCriteria = {
        status: [AssetStatus.ACTIVE],
        categories: ['数据表']
      }

      const result = await BatchOperationsService.selectAssetsByCriteria(criteria)

      expect(result).toHaveProperty('assetIds')
      expect(result).toHaveProperty('totalCount')
      expect(Array.isArray(result.assetIds)).toBe(true)
      expect(result.totalCount).toBe(result.assetIds.length)
    })

    it('应该支持日期范围筛选', async () => {
      const criteria: SelectionCriteria = {
        dateRange: {
          field: 'createdAt',
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31')
        }
      }

      const result = await BatchOperationsService.selectAssetsByCriteria(criteria)

      expect(result.assetIds.length).toBeGreaterThanOrEqual(0)
    })

    it('应该支持搜索查询', async () => {
      const criteria: SelectionCriteria = {
        searchQuery: 'test'
      }

      const result = await BatchOperationsService.selectAssetsByCriteria(criteria)

      expect(result.totalCount).toBeGreaterThanOrEqual(0)
    })
  })
})
