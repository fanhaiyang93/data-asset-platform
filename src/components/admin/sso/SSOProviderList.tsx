'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  MoreHorizontal,
  Edit,
  Trash2,
  TestTube,
  BarChart3,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  RefreshCw
} from 'lucide-react'
import { SSOProvider, SSOConnectionTestResult } from '@/types/sso'
import { toast } from '@/hooks/use-toast'

interface SSOProviderListProps {
  providers: SSOProvider[]
  loading: boolean
  onEdit: (provider: SSOProvider) => void
  onRefresh: () => void
}

export default function SSOProviderList({
  providers,
  loading,
  onEdit,
  onRefresh
}: SSOProviderListProps) {
  const [deleteProvider, setDeleteProvider] = useState<SSOProvider | null>(null)
  const [testingProvider, setTestingProvider] = useState<string | null>(null)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-800">活跃</Badge>
      case 'INACTIVE':
        return <Badge className="bg-gray-100 text-gray-800">非活跃</Badge>
      case 'TESTING':
        return <Badge className="bg-yellow-100 text-yellow-800">测试中</Badge>
      case 'MAINTENANCE':
        return <Badge className="bg-orange-100 text-orange-800">维护中</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getHealthIcon = (healthStatus?: string) => {
    switch (healthStatus) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
    }
  }

  const handleTestConnection = async (provider: SSOProvider) => {
    setTestingProvider(provider.id)
    try {
      const response = await fetch(`/api/admin/sso/providers/${provider.id}/test`, {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()
        const result: SSOConnectionTestResult = data.result

        if (result.status === 'healthy') {
          toast({
            title: '连接测试成功',
            description: `${provider.name} 连接正常，响应时间: ${result.responseTime}ms`
          })
        } else {
          toast({
            title: '连接测试失败',
            description: result.errorMessage || '连接失败',
            variant: 'destructive'
          })
        }
        onRefresh()
      } else {
        throw new Error('测试请求失败')
      }
    } catch (error) {
      toast({
        title: '测试失败',
        description: '无法执行连接测试',
        variant: 'destructive'
      })
    } finally {
      setTestingProvider(null)
    }
  }

  const handleDeleteProvider = async () => {
    if (!deleteProvider) return

    try {
      const response = await fetch(`/api/admin/sso/providers/${deleteProvider.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: '删除成功',
          description: `SSO提供商 "${deleteProvider.name}" 已删除`
        })
        onRefresh()
      } else {
        throw new Error('删除失败')
      }
    } catch (error) {
      toast({
        title: '删除失败',
        description: '无法删除SSO提供商',
        variant: 'destructive'
      })
    } finally {
      setDeleteProvider(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            加载中...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>SSO 提供商</CardTitle>
            <Button variant="outline" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {providers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">尚未配置任何SSO提供商</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>健康状态</TableHead>
                  <TableHead>登录统计</TableHead>
                  <TableHead>最后检查</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell className="font-medium">
                      {provider.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{provider.type}</Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(provider.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getHealthIcon(provider.healthStatus)}
                        <span className="text-sm">
                          {provider.healthStatus === 'healthy' ? '健康' :
                           provider.healthStatus === 'unhealthy' ? '异常' : '未知'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>总计: {provider.totalLogins || 0}</div>
                        <div className="text-green-600">
                          成功: {provider.successfulLogins || 0}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {provider.lastHealthCheck
                          ? new Date(provider.lastHealthCheck).toLocaleString('zh-CN')
                          : '从未检查'
                        }
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(provider)}>
                            <Edit className="mr-2 h-4 w-4" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleTestConnection(provider)}
                            disabled={testingProvider === provider.id}
                          >
                            <TestTube className="mr-2 h-4 w-4" />
                            {testingProvider === provider.id ? '测试中...' : '测试连接'}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <BarChart3 className="mr-2 h-4 w-4" />
                            查看统计
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteProvider(provider)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deleteProvider} onOpenChange={() => setDeleteProvider(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除SSO提供商 "{deleteProvider?.name}" 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProvider}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}