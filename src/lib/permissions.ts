/**
 * 权限检查和用户角色管理工具
 */

export interface User {
  id: string
  email: string
  name: string
  roles: UserRole[]
  permissions: Permission[]
}

export interface UserRole {
  id: string
  name: string
  permissions: Permission[]
}

export interface Permission {
  id: string
  resource: string
  action: string
  conditions?: Record<string, any>
}

export interface AssetPermissions {
  canView: boolean
  canEdit: boolean
  canDelete: boolean
  canManageMetadata: boolean
  canUploadFiles: boolean
  canManageTags: boolean
  canViewHistory: boolean
  canRestoreVersion: boolean
}

/**
 * 权限检查器类
 */
export class PermissionChecker {
  private user: User | null = null

  constructor(user?: User) {
    this.user = user || null
  }

  /**
   * 设置当前用户
   */
  setUser(user: User): void {
    this.user = user
  }

  /**
   * 检查用户是否有特定权限
   */
  hasPermission(resource: string, action: string, conditions?: Record<string, any>): boolean {
    if (!this.user) return false

    // 检查是否是管理员（管理员有所有权限）
    if (this.hasRole('admin')) {
      return true
    }

    // 检查直接权限
    const directPermission = this.user.permissions.find(
      permission => permission.resource === resource && (permission.action === action || permission.action === '*')
    )

    if (directPermission && this.matchesConditions(directPermission.conditions, conditions)) {
      return true
    }

    // 检查角色权限
    for (const role of this.user.roles) {
      const rolePermission = role.permissions.find(
        permission => permission.resource === resource && (permission.action === action || permission.action === '*')
      )

      if (rolePermission && this.matchesConditions(rolePermission.conditions, conditions)) {
        return true
      }
    }

    return false
  }

  /**
   * 检查用户是否有某个角色
   */
  hasRole(roleName: string): boolean {
    if (!this.user) return false
    return this.user.roles.some(role => role.name === roleName)
  }

  /**
   * 检查用户是否是资产所有者
   */
  isAssetOwner(assetOwnerId: string): boolean {
    if (!this.user) return false
    return this.user.id === assetOwnerId
  }

  /**
   * 获取资产相关权限
   */
  getAssetPermissions(assetOwnerId?: string): AssetPermissions {
    const isOwner = assetOwnerId ? this.isAssetOwner(assetOwnerId) : false
    const isAdmin = this.hasRole('admin')
    const isEditor = this.hasRole('editor')

    return {
      canView: this.hasPermission('asset', 'view') || isOwner || isAdmin || isEditor,
      canEdit: this.hasPermission('asset', 'edit') || isOwner || isAdmin,
      canDelete: this.hasPermission('asset', 'delete') || isOwner || isAdmin,
      canManageMetadata: this.hasPermission('asset', 'manage_metadata') || isOwner || isAdmin,
      canUploadFiles: this.hasPermission('asset', 'upload_files') || isOwner || isAdmin || isEditor,
      canManageTags: this.hasPermission('asset', 'manage_tags') || isOwner || isAdmin || isEditor,
      canViewHistory: this.hasPermission('asset', 'view_history') || isOwner || isAdmin,
      canRestoreVersion: this.hasPermission('asset', 'restore_version') || isOwner || isAdmin
    }
  }

  /**
   * 检查条件是否匹配
   */
  private matchesConditions(
    permissionConditions?: Record<string, any>,
    checkConditions?: Record<string, any>
  ): boolean {
    if (!permissionConditions && !checkConditions) return true
    if (!permissionConditions) return true
    if (!checkConditions) return false

    for (const [key, value] of Object.entries(permissionConditions)) {
      if (checkConditions[key] !== value) {
        return false
      }
    }

    return true
  }
}

/**
 * React Hook for permission checking
 */
export function usePermissions(user?: User) {
  const checker = new PermissionChecker(user)

  return {
    hasPermission: (resource: string, action: string, conditions?: Record<string, any>) =>
      checker.hasPermission(resource, action, conditions),
    hasRole: (roleName: string) => checker.hasRole(roleName),
    isAssetOwner: (assetOwnerId: string) => checker.isAssetOwner(assetOwnerId),
    getAssetPermissions: (assetOwnerId?: string) => checker.getAssetPermissions(assetOwnerId),
    canEditAsset: (assetOwnerId?: string) => {
      const permissions = checker.getAssetPermissions(assetOwnerId)
      return permissions.canEdit && permissions.canManageMetadata
    },
    canManageFiles: (assetOwnerId?: string) => {
      const permissions = checker.getAssetPermissions(assetOwnerId)
      return permissions.canUploadFiles
    },
    canManageTags: (assetOwnerId?: string) => {
      const permissions = checker.getAssetPermissions(assetOwnerId)
      return permissions.canManageTags
    }
  }
}

/**
 * 权限守卫组件 Props
 */
export interface PermissionGuardProps {
  user?: User
  resource: string
  action: string
  conditions?: Record<string, any>
  assetOwnerId?: string
  fallback?: React.ReactNode
  children: React.ReactNode
}

/**
 * 错误边界状态
 */
export interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: any
}

/**
 * 权限错误类
 */
export class PermissionError extends Error {
  constructor(message: string, public resource: string, public action: string) {
    super(message)
    this.name = 'PermissionError'
  }
}

/**
 * 权限检查工具函数
 */
export const checkPermission = (
  user: User | null,
  resource: string,
  action: string,
  conditions?: Record<string, any>
): boolean => {
  const checker = new PermissionChecker(user || undefined)
  return checker.hasPermission(resource, action, conditions)
}

/**
 * 断言权限 - 如果没有权限则抛出错误
 */
export const assertPermission = (
  user: User | null,
  resource: string,
  action: string,
  conditions?: Record<string, any>
): void => {
  if (!checkPermission(user, resource, action, conditions)) {
    throw new PermissionError(
      `没有权限执行操作: ${action} on ${resource}`,
      resource,
      action
    )
  }
}

/**
 * 获取用户友好的权限错误消息
 */
export const getPermissionErrorMessage = (resource: string, action: string): string => {
  const actions: Record<string, string> = {
    view: '查看',
    edit: '编辑',
    delete: '删除',
    create: '创建',
    manage_metadata: '管理元数据',
    upload_files: '上传文件',
    manage_tags: '管理标签',
    view_history: '查看历史',
    restore_version: '恢复版本'
  }

  const resources: Record<string, string> = {
    asset: '资产',
    metadata: '元数据',
    file: '文件',
    tag: '标签'
  }

  const actionText = actions[action] || action
  const resourceText = resources[resource] || resource

  return `您没有权限${actionText}${resourceText}，请联系管理员`
}