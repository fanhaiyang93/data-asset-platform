import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ErrorBoundary, { useAsyncErrorBoundary, withErrorBoundary } from '../ErrorBoundary'
import { PermissionError } from '@/lib/permissions'

// 创建一个会抛出错误的测试组件
const ThrowErrorComponent = ({ shouldThrow = false, errorType = 'generic' }) => {
  if (shouldThrow) {
    if (errorType === 'permission') {
      throw new PermissionError('没有权限', 'asset', 'edit')
    } else if (errorType === 'chunk') {
      const error = new Error('Loading chunk 123 failed')
      error.name = 'ChunkLoadError'
      throw error
    } else if (errorType === 'type') {
      const error = new Error('Cannot read property of undefined')
      error.name = 'TypeError'
      throw error
    } else {
      throw new Error('测试错误')
    }
  }
  return <div>正常组件内容</div>
}

// 测试异步错误边界的组件
const AsyncErrorComponent = () => {
  const throwAsyncError = useAsyncErrorBoundary()

  const handleAsyncError = () => {
    throwAsyncError(new Error('异步错误'))
  }

  return (
    <div>
      <button onClick={handleAsyncError}>触发异步错误</button>
    </div>
  )
}

describe('ErrorBoundary', () => {
  // 抑制控制台错误输出
  const originalError = console.error
  beforeAll(() => {
    console.error = jest.fn()
  })

  afterAll(() => {
    console.error = originalError
  })

  describe('基本错误捕获', () => {
    it('应该在没有错误时正常渲染子组件', () => {
      render(
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('正常组件内容')).toBeInTheDocument()
    })

    it('应该捕获并显示错误', () => {
      render(
        <ErrorBoundary>
          <ThrowErrorComponent shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('程序运行错误')).toBeInTheDocument()
      expect(screen.getByText(/应用程序遇到了意外错误/)).toBeInTheDocument()
    })

    it('应该显示重试按钮', () => {
      render(
        <ErrorBoundary>
          <ThrowErrorComponent shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('重试')).toBeInTheDocument()
      expect(screen.getByText('刷新页面')).toBeInTheDocument()
      expect(screen.getByText('报告问题')).toBeInTheDocument()
    })

    it('应该显示错误ID', () => {
      render(
        <ErrorBoundary>
          <ThrowErrorComponent shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText(/错误ID: ERR_/)).toBeInTheDocument()
    })
  })

  describe('特定错误类型处理', () => {
    it('应该正确处理权限错误', () => {
      render(
        <ErrorBoundary>
          <ThrowErrorComponent shouldThrow={true} errorType="permission" />
        </ErrorBoundary>
      )

      expect(screen.getByText('权限不足')).toBeInTheDocument()
      expect(screen.getByText(/您没有权限访问此内容/)).toBeInTheDocument()
    })

    it('应该正确处理资源加载错误', () => {
      render(
        <ErrorBoundary>
          <ThrowErrorComponent shouldThrow={true} errorType="chunk" />
        </ErrorBoundary>
      )

      expect(screen.getByText('资源加载失败')).toBeInTheDocument()
      expect(screen.getByText(/页面资源加载失败/)).toBeInTheDocument()
    })

    it('应该正确处理类型错误', () => {
      render(
        <ErrorBoundary>
          <ThrowErrorComponent shouldThrow={true} errorType="type" />
        </ErrorBoundary>
      )

      expect(screen.getByText('数据访问错误')).toBeInTheDocument()
      expect(screen.getByText(/访问数据时出现异常/)).toBeInTheDocument()
    })
  })

  describe('错误详情显示', () => {
    it('应该在开发模式下显示错误详情', () => {
      render(
        <ErrorBoundary showErrorDetails={true}>
          <ThrowErrorComponent shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('技术详情 (点击展开)')).toBeInTheDocument()
    })

    it('应该在生产模式下隐藏错误详情', () => {
      render(
        <ErrorBoundary showErrorDetails={false}>
          <ThrowErrorComponent shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.queryByText('技术详情 (点击展开)')).not.toBeInTheDocument()
    })
  })

  describe('重试功能', () => {
    it('应该显示重试按钮并能被点击', () => {
      render(
        <ErrorBoundary>
          <ThrowErrorComponent shouldThrow={true} />
        </ErrorBoundary>
      )

      // 确认错误状态
      expect(screen.getByText('程序运行错误')).toBeInTheDocument()

      // 确认重试按钮存在并能被点击
      const retryButton = screen.getByText('重试')
      expect(retryButton).toBeInTheDocument()
      expect(retryButton).not.toBeDisabled()

      // 点击重试按钮不应该报错
      fireEvent.click(retryButton)
    })

    it('应该支持禁用重试功能', () => {
      render(
        <ErrorBoundary allowRetry={false}>
          <ThrowErrorComponent shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.queryByText('重试')).not.toBeInTheDocument()
      expect(screen.getByText('刷新页面')).toBeInTheDocument()
    })
  })

  describe('自定义fallback', () => {
    it('应该支持自定义fallback UI', () => {
      const customFallback = <div>自定义错误页面</div>

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowErrorComponent shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('自定义错误页面')).toBeInTheDocument()
      expect(screen.queryByText('程序运行错误')).not.toBeInTheDocument()
    })
  })

  describe('错误回调', () => {
    it('应该调用onError回调', () => {
      const onError = jest.fn()

      render(
        <ErrorBoundary onError={onError}>
          <ThrowErrorComponent shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      )
    })
  })

  describe('异步错误边界Hook', () => {
    it('应该捕获异步错误', () => {
      render(
        <ErrorBoundary>
          <AsyncErrorComponent />
        </ErrorBoundary>
      )

      // 触发异步错误
      fireEvent.click(screen.getByText('触发异步错误'))

      expect(screen.getByText('程序运行错误')).toBeInTheDocument()
    })
  })

  describe('高阶组件', () => {
    it('应该正确包装组件', () => {
      const TestComponent = ({ message }: { message: string }) => <div>{message}</div>
      const WrappedComponent = withErrorBoundary(TestComponent, {
        showErrorDetails: true
      })

      render(<WrappedComponent message="测试消息" />)

      expect(screen.getByText('测试消息')).toBeInTheDocument()
    })

    it('应该捕获包装组件的错误', () => {
      const ErrorComponent = withErrorBoundary(ThrowErrorComponent, {
        showErrorDetails: true
      })

      render(<ErrorComponent shouldThrow={true} />)

      expect(screen.getByText('程序运行错误')).toBeInTheDocument()
    })

    it('应该保持组件的displayName', () => {
      const TestComponent = () => <div>测试</div>
      TestComponent.displayName = 'TestComponent'

      const WrappedComponent = withErrorBoundary(TestComponent)

      expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)')
    })
  })

  describe('样式和CSS类', () => {
    it('应该应用自定义className', () => {
      const { container } = render(
        <ErrorBoundary className="custom-error-boundary">
          <ThrowErrorComponent shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(container.firstChild).toHaveClass('custom-error-boundary')
    })
  })
})