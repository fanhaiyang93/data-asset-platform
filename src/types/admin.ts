/**
 * 管理后台相关的TypeScript类型定义
 */
import { UserRole } from '@prisma/client'

// 管理员权限角色
export type AdminRole = 'ASSET_MANAGER' | 'SYSTEM_ADMIN'

// 菜单项接口
export interface AdminMenuItem {
  id: string
  label: string
  path: string
  icon?: string
  roles: AdminRole[]
  children?: AdminMenuItem[]
  badge?: string
  disabled?: boolean
}

// 导航菜单配置
export interface AdminMenuConfig {
  [key: string]: AdminMenuItem[]
}

// 管理后台面包屑项
export interface BreadcrumbItem {
  label: string
  path?: string
}

// 快捷操作配置
export interface QuickAction {
  id: string
  label: string
  icon: string
  path: string
  roles: AdminRole[]
  description?: string
}

// 系统统计数据
export interface SystemStats {
  totalAssets: number
  totalUsers: number
  pendingApplications: number
  recentActivities: ActivityItem[]
}

// 活动记录项
export interface ActivityItem {
  id: string
  type: 'asset' | 'user' | 'application' | 'system'
  title: string
  description: string
  timestamp: Date
  user?: {
    name: string
    avatar?: string
  }
}

// 管理后台布局配置
export interface AdminLayoutConfig {
  sidebarCollapsed: boolean
  theme: 'light' | 'dark'
  compactMode: boolean
}

// 通知消息类型
export type NotificationType = 'success' | 'error' | 'warning' | 'info'

// 通知消息接口
export interface NotificationMessage {
  id: string
  type: NotificationType
  title: string
  message: string
  duration?: number
  persistent?: boolean
  actions?: {
    label: string
    action: () => void
  }[]
}

// 操作确认配置
export interface ConfirmDialogConfig {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
}

// 表格操作配置
export interface TableAction<T = any> {
  id: string
  label: string
  icon?: string
  variant?: 'default' | 'destructive'
  roles?: AdminRole[]
  disabled?: (item: T) => boolean
  visible?: (item: T) => boolean
  onClick: (item: T) => void
}

// 批量操作配置
export interface BatchAction<T = any> {
  id: string
  label: string
  icon?: string
  variant?: 'default' | 'destructive'
  roles?: AdminRole[]
  disabled?: (items: T[]) => boolean
  onClick: (items: T[]) => void
}