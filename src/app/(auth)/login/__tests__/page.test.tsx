/**
 * @jest-environment jsdom
 */
'use client'

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useRouter } from 'next/navigation'
import LoginPage from '../page'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn()
}))

// Mock fetch
global.fetch = jest.fn()

const mockPush = jest.fn()
const mockRefresh = jest.fn()

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>

describe('LoginPage SSO Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
      replace: jest.fn()
    })

    // Reset fetch mock
    const fetchMock = fetch as jest.MockedFunction<typeof fetch>
    fetchMock.mockClear()
  })

  describe('SSO Availability Checking', () => {
    it('loads and checks SSO availability on mount', async () => {
      const fetchMock = fetch as jest.MockedFunction<typeof fetch>

      // Mock availability check response
      fetchMock
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              results: [
                { provider: 'saml', available: true },
                { provider: 'oauth', available: false }
              ]
            })
          } as Response)
        )
        // Mock fallback status response
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              healthStatuses: [
                { provider: 'saml', healthy: true },
                { provider: 'oauth', healthy: false }
              ]
            })
          } as Response)
        )

      render(<LoginPage />)

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/sso/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providers: ['saml', 'oauth'] })
        })
      })

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/sso/fallback')
      })
    })

    it('shows local auth when no SSO providers are available', async () => {
      const fetchMock = fetch as jest.MockedFunction<typeof fetch>

      fetchMock
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              results: [
                { provider: 'saml', available: false },
                { provider: 'oauth', available: false }
              ]
            })
          } as Response)
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              healthStatuses: []
            })
          } as Response)
        )

      render(<LoginPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('用户名或邮箱')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('密码')).toBeInTheDocument()
      })
    })

    it('shows SSO options when providers are available', async () => {
      const fetchMock = fetch as jest.MockedFunction<typeof fetch>

      fetchMock
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              results: [
                { provider: 'saml', available: true },
                { provider: 'oauth', available: true }
              ]
            })
          } as Response)
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              healthStatuses: [
                { provider: 'saml', healthy: true },
                { provider: 'oauth', healthy: true }
              ]
            })
          } as Response)
        )

      render(<LoginPage />)

      await waitFor(() => {
        expect(screen.getByText('企业SSO登录')).toBeInTheDocument()
        expect(screen.getByText('OAuth登录')).toBeInTheDocument()
      })
    })
  })

  describe('SSO Login Flow', () => {
    beforeEach(async () => {
      // Setup available SSO providers
      const fetchMock = fetch as jest.MockedFunction<typeof fetch>

      fetchMock
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              results: [
                { provider: 'saml', available: true },
                { provider: 'oauth', available: true }
              ]
            })
          } as Response)
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              healthStatuses: [
                { provider: 'saml', healthy: true },
                { provider: 'oauth', healthy: true }
              ]
            })
          } as Response)
        )

      render(<LoginPage />)
      await waitFor(() => {
        expect(screen.getByText('企业SSO登录')).toBeInTheDocument()
      })
    })

    it('handles SAML login correctly', async () => {
      const fetchMock = fetch as jest.MockedFunction<typeof fetch>

      // Mock availability recheck
      fetchMock
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ available: true })
          } as Response)
        )
        // Mock fallback status check
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ fallbackActive: false })
          } as Response)
        )

      // Mock window.location.href assignment
      const originalLocation = window.location
      delete (window as any).location
      window.location = { ...originalLocation, href: '' }

      const samlButton = screen.getByText('企业SSO登录')
      fireEvent.click(samlButton)

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/sso/availability?provider=saml')
      })

      await waitFor(() => {
        expect(window.location.href).toBe('/api/auth/sso/saml')
      })

      // Restore original location
      window.location = originalLocation
    })

    it('handles OAuth login correctly', async () => {
      const fetchMock = fetch as jest.MockedFunction<typeof fetch>

      fetchMock
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ available: true })
          } as Response)
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ fallbackActive: false })
          } as Response)
        )

      const originalLocation = window.location
      delete (window as any).location
      window.location = { ...originalLocation, href: '', origin: 'http://localhost:3000' }

      const oauthButton = screen.getByText('OAuth登录')
      fireEvent.click(oauthButton)

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/sso/availability?provider=oauth')
      })

      await waitFor(() => {
        expect(window.location.href).toContain('/api/auth/sso/oauth/authorize')
        expect(window.location.href).toContain('redirect=%2F')
      })

      window.location = originalLocation
    })

    it('shows error when SSO provider becomes unavailable', async () => {
      const fetchMock = fetch as jest.MockedFunction<typeof fetch>

      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ available: false })
        } as Response)
      )

      const samlButton = screen.getByText('企业SSO登录')
      fireEvent.click(samlButton)

      await waitFor(() => {
        expect(screen.getByText(/SAML服务当前不可用/)).toBeInTheDocument()
      })
    })

    it('handles fallback mode correctly', async () => {
      const fetchMock = fetch as jest.MockedFunction<typeof fetch>

      fetchMock
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ available: true })
          } as Response)
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              fallbackActive: true,
              fallbackStrategy: 'local_auth'
            })
          } as Response)
        )

      // Mock window.confirm
      const originalConfirm = window.confirm
      window.confirm = jest.fn().mockReturnValue(false)

      const samlButton = screen.getByText('企业SSO登录')
      fireEvent.click(samlButton)

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalledWith(
          expect.stringContaining('SAML服务异常')
        )
      })

      window.confirm = originalConfirm
    })
  })

  describe('Local Authentication Toggle', () => {
    it('toggles between SSO and local auth views', async () => {
      const fetchMock = fetch as jest.MockedFunction<typeof fetch>

      fetchMock
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              results: [{ provider: 'saml', available: true }]
            })
          } as Response)
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              healthStatuses: [{ provider: 'saml', healthy: true }]
            })
          } as Response)
        )

      render(<LoginPage />)

      await waitFor(() => {
        expect(screen.getByText('企业SSO登录')).toBeInTheDocument()
      })

      // Switch to local auth
      fireEvent.click(screen.getByText('使用账号密码登录'))

      expect(screen.getByPlaceholderText('用户名或邮箱')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('密码')).toBeInTheDocument()

      // Switch back to SSO
      fireEvent.click(screen.getByText('返回SSO登录'))

      expect(screen.getByText('企业SSO登录')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      const fetchMock = fetch as jest.MockedFunction<typeof fetch>

      fetchMock.mockImplementationOnce(() =>
        Promise.reject(new Error('Network error'))
      )

      render(<LoginPage />)

      await waitFor(() => {
        // Should fall back to local auth when API fails
        expect(screen.getByPlaceholderText('用户名或邮箱')).toBeInTheDocument()
      })
    })

    it('handles SSO login errors', async () => {
      const fetchMock = fetch as jest.MockedFunction<typeof fetch>

      // Setup SSO providers first
      fetchMock
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              results: [{ provider: 'saml', available: true }]
            })
          } as Response)
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              healthStatuses: [{ provider: 'saml', healthy: true }]
            })
          } as Response)
        )

      render(<LoginPage />)

      await waitFor(() => {
        expect(screen.getByText('企业SSO登录')).toBeInTheDocument()
      })

      // Now mock error for SSO login
      fetchMock.mockImplementationOnce(() =>
        Promise.reject(new Error('SSO login failed'))
      )

      const samlButton = screen.getByText('企业SSO登录')
      fireEvent.click(samlButton)

      await waitFor(() => {
        expect(screen.getByText('SSO login failed')).toBeInTheDocument()
      })
    })
  })

  describe('Form Validation and Submission', () => {
    beforeEach(async () => {
      const fetchMock = fetch as jest.MockedFunction<typeof fetch>

      // Mock no SSO providers available to show local auth
      fetchMock
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              results: []
            })
          } as Response)
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              healthStatuses: []
            })
          } as Response)
        )

      render(<LoginPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('用户名或邮箱')).toBeInTheDocument()
      })
    })

    it('validates required fields', async () => {
      // Ensure form is fully rendered
      await waitFor(() => {
        expect(screen.getByPlaceholderText('用户名或邮箱')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('密码')).toBeInTheDocument()
      })

      const form = screen.getByRole('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText('用户名不能为空')).toBeInTheDocument()
        expect(screen.getByText('密码不能为空')).toBeInTheDocument()
      })
    })

    it('submits form with valid data', async () => {
      const fetchMock = fetch as jest.MockedFunction<typeof fetch>

      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        } as Response)
      )

      const usernameInput = screen.getByPlaceholderText('用户名或邮箱')
      const passwordInput = screen.getByPlaceholderText('密码')
      const submitButton = screen.getByText('登录')

      fireEvent.change(usernameInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'test@example.com',
            password: 'password123'
          })
        })
      })

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/')
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it('handles login API errors', async () => {
      const fetchMock = fetch as jest.MockedFunction<typeof fetch>

      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: '用户名或密码错误' })
        } as Response)
      )

      const usernameInput = screen.getByPlaceholderText('用户名或邮箱')
      const passwordInput = screen.getByPlaceholderText('密码')
      const submitButton = screen.getByText('登录')

      fireEvent.change(usernameInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('用户名或密码错误')).toBeInTheDocument()
      })
    })
  })
})