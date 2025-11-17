'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { UserRole } from '@prisma/client'
import { trpc } from '@/lib/trpc-client'
import { UserSession, RouteGuardState } from '@/types/auth'

interface RouteGuardProps {
  children: React.ReactNode
  resource?: string
  action?: string
  roles?: UserRole[]
  fallback?: React.ReactNode
  redirectTo?: string
}

/**
 * RouteGuard 权限守卫组件
 * 在客户端进行细粒度权限控制
 */
export function RouteGuard({
  children,
  resource,
  action,
  roles = [],
  fallback = <div>权限验证中...</div>,
  redirectTo
}: RouteGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [permissionState, setPermissionState] = useState<RouteGuardState>({
    loading: true,
    hasPermission: false,
    user: null,
    error: null
  })

  // 使用useMemo稳定roles数组引用
  const stableRoles = useMemo(() => roles, [JSON.stringify(roles)])

  // 获取当前用户信息
  const { data: user, isLoading: userLoading, error: userError } = trpc.auth.getMe.useQuery(
    undefined,
    {
      retry: false,
      refetchOnWindowFocus: false
    }
  )

  // 权限检查查询
  const { data: permissionResult, isLoading: permissionLoading, error: permissionError } =
    trpc.auth.checkPermission.useQuery(
      {
        resource: resource || '',
        action: action || ''
      },
      {
        enabled: !!user && !!resource && !!action,
        retry: false,
        refetchOnWindowFocus: false
      }
    )


  // 权限检查逻辑 - 使用useEffect直接处理避免依赖循环
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        // 如果没有指定权限要求，直接允许访问
        if (!resource && !action && stableRoles.length === 0) {
          setPermissionState({
            loading: false,
            hasPermission: true,
            user: user || null,
            error: null
          })
          return
        }

        // 等待用户信息加载
        if (userLoading) {
          setPermissionState(prev => ({ ...prev, loading: true }))
          return
        }

        // 用户认证失败
        if (userError || !user) {
          setPermissionState({
            loading: false,
            hasPermission: false,
            user: null,
            error: '用户未认证'
          })

          const redirectUrl = redirectTo
            ? `${redirectTo}?redirect=${encodeURIComponent(pathname)}`
            : `/auth/login?redirect=${encodeURIComponent(pathname)}`

          router.push(redirectUrl)
          return
        }

        // 基于角色的检查
        if (stableRoles.length > 0) {
          const hasRequiredRole = stableRoles.includes(user.role)
          if (!hasRequiredRole) {
            setPermissionState({
              loading: false,
              hasPermission: false,
              user,
              error: `权限不足，需要角色: ${stableRoles.join(', ')}`
            })

            const redirectUrl = redirectTo
              ? redirectTo
              : `/unauthorized?required=${stableRoles.join(',')}&current=${user.role}`

            router.push(redirectUrl)
            return
          }
        }

        // 基于资源和操作的检查
        if (resource && action) {
          if (permissionLoading) {
            setPermissionState(prev => ({ ...prev, loading: true }))
            return
          }

          if (permissionError) {
            setPermissionState({
              loading: false,
              hasPermission: false,
              user,
              error: '权限检查失败'
            })
            return
          }

          const hasPermission = permissionResult?.allowed || false
          if (!hasPermission) {
            setPermissionState({
              loading: false,
              hasPermission: false,
              user,
              error: `权限不足，无法执行 ${resource} 的 ${action} 操作`
            })

            const redirectUrl = redirectTo
              ? redirectTo
              : `/unauthorized?resource=${resource}&action=${action}`

            router.push(redirectUrl)
            return
          }
        }

        // 权限检查通过
        setPermissionState({
          loading: false,
          hasPermission: true,
          user,
          error: null
        })

      } catch (error) {
        console.error('权限检查失败:', error)
        setPermissionState({
          loading: false,
          hasPermission: false,
          user: user || null,
          error: '权限检查异常'
        })
      }
    }

    checkPermissions()
  }, [
    user,
    userLoading,
    userError,
    permissionResult,
    permissionLoading,
    permissionError,
    resource,
    action,
    stableRoles,
    pathname,
    redirectTo,
    router
  ])

  // 显示加载状态
  if (permissionState.loading) {
    return <>{fallback}</>
  }

  // 权限检查失败
  if (!permissionState.hasPermission) {
    if (redirectTo || (resource && action) || roles.length > 0) {
      // 如果有重定向逻辑或明确的权限要求，显示fallback直到重定向完成
      return <>{fallback}</>
    } else {
      // 否则显示错误信息
      return (
        <div className="flex flex-col items-center justify-center min-h-64 p-8">
          <div className="text-red-600 mb-4">⚠️ 权限不足</div>
          <div className="text-gray-600 text-sm">{permissionState.error}</div>
        </div>
      )
    }
  }

  // 权限检查通过，渲染子组件
  return <>{children}</>
}

/**
 * 页面级权限守卫高阶组件
 */
export function withPageGuard(
  Component: React.ComponentType<any>,
  guardConfig: Omit<RouteGuardProps, 'children'>
) {
  return function GuardedComponent(props: any) {
    return (
      <RouteGuard {...guardConfig}>
        <Component {...props} />
      </RouteGuard>
    )
  }
}

/**
 * Hook: 获取当前用户权限信息
 */
export function useUserPermissions() {
  const { data: user, isLoading, error } = trpc.auth.getMe.useQuery(
    undefined,
    {
      retry: false,
      refetchOnWindowFocus: false
    }
  )

  const { data: permissions, isLoading: permissionsLoading } = trpc.auth.getUserPermissions.useQuery(
    undefined,
    {
      enabled: !!user,
      retry: false,
      refetchOnWindowFocus: false
    }
  )

  return {
    user: user as UserSession | undefined,
    permissions,
    isLoading: isLoading || permissionsLoading,
    error,
    hasRole: (role: UserRole): boolean => user?.role === role,
    hasPermission: (resource: string, action: string): boolean => {
      return permissions?.[resource]?.[action] === true
    }
  }
}

/**
 * Hook: 检查特定权限
 */
export function usePermissionCheck(resource: string, action: string) {
  const { data: result, isLoading, error } = trpc.auth.checkPermission.useQuery(
    { resource, action },
    {
      retry: false,
      refetchOnWindowFocus: false
    }
  )

  return {
    hasPermission: result?.allowed || false,
    isLoading,
    error
  }
}