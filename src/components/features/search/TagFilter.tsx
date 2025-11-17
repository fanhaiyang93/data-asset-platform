'use client'

import React, { useState, useMemo } from 'react'
import {
  Button,
  Badge,
  Input,
  ScrollArea,
  Checkbox,
  Skeleton
} from '@/components/ui'
import {
  Search,
  Tag,
  Hash,
  X,
  Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TagFilterProps {
  tags: Array<{
    value: string
    count: number
  }>
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  isLoading?: boolean
  className?: string
}

export function TagFilter({
  tags,
  selectedTags,
  onTagsChange,
  isLoading = false,
  className
}: TagFilterProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [customTag, setCustomTag] = useState('')
  const [showAddCustom, setShowAddCustom] = useState(false)

  // 过滤标签（基于搜索词）
  const filteredTags = useMemo(() => {
    if (!searchTerm.trim()) return tags

    return tags.filter(tag =>
      tag.value.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [tags, searchTerm])

  // 处理标签选择
  const handleTagToggle = (tagValue: string) => {
    const newSelectedTags = selectedTags.includes(tagValue)
      ? selectedTags.filter(tag => tag !== tagValue)
      : [...selectedTags, tagValue]

    onTagsChange(newSelectedTags)
  }

  // 处理全选/取消全选
  const handleSelectAll = () => {
    if (selectedTags.length === filteredTags.length) {
      // 取消全选
      onTagsChange([])
    } else {
      // 全选当前过滤结果
      onTagsChange(filteredTags.map(tag => tag.value))
    }
  }

  // 添加自定义标签
  const handleAddCustomTag = () => {
    const trimmedTag = customTag.trim()
    if (trimmedTag && !selectedTags.includes(trimmedTag)) {
      onTagsChange([...selectedTags, trimmedTag])
      setCustomTag('')
      setShowAddCustom(false)
    }
  }

  // 移除已选标签
  const handleRemoveTag = (tagValue: string) => {
    onTagsChange(selectedTags.filter(tag => tag !== tagValue))
  }

  // 清除所有标签
  const clearAllTags = () => {
    onTagsChange([])
  }

  // 获取标签颜色（基于标签内容的哈希值）
  const getTagColor = (tag: string) => {
    const colors = [
      'bg-blue-100 text-blue-800 border-blue-200',
      'bg-green-100 text-green-800 border-green-200',
      'bg-yellow-100 text-yellow-800 border-yellow-200',
      'bg-red-100 text-red-800 border-red-200',
      'bg-purple-100 text-purple-800 border-purple-200',
      'bg-pink-100 text-pink-800 border-pink-200',
      'bg-indigo-100 text-indigo-800 border-indigo-200',
      'bg-gray-100 text-gray-800 border-gray-200',
    ]

    let hash = 0
    for (let i = 0; i < tag.length; i++) {
      hash = ((hash << 5) - hash + tag.charCodeAt(i)) & 0xffffffff
    }
    return colors[Math.abs(hash) % colors.length]
  }

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        <h4 className="text-sm font-medium text-muted-foreground">
          标签
        </h4>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 p-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-6" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const selectedCount = selectedTags.length
  const totalCount = filteredTags.length

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">
          标签
          {selectedCount > 0 && (
            <span className="ml-2 text-primary">
              ({selectedCount} 已选)
            </span>
          )}
        </h4>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllTags}
              className="h-6 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              清除
            </Button>
          )}
          {totalCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="h-6 text-xs"
            >
              {selectedCount === totalCount ? '取消全选' : '全选'}
            </Button>
          )}
        </div>
      </div>

      {/* 已选标签展示 */}
      {selectedCount > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">已选标签:</div>
          <div className="flex flex-wrap gap-1">
            {selectedTags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className={cn(
                  'px-2 py-1 text-xs border cursor-pointer hover:opacity-80 transition-opacity',
                  getTagColor(tag)
                )}
                onClick={() => handleRemoveTag(tag)}
              >
                <Hash className="h-3 w-3 mr-1" />
                {tag}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 搜索框 */}
      {tags.length > 8 && (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="搜索标签..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      )}

      {/* 添加自定义标签 */}
      <div className="space-y-2">
        {!showAddCustom ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddCustom(true)}
            className="h-8 w-full"
          >
            <Plus className="h-3 w-3 mr-1" />
            添加自定义标签
          </Button>
        ) : (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Hash className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="输入标签名..."
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddCustomTag()
                  }
                }}
                className="pl-8 h-8 text-sm"
                autoFocus
              />
            </div>
            <Button
              size="sm"
              onClick={handleAddCustomTag}
              disabled={!customTag.trim()}
              className="h-8"
            >
              添加
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddCustom(false)
                setCustomTag('')
              }}
              className="h-8"
            >
              取消
            </Button>
          </div>
        )}
      </div>

      {/* 标签列表 */}
      {tags.length > 0 ? (
        <ScrollArea className="h-[200px] w-full">
          {filteredTags.length > 0 ? (
            <div className="space-y-1">
              {filteredTags.map((tag) => {
                const isSelected = selectedTags.includes(tag.value)
                return (
                  <div
                    key={tag.value}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer',
                      isSelected && 'bg-primary/10'
                    )}
                    onClick={() => handleTagToggle(tag.value)}
                  >
                    <Checkbox
                      id={`tag-${tag.value}`}
                      checked={isSelected}
                      onChange={() => handleTagToggle(tag.value)}
                      className="h-4 w-4"
                    />

                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Hash className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span
                        className="text-sm truncate flex-1"
                        title={tag.value}
                      >
                        {tag.value}
                      </span>
                      <Badge variant="secondary" className="h-4 px-1 text-xs shrink-0">
                        {tag.count}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-4">
              无匹配的标签
            </div>
          )}
        </ScrollArea>
      ) : (
        <div className="text-sm text-muted-foreground text-center py-4">
          暂无可用标签
        </div>
      )}

      {/* 统计信息 */}
      {totalCount > 0 && (
        <div className="text-xs text-muted-foreground">
          显示 {filteredTags.length} 个标签，共 {tags.length} 个可选标签
          {selectedCount > 0 && `，已选择 ${selectedCount} 个`}
        </div>
      )}
    </div>
  )
}