'use client'

import { useState, useEffect } from 'react'
import { AdminHeader } from './AdminHeader'
import { AdminNavigation } from './AdminNavigation'
import { AdminLayoutConfig } from '@/types/admin'

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [config, setConfig] = useState<AdminLayoutConfig>({
    sidebarCollapsed: false,
    theme: 'light',
    compactMode: false
  })

  // 从本地存储加载布局配置
  useEffect(() => {
    const savedConfig = localStorage.getItem('admin-layout-config')
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig)
        setConfig(prev => ({ ...prev, ...parsed }))
      } catch (error) {
        console.error('Failed to parse layout config:', error)
      }
    }
  }, [])

  // 保存布局配置到本地存储
  useEffect(() => {
    localStorage.setItem('admin-layout-config', JSON.stringify(config))
  }, [config])

  const toggleSidebar = () => {
    setConfig(prev => ({
      ...prev,
      sidebarCollapsed: !prev.sidebarCollapsed
    }))
  }

  // 响应式处理
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setConfig(prev => ({ ...prev, sidebarCollapsed: true }))
      }
    }

    window.addEventListener('resize', handleResize)
    handleResize() // 初始检查

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 侧边栏 */}
      <div className="relative">
        <AdminNavigation collapsed={config.sidebarCollapsed} />
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部导航 */}
        <AdminHeader
          sidebarCollapsed={config.sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
        />

        {/* 主内容 */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>

      {/* 移动端遮罩 */}
      {!config.sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={toggleSidebar}
        />
      )}
    </div>
  )
}