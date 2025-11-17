'use client'

import React from 'react'
import {
  PermissionGuardProps,
  checkPermission,
  getPermissionErrorMessage
} from '@/lib/permissions'
import { AlertCircle, Lock, Shield } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

/**
 * 权限守卫组件
 * 根据用户权限显示或隐藏内容
 */
export function PermissionGuard({
  user,
  resource,
  action,
  conditions,
  assetOwnerId,
  fallback,
  children
}: PermissionGuardProps) {
  // 检查基本权限
  const hasBasicPermission = checkPermission(user || null, resource, action, conditions)

  // 如果有资产所有者ID，也检查所有权
  const hasOwnershipPermission = assetOwnerId && user ? user.id === assetOwnerId : false

  // 最终权限判断
  const hasPermission = hasBasicPermission || hasOwnershipPermission

  if (!hasPermission) {
    if (fallback) {
      return <>{fallback}</>
    }

    // 默认的权限拒绝UI
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                权限不足
              </p>
              <p className="text-xs text-amber-700 mt-1">
                {getPermissionErrorMessage(resource, action)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return <>{children}</>
}

/**
 * 内联权限检查组件
 * 用于在组件内部进行权限检查而不渲染额外UI
 */
export function InlinePermissionCheck({
  user,
  resource,
  action,
  conditions,
  assetOwnerId,
  children,
  fallback = null
}: PermissionGuardProps) {
  const hasBasicPermission = checkPermission(user || null, resource, action, conditions)
  const hasOwnershipPermission = assetOwnerId && user ? user.id === assetOwnerId : false
  const hasPermission = hasBasicPermission || hasOwnershipPermission

  return hasPermission ? <>{children}</> : <>{fallback}</>
}

/**
 * 条件权限提示组件
 */
interface ConditionalPermissionMessageProps {
  user?: any
  resource: string
  action: string
  conditions?: Record<string, any>
  assetOwnerId?: string
  showWhenDenied?: boolean
  showWhenGranted?: boolean
  deniedMessage?: string
  grantedMessage?: string
  className?: string
}

export function ConditionalPermissionMessage({
  user,
  resource,
  action,
  conditions,
  assetOwnerId,
  showWhenDenied = true,
  showWhenGranted = false,
  deniedMessage,
  grantedMessage,
  className
}: ConditionalPermissionMessageProps) {
  const hasBasicPermission = checkPermission(user || null, resource, action, conditions)
  const hasOwnershipPermission = assetOwnerId && user ? user.id === assetOwnerId : false
  const hasPermission = hasBasicPermission || hasOwnershipPermission

  if (!hasPermission && showWhenDenied) {
    return (
      <div className={`flex items-center gap-2 text-sm text-amber-700 ${className || ''}`}>
        <AlertCircle className="w-4 h-4" />
        <span>{deniedMessage || getPermissionErrorMessage(resource, action)}</span>
      </div>
    )
  }

  if (hasPermission && showWhenGranted && grantedMessage) {
    return (
      <div className={`flex items-center gap-2 text-sm text-green-700 ${className || ''}`}>
        <Shield className="w-4 h-4" />
        <span>{grantedMessage}</span>
      </div>
    )
  }

  return null
}

export default PermissionGuard