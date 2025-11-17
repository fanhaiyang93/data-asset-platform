/**
 * 简单的内存缓存实现
 * 用于缓存分类统计数据和树形结构
 */

interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

class MemoryCache {
  private cache = new Map<string, CacheItem<any>>()

  /**
   * 设置缓存项
   */
  set<T>(key: string, value: T, ttlMs: number = 15 * 60 * 1000): void {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl: ttlMs
    })
  }

  /**
   * 获取缓存项
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key)

    if (!item) {
      return null
    }

    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return null
    }

    return item.data as T
  }

  /**
   * 删除缓存项
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * 清理过期缓存
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size
  }
}

// 单例实例
export const cache = new MemoryCache()

// Redis兼容接口 - 暂时使用内存缓存模拟
export const redis = {
  get: async (key: string) => cache.get(key),
  set: async (key: string, value: any, options?: { ex?: number }) => {
    const ttl = options?.ex ? options.ex * 1000 : 15 * 60 * 1000
    cache.set(key, value, ttl)
    return 'OK'
  },
  del: async (key: string) => {
    cache.delete(key)
    return 1
  },
  exists: async (key: string) => {
    return cache.get(key) !== null ? 1 : 0
  },
  expire: async (key: string, seconds: number) => {
    const value = cache.get(key)
    if (value !== null) {
      cache.set(key, value, seconds * 1000)
      return 1
    }
    return 0
  }
}

// 定期清理过期缓存（每5分钟）
if (typeof window === 'undefined') { // 只在服务端运行
  setInterval(() => {
    cache.cleanup()
  }, 5 * 60 * 1000)
}

// 缓存键名常量
export const CACHE_KEYS = {
  CATEGORY_TREE: 'category_tree',
  CATEGORY_TREE_WITH_STATS: 'category_tree_with_stats',
  CATEGORY_STATS: 'category_stats',
  CATEGORY_DETAIL_STATS: (id: string) => `category_detail_stats_${id}`,
  POPULAR_CATEGORIES: 'popular_categories',
  TOP_LEVEL_CATEGORIES: 'top_level_categories'
} as const

/**
 * 缓存装饰器工厂
 */
export function withCache<T extends any[], R>(
  getCacheKey: (...args: T) => string,
  ttlMs: number = 15 * 60 * 1000
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value

    descriptor.value = async function (...args: T): Promise<R> {
      const cacheKey = getCacheKey(...args)

      // 尝试从缓存获取
      const cached = cache.get<R>(cacheKey)
      if (cached !== null) {
        return cached
      }

      // 缓存未命中，执行原方法
      const result = await method.apply(this, args)

      // 缓存结果
      cache.set(cacheKey, result, ttlMs)

      return result
    }
  }
}

/**
 * 异步缓存辅助函数
 */
export async function getCachedOrCompute<T>(
  key: string,
  computeFn: () => Promise<T>,
  ttlMs: number = 15 * 60 * 1000
): Promise<T> {
  // 尝试从缓存获取
  const cached = cache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // 缓存未命中，计算结果
  const result = await computeFn()

  // 缓存结果
  cache.set(key, result, ttlMs)

  return result
}

/**
 * 使缓存失效的辅助函数
 */
export function invalidateCache(pattern?: string): void {
  if (!pattern) {
    cache.clear()
    return
  }

  // 简单的模式匹配，支持通配符
  const regex = new RegExp(pattern.replace(/\*/g, '.*'))

  for (const key of Array.from(cache['cache'].keys())) {
    if (regex.test(key)) {
      cache.delete(key)
    }
  }
}