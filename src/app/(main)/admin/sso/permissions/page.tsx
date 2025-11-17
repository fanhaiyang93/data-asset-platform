'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Users,
  Settings,
  RefreshCw as Sync,
  Plus,
  RefreshCw,
  Shield,
  UserCheck,
  AlertTriangle,
  CheckCircle,
  Edit,
  Trash2
} from 'lucide-react'
import RoleMappingRules from '@/components/admin/sso/RoleMappingRules'
import UserSyncPanel from '@/components/admin/sso/UserSyncPanel'
import { SSOProvider } from '@/types/sso'
import { toast } from '@/hooks/use-toast'

interface UserPermissionStats {
  total: number
  byRole: Array<{
    role: string
    count: number
  }>
}

interface SyncActivity {
  id: string
  providerId: string
  userId?: string
  email?: string
  action: string
  status: string
  message?: string
  createdAt: string
  provider?: {
    name: string
    type: string
  }
}

export default function SSOPermissionsPage() {
  const [providers, setProviders] = useState<SSOProvider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<UserPermissionStats | null>(null)
  const [syncActivity, setSyncActivity] = useState<SyncActivity[]>([])
  const [showSyncDialog, setShowSyncDialog] = useState(false)

  useEffect(() => {
    fetchProviders()
  }, [])

  useEffect(() => {
    if (selectedProvider) {
      fetchPermissionStats()
      fetchSyncActivity()
    }
  }, [selectedProvider])

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/admin/sso/providers')
      if (response.ok) {
        const data = await response.json()
        setProviders(data.providers)
        if (data.providers.length > 0 && !selectedProvider) {
          setSelectedProvider(data.providers[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPermissionStats = async () => {
    if (!selectedProvider) return

    try {
      const response = await fetch(`/api/admin/sso/users/sync?providerId=${selectedProvider}`)
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
        setSyncActivity(data.recentActivity)
      }
    } catch (error) {
      console.error('Failed to fetch permission stats:', error)
    }
  }

  const fetchSyncActivity = async () => {
    if (!selectedProvider) return

    try {
      const response = await fetch(`/api/admin/sso/users/sync?providerId=${selectedProvider}&limit=20`)
      if (response.ok) {
        const data = await response.json()
        setSyncActivity(data.recentActivity)
      }
    } catch (error) {
      console.error('Failed to fetch sync activity:', error)
    }
  }

  const handleManualSync = async () => {
    if (!selectedProvider) return

    setLoading(true)
    try {
      const response = await fetch('/api/admin/sso/users/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerId: selectedProvider,
          syncType: 'manual'
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: '同步完成',
          description: `成功同步 ${data.stats.total} 个用户，创建 ${data.stats.created} 个，更新 ${data.stats.updated} 个`
        })

        // 刷新数据
        fetchPermissionStats()
        fetchSyncActivity()
      } else {
        throw new Error('同步失败')
      }
    } catch (error) {
      toast({
        title: '同步失败',
        description: '无法执行用户同步',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
      setShowSyncDialog(false)
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SYSTEM_ADMIN':
        return <Badge className="bg-red-100 text-red-800">系统管理员</Badge>
      case 'DATA_ADMIN':
        return <Badge className="bg-blue-100 text-blue-800">数据管理员</Badge>
      case 'BUSINESS_USER':
        return <Badge className="bg-green-100 text-green-800">业务用户</Badge>
      default:
        return <Badge variant="outline">{role}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failure':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
    }
  }

  const selectedProviderData = providers.find(p => p.id === selectedProvider)

  if (loading && providers.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          加载中...
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">SSO 权限管理</h1>
          <p className="text-muted-foreground">管理SSO用户权限映射和同步设置</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchPermissionStats}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button onClick={() => setShowSyncDialog(true)} disabled={!selectedProvider}>
            <Sync className="h-4 w-4 mr-2" />
            手动同步
          </Button>
        </div>
      </div>

      {/* 提供商选择 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>选择SSO提供商</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="选择SSO提供商" />
              </SelectTrigger>
              <SelectContent>
                {providers.map(provider => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name} ({provider.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProviderData && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedProviderData.type}</Badge>
                <Badge
                  className={
                    selectedProviderData.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }
                >
                  {selectedProviderData.status === 'ACTIVE' ? '活跃' : '非活跃'}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 统计概览 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">总用户数</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          {stats.byRole.map(roleData => (
            <Card key={roleData.role}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {roleData.role === 'SYSTEM_ADMIN' ? '系统管理员' :
                       roleData.role === 'DATA_ADMIN' ? '数据管理员' :
                       roleData.role === 'BUSINESS_USER' ? '业务用户' : roleData.role}
                    </p>
                    <p className="text-2xl font-bold">{roleData.count}</p>
                  </div>
                  <Shield className={`h-8 w-8 ${
                    roleData.role === 'SYSTEM_ADMIN' ? 'text-red-600' :
                    roleData.role === 'DATA_ADMIN' ? 'text-blue-600' :
                    'text-green-600'
                  }`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 主要内容区域 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="rules">角色映射规则</TabsTrigger>
          <TabsTrigger value="sync">用户同步</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* 最近同步活动 */}
          <Card>
            <CardHeader>
              <CardTitle>最近同步活动</CardTitle>
            </CardHeader>
            <CardContent>
              {syncActivity.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">暂无同步活动</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>时间</TableHead>
                        <TableHead>用户</TableHead>
                        <TableHead>操作</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>消息</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {syncActivity.slice(0, 10).map((activity) => (
                        <TableRow key={activity.id}>
                          <TableCell>
                            {new Date(activity.createdAt).toLocaleString('zh-CN')}
                          </TableCell>
                          <TableCell>
                            {activity.email || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{activity.action}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(activity.status)}
                              <span>{activity.status}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {activity.message || '-'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <RoleMappingRules providerId={selectedProvider} />
        </TabsContent>

        <TabsContent value="sync">
          <UserSyncPanel
            providerId={selectedProvider}
            onSyncComplete={() => {
              fetchPermissionStats()
              fetchSyncActivity()
            }}
          />
        </TabsContent>
      </Tabs>

      {/* 手动同步确认对话框 */}
      <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认手动同步</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>确定要手动同步 "{selectedProviderData?.name}" 的用户权限吗？</p>
            <p className="text-sm text-muted-foreground">
              此操作将从SSO提供商获取最新的用户信息并更新本地权限设置。
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSyncDialog(false)}>
                取消
              </Button>
              <Button onClick={handleManualSync} disabled={loading}>
                {loading ? '同步中...' : '确认同步'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}