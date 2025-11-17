'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Bug, Mail } from 'lucide-react'
import { PermissionError } from '@/lib/permissions'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
  errorId?: string
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showErrorDetails?: boolean
  allowRetry?: boolean
  className?: string
}

/**
 * 通用错误边界组件
 * 捕获组件树中的JavaScript错误并显示友好的错误UI
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // 生成错误ID用于追踪
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return {
      hasError: true,
      error,
      errorId
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 更新状态包含错误详情
    this.setState({
      error,
      errorInfo,
      errorId: this.state.errorId || `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    })

    // 调用外部错误处理器
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // 发送错误报告到监控系统
    this.reportError(error, errorInfo)
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  /**
   * 发送错误报告
   */
  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    try {
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        errorId: this.state.errorId
      }

      // 这里可以集成错误监控服务，如 Sentry, LogRocket 等
      console.error('错误边界捕获到错误:', errorReport)

      // 发送到监控服务的示例
      // errorMonitoringService.captureException(error, { extra: errorReport })
    } catch (reportingError) {
      console.error('发送错误报告失败:', reportingError)
    }
  }

  /**
   * 重试操作
   */
  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })

    // 延迟重试，给组件时间恢复
    this.retryTimeoutId = setTimeout(() => {
      // 强制重新渲染
      this.forceUpdate()
    }, 100)
  }

  /**
   * 获取错误类型描述
   */
  private getErrorDescription = (error: Error): { title: string; description: string; icon: ReactNode } => {
    if (error instanceof PermissionError) {
      return {
        title: '权限不足',
        description: '您没有权限访问此内容，请联系管理员获取相应权限。',
        icon: <AlertTriangle className="w-6 h-6 text-amber-500" />
      }
    }

    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      return {
        title: '资源加载失败',
        description: '页面资源加载失败，可能是网络问题导致的，请尝试刷新页面。',
        icon: <RefreshCw className="w-6 h-6 text-blue-500" />
      }
    }

    if (error.name === 'TypeError' && error.message.includes('Cannot read prop')) {
      return {
        title: '数据访问错误',
        description: '访问数据时出现异常，可能是数据格式不正确或服务暂时不可用。',
        icon: <Bug className="w-6 h-6 text-red-500" />
      }
    }

    return {
      title: '程序运行错误',
      description: '应用程序遇到了意外错误，我们已记录此问题并会尽快修复。',
      icon: <AlertTriangle className="w-6 h-6 text-red-500" />
    }
  }

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback
      }

      const { error } = this.state
      const errorDesc = error ? this.getErrorDescription(error) : {
        title: '未知错误',
        description: '发生了未知错误',
        icon: <Bug className="w-6 h-6 text-red-500" />
      }

      return (
        <Card className={`border-red-200 bg-red-50 ${this.props.className || ''}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              {errorDesc.icon}
              {errorDesc.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-red-700">
              {errorDesc.description}
            </p>

            {/* 错误ID显示 */}
            {this.state.errorId && (
              <div className="text-xs text-red-600 font-mono">
                错误ID: {this.state.errorId}
              </div>
            )}

            {/* 错误详情（开发模式下显示） */}
            {this.props.showErrorDetails && error && (
              <details className="text-xs">
                <summary className="cursor-pointer text-red-600 hover:text-red-800">
                  技术详情 (点击展开)
                </summary>
                <div className="mt-2 p-3 bg-red-100 border border-red-200 rounded font-mono whitespace-pre-wrap">
                  <div className="font-semibold mb-2">错误信息:</div>
                  <div className="mb-4">{error.message}</div>

                  {error.stack && (
                    <>
                      <div className="font-semibold mb-2">调用堆栈:</div>
                      <div className="text-xs">{error.stack}</div>
                    </>
                  )}

                  {this.state.errorInfo?.componentStack && (
                    <>
                      <div className="font-semibold mb-2 mt-4">组件堆栈:</div>
                      <div className="text-xs">{this.state.errorInfo.componentStack}</div>
                    </>
                  )}
                </div>
              </details>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-2">
              {this.props.allowRetry !== false && (
                <Button
                  size="sm"
                  onClick={this.handleRetry}
                  className="text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  重试
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() => window.location.reload()}
                className="text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                刷新页面
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const subject = encodeURIComponent(`错误报告: ${errorDesc.title}`)
                  const body = encodeURIComponent(
                    `错误ID: ${this.state.errorId}\n` +
                    `错误信息: ${error?.message}\n` +
                    `发生时间: ${new Date().toLocaleString()}\n` +
                    `页面地址: ${window.location.href}\n\n` +
                    `请描述您遇到问题时的操作步骤:\n\n`
                  )
                  window.open(`mailto:support@company.com?subject=${subject}&body=${body}`)
                }}
                className="text-xs"
              >
                <Mail className="w-3 h-3 mr-1" />
                报告问题
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}

/**
 * 异步错误边界Hook
 * 用于捕获异步操作中的错误
 */
export const useAsyncErrorBoundary = () => {
  const [, setError] = React.useState()

  return React.useCallback((error: Error) => {
    setError(() => {
      throw error
    })
  }, [])
}

/**
 * 高阶组件：为组件包装错误边界
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WithErrorBoundaryComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )

  WithErrorBoundaryComponent.displayName =
    `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`

  return WithErrorBoundaryComponent
}

export default ErrorBoundary