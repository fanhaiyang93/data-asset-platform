'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
  Eye,
  Calendar,
  Clock,
  User,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { SSOLog } from '@/types/sso'

interface LogsResponse {
  success: boolean
  logs: SSOLog[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export default function SSOLogs() {
  const [logs, setLogs] = useState<SSOLog[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedLog, setSelectedLog] = useState<SSOLog | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  })

  // 过滤器状态
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    status: '',
    providerId: '',
    startDate: '',
    endDate: ''
  })

  useEffect(() => {
    fetchLogs()
  }, [pagination.page, pagination.limit])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        )
      })

      const response = await fetch(`/api/admin/sso/logs?${params}`)
      if (response.ok) {
        const data: LogsResponse = await response.json()
        setLogs(data.logs)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchLogs()
  }

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'success':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            成功
          </Badge>
        )
      case 'failure':
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            失败
          </Badge>
        )
      case 'warning':
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            警告
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getActionBadge = (action: string) => {
    const colors = {
      login: 'bg-blue-100 text-blue-800',
      logout: 'bg-gray-100 text-gray-800',
      health_check: 'bg-purple-100 text-purple-800',
      config_update: 'bg-orange-100 text-orange-800',
      user_provision: 'bg-green-100 text-green-800'
    }

    const labels = {
      login: '登录',
      logout: '登出',
      health_check: '健康检查',
      config_update: '配置更新',
      user_provision: '用户创建'
    }

    return (
      <Badge className={colors[action as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {labels[action as keyof typeof labels] || action}
      </Badge>
    )
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* 过滤器区域 */}
      <Card>
        <CardHeader>
          <CardTitle>日志过滤器</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="搜索用户邮箱..."
                className="pl-10"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>

            <Select
              value={filters.action}
              onValueChange={(value) => setFilters(prev => ({ ...prev, action: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="操作类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部操作</SelectItem>
                <SelectItem value="login">登录</SelectItem>
                <SelectItem value="logout">登出</SelectItem>
                <SelectItem value="health_check">健康检查</SelectItem>
                <SelectItem value="config_update">配置更新</SelectItem>
                <SelectItem value="user_provision">用户创建</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部状态</SelectItem>
                <SelectItem value="success">成功</SelectItem>
                <SelectItem value="failure">失败</SelectItem>
                <SelectItem value="warning">警告</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              placeholder="开始日期"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
            />

            <Input
              type="date"
              placeholder="结束日期"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
            />

            <div className="flex gap-2">
              <Button onClick={handleSearch} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                搜索
              </Button>
              <Button variant="outline" onClick={fetchLogs} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 日志表格 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>认证日志</CardTitle>
            <div className="text-sm text-muted-foreground">
              共 {pagination.total} 条记录
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              加载中...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">没有找到匹配的日志记录</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>时间</TableHead>
                      <TableHead>提供商</TableHead>
                      <TableHead>用户</TableHead>
                      <TableHead>操作</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>响应时间</TableHead>
                      <TableHead>IP地址</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center text-sm">
                            <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                            {formatTimestamp(log.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{log.provider?.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {log.provider?.type}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.email ? (
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-2 text-muted-foreground" />
                              <span className="text-sm">{log.email}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getActionBadge(log.action)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(log.status)}
                        </TableCell>
                        <TableCell>
                          {log.responseTime ? (
                            <span className={`text-sm ${
                              log.responseTime < 1000 ? 'text-green-600' :
                              log.responseTime < 3000 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {log.responseTime}ms
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono">
                            {log.ipAddress || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 分页控件 */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  显示第 {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} 条，共 {pagination.total} 条
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一页
                  </Button>
                  <span className="text-sm">
                    {pagination.page} / {pagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.pages}
                  >
                    下一页
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 日志详情模态框 */}
      {selectedLog && (
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>日志详情</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">时间</label>
                  <p className="mt-1">{formatTimestamp(selectedLog.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">会话ID</label>
                  <p className="mt-1 font-mono text-sm">{selectedLog.sessionId || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">提供商</label>
                  <p className="mt-1">{selectedLog.provider?.name} ({selectedLog.provider?.type})</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">用户</label>
                  <p className="mt-1">{selectedLog.email || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">操作</label>
                  <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">状态</label>
                  <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">响应时间</label>
                  <p className="mt-1">{selectedLog.responseTime ? `${selectedLog.responseTime}ms` : '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">IP地址</label>
                  <p className="mt-1 font-mono text-sm">{selectedLog.ipAddress || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">错误代码</label>
                  <p className="mt-1">{selectedLog.errorCode || '-'}</p>
                </div>
              </div>

              {selectedLog.message && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">消息</label>
                  <p className="mt-1 p-3 bg-gray-50 rounded-md text-sm">{selectedLog.message}</p>
                </div>
              )}

              {selectedLog.userAgent && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">用户代理</label>
                  <p className="mt-1 p-3 bg-gray-50 rounded-md text-sm font-mono break-all">
                    {selectedLog.userAgent}
                  </p>
                </div>
              )}

              {selectedLog.metadata && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">元数据</label>
                  <pre className="mt-1 p-3 bg-gray-50 rounded-md text-sm overflow-x-auto">
                    {JSON.stringify(JSON.parse(selectedLog.metadata), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}