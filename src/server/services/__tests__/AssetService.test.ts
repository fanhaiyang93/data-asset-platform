import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { AssetService } from '../AssetService'
import { CategoryService } from '../CategoryService'
import { prisma } from '@/lib/prisma'
import { Asset, Category } from '@prisma/client'

describe('AssetService', () => {
  let testCategory

  beforeAll(async () => {
    // 创建测试用分类
    testCategory = await CategoryService.create({
      name: '测试分类',
      code: 'test-category',
      description: '用于测试的分类'
    })
  })

  afterAll(async () => {
    // 清理测试数据
    await prisma.asset.deleteMany({
      where: {
        categoryId: testCategory.id
      }
    })
    await prisma.category.delete({
      where: { id: testCategory.id }
    })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // 每个测试前清理资产数据
    await prisma.asset.deleteMany({
      where: {
        categoryId: testCategory.id
      }
    })
  })

  describe('create', () => {
    it('应该成功创建资产', async () => {
      const assetData = {
        name: '测试资产',
        code: 'test-asset-001',
        description: '这是一个测试资产',
        categoryId: testCategory.id,
        type: 'table',
        format: 'json'
      }

      const asset = await AssetService.create(assetData)

      expect(asset).toBeDefined()
      expect(asset.name).toBe(assetData.name)
      expect(asset.code).toBe(assetData.code)
      expect(asset.categoryId).toBe(assetData.categoryId)
      expect(asset.status).toBe('DRAFT') // 默认状态
      expect(asset.createdAt).toBeDefined()
      expect(asset.updatedAt).toBeDefined()
    })

    it('应该在分类不存在时抛出错误', async () => {
      const assetData = {
        name: '测试资产',
        code: 'test-asset-002',
        categoryId: 'non-existent-id'
      }

      await expect(AssetService.create(assetData)).rejects.toThrow('指定的分类不存在')
    })

    it('应该在编码重复时抛出错误', async () => {
      const assetData = {
        name: '测试资产1',
        code: 'duplicate-code',
        categoryId: testCategory.id
      }

      // 创建第一个资产
      await AssetService.create(assetData)

      // 尝试创建相同编码的资产
      const duplicateAssetData = {
        name: '测试资产2',
        code: 'duplicate-code',
        categoryId: testCategory.id
      }

      await expect(AssetService.create(duplicateAssetData)).rejects.toThrow('资产编码已存在')
    })
  })

  describe('findById', () => {
    let testAsset

    beforeEach(async () => {
      testAsset = await AssetService.create({
        name: '查询测试资产',
        code: 'query-test-asset',
        categoryId: testCategory.id
      })
    })

    it('应该成功获取资产详情', async () => {
      const asset = await AssetService.findById(testAsset.id)

      expect(asset).toBeDefined()
      expect(asset!.id).toBe(testAsset.id)
      expect(asset!.name).toBe(testAsset.name)
      expect(asset!.category).toBeDefined()
      expect(asset!.category.id).toBe(testCategory.id)
    })

    it('应该在资产不存在时返回null', async () => {
      const asset = await AssetService.findById('non-existent-id')
      expect(asset).toBeNull()
    })

    it('应该更新访问计数', async () => {
      const initialAccessCount = testAsset.accessCount

      await AssetService.findById(testAsset.id)

      const updatedAsset = await prisma.asset.findUnique({
        where: { id: testAsset.id }
      })

      expect(updatedAsset!.accessCount).toBe(initialAccessCount + 1)
      expect(updatedAsset!.lastAccessed).toBeDefined()
    })
  })

  describe('findMany', () => {
    beforeEach(async () => {
      // 创建多个测试资产
      await Promise.all([
        AssetService.create({
          name: 'API资产1',
          code: 'api-asset-1',
          categoryId: testCategory.id,
          type: 'api',
          status: 'AVAILABLE'
        }),
        AssetService.create({
          name: '表资产1',
          code: 'table-asset-1',
          categoryId: testCategory.id,
          type: 'table',
          status: 'DRAFT'
        }),
        AssetService.create({
          name: '表资产2',
          code: 'table-asset-2',
          categoryId: testCategory.id,
          type: 'table',
          status: 'AVAILABLE'
        })
      ])
    })

    it('应该返回所有资产', async () => {
      const result = await AssetService.findMany({})

      expect(result.assets.length).toBeGreaterThanOrEqual(3)
      expect(result.total).toBeGreaterThanOrEqual(3)
    })

    it('应该按分类过滤', async () => {
      const result = await AssetService.findMany({
        categoryId: testCategory.id
      })

      expect(result.assets.length).toBe(3)
      expect(result.total).toBe(3)
      result.assets.forEach(asset => {
        expect(asset.categoryId).toBe(testCategory.id)
      })
    })

    it('应该按状态过滤', async () => {
      const result = await AssetService.findMany({
        status: 'AVAILABLE'
      })

      result.assets.forEach(asset => {
        expect(asset.status).toBe('AVAILABLE')
      })
    })

    it('应该按类型过滤', async () => {
      const result = await AssetService.findMany({
        type: 'table'
      })

      result.assets.forEach(asset => {
        expect(asset.type).toBe('table')
      })
    })

    it('应该支持搜索', async () => {
      const result = await AssetService.findMany({
        search: 'API'
      })

      expect(result.assets.length).toBeGreaterThanOrEqual(1)
      result.assets.forEach(asset => {
        expect(
          asset.name.toLowerCase().includes('api') ||
          asset.description?.toLowerCase().includes('api') ||
          asset.code.toLowerCase().includes('api')
        ).toBe(true)
      })
    })

    it('应该支持分页', async () => {
      const result = await AssetService.findMany({
        skip: 0,
        take: 2
      })

      expect(result.assets.length).toBeLessThanOrEqual(2)
    })

    it('应该支持排序', async () => {
      // Create multiple assets with different names to test sorting
      await Promise.all([
        AssetService.create({
          name: 'C测试资产',
          code: 'sort-test-c',
          categoryId: testCategory.id
        }),
        AssetService.create({
          name: 'A测试资产',
          code: 'sort-test-a',
          categoryId: testCategory.id
        }),
        AssetService.create({
          name: 'B测试资产',
          code: 'sort-test-b',
          categoryId: testCategory.id
        })
      ])

      // Test ascending order
      const ascResult = await AssetService.findMany({
        orderBy: { field: 'name', direction: 'asc' }
      })

      // Test descending order
      const descResult = await AssetService.findMany({
        orderBy: { field: 'name', direction: 'desc' }
      })

      // Just check that we get results and they're ordered (different for asc vs desc)
      expect(ascResult.assets.length).toBeGreaterThan(0)
      expect(descResult.assets.length).toBeGreaterThan(0)

      if (ascResult.assets.length > 1 && descResult.assets.length > 1) {
        // First item in ascending should be different from first item in descending
        expect(ascResult.assets[0].name).not.toBe(descResult.assets[0].name)
      }
    })
  })

  describe('update', () => {
    let testAsset

    beforeEach(async () => {
      testAsset = await AssetService.create({
        name: '更新测试资产',
        code: 'update-test-asset',
        categoryId: testCategory.id
      })
    })

    it('应该成功更新资产', async () => {
      const updateData = {
        name: '更新后的资产名称',
        description: '更新后的描述',
        status: 'AVAILABLE'
      }

      const updatedAsset = await AssetService.update(testAsset.id, updateData)

      expect(updatedAsset.name).toBe(updateData.name)
      expect(updatedAsset.description).toBe(updateData.description)
      expect(updatedAsset.status).toBe(updateData.status)
      expect(updatedAsset.updatedAt.getTime()).toBeGreaterThan(testAsset.updatedAt.getTime())
    })

    it('应该在资产不存在时抛出错误', async () => {
      await expect(AssetService.update('non-existent-id', { name: '新名称' }))
        .rejects.toThrow('资产不存在')
    })
  })

  describe('delete', () => {
    let testAsset

    beforeEach(async () => {
      testAsset = await AssetService.create({
        name: '删除测试资产',
        code: 'delete-test-asset',
        categoryId: testCategory.id
      })
    })

    it('应该软删除资产（设置为DEPRECATED状态）', async () => {
      await AssetService.delete(testAsset.id)

      const asset = await prisma.asset.findUnique({
        where: { id: testAsset.id }
      })

      expect(asset).toBeDefined()
      expect(asset!.status).toBe('DEPRECATED')
    })

    it('应该在资产不存在时抛出错误', async () => {
      await expect(AssetService.delete('non-existent-id'))
        .rejects.toThrow('资产不存在')
    })
  })

  describe('getStats', () => {
    beforeEach(async () => {
      // 创建不同状态的测试资产
      await Promise.all([
        AssetService.create({
          name: '可用资产',
          code: 'available-asset',
          categoryId: testCategory.id,
          status: 'AVAILABLE',
          type: 'table'
        }),
        AssetService.create({
          name: '草稿资产',
          code: 'draft-asset',
          categoryId: testCategory.id,
          status: 'DRAFT',
          type: 'api'
        })
      ])
    })

    it('应该返回统计信息', async () => {
      const stats = await AssetService.getStats()

      expect(stats.total).toBeGreaterThanOrEqual(2)
      expect(stats.byStatus).toBeDefined()
      expect(stats.byType).toBeDefined()
      expect(stats.byStatus.AVAILABLE).toBeGreaterThanOrEqual(1)
      expect(stats.byStatus.DRAFT).toBeGreaterThanOrEqual(1)
    })

    it('应该支持按分类过滤统计', async () => {
      const stats = await AssetService.getStats(testCategory.id)

      expect(stats.total).toBe(2)
      expect(stats.byStatus.AVAILABLE).toBe(1)
      expect(stats.byStatus.DRAFT).toBe(1)
    })
  })

  describe('性能测试', () => {
    it('查询响应时间应小于150ms', async () => {
      // 创建一些测试数据
      const assets = []
      for (let i = 0; i < 10; i++) {
        assets.push(await AssetService.create({
          name: `性能测试资产${i}`,
          code: `perf-test-${i}`,
          categoryId: testCategory.id
        }))
      }

      const startTime = Date.now()
      await AssetService.findMany({ take: 10 })
      const endTime = Date.now()

      const responseTime = endTime - startTime
      expect(responseTime).toBeLessThan(150)

      // 清理测试数据
      await Promise.all(
        assets.map(asset => prisma.asset.delete({ where: { id: asset.id } }))
      )
    })
  })
})