'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Database,
  Table,
  BarChart3,
  Settings,
  FileText,
  RefreshCw,
  Clock,
  AlertTriangle
} from 'lucide-react'
import { TableSchemaDisplay } from './TableSchemaDisplay'
import { SampleDataTable } from './SampleDataTable'
import { AssetMetadataPanel } from './AssetMetadataPanel'
import { ApplyButton } from './ApplyButton'
import { type AssetDetail, type SampleDataResult } from '@/server/services/AssetService'

interface AssetDetailPageProps {
  asset: AssetDetail
  sampleData?: SampleDataResult
  onBack?: () => void
  onRefreshSampleData?: () => void
  onApply?: (applicationData: any) => Promise<void>
  onContactOwner?: (contact: any) => void
  onContactTechnical?: (contact: any) => void
  isLoadingSampleData?: boolean
}

export function AssetDetailPage({
  asset,
  sampleData,
  onBack,
  onRefreshSampleData,
  onApply,
  onContactOwner,
  onContactTechnical,
  isLoadingSampleData = false
}: AssetDetailPageProps) {
  const [activeTab, setActiveTab] = useState('overview')

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-green-100 text-green-800'
      case 'MAINTENANCE':
        return 'bg-yellow-100 text-yellow-800'
      case 'DEPRECATED':
        return 'bg-red-100 text-red-800'
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return '可用'
      case 'MAINTENANCE':
        return '维护中'
      case 'DEPRECATED':
        return '已废弃'
      case 'DRAFT':
        return '草稿'
      default:
        return status
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onBack && (
                <Button variant="ghost" size="sm" onClick={onBack}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回
                </Button>
              )}

              <div className="flex items-center gap-3">
                <Database className="w-6 h-6 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold">{asset.name}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-muted px-2 py-1 rounded">{asset.code}</code>
                    <Badge className={getStatusColor(asset.status)}>
                      {getStatusText(asset.status)}
                    </Badge>
                    {asset.category && (
                      <Badge variant="outline">{asset.category.name}</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {asset.lastAccessed && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  最后访问: {new Date(asset.lastAccessed).toLocaleString('zh-CN')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="container mx-auto px-4 py-6">
        {/* 资产描述 */}
        {asset.description && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 mt-1 text-muted-foreground" />
                <div>
                  <h3 className="font-medium mb-2">资产说明</h3>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                    {asset.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 左侧主要内容区 */}
          <div className="lg:col-span-3 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  概览
                </TabsTrigger>
                <TabsTrigger value="schema" className="flex items-center gap-2">
                  <Table className="w-4 h-4" />
                  表结构
                </TabsTrigger>
                <TabsTrigger value="sample" className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  数据样例
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  设置
                </TabsTrigger>
              </TabsList>

              {/* 概览标签页 */}
              <TabsContent value="overview" className="space-y-6">
                {/* 快速统计 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {asset.recordCount ? Number(asset.recordCount).toLocaleString() : '未知'}
                      </div>
                      <div className="text-sm text-muted-foreground">记录总数</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {asset.accessCount || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">访问次数</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {asset.qualityScore || 'N/A'}
                        {asset.qualityScore && '/100'}
                      </div>
                      <div className="text-sm text-muted-foreground">质量评分</div>
                    </CardContent>
                  </Card>
                </div>

                {/* 表结构信息（概览） */}
                {asset.tableSchema && (
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="font-medium mb-4 flex items-center gap-2">
                        <Table className="w-5 h-5" />
                        表结构概览
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <div className="text-xl font-bold">{asset.tableSchema.columns.length}</div>
                          <div className="text-sm text-muted-foreground">字段数</div>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <div className="text-xl font-bold">
                            {asset.tableSchema.columns.filter(c => c.isPrimaryKey).length}
                          </div>
                          <div className="text-sm text-muted-foreground">主键</div>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <div className="text-xl font-bold">
                            {asset.tableSchema.indexes?.length || 0}
                          </div>
                          <div className="text-sm text-muted-foreground">索引</div>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <div className="text-xl font-bold">
                            {asset.tableSchema.constraints?.length || 0}
                          </div>
                          <div className="text-sm text-muted-foreground">约束</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 数据样例预览 */}
                {sampleData && (
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium flex items-center gap-2">
                          <Database className="w-5 h-5" />
                          数据样例预览
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab('sample')}
                        >
                          查看详细
                        </Button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              {sampleData.columns.slice(0, 4).map((column, index) => (
                                <th key={index} className="text-left p-2 font-medium">
                                  {column}
                                </th>
                              ))}
                              {sampleData.columns.length > 4 && (
                                <th className="text-left p-2 font-medium text-muted-foreground">
                                  ...更多列
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {sampleData.rows.slice(0, 3).map((row, rowIndex) => (
                              <tr key={rowIndex} className="border-b last:border-b-0">
                                {row.slice(0, 4).map((cell, cellIndex) => (
                                  <td key={cellIndex} className="p-2">
                                    {cell !== null ? String(cell) : (
                                      <span className="text-muted-foreground italic">NULL</span>
                                    )}
                                  </td>
                                ))}
                                {row.length > 4 && (
                                  <td className="p-2 text-muted-foreground">...</td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {sampleData.isMasked && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-orange-600">
                          <AlertTriangle className="w-4 h-4" />
                          数据已脱敏处理
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* 表结构标签页 */}
              <TabsContent value="schema">
                {asset.tableSchema ? (
                  <TableSchemaDisplay
                    columns={asset.tableSchema.columns}
                    indexes={asset.tableSchema.indexes}
                    constraints={asset.tableSchema.constraints}
                    onCopySchema={() => {
                      // TODO: 添加复制成功提示
                      console.log('表结构已复制到剪贴板')
                    }}
                    onExportSchema={() => {
                      // TODO: 添加导出成功提示
                      console.log('表结构已导出')
                    }}
                  />
                ) : (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Table className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <h3 className="text-lg font-medium mb-2">暂无表结构信息</h3>
                      <p className="text-muted-foreground">
                        该资产的表结构信息暂未配置或无法获取
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* 数据样例标签页 */}
              <TabsContent value="sample">
                {sampleData ? (
                  <SampleDataTable
                    data={sampleData}
                    isLoading={isLoadingSampleData}
                    onRefresh={onRefreshSampleData}
                  />
                ) : (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Database className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <h3 className="text-lg font-medium mb-2">暂无数据样例</h3>
                      <p className="text-muted-foreground mb-4">
                        该资产的数据样例暂不可用
                      </p>
                      {onRefreshSampleData && (
                        <Button
                          variant="outline"
                          onClick={onRefreshSampleData}
                          disabled={isLoadingSampleData}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          尝试刷新
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* 设置标签页 */}
              <TabsContent value="settings">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-medium mb-4">资产设置</h3>
                    <p className="text-muted-foreground">
                      设置功能正在开发中...
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* 右侧边栏 */}
          <div className="space-y-6">
            {/* 一键申请 */}
            <ApplyButton
              asset={asset}
              onApply={onApply}
              disabled={asset.status !== 'AVAILABLE'}
            />

            <Separator />

            {/* 资产元数据面板 */}
            <AssetMetadataPanel
              asset={asset}
              onContactOwner={onContactOwner}
              onContactTechnical={onContactTechnical}
            />
          </div>
        </div>
      </div>
    </div>
  )
}