'use client'

import React from 'react'
import { PermissionGuard, PermissionGuardProps } from './PermissionGuard'
import ErrorBoundary, { ErrorBoundaryProps } from './ErrorBoundary'
import { User } from '@/lib/permissions'

interface SecureComponentWrapperProps {
  // 权限检查相关props
  user?: User
  resource: string
  action: string
  conditions?: Record<string, any>
  assetOwnerId?: string
  permissionFallback?: React.ReactNode

  // 错误边界相关props
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
  showErrorDetails?: boolean
  allowRetry?: boolean

  // 其他props
  children: React.ReactNode
  className?: string

  // 可选的加载状态
  loading?: boolean
  loadingComponent?: React.ReactNode
}

/**
 * 安全组件包装器
 * 集成权限检查和错误边界功能
 */
export function SecureComponentWrapper({
  user,
  resource,
  action,
  conditions,
  assetOwnerId,
  permissionFallback,
  errorBoundaryProps,
  showErrorDetails = process.env.NODE_ENV === 'development',
  allowRetry = true,
  children,
  className,
  loading = false,
  loadingComponent
}: SecureComponentWrapperProps) {
  // 默认加载组件
  const defaultLoadingComponent = (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <span className="ml-3 text-muted-foreground">加载中...</span>
    </div>
  )

  if (loading) {
    return <>{loadingComponent || defaultLoadingComponent}</>
  }

  return (
    <ErrorBoundary
      showErrorDetails={showErrorDetails}
      allowRetry={allowRetry}
      className={className}
      {...errorBoundaryProps}
    >
      <PermissionGuard
        user={user}
        resource={resource}
        action={action}
        conditions={conditions}
        assetOwnerId={assetOwnerId}
        fallback={permissionFallback}
      >
        {children}
      </PermissionGuard>
    </ErrorBoundary>
  )
}

/**
 * 高阶组件：为现有组件添加安全包装
 */
export function withSecureWrapper<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  securityConfig: {
    resource: string
    action: string
    conditions?: Record<string, any>
    showErrorDetails?: boolean
    allowRetry?: boolean
  }
) {
  const SecureWrappedComponent = (
    props: P & {
      user?: User
      assetOwnerId?: string
      permissionFallback?: React.ReactNode
      loading?: boolean
    }
  ) => {
    const {
      user,
      assetOwnerId,
      permissionFallback,
      loading,
      ...componentProps
    } = props

    return (
      <SecureComponentWrapper
        user={user}
        resource={securityConfig.resource}
        action={securityConfig.action}
        conditions={securityConfig.conditions}
        assetOwnerId={assetOwnerId}
        permissionFallback={permissionFallback}
        showErrorDetails={securityConfig.showErrorDetails}
        allowRetry={securityConfig.allowRetry}
        loading={loading}
      >
        <WrappedComponent {...(componentProps as P)} />
      </SecureComponentWrapper>
    )
  }

  SecureWrappedComponent.displayName = `withSecureWrapper(${
    WrappedComponent.displayName || WrappedComponent.name
  })`

  return SecureWrappedComponent
}

/**
 * React Hook: 用于组件内部的权限检查
 */
export function useSecurityContext() {
  const [user, setUser] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  // 这里可以集成实际的用户认证逻辑
  React.useEffect(() => {
    const loadUserContext = async () => {
      try {
        setLoading(true)
        // 模拟获取用户信息
        // const userInfo = await authService.getCurrentUser()
        // setUser(userInfo)

        // 临时使用模拟数据
        const mockUser: User = {
          id: 'user-123',
          email: 'user@example.com',
          name: '张三',
          roles: [
            {
              id: 'editor',
              name: 'editor',
              permissions: [
                { id: 'edit-asset', resource: 'asset', action: 'edit' },
                { id: 'view-asset', resource: 'asset', action: 'view' }
              ]
            }
          ],
          permissions: []
        }
        setUser(mockUser)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('加载用户信息失败'))
      } finally {
        setLoading(false)
      }
    }

    loadUserContext()
  }, [])

  return {
    user,
    loading,
    error,
    setUser
  }
}

export default SecureComponentWrapper