'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Search, Settings, User, LogOut, Menu, X } from 'lucide-react'
import { useUserPermissions } from '@/components/auth/RouteGuard'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface AdminHeaderProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export function AdminHeader({ sidebarCollapsed, onToggleSidebar }: AdminHeaderProps) {
  const router = useRouter()
  const { user } = useUserPermissions()
  const [searchQuery, setSearchQuery] = useState('')

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/auth/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/admin/search?q=${encodeURIComponent(searchQuery)}`)
    }
  }

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 sticky top-0 z-40">
      {/* 左侧：菜单切换和标题 */}
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="p-2 hover:bg-gray-100"
        >
          {sidebarCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </Button>

        <div className="flex items-center space-x-2">
          <h1 className="text-lg font-semibold text-gray-900">管理后台</h1>
          <Badge variant="secondary" className="text-xs">
            {user?.role === 'SYSTEM_ADMIN' ? '系统管理员' : '资产管理员'}
          </Badge>
        </div>
      </div>

      {/* 中间：搜索框 */}
      <div className="flex-1 max-w-md mx-8">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="搜索资产、用户或申请..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-full"
          />
        </form>
      </div>

      {/* 右侧：通知和用户菜单 */}
      <div className="flex items-center space-x-4">
        {/* 通知按钮 */}
        <Button variant="ghost" size="sm" className="p-2 hover:bg-gray-100 relative">
          <Bell className="h-4 w-4" />
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs p-0"
          >
            3
          </Badge>
        </Button>

        {/* 设置按钮 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/admin/settings')}
          className="p-2 hover:bg-gray-100"
        >
          <Settings className="h-4 w-4" />
        </Button>

        {/* 用户菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="flex items-center space-x-2 hover:bg-gray-100">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
              {user && (
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium text-gray-900">
                    {user.name || user.username}
                  </div>
                  <div className="text-xs text-gray-500">{user.department}</div>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>我的账户</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/admin/profile')}>
              <User className="mr-2 h-4 w-4" />
              个人资料
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/admin/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              设置
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}