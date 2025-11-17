/**
 * 同步调度器
 * 管理和调度同步任务,支持优先级和并发控制
 */

import { StatusSyncService } from './statusSyncService'

/**
 * 同步任务
 */
export interface SyncTask {
  id: string
  applicationIds: string[]
  priority: 'low' | 'medium' | 'high'
  createdAt: Date
  scheduledAt?: Date
  retryCount?: number
}

/**
 * 任务状态
 */
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * 任务执行结果
 */
export interface TaskResult {
  taskId: string
  status: TaskStatus
  startTime: Date
  endTime: Date
  duration: number
  successful: number
  failed: number
  error?: string
}

/**
 * 调度器配置
 */
export interface SchedulerConfig {
  maxConcurrentTasks?: number // 最大并发任务数,默认5
  taskTimeout?: number // 任务超时时间(毫秒),默认60秒
  retryDelay?: number // 重试延迟(毫秒),默认5秒
  maxRetries?: number // 最大重试次数,默认3
}

/**
 * 同步调度器类
 */
export class SyncScheduler {
  private syncService: StatusSyncService
  private config: SchedulerConfig
  private taskQueue: SyncTask[] = []
  private runningTasks: Map<string, SyncTask> = new Map()
  private taskResults: Map<string, TaskResult> = new Map()
  private isRunning: boolean = false

  constructor(
    syncService: StatusSyncService,
    config: SchedulerConfig = {}
  ) {
    this.syncService = syncService

    this.config = {
      maxConcurrentTasks: 5,
      taskTimeout: 60000,
      retryDelay: 5000,
      maxRetries: 3,
      ...config
    }
  }

  /**
   * 添加同步任务
   */
  addTask(task: Omit<SyncTask, 'id' | 'createdAt'>): string {
    const taskId = this.generateTaskId()

    const fullTask: SyncTask = {
      ...task,
      id: taskId,
      createdAt: new Date(),
      retryCount: 0
    }

    // 按优先级插入队列
    this.insertTaskByPriority(fullTask)

    console.log(`[SyncScheduler] 任务已添加: ${taskId}, 优先级: ${task.priority}`)

    // 如果调度器正在运行,尝试执行任务
    if (this.isRunning) {
      this.processNextTask()
    }

    return taskId
  }

  /**
   * 启动调度器
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[SyncScheduler] 调度器已在运行')
      return
    }

    this.isRunning = true
    console.log('[SyncScheduler] 调度器已启动')

    // 处理队列中的任务
    this.processQueue()
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false
    console.log('[SyncScheduler] 调度器已停止')

    // 等待运行中的任务完成
    this.waitForRunningTasks()
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    // 从队列中移除
    const queueIndex = this.taskQueue.findIndex(t => t.id === taskId)
    if (queueIndex !== -1) {
      this.taskQueue.splice(queueIndex, 1)
      this.recordTaskResult(taskId, TaskStatus.CANCELLED)
      console.log(`[SyncScheduler] 任务已取消: ${taskId}`)
      return true
    }

    // 检查是否正在运行
    if (this.runningTasks.has(taskId)) {
      console.warn(`[SyncScheduler] 任务正在运行,无法取消: ${taskId}`)
      return false
    }

    return false
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(taskId: string): TaskStatus {
    if (this.runningTasks.has(taskId)) {
      return TaskStatus.RUNNING
    }

    const result = this.taskResults.get(taskId)
    if (result) {
      return result.status
    }

    const inQueue = this.taskQueue.some(t => t.id === taskId)
    return inQueue ? TaskStatus.PENDING : TaskStatus.FAILED
  }

  /**
   * 获取任务结果
   */
  getTaskResult(taskId: string): TaskResult | undefined {
    return this.taskResults.get(taskId)
  }

  /**
   * 获取队列统计
   */
  getQueueStats(): {
    pending: number
    running: number
    completed: number
    failed: number
  } {
    const completed = Array.from(this.taskResults.values()).filter(
      r => r.status === TaskStatus.COMPLETED
    ).length

    const failed = Array.from(this.taskResults.values()).filter(
      r => r.status === TaskStatus.FAILED
    ).length

    return {
      pending: this.taskQueue.length,
      running: this.runningTasks.size,
      completed,
      failed
    }
  }

  /**
   * 处理任务队列
   */
  private async processQueue(): Promise<void> {
    while (this.isRunning) {
      // 检查是否达到并发限制
      if (this.runningTasks.size >= (this.config.maxConcurrentTasks || 5)) {
        await this.sleep(1000)
        continue
      }

      // 获取下一个任务
      const task = this.taskQueue.shift()
      if (!task) {
        await this.sleep(1000)
        continue
      }

      // 执行任务
      this.executeTask(task)
    }
  }

  /**
   * 处理下一个任务
   */
  private processNextTask(): void {
    if (this.runningTasks.size >= (this.config.maxConcurrentTasks || 5)) {
      return
    }

    const task = this.taskQueue.shift()
    if (task) {
      this.executeTask(task)
    }
  }

  /**
   * 执行任务
   */
  private async executeTask(task: SyncTask): Promise<void> {
    const startTime = new Date()
    this.runningTasks.set(task.id, task)

    console.log(`[SyncScheduler] 开始执行任务: ${task.id}`)

    try {
      // 执行同步
      const result = await Promise.race([
        this.syncService.performFullSync(task.applicationIds),
        this.createTimeout(this.config.taskTimeout || 60000)
      ])

      // 记录成功结果
      this.recordTaskResult(task.id, TaskStatus.COMPLETED, startTime, result)

      console.log(`[SyncScheduler] 任务执行成功: ${task.id}`)

    } catch (error) {
      console.error(`[SyncScheduler] 任务执行失败: ${task.id}`, error)

      // 检查是否需要重试
      if (this.shouldRetry(task)) {
        await this.retryTask(task)
      } else {
        this.recordTaskResult(
          task.id,
          TaskStatus.FAILED,
          startTime,
          undefined,
          error instanceof Error ? error.message : '执行失败'
        )
      }
    } finally {
      this.runningTasks.delete(task.id)

      // 处理下一个任务
      if (this.isRunning) {
        this.processNextTask()
      }
    }
  }

  /**
   * 检查是否应该重试
   */
  private shouldRetry(task: SyncTask): boolean {
    const maxRetries = this.config.maxRetries || 3
    return (task.retryCount || 0) < maxRetries
  }

  /**
   * 重试任务
   */
  private async retryTask(task: SyncTask): Promise<void> {
    const retryCount = (task.retryCount || 0) + 1
    const delay = this.config.retryDelay || 5000

    console.log(`[SyncScheduler] 任务将在 ${delay}ms 后重试(${retryCount}/${this.config.maxRetries}): ${task.id}`)

    await this.sleep(delay)

    const retryTask: SyncTask = {
      ...task,
      retryCount
    }

    // 重新加入队列
    this.insertTaskByPriority(retryTask)

    if (this.isRunning) {
      this.processNextTask()
    }
  }

  /**
   * 按优先级插入任务
   */
  private insertTaskByPriority(task: SyncTask): void {
    const priorityOrder = { high: 0, medium: 1, low: 2 }

    let insertIndex = this.taskQueue.length
    for (let i = 0; i < this.taskQueue.length; i++) {
      if (priorityOrder[task.priority] < priorityOrder[this.taskQueue[i].priority]) {
        insertIndex = i
        break
      }
    }

    this.taskQueue.splice(insertIndex, 0, task)
  }

  /**
   * 记录任务结果
   */
  private recordTaskResult(
    taskId: string,
    status: TaskStatus,
    startTime: Date = new Date(),
    syncResult?: any,
    error?: string
  ): void {
    const endTime = new Date()

    const result: TaskResult = {
      taskId,
      status,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      successful: syncResult?.successful || 0,
      failed: syncResult?.failed || 0,
      error
    }

    this.taskResults.set(taskId, result)
  }

  /**
   * 等待运行中的任务完成
   */
  private async waitForRunningTasks(): Promise<void> {
    console.log(`[SyncScheduler] 等待 ${this.runningTasks.size} 个运行中的任务完成...`)

    while (this.runningTasks.size > 0) {
      await this.sleep(1000)
    }

    console.log('[SyncScheduler] 所有任务已完成')
  }

  /**
   * 创建超时Promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`任务超时: ${ms}ms`)), ms)
    })
  }

  /**
   * 生成任务ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 清除历史结果
   */
  clearHistory(): void {
    this.taskResults.clear()
    console.log('[SyncScheduler] 历史记录已清除')
  }

  /**
   * 获取所有历史结果
   */
  getAllResults(): TaskResult[] {
    return Array.from(this.taskResults.values())
  }
}

/**
 * 创建同步调度器实例
 */
export function createSyncScheduler(
  syncService: StatusSyncService,
  config?: SchedulerConfig
): SyncScheduler {
  return new SyncScheduler(syncService, config)
}
