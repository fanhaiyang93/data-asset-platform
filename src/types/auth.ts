/**
 * 认证和授权相关的TypeScript类型定义
 */
import { UserRole } from '@prisma/client'

// 用户基本信息接口
export interface User {
  id: string
  username: string
  email: string
  name: string | null
  department: string | null
  role: UserRole
  createdAt: Date
  lastLoginAt: Date | null
}

// 用户权限信息接口
export interface UserPermissions {
  [resource: string]: {
    read?: boolean
    write?: boolean
    delete?: boolean
    manage?: boolean
  }
}

// 用户会话信息接口
export interface UserSession {
  id: string
  username: string
  email: string
  name: string | null
  department: string | null
  role: UserRole
  permissions: UserPermissions
}

// 权限检查结果接口
export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
}

// 角色类型联合
export type AllowedRoles = UserRole[]

// 路由守卫状态接口
export interface RouteGuardState {
  loading: boolean
  hasPermission: boolean
  user: UserSession | null
  error: string | null
}

// 权限检查参数接口
export interface PermissionCheckParams {
  resource: string
  action: string
  userId?: string
}