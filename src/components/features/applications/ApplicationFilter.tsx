'use client'

/**
 * 申请历史筛选组件
 * 支持按时间、状态、资产类型、关键词筛选申请记录
 */

import React, { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ApplicationStatus, BusinessPurpose } from '@prisma/client'
import { CalendarIcon, Search, Filter, X, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { cn } from '@/lib/utils'

// 筛选条件接口
export interface HistoryFilters {
  // 搜索关键词
  searchKeyword?: string

  // 状态筛选
  status?: ApplicationStatus[]

  // 用途筛选
  purpose?: BusinessPurpose[]

  // 资产类型筛选
  assetType?: string

  // 时间范围筛选
  startDate?: Date
  endDate?: Date

  // 排序方式
  sortBy?: 'createdAt' | 'submittedAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
}

// 快速时间范围选项
const TIME_RANGE_OPTIONS = [
  { label: '今天', value: 'today' },
  { label: '本周', value: 'thisWeek' },
  { label: '本月', value: 'thisMonth' },
  { label: '最近3个月', value: 'last3Months' },
  { label: '自定义', value: 'custom' },
]

// 状态选项
const STATUS_OPTIONS: { label: string; value: ApplicationStatus; color: string }[] = [
  { label: '草稿', value: 'DRAFT', color: 'bg-gray-100 text-gray-800' },
  { label: '待审核', value: 'PENDING', color: 'bg-yellow-100 text-yellow-800' },
  { label: '已通过', value: 'APPROVED', color: 'bg-green-100 text-green-800' },
  { label: '已拒绝', value: 'REJECTED', color: 'bg-red-100 text-red-800' },
]

// 用途选项
const PURPOSE_OPTIONS: { label: string; value: BusinessPurpose }[] = [
  { label: '报表制作', value: 'REPORT_CREATION' },
  { label: '数据分析', value: 'DATA_ANALYSIS' },
  { label: '业务监控', value: 'BUSINESS_MONITOR' },
  { label: '模型训练', value: 'MODEL_TRAINING' },
  { label: '系统集成', value: 'SYSTEM_INTEGRATION' },
  { label: '研究分析', value: 'RESEARCH_ANALYSIS' },
  { label: '其他用途', value: 'OTHER' },
]

// 资产类型选项（可以从API获取，这里先硬编码）
const ASSET_TYPE_OPTIONS = [
  { label: '全部类型', value: '' },
  { label: '数据表', value: 'table' },
  { label: '数据视图', value: 'view' },
  { label: 'API接口', value: 'api' },
  { label: '文件数据', value: 'file' },
]

// 排序选项
const SORT_OPTIONS = [
  { label: '按创建时间', value: 'createdAt' },
  { label: '按提交时间', value: 'submittedAt' },
  { label: '按更新时间', value: 'updatedAt' },
]

interface ApplicationFilterProps {
  filters: HistoryFilters
  onFilterChange: (filters: HistoryFilters) => void
  isLoading?: boolean
  resultCount?: number
}

export function ApplicationFilter({
  filters,
  onFilterChange,
  isLoading = false,
  resultCount
}: ApplicationFilterProps) {
  const [localFilters, setLocalFilters] = useState<HistoryFilters>(filters)
  const [isExpanded, setIsExpanded] = useState(false)
  const [timeRangeType, setTimeRangeType] = useState<string>('custom')

  // 同步外部filters到本地状态
  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  // 获取时间范围
  const getDateRange = (type: string): { start?: Date; end?: Date } => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    switch (type) {
      case 'today':
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1) }

      case 'thisWeek':
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay())
        return { start: weekStart, end: now }

      case 'thisMonth':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        return { start: monthStart, end: now }

      case 'last3Months':
        const threeMonthsAgo = new Date(today)
        threeMonthsAgo.setMonth(today.getMonth() - 3)
        return { start: threeMonthsAgo, end: now }

      default:
        return {}
    }
  }

  // 处理时间范围变更
  const handleTimeRangeChange = useCallback((type: string) => {
    setTimeRangeType(type)
    const range = getDateRange(type)

    const newFilters = {
      ...localFilters,
      startDate: range.start,
      endDate: range.end,
    }

    setLocalFilters(newFilters)

    // 非自定义时间范围立即应用
    if (type !== 'custom') {
      onFilterChange(newFilters)
    }
  }, [localFilters, onFilterChange])

  // 处理状态筛选变更
  const handleStatusChange = useCallback((status: ApplicationStatus, checked: boolean) => {
    const currentStatus = localFilters.status || []
    const newStatus = checked
      ? [...currentStatus, status]
      : currentStatus.filter(s => s !== status)

    const newFilters = {
      ...localFilters,
      status: newStatus.length > 0 ? newStatus : undefined,
    }

    setLocalFilters(newFilters)
    onFilterChange(newFilters)
  }, [localFilters, onFilterChange])

  // 处理用途筛选变更
  const handlePurposeChange = useCallback((purpose: BusinessPurpose, checked: boolean) => {
    const currentPurpose = localFilters.purpose || []
    const newPurpose = checked
      ? [...currentPurpose, purpose]
      : currentPurpose.filter(p => p !== purpose)

    const newFilters = {
      ...localFilters,
      purpose: newPurpose.length > 0 ? newPurpose : undefined,
    }

    setLocalFilters(newFilters)
    onFilterChange(newFilters)
  }, [localFilters, onFilterChange])

  // 处理搜索
  const handleSearchChange = useCallback((value: string) => {
    const newFilters = {
      ...localFilters,
      searchKeyword: value || undefined,
    }

    setLocalFilters(newFilters)
    // 搜索实时生效
    onFilterChange(newFilters)
  }, [localFilters, onFilterChange])

  // 处理资产类型变更
  const handleAssetTypeChange = useCallback((value: string) => {
    const newFilters = {
      ...localFilters,
      assetType: value || undefined,
    }

    setLocalFilters(newFilters)
    onFilterChange(newFilters)
  }, [localFilters, onFilterChange])

  // 处理排序变更
  const handleSortChange = useCallback((field: string, order: string) => {
    const newFilters = {
      ...localFilters,
      sortBy: field as any,
      sortOrder: order as any,
    }

    setLocalFilters(newFilters)
    onFilterChange(newFilters)
  }, [localFilters, onFilterChange])

  // 重置筛选条件
  const handleReset = useCallback(() => {
    const resetFilters: HistoryFilters = {
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }

    setLocalFilters(resetFilters)
    onFilterChange(resetFilters)
    setTimeRangeType('custom')
    setIsExpanded(false)
  }, [onFilterChange])

  // 计算活跃筛选器数量
  const getActiveFilterCount = () => {
    let count = 0
    if (localFilters.searchKeyword) count++
    if (localFilters.status?.length) count++
    if (localFilters.purpose?.length) count++
    if (localFilters.assetType) count++
    if (localFilters.startDate || localFilters.endDate) count++
    return count
  }

  const activeFilterCount = getActiveFilterCount()

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-medium">筛选条件</CardTitle>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeFilterCount} 个筛选器
              </Badge>
            )}
            {resultCount !== undefined && (
              <span className="text-sm text-muted-foreground">
                找到 {resultCount} 条记录
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              {isExpanded ? '收起' : '展开'}筛选
            </Button>

            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                重置
              </Button>
            )}
          </div>
        </div>

        {/* 搜索框 - 始终显示 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索申请编号、资产名称或申请理由..."
            value={localFilters.searchKeyword || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
            disabled={isLoading}
          />
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="grid gap-6">
            {/* 时间范围筛选 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">时间范围</Label>
              <div className="flex flex-wrap gap-2">
                {TIME_RANGE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={timeRangeType === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleTimeRangeChange(option.value)}
                    disabled={isLoading}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              {/* 自定义时间范围 */}
              {timeRangeType === 'custom' && (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label className="text-sm">开始日期</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !localFilters.startDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {localFilters.startDate ? (
                            format(localFilters.startDate, 'yyyy年MM月dd日', { locale: zhCN })
                          ) : (
                            '选择开始日期'
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={localFilters.startDate}
                          onSelect={(date) => {
                            const newFilters = { ...localFilters, startDate: date }
                            setLocalFilters(newFilters)
                            onFilterChange(newFilters)
                          }}
                          disabled={(date) =>
                            date > new Date() || (localFilters.endDate && date > localFilters.endDate)
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex-1">
                    <Label className="text-sm">结束日期</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !localFilters.endDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {localFilters.endDate ? (
                            format(localFilters.endDate, 'yyyy年MM月dd日', { locale: zhCN })
                          ) : (
                            '选择结束日期'
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={localFilters.endDate}
                          onSelect={(date) => {
                            const newFilters = { ...localFilters, endDate: date }
                            setLocalFilters(newFilters)
                            onFilterChange(newFilters)
                          }}
                          disabled={(date) =>
                            date > new Date() || (localFilters.startDate && date < localFilters.startDate)
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* 状态筛选 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">申请状态</Label>
              <div className="grid grid-cols-2 gap-3">
                {STATUS_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${option.value}`}
                      checked={localFilters.status?.includes(option.value) || false}
                      onCheckedChange={(checked) =>
                        handleStatusChange(option.value, !!checked)
                      }
                      disabled={isLoading}
                    />
                    <Label
                      htmlFor={`status-${option.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      <Badge variant="secondary" className={cn('text-xs', option.color)}>
                        {option.label}
                      </Badge>
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* 用途筛选 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">业务用途</Label>
              <div className="grid grid-cols-2 gap-3">
                {PURPOSE_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`purpose-${option.value}`}
                      checked={localFilters.purpose?.includes(option.value) || false}
                      onCheckedChange={(checked) =>
                        handlePurposeChange(option.value, !!checked)
                      }
                      disabled={isLoading}
                    />
                    <Label
                      htmlFor={`purpose-${option.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* 资产类型和排序 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">资产类型</Label>
                <Select
                  value={localFilters.assetType || ''}
                  onValueChange={handleAssetTypeChange}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择资产类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">排序方式</Label>
                <div className="flex gap-2">
                  <Select
                    value={localFilters.sortBy || 'createdAt'}
                    onValueChange={(value) =>
                      handleSortChange(value, localFilters.sortOrder || 'desc')
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={localFilters.sortOrder || 'desc'}
                    onValueChange={(value) =>
                      handleSortChange(localFilters.sortBy || 'createdAt', value)
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">降序</SelectItem>
                      <SelectItem value="asc">升序</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}