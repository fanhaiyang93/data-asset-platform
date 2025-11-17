'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { SearchBar } from './SearchBar'
import { SearchResults } from './SearchResults'
import { SortControls } from './SortControls'
import { SortIndicator } from './SortIndicator'
import { SortStatusBar } from './SortStatusBar'
import { cn } from '@/lib/utils'
import type { SortOption, ScoringWeights, UserSortPreferences, SortingFeedback } from '@/types/search'

// Mock tRPC hook - 在实际项目中应该使用真实的tRPC hooks
interface SearchResponse {
  results: Array<{
    id: string
    name: string
    description: string | null
    code: string
    type: string | null
    categoryId: string
    tags: string | null
    searchScore: number
    sortingScores?: {
      relevanceScore: number
      popularityScore: number
      recencyScore: number
      personalizationScore: number
      finalScore: number
      explanation?: string
    }
    highlights?: {
      name?: string[]
      description?: string[]
      tags?: string[]
    }
    createdAt: Date
    updatedAt: Date
  }>
  total: number
  page: number
  pageSize: number
  hasMore: boolean
  searchTime: number
  suggestions?: string[]
  sortMethod?: SortOption
  sortWeights?: ScoringWeights
  abTestVariant?: string
}

interface SearchOptions {
  categoryId?: string
  type?: string
  sort?: SortOption
  weights?: ScoringWeights
  userId?: string
}

// Mock API 调用 - 在实际项目中应该使用 tRPC
const mockSearchAPI = {
  search: async (query: string, options: SearchOptions & { page?: number; pageSize?: number } = {}): Promise<SearchResponse> => {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 300))

    // 生成排序评分的辅助函数
    const generateSortingScores = (baseRelevance: number, sortMethod: SortOption = 'relevance') => {
      const relevanceScore = Math.max(0, Math.min(1, baseRelevance / 100 + (Math.random() - 0.5) * 0.1))
      const popularityScore = Math.max(0, Math.min(1, Math.random() * 0.8 + 0.1))
      const recencyScore = Math.max(0, Math.min(1, Math.random() * 0.9 + 0.1))
      const personalizationScore = Math.max(0, Math.min(1, Math.random() * 0.7 + 0.2))

      // 根据排序方法调整权重
      const weights = options?.weights || {
        relevance: sortMethod === 'relevance' ? 0.5 : 0.25,
        popularity: sortMethod === 'popularity' ? 0.5 : 0.25,
        recency: sortMethod === 'recency' ? 0.5 : 0.25,
        personalization: sortMethod === 'personalized' ? 0.4 : 0.25
      }

      const finalScore =
        relevanceScore * weights.relevance +
        popularityScore * weights.popularity +
        recencyScore * weights.recency +
        personalizationScore * weights.personalization

      return {
        relevanceScore,
        popularityScore,
        recencyScore,
        personalizationScore,
        finalScore,
        explanation: `基于${sortMethod === 'relevance' ? '相关度' :
                     sortMethod === 'popularity' ? '热度' :
                     sortMethod === 'recency' ? '时效性' :
                     sortMethod === 'personalized' ? '个性化' : '综合'}排序`
      }
    }

    // 模拟搜索结果
    const sortMethod = options?.sort || 'relevance'
    const mockResults = [
      {
        id: '1',
        name: 'user_info_table',
        description: '用户基础信息表，包含用户的基本资料和联系方式',
        code: 'T001',
        type: 'table',
        categoryId: 'cat1',
        tags: '用户,基础信息,个人资料',
        searchScore: 95,
        sortingScores: generateSortingScores(95, sortMethod),
        highlights: {
          name: ['user_info_table'],
          description: ['用户基础信息表']
        },
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-11-01')
      },
      {
        id: '2',
        name: 'order_transaction_log',
        description: '订单交易日志表，记录所有订单的交易流水和状态变更',
        code: 'T002',
        type: 'table',
        categoryId: 'cat2',
        tags: '订单,交易,日志',
        searchScore: 88,
        sortingScores: generateSortingScores(88, sortMethod),
        createdAt: new Date('2024-02-20'),
        updatedAt: new Date('2024-10-28')
      },
      {
        id: '3',
        name: 'product_catalog_view',
        description: '产品目录视图，聚合了产品基础信息和分类数据',
        code: 'V001',
        type: 'view',
        categoryId: 'cat1',
        tags: '产品,目录,分类',
        searchScore: 82,
        sortingScores: generateSortingScores(82, sortMethod),
        createdAt: new Date('2024-03-10'),
        updatedAt: new Date('2024-11-05')
      }
    ]

    // 简单的搜索过滤
    let filteredResults = query
      ? mockResults.filter(item =>
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          item.description.toLowerCase().includes(query.toLowerCase()) ||
          item.tags.toLowerCase().includes(query.toLowerCase())
        )
      : mockResults

    // 根据排序方法对结果进行排序
    filteredResults = filteredResults.sort((a, b) => {
      switch (sortMethod) {
        case 'relevance':
          return b.searchScore - a.searchScore
        case 'popularity':
          return (b.sortingScores?.popularityScore || 0) - (a.sortingScores?.popularityScore || 0)
        case 'recency':
          return b.updatedAt.getTime() - a.updatedAt.getTime()
        case 'created':
          return b.createdAt.getTime() - a.createdAt.getTime()
        case 'personalized':
          return (b.sortingScores?.finalScore || 0) - (a.sortingScores?.finalScore || 0)
        default:
          return b.searchScore - a.searchScore
      }
    })

    return {
      results: filteredResults,
      total: filteredResults.length,
      page: options.page || 1,
      pageSize: options.pageSize || 20,
      hasMore: false,
      searchTime: Math.random() * 200 + 50,
      sortMethod,
      sortWeights: options?.weights,
      abTestVariant: Math.random() > 0.5 ? 'A' : 'B',
      suggestions: query && filteredResults.length === 0
        ? ['用户表', '订单表', '产品数据', '交易记录']
        : undefined
    }
  },

  suggest: async (query: string): Promise<string[]> => {
    await new Promise(resolve => setTimeout(resolve, 100))

    const suggestions = [
      'user_info_table',
      'order_transaction_log',
      'product_catalog_view',
      '用户基础信息',
      '订单交易数据',
      '产品目录'
    ]

    return suggestions.filter(s =>
      s.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5)
  }
}

interface SearchPageProps {
  className?: string
}

export function SearchPage({ className }: SearchPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [searchData, setSearchData] = useState<SearchResponse | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 从 URL 参数获取初始搜索查询
  const initialQuery = searchParams.get('q') || ''
  const [currentQuery, setCurrentQuery] = useState(initialQuery)

  // 排序相关状态
  const [currentSort, setCurrentSort] = useState<SortOption>('relevance')
  const [customWeights, setCustomWeights] = useState<ScoringWeights>({
    relevance: 0.4,
    popularity: 0.3,
    recency: 0.2,
    personalization: 0.1
  })

  // Mock用户偏好数据 - 在实际项目中应该从API获取
  const [userPreferences] = useState<UserSortPreferences>({
    defaultSort: 'relevance',
    sortFrequency: {
      relevance: 45,
      popularity: 23,
      recency: 12,
      quality: 8,
      created: 3,
      personalized: 17
    },
    savedSorts: [
      {
        name: '我的常用配置',
        sort: 'personalized',
        weights: {
          relevance: 0.3,
          popularity: 0.4,
          recency: 0.2,
          personalization: 0.1
        },
        createdAt: new Date('2024-10-15')
      }
    ],
    lastUsedSort: 'relevance'
  })

  // 执行搜索
  const handleSearch = useCallback(async (query: string, options: SearchOptions = {}) => {
    if (!query.trim()) {
      setSearchData(null)
      return
    }

    setLoading(true)
    setError(null)
    setCurrentQuery(query)

    // 合并排序选项
    const searchOptions = {
      ...options,
      sort: options.sort || currentSort,
      weights: options.weights || (currentSort === 'personalized' ? customWeights : undefined),
      userId: 'demo-user-123' // Mock用户ID
    }

    // 更新 URL
    const params = new URLSearchParams()
    params.set('q', query)
    if (searchOptions.categoryId) params.set('category', searchOptions.categoryId)
    if (searchOptions.type) params.set('type', searchOptions.type)
    if (searchOptions.sort && searchOptions.sort !== 'relevance') params.set('sort', searchOptions.sort)

    router.push(`/search?${params.toString()}`, { scroll: false })

    try {
      const result = await mockSearchAPI.search(query, searchOptions)
      setSearchData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败')
    } finally {
      setLoading(false)
    }
  }, [router, currentSort, customWeights])

  // 处理排序变更
  const handleSortChange = useCallback((sort: SortOption, weights?: ScoringWeights) => {
    setCurrentSort(sort)
    if (weights) {
      setCustomWeights(weights)
    }

    // 如果有当前搜索查询，重新执行搜索
    if (currentQuery) {
      handleSearch(currentQuery, { sort, weights })
    }
  }, [currentQuery, handleSearch])

  // 处理排序反馈
  const handleSortingFeedback = useCallback((feedback: SortingFeedback) => {
    // 在实际项目中，这里应该调用API保存反馈
    console.log('Sorting feedback:', feedback)
    // 可以添加toast通知
  }, [])

  // 获取搜索建议
  const handleSuggestionsLoad = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([])
      return
    }

    try {
      const result = await mockSearchAPI.suggest(query)
      setSuggestions(result)
    } catch (err) {
      console.error('Failed to load suggestions:', err)
    }
  }, [])

  // 处理搜索结果点击
  const handleResultClick = useCallback((result: any) => {
    // 这里应该导航到资产详情页
    console.log('Result clicked:', result)
    router.push(`/assets/${result.id}`)
  }, [router])

  // 处理建议点击
  const handleSuggestionClick = useCallback((suggestion: string) => {
    handleSearch(suggestion)
  }, [handleSearch])

  // 处理加载更多
  const handleLoadMore = useCallback(async () => {
    if (!searchData || !searchData.hasMore) return

    setLoading(true)
    try {
      const result = await mockSearchAPI.search(currentQuery, {
        page: searchData.page + 1,
        pageSize: searchData.pageSize
      })

      setSearchData(prev => prev ? {
        ...result,
        results: [...prev.results, ...result.results]
      } : result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [searchData, currentQuery])

  // 初始搜索（如果URL中有查询参数）
  useEffect(() => {
    if (initialQuery) {
      handleSearch(initialQuery)
    }
  }, []) // 只在组件挂载时执行

  // 监听搜索输入变化，加载建议
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (currentQuery.length >= 2) {
        handleSuggestionsLoad(currentQuery)
      }
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [currentQuery, handleSuggestionsLoad])

  return (
    <div className={cn('container mx-auto px-4 py-8 max-w-6xl', className)}>
      <div className="space-y-8">
        {/* 页面标题 */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">数据资产搜索</h1>
          <p className="text-muted-foreground">快速查找表、字段、报表等数据资产</p>
        </div>

        {/* 搜索框 */}
        <div className="flex justify-center">
          <SearchBar
            onSearch={handleSearch}
            onSuggestSelect={handleSuggestionClick}
            suggestions={suggestions}
            loading={loading}
            defaultValue={initialQuery}
            showFilters={true}
            className="w-full max-w-2xl"
          />
        </div>

        {/* 排序控制和状态区域 */}
        {(searchData || currentQuery) && (
          <div className="space-y-4">
            {/* 排序状态栏 */}
            <SortStatusBar
              sortMethod={currentSort}
              weights={currentSort === 'personalized' ? customWeights : searchData?.sortWeights}
              isLoading={loading}
              totalResults={searchData?.total}
              responseTime={searchData?.searchTime}
              abTestVariant={searchData?.abTestVariant}
              sortQuality={
                searchData?.results?.length ? {
                  score: Math.min(9.5, Math.max(6.0,
                    searchData.results.reduce((sum, r) => sum + (r.sortingScores?.finalScore || r.searchScore / 100), 0) / searchData.results.length * 10
                  )),
                  label: searchData.total > 50 ? 'excellent' :
                         searchData.total > 20 ? 'good' :
                         searchData.total > 5 ? 'average' : 'poor',
                  factors: [
                    '结果相关性',
                    currentSort === 'personalized' ? '个性化匹配' : '排序一致性',
                    `${searchData.results.length}个高质量结果`
                  ]
                } : undefined
              }
            />

            {/* 排序控制栏 */}
            {searchData && (
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg">
                <SortControls
                  currentSort={currentSort}
                  onSortChange={handleSortChange}
                  onFeedback={handleSortingFeedback}
                  userPreferences={userPreferences}
                  showAdvanced={true}
                  disabled={loading}
                  className="flex-1"
                />

                {/* 详细排序指示器（仅在有搜索结果时显示） */}
                <SortIndicator
                  sortMethod={currentSort}
                  weights={currentSort === 'personalized' ? customWeights : searchData.sortWeights}
                  responseTime={searchData.searchTime}
                  className="lg:max-w-sm"
                />
              </div>
            )}
          </div>
        )}

        {/* 搜索结果 */}
        <SearchResults
          data={searchData}
          loading={loading}
          error={error}
          query={currentQuery}
          onResultClick={handleResultClick}
          onLoadMore={handleLoadMore}
          onSuggestionClick={handleSuggestionClick}
        />

        {/* 搜索提示 */}
        {!currentQuery && !loading && (
          <Card className="p-8 text-center bg-muted/30">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">搜索提示</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                  <h4 className="font-medium text-foreground mb-2">支持搜索</h4>
                  <ul className="space-y-1">
                    <li>• 表名和字段名</li>
                    <li>• 业务描述</li>
                    <li>• 标签和分类</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">搜索技巧</h4>
                  <ul className="space-y-1">
                    <li>• 使用关键词组合</li>
                    <li>• 支持模糊匹配</li>
                    <li>• 按相关度排序</li>
                  </ul>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}