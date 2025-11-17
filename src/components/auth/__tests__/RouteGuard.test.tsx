/**
 * RouteGuard 权限守卫组件测试
 * 测试前端路由权限控制功能
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { RouteGuard, useUserPermissions, usePermissionCheck } from '../RouteGuard'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: () => '/admin'
}))

// Mock tRPC client
jest.mock('@/lib/trpc-client', () => ({
  trpc: {
    auth: {
      getMe: {
        useQuery: jest.fn()
      },
      checkPermission: {
        useQuery: jest.fn()
      },
      getUserPermissions: {
        useQuery: jest.fn()
      }
    }
  }
}))

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  refresh: jest.fn()
}

const mockTrpc = require('@/lib/trpc-client').trpc

describe('RouteGuard 组件测试', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
  })

  describe('基本功能测试', () => {
    test('无权限要求时应该直接渲染子组件', async () => {
      mockTrpc.auth.getMe.useQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: null
      })

      mockTrpc.auth.checkPermission.useQuery.mockReturnValue({
        data: { allowed: true },
        isLoading: false,
        error: null
      })

      render(
        <RouteGuard>
          <div>Test Content</div>
        </RouteGuard>
      )

      expect(screen.getByText('Test Content')).toBeInTheDocument()
    })

    test('加载中时应该显示fallback', () => {
      mockTrpc.auth.getMe.useQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null
      })

      mockTrpc.auth.checkPermission.useQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null
      })

      render(
        <RouteGuard resource="admin" action="read">
          <div>Test Content</div>
        </RouteGuard>
      )

      expect(screen.getByText('权限验证中...')).toBeInTheDocument()
    })

    test('自定义fallback应该正确显示', () => {
      mockTrpc.auth.getMe.useQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null
      })

      mockTrpc.auth.checkPermission.useQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null
      })

      render(
        <RouteGuard
          resource="admin"
          action="read"
          fallback={<div>Custom Loading</div>}
        >
          <div>Test Content</div>
        </RouteGuard>
      )

      expect(screen.getByText('Custom Loading')).toBeInTheDocument()
    })
  })

  describe('用户认证测试', () => {
    test('未认证用户应该被重定向到登录页', async () => {
      mockTrpc.auth.getMe.useQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Unauthorized')
      })

      mockTrpc.auth.checkPermission.useQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: null
      })

      render(
        <RouteGuard resource="admin" action="read">
          <div>Test Content</div>
        </RouteGuard>
      )

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/auth/login?redirect=%2Fadmin')
      })
    })

    test('已认证用户但权限不足应该被重定向', async () => {
      const user = {
        id: 'user1',
        role: 'BUSINESS_USER',
        username: 'testuser'
      }

      mockTrpc.auth.getMe.useQuery.mockReturnValue({
        data: user,
        isLoading: false,
        error: null
      })

      mockTrpc.auth.checkPermission.useQuery.mockReturnValue({
        data: { allowed: false },
        isLoading: false,
        error: null
      })

      render(
        <RouteGuard resource="admin" action="read">
          <div>Test Content</div>
        </RouteGuard>
      )

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/unauthorized?resource=admin&action=read')
      })
    })
  })

  describe('角色权限测试', () => {
    test('具有所需角色的用户应该能够访问', async () => {
      const user = {
        id: 'admin1',
        role: 'SYSTEM_ADMIN',
        username: 'admin'
      }

      mockTrpc.auth.getMe.useQuery.mockReturnValue({
        data: user,
        isLoading: false,
        error: null
      })

      render(
        <RouteGuard roles={['SYSTEM_ADMIN']}>
          <div>Admin Content</div>
        </RouteGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Admin Content')).toBeInTheDocument()
      })
    })

    test('不具有所需角色的用户应该被拒绝', async () => {
      const user = {
        id: 'user1',
        role: 'BUSINESS_USER',
        username: 'user'
      }

      mockTrpc.auth.getMe.useQuery.mockReturnValue({
        data: user,
        isLoading: false,
        error: null
      })

      render(
        <RouteGuard roles={['SYSTEM_ADMIN']}>
          <div>Admin Content</div>
        </RouteGuard>
      )

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/unauthorized?required=SYSTEM_ADMIN&current=BUSINESS_USER')
      })
    })

    test('多个角色中任一匹配应该允许访问', async () => {
      const user = {
        id: 'manager1',
        role: 'ASSET_MANAGER',
        username: 'manager'
      }

      mockTrpc.auth.getMe.useQuery.mockReturnValue({
        data: user,
        isLoading: false,
        error: null
      })

      render(
        <RouteGuard roles={['ASSET_MANAGER', 'SYSTEM_ADMIN']}>
          <div>Manager Content</div>
        </RouteGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Manager Content')).toBeInTheDocument()
      })
    })
  })

  describe('资源权限测试', () => {
    test('具有资源权限的用户应该能够访问', async () => {
      const user = {
        id: 'admin1',
        role: 'SYSTEM_ADMIN',
        username: 'admin'
      }

      mockTrpc.auth.getMe.useQuery.mockReturnValue({
        data: user,
        isLoading: false,
        error: null
      })

      mockTrpc.auth.checkPermission.useQuery.mockReturnValue({
        data: { allowed: true },
        isLoading: false,
        error: null
      })

      render(
        <RouteGuard resource="assets" action="manage">
          <div>Asset Management</div>
        </RouteGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Asset Management')).toBeInTheDocument()
      })
    })

    test('权限检查失败应该显示错误', async () => {
      const user = {
        id: 'user1',
        role: 'BUSINESS_USER',
        username: 'user'
      }

      mockTrpc.auth.getMe.useQuery.mockReturnValue({
        data: user,
        isLoading: false,
        error: null
      })

      mockTrpc.auth.checkPermission.useQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Permission check failed')
      })

      render(
        <RouteGuard resource="assets" action="manage">
          <div>Asset Management</div>
        </RouteGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('权限验证中...')).toBeInTheDocument()
      })
    })
  })

  describe('自定义重定向测试', () => {
    test('应该重定向到自定义页面', async () => {
      mockTrpc.auth.getMe.useQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Unauthorized')
      })

      render(
        <RouteGuard
          resource="admin"
          action="read"
          redirectTo="/custom-login"
        >
          <div>Test Content</div>
        </RouteGuard>
      )

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/custom-login?redirect=%2Fadmin')
      })
    })
  })
})

describe('useUserPermissions Hook 测试', () => {
  test('应该返回用户权限信息', () => {
    const user = {
      id: 'user1',
      role: 'ASSET_MANAGER',
      username: 'manager'
    }

    const permissions = {
      assets: { read: true, write: true, manage: true },
      applications: { read: true, write: true }
    }

    mockTrpc.auth.getMe.useQuery.mockReturnValue({
      data: user,
      isLoading: false,
      error: null
    })

    mockTrpc.auth.getUserPermissions.useQuery.mockReturnValue({
      data: permissions,
      isLoading: false,
      error: null
    })

    const TestComponent = () => {
      const { user: hookUser, permissions: hookPermissions, hasRole, hasPermission } = useUserPermissions()

      return (
        <div>
          <div>User: {hookUser?.username}</div>
          <div>Role: {hookUser?.role}</div>
          <div>Is Manager: {hasRole('ASSET_MANAGER') ? 'Yes' : 'No'}</div>
          <div>Can Manage Assets: {hasPermission('assets', 'manage') ? 'Yes' : 'No'}</div>
        </div>
      )
    }

    render(<TestComponent />)

    expect(screen.getByText('User: manager')).toBeInTheDocument()
    expect(screen.getByText('Role: ASSET_MANAGER')).toBeInTheDocument()
    expect(screen.getByText('Is Manager: Yes')).toBeInTheDocument()
    expect(screen.getByText('Can Manage Assets: Yes')).toBeInTheDocument()
  })
})

describe('usePermissionCheck Hook 测试', () => {
  test('应该返回权限检查结果', () => {
    mockTrpc.auth.checkPermission.useQuery.mockReturnValue({
      data: { allowed: true },
      isLoading: false,
      error: null
    })

    const TestComponent = () => {
      const { hasPermission, isLoading } = usePermissionCheck('assets', 'read')

      return (
        <div>
          <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
          <div>Has Permission: {hasPermission ? 'Yes' : 'No'}</div>
        </div>
      )
    }

    render(<TestComponent />)

    expect(screen.getByText('Loading: No')).toBeInTheDocument()
    expect(screen.getByText('Has Permission: Yes')).toBeInTheDocument()
  })
})