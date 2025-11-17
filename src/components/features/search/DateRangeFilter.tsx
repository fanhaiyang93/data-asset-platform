'use client'

import React, { useState } from 'react'
import {
  Button,
  Badge,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Calendar,
  Skeleton
} from '@/components/ui'
import {
  CalendarIcon,
  Clock,
  X
} from 'lucide-react'
import { format, parseISO, startOfDay, endOfDay } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface DateRange {
  updatedAfter?: string
  updatedBefore?: string
  createdAfter?: string
  createdBefore?: string
}

interface DateRangeFilterProps {
  dateRanges: Array<{
    range: string
    from?: string
    to?: string
    label: string
    count: number
  }>
  selectedDateRange: DateRange
  onDateRangeChange: (dateRange: DateRange) => void
  isLoading?: boolean
  className?: string
}

export function DateRangeFilter({
  dateRanges,
  selectedDateRange,
  onDateRangeChange,
  isLoading = false,
  className
}: DateRangeFilterProps) {
  const [activeTab, setActiveTab] = useState<'preset' | 'custom'>('preset')
  const [customDates, setCustomDates] = useState({
    updatedFrom: selectedDateRange.updatedAfter ? parseISO(selectedDateRange.updatedAfter) : undefined,
    updatedTo: selectedDateRange.updatedBefore ? parseISO(selectedDateRange.updatedBefore) : undefined,
    createdFrom: selectedDateRange.createdAfter ? parseISO(selectedDateRange.createdAfter) : undefined,
    createdTo: selectedDateRange.createdBefore ? parseISO(selectedDateRange.createdBefore) : undefined,
  })

  // 预设日期范围选项
  const presetRanges = [
    {
      key: 'last_day',
      label: '最近1天',
      getRange: () => ({
        updatedAfter: format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        updatedBefore: format(new Date(), 'yyyy-MM-dd')
      })
    },
    {
      key: 'last_week',
      label: '最近1周',
      getRange: () => ({
        updatedAfter: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        updatedBefore: format(new Date(), 'yyyy-MM-dd')
      })
    },
    {
      key: 'last_month',
      label: '最近1个月',
      getRange: () => ({
        updatedAfter: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        updatedBefore: format(new Date(), 'yyyy-MM-dd')
      })
    },
    {
      key: 'last_quarter',
      label: '最近3个月',
      getRange: () => ({
        updatedAfter: format(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        updatedBefore: format(new Date(), 'yyyy-MM-dd')
      })
    },
    {
      key: 'last_year',
      label: '最近1年',
      getRange: () => ({
        updatedAfter: format(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        updatedBefore: format(new Date(), 'yyyy-MM-dd')
      })
    }
  ]

  // 处理预设范围选择
  const handlePresetRangeSelect = (preset: typeof presetRanges[0]) => {
    const range = preset.getRange()
    onDateRangeChange(range)
  }

  // 处理自定义日期变更
  const handleCustomDateChange = (
    field: keyof typeof customDates,
    date: Date | undefined
  ) => {
    const newCustomDates = {
      ...customDates,
      [field]: date
    }
    setCustomDates(newCustomDates)

    // 构建新的日期范围
    const newDateRange: DateRange = {}

    if (newCustomDates.updatedFrom) {
      newDateRange.updatedAfter = format(startOfDay(newCustomDates.updatedFrom), 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\'')
    }
    if (newCustomDates.updatedTo) {
      newDateRange.updatedBefore = format(endOfDay(newCustomDates.updatedTo), 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\'')
    }
    if (newCustomDates.createdFrom) {
      newDateRange.createdAfter = format(startOfDay(newCustomDates.createdFrom), 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\'')
    }
    if (newCustomDates.createdTo) {
      newDateRange.createdBefore = format(endOfDay(newCustomDates.createdTo), 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\'')
    }

    onDateRangeChange(newDateRange)
  }

  // 清除日期范围
  const clearDateRange = () => {
    setCustomDates({
      updatedFrom: undefined,
      updatedTo: undefined,
      createdFrom: undefined,
      createdTo: undefined,
    })
    onDateRangeChange({})
  }

  // 检查是否有选中的日期范围
  const hasSelectedRange = Object.values(selectedDateRange).some(value => value !== undefined)

  // 获取当前选中的预设范围
  const getSelectedPresetRange = () => {
    return presetRanges.find(preset => {
      const range = preset.getRange()
      return range.updatedAfter === selectedDateRange.updatedAfter &&
             range.updatedBefore === selectedDateRange.updatedBefore
    })
  }

  const selectedPreset = getSelectedPresetRange()

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        <h4 className="text-sm font-medium text-muted-foreground">
          时间范围
        </h4>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">
          时间范围
          {hasSelectedRange && (
            <span className="ml-2 text-primary">
              (已选择)
            </span>
          )}
        </h4>
        {hasSelectedRange && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearDateRange}
            className="h-6 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            清除
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'preset' | 'custom')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="preset">预设范围</TabsTrigger>
          <TabsTrigger value="custom">自定义</TabsTrigger>
        </TabsList>

        <TabsContent value="preset" className="space-y-2">
          {/* 预设范围按钮 */}
          <div className="grid gap-2">
            {presetRanges.map((preset) => {
              const isSelected = selectedPreset?.key === preset.key
              const rangeData = dateRanges.find(r => r.range === preset.key)

              return (
                <Button
                  key={preset.key}
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePresetRangeSelect(preset)}
                  className="justify-between h-8"
                >
                  <span className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    {preset.label}
                  </span>
                  {rangeData && (
                    <Badge variant="secondary" className="h-4 px-1 text-xs">
                      {rangeData.count}
                    </Badge>
                  )}
                </Button>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          {/* 更新时间范围 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">更新时间</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">从</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        'justify-start text-left font-normal h-8',
                        !customDates.updatedFrom && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {customDates.updatedFrom ? (
                        format(customDates.updatedFrom, 'yyyy-MM-dd', { locale: zhCN })
                      ) : (
                        <span>选择日期</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customDates.updatedFrom}
                      onSelect={(date) => handleCustomDateChange('updatedFrom', date)}
                      disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                      initialFocus
                      locale={zhCN}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">到</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        'justify-start text-left font-normal h-8',
                        !customDates.updatedTo && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {customDates.updatedTo ? (
                        format(customDates.updatedTo, 'yyyy-MM-dd', { locale: zhCN })
                      ) : (
                        <span>选择日期</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customDates.updatedTo}
                      onSelect={(date) => handleCustomDateChange('updatedTo', date)}
                      disabled={(date) =>
                        date > new Date() ||
                        date < new Date('1900-01-01') ||
                        (customDates.updatedFrom && date < customDates.updatedFrom)
                      }
                      initialFocus
                      locale={zhCN}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* 创建时间范围 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">创建时间</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">从</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        'justify-start text-left font-normal h-8',
                        !customDates.createdFrom && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {customDates.createdFrom ? (
                        format(customDates.createdFrom, 'yyyy-MM-dd', { locale: zhCN })
                      ) : (
                        <span>选择日期</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customDates.createdFrom}
                      onSelect={(date) => handleCustomDateChange('createdFrom', date)}
                      disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                      initialFocus
                      locale={zhCN}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">到</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        'justify-start text-left font-normal h-8',
                        !customDates.createdTo && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {customDates.createdTo ? (
                        format(customDates.createdTo, 'yyyy-MM-dd', { locale: zhCN })
                      ) : (
                        <span>选择日期</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customDates.createdTo}
                      onSelect={(date) => handleCustomDateChange('createdTo', date)}
                      disabled={(date) =>
                        date > new Date() ||
                        date < new Date('1900-01-01') ||
                        (customDates.createdFrom && date < customDates.createdFrom)
                      }
                      initialFocus
                      locale={zhCN}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 当前选择的日期范围显示 */}
      {hasSelectedRange && (
        <div className="p-2 bg-muted/50 rounded-md">
          <div className="text-xs text-muted-foreground space-y-1">
            {selectedDateRange.updatedAfter && selectedDateRange.updatedBefore && (
              <div>
                更新时间: {format(parseISO(selectedDateRange.updatedAfter), 'yyyy-MM-dd')} 至{' '}
                {format(parseISO(selectedDateRange.updatedBefore), 'yyyy-MM-dd')}
              </div>
            )}
            {selectedDateRange.createdAfter && selectedDateRange.createdBefore && (
              <div>
                创建时间: {format(parseISO(selectedDateRange.createdAfter), 'yyyy-MM-dd')} 至{' '}
                {format(parseISO(selectedDateRange.createdBefore), 'yyyy-MM-dd')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}