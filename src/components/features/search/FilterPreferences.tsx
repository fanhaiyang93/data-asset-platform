'use client'

import React, { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Separator,
  Switch,
  Label,
  ScrollArea,
  Input
} from '@/components/ui'
import {
  X,
  Star,
  Trash2,
  Settings,
  Calendar,
  Play
} from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface FilterPreferences {
  defaultLogicOperator: 'AND' | 'OR'
  autoApplyFilters: boolean
  saveFiltersOnExit: boolean
  favoriteFilters: Array<{
    name: string
    filters: any
    createdAt: string
  }>
}

interface FilterPreferencesProps {
  preferences: FilterPreferences
  onPreferencesChange: (preferences: Partial<FilterPreferences>) => void
  favoriteFilters: FilterPreferences['favoriteFilters']
  onApplyFavorite: (index: number) => void
  onDeleteFavorite: (index: number) => void
  onClose: () => void
  className?: string
}

export function FilterPreferences({
  preferences,
  onPreferencesChange,
  favoriteFilters,
  onApplyFavorite,
  onDeleteFavorite,
  onClose,
  className
}: FilterPreferencesProps) {
  const [editingFavorite, setEditingFavorite] = useState<number | null>(null)
  const [newName, setNewName] = useState('')

  // 处理收藏筛选重命名
  const handleRenameFavorite = (index: number) => {
    if (newName.trim()) {
      const updatedFavorites = [...favoriteFilters]
      updatedFavorites[index] = { ...updatedFavorites[index], name: newName.trim() }
      onPreferencesChange({ favoriteFilters: updatedFavorites })
      setEditingFavorite(null)
      setNewName('')
    }
  }

  // 开始编辑收藏筛选名称
  const startEditing = (index: number, currentName: string) => {
    setEditingFavorite(index)
    setNewName(currentName)
  }

  // 取消编辑
  const cancelEditing = () => {
    setEditingFavorite(null)
    setNewName('')
  }

  // 获取筛选条件的简要描述
  const getFilterSummary = (filters: any) => {
    const parts = []

    if (filters.categories?.length > 0) {
      parts.push(`分类:${filters.categories.length}`)
    }
    if (filters.statuses?.length > 0) {
      parts.push(`状态:${filters.statuses.length}`)
    }
    if (filters.types?.length > 0) {
      parts.push(`类型:${filters.types.length}`)
    }
    if (filters.tags?.length > 0) {
      parts.push(`标签:${filters.tags.length}`)
    }
    if (filters.qualityScoreMin !== undefined || filters.qualityScoreMax !== undefined) {
      parts.push('质量分数')
    }
    if (filters.updatedAfter || filters.updatedBefore) {
      parts.push('更新时间')
    }
    if (filters.createdAfter || filters.createdBefore) {
      parts.push('创建时间')
    }

    return parts.length > 0 ? parts.join(' | ') : '无筛选条件'
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            筛选器设置
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 基础设置 */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">基础设置</h4>

          {/* 默认逻辑操作符 */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm">默认筛选逻辑</Label>
              <p className="text-xs text-muted-foreground">新筛选时的默认逻辑操作符</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={preferences.defaultLogicOperator === 'AND' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPreferencesChange({ defaultLogicOperator: 'AND' })}
              >
                AND
              </Button>
              <Button
                variant={preferences.defaultLogicOperator === 'OR' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPreferencesChange({ defaultLogicOperator: 'OR' })}
              >
                OR
              </Button>
            </div>
          </div>

          {/* 自动应用筛选 */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm">自动应用筛选</Label>
              <p className="text-xs text-muted-foreground">选择筛选条件时自动执行搜索</p>
            </div>
            <Switch
              checked={preferences.autoApplyFilters}
              onCheckedChange={(checked) => onPreferencesChange({ autoApplyFilters: checked })}
            />
          </div>

          {/* 退出时保存筛选 */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm">退出时保存筛选</Label>
              <p className="text-xs text-muted-foreground">页面退出时自动保存当前筛选状态</p>
            </div>
            <Switch
              checked={preferences.saveFiltersOnExit}
              onCheckedChange={(checked) => onPreferencesChange({ saveFiltersOnExit: checked })}
            />
          </div>
        </div>

        <Separator />

        {/* 收藏筛选 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">收藏筛选</h4>
            <Badge variant="secondary" className="h-5 px-2 text-xs">
              {favoriteFilters.length} 个收藏
            </Badge>
          </div>

          {favoriteFilters.length > 0 ? (
            <ScrollArea className="h-[300px] w-full">
              <div className="space-y-3">
                {favoriteFilters.map((favorite, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 border rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <Star className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />

                    <div className="flex-1 min-w-0 space-y-2">
                      {editingFavorite === index ? (
                        <div className="flex gap-2">
                          <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleRenameFavorite(index)
                              } else if (e.key === 'Escape') {
                                cancelEditing()
                              }
                            }}
                            className="h-7 text-sm"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={() => handleRenameFavorite(index)}
                            disabled={!newName.trim()}
                            className="h-7 px-2"
                          >
                            保存
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelEditing}
                            className="h-7 px-2"
                          >
                            取消
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="text-sm font-medium text-left hover:text-primary transition-colors"
                          onClick={() => startEditing(index, favorite.name)}
                        >
                          {favorite.name}
                        </button>
                      )}

                      <div className="text-xs text-muted-foreground">
                        {getFilterSummary(favorite.filters)}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(favorite.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onApplyFavorite(index)}
                        className="h-7 w-7 p-0"
                        title="应用此筛选"
                      >
                        <Play className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteFavorite(index)}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        title="删除此收藏"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无收藏的筛选条件</p>
              <p className="text-xs mt-1">在筛选器中点击"收藏"按钮来保存常用的筛选组合</p>
            </div>
          )}
        </div>

        <Separator />

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            关闭
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}