'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Database,
  Users,
  FileText,
  Activity,
  TrendingUp,
  Clock,
  Plus,
  Search,
  Settings
} from 'lucide-react'
import { useUserPermissions } from '@/components/auth/RouteGuard'
import { AdminButton } from '@/components/admin/ui/AdminButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SystemStats, QuickAction } from '@/types/admin'

interface StatsCardProps {
  title: string
  value: number
  icon: React.ReactNode
  trend?: {
    value: number
    label: string
    positive: boolean
  }
  onClick?: () => void
}

function StatsCard({ title, value, icon, trend, onClick }: StatsCardProps) {
  return (
    <Card
      className={cn(
        "transition-all duration-200",
        onClick && "cursor-pointer hover:shadow-md hover:scale-[1.02]"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">
          {title}
        </CardTitle>
        <div className="text-gray-400">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</div>
        {trend && (
          <div className="flex items-center text-xs mt-1">
            <TrendingUp
              className={cn(
                "h-3 w-3 mr-1",
                trend.positive ? "text-green-500" : "text-red-500"
              )}
            />
            <span className={trend.positive ? "text-green-600" : "text-red-600"}>
              {trend.positive ? '+' : ''}{trend.value}%
            </span>
            <span className="text-gray-500 ml-1">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}


export function AdminDashboard() {
  const router = useRouter()
  const { user, hasPermission } = useUserPermissions()
  const [stats, setStats] = useState<SystemStats>({
    totalAssets: 0,
    totalUsers: 0,
    pendingApplications: 0,
    recentActivities: []
  })
  const [loading, setLoading] = useState(true)

  // 快捷操作配置
  const quickActions: QuickAction[] = [
    {
      id: 'new-asset',
      label: '添加资产',
      icon: 'Plus',
      path: '/admin/assets/new',
      roles: ['ASSET_MANAGER', 'SYSTEM_ADMIN'],
      description: '快速添加新的数据资产'
    },
    {
      id: 'search-assets',
      label: '搜索资产',
      icon: 'Search',
      path: '/admin/assets',
      roles: ['ASSET_MANAGER', 'SYSTEM_ADMIN'],
      description: '搜索和管理数据资产'
    },
    {
      id: 'pending-applications',
      label: '待处理申请',
      icon: 'Clock',
      path: '/admin/applications/pending',
      roles: ['ASSET_MANAGER', 'SYSTEM_ADMIN'],
      description: '处理待审核的资产申请'
    },
    {
      id: 'user-management',
      label: '用户管理',
      icon: 'Users',
      path: '/admin/users',
      roles: ['SYSTEM_ADMIN'],
      description: '管理系统用户和权限'
    },
    {
      id: 'system-settings',
      label: '系统设置',
      icon: 'Settings',
      path: '/admin/settings',
      roles: ['SYSTEM_ADMIN'],
      description: '配置系统参数和设置'
    }
  ]

  // 模拟加载统计数据
  useEffect(() => {
    const loadStats = async () => {
      try {
        // 这里应该调用实际的API
        // const response = await fetch('/api/admin/stats')
        // const data = await response.json()

        // 模拟数据
        await new Promise(resolve => setTimeout(resolve, 1000))

        setStats({
          totalAssets: 1247,
          totalUsers: 156,
          pendingApplications: 23,
          recentActivities: [
            {
              id: '1',
              type: 'asset',
              title: '新增数据资产',
              description: '用户张三新增了资产"用户行为分析表"',
              timestamp: new Date(Date.now() - 2 * 60 * 1000),
              user: { name: '张三' }
            },
            {
              id: '2',
              type: 'application',
              title: '申请审核',
              description: '资产申请#12345已通过审核',
              timestamp: new Date(Date.now() - 15 * 60 * 1000),
              user: { name: '李四' }
            },
            {
              id: '3',
              type: 'user',
              title: '用户注册',
              description: '新用户王五完成了账户注册',
              timestamp: new Date(Date.now() - 30 * 60 * 1000),
              user: { name: '王五' }
            },
            {
              id: '4',
              type: 'system',
              title: '系统更新',
              description: '数据资产管理系统完成版本更新',
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
              user: { name: '系统' }
            }
          ]
        })
      } catch (error) {
        console.error('Failed to load stats:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))

    if (minutes < 60) {
      return `${minutes}分钟前`
    } else if (hours < 24) {
      return `${hours}小时前`
    } else {
      return timestamp.toLocaleDateString('zh-CN')
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'asset':
        return <Database className="h-4 w-4" />
      case 'user':
        return <Users className="h-4 w-4" />
      case 'application':
        return <FileText className="h-4 w-4" />
      case 'system':
        return <Activity className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'asset':
        return 'bg-blue-100 text-blue-600'
      case 'user':
        return 'bg-green-100 text-green-600'
      case 'application':
        return 'bg-yellow-100 text-yellow-600'
      case 'system':
        return 'bg-purple-100 text-purple-600'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-0 pb-2">
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-16 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-24"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 欢迎信息 */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          欢迎回来，{user?.name || user?.username}！
        </h1>
        <p className="text-blue-100">
          这里是数据资产管理平台的管理后台，您可以在这里管理资产、用户和申请。
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="数据资产"
          value={stats.totalAssets}
          icon={<Database className="h-4 w-4" />}
          trend={{ value: 12, label: '本月', positive: true }}
          onClick={() => router.push('/admin/assets')}
        />

        <StatsCard
          title="用户数量"
          value={stats.totalUsers}
          icon={<Users className="h-4 w-4" />}
          trend={{ value: 8, label: '本月', positive: true }}
          onClick={() => hasPermission('users', 'read') && router.push('/admin/users')}
        />

        <StatsCard
          title="待处理申请"
          value={stats.pendingApplications}
          icon={<FileText className="h-4 w-4" />}
          onClick={() => router.push('/admin/applications/pending')}
        />

        <StatsCard
          title="系统活动"
          value={stats.recentActivities.length}
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 快捷操作 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>快捷操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickActions
                .filter(action =>
                  action.roles.includes(user?.role as any) &&
                  (action.id !== 'user-management' || hasPermission('users', 'read'))
                )
                .map(action => (
                  <AdminButton
                    key={action.id}
                    variant="outline"
                    className="w-full justify-start h-auto p-4"
                    onClick={() => router.push(action.path)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="mt-0.5">
                        {action.icon === 'Plus' && <Plus className="h-4 w-4" />}
                        {action.icon === 'Search' && <Search className="h-4 w-4" />}
                        {action.icon === 'Clock' && <Clock className="h-4 w-4" />}
                        {action.icon === 'Users' && <Users className="h-4 w-4" />}
                        {action.icon === 'Settings' && <Settings className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium">{action.label}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {action.description}
                        </div>
                      </div>
                    </div>
                  </AdminButton>
                ))}
            </CardContent>
          </Card>
        </div>

        {/* 最近活动 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>最近活动</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.recentActivities.map(activity => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full",
                      getActivityColor(activity.type)
                    )}>
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {activity.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatTimeAgo(activity.timestamp)}
                        </p>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {activity.description}
                      </p>
                      {activity.user && (
                        <p className="text-xs text-gray-500 mt-1">
                          操作者：{activity.user.name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}