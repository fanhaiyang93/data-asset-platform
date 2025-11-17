'use client'

/**
 * 申请历史列表组件
 * 支持虚拟滚动、无限加载、批量选择和导出功能
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/Skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { ApplicationStatus, BusinessPurpose } from '@prisma/client'
import {
  Clock,
  Calendar,
  User,
  Building,
  FileText,
  ExternalLink,
  Download,
  CheckCircle2,
  XCircle,
  Clock3,
  FileIcon,
  MoreHorizontal,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { HistoryFilters } from './ApplicationFilter'
import { ApplicationExportService } from '@/lib/services/applicationExport'

// 申请历史项数据类型
export interface ApplicationHistoryItem {
  id: string
  applicationNumber: string
  status: ApplicationStatus
  purpose: BusinessPurpose
  reason: string
  startDate: Date
  endDate: Date
  applicantName: string
  department?: string | null
  contactEmail: string
  contactPhone?: string | null
  reviewComment?: string | null
  reviewedAt?: Date | null
  submittedAt?: Date | null
  createdAt: Date
  updatedAt: Date
  asset: {
    id: string
    name: string
    description?: string | null
    type?: string | null
    category: {
      id: string
      name: string
    }
  }
  reviewer?: {
    id: string
    name?: string | null
    email: string
  } | null
  statusDisplayText: string
  progressPercentage: number
}

// 状态配置
const STATUS_CONFIG: Record<ApplicationStatus, {
  label: string
  color: string
  icon: React.ReactNode
  bgColor: string
}> = {
  DRAFT: {
    label: '草稿',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    icon: <FileText className="h-4 w-4" />,
  },
  PENDING: {
    label: '待审核',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    icon: <Clock3 className="h-4 w-4" />,
  },
  APPROVED: {
    label: '已通过',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  REJECTED: {
    label: '已拒绝',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: <XCircle className="h-4 w-4" />,
  },
}

// 用途显示映射
const PURPOSE_DISPLAY: Record<BusinessPurpose, string> = {
  REPORT_CREATION: '报表制作',
  DATA_ANALYSIS: '数据分析',
  BUSINESS_MONITOR: '业务监控',
  MODEL_TRAINING: '模型训练',
  SYSTEM_INTEGRATION: '系统集成',
  RESEARCH_ANALYSIS: '研究分析',
  OTHER: '其他用途',
}

interface ApplicationHistoryListProps {
  filters: HistoryFilters
  onItemClick?: (item: ApplicationHistoryItem) => void
  onExportSelected?: (selectedIds: string[]) => void
}

export function ApplicationHistoryList({
  filters,
  onItemClick,
  onExportSelected,
}: ApplicationHistoryListProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [isExporting, setIsExporting] = useState(false)

  // 使用无限查询获取申请历史
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['applicationHistory', filters],
    queryFn: async ({ pageParam }) => {
      const result = await trpc.application.getUserApplicationHistory.query({
        cursor: pageParam,
        limit: 20,
        status: filters.status,
        purpose: filters.purpose,
        assetType: filters.assetType,
        startDate: filters.startDate,
        endDate: filters.endDate,
        searchKeyword: filters.searchKeyword,
        sortBy: filters.sortBy || 'createdAt',
        sortOrder: filters.sortOrder || 'desc',
      })
      return result
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined,
  })

  // 合并所有页面的数据
  const allItems = useMemo(() => {
    return data?.pages.flatMap(page => page.items) || []
  }, [data])

  // 创建虚拟滚动容器引用
  const parentRef = React.useRef<HTMLDivElement>(null)

  // 配置虚拟滚动
  const virtualizer = useVirtualizer({
    count: allItems.length + (hasNextPage ? 1 : 0), // 加1用于加载更多指示器
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // 估算每项高度
    overscan: 5,
  })

  // 处理选择变更
  const handleSelectChange = useCallback((itemId: string, checked: boolean) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(itemId)
      } else {
        newSet.delete(itemId)
      }
      return newSet
    })
  }, [])

  // 处理全选/取消全选
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(allItems.map(item => item.id)))
    } else {
      setSelectedItems(new Set())
    }
  }, [allItems])

  // 处理导出选中项
  const handleExportSelected = useCallback(async () => {
    if (selectedItems.size === 0) return

    setIsExporting(true)
    try {
      if (onExportSelected) {
        await onExportSelected(Array.from(selectedItems))
      }
    } catch (error) {
      console.error('导出失败:', error)
    } finally {
      setIsExporting(false)
    }
  }, [selectedItems, onExportSelected])

  // 检查是否有更多数据需要加载
  useEffect(() => {
    const [lastItem] = [...virtualizer.getVirtualItems()].reverse()

    if (!lastItem) return

    if (
      lastItem.index >= allItems.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage()
    }
  }, [
    hasNextPage,
    fetchNextPage,
    allItems.length,
    isFetchingNextPage,
    virtualizer.getVirtualItems(),
  ])

  // 重置选中项当筛选条件变更时
  useEffect(() => {
    setSelectedItems(new Set())
  }, [filters])

  // 申请项组件
  const ApplicationItem = ({ item }: { item: ApplicationHistoryItem }) => {
    const statusConfig = STATUS_CONFIG[item.status]
    const isSelected = selectedItems.has(item.id)

    return (
      <Card
        className={cn(
          'transition-all hover:shadow-md cursor-pointer',
          isSelected && 'ring-2 ring-primary ring-offset-2'
        )}
        onClick={() => onItemClick?.(item)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => handleSelectChange(item.id, !!checked)}
                onClick={(e) => e.stopPropagation()}
              />

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-primary">
                    {item.applicationNumber}
                  </span>
                  <Badge variant="secondary" className={cn('text-xs', statusConfig.color, statusConfig.bgColor)}>
                    <span className="flex items-center gap-1">
                      {statusConfig.icon}
                      {statusConfig.label}
                    </span>
                  </Badge>
                </div>

                <h3 className="font-medium text-foreground">{item.asset.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {PURPOSE_DISPLAY[item.purpose]} · {item.asset.category.name}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(item.createdAt, { addSuffix: true, locale: zhCN })}
              </p>
              {item.progressPercentage > 0 && (
                <div className="mt-2 w-20">
                  <Progress value={item.progressPercentage} className="h-1" />
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* 申请信息 */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>{item.applicantName}</span>
              </div>

              {item.department && (
                <div className="flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  <span>{item.department}</span>
                </div>
              )}

              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>
                  {format(item.startDate, 'yyyy/MM/dd', { locale: zhCN })} -
                  {format(item.endDate, 'yyyy/MM/dd', { locale: zhCN })}
                </span>
              </div>

              {item.asset.type && (
                <div className="flex items-center gap-1">
                  <FileIcon className="h-3 w-3" />
                  <span>{item.asset.type}</span>
                </div>
              )}
            </div>

            {/* 申请理由 */}
            <div className="text-sm">
              <p className="text-muted-foreground line-clamp-2">
                {item.reason}
              </p>
            </div>

            {/* 状态信息 */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {item.statusDisplayText}
              </span>

              {(item.reviewComment || item.reviewer) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {item.reviewer && (
                    <span>审核人: {item.reviewer.name || item.reviewer.email}</span>
                  )}
                  {item.reviewComment && (
                    <span title={item.reviewComment}>
                      有审核意见
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 加载状态
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex gap-4">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // 错误状态
  if (isError) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertDescription>
          加载申请历史失败: {error?.message || '未知错误'}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="ml-2"
          >
            重试
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  // 空状态
  if (allItems.length === 0) {
    return (
      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">暂无申请记录</h3>
          <p className="text-muted-foreground">
            {Object.keys(filters).length > 1
              ? '当前筛选条件下没有找到申请记录，请尝试调整筛选条件'
              : '您还没有提交过任何申请'
            }
          </p>
        </CardContent>
      </Card>
    )
  }

  const selectedCount = selectedItems.size
  const isAllSelected = selectedCount === allItems.length && allItems.length > 0

  return (
    <div className="space-y-4">
      {/* 批量操作栏 */}
      {selectedCount > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                />
                <span className="font-medium">
                  已选择 {selectedCount} 个申请
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportSelected}
                  disabled={isExporting}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? '导出中...' : '导出选中'}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedItems(new Set())}
                >
                  取消选择
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 虚拟滚动列表 */}
      <div
        ref={parentRef}
        className="h-[600px] overflow-auto"
        style={{
          contain: 'strict',
        }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const isLoadingMore = virtualItem.index >= allItems.length
            const item = allItems[virtualItem.index]

            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {isLoadingMore ? (
                  hasNextPage ? (
                    <Card>
                      <CardContent className="py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                          <span className="text-sm text-muted-foreground">
                            加载更多申请记录...
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-4 text-center">
                        <span className="text-sm text-muted-foreground">
                          已加载全部 {allItems.length} 条申请记录
                        </span>
                      </CardContent>
                    </Card>
                  )
                ) : (
                  <ApplicationItem item={item} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}