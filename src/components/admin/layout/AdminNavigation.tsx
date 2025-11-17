'use client'

import { useState, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Database,
  FileText,
  Users,
  Settings,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { useUserPermissions } from '@/components/auth/RouteGuard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { AdminMenuItem, AdminRole } from '@/types/admin'

interface AdminNavigationProps {
  collapsed: boolean
}

// 菜单配置
const MENU_CONFIG: AdminMenuItem[] = [
  {
    id: 'dashboard',
    label: '数据概览',
    path: '/admin',
    icon: 'LayoutDashboard',
    roles: ['ASSET_MANAGER', 'SYSTEM_ADMIN']
  },
  {
    id: 'assets',
    label: '资产管理',
    path: '/admin/assets',
    icon: 'Database',
    roles: ['ASSET_MANAGER', 'SYSTEM_ADMIN'],
    children: [
      {
        id: 'assets-list',
        label: '资产列表',
        path: '/admin/assets',
        roles: ['ASSET_MANAGER', 'SYSTEM_ADMIN']
      },
      {
        id: 'assets-categories',
        label: '分类管理',
        path: '/admin/assets/categories',
        roles: ['ASSET_MANAGER', 'SYSTEM_ADMIN']
      },
      {
        id: 'assets-onboarding',
        label: '资产接入',
        path: '/admin/assets/onboarding',
        roles: ['ASSET_MANAGER', 'SYSTEM_ADMIN']
      }
    ]
  },
  {
    id: 'applications',
    label: '申请管理',
    path: '/admin/applications',
    icon: 'FileText',
    roles: ['ASSET_MANAGER', 'SYSTEM_ADMIN'],
    children: [
      {
        id: 'applications-pending',
        label: '待处理申请',
        path: '/admin/applications/pending',
        roles: ['ASSET_MANAGER', 'SYSTEM_ADMIN'],
        badge: 'new'
      },
      {
        id: 'applications-history',
        label: '申请历史',
        path: '/admin/applications/history',
        roles: ['ASSET_MANAGER', 'SYSTEM_ADMIN']
      }
    ]
  },
  {
    id: 'users',
    label: '用户管理',
    path: '/admin/users',
    icon: 'Users',
    roles: ['SYSTEM_ADMIN']
  },
  {
    id: 'settings',
    label: '系统设置',
    path: '/admin/settings',
    icon: 'Settings',
    roles: ['SYSTEM_ADMIN'],
    children: [
      {
        id: 'settings-sso',
        label: 'SSO设置',
        path: '/admin/sso',
        roles: ['SYSTEM_ADMIN']
      },
      {
        id: 'settings-permissions',
        label: '权限管理',
        path: '/admin/settings/permissions',
        roles: ['SYSTEM_ADMIN']
      }
    ]
  }
]

// 图标映射
const ICON_MAP = {
  LayoutDashboard,
  Database,
  FileText,
  Users,
  Settings
}

export function AdminNavigation({ collapsed }: AdminNavigationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useUserPermissions()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['assets', 'applications']))

  // 根据用户角色过滤菜单项
  const filteredMenuItems = useMemo(() => {
    if (!user) return []

    const userRole = user.role as AdminRole
    const filterByRole = (items: AdminMenuItem[]): AdminMenuItem[] => {
      return items
        .filter(item => item.roles.includes(userRole))
        .map(item => ({
          ...item,
          children: item.children ? filterByRole(item.children) : undefined
        }))
    }

    return filterByRole(MENU_CONFIG)
  }, [user])

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

  const isActive = (path: string) => {
    if (path === '/admin') {
      return pathname === '/admin'
    }
    return pathname.startsWith(path)
  }

  const renderMenuItem = (item: AdminMenuItem, level = 0) => {
    const IconComponent = ICON_MAP[item.icon as keyof typeof ICON_MAP]
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems.has(item.id)
    const active = isActive(item.path)

    return (
      <div key={item.id} className="space-y-1">
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start text-left font-normal',
            level > 0 && 'ml-6 pl-4',
            active && 'bg-blue-50 text-blue-700 border-r-2 border-blue-700',
            collapsed && level === 0 && 'px-2',
            !collapsed && 'px-3 py-2'
          )}
          onClick={() => {
            if (hasChildren) {
              toggleExpanded(item.id)
            } else {
              router.push(item.path)
            }
          }}
        >
          <div className="flex items-center w-full">
            {IconComponent && level === 0 && (
              <IconComponent className={cn('h-4 w-4', !collapsed && 'mr-3')} />
            )}

            {!collapsed && (
              <>
                <span className="flex-1">{item.label}</span>

                {item.badge && (
                  <Badge
                    variant={item.badge === 'new' ? 'destructive' : 'secondary'}
                    className="h-5 text-xs ml-2"
                  >
                    {item.badge === 'new' ? '新' : item.badge}
                  </Badge>
                )}

                {hasChildren && (
                  isExpanded ?
                    <ChevronDown className="h-4 w-4 ml-2" /> :
                    <ChevronRight className="h-4 w-4 ml-2" />
                )}
              </>
            )}
          </div>
        </Button>

        {/* 子菜单 */}
        {hasChildren && !collapsed && isExpanded && (
          <div className="space-y-1">
            {item.children?.map(child => renderMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside
      className={cn(
        'bg-white border-r border-gray-200 h-full transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="p-4">
        {!collapsed && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">管理后台</h2>
            <p className="text-sm text-gray-500">数据资产管理平台</p>
          </div>
        )}

        <nav className="space-y-2">
          {filteredMenuItems.map(item => renderMenuItem(item))}
        </nav>
      </div>

      {/* 底部用户信息 */}
      {!collapsed && user && (
        <div className="absolute bottom-4 left-4 right-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {user.name?.[0] || user.username[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.name || user.username}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user.role === 'SYSTEM_ADMIN' ? '系统管理员' : '资产管理员'}
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}