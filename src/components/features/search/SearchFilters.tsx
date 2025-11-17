'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Separator,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  ScrollArea
} from '@/components/ui'
import {
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  RotateCcw,
  Search,
  Loader2,
  Settings,
  Star,
  Download,
  Upload
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CategoryFilter } from './CategoryFilter'
import { DateRangeFilter } from './DateRangeFilter'
import { TagFilter } from './TagFilter'
import { FilterChips } from './FilterChips'
import { FilterPreferences } from './FilterPreferences'
import { useSearchFilters } from '@/hooks/useSearchFilters'
import { AdvancedFilters, FilterOptions } from '@/types/search'

interface SearchFiltersProps {
  query: string
  initialFilters?: AdvancedFilters
  onFiltersChange?: (filters: AdvancedFilters) => void
  onSearch: () => void
  className?: string
}

export function SearchFilters({
  query,
  initialFilters,
  onFiltersChange,
  onSearch,
  className
}: SearchFiltersProps) {
  // 使用新的筛选状态管理hook
  const {
    filters,
    updateFilters,
    clearAllFilters,
    clearFilter,
    activeFiltersCount,
    hasActiveFilters,
    filterPreferences,
    updatePreferences,
    saveFavoriteFilter,
    applyFavoriteFilter,
    deleteFavoriteFilter,
    exportFilters,
    importFilters,
    isInitialized
  } = useSearchFilters({
    defaultFilters: initialFilters || { logicOperator: 'AND' },
    enableLocalStorage: true,
    enableUrlSync: true,
    onFiltersChange
  })

  // 状态管理
  const [isExpanded, setIsExpanded] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // 获取筛选器选项
  const { data: filterOptionsData, isLoading: isLoadingOptions } = api.search.getFilterOptions.useQuery(
    { query: query || '', includeEmptyOptions: false },
    { enabled: !!query }
  )

  // 获取筛选器聚合统计
  const { data: aggregationsData, isLoading: isLoadingAggregations } = api.search.getFilterAggregations.useQuery(
    { query: query || '', filters },
    { enabled: !!query && hasActiveFilters && isInitialized }
  )

  // 更新筛选器选项
  useEffect(() => {
    if (filterOptionsData?.success) {
      setFilterOptions(filterOptionsData.data)
    }
  }, [filterOptionsData])

  // 应用筛选并搜索
  const handleApplyFilters = useCallback(() => {
    setIsLoading(true)
    onSearch()
    setTimeout(() => setIsLoading(false), 500) // 简单的加载状态
  }, [onSearch])

  // 处理收藏筛选条件
  const handleSaveFavorite = useCallback(() => {
    const name = prompt('请输入收藏筛选的名称:')
    if (name?.trim()) {
      saveFavoriteFilter(name.trim())
    }
  }, [saveFavoriteFilter])

  // 处理导入筛选条件
  const handleImportFilters = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      if (content) {
        const result = importFilters(content)
        if (result.success) {
          alert('筛选条件导入成功!')
        } else {
          alert(`导入失败: ${result.error}`)
        }
      }
    }
    reader.readAsText(file)

    // 清除文件输入
    event.target.value = ''
  }, [importFilters])

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            筛选器
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveFavorite}
                  className="h-8 text-muted-foreground"
                  title="保存当前筛选为收藏"
                >
                  <Star className="h-3 w-3 mr-1" />
                  收藏
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exportFilters}
                  className="h-8 text-muted-foreground"
                  title="导出筛选条件"
                >
                  <Download className="h-3 w-3 mr-1" />
                  导出
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-8 text-muted-foreground"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  清除全部
                </Button>
              </>
            )}

            {/* 导入按钮 */}
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImportFilters}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                title="导入筛选条件"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground"
              >
                <Upload className="h-3 w-3 mr-1" />
                导入
              </Button>
            </div>

            {/* 设置按钮 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreferences(!showPreferences)}
              className="h-8 text-muted-foreground"
              title="筛选器设置"
            >
              <Settings className="h-3 w-3" />
            </Button>
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </div>

        {/* 用户偏好设置 */}
        {showPreferences && (
          <FilterPreferences
            preferences={filterPreferences}
            onPreferencesChange={updatePreferences}
            favoriteFilters={filterPreferences.favoriteFilters}
            onApplyFavorite={applyFavoriteFilter}
            onDeleteFavorite={deleteFavoriteFilter}
            onClose={() => setShowPreferences(false)}
          />
        )}

        {/* 已选筛选条件展示 */}
        {hasActiveFilters && (
          <FilterChips
            filters={filters}
            filterOptions={filterOptions}
            onClearFilter={clearFilter}
            onClearAll={clearAllFilters}
          />
        )}
      </CardHeader>

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <ScrollArea className="h-full max-h-[70vh]">
              <div className="space-y-6">
                {/* 逻辑操作符选择 */}
                {activeFiltersCount > 1 && (
                  <>
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">
                        筛选逻辑
                      </h4>
                      <div className="flex gap-2">
                        <Button
                          variant={filters.logicOperator === 'AND' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateFilters({ ...filters, logicOperator: 'AND' })}
                        >
                          AND（同时满足）
                        </Button>
                        <Button
                          variant={filters.logicOperator === 'OR' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateFilters({ ...filters, logicOperator: 'OR' })}
                        >
                          OR（满足任一）
                        </Button>
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* 分类筛选 */}
                <CategoryFilter
                  categories={filterOptions?.categories || []}
                  selectedCategories={filters.categories || []}
                  onCategoriesChange={(categories) =>
                    updateFilters({ ...filters, categories })
                  }
                  isLoading={isLoadingOptions}
                />

                <Separator />

                {/* 状态筛选 */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    资产状态
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(filterOptions?.statuses || []).map((status) => (
                      <Button
                        key={status.value}
                        variant={
                          filters.statuses?.includes(status.value) ? 'default' : 'outline'
                        }
                        size="sm"
                        onClick={() => {
                          const currentStatuses = filters.statuses || []
                          const newStatuses = currentStatuses.includes(status.value)
                            ? currentStatuses.filter(s => s !== status.value)
                            : [...currentStatuses, status.value]
                          updateFilters({ ...filters, statuses: newStatuses })
                        }}
                        className="h-8"
                      >
                        {status.label}
                        <Badge variant="secondary" className="ml-2 h-4 px-1 text-xs">
                          {status.count}
                        </Badge>
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* 资产类型筛选 */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    资产类型
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(filterOptions?.types || []).map((type) => (
                      <Button
                        key={type.value}
                        variant={
                          filters.types?.includes(type.value) ? 'default' : 'outline'
                        }
                        size="sm"
                        onClick={() => {
                          const currentTypes = filters.types || []
                          const newTypes = currentTypes.includes(type.value)
                            ? currentTypes.filter(t => t !== type.value)
                            : [...currentTypes, type.value]
                          updateFilters({ ...filters, types: newTypes })
                        }}
                        className="h-8"
                      >
                        {type.label}
                        <Badge variant="secondary" className="ml-2 h-4 px-1 text-xs">
                          {type.count}
                        </Badge>
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* 标签筛选 */}
                <TagFilter
                  tags={filterOptions?.tags || []}
                  selectedTags={filters.tags || []}
                  onTagsChange={(tags) =>
                    updateFilters({ ...filters, tags })
                  }
                  isLoading={isLoadingOptions}
                />

                <Separator />

                {/* 时间范围筛选 */}
                <DateRangeFilter
                  dateRanges={filterOptions?.dateRanges || []}
                  selectedDateRange={{
                    updatedAfter: filters.updatedAfter,
                    updatedBefore: filters.updatedBefore,
                    createdAfter: filters.createdAfter,
                    createdBefore: filters.createdBefore
                  }}
                  onDateRangeChange={(dateRange) =>
                    updateFilters({ ...filters, ...dateRange })
                  }
                  isLoading={isLoadingOptions}
                />

                <Separator />

                {/* 质量分数筛选 */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    质量分数范围
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(filterOptions?.qualityScoreRanges || []).map((range) => (
                      <Button
                        key={`${range.min}-${range.max}`}
                        variant={
                          filters.qualityScoreMin === range.min &&
                          filters.qualityScoreMax === range.max ? 'default' : 'outline'
                        }
                        size="sm"
                        onClick={() => {
                          if (filters.qualityScoreMin === range.min &&
                              filters.qualityScoreMax === range.max) {
                            // 取消选择
                            const newFilters = { ...filters }
                            delete newFilters.qualityScoreMin
                            delete newFilters.qualityScoreMax
                            updateFilters(newFilters)
                          } else {
                            // 选择新范围
                            updateFilters({
                              ...filters,
                              qualityScoreMin: range.min,
                              qualityScoreMax: range.max
                            })
                          }
                        }}
                        className="h-8"
                      >
                        {range.label}
                        <Badge variant="secondary" className="ml-2 h-4 px-1 text-xs">
                          {range.count}
                        </Badge>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* 操作按钮 */}
            <div className="flex justify-between items-center pt-6 border-t">
              <div className="text-sm text-muted-foreground">
                {aggregationsData?.success && (
                  <>共 {aggregationsData.data.totalResults} 个结果</>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsExpanded(false)}
                >
                  收起
                </Button>
                <Button
                  size="sm"
                  onClick={handleApplyFilters}
                  disabled={isLoading || !query}
                  className="min-w-[80px]"
                >
                  {isLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Search className="h-3 w-3 mr-1" />
                  )}
                  搜索
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}