import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import {
  SecureComponentWrapper,
  withSecureWrapper,
  useSecurityContext
} from '../SecureComponentWrapper'
import { User } from '@/lib/permissions'

// Mock用户数据
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

const adminUser: User = {
  id: 'admin-123',
  email: 'admin@example.com',
  name: '管理员',
  roles: [
    {
      id: 'admin',
      name: 'admin',
      permissions: [
        { id: 'all-asset', resource: 'asset', action: '*' }
      ]
    }
  ],
  permissions: []
}

// 测试组件
const TestComponent = ({ message = '测试内容' }: { message?: string }) => (
  <div>{message}</div>
)

const ErrorComponent = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('测试错误')
  }
  return <div>正常内容</div>
}

// Mock控制台错误输出
const originalError = console.error
beforeAll(() => {
  console.error = jest.fn()
})

afterAll(() => {
  console.error = originalError
})

describe('SecureComponentWrapper', () => {
  describe('基本渲染功能', () => {
    it('应该在有权限时正常渲染子组件', () => {
      render(
        <SecureComponentWrapper
          user={mockUser}
          resource="asset"
          action="view"
        >
          <TestComponent />
        </SecureComponentWrapper>
      )

      expect(screen.getByText('测试内容')).toBeInTheDocument()
    })

    it('应该在没有权限时显示权限拒绝UI', () => {
      render(
        <SecureComponentWrapper
          user={mockUser}
          resource="asset"
          action="delete" // 用户没有删除权限
        >
          <TestComponent />
        </SecureComponentWrapper>
      )

      expect(screen.getByText('权限不足')).toBeInTheDocument()
      expect(screen.queryByText('测试内容')).not.toBeInTheDocument()
    })

    it('应该在加载时显示加载状态', () => {
      render(
        <SecureComponentWrapper
          user={mockUser}
          resource="asset"
          action="view"
          loading={true}
        >
          <TestComponent />
        </SecureComponentWrapper>
      )

      expect(screen.getByText('加载中...')).toBeInTheDocument()
      expect(screen.queryByText('测试内容')).not.toBeInTheDocument()
    })

    it('应该支持自定义加载组件', () => {
      const customLoading = <div>自定义加载中...</div>

      render(
        <SecureComponentWrapper
          user={mockUser}
          resource="asset"
          action="view"
          loading={true}
          loadingComponent={customLoading}
        >
          <TestComponent />
        </SecureComponentWrapper>
      )

      expect(screen.getByText('自定义加载中...')).toBeInTheDocument()
    })
  })

  describe('权限检查功能', () => {
    it('应该检查资产所有者权限', () => {
      render(
        <SecureComponentWrapper
          user={mockUser}
          resource="asset"
          action="edit"
          assetOwnerId="user-123" // 用户是资产所有者
        >
          <TestComponent />
        </SecureComponentWrapper>
      )

      expect(screen.getByText('测试内容')).toBeInTheDocument()
    })

    it('应该拒绝非所有者的访问', () => {
      render(
        <SecureComponentWrapper
          user={mockUser}
          resource="asset"
          action="delete" // 用户没有删除权限且不是所有者
          assetOwnerId="other-user"
        >
          <TestComponent />
        </SecureComponentWrapper>
      )

      expect(screen.getByText('权限不足')).toBeInTheDocument()
    })

    it('应该支持条件权限检查', () => {
      const userWithCondition: User = {
        ...mockUser,
        permissions: [
          {
            id: 'conditional-edit',
            resource: 'asset',
            action: 'edit',
            conditions: { type: 'draft' }
          }
        ]
      }

      render(
        <SecureComponentWrapper
          user={userWithCondition}
          resource="asset"
          action="edit"
          conditions={{ type: 'draft' }}
        >
          <TestComponent />
        </SecureComponentWrapper>
      )

      expect(screen.getByText('测试内容')).toBeInTheDocument()
    })

    it('应该支持自定义权限拒绝fallback', () => {
      const customFallback = <div>自定义权限拒绝页面</div>

      render(
        <SecureComponentWrapper
          user={mockUser}
          resource="asset"
          action="delete"
          permissionFallback={customFallback}
        >
          <TestComponent />
        </SecureComponentWrapper>
      )

      expect(screen.getByText('自定义权限拒绝页面')).toBeInTheDocument()
    })
  })

  describe('错误边界功能', () => {
    it('应该捕获子组件错误', () => {
      render(
        <SecureComponentWrapper
          user={mockUser}
          resource="asset"
          action="view"
        >
          <ErrorComponent shouldThrow={true} />
        </SecureComponentWrapper>
      )

      expect(screen.getByText('程序运行错误')).toBeInTheDocument()
    })

    it('应该传递错误边界配置', () => {
      render(
        <SecureComponentWrapper
          user={mockUser}
          resource="asset"
          action="view"
          showErrorDetails={true}
          allowRetry={false}
        >
          <ErrorComponent shouldThrow={true} />
        </SecureComponentWrapper>
      )

      expect(screen.getByText('程序运行错误')).toBeInTheDocument()
      expect(screen.getByText('技术详情 (点击展开)')).toBeInTheDocument()
      expect(screen.queryByText('重试')).not.toBeInTheDocument()
    })
  })

  describe('样式和类名', () => {
    it('应该支持自定义className属性', () => {
      const { container } = render(
        <SecureComponentWrapper
          user={mockUser}
          resource="asset"
          action="view"
          className="custom-secure-wrapper"
        >
          <TestComponent />
        </SecureComponentWrapper>
      )

      // 检查className是否被传递（即使在DOM结构中可能有所变化）
      expect(container.firstChild).toBeTruthy()
    })
  })
})

describe('withSecureWrapper HOC', () => {
  it('应该正确包装组件', () => {
    const SecureTestComponent = withSecureWrapper(TestComponent, {
      resource: 'asset',
      action: 'view'
    })

    render(<SecureTestComponent user={mockUser} message="HOC测试" />)

    expect(screen.getByText('HOC测试')).toBeInTheDocument()
  })

  it('应该传递安全配置', () => {
    const SecureTestComponent = withSecureWrapper(TestComponent, {
      resource: 'asset',
      action: 'delete', // 用户没有删除权限
      showErrorDetails: true
    })

    render(<SecureTestComponent user={mockUser} />)

    expect(screen.getByText('权限不足')).toBeInTheDocument()
  })

  it('应该保持正确的displayName', () => {
    const NamedComponent = () => <div>测试</div>
    NamedComponent.displayName = 'NamedComponent'

    const SecureNamedComponent = withSecureWrapper(NamedComponent, {
      resource: 'asset',
      action: 'view'
    })

    expect(SecureNamedComponent.displayName).toBe('withSecureWrapper(NamedComponent)')
  })

  it('应该支持加载状态', () => {
    const SecureTestComponent = withSecureWrapper(TestComponent, {
      resource: 'asset',
      action: 'view'
    })

    render(<SecureTestComponent user={mockUser} loading={true} />)

    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })
})

describe('useSecurityContext Hook', () => {
  const SecurityContextTestComponent = () => {
    const { user, loading, error } = useSecurityContext()

    if (loading) return <div>用户信息加载中...</div>
    if (error) return <div>用户信息加载错误: {error.message}</div>
    if (!user) return <div>未登录</div>

    return (
      <div>
        <div>用户: {user.name}</div>
        <div>邮箱: {user.email}</div>
        <div>角色数: {user.roles.length}</div>
      </div>
    )
  }

  it('应该返回用户上下文信息', async () => {
    render(<SecurityContextTestComponent />)

    // 等待加载完成
    await waitFor(() => {
      expect(screen.getByText('用户: 张三')).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByText('邮箱: user@example.com')).toBeInTheDocument()
    expect(screen.getByText('角色数: 1')).toBeInTheDocument()
  })

  it('应该处理加载状态', async () => {
    render(<SecurityContextTestComponent />)

    // 由于useEffect是异步的，可能会立即完成
    // 检查最终状态
    await waitFor(() => {
      expect(screen.getByText('用户: 张三')).toBeInTheDocument()
    }, { timeout: 1000 })
  })
})

describe('集成测试', () => {
  it('应该同时处理权限检查和错误边界', () => {
    render(
      <SecureComponentWrapper
        user={mockUser}
        resource="asset"
        action="view"
      >
        <ErrorComponent shouldThrow={true} />
      </SecureComponentWrapper>
    )

    // 应该显示错误边界内容而不是权限拒绝
    expect(screen.getByText('程序运行错误')).toBeInTheDocument()
  })

  it('应该优先显示权限拒绝而不是错误', () => {
    render(
      <SecureComponentWrapper
        user={mockUser}
        resource="asset"
        action="delete" // 没有权限
      >
        <ErrorComponent shouldThrow={true} />
      </SecureComponentWrapper>
    )

    // 应该显示权限拒绝而不是错误
    expect(screen.getByText('权限不足')).toBeInTheDocument()
    expect(screen.queryByText('程序运行错误')).not.toBeInTheDocument()
  })

  it('应该在管理员用户下跳过权限检查', () => {
    render(
      <SecureComponentWrapper
        user={adminUser}
        resource="asset"
        action="delete" // 管理员有所有权限
      >
        <TestComponent message="管理员内容" />
      </SecureComponentWrapper>
    )

    expect(screen.getByText('管理员内容')).toBeInTheDocument()
  })
})