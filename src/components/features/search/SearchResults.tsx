'use client'

import React from 'react'
import Link from 'next/link'
import { Database, Table, Star, Eye, ChevronRight, Tag, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SortIndicator } from './SortIndicator'
import { SearchResult } from '@/types/search'

interface SearchResultsProps {
  data: {
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
    sortMethod?: string
    sortWeights?: any
    abTestVariant?: string
  } | null
  loading: boolean
  error: string | null
  query: string
  onResultClick: (result: any) => void
  onLoadMore: () => void
  onSuggestionClick: (suggestion: string) => void
}

// 高亮匹配的文本
const HighlightText: React.FC<{ text: string; highlights?: string[]; className?: string }> = ({
  text,
  highlights,
  className = ''
}) => {
  if (!highlights || highlights.length === 0) {
    return <span className={className}>{text}</span>
  }

  // 使用第一个高亮结果（如果存在）
  const highlightedText = highlights[0]
  if (highlightedText) {
    return (
      <span
        className={className}
        dangerouslySetInnerHTML={{ __html: highlightedText }}
      />
    )
  }

  return <span className={className}>{text}</span>
}

// 单个搜索结果项
const SearchResultItem: React.FC<{
  result: any;
  query: string;
  onClick?: (result: any) => void;
}> = ({ result, query, onClick }) => {
  const getTypeIcon = (type: string | null) => {
    switch (type?.toLowerCase()) {
      case 'table':
        return <Table className="h-5 w-5 text-blue-500" />
      case 'view':
        return <Eye className="h-5 w-5 text-green-500" />
      default:
        return <Database className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      case 'deprecated':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  const formatScore = (score: number) => {
    return Math.min(score * 20, 100).toFixed(0) // 将ES分数转换为百分比
  }

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-200 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* 标题和类型 */}
          <div className="flex items-center space-x-3 mb-2">
            {getTypeIcon(result.type)}
            <Link
              href={`/assets/${result.id}`}
              className="text-lg font-semibold text-blue-600 hover:text-blue-800 transition-colors duration-200 truncate"
            >
              <HighlightText
                text={result.name}
                highlights={result.highlights?.name}
              />
            </Link>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
              {result.status}
            </span>
          </div>

          {/* 路径信息 */}
          {(result.databaseName || result.schemaName) && (
            <div className="flex items-center text-sm text-gray-600 mb-2">
              <Database className="h-4 w-4 mr-1" />
              <span className="truncate">
                {[result.databaseName, result.schemaName, result.tableName].filter(Boolean).join(' → ')}
              </span>
            </div>
          )}

          {/* 描述 */}
          {result.description && (
            <p className="text-gray-700 text-sm mb-3 line-clamp-2">
              <HighlightText
                text={result.description}
                highlights={result.highlights?.description}
              />
            </p>
          )}

          {/* 业务描述 */}
          {result.businessDescription && (
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">
              <HighlightText
                text={result.businessDescription}
                highlights={result.highlights?.businessDescription}
              />
            </p>
          )}

          {/* 标签 */}
          {result.tags && (
            <div className="flex items-center space-x-2 mb-3">
              <Tag className="h-4 w-4 text-gray-400" />
              <div className="flex flex-wrap gap-1">
                {result.tags.split(',').slice(0, 3).map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800"
                  >
                    {tag.trim()}
                  </span>
                ))}
                {result.tags.split(',').length > 3 && (
                  <span className="text-xs text-gray-500">
                    +{result.tags.split(',').length - 3} 更多
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 元数据 */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-4">
              {result.categoryName && (
                <span className="flex items-center">
                  <ChevronRight className="h-3 w-3 mr-1" />
                  {result.categoryName}
                </span>
              )}
              {result.type && (
                <span className="capitalize">{result.type}</span>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {result.sortingScores && (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center">
                    <Star className="h-3 w-3 mr-1 text-yellow-400" />
                    <span className="text-xs">综合: {(result.sortingScores.finalScore * 100).toFixed(0)}%</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    相关度: {(result.sortingScores.relevanceScore * 100).toFixed(0)}%
                  </div>
                </div>
              )}
              {!result.sortingScores && (
                <span className="flex items-center text-xs">
                  <Star className="h-3 w-3 mr-1 text-yellow-400" />
                  相关度: {formatScore(result.searchScore)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="ml-4 flex-shrink-0">
          <Link
            href={`/assets/${result.id}`}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            查看详情
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  data,
  loading,
  error,
  query,
  onResultClick,
  onLoadMore,
  onSuggestionClick
}) => {
  // 处理错误状态
  if (error) {
    return (
      <div className="text-center py-12">
        <Database className="mx-auto h-12 w-12 text-red-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          搜索出错了
        </h3>
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>
          重新尝试
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="h-5 w-5 bg-gray-300 rounded"></div>
                  <div className="h-6 bg-gray-300 rounded w-64"></div>
                  <div className="h-5 bg-gray-300 rounded w-16"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-48 mb-2"></div>
                <div className="space-y-2 mb-3">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
                <div className="flex space-x-2 mb-3">
                  <div className="h-6 bg-gray-200 rounded w-12"></div>
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="flex justify-between">
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
              <div className="ml-4">
                <div className="h-9 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!data || data.results.length === 0) {
    return (
      <div className="text-center py-12">
        <Database className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          没有找到相关结果
        </h3>
        <p className="text-gray-500 mb-4">
          尝试使用不同的关键词或者调整搜索条件
        </p>
        {data?.suggestions && data.suggestions.length > 0 && (
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">推荐搜索：</p>
            <div className="flex justify-center flex-wrap gap-2">
              {data.suggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => onSuggestionClick(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )}
        <div className="text-sm text-gray-400">
          <p>搜索建议：</p>
          <ul className="mt-2 space-y-1">
            <li>• 尝试使用更简单的关键词</li>
            <li>• 检查拼写是否正确</li>
            <li>• 使用不同的搜索词组合</li>
            <li>• 尝试使用资产的别名或标签</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 搜索结果概览 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                找到 <span className="font-bold">{data.total}</span> 个相关资产
              </span>
            </div>
            {data.sortMethod && (
              <Badge variant="outline" className="text-xs">
                {data.sortMethod === 'relevance' ? '相关度排序' :
                 data.sortMethod === 'popularity' ? '热度排序' :
                 data.sortMethod === 'recency' ? '时效性排序' :
                 data.sortMethod === 'created' ? '创建时间排序' :
                 data.sortMethod === 'personalized' ? '个性化排序' : '默认排序'}
              </Badge>
            )}
            {data.abTestVariant && (
              <Badge variant="secondary" className="text-xs">
                A/B测试: {data.abTestVariant}
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-blue-600">
              搜索："{query}"
            </span>
            <span className="text-xs text-gray-500">
              {data.searchTime.toFixed(0)}ms
            </span>
          </div>
        </div>
      </div>

      {/* 搜索结果列表 */}
      <div className="space-y-4">
        {data.results.map((result, index) => (
          <div key={result.id} className="space-y-2">
            <SearchResultItem
              result={result}
              query={query}
              onClick={() => onResultClick(result)}
            />

            {/* 为个性化排序显示详细的排序指示器 */}
            {result.sortingScores && data.sortMethod === 'personalized' && (
              <SortIndicator
                sortMethod={data.sortMethod as any}
                weights={data.sortWeights}
                scores={result.sortingScores}
                rank={index + 1}
                totalResults={data.total}
                className="ml-6 mt-2"
              />
            )}
          </div>
        ))}
      </div>

      {/* 加载更多按钮 */}
      {data.hasMore && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? '加载中...' : '加载更多'}
          </Button>
        </div>
      )}
    </div>
  )
}