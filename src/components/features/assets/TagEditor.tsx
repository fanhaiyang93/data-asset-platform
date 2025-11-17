'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tag,
  X,
  Plus,
  Search,
  TrendingUp,
  Hash,
  Globe,
  Star,
  Clock,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TagSuggestion {
  name: string
  usage_count: number
  category?: 'popular' | 'recent' | 'related' | 'system'
  description?: string
}

interface TagEditorProps {
  tags: string[]
  onTagsChange: (tags: string[]) => void
  suggestions?: TagSuggestion[]
  onLoadSuggestions?: (query: string) => Promise<TagSuggestion[]>
  maxTags?: number
  maxTagLength?: number
  placeholder?: string
  disabled?: boolean
  showSuggestions?: boolean
  showPopularTags?: boolean
  className?: string
}

export function TagEditor({
  tags = [],
  onTagsChange,
  suggestions = [],
  onLoadSuggestions,
  maxTags = 20,
  maxTagLength = 50,
  placeholder = '输入标签并按回车添加',
  disabled = false,
  showSuggestions = true,
  showPopularTags = true,
  className
}: TagEditorProps) {
  const [inputValue, setInputValue] = useState('')
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState<TagSuggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // 默认热门标签建议
  const defaultPopularTags: TagSuggestion[] = [
    { name: '数据分析', usage_count: 245, category: 'popular', description: '数据分析相关资产' },
    { name: '用户行为', usage_count: 189, category: 'popular', description: '用户行为数据' },
    { name: '实时数据', usage_count: 167, category: 'popular', description: '实时数据流' },
    { name: '业务指标', usage_count: 156, category: 'popular', description: '业务关键指标' },
    { name: '日志数据', usage_count: 143, category: 'popular', description: '系统日志数据' },
    { name: '财务数据', usage_count: 132, category: 'popular', description: '财务相关数据' },
    { name: '营销数据', usage_count: 128, category: 'popular', description: '营销活动数据' },
    { name: '客户数据', usage_count: 118, category: 'popular', description: '客户信息数据' }
  ]

  // 过滤建议标签
  const filterSuggestions = useCallback((query: string) => {
    const allSuggestions = [...suggestions, ...defaultPopularTags]
    const filtered = allSuggestions
      .filter(suggestion =>
        !tags.includes(suggestion.name) && // 排除已添加的标签
        suggestion.name.toLowerCase().includes(query.toLowerCase())
      )
      .sort((a, b) => {
        // 优先显示完全匹配的标签
        const aExactMatch = a.name.toLowerCase() === query.toLowerCase()
        const bExactMatch = b.name.toLowerCase() === query.toLowerCase()
        if (aExactMatch && !bExactMatch) return -1
        if (!aExactMatch && bExactMatch) return 1

        // 然后按使用次数排序
        return b.usage_count - a.usage_count
      })
      .slice(0, 8) // 限制显示数量

    setFilteredSuggestions(filtered)
  }, [suggestions, tags])

  // 加载建议标签
  const loadSuggestions = useCallback(async (query: string) => {
    if (!onLoadSuggestions) {
      filterSuggestions(query)
      return
    }

    setLoadingSuggestions(true)
    try {
      const loadedSuggestions = await onLoadSuggestions(query)
      const allSuggestions = [...loadedSuggestions, ...defaultPopularTags]
      const filtered = allSuggestions
        .filter(suggestion =>
          !tags.includes(suggestion.name) &&
          suggestion.name.toLowerCase().includes(query.toLowerCase())
        )
        .sort((a, b) => b.usage_count - a.usage_count)
        .slice(0, 8)

      setFilteredSuggestions(filtered)
    } catch (error) {
      console.error('加载标签建议失败:', error)
      filterSuggestions(query)
    } finally {
      setLoadingSuggestions(false)
    }
  }, [onLoadSuggestions, filterSuggestions, tags])

  // 处理输入变化
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    setSelectedSuggestionIndex(-1)

    if (value.trim() && showSuggestions) {
      loadSuggestions(value.trim())
    } else {
      setFilteredSuggestions([])
    }
  }, [loadSuggestions, showSuggestions])

  // 添加标签
  const addTag = useCallback((tagName: string) => {
    const trimmedTag = tagName.trim()

    if (!trimmedTag) return
    if (tags.includes(trimmedTag)) return
    if (tags.length >= maxTags) return
    if (trimmedTag.length > maxTagLength) return

    const newTags = [...tags, trimmedTag]
    onTagsChange(newTags)
    setInputValue('')
    setFilteredSuggestions([])
    setSelectedSuggestionIndex(-1)
  }, [tags, onTagsChange, maxTags, maxTagLength])

  // 删除标签
  const removeTag = useCallback((tagToRemove: string) => {
    const newTags = tags.filter(tag => tag !== tagToRemove)
    onTagsChange(newTags)
  }, [tags, onTagsChange])

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedSuggestionIndex >= 0 && filteredSuggestions[selectedSuggestionIndex]) {
        addTag(filteredSuggestions[selectedSuggestionIndex].name)
      } else {
        addTag(inputValue)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev =>
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1)
    } else if (e.key === 'Escape') {
      setFilteredSuggestions([])
      setSelectedSuggestionIndex(-1)
      inputRef.current?.blur()
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      // 删除最后一个标签
      removeTag(tags[tags.length - 1])
    }
  }, [inputValue, selectedSuggestionIndex, filteredSuggestions, addTag, removeTag, tags])

  // 处理输入焦点
  const handleInputFocus = useCallback(() => {
    setIsInputFocused(true)
    if (inputValue.trim() && showSuggestions) {
      loadSuggestions(inputValue.trim())
    } else if (showPopularTags && !inputValue.trim()) {
      // 显示热门标签
      const popularTags = defaultPopularTags
        .filter(tag => !tags.includes(tag.name))
        .slice(0, 6)
      setFilteredSuggestions(popularTags)
    }
  }, [inputValue, showSuggestions, showPopularTags, loadSuggestions, tags])

  const handleInputBlur = useCallback(() => {
    // 延迟隐藏建议，允许点击建议项
    setTimeout(() => {
      setIsInputFocused(false)
      setFilteredSuggestions([])
      setSelectedSuggestionIndex(-1)
    }, 200)
  }, [])

  // 处理建议项点击
  const handleSuggestionClick = useCallback((suggestion: TagSuggestion) => {
    addTag(suggestion.name)
    inputRef.current?.focus()
  }, [addTag])

  // 获取标签类别图标
  const getCategoryIcon = useCallback((category?: string) => {
    switch (category) {
      case 'popular':
        return <TrendingUp className="w-3 h-3" />
      case 'recent':
        return <Clock className="w-3 h-3" />
      case 'related':
        return <Globe className="w-3 h-3" />
      case 'system':
        return <Hash className="w-3 h-3" />
      default:
        return <Tag className="w-3 h-3" />
    }
  }, [])

  // 获取使用次数显示
  const formatUsageCount = useCallback((count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`
    }
    return count.toString()
  }, [])

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            标签管理
          </div>
          <Badge variant="secondary" className="text-xs">
            {tags.length}/{maxTags}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 已添加的标签 */}
        {tags.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">已添加标签</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="flex items-center gap-1 px-2 py-1 text-sm"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                  {!disabled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTag(tag)}
                      className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                    >
                      <X className="w-3 h-3 hover:text-red-600" />
                    </Button>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 标签输入 */}
        {!disabled && tags.length < maxTags && (
          <div className="relative">
            <div className="flex items-center gap-2 p-2 border rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                placeholder={placeholder}
                maxLength={maxTagLength}
                className="flex-1 bg-transparent border-0 outline-none text-sm"
              />
              {inputValue && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addTag(inputValue)}
                  className="h-auto w-auto p-1 text-primary hover:bg-primary/10"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* 建议下拉 */}
            {isInputFocused && filteredSuggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto"
              >
                {loadingSuggestions && (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    加载建议中...
                  </div>
                )}

                {!loadingSuggestions && (
                  <div className="py-2">
                    {!inputValue.trim() && (
                      <div className="px-3 py-1 text-xs font-medium text-muted-foreground border-b">
                        热门标签
                      </div>
                    )}

                    {filteredSuggestions.map((suggestion, index) => (
                      <div
                        key={suggestion.name}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-accent",
                          selectedSuggestionIndex === index && "bg-accent"
                        )}
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="text-muted-foreground">
                            {getCategoryIcon(suggestion.category)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{suggestion.name}</div>
                            {suggestion.description && (
                              <div className="text-xs text-muted-foreground truncate">
                                {suggestion.description}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                          <Users className="w-3 h-3" />
                          {formatUsageCount(suggestion.usage_count)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 状态信息 */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="space-x-4">
            <span>已添加: {tags.length}</span>
            <span>剩余: {maxTags - tags.length}</span>
          </div>
          {inputValue && (
            <span>字符: {inputValue.length}/{maxTagLength}</span>
          )}
        </div>

        {/* 快捷操作提示 */}
        {!disabled && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• 输入标签名称后按回车添加，或点击建议的标签</p>
            <p>• 使用方向键选择建议，按退格键删除最后一个标签</p>
            <p>• 标签长度不超过 {maxTagLength} 个字符，最多添加 {maxTags} 个标签</p>
          </div>
        )}

        {/* 错误状态 */}
        {tags.length >= maxTags && (
          <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
            已达到最大标签数量限制 ({maxTags} 个)
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default TagEditor