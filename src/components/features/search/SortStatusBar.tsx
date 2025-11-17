'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Star,
  TrendingUp,
  Clock,
  Award,
  Calendar,
  User,
  Zap,
  Target,
  BarChart3,
  Activity,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SortOption, ScoringWeights } from '@/types/search'

interface SortStatusBarProps {
  sortMethod: SortOption
  weights?: ScoringWeights
  isLoading?: boolean
  totalResults?: number
  responseTime?: number
  abTestVariant?: string
  sortQuality?: {
    score: number
    label: 'excellent' | 'good' | 'average' | 'poor'
    factors: string[]
  }
  className?: string
}

const sortMethodConfig = {
  relevance: {
    label: '相关度排序',
    icon: Star,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    description: '按内容匹配度排序'
  },
  popularity: {
    label: '热度排序',
    icon: TrendingUp,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    description: '按受欢迎程度排序'
  },
  recency: {
    label: '时效性排序',
    icon: Clock,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    description: '按更新时间排序'
  },
  quality: {
    label: '质量排序',
    icon: Award,
    color: 'bg-green-100 text-green-800 border-green-200',
    description: '按数据质量排序'
  },
  created: {
    label: '创建时间排序',
    icon: Calendar,
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    description: '按创建时间排序'
  },
  personalized: {
    label: '个性化排序',
    icon: User,
    color: 'bg-pink-100 text-pink-800 border-pink-200',
    description: '基于个人偏好排序'
  }
}

export function SortStatusBar({
  sortMethod,
  weights,
  isLoading = false,
  totalResults,
  responseTime,
  abTestVariant,
  sortQuality,
  className
}: SortStatusBarProps) {
  const config = sortMethodConfig[sortMethod]

  // 计算性能状态
  const getPerformanceStatus = (time?: number) => {
    if (!time) return { status: 'unknown', color: 'text-gray-500', icon: Activity }

    if (time < 100) return { status: 'excellent', color: 'text-green-600', icon: CheckCircle }
    if (time < 300) return { status: 'good', color: 'text-blue-600', icon: CheckCircle }
    if (time < 1000) return { status: 'average', color: 'text-yellow-600', icon: AlertCircle }
    return { status: 'poor', color: 'text-red-600', icon: AlertCircle }
  }

  const performanceStatus = getPerformanceStatus(responseTime)

  // 获取质量状态颜色
  const getQualityColor = (label?: string) => {
    switch (label) {
      case 'excellent': return 'text-green-600'
      case 'good': return 'text-blue-600'
      case 'average': return 'text-yellow-600'
      case 'poor': return 'text-red-600'
      default: return 'text-gray-500'
    }
  }

  return (
    <TooltipProvider>
      <Card className={cn('border-0 shadow-sm bg-gradient-to-r from-muted/30 to-muted/10', className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {/* 左侧：排序状态信息 */}
            <div className="flex items-center gap-4">
              {/* 主排序方法 */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn('gap-1.5 font-medium', config.color)}>
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <config.icon className="h-3.5 w-3.5" />
                  )}
                  {config.label}
                </Badge>

                {/* 个性化排序特殊标识 */}
                {sortMethod === 'personalized' && (
                  <Badge variant="secondary" className="gap-1">
                    <Zap className="h-3 w-3" />
                    智能
                  </Badge>
                )}

                {/* A/B测试标识 */}
                {abTestVariant && (
                  <Badge variant="outline" className="gap-1">
                    <Target className="h-3 w-3" />
                    测试 {abTestVariant}
                  </Badge>
                )}
              </div>

              {/* 结果统计 */}
              {totalResults !== undefined && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <BarChart3 className="h-4 w-4" />
                  <span>{totalResults.toLocaleString()} 个结果</span>
                </div>
              )}

              {/* 权重配置指示器（仅个性化排序显示） */}
              {weights && sortMethod === 'personalized' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs">
                      <User className="h-3 w-3" />
                      <span>自定义权重</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1 text-xs">
                      <p className="font-medium">权重配置：</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>相关度: {(weights.relevance * 100).toFixed(0)}%</div>
                        <div>热度: {(weights.popularity * 100).toFixed(0)}%</div>
                        <div>时效性: {(weights.recency * 100).toFixed(0)}%</div>
                        <div>个性化: {(weights.personalization * 100).toFixed(0)}%</div>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* 右侧：性能和质量指示器 */}
            <div className="flex items-center gap-4">
              {/* 排序质量指示器 */}
              {sortQuality && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Star className={cn('h-4 w-4', getQualityColor(sortQuality.label))} />
                        <span className="text-sm font-medium">
                          {sortQuality.score.toFixed(1)}
                        </span>
                      </div>
                      <Progress
                        value={sortQuality.score * 10}
                        className="w-12 h-1.5"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-2 text-xs max-w-48">
                      <p className="font-medium">排序质量评分</p>
                      <p>评分: {sortQuality.score.toFixed(1)}/10 ({
                        sortQuality.label === 'excellent' ? '优秀' :
                        sortQuality.label === 'good' ? '良好' :
                        sortQuality.label === 'average' ? '一般' : '较差'
                      })</p>
                      {sortQuality.factors.length > 0 && (
                        <div>
                          <p className="font-medium mb-1">影响因素：</p>
                          <ul className="space-y-0.5">
                            {sortQuality.factors.map((factor, index) => (
                              <li key={index}>• {factor}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* 性能指示器 */}
              {responseTime !== undefined && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1">
                      <performanceStatus.icon className={cn('h-4 w-4', performanceStatus.color)} />
                      <span className="text-sm font-medium">
                        {responseTime.toFixed(0)}ms
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1 text-xs">
                      <p className="font-medium">排序性能</p>
                      <p>响应时间: {responseTime.toFixed(1)}ms</p>
                      <p>状态: {
                        performanceStatus.status === 'excellent' ? '优秀 (<100ms)' :
                        performanceStatus.status === 'good' ? '良好 (<300ms)' :
                        performanceStatus.status === 'average' ? '一般 (<1s)' : '较慢 (>1s)'
                      }</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* 加载状态指示器 */}
              {isLoading && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>排序中...</span>
                </div>
              )}
            </div>
          </div>

          {/* 详细权重可视化（仅在个性化排序时显示） */}
          {weights && sortMethod === 'personalized' && !isLoading && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <div className="grid grid-cols-4 gap-3">
                {Object.entries(weights).map(([key, value]) => {
                  const labels = {
                    relevance: { label: '相关度', color: 'bg-yellow-500' },
                    popularity: { label: '热度', color: 'bg-orange-500' },
                    recency: { label: '时效性', color: 'bg-blue-500' },
                    personalization: { label: '个性化', color: 'bg-pink-500' }
                  }

                  const dimension = labels[key as keyof typeof labels]
                  if (!dimension) return null

                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{dimension.label}</span>
                        <span className="font-medium">{(value * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn('h-full transition-all duration-300', dimension.color)}
                          style={{ width: `${value * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}