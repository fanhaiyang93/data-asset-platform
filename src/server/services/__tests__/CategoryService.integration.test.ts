import { CategoryService } from '../CategoryService'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache'

// 模拟Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    category: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn()
    },
    asset: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    }
  }
}))

// 模拟缓存
jest.mock('@/lib/cache', () => ({
  getCachedOrCompute: jest.fn(),
  cache: {
    set: jest.fn(),
    get: jest.fn(),
    delete: jest.fn()
  },
  CACHE_KEYS: {
    CATEGORY_TREE: 'category_tree',
    CATEGORY_TREE_WITH_STATS: 'category_tree_with_stats',
    CATEGORY_DETAIL_STATS: (id: string) => `category_detail_stats_${id}`
  },
  invalidateCache: jest.fn()
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('CategoryService Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getTreeWithStats', () => {
    it('should build tree with correct asset counts', async () => {
      // 模拟数据
      const mockCategories = [
        {
          id: '1',
          name: '人力资源',
          code: 'HR',
          depth: 0,
          parentId: null,
          isActive: true,
          sortOrder: 0,
          _count: { assets: 5, children: 2 }
        },
        {
          id: '2',
          name: '员工信息',
          code: 'HR_EMPLOYEE',
          depth: 1,
          parentId: '1',
          isActive: true,
          sortOrder: 0,
          _count: { assets: 8, children: 0 }
        }
      ]

      // 配置 getCachedOrCompute 模拟
      const mockGetCachedOrCompute = cache as any
      mockGetCachedOrCompute.getCachedOrCompute = jest.fn()
        .mockImplementation(async (key: string, computeFn: Function) => {
          return await computeFn()
        })

      // 模拟 Prisma 查询
      mockPrisma.category.findMany
        .mockResolvedValueOnce([mockCategories[0]]) // 根级查询
        .mockResolvedValueOnce([mockCategories[1]]) // 子级查询
        .mockResolvedValueOnce([]) // 孙级查询

      const result = await CategoryService.getTreeWithStats()

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('人力资源')
      expect(result[0].assetCount).toBe(13) // 5 + 8 (包含子分类)
      expect(result[0].children).toHaveLength(1)
      expect(result[0].children[0].name).toBe('员工信息')
      expect(result[0].children[0].assetCount).toBe(8)
    })

    it('should handle empty tree', async () => {
      const mockGetCachedOrCompute = cache as any
      mockGetCachedOrCompute.getCachedOrCompute = jest.fn()
        .mockImplementation(async (key: string, computeFn: Function) => {
          return await computeFn()
        })

      mockPrisma.category.findMany.mockResolvedValue([])

      const result = await CategoryService.getTreeWithStats()

      expect(result).toEqual([])
    })
  })

  describe('getCategoryDetailStats', () => {
    it('should calculate detailed statistics correctly', async () => {
      const categoryId = '1'
      const mockCategory = {
        id: categoryId,
        name: '人力资源',
        _count: { assets: 5, children: 2 }
      }

      const mockChildren = [
        { id: '2', children: [], _count: { assets: 3 } },
        { id: '3', children: [], _count: { assets: 4 } }
      ]

      const mockLastAsset = {
        updatedAt: new Date('2023-12-01')
      }

      const mockGetCachedOrCompute = cache as any
      mockGetCachedOrCompute.getCachedOrCompute = jest.fn()
        .mockImplementation(async (key: string, computeFn: Function) => {
          return await computeFn()
        })

      // 配置模拟返回值
      mockPrisma.category.findUnique
        .mockResolvedValueOnce(mockCategory) // 主查询
        .mockResolvedValueOnce({ // 递归查询根节点
          id: categoryId,
          children: mockChildren,
          _count: { assets: 5 }
        })
        .mockResolvedValueOnce(mockChildren[0]) // 递归查询子节点1
        .mockResolvedValueOnce(mockChildren[1]) // 递归查询子节点2

      mockPrisma.asset.findFirst.mockResolvedValue(mockLastAsset)

      const result = await CategoryService.getCategoryDetailStats(categoryId)

      expect(result).toEqual({
        assetCount: 5,
        subCategoryCount: 2,
        totalAssetsIncludingChildren: 12, // 5 + 3 + 4
        lastUpdated: mockLastAsset.updatedAt
      })
    })

    it('should throw error for non-existent category', async () => {
      const mockGetCachedOrCompute = cache as any
      mockGetCachedOrCompute.getCachedOrCompute = jest.fn()
        .mockImplementation(async (key: string, computeFn: Function) => {
          return await computeFn()
        })

      mockPrisma.category.findUnique.mockResolvedValue(null)

      await expect(CategoryService.getCategoryDetailStats('non-existent'))
        .rejects.toThrow('分类不存在')
    })
  })

  describe('getPopularCategories', () => {
    it('should return categories ordered by asset count', async () => {
      const mockCategories = [
        {
          id: '1',
          name: '人力资源',
          _count: { assets: 15, children: 2 },
          parent: null
        },
        {
          id: '2',
          name: '财务',
          _count: { assets: 12, children: 1 },
          parent: null
        },
        {
          id: '3',
          name: '法务',
          _count: { assets: 3, children: 0 },
          parent: null
        }
      ]

      mockPrisma.category.findMany.mockResolvedValue(mockCategories)

      const result = await CategoryService.getPopularCategories(10)

      expect(result).toEqual(mockCategories)
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: {
          _count: {
            select: {
              assets: true,
              children: true
            }
          },
          parent: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        },
        orderBy: {
          assets: {
            _count: 'desc'
          }
        },
        take: 10
      })
    })

    it('should respect limit parameter', async () => {
      mockPrisma.category.findMany.mockResolvedValue([])

      await CategoryService.getPopularCategories(5)

      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5
        })
      )
    })
  })

  describe('caching behavior', () => {
    it('should use cache for repeated calls', async () => {
      const mockGetCachedOrCompute = jest.fn()
        .mockResolvedValue([])

      ;(cache as any).getCachedOrCompute = mockGetCachedOrCompute

      await CategoryService.getTree()
      await CategoryService.getTree()

      expect(mockGetCachedOrCompute).toHaveBeenCalledTimes(2)
      expect(mockGetCachedOrCompute).toHaveBeenCalledWith(
        'category_tree',
        expect.any(Function),
        15 * 60 * 1000
      )
    })

    it('should use different cache keys for different root IDs', async () => {
      const mockGetCachedOrCompute = jest.fn()
        .mockResolvedValue([])

      ;(cache as any).getCachedOrCompute = mockGetCachedOrCompute

      await CategoryService.getTree('root1')
      await CategoryService.getTree('root2')

      expect(mockGetCachedOrCompute).toHaveBeenCalledWith(
        'category_tree_root1',
        expect.any(Function),
        15 * 60 * 1000
      )
      expect(mockGetCachedOrCompute).toHaveBeenCalledWith(
        'category_tree_root2',
        expect.any(Function),
        15 * 60 * 1000
      )
    })
  })

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockGetCachedOrCompute = cache as any
      mockGetCachedOrCompute.getCachedOrCompute = jest.fn()
        .mockImplementation(async (key: string, computeFn: Function) => {
          return await computeFn()
        })

      mockPrisma.category.findMany.mockRejectedValue(new Error('Database error'))

      await expect(CategoryService.getTreeWithStats())
        .rejects.toThrow('构建带统计信息的分类树失败')
    })

    it('should handle invalid parameters', async () => {
      const mockGetCachedOrCompute = cache as any
      mockGetCachedOrCompute.getCachedOrCompute = jest.fn()
        .mockImplementation(async (key: string, computeFn: Function) => {
          return await computeFn()
        })

      mockPrisma.category.findUnique.mockResolvedValue(null)

      await expect(CategoryService.getCategoryDetailStats(''))
        .rejects.toThrow('分类不存在')
    })
  })
})