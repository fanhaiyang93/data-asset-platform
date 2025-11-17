'use client'

import React from 'react'
import {
  Badge,
  Button,
  ScrollArea
} from '@/components/ui'
import {
  X,
  Hash,
  Folder,
  Clock,
  Star,
  Filter,
  RotateCcw
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { AdvancedFilters, FilterOptions } from '@/types/search'

interface FilterChipsProps {
  filters: AdvancedFilters
  filterOptions?: FilterOptions | null
  onClearFilter: (filterKey: keyof AdvancedFilters) => void
  onClearAll: () => void
  className?: string
}

export function FilterChips({
  filters,
  filterOptions,
  onClearFilter,
  onClearAll,
  className
}: FilterChipsProps) {
  // 生成筛选条件chip
  const generateFilterChips = () => {
    const chips: Array<{
      key: keyof AdvancedFilters
      label: string
      value: string
      icon: React.ReactNode
      color: string
    }> = []

    // 分类筛选chips
    if (filters.categories && filters.categories.length > 0) {
      filters.categories.forEach(categoryId => {
        const categoryOption = filterOptions?.categories.find(cat => cat.id === categoryId)
        const categoryName = categoryOption?.name || categoryId
        chips.push({
          key: 'categories',
          label: '分类',
          value: categoryName,
          icon: <Folder className="h-3 w-3" />,
          color: 'bg-blue-100 text-blue-800 border-blue-200'
        })
      })
    }

    // 状态筛选chips
    if (filters.statuses && filters.statuses.length > 0) {
      filters.statuses.forEach(status => {
        const statusOption = filterOptions?.statuses.find(s => s.value === status)
        const statusLabel = statusOption?.label || status
        chips.push({
          key: 'statuses',
          label: '状态',
          value: statusLabel,
          icon: <Filter className="h-3 w-3" />,
          color: 'bg-green-100 text-green-800 border-green-200'
        })
      })
    }

    // 类型筛选chips
    if (filters.types && filters.types.length > 0) {
      filters.types.forEach(type => {
        const typeOption = filterOptions?.types.find(t => t.value === type)
        const typeLabel = typeOption?.label || type
        chips.push({
          key: 'types',
          label: '类型',
          value: typeLabel,
          icon: <Filter className="h-3 w-3" />,
          color: 'bg-purple-100 text-purple-800 border-purple-200'
        })
      })
    }

    // 标签筛选chips
    if (filters.tags && filters.tags.length > 0) {
      filters.tags.forEach(tag => {
        chips.push({
          key: 'tags',
          label: '标签',
          value: tag,
          icon: <Hash className="h-3 w-3" />,
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200'
        })
      })
    }

    // 负责人筛选chips
    if (filters.owners && filters.owners.length > 0) {
      filters.owners.forEach(ownerId => {
        const ownerOption = filterOptions?.owners.find(o => o.id === ownerId)
        const ownerName = ownerOption?.name || ownerId
        chips.push({
          key: 'owners',
          label: '负责人',
          value: ownerName,
          icon: <Filter className="h-3 w-3" />,
          color: 'bg-indigo-100 text-indigo-800 border-indigo-200'
        })
      })
    }

    // 质量分数范围chip
    if (filters.qualityScoreMin !== undefined || filters.qualityScoreMax !== undefined) {
      const min = filters.qualityScoreMin ?? 0
      const max = filters.qualityScoreMax ?? 10
      chips.push({
        key: 'qualityScoreMin', // 用于清除操作
        label: '质量分数',
        value: `${min} - ${max}`,
        icon: <Star className="h-3 w-3" />,
        color: 'bg-orange-100 text-orange-800 border-orange-200'
      })
    }

    // 更新时间范围chip
    if (filters.updatedAfter || filters.updatedBefore) {
      let timeValue = ''
      if (filters.updatedAfter && filters.updatedBefore) {
        timeValue = `${format(parseISO(filters.updatedAfter), 'yyyy-MM-dd', { locale: zhCN })} 至 ${format(parseISO(filters.updatedBefore), 'yyyy-MM-dd', { locale: zhCN })}`
      } else if (filters.updatedAfter) {
        timeValue = `从 ${format(parseISO(filters.updatedAfter), 'yyyy-MM-dd', { locale: zhCN })}`
      } else if (filters.updatedBefore) {
        timeValue = `到 ${format(parseISO(filters.updatedBefore), 'yyyy-MM-dd', { locale: zhCN })}`
      }

      chips.push({
        key: 'updatedAfter', // 用于清除操作
        label: '更新时间',
        value: timeValue,
        icon: <Clock className="h-3 w-3" />,
        color: 'bg-teal-100 text-teal-800 border-teal-200'
      })
    }

    // 创建时间范围chip
    if (filters.createdAfter || filters.createdBefore) {
      let timeValue = ''
      if (filters.createdAfter && filters.createdBefore) {
        timeValue = `${format(parseISO(filters.createdAfter), 'yyyy-MM-dd', { locale: zhCN })} 至 ${format(parseISO(filters.createdBefore), 'yyyy-MM-dd', { locale: zhCN })}`
      } else if (filters.createdAfter) {
        timeValue = `从 ${format(parseISO(filters.createdAfter), 'yyyy-MM-dd', { locale: zhCN })}`
      } else if (filters.createdBefore) {
        timeValue = `到 ${format(parseISO(filters.createdBefore), 'yyyy-MM-dd', { locale: zhCN })}`
      }

      chips.push({
        key: 'createdAfter', // 用于清除操作
        label: '创建时间',
        value: timeValue,
        icon: <Clock className="h-3 w-3" />,
        color: 'bg-cyan-100 text-cyan-800 border-cyan-200'
      })
    }

    return chips
  }

  const chips = generateFilterChips()

  if (chips.length === 0) {
    return null
  }

  // 处理单个chip的清除
  const handleClearChip = (chip: typeof chips[0]) => {
    // 根据筛选类型进行特殊处理
    switch (chip.key) {
      case 'qualityScoreMin':
        // 清除质量分数范围需要同时清除min和max
        const newFilters = { ...filters }
        delete newFilters.qualityScoreMin
        delete newFilters.qualityScoreMax
        onClearFilter('qualityScoreMin') // 这会触发父组件清除两个字段
        break
      case 'updatedAfter':
        // 清除更新时间范围需要同时清除after和before
        const updatedFilters = { ...filters }
        delete updatedFilters.updatedAfter
        delete updatedFilters.updatedBefore
        onClearFilter('updatedAfter')
        break
      case 'createdAfter':
        // 清除创建时间范围需要同时清除after和before
        const createdFilters = { ...filters }
        delete createdFilters.createdAfter
        delete createdFilters.createdBefore
        onClearFilter('createdAfter')
        break
      case 'categories':
        // 对于数组类型，需要移除特定值
        if (filters.categories) {
          const categoryId = filterOptions?.categories.find(cat => cat.name === chip.value)?.id || chip.value
          const newCategories = filters.categories.filter(id => id !== categoryId)
          // 这里需要父组件支持部分更新，暂时清除整个分类筛选
          onClearFilter('categories')
        }
        break
      default:
        onClearFilter(chip.key)
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          已选筛选条件 ({chips.length})
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-6 text-xs hover:text-destructive"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          全部清除
        </Button>
      </div>

      <ScrollArea className="w-full">
        <div className="flex flex-wrap gap-1 pb-1">
          {chips.map((chip, index) => {
            const chipKey = `${chip.key}-${chip.value}-${index}`
            return (
              <Badge
                key={chipKey}
                variant="outline"
                className={cn(
                  'px-2 py-1 text-xs border cursor-pointer hover:opacity-80 transition-opacity max-w-[200px]',
                  chip.color
                )}
              >
                <div className="flex items-center gap-1 min-w-0">
                  {chip.icon}
                  <span className="text-xs text-muted-foreground shrink-0">
                    {chip.label}:
                  </span>
                  <span className="truncate" title={chip.value}>
                    {chip.value}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-3 w-3 p-0 ml-1 hover:bg-destructive/20 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleClearChip(chip)
                    }}
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </div>
              </Badge>
            )
          })}
        </div>
      </ScrollArea>

      {/* 逻辑操作符显示 */}
      {chips.length > 1 && filters.logicOperator && (
        <div className="text-xs text-muted-foreground">
          筛选逻辑: <span className="font-medium">{filters.logicOperator === 'AND' ? '同时满足' : '满足任一'}</span>
        </div>
      )}
    </div>
  )
}