'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react'
import { SSOProvider, SSOStatistics as SSOStats } from '@/types/sso'

interface SSOStatisticsProps {
  providers: SSOProvider[]
}

interface ProviderStats extends SSOStats {
  provider: SSOProvider
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export default function SSOStatistics({ providers }: SSOStatisticsProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>('all')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('30')
  const [statistics, setStatistics] = useState<ProviderStats[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchStatistics()
  }, [selectedPeriod, providers])

  const fetchStatistics = async () => {
    setLoading(true)
    try {
      const promises = providers.map(async (provider) => {
        const response = await fetch(
          `/api/admin/sso/providers/${provider.id}/statistics?days=${selectedPeriod}`
        )
        if (response.ok) {
          const data = await response.json()
          return {
            ...data.statistics,
            provider
          }
        }
        return {
          totalLogins: 0,
          successfulLogins: 0,
          failedLogins: 0,
          successRate: 0,
          averageResponseTime: 0,
          totalEvents: 0,
          provider
        }
      })

      const results = await Promise.all(promises)
      setStatistics(results)
    } catch (error) {
      console.error('Failed to fetch statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  // 计算总体统计
  const totalStats = statistics.reduce(
    (acc, stat) => ({
      totalLogins: acc.totalLogins + stat.totalLogins,
      successfulLogins: acc.successfulLogins + stat.successfulLogins,
      failedLogins: acc.failedLogins + stat.failedLogins,
      totalEvents: acc.totalEvents + stat.totalEvents,
      averageResponseTime: acc.averageResponseTime + stat.averageResponseTime
    }),
    { totalLogins: 0, successfulLogins: 0, failedLogins: 0, totalEvents: 0, averageResponseTime: 0 }
  )

  const overallSuccessRate = totalStats.totalLogins > 0
    ? (totalStats.successfulLogins / totalStats.totalLogins) * 100
    : 0

  const avgResponseTime = statistics.length > 0
    ? totalStats.averageResponseTime / statistics.length
    : 0

  // 过滤统计数据
  const filteredStats = selectedProvider === 'all'
    ? statistics
    : statistics.filter(stat => stat.provider.id === selectedProvider)

  // 准备图表数据
  const providerChartData = statistics.map(stat => ({
    name: stat.provider.name,
    successful: stat.successfulLogins,
    failed: stat.failedLogins,
    successRate: stat.successRate
  }))

  const statusDistribution = providers.reduce((acc, provider) => {
    acc[provider.status] = (acc[provider.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const statusChartData = Object.entries(statusDistribution).map(([status, count]) => ({
    name: status === 'ACTIVE' ? '活跃' :
          status === 'INACTIVE' ? '非活跃' :
          status === 'TESTING' ? '测试中' : '维护中',
    value: count,
    color: status === 'ACTIVE' ? '#10B981' :
           status === 'INACTIVE' ? '#6B7280' :
           status === 'TESTING' ? '#F59E0B' : '#EF4444'
  }))

  const healthDistribution = providers.reduce((acc, provider) => {
    const status = provider.healthStatus || 'unknown'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const healthChartData = Object.entries(healthDistribution).map(([status, count]) => ({
    name: status === 'healthy' ? '健康' :
          status === 'unhealthy' ? '异常' : '未知',
    value: count,
    color: status === 'healthy' ? '#10B981' :
           status === 'unhealthy' ? '#EF4444' : '#F59E0B'
  }))

  return (
    <div className="space-y-6">
      {/* 控制面板 */}
      <div className="flex gap-4 items-center">
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

        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7天</SelectItem>
            <SelectItem value="30">30天</SelectItem>
            <SelectItem value="90">90天</SelectItem>
          </SelectContent>
        </Select>

        <RefreshCw
          className={`h-5 w-5 cursor-pointer ${loading ? 'animate-spin' : ''}`}
          onClick={fetchStatistics}
        />
      </div>

      {/* 总体统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">总登录次数</p>
                <p className="text-2xl font-bold">{totalStats.totalLogins.toLocaleString()}</p>
                <div className="flex items-center text-sm text-green-600">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  +12% 相比上期
                </div>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">成功率</p>
                <p className="text-2xl font-bold">{overallSuccessRate.toFixed(1)}%</p>
                <Progress value={overallSuccessRate} className="w-full h-2 mt-2" />
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">失败次数</p>
                <p className="text-2xl font-bold text-red-600">{totalStats.failedLogins.toLocaleString()}</p>
                <div className="flex items-center text-sm text-red-600">
                  <TrendingDown className="h-4 w-4 mr-1" />
                  -5% 相比上期
                </div>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">平均响应时间</p>
                <p className="text-2xl font-bold">{Math.round(avgResponseTime)}ms</p>
                <Badge variant={avgResponseTime < 1000 ? "default" : "destructive"} className="mt-1">
                  {avgResponseTime < 1000 ? '良好' : '需优化'}
                </Badge>
              </div>
              <Clock className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 提供商登录统计 */}
        <Card>
          <CardHeader>
            <CardTitle>提供商登录统计</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={providerChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="successful" stackId="a" fill="#10B981" name="成功" />
                <Bar dataKey="failed" stackId="a" fill="#EF4444" name="失败" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 提供商状态分布 */}
        <Card>
          <CardHeader>
            <CardTitle>提供商状态分布</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 健康状态分布 */}
        <Card>
          <CardHeader>
            <CardTitle>健康状态分布</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={healthChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {healthChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 成功率趋势 */}
        <Card>
          <CardHeader>
            <CardTitle>成功率趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={providerChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => [`${value}%`, '成功率']} />
                <Line
                  type="monotone"
                  dataKey="successRate"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: '#10B981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 详细统计表格 */}
      <Card>
        <CardHeader>
          <CardTitle>详细统计</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">提供商</th>
                  <th className="text-left p-2">类型</th>
                  <th className="text-left p-2">状态</th>
                  <th className="text-right p-2">总登录</th>
                  <th className="text-right p-2">成功</th>
                  <th className="text-right p-2">失败</th>
                  <th className="text-right p-2">成功率</th>
                  <th className="text-right p-2">平均响应时间</th>
                </tr>
              </thead>
              <tbody>
                {filteredStats.map((stat) => (
                  <tr key={stat.provider.id} className="border-b">
                    <td className="p-2 font-medium">{stat.provider.name}</td>
                    <td className="p-2">
                      <Badge variant="outline">{stat.provider.type}</Badge>
                    </td>
                    <td className="p-2">
                      <Badge
                        className={
                          stat.provider.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                          stat.provider.status === 'INACTIVE' ? 'bg-gray-100 text-gray-800' :
                          stat.provider.status === 'TESTING' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-orange-100 text-orange-800'
                        }
                      >
                        {stat.provider.status === 'ACTIVE' ? '活跃' :
                         stat.provider.status === 'INACTIVE' ? '非活跃' :
                         stat.provider.status === 'TESTING' ? '测试中' : '维护中'}
                      </Badge>
                    </td>
                    <td className="p-2 text-right">{stat.totalLogins.toLocaleString()}</td>
                    <td className="p-2 text-right text-green-600">{stat.successfulLogins.toLocaleString()}</td>
                    <td className="p-2 text-right text-red-600">{stat.failedLogins.toLocaleString()}</td>
                    <td className="p-2 text-right">{stat.successRate.toFixed(1)}%</td>
                    <td className="p-2 text-right">{stat.averageResponseTime}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}