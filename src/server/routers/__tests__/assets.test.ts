import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { createTRPCMsw } from 'msw-trpc'
import { rest } from 'msw'
import { setupServer } from 'msw/node'
import { appRouter } from '../index'
import { createTRPCContext } from '@/lib/trpc'
import { prisma } from '@/lib/prisma'
import { Category } from '@prisma/client'

// Mock user for testing
const mockUser = {
  id: 'test-user-id',
  username: 'testuser',
  email: 'test@example.com',
  role: 'ASSET_MANAGER',
  name: 'Test User',
  department: 'IT'
}

// Mock tRPC context
const createMockContext = (user = mockUser) => ({
  req: {},
  res: {},
  prisma,
  user,
  getUserId: () => user?.id || null,
  getUserRole: () => user?.role || null,
})

describe('Assets Router Integration Tests', () => {
  let testCategory
  let caller

  beforeAll(async () => {
    // 创建测试用分类
    testCategory = await prisma.category.create({
      data: {
        name: '测试分类',
        code: 'test-integration-category',
        description: '用于集成测试的分类',
        depth: 0,
        path: '/test-integration-category'
      }
    })

    // 创建tRPC caller
    caller = appRouter.createCaller(createMockContext())
  })

  afterAll(async () => {
    // 清理测试数据
    await prisma.asset.deleteMany({
      where: { categoryId: testCategory.id }
    })
    await prisma.category.delete({
      where: { id: testCategory.id }
    })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // 每个测试前清理资产数据
    await prisma.asset.deleteMany({
      where: { categoryId: testCategory.id }
    })
  })

  describe('Asset Operations', () => {
    describe('createAsset', () => {
      it('应该成功创建资产', async () => {
        const assetData = {
          name: '集成测试资产',
          code: 'integration-test-asset',
          description: '这是一个集成测试资产',
          categoryId: testCategory.id,
          type: 'table',
          format: 'json'
        }

        const result = await caller.assets.createAsset(assetData)

        expect(result).toBeDefined()
        expect(result.name).toBe(assetData.name)
        expect(result.code).toBe(assetData.code)
        expect(result.categoryId).toBe(assetData.categoryId)
        expect(result.createdBy).toBe(mockUser.id)
      })

      it('应该在输入验证失败时返回错误', async () => {
        const invalidAssetData = {
          name: '', // 空名称应该失败
          code: 'test',
          categoryId: testCategory.id
        }

        await expect(caller.assets.createAsset(invalidAssetData))
          .rejects.toThrow()
      })
    })

    describe('getAsset', () => {
      it('应该成功获取资产详情', async () => {
        // 先创建一个资产
        const asset = await caller.assets.createAsset({
          name: '获取测试资产',
          code: 'get-test-asset',
          categoryId: testCategory.id
        })

        const result = await caller.assets.getAsset({ id: asset.id })

        expect(result).toBeDefined()
        expect(result!.id).toBe(asset.id)
        expect(result!.category).toBeDefined()
        expect(result!.creator).toBeDefined()
      })

      it('应该在资产不存在时返回null', async () => {
        const result = await caller.assets.getAsset({ id: 'non-existent-id' })
        expect(result).toBeNull()
      })
    })

    describe('getAssets', () => {
      beforeEach(async () => {
        // 创建多个测试资产
        await Promise.all([
          caller.assets.createAsset({
            name: 'API资产1',
            code: 'api-asset-1-integration',
            categoryId: testCategory.id,
            type: 'api',
            status: 'AVAILABLE'
          }),
          caller.assets.createAsset({
            name: '表资产1',
            code: 'table-asset-1-integration',
            categoryId: testCategory.id,
            type: 'table',
            status: 'DRAFT'
          }),
          caller.assets.createAsset({
            name: '表资产2',
            code: 'table-asset-2-integration',
            categoryId: testCategory.id,
            type: 'table',
            status: 'AVAILABLE'
          })
        ])
      })

      it('应该返回资产列表', async () => {
        const result = await caller.assets.getAssets({})

        expect(result.assets).toBeDefined()
        expect(result.total).toBeDefined()
        expect(result.assets.length).toBeGreaterThanOrEqual(3)
      })

      it('应该支持分类过滤', async () => {
        const result = await caller.assets.getAssets({
          categoryId: testCategory.id
        })

        expect(result.assets.length).toBe(3)
        result.assets.forEach(asset => {
          expect(asset.categoryId).toBe(testCategory.id)
        })
      })

      it('应该支持状态过滤', async () => {
        const result = await caller.assets.getAssets({
          status: 'AVAILABLE'
        })

        result.assets.forEach(asset => {
          expect(asset.status).toBe('AVAILABLE')
        })
      })

      it('应该支持分页', async () => {
        const result = await caller.assets.getAssets({
          skip: 0,
          take: 2
        })

        expect(result.assets.length).toBeLessThanOrEqual(2)
      })
    })

    describe('updateAsset', () => {
      it('应该成功更新资产', async () => {
        const asset = await caller.assets.createAsset({
          name: '更新测试资产',
          code: 'update-test-asset-integration',
          categoryId: testCategory.id
        })

        const updateData = {
          name: '更新后的资产名称',
          description: '更新后的描述'
        }

        const result = await caller.assets.updateAsset({
          id: asset.id,
          data: updateData
        })

        expect(result.name).toBe(updateData.name)
        expect(result.description).toBe(updateData.description)
        expect(result.updatedBy).toBe(mockUser.id)
      })
    })

    describe('deleteAsset', () => {
      it('应该软删除资产', async () => {
        const asset = await caller.assets.createAsset({
          name: '删除测试资产',
          code: 'delete-test-asset-integration',
          categoryId: testCategory.id
        })

        await caller.assets.deleteAsset({ id: asset.id })

        // 验证资产状态变为DEPRECATED
        const deletedAsset = await prisma.asset.findUnique({
          where: { id: asset.id }
        })

        expect(deletedAsset!.status).toBe('DEPRECATED')
      })
    })

    describe('getAssetStats', () => {
      beforeEach(async () => {
        await caller.assets.createAsset({
          name: '统计测试资产',
          code: 'stats-test-asset-integration',
          categoryId: testCategory.id,
          status: 'AVAILABLE',
          type: 'table'
        })
      })

      it('应该返回资产统计信息', async () => {
        const result = await caller.assets.getAssetStats({})

        expect(result.total).toBeGreaterThanOrEqual(1)
        expect(result.byStatus).toBeDefined()
        expect(result.byType).toBeDefined()
      })

      it('应该支持按分类过滤统计', async () => {
        const result = await caller.assets.getAssetStats({
          categoryId: testCategory.id
        })

        expect(result.total).toBe(1)
        expect(result.byStatus.AVAILABLE).toBe(1)
      })
    })
  })

  describe('Category Operations', () => {
    beforeEach(async () => {
      // 清理测试分类（除了主测试分类）
      await prisma.category.deleteMany({
        where: {
          AND: [
            { code: { startsWith: 'test-integration-' } },
            { id: { not: testCategory.id } }
          ]
        }
      })
    })

    describe('createCategory', () => {
      it('应该成功创建分类', async () => {
        const categoryData = {
          name: '集成测试分类',
          code: 'test-integration-new-category',
          description: '新的集成测试分类'
        }

        const result = await caller.assets.createCategory(categoryData)

        expect(result).toBeDefined()
        expect(result.name).toBe(categoryData.name)
        expect(result.code).toBe(categoryData.code)
        expect(result.depth).toBe(0)
        expect(result.createdBy).toBe(mockUser.id)
      })

      it('应该在输入验证失败时返回错误', async () => {
        const invalidCategoryData = {
          name: '', // 空名称应该失败
          code: 'test'
        }

        await expect(caller.assets.createCategory(invalidCategoryData))
          .rejects.toThrow()
      })
    })

    describe('getCategory', () => {
      it('应该成功获取分类详情', async () => {
        const result = await caller.assets.getCategory({ id: testCategory.id })

        expect(result).toBeDefined()
        expect(result!.id).toBe(testCategory.id)
        expect(result!._count).toBeDefined()
      })
    })

    describe('getCategoryTree', () => {
      beforeEach(async () => {
        // 创建子分类
        await caller.assets.createCategory({
          name: '子分类',
          code: 'test-integration-sub-category',
          parentId: testCategory.id
        })
      })

      it('应该返回完整的分类树', async () => {
        const result = await caller.assets.getCategoryTree({})

        expect(result).toBeDefined()
        expect(Array.isArray(result)).toBe(true)

        // 查找我们的测试分类
        const testCategoryNode = result.find((node: any) => node.id === testCategory.id)
        expect(testCategoryNode).toBeDefined()
        expect(testCategoryNode.children.length).toBe(1)
      })

      it('应该从指定根节点返回子树', async () => {
        const result = await caller.assets.getCategoryTree({
          rootId: testCategory.id
        })

        expect(result.length).toBe(1)
        expect(result[0].id).toBe(testCategory.id)
      })
    })

    describe('getCategories', () => {
      it('应该返回分类列表', async () => {
        const result = await caller.assets.getCategories({})

        expect(result.categories).toBeDefined()
        expect(result.total).toBeDefined()
        expect(result.categories.length).toBeGreaterThanOrEqual(1)
      })

      it('应该支持深度过滤', async () => {
        const result = await caller.assets.getCategories({ depth: 0 })

        result.categories.forEach(category => {
          expect(category.depth).toBe(0)
        })
      })
    })

    describe('updateCategory', () => {
      it('应该成功更新分类', async () => {
        const updateData = {
          name: '更新后的分类名称',
          description: '更新后的描述'
        }

        const result = await caller.assets.updateCategory({
          id: testCategory.id,
          data: updateData
        })

        expect(result.name).toBe(updateData.name)
        expect(result.description).toBe(updateData.description)
        expect(result.updatedBy).toBe(mockUser.id)
      })
    })

    describe('getCategoryStats', () => {
      it('应该返回分类统计信息', async () => {
        const result = await caller.assets.getCategoryStats()

        expect(result.total).toBeGreaterThanOrEqual(1)
        expect(result.byDepth).toBeDefined()
        expect(result.activeCount).toBeGreaterThanOrEqual(1)
        expect(result.inactiveCount).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('Complex Operations', () => {
    describe('getCategoryAssetCount', () => {
      beforeEach(async () => {
        await caller.assets.createAsset({
          name: '计数测试资产',
          code: 'count-test-asset',
          categoryId: testCategory.id
        })
      })

      it('应该返回分类下的资产数量', async () => {
        const result = await caller.assets.getCategoryAssetCount({
          categoryId: testCategory.id
        })

        expect(result.count).toBe(1)
      })
    })

    describe('getTopLevelCategoriesWithCounts', () => {
      it('应该返回顶级分类及其资产数量', async () => {
        const result = await caller.assets.getTopLevelCategoriesWithCounts()

        expect(Array.isArray(result)).toBe(true)
        result.forEach((category: any) => {
          expect(category.depth).toBe(0)
          expect(typeof category.assetCount).toBe('number')
        })
      })
    })

    describe('search', () => {
      beforeEach(async () => {
        await Promise.all([
          caller.assets.createAsset({
            name: '搜索测试API资产',
            code: 'search-api-asset',
            categoryId: testCategory.id,
            type: 'api'
          }),
          caller.assets.createCategory({
            name: '搜索测试分类',
            code: 'test-integration-search-category'
          })
        ])
      })

      it('应该搜索所有类型', async () => {
        const result = await caller.assets.search({
          query: '搜索测试',
          type: 'all'
        })

        expect(result.total).toBeGreaterThanOrEqual(2)
        expect(result.assets).toBeDefined()
        expect(result.categories).toBeDefined()
      })

      it('应该只搜索资产', async () => {
        const result = await caller.assets.search({
          query: 'API',
          type: 'assets'
        })

        expect(result.assets).toBeDefined()
        expect(result.categories).toBeUndefined()
        expect(result.assets!.length).toBeGreaterThanOrEqual(1)
      })

      it('应该只搜索分类', async () => {
        const result = await caller.assets.search({
          query: '搜索测试',
          type: 'categories'
        })

        expect(result.categories).toBeDefined()
        expect(result.assets).toBeUndefined()
        expect(result.categories!.length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('权限测试', () => {
    it('应该在未认证时拒绝管理员操作', async () => {
      const unauthenticatedCaller = appRouter.createCaller(createMockContext(null))

      await expect(unauthenticatedCaller.assets.createAsset({
        name: '测试资产',
        code: 'test-asset',
        categoryId: testCategory.id
      })).rejects.toThrow('您需要登录才能访问此资源')
    })

    it('应该在用户权限不足时拒绝管理员操作', async () => {
      const businessUserCaller = appRouter.createCaller(createMockContext({
        ...mockUser,
        role: 'BUSINESS_USER'
      }))

      await expect(businessUserCaller.assets.createAsset({
        name: '测试资产',
        code: 'test-asset',
        categoryId: testCategory.id
      })).rejects.toThrow('权限不足')
    })

    it('应该允许公开操作', async () => {
      const unauthenticatedCaller = appRouter.createCaller(createMockContext(null))

      const result = await unauthenticatedCaller.assets.getAssets({})
      expect(result).toBeDefined()
    })
  })

  describe('性能测试', () => {
    it('API响应时间应小于150ms', async () => {
      // 创建一些测试数据
      const assets = []
      for (let i = 0; i < 10; i++) {
        assets.push(await caller.assets.createAsset({
          name: `性能测试资产${i}`,
          code: `perf-test-asset-${i}`,
          categoryId: testCategory.id
        }))
      }

      const startTime = Date.now()
      await caller.assets.getAssets({ take: 10 })
      const endTime = Date.now()

      const responseTime = endTime - startTime
      expect(responseTime).toBeLessThan(150)

      // 清理测试数据
      await Promise.all(
        assets.map(asset =>
          prisma.asset.delete({ where: { id: asset.id } })
        )
      )
    })
  })
})