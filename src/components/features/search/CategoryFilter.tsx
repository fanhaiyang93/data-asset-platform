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
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CategoryItem {
  id: string
  name: string
  count: number
  children?: CategoryItem[]
}

interface CategoryFilterProps {
  categories: Array<{
    id: string
    name: string
    count: number
  }>
  selectedCategories: string[]
  onCategoriesChange: (categories: string[]) => void
  isLoading?: boolean
  className?: string
}

export function CategoryFilter({
  categories,
  selectedCategories,
  onCategoriesChange,
  isLoading = false,
  className
}: CategoryFilterProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // 构建分类树结构（如果需要层级显示）
  const categoryTree = useMemo(() => {
    // 简单的扁平化显示，如果需要树状结构可以在这里实现
    return categories.map(cat => ({
      ...cat,
      children: []
    }))
  }, [categories])

  // 过滤分类（基于搜索词）
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categoryTree

    return categoryTree.filter(category =>
      category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.id.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [categoryTree, searchTerm])

  // 处理分类选择
  const handleCategoryToggle = (categoryId: string) => {
    const newSelectedCategories = selectedCategories.includes(categoryId)
      ? selectedCategories.filter(id => id !== categoryId)
      : [...selectedCategories, categoryId]

    onCategoriesChange(newSelectedCategories)
  }

  // 处理全选/取消全选
  const handleSelectAll = () => {
    if (selectedCategories.length === filteredCategories.length) {
      // 取消全选
      onCategoriesChange([])
    } else {
      // 全选
      onCategoriesChange(filteredCategories.map(cat => cat.id))
    }
  }

  // 切换分类展开状态
  const toggleExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    setExpandedCategories(newExpanded)
  }

  // 渲染分类项
  const renderCategoryItem = (category: CategoryItem, level = 0) => {
    const isSelected = selectedCategories.includes(category.id)
    const isExpanded = expandedCategories.has(category.id)
    const hasChildren = category.children && category.children.length > 0

    return (
      <div key={category.id} className="space-y-1">
        <div
          className={cn(
            'flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors',
            isSelected && 'bg-primary/10'
          )}
          style={{ paddingLeft: `${8 + level * 16}px` }}
        >
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0"
              onClick={() => toggleExpanded(category.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          )}

          {!hasChildren && (
            <div className="w-4" /> // 占位符，保持对齐
          )}

          <Checkbox
            id={`category-${category.id}`}
            checked={isSelected}
            onCheckedChange={() => handleCategoryToggle(category.id)}
            className="h-4 w-4"
          />

          <div className="flex items-center gap-2 flex-1 min-w-0">
            {hasChildren ? (
              isExpanded ? (
                <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
              )
            ) : (
              <div className="w-4 shrink-0" />
            )}

            <label
              htmlFor={`category-${category.id}`}
              className="text-sm cursor-pointer truncate flex-1"
              title={category.name}
            >
              {category.name}
            </label>

            <Badge variant="secondary" className="h-5 px-2 text-xs shrink-0">
              {category.count}
            </Badge>
          </div>
        </div>

        {/* 渲染子分类 */}
        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {category.children!.map(child => renderCategoryItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        <h4 className="text-sm font-medium text-muted-foreground">
          资产分类
        </h4>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 p-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-8" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className={cn('space-y-3', className)}>
        <h4 className="text-sm font-medium text-muted-foreground">
          资产分类
        </h4>
        <div className="text-sm text-muted-foreground text-center py-4">
          暂无可用分类
        </div>
      </div>
    )
  }

  const selectedCount = selectedCategories.length
  const totalCount = filteredCategories.length

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">
          资产分类
          {selectedCount > 0 && (
            <span className="ml-2 text-primary">
              ({selectedCount} 已选)
            </span>
          )}
        </h4>
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

      {/* 搜索框 */}
      {categories.length > 5 && (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="搜索分类..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      )}

      {/* 分类列表 */}
      <ScrollArea className="h-[200px] w-full">
        {filteredCategories.length > 0 ? (
          <div className="space-y-1">
            {filteredCategories.map(category => renderCategoryItem(category))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4">
            无匹配的分类
          </div>
        )}
      </ScrollArea>

      {/* 统计信息 */}
      {selectedCount > 0 && (
        <div className="text-xs text-muted-foreground">
          已选择 {selectedCount} 个分类，共 {totalCount} 个可选分类
        </div>
      )}
    </div>
  )
}