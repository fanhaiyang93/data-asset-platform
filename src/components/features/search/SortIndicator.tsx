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
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SortOption, SortingScores, ScoringWeights } from '@/types/search'

interface SortIndicatorProps {
  sortMethod: SortOption
  weights?: ScoringWeights
  scores?: SortingScores
  rank?: number
  totalResults?: number
  responseTime?: number
  className?: string
}

interface ScoreDimension {
  key: keyof SortingScores
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  description: string
}

const scoreDimensions: ScoreDimension[] = [
  {
    key: 'relevanceScore',
    label: '相关度',
    icon: Star,
    color: 'text-yellow-600',
    description: '内容与搜索查询的匹配程度'
  },
  {
    key: 'popularityScore',
    label: '热度',
    icon: TrendingUp,
    color: 'text-orange-600',
    description: '基于用户行为的受欢迎程度'
  },
  {
    key: 'recencyScore',
    label: '时效性',
    icon: Clock,
    color: 'text-blue-600',
    description: '数据更新的新鲜程度'
  },
  {
    key: 'personalizationScore',
    label: '个性化',
    icon: User,
    color: 'text-pink-600',
    description: '基于个人偏好的匹配度'
  }
]

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

export function SortIndicator({
  sortMethod,
  weights,
  scores,
  rank,
  totalResults,
  responseTime,
  className
}: SortIndicatorProps) {
  const config = sortMethodConfig[sortMethod]

  return (
    <TooltipProvider>
      <Card className={cn('border-0 shadow-none bg-muted/30', className)}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            {/* 排序方法指示器 */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn('gap-1.5', config.color)}>
                <config.icon className="h-3.5 w-3.5" />
                {config.label}
              </Badge>

              {/* 智能排序指示器 */}
              {sortMethod === 'personalized' && (
                <Badge variant="secondary" className="gap-1">
                  <Zap className="h-3 w-3" />
                  智能
                </Badge>
              )}

              {/* 结果排名指示器 */}
              {rank !== undefined && totalResults !== undefined && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="gap-1">
                      <Target className="h-3 w-3" />
                      {rank}/{totalResults}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>排序位置：第 {rank} 名，共 {totalResults} 个结果</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* 性能和状态指示器 */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {responseTime !== undefined && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      {responseTime}ms
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>排序响应时间</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {scores?.finalScore !== undefined && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {(scores.finalScore * 100).toFixed(0)}%
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>综合评分：{(scores.finalScore * 100).toFixed(1)}%</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* 详细评分展示 */}
          {scores && (
            <div className="mt-3 space-y-2">
              {scoreDimensions.map((dimension) => {
                const score = scores[dimension.key]
                const weight = weights?.[dimension.key.replace('Score', '') as keyof ScoringWeights]

                if (score === undefined || score === 0) return null

                return (
                  <Tooltip key={dimension.key}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 min-w-[70px]">
                          <dimension.icon className={cn('h-3 w-3', dimension.color)} />
                          <span className="text-xs text-muted-foreground">
                            {dimension.label}
                          </span>
                        </div>
                        <div className="flex-1">
                          <Progress
                            value={score * 100}
                            className="h-1.5"
                          />
                        </div>
                        <div className="text-xs text-muted-foreground min-w-[35px] text-right">
                          {(score * 100).toFixed(0)}%
                        </div>
                        {weight !== undefined && (
                          <div className="text-xs text-muted-foreground min-w-[45px] text-right">
                            (权重: {(weight * 100).toFixed(0)}%)
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        <p className="font-medium">{dimension.label}</p>
                        <p className="text-xs">{dimension.description}</p>
                        <p className="text-xs">
                          评分: {(score * 100).toFixed(1)}%
                          {weight && ` • 权重: ${(weight * 100).toFixed(1)}%`}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}

              {/* 综合评分条 */}
              {scores.finalScore !== undefined && (
                <div className="pt-1 border-t border-border/50">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 min-w-[70px]">
                          <Target className="h-3 w-3 text-primary" />
                          <span className="text-xs font-medium">综合</span>
                        </div>
                        <div className="flex-1">
                          <Progress
                            value={scores.finalScore * 100}
                            className="h-2"
                          />
                        </div>
                        <div className="text-xs font-medium min-w-[35px] text-right">
                          {(scores.finalScore * 100).toFixed(0)}%
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        <p className="font-medium">综合评分</p>
                        <p className="text-xs">基于各维度加权计算的最终得分</p>
                        <p className="text-xs">评分: {(scores.finalScore * 100).toFixed(1)}%</p>
                        {scores.explanation && (
                          <p className="text-xs text-muted-foreground">
                            {scores.explanation}
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
          )}

          {/* 权重配置展示 */}
          {weights && !scores && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Info className="h-3 w-3" />
                <span>权重配置</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div className="flex justify-between">
                  <span>相关度:</span>
                  <span>{(weights.relevance * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>热度:</span>
                  <span>{(weights.popularity * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>时效性:</span>
                  <span>{(weights.recency * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>个性化:</span>
                  <span>{(weights.personalization * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}