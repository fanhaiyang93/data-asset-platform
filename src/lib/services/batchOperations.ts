/**
 * 批量操作服务
 * Story 5.6: 批量操作工具
 *
 * 提供批量选择、状态更新、删除等核心批量操作功能
 */

import {
  BatchOperation,
  BatchOperationType,
  BatchOperationStatus,
  BatchOperationProgress,
  BatchOperationResult,
  BatchOperationError,
  BatchStatusUpdateParams,
  BatchSelectionState,
  SelectionCriteria,
  AssetStatus,
  AssetSnapshot,
  OperationSnapshot,
  DEFAULT_BATCH_OPERATION_CONFIG
} from '@/types/batchOperations'

/**
 * 批量操作服务类
 */
export class BatchOperationsService {
  /**
   * 创建批量操作任务
   */
  static async createBatchOperation(
    type: BatchOperationType,
    assetIds: string[],
    operationParams: Record<string, unknown>,
    userId: string
  ): Promise<BatchOperation> {
    const operationId = `batch-${type}-${Date.now()}-${Math.random().toString(36).substring(7)}`
    const totalBatches = Math.ceil(
      assetIds.length / DEFAULT_BATCH_OPERATION_CONFIG.defaultBatchSize
    )

    // TODO: 集成Prisma后保存到数据库
    // const operation = await db.batchOperations.create({
    //   data: {
    //     id: operationId,
    //     type,
    //     status: BatchOperationStatus.PENDING,
    //     totalItems: assetIds.length,
    //     processedItems: 0,
    //     successItems: 0,
    //     failedItems: 0,
    //     createdBy: userId,
    //     createdAt: new Date(),
    //     metadata: {
    //       assetIds,
    //       operationParams,
    //       batchSize: DEFAULT_BATCH_OPERATION_CONFIG.defaultBatchSize,
    //       totalBatches
    //     }
    //   }
    // })

    const operation: BatchOperation = {
      id: operationId,
      type,
      status: BatchOperationStatus.PENDING,
      totalItems: assetIds.length,
      processedItems: 0,
      successItems: 0,
      failedItems: 0,
      createdBy: userId,
      createdAt: new Date(),
      canUndo: true,
      undoExpiresAt: new Date(
        Date.now() + DEFAULT_BATCH_OPERATION_CONFIG.undoRetentionDays * 24 * 3600 * 1000
      ),
      metadata: {
        assetIds,
        operationParams,
        batchSize: DEFAULT_BATCH_OPERATION_CONFIG.defaultBatchSize,
        currentBatch: 0,
        totalBatches
      }
    }

    // 异步执行批量操作
    this.executeBatchOperation(operation).catch(console.error)

    return operation
  }

  /**
   * 执行批量操作
   */
  private static async executeBatchOperation(operation: BatchOperation): Promise<void> {
    try {
      // 更新状态为运行中
      await this.updateOperationStatus(operation.id, BatchOperationStatus.RUNNING)

      // 创建操作快照
      const snapshot = await this.createOperationSnapshot(operation)
      operation.metadata.snapshot = snapshot

      // 分批处理
      const { assetIds } = operation.metadata
      const batchSize = operation.metadata.batchSize || DEFAULT_BATCH_OPERATION_CONFIG.defaultBatchSize
      const batches = this.chunkArray(assetIds, batchSize)

      let successCount = 0
      let failedCount = 0
      const errors: BatchOperationError[] = []

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        const startTime = Date.now()

        try {
          const result = await this.processBatch(operation, batch, i + 1)
          successCount += result.successCount
          failedCount += result.failedCount
          errors.push(...result.errors)

          // 更新进度
          const processedItems = successCount + failedCount
          const throughput = batch.length / ((Date.now() - startTime) / 1000)
          const remainingItems = operation.totalItems - processedItems
          const estimatedTime = remainingItems / throughput

          await this.updateOperationProgress(operation.id, {
            processedItems,
            successItems: successCount,
            failedItems: failedCount,
            currentBatch: i + 1,
            throughputPerSecond: throughput,
            estimatedTimeRemaining: estimatedTime
          })
        } catch (error) {
          console.error(`批量操作批次 ${i + 1} 失败:`, error)
          failedCount += batch.length
          errors.push({
            itemId: `batch-${i + 1}`,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
            canRetry: true
          })
        }
      }

      // 完成操作
      const finalStatus = failedCount === 0
        ? BatchOperationStatus.COMPLETED
        : failedCount < operation.totalItems
        ? BatchOperationStatus.PARTIALLY_COMPLETED
        : BatchOperationStatus.FAILED

      await this.completeOperation(operation.id, finalStatus, {
        successItems: successCount,
        failedItems: failedCount,
        errors
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.failOperation(operation.id, errorMessage)
    }
  }

  /**
   * 处理单个批次
   */
  private static async processBatch(
    operation: BatchOperation,
    assetIds: string[],
    batchNumber: number
  ): Promise<{
    successCount: number
    failedCount: number
    errors: BatchOperationError[]
  }> {
    let successCount = 0
    let failedCount = 0
    const errors: BatchOperationError[] = []

    // 根据操作类型执行不同的处理逻辑
    switch (operation.type) {
      case BatchOperationType.STATUS_UPDATE:
        for (const assetId of assetIds) {
          try {
            await this.updateAssetStatus(
              assetId,
              operation.metadata.operationParams as BatchStatusUpdateParams
            )
            successCount++
          } catch (error) {
            failedCount++
            errors.push({
              itemId: assetId,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date(),
              canRetry: true
            })
          }
        }
        break

      case BatchOperationType.DELETE:
        for (const assetId of assetIds) {
          try {
            await this.deleteAsset(assetId)
            successCount++
          } catch (error) {
            failedCount++
            errors.push({
              itemId: assetId,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date(),
              canRetry: true
            })
          }
        }
        break

      case BatchOperationType.METADATA_UPDATE:
        for (const assetId of assetIds) {
          try {
            await this.updateAssetMetadata(
              assetId,
              operation.metadata.operationParams as Record<string, unknown>
            )
            successCount++
          } catch (error) {
            failedCount++
            errors.push({
              itemId: assetId,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date(),
              canRetry: true
            })
          }
        }
        break

      default:
        throw new Error(`Unsupported operation type: ${operation.type}`)
    }

    return { successCount, failedCount, errors }
  }

  /**
   * 批量状态更新
   */
  static async batchUpdateStatus(params: BatchStatusUpdateParams): Promise<BatchOperation> {
    return this.createBatchOperation(
      BatchOperationType.STATUS_UPDATE,
      params.assetIds,
      params,
      params.userId
    )
  }

  /**
   * 批量删除资产
   */
  static async batchDeleteAssets(
    assetIds: string[],
    userId: string,
    reason?: string
  ): Promise<BatchOperation> {
    return this.createBatchOperation(
      BatchOperationType.DELETE,
      assetIds,
      { reason },
      userId
    )
  }

  /**
   * 批量更新元数据
   */
  static async batchUpdateMetadata(
    assetIds: string[],
    metadata: Record<string, unknown>,
    userId: string
  ): Promise<BatchOperation> {
    return this.createBatchOperation(
      BatchOperationType.METADATA_UPDATE,
      assetIds,
      metadata,
      userId
    )
  }

  /**
   * 获取批量操作进度
   */
  static async getOperationProgress(operationId: string): Promise<BatchOperationProgress> {
    // TODO: 集成Prisma后从数据库查询
    // const operation = await db.batchOperations.findUnique({
    //   where: { id: operationId }
    // })

    // 模拟数据
    const mockProgress: BatchOperationProgress = {
      operationId,
      status: BatchOperationStatus.RUNNING,
      totalItems: 100,
      processedItems: 45,
      successItems: 42,
      failedItems: 3,
      currentBatch: 5,
      totalBatches: 10,
      progress: 45,
      estimatedTimeRemaining: 120,
      throughputPerSecond: 2.5,
      lastUpdated: new Date(),
      errors: []
    }

    return mockProgress
  }

  /**
   * 获取批量操作结果
   */
  static async getOperationResult(operationId: string): Promise<BatchOperationResult> {
    // TODO: 集成Prisma后从数据库查询
    // const operation = await db.batchOperations.findUnique({
    //   where: { id: operationId },
    //   include: {
    //     errors: true
    //   }
    // })

    // 模拟数据
    const mockResult: BatchOperationResult = {
      operationId,
      status: BatchOperationStatus.COMPLETED,
      totalItems: 100,
      successItems: 97,
      failedItems: 3,
      skippedItems: 0,
      duration: 180,
      startedAt: new Date(Date.now() - 180000),
      completedAt: new Date(),
      successIds: Array.from({ length: 97 }, (_, i) => `asset-${i}`),
      failedIds: ['asset-97', 'asset-98', 'asset-99'],
      errors: [
        {
          itemId: 'asset-97',
          itemName: '资产97',
          error: '资产不存在',
          timestamp: new Date(),
          canRetry: false
        },
        {
          itemId: 'asset-98',
          itemName: '资产98',
          error: '权限不足',
          timestamp: new Date(),
          canRetry: false
        },
        {
          itemId: 'asset-99',
          itemName: '资产99',
          error: '状态冲突',
          timestamp: new Date(),
          canRetry: true
        }
      ],
      canUndo: true,
      undoExpiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      summary: {
        message: '批量操作已完成,成功97项,失败3项',
        details: [
          '成功更新97个资产',
          '3个资产更新失败,请查看错误详情',
          '操作可在24小时内撤销'
        ]
      }
    }

    return mockResult
  }

  /**
   * 暂停批量操作
   */
  static async pauseOperation(operationId: string): Promise<{ success: boolean; message: string }> {
    try {
      // TODO: 集成Prisma后实现数据库更新
      // await db.batchOperations.update({
      //   where: { id: operationId },
      //   data: {
      //     status: BatchOperationStatus.PAUSED,
      //     pausedAt: new Date()
      //   }
      // })

      return {
        success: true,
        message: '批量操作已暂停'
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '暂停失败'
      }
    }
  }

  /**
   * 恢复批量操作
   */
  static async resumeOperation(operationId: string): Promise<{ success: boolean; message: string }> {
    try {
      // TODO: 集成Prisma后实现数据库更新和恢复逻辑
      // const operation = await db.batchOperations.findUnique({
      //   where: { id: operationId }
      // })
      //
      // if (operation.status !== BatchOperationStatus.PAUSED) {
      //   throw new Error('只能恢复已暂停的操作')
      // }
      //
      // await db.batchOperations.update({
      //   where: { id: operationId },
      //   data: {
      //     status: BatchOperationStatus.RUNNING,
      //     pausedAt: null
      //   }
      // })
      //
      // // 继续执行剩余批次
      // this.executeBatchOperation(operation).catch(console.error)

      return {
        success: true,
        message: '批量操作已恢复'
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '恢复失败'
      }
    }
  }

  /**
   * 取消批量操作
   */
  static async cancelOperation(operationId: string): Promise<{ success: boolean; message: string }> {
    try {
      // TODO: 集成Prisma后实现数据库更新
      // await db.batchOperations.update({
      //   where: { id: operationId },
      //   data: {
      //     status: BatchOperationStatus.CANCELLED,
      //     completedAt: new Date()
      //   }
      // })

      return {
        success: true,
        message: '批量操作已取消'
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '取消失败'
      }
    }
  }

  /**
   * 重试失败的项目
   */
  static async retryFailedItems(
    operationId: string,
    userId: string
  ): Promise<BatchOperation> {
    // TODO: 集成Prisma后获取失败项目列表
    // const operation = await db.batchOperations.findUnique({
    //   where: { id: operationId },
    //   include: {
    //     errors: true
    //   }
    // })
    //
    // const failedAssetIds = operation.errors
    //   .filter(error => error.canRetry)
    //   .map(error => error.itemId)

    // 模拟失败项目
    const failedAssetIds = ['asset-99']

    return this.createBatchOperation(
      BatchOperationType.STATUS_UPDATE,
      failedAssetIds,
      {},
      userId
    )
  }

  /**
   * 批量选择 - 构建选择状态
   */
  static buildSelectionState(
    selectedIds: string[],
    selectAll: boolean = false,
    criteria?: SelectionCriteria,
    excludedIds: string[] = []
  ): BatchSelectionState {
    return {
      selectedItems: new Set(selectedIds),
      selectAll,
      selectionCriteria: criteria,
      excludedItems: new Set(excludedIds),
      totalCount: selectedIds.length,
      selectedCount: selectedIds.length
    }
  }

  /**
   * 根据条件选择资产
   */
  static async selectAssetsByCriteria(
    criteria: SelectionCriteria
  ): Promise<{ assetIds: string[]; totalCount: number }> {
    // TODO: 集成Prisma后实现数据库查询
    // const whereClause: any = {}
    //
    // if (criteria.status && criteria.status.length > 0) {
    //   whereClause.status = { in: criteria.status }
    // }
    //
    // if (criteria.categories && criteria.categories.length > 0) {
    //   whereClause.category = { in: criteria.categories }
    // }
    //
    // if (criteria.dateRange) {
    //   whereClause[criteria.dateRange.field] = {
    //     gte: criteria.dateRange.start,
    //     lte: criteria.dateRange.end
    //   }
    // }
    //
    // if (criteria.searchQuery) {
    //   whereClause.OR = [
    //     { name: { contains: criteria.searchQuery, mode: 'insensitive' } },
    //     { description: { contains: criteria.searchQuery, mode: 'insensitive' } }
    //   ]
    // }
    //
    // const assets = await db.assets.findMany({
    //   where: whereClause,
    //   select: { id: true }
    // })

    // 模拟数据
    const mockAssetIds = Array.from({ length: 50 }, (_, i) => `asset-${i}`)

    return {
      assetIds: mockAssetIds,
      totalCount: mockAssetIds.length
    }
  }

  // ============ 辅助方法 ============

  /**
   * 数组分块
   */
  private static chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  /**
   * 创建操作快照
   */
  private static async createOperationSnapshot(
    operation: BatchOperation
  ): Promise<OperationSnapshot> {
    const { assetIds } = operation.metadata

    // TODO: 集成Prisma后查询资产状态
    // const assets = await db.assets.findMany({
    //   where: { id: { in: assetIds } }
    // })

    // 模拟快照
    const affectedAssets: AssetSnapshot[] = assetIds.map((id) => ({
      assetId: id,
      assetName: `资产 ${id}`,
      beforeState: {
        status: AssetStatus.ACTIVE,
        updatedAt: new Date()
      },
      afterState: {}
    }))

    const snapshot: OperationSnapshot = {
      operationId: operation.id,
      operationType: operation.type,
      affectedAssets,
      timestamp: new Date(),
      expiresAt: operation.undoExpiresAt || new Date(),
      metadata: operation.metadata.operationParams
    }

    // TODO: 集成Prisma后保存快照
    // await db.operationSnapshots.create({
    //   data: snapshot
    // })

    return snapshot
  }

  /**
   * 更新资产状态
   */
  private static async updateAssetStatus(
    assetId: string,
    params: BatchStatusUpdateParams
  ): Promise<void> {
    // TODO: 集成Prisma后实现数据库更新
    // await db.assets.update({
    //   where: { id: assetId },
    //   data: {
    //     status: params.newStatus,
    //     updatedAt: new Date(),
    //     updatedBy: params.userId
    //   }
    // })

    // 模拟处理时间
    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  /**
   * 删除资产
   */
  private static async deleteAsset(assetId: string): Promise<void> {
    // TODO: 集成Prisma后实现数据库删除
    // await db.assets.delete({
    //   where: { id: assetId }
    // })

    // 模拟处理时间
    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  /**
   * 更新资产元数据
   */
  private static async updateAssetMetadata(
    assetId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    // TODO: 集成Prisma后实现数据库更新
    // await db.assets.update({
    //   where: { id: assetId },
    //   data: {
    //     metadata: metadata
    //   }
    // })

    // 模拟处理时间
    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  /**
   * 更新操作状态
   */
  private static async updateOperationStatus(
    operationId: string,
    status: BatchOperationStatus
  ): Promise<void> {
    // TODO: 集成Prisma后实现数据库更新
    // await db.batchOperations.update({
    //   where: { id: operationId },
    //   data: {
    //     status,
    //     startedAt: status === BatchOperationStatus.RUNNING ? new Date() : undefined
    //   }
    // })
  }

  /**
   * 更新操作进度
   */
  private static async updateOperationProgress(
    operationId: string,
    progress: Partial<BatchOperation>
  ): Promise<void> {
    // TODO: 集成Prisma后实现数据库更新
    // await db.batchOperations.update({
    //   where: { id: operationId },
    //   data: progress
    // })
  }

  /**
   * 完成操作
   */
  private static async completeOperation(
    operationId: string,
    status: BatchOperationStatus,
    result: {
      successItems: number
      failedItems: number
      errors: BatchOperationError[]
    }
  ): Promise<void> {
    // TODO: 集成Prisma后实现数据库更新
    // await db.batchOperations.update({
    //   where: { id: operationId },
    //   data: {
    //     status,
    //     successItems: result.successItems,
    //     failedItems: result.failedItems,
    //     completedAt: new Date()
    //   }
    // })
    //
    // // 保存错误记录
    // if (result.errors.length > 0) {
    //   await db.batchOperationErrors.createMany({
    //     data: result.errors.map(error => ({
    //       ...error,
    //       operationId
    //     }))
    //   })
    // }
  }

  /**
   * 操作失败
   */
  private static async failOperation(operationId: string, error: string): Promise<void> {
    // TODO: 集成Prisma后实现数据库更新
    // await db.batchOperations.update({
    //   where: { id: operationId },
    //   data: {
    //     status: BatchOperationStatus.FAILED,
    //     error,
    //     completedAt: new Date()
    //   }
    // })
  }
}
