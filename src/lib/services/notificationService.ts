/**
 * 管理后台通知服务
 * 提供统一的操作反馈和错误提示机制
 */
import { NotificationMessage, NotificationType } from '@/types/admin'

class NotificationServiceClass {
  private notifications: NotificationMessage[] = []
  private listeners: ((notifications: NotificationMessage[]) => void)[] = []
  private idCounter = 0

  // 订阅通知变化
  subscribe(listener: (notifications: NotificationMessage[]) => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  // 通知所有监听器
  private notify() {
    this.listeners.forEach(listener => listener([...this.notifications]))
  }

  // 添加通知
  private addNotification(notification: Omit<NotificationMessage, 'id'>) {
    const id = String(++this.idCounter)
    const newNotification: NotificationMessage = {
      id,
      ...notification
    }

    this.notifications.push(newNotification)
    this.notify()

    // 自动移除通知（除非设置为持久）
    if (!notification.persistent) {
      const duration = notification.duration || this.getDefaultDuration(notification.type)
      setTimeout(() => {
        this.remove(id)
      }, duration)
    }

    return id
  }

  // 获取默认持续时间
  private getDefaultDuration(type: NotificationType): number {
    switch (type) {
      case 'success':
        return 3000
      case 'info':
        return 4000
      case 'warning':
        return 5000
      case 'error':
        return 6000
      default:
        return 4000
    }
  }

  // 成功通知
  success(title: string, message?: string, options?: Partial<NotificationMessage>) {
    return this.addNotification({
      type: 'success',
      title,
      message: message || '',
      ...options
    })
  }

  // 错误通知
  error(title: string, message?: string, options?: Partial<NotificationMessage>) {
    return this.addNotification({
      type: 'error',
      title,
      message: message || '',
      persistent: true, // 错误消息默认持久化
      ...options
    })
  }

  // 警告通知
  warning(title: string, message?: string, options?: Partial<NotificationMessage>) {
    return this.addNotification({
      type: 'warning',
      title,
      message: message || '',
      ...options
    })
  }

  // 信息通知
  info(title: string, message?: string, options?: Partial<NotificationMessage>) {
    return this.addNotification({
      type: 'info',
      title,
      message: message || '',
      ...options
    })
  }

  // 操作成功通知
  operationSuccess(operation: string, details?: string) {
    return this.success(
      '操作成功',
      `${operation}${details ? `：${details}` : ''}`,
      { duration: 3000 }
    )
  }

  // 操作失败通知
  operationError(operation: string, error: string | Error) {
    const errorMessage = error instanceof Error ? error.message : error
    return this.error(
      '操作失败',
      `${operation}失败：${errorMessage}`,
      { persistent: true }
    )
  }

  // 移除通知
  remove(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id)
    this.notify()
  }

  // 清除所有通知
  clear() {
    this.notifications = []
    this.notify()
  }

  // 获取当前通知列表
  getNotifications(): NotificationMessage[] {
    return [...this.notifications]
  }
}

// 导出单例实例
export const NotificationService = new NotificationServiceClass()

// 便捷的全局函数
export const notify = {
  success: NotificationService.success.bind(NotificationService),
  error: NotificationService.error.bind(NotificationService),
  warning: NotificationService.warning.bind(NotificationService),
  info: NotificationService.info.bind(NotificationService),
  operationSuccess: NotificationService.operationSuccess.bind(NotificationService),
  operationError: NotificationService.operationError.bind(NotificationService)
}

export default NotificationService