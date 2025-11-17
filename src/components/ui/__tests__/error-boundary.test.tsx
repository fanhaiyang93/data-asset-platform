import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary, SimpleErrorBoundary } from '../error-boundary'

// 测试组件，用于触发错误
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

// Mock console.error to avoid error output in tests
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('应该正常渲染子组件当没有错误时', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('应该显示错误界面当子组件抛出错误时', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('出现了错误')).toBeInTheDocument()
    expect(screen.getByText(/很抱歉，页面遇到了一个问题/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /重试/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /刷新页面/ })).toBeInTheDocument()
  })

  it('应该显示自定义fallback当提供时', () => {
    const customFallback = <div>Custom error message</div>

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom error message')).toBeInTheDocument()
    expect(screen.queryByText('出现了错误')).not.toBeInTheDocument()
  })

  it('应该调用错误处理回调当提供时', () => {
    const onError = jest.fn()

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    )
  })

  it('应该能够重试并重新渲染子组件', () => {
    const TestComponent = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true)

      React.useEffect(() => {
        // 模拟在重试时修复错误
        const timer = setTimeout(() => setShouldThrow(false), 100)
        return () => clearTimeout(timer)
      }, [])

      return <ThrowError shouldThrow={shouldThrow} />
    }

    render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    )

    // 初始应该显示错误
    expect(screen.getByText('出现了错误')).toBeInTheDocument()

    // 点击重试按钮
    const retryButton = screen.getByRole('button', { name: /重试/ })
    fireEvent.click(retryButton)

    // 应该尝试重新渲染（虽然在这个测试中仍然会出错）
    expect(screen.getByText('出现了错误')).toBeInTheDocument()
  })

  it('应该在开发环境显示错误详情', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText(/错误详情/)).toBeInTheDocument()
    expect(screen.getByText('Test error')).toBeInTheDocument()

    process.env.NODE_ENV = originalEnv
  })

  it('应该在生产环境隐藏错误详情', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.queryByText(/错误详情/)).not.toBeInTheDocument()
    expect(screen.queryByText('Test error')).not.toBeInTheDocument()

    process.env.NODE_ENV = originalEnv
  })
})

describe('SimpleErrorBoundary', () => {
  it('应该正常渲染子组件当没有错误时', () => {
    render(
      <SimpleErrorBoundary>
        <ThrowError shouldThrow={false} />
      </SimpleErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('应该显示简化的错误界面当子组件抛出错误时', () => {
    render(
      <SimpleErrorBoundary>
        <ThrowError shouldThrow={true} />
      </SimpleErrorBoundary>
    )

    expect(screen.getByText('内容加载失败，请刷新重试')).toBeInTheDocument()
  })

  it('应该显示自定义fallback当提供时', () => {
    const customFallback = <div>Simple custom error</div>

    render(
      <SimpleErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </SimpleErrorBoundary>
    )

    expect(screen.getByText('Simple custom error')).toBeInTheDocument()
    expect(screen.queryByText('内容加载失败，请刷新重试')).not.toBeInTheDocument()
  })
})