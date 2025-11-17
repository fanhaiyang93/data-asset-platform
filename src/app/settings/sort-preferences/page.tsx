'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SortPreferences } from '@/components/features/search/SortPreferences'
import { SortIndicator } from '@/components/features/search/SortIndicator'
import { SortStatusBar } from '@/components/features/search/SortStatusBar'
import { ArrowLeft, Settings, TestTube, BarChart3, Download, Share2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { UserSortPreferences, SortOption, ScoringWeights } from '@/types/search'
import { toast } from '@/hooks/use-toast'

export default function SortPreferencesPage() {
  const router = useRouter()

  // Mock用户偏好数据 - 在实际项目中应该从API获取
  const [userPreferences, setUserPreferences] = useState<UserSortPreferences>({
    defaultSort: 'relevance',
    sortFrequency: {
      relevance: 65,
      popularity: 28,
      recency: 15,
      quality: 12,
      created: 8,
      personalized: 22
    },
    savedSorts: [
      {
        name: '我的常用配置',
        sort: 'personalized',
        weights: {
          relevance: 0.3,
          popularity: 0.4,
          recency: 0.2,
          personalization: 0.1
        },
        createdAt: new Date('2024-10-15')
      },
      {
        name: '最新优先',
        sort: 'recency',
        weights: {
          relevance: 0.2,
          popularity: 0.2,
          recency: 0.5,
          personalization: 0.1
        },
        createdAt: new Date('2024-11-01')
      },
      {
        name: '热门内容',
        sort: 'popularity',
        weights: {
          relevance: 0.25,
          popularity: 0.5,
          recency: 0.15,
          personalization: 0.1
        },
        createdAt: new Date('2024-11-05')
      }
    ],
    lastUsedSort: 'personalized'
  })

  // 预览状态
  const [previewSort, setPreviewSort] = useState<SortOption>('relevance')
  const [previewWeights, setPreviewWeights] = useState<ScoringWeights>({
    relevance: 0.4,
    popularity: 0.3,
    recency: 0.2,
    personalization: 0.1
  })

  // 统计数据
  const [stats, setStats] = useState({
    totalSearches: 1247,
    avgResponseTime: 245,
    satisfactionScore: 8.6,
    topSort: 'relevance' as SortOption
  })

  // 处理偏好更改
  const handlePreferencesChange = (newPreferences: UserSortPreferences) => {
    setUserPreferences(newPreferences)
    // 在实际项目中，这里应该调用API保存偏好
    toast({
      title: '设置已保存',
      description: '您的排序偏好设置已成功保存'
    })
  }

  // 处理配置保存
  const handleSaveConfiguration = (name: string, sort: SortOption, weights?: ScoringWeights) => {
    const newConfig = {
      name,
      sort,
      weights: weights || previewWeights,
      createdAt: new Date()
    }

    setUserPreferences(prev => ({
      ...prev,
      savedSorts: [...prev.savedSorts, newConfig]
    }))

    toast({
      title: '配置已保存',
      description: `排序配置"${name}"已保存成功`
    })
  }

  // 处理配置删除
  const handleDeleteConfiguration = (name: string) => {
    setUserPreferences(prev => ({
      ...prev,
      savedSorts: prev.savedSorts.filter(config => config.name !== name)
    }))

    toast({
      title: '配置已删除',
      description: `排序配置"${name}"已删除`
    })
  }

  // 处理偏好重置
  const handleResetPreferences = () => {
    const defaultPreferences: UserSortPreferences = {
      defaultSort: 'relevance',
      sortFrequency: {
        relevance: 0,
        popularity: 0,
        recency: 0,
        quality: 0,
        created: 0,
        personalized: 0
      },
      savedSorts: [],
      lastUsedSort: 'relevance'
    }

    setUserPreferences(defaultPreferences)
    setPreviewSort('relevance')
    setPreviewWeights({
      relevance: 0.4,
      popularity: 0.3,
      recency: 0.2,
      personalization: 0.1
    })

    toast({
      title: '偏好已重置',
      description: '所有排序偏好设置已重置为默认值'
    })
  }

  // 导出使用报告
  const handleExportReport = () => {
    const reportData = {
      user: 'demo-user-123',
      timestamp: new Date().toISOString(),
      preferences: userPreferences,
      statistics: stats,
      version: '1.0'
    }

    const dataStr = JSON.stringify(reportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sort-preferences-report-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)

    toast({
      title: '报告已导出',
      description: '使用报告已成功导出到本地'
    })
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-8">
        {/* 页面头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
            <div>
              <h1 className="text-3xl font-bold">排序偏好设置</h1>
              <p className="text-muted-foreground">
                自定义您的搜索排序偏好，获得更好的搜索体验
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportReport} className="gap-2">
              <Download className="h-4 w-4" />
              导出报告
            </Button>
            <Button variant="outline" className="gap-2">
              <Share2 className="h-4 w-4" />
              分享设置
            </Button>
          </div>
        </div>

        {/* 使用统计概览 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">总搜索次数</p>
                  <p className="text-2xl font-bold">{stats.totalSearches.toLocaleString()}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">平均响应时间</p>
                  <p className="text-2xl font-bold">{stats.avgResponseTime}ms</p>
                </div>
                <Settings className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">满意度评分</p>
                  <p className="text-2xl font-bold">{stats.satisfactionScore}/10</p>
                </div>
                <TestTube className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">最常用排序</p>
                  <p className="text-2xl font-bold">
                    {stats.topSort === 'relevance' ? '相关度' :
                     stats.topSort === 'popularity' ? '热度' :
                     stats.topSort === 'recency' ? '时效性' : '个性化'}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {userPreferences.sortFrequency[stats.topSort]}次
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 当前排序状态预览 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              排序效果预览
            </CardTitle>
            <CardDescription>
              实时预览当前排序设置的效果
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <SortStatusBar
                sortMethod={previewSort}
                weights={previewSort === 'personalized' ? previewWeights : undefined}
                isLoading={false}
                totalResults={1247}
                responseTime={245}
                abTestVariant="A"
                sortQuality={{
                  score: 8.6,
                  label: 'excellent',
                  factors: ['结果相关性', '个性化匹配', '1247个高质量结果']
                }}
              />

              <SortIndicator
                sortMethod={previewSort}
                weights={previewSort === 'personalized' ? previewWeights : undefined}
                responseTime={245}
              />
            </div>
          </CardContent>
        </Card>

        {/* 主要设置区域 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2">
            <SortPreferences
              preferences={userPreferences}
              onPreferencesChange={handlePreferencesChange}
              onSaveConfiguration={handleSaveConfiguration}
              onDeleteConfiguration={handleDeleteConfiguration}
              onResetPreferences={handleResetPreferences}
            />
          </div>

          {/* 侧边栏：快速操作和帮助 */}
          <div className="space-y-6">
            {/* 快速操作 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">快速操作</CardTitle>
                <CardDescription>
                  常用的设置操作
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    setPreviewSort('personalized')
                    setPreviewWeights({
                      relevance: 0.3,
                      popularity: 0.4,
                      recency: 0.2,
                      personalization: 0.1
                    })
                  }}
                >
                  <TestTube className="h-4 w-4" />
                  智能排序模式
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    setPreviewSort('recency')
                  }}
                >
                  <Settings className="h-4 w-4" />
                  最新优先模式
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    setPreviewSort('popularity')
                  }}
                >
                  <BarChart3 className="h-4 w-4" />
                  热门优先模式
                </Button>
              </CardContent>
            </Card>

            {/* 使用帮助 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">使用帮助</CardTitle>
                <CardDescription>
                  排序设置使用指南
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">排序方式说明</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• <strong>相关度</strong>：按搜索匹配程度排序</li>
                    <li>• <strong>热度</strong>：按受欢迎程度排序</li>
                    <li>• <strong>时效性</strong>：按更新时间排序</li>
                    <li>• <strong>个性化</strong>：基于您的偏好智能排序</li>
                  </ul>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">权重配置</h4>
                  <p className="text-muted-foreground">
                    在个性化排序中，您可以调整各维度的权重来获得最适合的排序效果。
                  </p>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">保存配置</h4>
                  <p className="text-muted-foreground">
                    您可以保存多个排序配置，在不同场景下快速切换使用。
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}