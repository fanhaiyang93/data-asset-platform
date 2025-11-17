'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Search, X, Clock, TrendingUp } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { trpc } from '@/lib/trpc-client'
import { debounce } from 'lodash'

interface SearchBarProps {
  placeholder?: string
  initialValue?: string
  onSearch?: (query: string) => void
  showSuggestions?: boolean
  className?: string
  searchStats?: {
    resultCount?: number
    searchTime?: number
  }
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder: propPlaceholder,
  initialValue = '',
  onSearch,
  showSuggestions = true,
  className = '',
  searchStats
}) => {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState(initialValue || searchParams.get('q') || '')
  const [showDropdown, setShowDropdown] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [liveResults, setLiveResults] = useState<any[]>([])
  const [showLiveResults, setShowLiveResults] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [searchMode, setSearchMode] = useState<'keyword' | 'ai'>('keyword')

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 获取搜索建议的tRPC mutation
  const suggestMutation = trpc.search.suggest.useQuery(
    { query, size: 5 },
    {
      enabled: false, // 手动触发
      staleTime: 5 * 60 * 1000, // 5分钟缓存
    }
  )

  // 实时搜索查询
  const liveSearchQuery = trpc.search.liveSearch.useQuery(
    { query, size: 5 },
    {
      enabled: false, // 手动触发
      staleTime: 30 * 1000, // 30秒缓存
    }
  )

  // 记录搜索行为
  const logSearchMutation = trpc.search.logSearchAction.useMutation()

  // 从localStorage加载最近搜索
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches')
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved))
      } catch (error) {
        console.error('加载最近搜索失败:', error)
      }
    }
  }, [])

  // 保存最近搜索到localStorage
  const saveRecentSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return

    const updated = [searchQuery, ...recentSearches.filter(q => q !== searchQuery)].slice(0, 10)
    setRecentSearches(updated)
    localStorage.setItem('recentSearches', JSON.stringify(updated))
  }, [recentSearches])

  // 防抖获取搜索建议和实时搜索结果 (300ms延迟)
  const debouncedGetSuggestions = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSuggestions([])
        setLiveResults([])
        setShowLiveResults(false)
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)

        // 并行获取搜索建议和实时搜索结果
        const [suggestResult, liveSearchResult] = await Promise.all([
          suggestMutation.refetch().catch(() => null),
          liveSearchQuery.refetch().catch(() => null)
        ])

        // 处理搜索建议
        if (suggestResult?.data?.success) {
          setSuggestions(suggestResult.data.data)
        }

        // 处理实时搜索结果
        if (liveSearchResult?.data?.success) {
          setLiveResults(liveSearchResult.data.data)
          setShowLiveResults(liveSearchResult.data.data.length > 0)
        }
      } catch (error) {
        console.error('获取搜索建议和实时结果失败:', error)
        setSuggestions([])
        setLiveResults([])
        setShowLiveResults(false)
      } finally {
        setIsLoading(false)
      }
    }, 300),
    [suggestMutation, liveSearchQuery]
  )

  // 处理输入变化
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)

    if (showSuggestions && value.trim().length >= 2) {
      setIsLoading(true)
      debouncedGetSuggestions(value)
    } else {
      setSuggestions([])
      setIsLoading(false)
    }
  }, [showSuggestions, debouncedGetSuggestions])

  // 处理搜索提交
  const handleSearch = useCallback((searchQuery?: string) => {
    const finalQuery = searchQuery || query

    if (!finalQuery.trim()) return

    // AI搜索模式 - 提示功能开发中
    if (searchMode === 'ai') {
      alert('🤖 AI智能搜索功能开发中...\n\n该功能将使用RAG技术,理解您的自然语言需求,智能推荐最合适的数据表。\n\n敬请期待!')
      return
    }

    // 关键字搜索模式 - 当前逻辑
    // 保存到最近搜索
    saveRecentSearch(finalQuery)

    // 记录搜索行为
    logSearchMutation.mutate({
      query: finalQuery,
      action: 'search',
      sessionId: `session_${Date.now()}`
    })

    // 关闭下拉框
    setShowDropdown(false)

    if (onSearch) {
      onSearch(finalQuery)
    } else {
      // 导航到搜索结果页面
      const params = new URLSearchParams(searchParams)
      params.set('q', finalQuery)
      params.delete('page') // 重置页码
      router.push(`/search?${params.toString()}`)
    }
  }, [query, searchMode, saveRecentSearch, logSearchMutation, onSearch, searchParams, router])

  // 计算所有可选项的总数
  const getTotalItems = useCallback(() => {
    let total = 0
    if (showLiveResults && liveResults.length > 0) total += liveResults.length
    if (suggestions.length > 0) total += suggestions.length
    if (!query.trim() && recentSearches.length > 0) total += recentSearches.length
    return total
  }, [showLiveResults, liveResults, suggestions, query, recentSearches])

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const totalItems = getTotalItems()

    if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0) {
        // 根据选中的项目类型执行不同操作
        if (showLiveResults && selectedIndex < liveResults.length) {
          // 选中实时搜索结果
          const selectedResult = liveResults[selectedIndex]
          router.push(`/assets/${selectedResult.id}`)
        } else {
          // 选中搜索建议或历史搜索
          const adjustedIndex = showLiveResults ? selectedIndex - liveResults.length : selectedIndex
          const selectedQuery = suggestions.length > 0 && adjustedIndex < suggestions.length
            ? suggestions[adjustedIndex]
            : recentSearches[adjustedIndex - suggestions.length]

          if (selectedQuery) {
            setQuery(selectedQuery)
            handleSearch(selectedQuery)
          }
        }
      } else {
        handleSearch()
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => prev < totalItems - 1 ? prev + 1 : prev)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => prev > -1 ? prev - 1 : -1)
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      setSelectedIndex(-1)
      inputRef.current?.blur()
    }
  }, [handleSearch, selectedIndex, getTotalItems, showLiveResults, liveResults, suggestions, recentSearches, router])

  // 清空搜索
  const clearSearch = useCallback(() => {
    setQuery('')
    setSuggestions([])
    setLiveResults([])
    setShowLiveResults(false)
    setShowDropdown(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }, [])

  // 处理点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 处理建议项点击
  const handleSuggestionClick = useCallback((suggestion: string) => {
    setQuery(suggestion)
    handleSearch(suggestion)
  }, [handleSearch])

  // 删除最近搜索项
  const removeRecentSearch = useCallback((searchQuery: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = recentSearches.filter(q => q !== searchQuery)
    setRecentSearches(updated)
    localStorage.setItem('recentSearches', JSON.stringify(updated))
  }, [recentSearches])

  // 切换搜索模式
  const toggleSearchMode = useCallback(() => {
    const newMode = searchMode === 'keyword' ? 'ai' : 'keyword'
    setSearchMode(newMode)
    // 清空输入和建议
    setQuery('')
    setSuggestions([])
    setShowDropdown(false)
    inputRef.current?.focus()
  }, [searchMode])

  // 根据模式动态设置placeholder
  const placeholder = searchMode === 'keyword'
    ? (propPlaceholder || '搜索表名、字段名、负责人...')
    : '用自然语言描述您的数据需求,例如:"我需要员工的薪酬数据"'

  return (
    <div className={`relative w-full max-w-2xl ${className}`}>
      {/* 搜索输入框 - 方案A优化 */}
      <div className={`relative flex items-center border-2 rounded-lg overflow-hidden
                      shadow-[0_2px_8px_rgba(24,144,255,0.1)] hover:shadow-[0_4px_12px_rgba(24,144,255,0.15)]
                      transition-all duration-200 ${
        searchMode === 'ai'
          ? 'border-purple-500 bg-gradient-to-r from-purple-50 to-white'
          : 'border-blue-500 bg-white'
      }`}>
        {/* 搜索模式切换按钮 - 移到最前面 */}
        <button
          onClick={toggleSearchMode}
          className={`group relative px-4 py-3 font-medium text-sm border-r border-gray-200
                     transition-all duration-200 flex items-center gap-2 ${
            searchMode === 'ai'
              ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
          }`}
          type="button"
          title={searchMode === 'keyword' ? '切换到AI智能搜索' : '切换到精确搜索'}
        >
          {/* 图标 + 文字 */}
          <div className="flex items-center gap-1.5">
            <span className="text-lg">{searchMode === 'keyword' ? '🔍' : '🤖'}</span>
            <span className="whitespace-nowrap">{searchMode === 'keyword' ? '关键字' : 'AI'}</span>
          </div>

          {/* 切换提示图标 */}
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              searchMode === 'ai' ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>

          {/* Hover提示气泡 */}
          <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-50">
            <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg whitespace-nowrap">
              {searchMode === 'keyword' ? '切换到 🤖 AI智能搜索' : '切换到 🔍 关键字搜索'}
              <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
            </div>
          </div>
        </button>

        <div className="pl-4 flex items-center pointer-events-none">
          <Search className={`h-5 w-5 ${searchMode === 'ai' ? 'text-purple-500' : 'text-blue-500'}`} />
        </div>

        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
          className="flex-1 px-3 py-3 border-none outline-none
                     bg-transparent text-gray-900 placeholder-gray-500
                     focus:ring-0 text-[15px]"
        />

        {query && (
          <button
            onClick={clearSearch}
            className="px-3 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <button
          onClick={() => handleSearch()}
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-3
                     transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
          type="button"
        >
          搜索
        </button>
      </div>

      {/* 搜索提示和结果反馈 */}
      {searchStats && searchStats.resultCount !== undefined && (
        <div className="mt-3 text-sm">
          <div className="px-3 py-1 bg-blue-50 text-blue-700 border-l-3 border-blue-500 rounded inline-block">
            ✓ 找到 <span className="font-semibold">{searchStats.resultCount}</span> 个数据表
            {searchStats.searchTime && (
              <span className="ml-2 text-blue-600">({(searchStats.searchTime / 1000).toFixed(1)}秒)</span>
            )}
          </div>
        </div>
      )}

      {/* 搜索建议下拉框 */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto"
        >
          {/* 加载状态 */}
          {isLoading && (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              正在搜索建议...
            </div>
          )}

          {/* 实时搜索结果 */}
          {!isLoading && showLiveResults && liveResults.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                实时搜索结果
              </div>
              {liveResults.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => router.push(`/assets/${result.id}`)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50
                           flex items-start space-x-3 text-gray-900 transition-colors duration-150 ${
                             selectedIndex === index ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                           }`}
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-xs font-medium text-blue-600">
                      {result.type?.charAt(0)?.toUpperCase() || 'A'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{result.name}</div>
                    <div className="text-sm text-gray-500 truncate">
                      {result.description || '无描述'}
                    </div>
                    {result.categoryName && (
                      <div className="text-xs text-gray-400 mt-1">
                        分类: {result.categoryName}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {result.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* 搜索建议 */}
          {!isLoading && suggestions.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                搜索建议
              </div>
              {suggestions.map((suggestion, index) => {
                const adjustedIndex = showLiveResults ? liveResults.length + index : index
                return (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={`w-full px-4 py-2 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50
                             flex items-center space-x-3 text-gray-900 transition-colors duration-150 ${
                               selectedIndex === adjustedIndex ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                             }`}
                  >
                    <TrendingUp className="h-4 w-4 text-gray-400" />
                    <span>{suggestion}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* 最近搜索 */}
          {!isLoading && !query.trim() && recentSearches.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                最近搜索
              </div>
              {recentSearches.map((recentQuery, index) => {
                const adjustedIndex = suggestions.length + index
                return (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(recentQuery)}
                    className={`w-full px-4 py-2 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50
                             flex items-center justify-between space-x-3 text-gray-900 group transition-colors duration-150 ${
                               selectedIndex === adjustedIndex ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                             }`}
                  >
                  <div className="flex items-center space-x-3">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span>{recentQuery}</span>
                  </div>
                    <button
                      onClick={(e) => removeRecentSearch(recentQuery, e)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600
                               focus:outline-none transition-opacity duration-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </button>
                )
              })}
            </div>
          )}

          {/* 空状态 */}
          {!isLoading && query.trim() && suggestions.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500">
              <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">没有找到相关建议</p>
              <p className="text-xs text-gray-400 mt-1">
                按 Enter 搜索 "{query}"
              </p>
            </div>
          )}

          {/* 空状态 - 没有最近搜索 */}
          {!isLoading && !query.trim() && recentSearches.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500">
              <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">开始搜索数据资产</p>
              <p className="text-xs text-gray-400 mt-1">
                输入关键词查找表、字段或其他资产
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}