/**
 * @jest-environment jsdom
 */
'use client'

import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import SSOStatusIndicator from '../SSOStatusIndicator'

describe('SSOStatusIndicator', () => {
  it('renders loading state correctly', () => {
    render(
      <SSOStatusIndicator
        provider="saml"
        available={false}
        loading={true}
      />
    )

    expect(screen.getByText('⏳')).toBeInTheDocument()
    expect(screen.getByText('SAML')).toBeInTheDocument()
    expect(screen.getByText('检查中...')).toBeInTheDocument()
  })

  it('renders unavailable state correctly', () => {
    render(
      <SSOStatusIndicator
        provider="oauth"
        available={false}
        loading={false}
      />
    )

    expect(screen.getByText('🔴')).toBeInTheDocument()
    expect(screen.getByText('OAUTH')).toBeInTheDocument()
    expect(screen.getByText('不可用')).toBeInTheDocument()
  })

  it('renders fallback active state correctly', () => {
    render(
      <SSOStatusIndicator
        provider="saml"
        available={true}
        loading={false}
        fallbackActive={true}
      />
    )

    expect(screen.getByText('🟡')).toBeInTheDocument()
    expect(screen.getByText('SAML')).toBeInTheDocument()
    expect(screen.getByText('降级模式')).toBeInTheDocument()
  })

  it('renders normal/available state correctly', () => {
    render(
      <SSOStatusIndicator
        provider="oauth"
        available={true}
        loading={false}
        fallbackActive={false}
      />
    )

    expect(screen.getByText('🟢')).toBeInTheDocument()
    expect(screen.getByText('OAUTH')).toBeInTheDocument()
    expect(screen.getByText('正常')).toBeInTheDocument()
  })

  it('prioritizes loading state over other states', () => {
    render(
      <SSOStatusIndicator
        provider="saml"
        available={true}
        loading={true}
        fallbackActive={true}
      />
    )

    // Loading should take precedence
    expect(screen.getByText('⏳')).toBeInTheDocument()
    expect(screen.getByText('检查中...')).toBeInTheDocument()
    expect(screen.queryByText('降级模式')).not.toBeInTheDocument()
  })

  it('prioritizes unavailable state over fallback state', () => {
    render(
      <SSOStatusIndicator
        provider="oauth"
        available={false}
        loading={false}
        fallbackActive={true}
      />
    )

    // Unavailable should take precedence over fallback
    expect(screen.getByText('🔴')).toBeInTheDocument()
    expect(screen.getByText('不可用')).toBeInTheDocument()
    expect(screen.queryByText('降级模式')).not.toBeInTheDocument()
  })

  it('applies correct CSS classes for loading state', () => {
    const { container } = render(
      <SSOStatusIndicator
        provider="saml"
        available={false}
        loading={true}
      />
    )

    const statusElement = container.querySelector('.bg-blue-100')
    expect(statusElement).toBeInTheDocument()
    expect(statusElement).toHaveClass('text-blue-500')
  })

  it('applies correct CSS classes for unavailable state', () => {
    const { container } = render(
      <SSOStatusIndicator
        provider="oauth"
        available={false}
        loading={false}
      />
    )

    const statusElement = container.querySelector('.bg-red-100')
    expect(statusElement).toBeInTheDocument()
    expect(statusElement).toHaveClass('text-red-500')
  })

  it('applies correct CSS classes for fallback state', () => {
    const { container } = render(
      <SSOStatusIndicator
        provider="saml"
        available={true}
        loading={false}
        fallbackActive={true}
      />
    )

    const statusElement = container.querySelector('.bg-yellow-100')
    expect(statusElement).toBeInTheDocument()
    expect(statusElement).toHaveClass('text-yellow-500')
  })

  it('applies correct CSS classes for normal state', () => {
    const { container } = render(
      <SSOStatusIndicator
        provider="oauth"
        available={true}
        loading={false}
        fallbackActive={false}
      />
    )

    const statusElement = container.querySelector('.bg-green-100')
    expect(statusElement).toBeInTheDocument()
    expect(statusElement).toHaveClass('text-green-500')
  })

  it('handles different provider names correctly', () => {
    const { rerender } = render(
      <SSOStatusIndicator
        provider="saml"
        available={true}
        loading={false}
      />
    )

    expect(screen.getByText('SAML')).toBeInTheDocument()

    rerender(
      <SSOStatusIndicator
        provider="oauth"
        available={true}
        loading={false}
      />
    )

    expect(screen.getByText('OAUTH')).toBeInTheDocument()

    rerender(
      <SSOStatusIndicator
        provider="custom-provider"
        available={true}
        loading={false}
      />
    )

    expect(screen.getByText('CUSTOM-PROVIDER')).toBeInTheDocument()
  })

  it('renders with default props correctly', () => {
    render(
      <SSOStatusIndicator
        provider="saml"
        available={true}
      />
    )

    // Should default to loading=false, fallbackActive=false
    expect(screen.getByText('🟢')).toBeInTheDocument()
    expect(screen.getByText('正常')).toBeInTheDocument()
  })

  it('maintains consistent layout structure', () => {
    const { container } = render(
      <SSOStatusIndicator
        provider="test"
        available={true}
        loading={false}
      />
    )

    // Check the main container structure
    const mainContainer = container.firstChild
    expect(mainContainer).toHaveClass('flex', 'items-center', 'space-x-2')

    // Check the status badge structure
    const statusBadge = container.querySelector('.inline-flex')
    expect(statusBadge).toHaveClass('items-center', 'px-2', 'py-1', 'rounded-full', 'text-xs', 'font-medium')
  })

  it('renders status text with correct styling', () => {
    render(
      <SSOStatusIndicator
        provider="oauth"
        available={true}
        loading={false}
      />
    )

    const statusText = screen.getByText('正常')
    expect(statusText).toHaveClass('text-xs', 'text-green-500')
  })
})