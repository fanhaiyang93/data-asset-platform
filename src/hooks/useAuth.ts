'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  username: string
  email: string
  name?: string
  role?: string
  department?: string
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}

export function useAuth() {
  const router = useRouter()
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  })

  // 检查认证状态
  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        cache: 'no-store',
      })

      console.log('[useAuth] checkAuth response:', response.status, response.ok)

      if (response.ok) {
        const data = await response.json()
        console.log('[useAuth] checkAuth data:', data)

        // 确保user对象存在才设置为已认证
        if (data && data.user) {
          setAuthState({
            user: data.user,
            isLoading: false,
            isAuthenticated: true,
          })
          console.log('[useAuth] User authenticated:', data.user.email)
        } else {
          console.warn('[useAuth] Response OK but no user data')
          setAuthState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
          })
        }
      } else {
        console.log('[useAuth] Response not OK, status:', response.status)
        setAuthState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        })
      }
    } catch (error) {
      console.error('[useAuth] Auth check error:', error)
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      })
    }
  }, [])

  // 登录
  const login = useCallback(async (username: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok) {
        setAuthState({
          user: data.user,
          isLoading: false,
          isAuthenticated: true,
        })
        return { success: true }
      } else {
        return { success: false, error: data.error }
      }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: '登录失败，请重试' }
    }
  }, [])

  // 登出
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      })
      router.push('/login')
    }
  }, [router])

  // 重定向到登录页面
  const redirectToLogin = useCallback(() => {
    router.push('/login')
  }, [router])

  // 初始化时检查认证状态
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return {
    ...authState,
    login,
    logout,
    redirectToLogin,
    checkAuth,
  }
}