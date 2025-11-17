'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { useAuth } from './useAuth'

const SESSION_TIMEOUT = 30 * 60 * 1000 // 30分钟（毫秒）
const WARNING_TIME = 5 * 60 * 1000 // 提前5分钟警告
const CHECK_INTERVAL = 60 * 1000 // 每分钟检查一次

export function useSessionTimeout() {
  const { logout, isAuthenticated } = useAuth()
  const [showWarning, setShowWarning] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const lastActivityRef = useRef<number>(Date.now())
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const warningTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const checkIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // 重置活动时间
  const resetActivity = useCallback(() => {
    if (!isAuthenticated) return

    lastActivityRef.current = Date.now()
    setShowWarning(false)

    // 清除现有的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current)
    }

    // 设置新的警告定时器
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true)
      setTimeLeft(WARNING_TIME)
    }, SESSION_TIMEOUT - WARNING_TIME)

    // 设置新的登出定时器
    timeoutRef.current = setTimeout(() => {
      logout()
    }, SESSION_TIMEOUT)
  }, [isAuthenticated, logout])

  // 手动延长会话
  const extendSession = useCallback(() => {
    resetActivity()
  }, [resetActivity])

  // 监听用户活动
  const handleUserActivity = useCallback(() => {
    resetActivity()
  }, [resetActivity])

  // 检查会话剩余时间
  const checkTimeLeft = useCallback(() => {
    if (!isAuthenticated || !showWarning) return

    const elapsed = Date.now() - lastActivityRef.current
    const remaining = SESSION_TIMEOUT - elapsed

    if (remaining <= 0) {
      logout()
      return
    }

    if (remaining <= WARNING_TIME) {
      setTimeLeft(remaining)
    } else {
      setShowWarning(false)
    }
  }, [isAuthenticated, showWarning, logout])

  // 初始化和清理
  useEffect(() => {
    if (!isAuthenticated) {
      // 清理所有定时器
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
      if (checkIntervalRef.current) clearTimeout(checkIntervalRef.current)
      setShowWarning(false)
      return
    }

    resetActivity()

    // 监听用户活动事件
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, true)
    })

    // 定期检查时间
    checkIntervalRef.current = setInterval(checkTimeLeft, CHECK_INTERVAL)

    return () => {
      // 清理事件监听器
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity, true)
      })

      // 清理定时器
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
      if (checkIntervalRef.current) clearTimeout(checkIntervalRef.current)
    }
  }, [isAuthenticated, resetActivity, handleUserActivity, checkTimeLeft])

  return {
    showWarning,
    timeLeft,
    extendSession,
    formatTimeLeft: (time: number) => {
      const minutes = Math.floor(time / 60000)
      const seconds = Math.floor((time % 60000) / 1000)
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    },
  }
}