'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  ArrowUpDown,
  Settings,
  Star,
  Clock,
  TrendingUp,
  User,
  Award,
  Calendar,
  Info,
  Save,
  RotateCcw,
  Zap,
  BarChart3,
  Heart,
  Share2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  SortOption,
  ScoringWeights,
  UserSortPreferences,
  SortingFeedback
} from '@/types/search'

interface SortControlsProps {
  currentSort: SortOption
  onSortChange: (sort: SortOption, weights?: ScoringWeights) => void
  onFeedback?: (feedback: SortingFeedback) => void
  userPreferences?: UserSortPreferences
  showAdvanced?: boolean
  disabled?: boolean
  className?: string
}

interface SortOptionConfig {
  value: SortOption
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

const sortOptions: SortOptionConfig[] = [
  {
    value: 'relevance',
    label: '相关度',
    description: '按内容匹配度排序，最相关的结果优先显示',
    icon: Star,
    color: 'text-yellow-600'
  },
  {
    value: 'popularity',
    label: '热度',
    description: '按受欢迎程度排序，热门资产优先显示',
    icon: TrendingUp,
    color: 'text-orange-600'
  },
  {
    value: 'recency',
    label: '时效性',
    description: '按更新时间排序，最新资产优先显示',
    icon: Clock,
    color: 'text-blue-600'
  },
  {
    value: 'quality',
    label: '质量',
    description: '按数据质量排序，高质量资产优先显示',
    icon: Award,
    color: 'text-green-600'
  },
  {
    value: 'created',
    label: '创建时间',
    description: '按创建时间排序，最新创建的资产优先显示',
    icon: Calendar,
    color: 'text-purple-600'
  },
  {
    value: 'personalized',
    label: '个性化',
    description: '基于您的使用习惯智能排序，最符合您偏好的结果优先',
    icon: User,
    color: 'text-pink-600'
  }
]

export function SortControls({
  currentSort,
  onSortChange,
  onFeedback,
  userPreferences,
  showAdvanced = false,
  disabled = false,
  className
}: SortControlsProps) {
  const [customWeights, setCustomWeights] = useState<ScoringWeights>({
    relevance: 0.4,
    popularity: 0.3,
    recency: 0.2,
    personalization: 0.1
  })
  const [showWeightDialog, setShowWeightDialog] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackRating, setFeedbackRating] = useState<number>(5)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [autoSave, setAutoSave] = useState(true)

  // 获取当前排序选项的配置
  const currentSortConfig = sortOptions.find(option => option.value === currentSort)

  // 处理排序切换
  const handleSortChange = (newSort: SortOption) => {
    if (disabled) return

    if (newSort === 'personalized' && showAdvanced) {
      onSortChange(newSort, customWeights)
    } else {
      onSortChange(newSort)
    }
  }

  // 处理自定义权重应用
  const handleApplyWeights = () => {
    onSortChange(currentSort, customWeights)
    setShowWeightDialog(false)
  }

  // 重置权重到默认值
  const handleResetWeights = () => {
    const defaultWeights: ScoringWeights = {
      relevance: 0.4,
      popularity: 0.3,
      recency: 0.2,
      personalization: 0.1
    }
    setCustomWeights(defaultWeights)
  }

  // 处理权重变化
  const handleWeightChange = (dimension: keyof ScoringWeights, value: number) => {
    const newWeights = { ...customWeights }
    newWeights[dimension] = value / 100 // 滑块值转换为0-1范围

    // 确保权重总和为1
    const total = Object.values(newWeights).reduce((sum, weight) => sum + weight, 0)
    if (total > 0) {
      Object.keys(newWeights).forEach(key => {
        newWeights[key as keyof ScoringWeights] = newWeights[key as keyof ScoringWeights] / total
      })
    }

    setCustomWeights(newWeights)
  }

  // 提交反馈
  const handleSubmitFeedback = () => {
    if (onFeedback) {
      onFeedback({
        sortMethod: currentSort,
        overallSatisfaction: feedbackRating,
        comment: feedbackComment,
        sessionId: `session_${Date.now()}`,
        timestamp: new Date()
      })
    }
    setFeedbackOpen(false)
    setFeedbackComment('')
    setFeedbackRating(5)
  }

  // 获取使用频率颜色
  const getUsageColor = (count: number): string => {
    if (count > 20) return 'text-green-600'
    if (count > 10) return 'text-yellow-600'
    if (count > 5) return 'text-orange-600'
    return 'text-gray-500'
  }

  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-3', className)}>
        {/* 主排序选择器 */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">排序：</Label>
          <Select
            value={currentSort}
            onValueChange={handleSortChange}
            disabled={disabled}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue>
                <div className="flex items-center gap-2">
                  {currentSortConfig && (
                    <>
                      <currentSortConfig.icon className={cn('h-4 w-4', currentSortConfig.color)} />
                      <span>{currentSortConfig.label}</span>
                    </>
                  )}
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <option.icon className={cn('h-4 w-4', option.color)} />
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {option.description}
                      </div>
                    </div>
                    {userPreferences && userPreferences.sortFrequency[option.value] > 0 && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          'ml-auto text-xs',
                          getUsageColor(userPreferences.sortFrequency[option.value])
                        )}
                      >
                        {userPreferences.sortFrequency[option.value]}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 当前排序状态展示 */}
        {currentSortConfig && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="gap-1">
                <currentSortConfig.icon className={cn('h-3 w-3', currentSortConfig.color)} />
                {currentSortConfig.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{currentSortConfig.description}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* 高级设置 */}
        {showAdvanced && (
          <>
            <Dialog open={showWeightDialog} onOpenChange={setShowWeightDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={disabled}>
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  高级排序设置
                </DialogTitle>
                <DialogDescription>
                  调整各维度的权重来自定义排序效果
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* 权重配置 */}
                <div className="space-y-4">
                  <h4 className="font-medium">评分权重配置</h4>
                  {Object.entries(customWeights).map(([key, value]) => {
                    const dimension = key as keyof ScoringWeights
                    const labels = {
                      relevance: '相关度',
                      popularity: '热度',
                      recency: '时效性',
                      personalization: '个性化'
                    }

                    return (
                      <div key={dimension} className="space-y-2">
                        <div className="flex justify-between">
                          <Label className="text-sm">{labels[dimension]}</Label>
                          <span className="text-sm text-muted-foreground">
                            {Math.round(value * 100)}%
                          </span>
                        </div>
                        <Slider
                          value={[value * 100]}
                          onValueChange={(values) => handleWeightChange(dimension, values[0])}
                          max={100}
                          min={0}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    )
                  })}
                </div>

                <Separator />

                {/* 自动保存设置 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>自动保存偏好</Label>
                    <div className="text-sm text-muted-foreground">
                      自动保存您的排序偏好设置
                    </div>
                  </div>
                  <Switch
                    checked={autoSave}
                    onCheckedChange={setAutoSave}
                  />
                </div>

                {/* 操作按钮 */}
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={handleResetWeights}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    重置默认
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowWeightDialog(false)}
                    >
                      取消
                    </Button>
                    <Button onClick={handleApplyWeights} className="gap-2">
                      <Save className="h-4 w-4" />
                      应用设置
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* 偏好设置链接 */}
          <Link href="/settings/sort-preferences">
            <Button variant="ghost" size="sm" disabled={disabled} className="gap-1">
              <Settings className="h-3.5 w-3.5" />
              <span className="text-xs">偏好</span>
            </Button>
          </Link>
        </>
        )}

        {/* 快速行为按钮 */}
        <div className="flex items-center gap-1">
          {/* 智能推荐 */}
          {currentSort === 'personalized' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="gap-1">
                  <Zap className="h-3 w-3" />
                  智能
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>基于您的使用习惯智能排序</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* 反馈按钮 */}
          {onFeedback && (
            <Popover open={feedbackOpen} onOpenChange={setFeedbackOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" disabled={disabled}>
                  <Heart className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">排序效果反馈</h4>
                    <p className="text-sm text-muted-foreground">
                      请对当前的排序效果进行评价
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>整体满意度 ({feedbackRating}/5)</Label>
                      <Slider
                        value={[feedbackRating]}
                        onValueChange={(values) => setFeedbackRating(values[0])}
                        max={5}
                        min={1}
                        step={1}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>意见建议（可选）</Label>
                      <Textarea
                        placeholder="请分享您的使用体验和改进建议..."
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        className="resize-none"
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFeedbackOpen(false)}
                    >
                      取消
                    </Button>
                    <Button size="sm" onClick={handleSubmitFeedback}>
                      提交反馈
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* 使用统计信息 */}
        {userPreferences && userPreferences.lastUsedSort && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-xs text-muted-foreground">
                上次使用：{sortOptions.find(opt => opt.value === userPreferences.lastUsedSort)?.label}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p>排序使用统计：</p>
                {Object.entries(userPreferences.sortFrequency)
                  .filter(([_, count]) => count > 0)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 3)
                  .map(([sort, count]) => (
                    <div key={sort} className="flex justify-between text-xs">
                      <span>{sortOptions.find(opt => opt.value === sort)?.label}</span>
                      <span>{count}次</span>
                    </div>
                  ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}