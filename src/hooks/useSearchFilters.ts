'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AdvancedFilters } from '@/types/search'

// 防抖hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

interface UseSearchFiltersOptions {
  defaultFilters?: AdvancedFilters
  enableLocalStorage?: boolean
  localStorageKey?: string
  enableUrlSync?: boolean
  onFiltersChange?: (filters: AdvancedFilters) => void
  debounceDelay?: number // URL同步防抖延迟，默认300ms
  enableBatchUpdates?: boolean // 是否启用批量更新
  maxCacheTime?: number // 本地缓存最大时间，默认24小时
}

interface FilterPreferences {
  defaultLogicOperator: 'AND' | 'OR'
  autoApplyFilters: boolean
  saveFiltersOnExit: boolean
  favoriteFilters: Array<{
    name: string
    filters: AdvancedFilters
    createdAt: string
  }>
}

const DEFAULT_FILTER_PREFERENCES: FilterPreferences = {
  defaultLogicOperator: 'AND',
  autoApplyFilters: true,
  saveFiltersOnExit: true,
  favoriteFilters: []
}

export function useSearchFilters(options: UseSearchFiltersOptions = {}) {
  const {
    defaultFilters = { logicOperator: 'AND' },
    enableLocalStorage = true,
    localStorageKey = 'search-filters',
    enableUrlSync = true,
    onFiltersChange,
    debounceDelay = 300,
    enableBatchUpdates = true,
    maxCacheTime = 86400000 // 24小时，毫秒
  } = options

  const router = useRouter()
  const searchParams = useSearchParams()

  const [filters, setFilters] = useState<AdvancedFilters>(defaultFilters)
  const [filterPreferences, setFilterPreferences] = useState<FilterPreferences>(DEFAULT_FILTER_PREFERENCES)
  const [isInitialized, setIsInitialized] = useState(false)
  const [pendingUpdates, setPendingUpdates] = useState<AdvancedFilters | null>(null)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const batchUpdateRef = useRef<AdvancedFilters>({})

  // 使用防抖来处理URL同步
  const debouncedFilters = useDebounce(filters, debounceDelay)

  // 从localStorage恢复用户偏好设置
  const loadPreferences = useCallback(() => {
    if (!enableLocalStorage || typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(`${localStorageKey}-preferences`)
      if (stored) {
        const preferences = JSON.parse(stored) as FilterPreferences
        setFilterPreferences(prev => ({ ...prev, ...preferences }))
      }
    } catch (error) {
      console.warn('Failed to load filter preferences:', error)
    }
  }, [enableLocalStorage, localStorageKey])

  // 保存用户偏好设置到localStorage
  const savePreferences = useCallback((preferences: FilterPreferences) => {
    if (!enableLocalStorage || typeof window === 'undefined') return

    try {
      localStorage.setItem(`${localStorageKey}-preferences`, JSON.stringify(preferences))
      setFilterPreferences(preferences)
    } catch (error) {
      console.warn('Failed to save filter preferences:', error)
    }
  }, [enableLocalStorage, localStorageKey])

  // 从localStorage恢复筛选状态
  const loadFiltersFromStorage = useCallback(() => {
    if (!enableLocalStorage || typeof window === 'undefined') return null

    try {
      const stored = localStorage.getItem(localStorageKey)
      if (stored) {
        const data = JSON.parse(stored)

        // 检查缓存是否过期
        if (data.timestamp && data.filters) {
          const age = Date.now() - data.timestamp
          if (age > maxCacheTime) {
            // 缓存过期，清除
            localStorage.removeItem(localStorageKey)
            return null
          }
          return data.filters as AdvancedFilters
        }

        // 兼容旧格式
        if (typeof data === 'object' && data !== null && !data.timestamp) {
          return data as AdvancedFilters
        }
      }
    } catch (error) {
      console.warn('Failed to load filters from localStorage:', error)
    }
    return null
  }, [enableLocalStorage, localStorageKey, maxCacheTime])

  // 保存筛选状态到localStorage
  const saveFiltersToStorage = useCallback((filtersToSave: AdvancedFilters) => {
    if (!enableLocalStorage || typeof window === 'undefined') return

    try {
      const data = {
        filters: filtersToSave,
        timestamp: Date.now()
      }
      localStorage.setItem(localStorageKey, JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to save filters to localStorage:', error)
    }
  }, [enableLocalStorage, localStorageKey])

  // 从URL参数恢复筛选状态
  const loadFiltersFromUrl = useCallback(() => {
    if (!enableUrlSync) return null

    const urlFilters: AdvancedFilters = {}

    searchParams.forEach((value, key) => {
      try {
        switch (key) {
          case 'categories':
          case 'statuses':
          case 'types':
          case 'owners':
          case 'tags':
            if (value) {
              urlFilters[key] = value.split(',').filter(Boolean)
            }
            break
          case 'qualityScoreMin':
          case 'qualityScoreMax':
            if (value && !isNaN(parseFloat(value))) {
              urlFilters[key] = parseFloat(value)
            }
            break
          case 'updatedAfter':
          case 'updatedBefore':
          case 'createdAfter':
          case 'createdBefore':
            // 验证日期格式
            if (value && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(.\d{3})?Z?)?$/.test(value)) {
              urlFilters[key] = value
            }
            break
          case 'logicOperator':
            if (value === 'AND' || value === 'OR') {
              urlFilters[key] = value
            }
            break
        }
      } catch (error) {
        console.warn(`Failed to parse URL parameter ${key}:`, error)
      }
    })

    return Object.keys(urlFilters).length > 0 ? urlFilters : null
  }, [enableUrlSync, searchParams])

  // 同步筛选状态到URL
  const syncFiltersToUrl = useCallback((filtersToSync: AdvancedFilters) => {
    if (!enableUrlSync || typeof window === 'undefined') return

    try {
      const params = new URLSearchParams(searchParams.toString())

      // 清除旧的筛选参数
      const filterKeys = [
        'categories', 'statuses', 'types', 'owners', 'tags',
        'qualityScoreMin', 'qualityScoreMax',
        'updatedAfter', 'updatedBefore', 'createdAfter', 'createdBefore',
        'logicOperator'
      ]
      filterKeys.forEach(key => params.delete(key))

      // 添加新的筛选参数
      Object.entries(filtersToSync).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value) && value.length > 0) {
            params.set(key, value.join(','))
          } else if (!Array.isArray(value)) {
            params.set(key, value.toString())
          }
        }
      })

      // 更新URL，不触发页面刷新
      const newUrl = `${window.location.pathname}?${params.toString()}`
      router.replace(newUrl, { scroll: false })
    } catch (error) {
      console.warn('Failed to sync filters to URL:', error)
    }
  }, [enableUrlSync, router, searchParams])

  // 计算活跃筛选条件数量
  const activeFiltersCount = useMemo(() => {
    return Object.entries(filters).reduce((count, [key, value]) => {
      if (key === 'logicOperator') return count
      if (Array.isArray(value)) return count + value.length
      if (value !== undefined && value !== null && value !== '') return count + 1
      return count
    }, 0)
  }, [filters])

  // 检查是否有活跃的筛选条件
  const hasActiveFilters = useMemo(() => {
    return activeFiltersCount > 0
  }, [activeFiltersCount])

  // 初始化筛选状态
  useEffect(() => {
    if (isInitialized) return

    // 优先级：URL参数 > localStorage > 默认值
    const urlFilters = loadFiltersFromUrl()
    const storageFilters = loadFiltersFromStorage()

    let initialFilters = defaultFilters

    if (storageFilters && !urlFilters) {
      // 如果没有URL参数但有localStorage数据，使用localStorage数据
      initialFilters = { ...defaultFilters, ...storageFilters }
    } else if (urlFilters) {
      // 如果有URL参数，使用URL参数（可能部分覆盖）
      initialFilters = { ...defaultFilters, ...storageFilters, ...urlFilters }
    } else if (storageFilters) {
      // 只有localStorage数据
      initialFilters = { ...defaultFilters, ...storageFilters }
    }

    setFilters(initialFilters)
    loadPreferences()
    setIsInitialized(true)
  }, [isInitialized, loadFiltersFromUrl, loadFiltersFromStorage, loadPreferences, defaultFilters])

  // 批量更新防抖处理
  const flushBatchUpdates = useCallback(() => {
    if (Object.keys(batchUpdateRef.current).length === 0) return

    const finalFilters = { ...filters, ...batchUpdateRef.current }
    setFilters(finalFilters)

    // 同步到URL
    if (enableUrlSync) {
      syncFiltersToUrl(finalFilters)
    }

    // 保存到localStorage（如果启用了saveFiltersOnExit）
    if (enableLocalStorage && filterPreferences.saveFiltersOnExit) {
      saveFiltersToStorage(finalFilters)
    }

    // 触发回调
    onFiltersChange?.(finalFilters)

    // 清空批量更新缓存
    batchUpdateRef.current = {}
    setPendingUpdates(null)
  }, [filters, enableUrlSync, enableLocalStorage, filterPreferences.saveFiltersOnExit, syncFiltersToUrl, saveFiltersToStorage, onFiltersChange])

  // 防抖URL同步效果
  useEffect(() => {
    if (enableUrlSync && isInitialized) {
      syncFiltersToUrl(debouncedFilters)
    }
  }, [debouncedFilters, enableUrlSync, isInitialized, syncFiltersToUrl])

  // 更新筛选条件
  const updateFilters = useCallback((newFilters: AdvancedFilters | ((prev: AdvancedFilters) => AdvancedFilters)) => {
    const updatedFilters = typeof newFilters === 'function' ? newFilters(filters) : newFilters

    if (enableBatchUpdates) {
      // 批量更新模式
      batchUpdateRef.current = { ...batchUpdateRef.current, ...updatedFilters }
      setPendingUpdates({ ...filters, ...batchUpdateRef.current })

      // 取消之前的定时器
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }

      // 设置新的定时器
      updateTimeoutRef.current = setTimeout(flushBatchUpdates, debounceDelay)
    } else {
      // 立即更新模式
      setFilters(updatedFilters)

      // 保存到localStorage（如果启用了saveFiltersOnExit）
      if (enableLocalStorage && filterPreferences.saveFiltersOnExit) {
        saveFiltersToStorage(updatedFilters)
      }

      // 触发回调
      onFiltersChange?.(updatedFilters)
    }
  }, [filters, enableBatchUpdates, debounceDelay, flushBatchUpdates, enableLocalStorage, filterPreferences.saveFiltersOnExit, saveFiltersToStorage, onFiltersChange])

  // 清除所有筛选条件
  const clearAllFilters = useCallback(() => {
    const emptyFilters: AdvancedFilters = {
      logicOperator: filterPreferences.defaultLogicOperator
    }
    updateFilters(emptyFilters)
  }, [filterPreferences.defaultLogicOperator, updateFilters])

  // 清除单个筛选条件
  const clearFilter = useCallback((filterKey: keyof AdvancedFilters) => {
    updateFilters(prev => {
      const newFilters = { ...prev }

      // 特殊处理需要同时清除的字段组合
      switch (filterKey) {
        case 'qualityScoreMin':
          delete newFilters.qualityScoreMin
          delete newFilters.qualityScoreMax
          break
        case 'qualityScoreMax':
          delete newFilters.qualityScoreMin
          delete newFilters.qualityScoreMax
          break
        case 'updatedAfter':
          delete newFilters.updatedAfter
          delete newFilters.updatedBefore
          break
        case 'updatedBefore':
          delete newFilters.updatedAfter
          delete newFilters.updatedBefore
          break
        case 'createdAfter':
          delete newFilters.createdAfter
          delete newFilters.createdBefore
          break
        case 'createdBefore':
          delete newFilters.createdAfter
          delete newFilters.createdBefore
          break
        default:
          if (Array.isArray(newFilters[filterKey])) {
            newFilters[filterKey] = []
          } else {
            delete newFilters[filterKey]
          }
      }

      return newFilters
    })
  }, [updateFilters])

  // 保存当前筛选条件为收藏
  const saveFavoriteFilter = useCallback((name: string) => {
    const newFavorite = {
      name,
      filters: { ...filters },
      createdAt: new Date().toISOString()
    }

    const updatedPreferences = {
      ...filterPreferences,
      favoriteFilters: [...filterPreferences.favoriteFilters, newFavorite]
    }

    savePreferences(updatedPreferences)
  }, [filters, filterPreferences, savePreferences])

  // 应用收藏的筛选条件
  const applyFavoriteFilter = useCallback((favoriteIndex: number) => {
    const favorite = filterPreferences.favoriteFilters[favoriteIndex]
    if (favorite) {
      updateFilters(favorite.filters)
    }
  }, [filterPreferences.favoriteFilters, updateFilters])

  // 删除收藏的筛选条件
  const deleteFavoriteFilter = useCallback((favoriteIndex: number) => {
    const updatedPreferences = {
      ...filterPreferences,
      favoriteFilters: filterPreferences.favoriteFilters.filter((_, index) => index !== favoriteIndex)
    }

    savePreferences(updatedPreferences)
  }, [filterPreferences, savePreferences])

  // 更新用户偏好设置
  const updatePreferences = useCallback((newPreferences: Partial<FilterPreferences>) => {
    const updatedPreferences = { ...filterPreferences, ...newPreferences }
    savePreferences(updatedPreferences)
  }, [filterPreferences, savePreferences])

  // 导出筛选条件为JSON
  const exportFilters = useCallback(() => {
    const exportData = {
      filters,
      preferences: filterPreferences,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `search-filters-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [filters, filterPreferences])

  // 导入筛选条件
  const importFilters = useCallback((fileContent: string) => {
    try {
      const importData = JSON.parse(fileContent)

      if (importData.filters && typeof importData.filters === 'object') {
        updateFilters(importData.filters)
      }

      if (importData.preferences && typeof importData.preferences === 'object') {
        updatePreferences(importData.preferences)
      }

      return { success: true }
    } catch (error) {
      console.error('Failed to import filters:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }, [updateFilters, updatePreferences])

  // 组件卸载时保存状态
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (enableLocalStorage && filterPreferences.saveFiltersOnExit) {
        saveFiltersToStorage(filters)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [enableLocalStorage, filterPreferences.saveFiltersOnExit, saveFiltersToStorage, filters])

  // 清理批量更新定时器
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [])

  // 立即提交批量更新
  const flushPendingUpdates = useCallback(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
      flushBatchUpdates()
    }
  }, [flushBatchUpdates])

  return {
    // 筛选状态
    filters: pendingUpdates || filters, // 显示待处理的更新
    updateFilters,
    clearAllFilters,
    clearFilter,

    // 筛选统计
    activeFiltersCount,
    hasActiveFilters,

    // 用户偏好
    filterPreferences,
    updatePreferences,

    // 收藏筛选
    saveFavoriteFilter,
    applyFavoriteFilter,
    deleteFavoriteFilter,

    // 导入导出
    exportFilters,
    importFilters,

    // 状态管理
    isInitialized,
    hasPendingUpdates: pendingUpdates !== null,
    flushPendingUpdates,

    // 工具方法
    syncFiltersToUrl,
    loadFiltersFromStorage,
    saveFiltersToStorage
  }
}