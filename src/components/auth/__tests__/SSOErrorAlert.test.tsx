/**
 * @jest-environment jsdom
 */
'use client'

import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import SSOErrorAlert from '../SSOErrorAlert'

describe('SSOErrorAlert', () => {
  const mockOnRetry = jest.fn()
  const mockOnFallback = jest.fn()
  const mockOnDismiss = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders basic error alert', () => {
    render(
      <SSOErrorAlert
        error="测试错误消息"
        onDismiss={mockOnDismiss}
      />
    )

    expect(screen.getByText('SSO登录失败')).toBeInTheDocument()
    expect(screen.getByText('测试错误消息')).toBeInTheDocument()
    expect(screen.getByText('❌')).toBeInTheDocument()
  })

  it('renders provider-specific error alert', () => {
    render(
      <SSOErrorAlert
        error="SAML认证失败"
        provider="saml"
        onDismiss={mockOnDismiss}
      />
    )

    expect(screen.getByText('SAML 登录失败')).toBeInTheDocument()
    expect(screen.getByText('SAML认证失败')).toBeInTheDocument()
  })

  it('renders fallback warning alert', () => {
    render(
      <SSOErrorAlert
        error="服务暂时不可用"
        provider="oauth"
        fallbackStrategy="local_auth"
        onDismiss={mockOnDismiss}
      />
    )

    expect(screen.getByText('OAUTH 登录服务异常')).toBeInTheDocument()
    expect(screen.getByText('⚠️')).toBeInTheDocument()
    expect(screen.getByText(/您可以使用账号密码登录/)).toBeInTheDocument()
  })

  it('shows different fallback strategies', () => {
    const { rerender } = render(
      <SSOErrorAlert
        error="服务维护中"
        fallbackStrategy="maintenance_mode"
        onDismiss={mockOnDismiss}
      />
    )

    expect(screen.getByText(/系统维护中，请稍后重试/)).toBeInTheDocument()

    rerender(
      <SSOErrorAlert
        error="服务繁忙"
        fallbackStrategy="queue_requests"
        onDismiss={mockOnDismiss}
      />
    )

    expect(screen.getByText(/服务繁忙，建议稍后重试/)).toBeInTheDocument()
  })

  it('renders retry button when onRetry is provided', () => {
    render(
      <SSOErrorAlert
        error="网络错误"
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
      />
    )

    const retryButton = screen.getByText('🔄 重试')
    expect(retryButton).toBeInTheDocument()

    fireEvent.click(retryButton)
    expect(mockOnRetry).toHaveBeenCalledTimes(1)
  })

  it('renders fallback button for local_auth strategy', () => {
    render(
      <SSOErrorAlert
        error="SSO服务不可用"
        fallbackStrategy="local_auth"
        onFallback={mockOnFallback}
        onDismiss={mockOnDismiss}
      />
    )

    const fallbackButton = screen.getByText('🔑 使用密码登录')
    expect(fallbackButton).toBeInTheDocument()

    fireEvent.click(fallbackButton)
    expect(mockOnFallback).toHaveBeenCalledTimes(1)
  })

  it('does not render fallback button for non-local_auth strategies', () => {
    render(
      <SSOErrorAlert
        error="系统维护"
        fallbackStrategy="maintenance_mode"
        onFallback={mockOnFallback}
        onDismiss={mockOnDismiss}
      />
    )

    expect(screen.queryByText('🔑 使用密码登录')).not.toBeInTheDocument()
  })

  it('handles dismiss functionality', () => {
    render(
      <SSOErrorAlert
        error="测试错误"
        onDismiss={mockOnDismiss}
      />
    )

    const dismissButton = screen.getByText('✕ 关闭')
    expect(dismissButton).toBeInTheDocument()

    fireEvent.click(dismissButton)
    expect(mockOnDismiss).toHaveBeenCalledTimes(1)
  })

  it('hides alert after dismiss', () => {
    const { rerender } = render(
      <SSOErrorAlert
        error="测试错误"
        onDismiss={mockOnDismiss}
      />
    )

    const dismissButton = screen.getByText('✕ 关闭')
    fireEvent.click(dismissButton)

    // Component should be hidden after dismiss
    rerender(
      <SSOErrorAlert
        error="测试错误"
        onDismiss={mockOnDismiss}
      />
    )

    // The component manages its own visibility state
    // After clicking dismiss, it should not be visible
    expect(screen.queryByText('测试错误')).not.toBeInTheDocument()
  })

  it('applies correct CSS classes for error state', () => {
    const { container } = render(
      <SSOErrorAlert
        error="普通错误"
        onDismiss={mockOnDismiss}
      />
    )

    const alertContainer = container.querySelector('.bg-red-50')
    expect(alertContainer).toBeInTheDocument()
    expect(alertContainer).toHaveClass('border-red-200')
  })

  it('applies correct CSS classes for warning state', () => {
    const { container } = render(
      <SSOErrorAlert
        error="警告消息"
        fallbackStrategy="local_auth"
        onDismiss={mockOnDismiss}
      />
    )

    const alertContainer = container.querySelector('.bg-yellow-50')
    expect(alertContainer).toBeInTheDocument()
    expect(alertContainer).toHaveClass('border-yellow-200')
  })

  it('renders all action buttons when all callbacks are provided', () => {
    render(
      <SSOErrorAlert
        error="完整测试"
        fallbackStrategy="local_auth"
        onRetry={mockOnRetry}
        onFallback={mockOnFallback}
        onDismiss={mockOnDismiss}
      />
    )

    expect(screen.getByText('🔄 重试')).toBeInTheDocument()
    expect(screen.getByText('🔑 使用密码登录')).toBeInTheDocument()
    expect(screen.getByText('✕ 关闭')).toBeInTheDocument()
  })

  it('handles multiple button clicks correctly', () => {
    render(
      <SSOErrorAlert
        error="多按钮测试"
        fallbackStrategy="local_auth"
        onRetry={mockOnRetry}
        onFallback={mockOnFallback}
        onDismiss={mockOnDismiss}
      />
    )

    fireEvent.click(screen.getByText('🔄 重试'))
    fireEvent.click(screen.getByText('🔑 使用密码登录'))

    expect(mockOnRetry).toHaveBeenCalledTimes(1)
    expect(mockOnFallback).toHaveBeenCalledTimes(1)
  })
})