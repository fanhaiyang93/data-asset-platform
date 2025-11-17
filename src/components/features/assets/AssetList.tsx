'use client'

import React, { useState, useEffect } from 'react'
import { trpc } from '@/lib/trpc'
import { type AssetSummary, type AssetListParams, type AssetListState } from '@/types'
import { AssetCard } from './AssetCard'
import { CardSkeleton } from '@/components/ui/Skeleton'
import {
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline'

interface AssetListProps {
  categoryId: string
  categoryName?: string
  onAssetSelect?: (asset: AssetSummary) => void
  className?: string
}

export const AssetList: React.FC<AssetListProps> = ({
  categoryId,
  categoryName,
  onAssetSelect,
  className = ''
}) => {
  // 状态管理
  const [state, setState] = useState<AssetListState>({
    assets: [],
    loading: true,
    total: 0,
    hasMore: false,
    page: 1,
    limit: 20,
    sortBy: 'updatedAt',
    sortOrder: 'desc'
  })

  // tRPC 查询 - 直接使用state值确保React Query能追踪变化
  const { data, isLoading, error, refetch } = trpc.assets.getAssetsByCategory.useQuery(
    {
      categoryId,
      page: state.page,
      limit: state.limit,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder
    },
    {
      enabled: !!categoryId,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      staleTime: 1000, // 减少缓存时间为1秒,确保筛选立即生效
    }
  )

  // 当分类改变时,重置状态
  useEffect(() => {
    setState(prev => ({
      ...prev,
      page: 1,
      assets: [],
      total: 0,
      hasMore: false,
      loading: true
    }))
  }, [categoryId])

  // 更新状态
  useEffect(() => {
    if (data) {
      setState(prev => ({
        ...prev,
        assets: data.assets,
        total: data.total,
        hasMore: data.hasMore,
        loading: false
      }))
    }
  }, [data])

  useEffect(() => {
    setState(prev => ({
      ...prev,
      loading: isLoading
    }))
  }, [isLoading])

  // 处理排序
  const handleSort = (sortBy: 'name' | 'updatedAt' | 'viewCount') => {
    const newSortOrder = state.sortBy === sortBy && state.sortOrder === 'desc' ? 'asc' : 'desc'

    setState(prev => ({
      ...prev,
      sortBy,
      sortOrder: newSortOrder,
      page: 1,
      loading: true
    }))
  }

  // 处理分页
  const handlePageChange = (newPage: number) => {
    setState(prev => ({
      ...prev,
      page: newPage,
      loading: true
    }))
  }

  // 处理每页条数变更
  const handleLimitChange = (newLimit: number) => {
    setState(prev => ({
      ...prev,
      limit: newLimit,
      page: 1,
      loading: true
    }))
  }

  // 排序按钮渲染
  const SortButton: React.FC<{
    sortKey: 'name' | 'updatedAt' | 'viewCount'
    label: string
  }> = ({ sortKey, label }) => {
    const isActive = state.sortBy === sortKey
    const Icon = isActive && state.sortOrder === 'asc' ? ArrowUpIcon : ArrowDownIcon

    return (
      <button
        onClick={() => handleSort(sortKey)}
        className={`flex items-center space-x-1 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        <span>{label}</span>
        {isActive && <Icon className="h-3 w-3" />}
      </button>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
        <div className="text-center py-12">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">加载失败</h3>
          <p className="text-gray-500 mb-4">无法加载资产列表，请稍后重试</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm ${className}`}>
      {/* 头部 */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {categoryName || '资产列表'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              共 {state.total} 个资产
            </p>
          </div>

          {/* 每页条数选择器 */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">每页显示</span>
            <select
              value={state.limit}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
            <span className="text-sm text-gray-600">条</span>
          </div>
        </div>

        {/* 排序按钮 */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600 mr-2">排序：</span>
          <SortButton sortKey="updatedAt" label="更新时间" />
          <SortButton sortKey="viewCount" label="热门程度" />
          <SortButton sortKey="name" label="名称" />
        </div>
      </div>

      {/* 列表内容 */}
      <div className="p-6">
        {state.loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: state.limit }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : state.assets.length === 0 ? (
          <div className="text-center py-12">
            <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无资产</h3>
            <p className="text-gray-500">该分类下还没有任何数据资产</p>
          </div>
        ) : (
          <>
            {/* 资产卡片列表 */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {state.assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onClick={() => onAssetSelect?.(asset)}
                />
              ))}
            </div>

            {/* 分页 */}
            {state.total > state.limit && (
              <div className="mt-8 flex items-center justify-between">
                <p className="text-sm text-gray-700">
                  显示第 {(state.page - 1) * state.limit + 1} - {Math.min(state.page * state.limit, state.total)} 条，
                  共 {state.total} 条记录
                </p>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(state.page - 1)}
                    disabled={state.page === 1 || state.loading}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>

                  {/* 页码显示 */}
                  <span className="px-3 py-1 text-sm font-medium text-gray-900">
                    第 {state.page} 页，共 {Math.ceil(state.total / state.limit)} 页
                  </span>

                  <button
                    onClick={() => handlePageChange(state.page + 1)}
                    disabled={!state.hasMore || state.loading}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default AssetList