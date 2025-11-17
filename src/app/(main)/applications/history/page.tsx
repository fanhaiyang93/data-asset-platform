'use client'

/**
 * 申请历史页面
 * 展示用户的所有申请历史记录，支持筛选、搜索和导出
 */

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApplicationFilter, type HistoryFilters } from '@/components/features/applications/ApplicationFilter'
import { ApplicationHistoryList, type ApplicationHistoryItem } from '@/components/features/applications/ApplicationHistoryList'
import { ApplicationExportService } from '@/lib/services/applicationExport'
import { trpc } from '@/lib/trpc'
import { Download, History, BarChart3, FileText, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function ApplicationHistoryPage() {
  const router = useRouter()
  const [filters, setFilters] = useState<HistoryFilters>({
    sortBy: 'createdAt',
    sortOrder: 'desc',
  })
  const [activeTab, setActiveTab] = useState('list')

  // 获取导出预览信息
  const { data: exportPreview, isLoading: isLoadingPreview } = trpc.application.getExportPreview.useQuery(
    {
      status: filters.status,
      purpose: filters.purpose,
      assetType: filters.assetType,
      startDate: filters.startDate,
      endDate: filters.endDate,
      searchKeyword: filters.searchKeyword,
    },
    {
      enabled: activeTab === 'export',
    }
  )

  // 获取历史统计信息
  const { data: historyStats, isLoading: isLoadingStats } = trpc.application.getApplicationHistoryStats.useQuery(
    undefined,
    {
      enabled: activeTab === 'stats',
    }
  )

  // 导出申请记录
  const exportMutation = trpc.application.exportApplications.useMutation()

  // 处理筛选条件变更
  const handleFilterChange = useCallback((newFilters: HistoryFilters) => {
    setFilters(newFilters)
  }, [])

  // 处理申请项点击
  const handleItemClick = useCallback((item: ApplicationHistoryItem) => {
    router.push(`/applications/history/${item.applicationNumber}`)
  }, [router])

  // 处理导出选中项
  const handleExportSelected = useCallback(async (selectedIds: string[]) => {
    try {
      const result = await exportMutation.mutateAsync({
        selectedIds,
        format: 'csv',
      })

      // 使用客户端生成和下载文件
      const blob = await ApplicationExportService.exportToCSV(result.data, {
        format: 'csv',
        filename: result.filename,
      })

      // 创建下载链接
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`成功导出 ${result.totalCount} 条申请记录`)
    } catch (error) {
      console.error('导出失败:', error)
      toast.error('导出失败，请重试')
    }
  }, [exportMutation])

  // 处理全部导出
  const handleExportAll = useCallback(async (format: 'csv' | 'excel' = 'csv') => {
    try {
      const result = await exportMutation.mutateAsync({
        ...filters,
        format,
      })

      // 使用客户端生成和下载文件
      const blob = format === 'excel'
        ? await ApplicationExportService.exportToExcel(result.data, {
            format,
            filename: result.filename,
          })
        : await ApplicationExportService.exportToCSV(result.data, {
            format,
            filename: result.filename,
          })

      // 创建下载链接
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`成功导出 ${result.totalCount} 条申请记录`)
    } catch (error) {
      console.error('导出失败:', error)
      toast.error('导出失败，请重试')
    }
  }, [filters, exportMutation])

  // 统计卡片组件
  const StatsCard = ({ title, value, description, icon: Icon, color }: {
    title: string
    value: string | number
    description?: string
    icon: React.ComponentType<{ className?: string }>
    color?: string
  }) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${color || 'text-foreground'}`}>{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <Icon className={`h-8 w-8 ${color || 'text-muted-foreground'}`} />
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="container max-w-7xl mx-auto py-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">申请历史记录</h1>
          <p className="text-muted-foreground mt-2">
            查看和管理您的所有数据访问申请记录
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleExportAll('csv')}
            disabled={exportMutation.isPending}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            导出CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExportAll('excel')}
            disabled={exportMutation.isPending}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            导出Excel
          </Button>
        </div>
      </div>

      {/* 主要内容区域 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list" className="gap-2">
            <History className="h-4 w-4" />
            申请列表
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            统计分析
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <FileText className="h-4 w-4" />
            导出管理
          </TabsTrigger>
        </TabsList>

        {/* 申请列表标签页 */}
        <TabsContent value="list" className="space-y-6">
          <ApplicationFilter
            filters={filters}
            onFilterChange={handleFilterChange}
            isLoading={exportMutation.isPending}
          />

          <ApplicationHistoryList
            filters={filters}
            onItemClick={handleItemClick}
            onExportSelected={handleExportSelected}
          />
        </TabsContent>

        {/* 统计分析标签页 */}
        <TabsContent value="stats" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="总申请数"
              value={historyStats?.totalCount || 0}
              description="历史申请总数"
              icon={FileText}
            />
            <StatsCard
              title="通过率"
              value={historyStats?.statusDistribution
                ? `${historyStats.statusDistribution.find(s => s.status === 'APPROVED')?.percentage || 0}%`
                : '0%'}
              description="申请通过百分比"
              icon={BarChart3}
              color="text-green-600"
            />
            <StatsCard
              title="待审核"
              value={historyStats?.statusDistribution
                ? historyStats.statusDistribution.find(s => s.status === 'PENDING')?.count || 0
                : 0}
              description="等待审核的申请"
              icon={AlertCircle}
              color="text-yellow-600"
            />
            <StatsCard
              title="本月申请"
              value={historyStats?.monthlyTrend
                ? historyStats.monthlyTrend.slice(-1)[0]?.count || 0
                : 0}
              description="当月提交申请数"
              icon={History}
              color="text-blue-600"
            />
          </div>

          {/* 状态分布图表区域 */}
          {historyStats && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>申请状态分布</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {historyStats.statusDistribution.map((stat) => (
                      <div key={stat.status} className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {stat.status === 'DRAFT' && '草稿'}
                          {stat.status === 'PENDING' && '待审核'}
                          {stat.status === 'APPROVED' && '已通过'}
                          {stat.status === 'REJECTED' && '已拒绝'}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-secondary rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${stat.percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground w-12 text-right">
                            {stat.count}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>业务用途分布</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {historyStats.purposeDistribution.slice(0, 5).map((stat) => (
                      <div key={stat.purpose} className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {stat.purpose === 'REPORT_CREATION' && '报表制作'}
                          {stat.purpose === 'DATA_ANALYSIS' && '数据分析'}
                          {stat.purpose === 'BUSINESS_MONITOR' && '业务监控'}
                          {stat.purpose === 'MODEL_TRAINING' && '模型训练'}
                          {stat.purpose === 'SYSTEM_INTEGRATION' && '系统集成'}
                          {stat.purpose === 'RESEARCH_ANALYSIS' && '研究分析'}
                          {stat.purpose === 'OTHER' && '其他用途'}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-secondary rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${stat.percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground w-12 text-right">
                            {stat.count}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* 导出管理标签页 */}
        <TabsContent value="export" className="space-y-6">
          <ApplicationFilter
            filters={filters}
            onFilterChange={handleFilterChange}
            isLoading={isLoadingPreview || exportMutation.isPending}
            resultCount={exportPreview?.totalCount}
          />

          {exportPreview && (
            <Card>
              <CardHeader>
                <CardTitle>导出预览</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {exportPreview.totalCount}
                    </div>
                    <div className="text-sm text-muted-foreground">总记录数</div>
                  </div>

                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {Object.values(exportPreview.statusBreakdown).reduce((a, b) => a + b, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">涉及状态</div>
                  </div>

                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {exportPreview.estimatedFileSize}
                    </div>
                    <div className="text-sm text-muted-foreground">预估大小</div>
                  </div>

                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {exportPreview.dateRange ?
                        Math.ceil((exportPreview.dateRange.latest.getTime() - exportPreview.dateRange.earliest.getTime()) / (1000 * 60 * 60 * 24))
                        : 0
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">时间跨度(天)</div>
                  </div>
                </div>

                {exportPreview.totalCount > 0 && (
                  <div className="flex gap-4 justify-center">
                    <Button
                      onClick={() => handleExportAll('csv')}
                      disabled={exportMutation.isPending}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      {exportMutation.isPending ? '导出中...' : '导出为CSV'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleExportAll('excel')}
                      disabled={exportMutation.isPending}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      {exportMutation.isPending ? '导出中...' : '导出为Excel'}
                    </Button>
                  </div>
                )}

                {exportPreview.totalCount === 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      当前筛选条件下没有找到可导出的申请记录，请调整筛选条件后重试。
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}