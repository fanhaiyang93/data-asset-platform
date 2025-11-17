import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/cache'
import { searchEngineService } from './SearchEngineService'
import { searchSuggestionService } from './SearchSuggestionService'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

// 索引更新类型枚举
export enum IndexUpdateType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  BULK_UPDATE = 'bulk_update'
}

// 索引更新任务接口
export interface IndexUpdateTask {
  id: string
  type: IndexUpdateType
  assetId: string
  priority: number
  retryCount: number
  maxRetries: number
  createdAt: Date
  scheduledAt: Date
  metadata?: any
}

// 批量更新输入验证
export const BulkUpdateInputSchema = z.object({
  assetIds: z.array(z.string()).optional(),
  fullSync: z.boolean().default(false),
  priority: z.number().min(1).max(10).default(5)
})

export type BulkUpdateInput = z.infer<typeof BulkUpdateInputSchema>

export class SearchIndexUpdateService {
  private updateQueue: IndexUpdateTask[] = []
  private processing: boolean = false
  private batchSize: number = 50
  private processingInterval: number = 5000 // 5秒处理一次
  private cachePrefix = 'index_update:'

  constructor() {
    // 启动定时处理
    this.startPeriodicProcessing()
  }

  // 添加资产创建任务
  async scheduleAssetCreate(assetId: string, priority: number = 5): Promise<void> {
    const task: IndexUpdateTask = {
      id: `create_${assetId}_${Date.now()}`,
      type: IndexUpdateType.CREATE,
      assetId,
      priority,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      scheduledAt: new Date(),
      metadata: { operation: 'asset_created' }
    }

    await this.addTaskToQueue(task)
    console.log(`已安排资产创建索引更新任务: ${assetId}`)
  }

  // 添加资产更新任务
  async scheduleAssetUpdate(assetId: string, priority: number = 5): Promise<void> {
    const task: IndexUpdateTask = {
      id: `update_${assetId}_${Date.now()}`,
      type: IndexUpdateType.UPDATE,
      assetId,
      priority,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      scheduledAt: new Date(),
      metadata: { operation: 'asset_updated' }
    }

    await this.addTaskToQueue(task)
    console.log(`已安排资产更新索引更新任务: ${assetId}`)
  }

  // 添加资产删除任务
  async scheduleAssetDelete(assetId: string, priority: number = 8): Promise<void> {
    const task: IndexUpdateTask = {
      id: `delete_${assetId}_${Date.now()}`,
      type: IndexUpdateType.DELETE,
      assetId,
      priority,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      scheduledAt: new Date(),
      metadata: { operation: 'asset_deleted' }
    }

    await this.addTaskToQueue(task)
    console.log(`已安排资产删除索引更新任务: ${assetId}`)
  }

  // 安排批量更新任务
  async scheduleBulkUpdate(input: BulkUpdateInput): Promise<void> {
    try {
      const { assetIds, fullSync, priority } = input

      if (fullSync) {
        // 全量同步：获取所有活跃资产
        const assets = await prisma.asset.findMany({
          where: { status: { not: 'DRAFT' } },
          select: { id: true },
          orderBy: { updatedAt: 'desc' }
        })

        // 分批创建更新任务
        const batchedAssetIds = this.chunkArray(assets.map(a => a.id), this.batchSize)

        for (const batch of batchedAssetIds) {
          const task: IndexUpdateTask = {
            id: `bulk_update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: IndexUpdateType.BULK_UPDATE,
            assetId: 'bulk', // 特殊标识
            priority,
            retryCount: 0,
            maxRetries: 2,
            createdAt: new Date(),
            scheduledAt: new Date(),
            metadata: { assetIds: batch, batchSize: batch.length }
          }

          await this.addTaskToQueue(task)
        }

        console.log(`已安排全量同步任务，总计 ${assets.length} 个资产，分 ${batchedAssetIds.length} 批处理`)
      } else if (assetIds && assetIds.length > 0) {
        // 指定资产ID批量更新
        const batchedAssetIds = this.chunkArray(assetIds, this.batchSize)

        for (const batch of batchedAssetIds) {
          const task: IndexUpdateTask = {
            id: `bulk_update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: IndexUpdateType.BULK_UPDATE,
            assetId: 'bulk',
            priority,
            retryCount: 0,
            maxRetries: 2,
            createdAt: new Date(),
            scheduledAt: new Date(),
            metadata: { assetIds: batch, batchSize: batch.length }
          }

          await this.addTaskToQueue(task)
        }

        console.log(`已安排批量更新任务，总计 ${assetIds.length} 个资产，分 ${batchedAssetIds.length} 批处理`)
      } else {
        const errorMsg = '批量更新需要指定资产ID或启用全量同步'
        console.error('批量索引更新参数错误:', {
          error: errorMsg,
          hasAssetIds: Boolean(assetIds?.length),
          fullSync,
          timestamp: new Date().toISOString()
        })
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: errorMsg
        })
      }
    } catch (error) {
      console.error('安排批量更新任务失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '安排批量更新任务失败'
      })
    }
  }

  // 添加任务到队列
  private async addTaskToQueue(task: IndexUpdateTask): Promise<void> {
    try {
      // 检查是否已存在相同的未处理任务
      const existingTaskKey = `${this.cachePrefix}task:${task.type}:${task.assetId}`
      const existingTask = await redis.get(existingTaskKey)

      if (existingTask) {
        console.log(`跳过重复任务: ${task.id}`)
        return
      }

      // 添加到内存队列
      this.updateQueue.push(task)

      // 缓存任务（用于去重）
      // **索引更新任务去重缓存策略 - 5分钟TTL**
      // 原因：防止短时间内重复提交相同的索引更新任务
      // - 5分钟：足够覆盖大部分重复操作的时间窗口
      // - 去重机制：避免资源浪费和索引冲突
      // - 适用场景：资产创建、更新、删除的索引同步任务
      await redis.setex(existingTaskKey, 300, JSON.stringify(task))

      // 按优先级排序队列
      this.updateQueue.sort((a, b) => b.priority - a.priority)

      // 如果不在处理中，立即触发处理
      if (!this.processing) {
        this.processQueue()
      }
    } catch (error) {
      console.error('添加任务到队列失败:', error)
    }
  }

  // 启动定时处理
  private startPeriodicProcessing(): void {
    setInterval(() => {
      if (!this.processing && this.updateQueue.length > 0) {
        this.processQueue()
      }
    }, this.processingInterval)
  }

  // 处理队列中的任务
  private async processQueue(): Promise<void> {
    if (this.processing || this.updateQueue.length === 0) {
      return
    }

    this.processing = true
    const startTime = Date.now()

    try {
      console.log(`开始处理索引更新队列，待处理任务: ${this.updateQueue.length}`)

      // 取出一批任务进行处理
      const tasksToProcess = this.updateQueue.splice(0, Math.min(this.batchSize, this.updateQueue.length))

      for (const task of tasksToProcess) {
        try {
          await this.processTask(task)

          // 清除缓存中的任务标记
          const taskKey = `${this.cachePrefix}task:${task.type}:${task.assetId}`
          await redis.del(taskKey)
        } catch (error) {
          console.error(`处理任务失败: ${task.id}`, error)
          await this.handleTaskError(task, error as Error)
        }
      }

      const processingTime = Date.now() - startTime
      console.log(`批次处理完成，耗时: ${processingTime}ms，处理任务数: ${tasksToProcess.length}`)

      // 记录性能指标
      await this.recordPerformanceMetrics({
        batchSize: tasksToProcess.length,
        processingTime,
        queueLength: this.updateQueue.length
      })

    } catch (error) {
      console.error('处理队列时发生错误:', error)
    } finally {
      this.processing = false

      // 如果还有任务，继续处理
      if (this.updateQueue.length > 0) {
        setTimeout(() => this.processQueue(), 1000)
      }
    }
  }

  // 处理单个任务
  private async processTask(task: IndexUpdateTask): Promise<void> {
    const startTime = Date.now()

    try {
      switch (task.type) {
        case IndexUpdateType.CREATE:
        case IndexUpdateType.UPDATE:
          await this.processAssetUpdate(task.assetId)
          break

        case IndexUpdateType.DELETE:
          await this.processAssetDelete(task.assetId)
          break

        case IndexUpdateType.BULK_UPDATE:
          await this.processBulkUpdate(task.metadata.assetIds)
          break

        default:
          const errorMsg = `未知的任务类型: ${task.type}`
          console.error('索引更新任务类型错误:', {
            error: errorMsg,
            taskId: task.id,
            taskType: task.type,
            timestamp: new Date().toISOString()
          })
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: errorMsg
          })
      }

      const processingTime = Date.now() - startTime
      console.log(`任务处理成功: ${task.id}，耗时: ${processingTime}ms`)

    } catch (error) {
      console.error(`任务处理失败: ${task.id}`, error)
      throw error
    }
  }

  // 处理资产更新
  private async processAssetUpdate(assetId: string): Promise<void> {
    try {
      // 获取资产数据
      const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        include: {
          category: true,
          creator: true,
          updater: true
        }
      })

      if (!asset) {
        console.log(`资产不存在，跳过更新: ${assetId}`)
        return
      }

      // 更新搜索引擎索引
      await searchEngineService.updateAssetInIndex(asset)

      // 清除相关缓存
      await this.clearRelatedCaches(assetId)

      console.log(`资产索引更新成功: ${assetId}`)
    } catch (error) {
      console.error(`处理资产更新失败: ${assetId}`, error)
      throw error
    }
  }

  // 处理资产删除
  private async processAssetDelete(assetId: string): Promise<void> {
    try {
      // 从搜索引擎中删除
      await searchEngineService.deleteAssetFromIndex(assetId)

      // 清除相关缓存
      await this.clearRelatedCaches(assetId)

      console.log(`资产索引删除成功: ${assetId}`)
    } catch (error) {
      console.error(`处理资产删除失败: ${assetId}`, error)
      throw error
    }
  }

  // 处理批量更新
  private async processBulkUpdate(assetIds: string[]): Promise<void> {
    try {
      // 批量更新搜索引擎索引
      await searchEngineService.bulkUpdateIndex(assetIds)

      // 清除相关缓存
      for (const assetId of assetIds) {
        await this.clearRelatedCaches(assetId)
      }

      console.log(`批量索引更新成功，资产数量: ${assetIds.length}`)
    } catch (error) {
      console.error(`处理批量更新失败`, error)
      throw error
    }
  }

  // 清除相关缓存
  private async clearRelatedCaches(assetId: string): Promise<void> {
    try {
      // 清除搜索建议缓存
      await searchSuggestionService.clearSuggestionCache()

      // 清除搜索结果缓存
      const searchCachePattern = 'search:*'
      const keys = await redis.keys(searchCachePattern)
      if (keys.length > 0) {
        await redis.del(...keys)
      }

      console.log(`已清除资产相关缓存: ${assetId}`)
    } catch (error) {
      console.error(`清除缓存失败: ${assetId}`, error)
      // 不影响主流程，只记录错误
    }
  }

  // 处理任务错误
  private async handleTaskError(task: IndexUpdateTask, error: Error): Promise<void> {
    task.retryCount++

    if (task.retryCount <= task.maxRetries) {
      // 计算重试延迟（指数退避）
      const retryDelay = Math.pow(2, task.retryCount) * 1000
      task.scheduledAt = new Date(Date.now() + retryDelay)

      // 重新添加到队列
      this.updateQueue.push(task)
      this.updateQueue.sort((a, b) => b.priority - a.priority)

      console.log(`任务将在 ${retryDelay}ms 后重试: ${task.id} (${task.retryCount}/${task.maxRetries})`)
    } else {
      console.error(`任务重试次数超限，放弃处理: ${task.id}`, error)

      // 记录失败任务到数据库或日志系统
      await this.recordFailedTask(task, error)
    }
  }

  // 记录失败任务
  private async recordFailedTask(task: IndexUpdateTask, error: Error): Promise<void> {
    try {
      // 这里可以记录到数据库或发送警报
      console.error('索引更新任务最终失败:', {
        taskId: task.id,
        type: task.type,
        assetId: task.assetId,
        retryCount: task.retryCount,
        error: error.message,
        stack: error.stack
      })
    } catch (recordError) {
      console.error('记录失败任务时出错:', recordError)
    }
  }

  // 记录性能指标
  private async recordPerformanceMetrics(metrics: {
    batchSize: number
    processingTime: number
    queueLength: number
  }): Promise<void> {
    try {
      const metricsKey = `${this.cachePrefix}metrics:${new Date().toISOString().split('T')[0]}`

      // 获取当日已有指标
      const existingMetrics = await redis.get(metricsKey)
      const dayMetrics = existingMetrics ? JSON.parse(existingMetrics) : {
        totalBatches: 0,
        totalTasks: 0,
        totalProcessingTime: 0,
        averageProcessingTime: 0,
        maxQueueLength: 0
      }

      // 更新指标
      dayMetrics.totalBatches++
      dayMetrics.totalTasks += metrics.batchSize
      dayMetrics.totalProcessingTime += metrics.processingTime
      dayMetrics.averageProcessingTime = dayMetrics.totalProcessingTime / dayMetrics.totalBatches
      dayMetrics.maxQueueLength = Math.max(dayMetrics.maxQueueLength, metrics.queueLength)

      // 保存指标（保留30天）
      // **索引更新指标缓存策略 - 30天TTL**
      // 原因：历史性能指标用于长期趋势分析，需要长期保存
      // - 30天：足够覆盖月度性能分析需求
      // - 历史数据：指标数据具有历史价值，不会频繁变化
      // - 适用场景：性能趋势分析、容量规划、问题追踪
      await redis.setex(metricsKey, 30 * 24 * 60 * 60, JSON.stringify(dayMetrics))
    } catch (error) {
      console.error('记录性能指标失败:', error)
    }
  }

  // 获取队列状态
  async getQueueStatus(): Promise<{
    queueLength: number
    processing: boolean
    upcomingTasks: IndexUpdateTask[]
  }> {
    return {
      queueLength: this.updateQueue.length,
      processing: this.processing,
      upcomingTasks: this.updateQueue.slice(0, 10) // 返回前10个任务
    }
  }

  // 获取性能指标
  async getPerformanceMetrics(days: number = 7): Promise<any[]> {
    try {
      const metrics = []
      const now = new Date()

      for (let i = 0; i < days; i++) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const dateKey = date.toISOString().split('T')[0]
        const metricsKey = `${this.cachePrefix}metrics:${dateKey}`

        const dayMetrics = await redis.get(metricsKey)
        if (dayMetrics) {
          metrics.push({
            date: dateKey,
            ...JSON.parse(dayMetrics)
          })
        }
      }

      return metrics.reverse() // 按时间正序返回
    } catch (error) {
      console.error('获取性能指标失败:', error)
      return []
    }
  }

  // 工具方法：数组分块
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  // 清空队列（紧急情况下使用）
  async clearQueue(): Promise<void> {
    this.updateQueue = []
    console.log('索引更新队列已清空')
  }
}

export const searchIndexUpdateService = new SearchIndexUpdateService()