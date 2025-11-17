'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
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
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import {
  Activity,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Database,
  Zap,
  TrendingUp,
  TrendingDown,
  Monitor,
  Shield
} from 'lucide-react'
import { SSOProvider } from '@/types/sso'
import { toast } from '@/hooks/use-toast'

interface MonitoringMetrics {
  totalLogins: number
  successfulLogins: number
  failedLogins: number
  successRate: string
  uniqueUsers: number
  averageResponseTime: number
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'critical'
  checks: {
    database: boolean
    ssoProviders: boolean
    responseTime: number
    errorRate: number
    systemLoad: number
  }
  timestamp: string
}

interface PerformanceData {
  averageResponseTime: number
  loginsByHour: Array<{ hour: number; count: number }>
  responseTimeDistribution: {
    ranges: Array<{ range: string; count: number }>
  }
}

interface ErrorData {
  topErrors: Array<{ error: string; count: number }>
  errorTrends: Array<{ hour: number; errors: number }>
  errorsByProvider: Array<{ providerId: string; providerName: string; errors: number }>
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export default function SSOMonitoringPage() {
  const [providers, setProviders] = useState<SSOProvider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<string>('24h')
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false)

  // 数据状态
  const [metrics, setMetrics] = useState<MonitoringMetrics | null>(null)
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null)
  const [errorData, setErrorData] = useState<ErrorData | null>(null)

  // 对话框状态
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showCleanupDialog, setShowCleanupDialog] = useState(false)

  useEffect(() => {
    fetchProviders()
    fetchData()
  }, [])

  useEffect(() => {
    fetchData()
  }, [selectedProvider, timeRange])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (autoRefresh) {
      interval = setInterval(() => {
        fetchData()
      }, 30000) // 30秒刷新一次
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh, selectedProvider, timeRange])

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/admin/sso/providers')
      if (response.ok) {
        const data = await response.json()
        setProviders(data.providers)
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error)
    }
  }

  const fetchData = async () => {
    try {
      const params = new URLSearchParams({
        timeRange,
        ...(selectedProvider !== 'all' && { providerId: selectedProvider })
      })

      // 根据当前活跃标签获取不同类型的数据
      let metricType = 'overview'
      switch (activeTab) {
        case 'performance':
          metricType = 'performance'
          break
        case 'errors':
          metricType = 'errors'
          break
        case 'usage':
          metricType = 'usage'
          break
      }

      const [metricsResponse, healthResponse] = await Promise.all([
        fetch(`/api/admin/sso/monitoring?${params}&metricType=${metricType}`),
        fetch('/api/admin/sso/monitoring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'health_check' })
        })
      ])

      if (metricsResponse.ok) {
        const data = await metricsResponse.json()

        switch (metricType) {
          case 'overview':
            setMetrics(data.metrics)
            break
          case 'performance':
            setPerformanceData(data.performance)
            break
          case 'errors':
            setErrorData(data.errors)
            break
        }
      }

      if (healthResponse.ok) {
        const healthData = await healthResponse.json()
        setHealthStatus(healthData.health)
      }
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExportLogs = async (format: 'json' | 'csv') => {
    try {
      const response = await fetch('/api/admin/sso/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export_logs',
          format,
          options: {
            ...(selectedProvider !== 'all' && { providerId: selectedProvider }),
            startDate: new Date(Date.now() - getTimeRangeMs(timeRange)),
            endDate: new Date(),
            limit: 10000
          }
        })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = url
        a.download = `sso_logs_${new Date().toISOString().split('T')[0]}.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)

        toast({
          title: '导出成功',
          description: `日志已导出为 ${format.toUpperCase()} 格式`
        })
      }
    } catch (error) {
      toast({
        title: '导出失败',
        description: '无法导出日志数据',
        variant: 'destructive'
      })
    } finally {
      setShowExportDialog(false)
    }
  }

  const handleCleanupLogs = async () => {
    try {
      const response = await fetch('/api/admin/sso/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cleanup_logs',
          daysToKeep: 90
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: '清理完成',
          description: data.message
        })
        fetchData() // 刷新数据
      }
    } catch (error) {
      toast({
        title: '清理失败',
        description: '无法清理日志数据',
        variant: 'destructive'
      })
    } finally {
      setShowCleanupDialog(false)
    }
  }

  const getTimeRangeMs = (range: string): number => {
    switch (range) {
      case '1h': return 60 * 60 * 1000
      case '24h': return 24 * 60 * 60 * 1000
      case '7d': return 7 * 24 * 60 * 60 * 1000
      case '30d': return 30 * 24 * 60 * 60 * 1000
      default: return 24 * 60 * 60 * 1000
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600'
      case 'degraded': return 'text-yellow-600'
      case 'critical': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'degraded': return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'critical': return <XCircle className="h-4 w-4 text-red-600" />
      default: return <AlertTriangle className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">SSO 监控中心</h1>
          <p className="text-muted-foreground">实时监控SSO系统性能和健康状态</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {autoRefresh ? '自动刷新中' : '自动刷新'}
          </Button>
          <Button variant="outline" onClick={() => setShowExportDialog(true)}>
            <Download className="h-4 w-4 mr-2" />
            导出日志
          </Button>
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* 控制面板 */}
      <div className="flex gap-4 items-center mb-6">
        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="选择提供商" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有提供商</SelectItem>
            {providers.map(provider => (
              <SelectItem key={provider.id} value={provider.id}>
                {provider.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">1小时</SelectItem>
            <SelectItem value="24h">24小时</SelectItem>
            <SelectItem value="7d">7天</SelectItem>
            <SelectItem value="30d">30天</SelectItem>
          </SelectContent>
        </Select>

        {healthStatus && (
          <div className="flex items-center gap-2">
            {getStatusIcon(healthStatus.status)}
            <span className={`font-medium ${getStatusColor(healthStatus.status)}`}>
              {healthStatus.status === 'healthy' ? '系统健康' :
               healthStatus.status === 'degraded' ? '性能下降' : '系统异常'}
            </span>
          </div>
        )}
      </div>

      {/* 核心指标卡片 */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">总登录次数</p>
                  <p className="text-2xl font-bold">{metrics.totalLogins.toLocaleString()}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">成功登录</p>
                  <p className="text-2xl font-bold text-green-600">{metrics.successfulLogins.toLocaleString()}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">失败登录</p>
                  <p className="text-2xl font-bold text-red-600">{metrics.failedLogins.toLocaleString()}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">成功率</p>
                  <p className="text-2xl font-bold">{metrics.successRate}%</p>
                  <Progress value={parseFloat(metrics.successRate)} className="w-full h-2 mt-2" />
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">活跃用户</p>
                  <p className="text-2xl font-bold">{metrics.uniqueUsers.toLocaleString()}</p>
                </div>
                <Activity className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">平均响应时间</p>
                  <p className="text-2xl font-bold">{metrics.averageResponseTime}ms</p>
                  <Badge variant={metrics.averageResponseTime < 1000 ? "default" : "destructive"} className="mt-1">
                    {metrics.averageResponseTime < 1000 ? '良好' : '需优化'}
                  </Badge>
                </div>
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 详细监控面板 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="performance">性能</TabsTrigger>
          <TabsTrigger value="errors">错误分析</TabsTrigger>
          <TabsTrigger value="system">系统状态</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {performanceData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>24小时登录趋势</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={performanceData.loginsByHour}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="count" stroke="#0088FE" fill="#0088FE" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>响应时间分布</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={performanceData.responseTimeDistribution.ranges}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#00C49F" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          {performanceData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>登录活动趋势</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={performanceData.loginsByHour}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#0088FE" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>响应时间分析</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">
                        {performanceData.averageResponseTime}ms
                      </div>
                      <div className="text-sm text-muted-foreground">平均响应时间</div>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={performanceData.responseTimeDistribution.ranges}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                          label={({ range, percent }) => `${range} ${(percent * 100).toFixed(0)}%`}
                        >
                          {performanceData.responseTimeDistribution.ranges.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="errors" className="space-y-6">
          {errorData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>错误趋势</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={errorData.errorTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="errors" stroke="#FF8042" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>主要错误类型</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {errorData.topErrors.map((error, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{error.error}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{error.count}</span>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-red-600 h-2 rounded-full"
                              style={{
                                width: `${(error.count / Math.max(...errorData.topErrors.map(e => e.count))) * 100}%`
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          {healthStatus && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">数据库连接</p>
                      <p className={`text-lg font-bold ${healthStatus.checks.database ? 'text-green-600' : 'text-red-600'}`}>
                        {healthStatus.checks.database ? '正常' : '异常'}
                      </p>
                    </div>
                    {healthStatus.checks.database ? (
                      <Database className="h-8 w-8 text-green-600" />
                    ) : (
                      <Database className="h-8 w-8 text-red-600" />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">SSO提供商</p>
                      <p className={`text-lg font-bold ${healthStatus.checks.ssoProviders ? 'text-green-600' : 'text-red-600'}`}>
                        {healthStatus.checks.ssoProviders ? '正常' : '异常'}
                      </p>
                    </div>
                    {healthStatus.checks.ssoProviders ? (
                      <Shield className="h-8 w-8 text-green-600" />
                    ) : (
                      <Shield className="h-8 w-8 text-red-600" />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">响应时间</p>
                      <p className="text-lg font-bold">{healthStatus.checks.responseTime}ms</p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">错误率</p>
                      <p className={`text-lg font-bold ${healthStatus.checks.errorRate < 5 ? 'text-green-600' : 'text-red-600'}`}>
                        {healthStatus.checks.errorRate.toFixed(2)}%
                      </p>
                    </div>
                    {healthStatus.checks.errorRate < 5 ? (
                      <TrendingDown className="h-8 w-8 text-green-600" />
                    ) : (
                      <TrendingUp className="h-8 w-8 text-red-600" />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">系统负载</p>
                      <p className="text-lg font-bold">{healthStatus.checks.systemLoad.toFixed(1)}%</p>
                      <Progress value={healthStatus.checks.systemLoad} className="w-full h-2 mt-2" />
                    </div>
                    <Monitor className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">最后检查</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(healthStatus.timestamp).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <RefreshCw className="h-8 w-8 text-gray-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>系统维护</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setShowCleanupDialog(true)}>
                  清理过期日志
                </Button>
                <Button variant="outline" onClick={() => fetchData()}>
                  刷新健康检查
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 导出日志对话框 */}
      <AlertDialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>导出日志</AlertDialogTitle>
            <AlertDialogDescription>
              选择要导出的日志格式。导出的日志将包含当前时间范围和过滤条件的数据。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleExportLogs('csv')}>
              导出CSV
            </AlertDialogAction>
            <AlertDialogAction onClick={() => handleExportLogs('json')}>
              导出JSON
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 清理日志对话框 */}
      <AlertDialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清理过期日志</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将删除90天以前的所有SSO日志记录。此操作无法撤销，请确认是否继续。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleCleanupLogs}>
              确认清理
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}