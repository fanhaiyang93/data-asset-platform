'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // 调用可选的错误处理回调
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      // 如果提供了自定义的fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback
      }

      // 默认的错误界面
      return (
        <div className="flex items-center justify-center min-h-[400px] p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>
              <CardTitle className="text-xl">出现了错误</CardTitle>
              <CardDescription>
                很抱歉，页面遇到了一个问题。请尝试刷新页面或联系技术支持。
              </CardDescription>
            </CardHeader>

            <CardContent>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    错误详情 (仅开发环境显示):
                  </p>
                  <code className="text-xs text-destructive break-all">
                    {this.state.error.message}
                  </code>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex gap-2 justify-center">
              <Button
                variant="outline"
                onClick={this.handleRetry}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                重试
              </Button>
              <Button
                onClick={this.handleReload}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                刷新页面
              </Button>
            </CardFooter>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// 简化版本的错误边界，用于包装小组件
interface SimpleErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

export function SimpleErrorBoundary({ children, fallback }: SimpleErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        fallback || (
          <div className="p-4 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
            <p className="text-sm">内容加载失败，请刷新重试</p>
          </div>
        )
      }
    >
      {children}
    </ErrorBoundary>
  )
}