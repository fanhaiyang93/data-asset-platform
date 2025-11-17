import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { CategoryService } from '../CategoryService'
import { prisma } from '@/lib/prisma'
import { Category } from '@prisma/client'

describe('CategoryService', () => {
  afterAll(async () => {
    // 清理所有测试数据
    await prisma.category.deleteMany({
      where: {
        code: {
          startsWith: 'test-'
        }
      }
    })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // 每个测试前清理测试数据
    await prisma.category.deleteMany({
      where: {
        code: {
          startsWith: 'test-'
        }
      }
    })
  })

  describe('create', () => {
    it('应该成功创建根分类', async () => {
      const categoryData = {
        name: '测试业务域',
        code: 'test-business-domain',
        description: '这是一个测试业务域'
      }

      const category = await CategoryService.create(categoryData)

      expect(category).toBeDefined()
      expect(category.name).toBe(categoryData.name)
      expect(category.code).toBe(categoryData.code)
      expect(category.depth).toBe(0)
      expect(category.path).toBe('/test-business-domain')
      expect(category.parentId).toBeNull()
      expect(category.isActive).toBe(true)
    })

    it('应该成功创建子分类', async () => {
      // 先创建父分类
      const parentCategory = await CategoryService.create({
        name: '父分类',
        code: 'test-parent-category'
      })

      const childCategoryData = {
        name: '子分类',
        code: 'test-child-category',
        parentId: parentCategory.id
      }

      const childCategory = await CategoryService.create(childCategoryData)

      expect(childCategory.parentId).toBe(parentCategory.id)
      expect(childCategory.depth).toBe(1)
      expect(childCategory.path).toBe('/test-parent-category/test-child-category')
    })

    it('应该在分类编码重复时抛出错误', async () => {
      const categoryData = {
        name: '重复编码分类',
        code: 'test-duplicate-code'
      }

      await CategoryService.create(categoryData)

      await expect(CategoryService.create(categoryData))
        .rejects.toThrow('分类编码已存在')
    })

    it('应该在父分类不存在时抛出错误', async () => {
      const categoryData = {
        name: '测试分类',
        code: 'test-category-no-parent',
        parentId: 'non-existent-id'
      }

      await expect(CategoryService.create(categoryData))
        .rejects.toThrow('父分类不存在')
    })

    it('应该在超过深度限制时抛出错误', async () => {
      // 创建3级分类结构
      const level0 = await CategoryService.create({
        name: '0级',
        code: 'test-level-0'
      })

      const level1 = await CategoryService.create({
        name: '1级',
        code: 'test-level-1',
        parentId: level0.id
      })

      const level2 = await CategoryService.create({
        name: '2级',
        code: 'test-level-2',
        parentId: level1.id
      })

      // 尝试创建第4级（应该失败）
      await expect(CategoryService.create({
        name: '3级',
        code: 'test-level-3',
        parentId: level2.id
      })).rejects.toThrow('分类层级不能超过3级')
    })
  })

  describe('findById', () => {
    let testCategory

    beforeEach(async () => {
      testCategory = await CategoryService.create({
        name: '查询测试分类',
        code: 'test-query-category'
      })
    })

    it('应该成功获取分类详情', async () => {
      const category = await CategoryService.findById(testCategory.id)

      expect(category).toBeDefined()
      expect(category!.id).toBe(testCategory.id)
      expect(category!.name).toBe(testCategory.name)
      expect(category!._count).toBeDefined()
    })

    it('应该在分类不存在时返回null', async () => {
      const category = await CategoryService.findById('non-existent-id')
      expect(category).toBeNull()
    })
  })

  describe('getTree', () => {
    let businessDomain
    let subCategory
    let specificCategory

    beforeEach(async () => {
      // 创建完整的三级分类结构
      businessDomain = await CategoryService.create({
        name: '业务域',
        code: 'test-business-domain-tree'
      })

      subCategory = await CategoryService.create({
        name: '子类别',
        code: 'test-sub-category-tree',
        parentId: businessDomain.id
      })

      specificCategory = await CategoryService.create({
        name: '具体分类',
        code: 'test-specific-category-tree',
        parentId: subCategory.id
      })
    })

    it('应该构建完整的分类树', async () => {
      const tree = await CategoryService.getTree()

      expect(tree).toBeDefined()
      expect(tree.length).toBeGreaterThanOrEqual(1)

      // 查找我们创建的业务域
      const businessDomainNode = tree.find(node => node.id === businessDomain.id)
      expect(businessDomainNode).toBeDefined()
      expect(businessDomainNode!.children.length).toBe(1)

      // 检查子类别
      const subCategoryNode = businessDomainNode!.children[0]
      expect(subCategoryNode.id).toBe(subCategory.id)
      expect(subCategoryNode.children.length).toBe(1)

      // 检查具体分类
      const specificCategoryNode = subCategoryNode.children[0]
      expect(specificCategoryNode.id).toBe(specificCategory.id)
      expect(specificCategoryNode.children.length).toBe(0)
    })

    it('应该从指定根节点构建子树', async () => {
      const subtree = await CategoryService.getTree(businessDomain.id)

      expect(subtree.length).toBe(1)
      expect(subtree[0].id).toBe(businessDomain.id)
      expect(subtree[0].children.length).toBe(1)
    })
  })

  describe('findMany', () => {
    beforeEach(async () => {
      // 创建多个测试分类
      const parent = await CategoryService.create({
        name: '父分类',
        code: 'test-parent-findmany'
      })

      await Promise.all([
        CategoryService.create({
          name: '子分类1',
          code: 'test-child-1-findmany',
          parentId: parent.id,
          sortOrder: 1
        }),
        CategoryService.create({
          name: '子分类2',
          code: 'test-child-2-findmany',
          parentId: parent.id,
          sortOrder: 2
        }),
        CategoryService.create({
          name: '另一个根分类',
          code: 'test-another-root-findmany'
        })
      ])
    })

    it('应该返回所有分类', async () => {
      const result = await CategoryService.findMany()

      expect(result.categories.length).toBeGreaterThanOrEqual(4)
      expect(result.total).toBeGreaterThanOrEqual(4)
    })

    it('应该按父分类过滤', async () => {
      const parent = await CategoryService.findMany({ depth: 0 })
      const parentId = parent.categories.find(c => c.code === 'test-parent-findmany')?.id

      const result = await CategoryService.findMany({
        parentId: parentId
      })

      expect(result.categories.length).toBe(2)
      result.categories.forEach(category => {
        expect(category.parentId).toBe(parentId)
      })
    })

    it('应该按深度过滤', async () => {
      const result = await CategoryService.findMany({ depth: 0 })

      result.categories.forEach(category => {
        expect(category.depth).toBe(0)
      })
    })

    it('应该支持搜索', async () => {
      const result = await CategoryService.findMany({
        search: '子分类'
      })

      expect(result.categories.length).toBeGreaterThanOrEqual(2)
      result.categories.forEach(category => {
        expect(category.name.includes('子分类')).toBe(true)
      })
    })

    it('应该按排序字段排序', async () => {
      const result = await CategoryService.findMany()

      // 检查是否按照深度、排序顺序、名称的顺序排序
      if (result.categories.length > 1) {
        for (let i = 1; i < result.categories.length; i++) {
          const prev = result.categories[i-1]
          const curr = result.categories[i]

          if (prev.depth === curr.depth) {
            expect(curr.sortOrder).toBeGreaterThanOrEqual(prev.sortOrder)
          } else {
            expect(curr.depth).toBeGreaterThanOrEqual(prev.depth)
          }
        }
      }
    })
  })

  describe('update', () => {
    let testCategory

    beforeEach(async () => {
      testCategory = await CategoryService.create({
        name: '更新测试分类',
        code: 'test-update-category'
      })
    })

    it('应该成功更新分类', async () => {
      const updateData = {
        name: '更新后的分类名称',
        description: '更新后的描述'
      }

      const updatedCategory = await CategoryService.update(testCategory.id, updateData)

      expect(updatedCategory.name).toBe(updateData.name)
      expect(updatedCategory.description).toBe(updateData.description)
      expect(updatedCategory.updatedAt.getTime()).toBeGreaterThan(testCategory.updatedAt.getTime())
    })

    it('应该在分类不存在时抛出错误', async () => {
      await expect(CategoryService.update('non-existent-id', { name: '新名称' }))
        .rejects.toThrow('分类不存在')
    })

    it('应该在编码重复时抛出错误', async () => {
      const anotherCategory = await CategoryService.create({
        name: '另一个分类',
        code: 'test-another-category'
      })

      await expect(CategoryService.update(testCategory.id, { code: 'test-another-category' }))
        .rejects.toThrow('分类编码已存在')
    })

    it('应该防止循环引用', async () => {
      const childCategory = await CategoryService.create({
        name: '子分类',
        code: 'test-child-category-update',
        parentId: testCategory.id
      })

      // 尝试将父分类的父设置为子分类（循环引用）
      await expect(CategoryService.update(testCategory.id, { parentId: childCategory.id }))
        .rejects.toThrow('不能将分类移动到其子分类下')
    })
  })

  describe('delete', () => {
    let testCategory

    beforeEach(async () => {
      testCategory = await CategoryService.create({
        name: '删除测试分类',
        code: 'test-delete-category'
      })
    })

    it('应该软删除空分类', async () => {
      await CategoryService.delete(testCategory.id)

      const category = await prisma.category.findUnique({
        where: { id: testCategory.id }
      })

      expect(category).toBeDefined()
      expect(category!.isActive).toBe(false)
    })

    it('应该在有子分类时拒绝删除', async () => {
      await CategoryService.create({
        name: '子分类',
        code: 'test-child-prevent-delete',
        parentId: testCategory.id
      })

      await expect(CategoryService.delete(testCategory.id))
        .rejects.toThrow('无法删除包含子分类的分类')
    })

    it('应该在分类不存在时抛出错误', async () => {
      await expect(CategoryService.delete('non-existent-id'))
        .rejects.toThrow('分类不存在')
    })
  })

  describe('getStats', () => {
    beforeEach(async () => {
      // 创建不同深度的分类
      const level0 = await CategoryService.create({
        name: '统计测试0级',
        code: 'test-stats-level-0'
      })

      await CategoryService.create({
        name: '统计测试1级',
        code: 'test-stats-level-1',
        parentId: level0.id
      })

      await CategoryService.create({
        name: '非活跃分类',
        code: 'test-inactive-category'
      })

      // 软删除一个分类
      const toDelete = await CategoryService.create({
        name: '待删除分类',
        code: 'test-to-delete'
      })
      await CategoryService.delete(toDelete.id)
    })

    it('应该返回正确的统计信息', async () => {
      const stats = await CategoryService.getStats()

      expect(stats.total).toBeGreaterThanOrEqual(4)
      expect(stats.byDepth).toBeDefined()
      expect(stats.byDepth[0]).toBeGreaterThanOrEqual(2) // 至少2个0级分类
      expect(stats.byDepth[1]).toBeGreaterThanOrEqual(1) // 至少1个1级分类
      expect(stats.activeCount).toBeGreaterThanOrEqual(3)
      expect(stats.inactiveCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('性能测试', () => {
    it('分类树查询响应时间应小于150ms', async () => {
      // 创建一些测试数据
      const categories = []
      for (let i = 0; i < 5; i++) {
        const parent = await CategoryService.create({
          name: `性能测试分类${i}`,
          code: `test-perf-${i}`
        })
        categories.push(parent)

        // 为每个父分类创建子分类
        for (let j = 0; j < 3; j++) {
          const child = await CategoryService.create({
            name: `子分类${i}-${j}`,
            code: `test-perf-${i}-${j}`,
            parentId: parent.id
          })
          categories.push(child)
        }
      }

      const startTime = Date.now()
      await CategoryService.getTree()
      const endTime = Date.now()

      const responseTime = endTime - startTime
      expect(responseTime).toBeLessThan(150)

      // 清理测试数据
      await Promise.all(
        categories.map(category => prisma.category.delete({ where: { id: category.id } }))
      )
    })
  })
})