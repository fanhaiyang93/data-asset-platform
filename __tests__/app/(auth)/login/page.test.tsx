/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '@/app/(auth)/login/page'

// Mock fetch
global.fetch = jest.fn()

const mockPush = jest.fn()
const mockRefresh = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetch as jest.Mock).mockClear()
  })

  it('renders login form correctly', async () => {
    // Mock fetch to return no available SSO providers (first call)
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'No SSO providers available' })
    })
    // Mock fallback API call (second call)
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Fallback not available' })
    })

    render(<LoginPage />)

    // Wait for the component to load and show local auth form
    await waitFor(() => {
      expect(screen.getByPlaceholderText('用户名或邮箱')).toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: /登录数据资产管理平台/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('用户名或邮箱')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /登录/i })).toBeInTheDocument()
  })

  it('shows validation errors for empty fields', async () => {
    const user = userEvent.setup()
    // Mock SSO availability check (first call)
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'No SSO providers available' })
    })
    // Mock fallback API call (second call)
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Fallback not available' })
    })

    render(<LoginPage />)

    // Wait for the component to show local auth form
    await waitFor(() => {
      expect(screen.getByPlaceholderText('用户名或邮箱')).toBeInTheDocument()
    })

    const submitButton = screen.getByRole('button', { name: /登录/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('用户名不能为空')).toBeInTheDocument()
      expect(screen.getByText('密码不能为空')).toBeInTheDocument()
    })
  })

  it('handles successful login', async () => {
    const user = userEvent.setup()
    // First mock SSO availability check (no providers)
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'No SSO providers available' })
    })
    // Then mock successful login
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        token: 'test-token',
        user: {
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
        },
      }),
    })

    render(<LoginPage />)

    // Wait for the component to show local auth form
    await waitFor(() => {
      expect(screen.getByPlaceholderText('用户名或邮箱')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('用户名或邮箱'), 'testuser')
    await user.type(screen.getByPlaceholderText('密码'), 'password123')
    await user.click(screen.getByRole('button', { name: /登录/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'testuser',
          password: 'password123',
        }),
      })
      expect(mockPush).toHaveBeenCalledWith('/')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('handles login failure', async () => {
    const user = userEvent.setup()
    // First mock SSO availability check (no providers)
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'No SSO providers available' })
    })
    // Then mock login failure
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Invalid credentials',
      }),
    })

    render(<LoginPage />)

    // Wait for the component to show local auth form
    await waitFor(() => {
      expect(screen.getByPlaceholderText('用户名或邮箱')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('用户名或邮箱'), 'testuser')
    await user.type(screen.getByPlaceholderText('密码'), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /登录/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('disables form during submission', async () => {
    const user = userEvent.setup()
    // First mock SSO availability check (no providers)
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'No SSO providers available' })
    })
    // Then mock login that never resolves
    ;(fetch as jest.Mock).mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<LoginPage />)

    // Wait for the component to show local auth form
    await waitFor(() => {
      expect(screen.getByPlaceholderText('用户名或邮箱')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('用户名或邮箱'), 'testuser')
    await user.type(screen.getByPlaceholderText('密码'), 'password123')

    const submitButton = screen.getByRole('button', { name: /登录/i })
    await user.click(submitButton)

    // Button should show loading state
    expect(screen.getByRole('button', { name: /登录中.../i })).toBeDisabled()

    // Input fields should be disabled
    expect(screen.getByPlaceholderText('用户名或邮箱')).toBeDisabled()
    expect(screen.getByPlaceholderText('密码')).toBeDisabled()
  })
})