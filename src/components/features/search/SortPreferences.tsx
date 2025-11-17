'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogContent,
  AlertDialogTrigger,
  AlertDialogHeader,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'
import {
  Settings,
  Save,
  RotateCcw,
  Download,
  Upload,
  Trash2,
  Plus,
  MoreHorizontal,
  Star,
  TrendingUp,
  Clock,
  Award,
  Calendar,
  User,
  BarChart3,
  History,
  Bookmark,
  Share2,
  Copy,
  FileDown,
  FileUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  SortOption,
  ScoringWeights,
  UserSortPreferences,
  SavedSortConfiguration
} from '@/types/search'
import { toast } from '@/hooks/use-toast'

interface SortPreferencesProps {
  preferences?: UserSortPreferences
  onPreferencesChange?: (preferences: UserSortPreferences) => void
  onSaveConfiguration?: (name: string, sort: SortOption, weights?: ScoringWeights) => void
  onDeleteConfiguration?: (name: string) => void
  onResetPreferences?: () => void
  className?: string
}

interface NewConfigurationData {
  name: string
  description: string
  sort: SortOption
  weights: ScoringWeights
}

const sortOptions = [
  { value: 'relevance', label: '相关度', icon: Star },
  { value: 'popularity', label: '热度', icon: TrendingUp },
  { value: 'recency', label: '时效性', icon: Clock },
  { value: 'quality', label: '质量', icon: Award },
  { value: 'created', label: '创建时间', icon: Calendar },
  { value: 'personalized', label: '个性化', icon: User }
] as const

export function SortPreferences({
  preferences,
  onPreferencesChange,
  onSaveConfiguration,
  onDeleteConfiguration,
  onResetPreferences,
  className
}: SortPreferencesProps) {
  const [defaultSort, setDefaultSort] = useState<SortOption>('relevance')
  const [customWeights, setCustomWeights] = useState<ScoringWeights>({
    relevance: 0.4,
    popularity: 0.3,
    recency: 0.2,
    personalization: 0.1
  })
  const [showNewConfigDialog, setShowNewConfigDialog] = useState(false)
  const [newConfig, setNewConfig] = useState<NewConfigurationData>({
    name: '',
    description: '',
    sort: 'relevance',
    weights: { ...customWeights }
  })
  const [importData, setImportData] = useState('')
  const [showImportDialog, setShowImportDialog] = useState(false)

  // 初始化偏好设置
  useEffect(() => {
    if (preferences) {
      setDefaultSort(preferences.defaultSort)
      // 可以从已保存的配置中提取权重
      if (preferences.savedSorts.length > 0) {
        const lastSaved = preferences.savedSorts[0]
        if (lastSaved.weights) {
          setCustomWeights(lastSaved.weights)
        }
      }
    }
  }, [preferences])

  // 处理默认排序更改
  const handleDefaultSortChange = (sort: SortOption) => {
    setDefaultSort(sort)
    if (onPreferencesChange && preferences) {
      onPreferencesChange({
        ...preferences,
        defaultSort: sort
      })
    }
  }

  // 处理权重更改
  const handleWeightChange = (dimension: keyof ScoringWeights, value: number) => {
    const newWeights = { ...customWeights }
    newWeights[dimension] = value / 100

    // 确保权重总和为1
    const total = Object.values(newWeights).reduce((sum, weight) => sum + weight, 0)
    if (total > 0) {
      Object.keys(newWeights).forEach(key => {
        newWeights[key as keyof ScoringWeights] = newWeights[key as keyof ScoringWeights] / total
      })
    }

    setCustomWeights(newWeights)
  }

  // 保存新配置
  const handleSaveNewConfiguration = () => {
    if (!newConfig.name.trim()) {
      toast({
        title: '错误',
        description: '请输入配置名称',
        variant: 'destructive'
      })
      return
    }

    if (onSaveConfiguration) {
      onSaveConfiguration(newConfig.name, newConfig.sort, newConfig.weights)
    }

    // 重置表单
    setNewConfig({
      name: '',
      description: '',
      sort: 'relevance',
      weights: { ...customWeights }
    })
    setShowNewConfigDialog(false)

    toast({
      title: '成功',
      description: '排序配置已保存'
    })
  }

  // 删除配置
  const handleDeleteConfiguration = (name: string) => {
    if (onDeleteConfiguration) {
      onDeleteConfiguration(name)
    }
    toast({
      title: '成功',
      description: '排序配置已删除'
    })
  }

  // 导出偏好设置
  const handleExportPreferences = () => {
    if (!preferences) return

    const exportData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      preferences
    }

    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sort-preferences-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)

    toast({
      title: '成功',
      description: '偏好设置已导出'
    })
  }

  // 导入偏好设置
  const handleImportPreferences = () => {
    try {
      const importedData = JSON.parse(importData)

      if (importedData.preferences && onPreferencesChange) {
        onPreferencesChange(importedData.preferences)
        setShowImportDialog(false)
        setImportData('')
        toast({
          title: '成功',
          description: '偏好设置已导入'
        })
      }
    } catch (error) {
      toast({
        title: '错误',
        description: '导入数据格式错误',
        variant: 'destructive'
      })
    }
  }

  // 重置权重
  const handleResetWeights = () => {
    const defaultWeights: ScoringWeights = {
      relevance: 0.4,
      popularity: 0.3,
      recency: 0.2,
      personalization: 0.1
    }
    setCustomWeights(defaultWeights)
  }

  // 应用配置
  const handleApplyConfiguration = (config: SavedSortConfiguration) => {
    setDefaultSort(config.sort)
    if (config.weights) {
      setCustomWeights(config.weights)
    }

    if (onPreferencesChange && preferences) {
      onPreferencesChange({
        ...preferences,
        defaultSort: config.sort
      })
    }

    toast({
      title: '成功',
      description: `已应用配置 "${config.name}"`
    })
  }

  return (
    <TooltipProvider>
      <div className={cn('space-y-6', className)}>
        {/* 基本设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              基本排序偏好
            </CardTitle>
            <CardDescription>
              设置您默认的排序方式和权重配置
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 默认排序 */}
            <div className="space-y-2">
              <Label>默认排序方式</Label>
              <Select value={defaultSort} onValueChange={handleDefaultSortChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 权重配置 */}
            <div className="space-y-4">
              <Label>评分权重配置</Label>
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

            {/* 操作按钮 */}
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={handleResetWeights}>
                <RotateCcw className="h-4 w-4 mr-2" />
                重置权重
              </Button>
              <Button onClick={() => setShowNewConfigDialog(true)}>
                <Save className="h-4 w-4 mr-2" />
                保存配置
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 已保存的配置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bookmark className="h-5 w-5" />
              已保存的配置
            </CardTitle>
            <CardDescription>
              管理您保存的排序配置方案
            </CardDescription>
          </CardHeader>
          <CardContent>
            {preferences?.savedSorts && preferences.savedSorts.length > 0 ? (
              <div className="space-y-3">
                {preferences.savedSorts.map((config, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{config.name}</h4>
                        <Badge variant="outline">
                          {sortOptions.find(opt => opt.value === config.sort)?.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        创建于 {config.createdAt.toLocaleDateString()}
                      </p>
                      {config.weights && (
                        <div className="text-xs text-muted-foreground">
                          权重: 相关度{Math.round(config.weights.relevance * 100)}% •
                          热度{Math.round(config.weights.popularity * 100)}% •
                          时效性{Math.round(config.weights.recency * 100)}% •
                          个性化{Math.round(config.weights.personalization * 100)}%
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleApplyConfiguration(config)}
                      >
                        应用
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleApplyConfiguration(config)}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            应用配置
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              navigator.clipboard.writeText(JSON.stringify(config, null, 2))
                              toast({ title: '已复制', description: '配置已复制到剪贴板' })
                            }}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            复制配置
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteConfiguration(config.name)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除配置
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Bookmark className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>暂无保存的配置</p>
                <p className="text-sm">点击"保存配置"创建您的第一个配置</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 使用统计 */}
        {preferences && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                使用统计
              </CardTitle>
              <CardDescription>
                查看您的排序使用习惯和偏好分析
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 使用频率统计 */}
                <div>
                  <h4 className="font-medium mb-3">排序方式使用频率</h4>
                  <div className="space-y-2">
                    {Object.entries(preferences.sortFrequency)
                      .filter(([_, count]) => count > 0)
                      .sort(([, a], [, b]) => b - a)
                      .map(([sort, count]) => {
                        const option = sortOptions.find(opt => opt.value === sort)
                        const total = Object.values(preferences.sortFrequency).reduce((sum, c) => sum + c, 0)
                        const percentage = total > 0 ? (count / total) * 100 : 0

                        return (
                          <div key={sort} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {option && <option.icon className="h-4 w-4" />}
                              <span className="text-sm">{option?.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-muted rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-sm text-muted-foreground w-12 text-right">
                                {count}次
                              </span>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>

                {/* 最近使用 */}
                {preferences.lastUsedSort && (
                  <div>
                    <h4 className="font-medium mb-2">最近使用</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {sortOptions.find(opt => opt.value === preferences.lastUsedSort)?.label}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        上次使用的排序方式
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 数据管理 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              数据管理
            </CardTitle>
            <CardDescription>
              导入导出偏好设置，或重置到默认状态
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleExportPreferences}>
                <FileDown className="h-4 w-4 mr-2" />
                导出偏好
              </Button>
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <FileUp className="h-4 w-4 mr-2" />
                导入偏好
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    重置偏好
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认重置</AlertDialogTitle>
                    <AlertDialogDescription>
                      这将删除所有自定义排序偏好和保存的配置，恢复到默认设置。此操作不可撤销。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onResetPreferences}
                      className="bg-destructive text-destructive-foreground"
                    >
                      确认重置
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {/* 新配置对话框 */}
        <Dialog open={showNewConfigDialog} onOpenChange={setShowNewConfigDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>保存新的排序配置</DialogTitle>
              <DialogDescription>
                为当前的排序设置创建一个保存的配置
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>配置名称</Label>
                <Input
                  placeholder="例如：我的个性化配置"
                  value={newConfig.name}
                  onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>描述（可选）</Label>
                <Textarea
                  placeholder="描述这个配置的用途..."
                  value={newConfig.description}
                  onChange={(e) => setNewConfig({ ...newConfig, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNewConfigDialog(false)}>
                  取消
                </Button>
                <Button onClick={handleSaveNewConfiguration}>
                  保存配置
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 导入对话框 */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>导入排序偏好</DialogTitle>
              <DialogDescription>
                粘贴导出的偏好设置数据
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>偏好设置数据</Label>
                <Textarea
                  placeholder="粘贴JSON格式的偏好设置数据..."
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                  取消
                </Button>
                <Button onClick={handleImportPreferences}>
                  导入偏好
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}