import { z } from 'zod'
import { createTRPCRouter, publicProcedure, protectedProcedure, adminProcedure } from '@/lib/trpc'
import { AssetService, type CreateAssetInput, type UpdateAssetInput, type FindManyAssetsInput, type SampleDataInput } from '../services/AssetService'
import { CategoryService, type CreateCategoryInput, type UpdateCategoryInput } from '../services/CategoryService'

// Zod schemas for validation
const AssetStatusSchema = z.enum(['AVAILABLE', 'MAINTENANCE', 'DEPRECATED', 'DRAFT'])
const AssetSensitivitySchema = z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'])

const CreateAssetSchema = z.object({
  name: z.string().min(1, '资产名称不能为空').max(255, '资产名称不能超过255个字符'),
  description: z.string().optional(),
  code: z.string().min(1, '资产编码不能为空').max(100, '资产编码不能超过100个字符'),
  categoryId: z.string().cuid('无效的分类ID'),
  status: AssetStatusSchema.optional(),
  type: z.string().optional(),
  format: z.string().optional(),
  size: z.bigint().optional(),
  recordCount: z.bigint().optional(),
  databaseName: z.string().optional(),
  schemaName: z.string().optional(),
  tableName: z.string().optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  tags: z.string().optional()
})

const UpdateAssetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  code: z.string().min(1).max(100).optional(),
  categoryId: z.string().cuid().optional(),
  status: AssetStatusSchema.optional(),
  type: z.string().optional(),
  format: z.string().optional(),
  size: z.bigint().optional(),
  recordCount: z.bigint().optional(),
  databaseName: z.string().optional(),
  schemaName: z.string().optional(),
  tableName: z.string().optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  lastValidated: z.date().optional(),
  tags: z.string().optional()
})

const FindManyAssetsSchema = z.object({
  categoryId: z.string().cuid().optional(),
  status: AssetStatusSchema.optional(),
  sensitivity: AssetSensitivitySchema.optional(),
  type: z.string().optional(),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  skip: z.number().min(0).default(0),
  take: z.number().min(1).max(100).default(20),
  orderBy: z.object({
    field: z.enum(['name', 'createdAt', 'updatedAt', 'accessCount', 'qualityScore']),
    direction: z.enum(['asc', 'desc'])
  }).default({ field: 'updatedAt', direction: 'desc' })
})

const CreateCategorySchema = z.object({
  name: z.string().min(1, '分类名称不能为空').max(255, '分类名称不能超过255个字符'),
  description: z.string().optional(),
  code: z.string().min(1, '分类编码不能为空').max(100, '分类编码不能超过100个字符'),
  parentId: z.string().cuid().optional(),
  sortOrder: z.number().min(0).default(0)
})

const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  code: z.string().min(1).max(100).optional(),
  parentId: z.string().cuid().optional(),
  sortOrder: z.number().min(0).optional(),
  isActive: z.boolean().optional()
})

export const assetsRouter = createTRPCRouter({
  // ==================== 资产相关操作 ====================

  /**
   * 创建资产
   */
  createAsset: adminProcedure
    .input(CreateAssetSchema)
    .mutation(async ({ ctx, input }) => {
      const data: CreateAssetInput = {
        ...input,
        createdBy: ctx.user.id
      }
      return AssetService.create(data)
    }),

  /**
   * 获取资产详情
   */
  getAsset: publicProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ input }) => {
      return AssetService.findById(input.id)
    }),

  /**
   * 获取资产详细信息（增强版，包含使用统计和表结构）
   */
  getAssetDetail: publicProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ input }) => {
      return AssetService.getAssetDetail(input.id)
    }),

  /**
   * 获取资产样例数据（脱敏处理）
   */
  getSampleData: publicProcedure
    .input(z.object({
      assetId: z.string().cuid(),
      limit: z.number().min(1).max(10).default(10)
    }))
    .query(async ({ input }) => {
      const sampleDataInput: SampleDataInput = {
        assetId: input.assetId,
        limit: input.limit
      }
      return AssetService.getSampleData(sampleDataInput)
    }),

  /**
   * 查询资产列表
   */
  getAssets: publicProcedure
    .input(FindManyAssetsSchema)
    .query(async ({ input }) => {
      const params: FindManyAssetsInput = {
        categoryId: input.categoryId,
        status: input.status,
        sensitivity: input.sensitivity,
        type: input.type,
        search: input.search,
        tags: input.tags,
        skip: input.skip,
        take: input.take,
        orderBy: input.orderBy
      }
      return AssetService.findMany(params)
    }),

  /**
   * 更新资产
   */
  updateAsset: adminProcedure
    .input(z.object({
      id: z.string().cuid(),
      data: UpdateAssetSchema
    }))
    .mutation(async ({ ctx, input }) => {
      const data: UpdateAssetInput = {
        ...input.data,
        updatedBy: ctx.user.id
      }
      return AssetService.update(input.id, data)
    }),

  /**
   * 删除资产（软删除）
   */
  deleteAsset: adminProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ input }) => {
      return AssetService.delete(input.id)
    }),

  /**
   * 获取资产统计
   */
  getAssetStats: publicProcedure
    .input(z.object({
      categoryId: z.string().cuid().optional()
    }))
    .query(async ({ input }) => {
      return AssetService.getStats(input.categoryId)
    }),

  // ==================== 分类相关操作 ====================

  /**
   * 创建分类
   */
  createCategory: adminProcedure
    .input(CreateCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const data: CreateCategoryInput = {
        ...input,
        createdBy: ctx.user.id
      }
      return CategoryService.create(data)
    }),

  /**
   * 获取分类详情
   */
  getCategory: publicProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ input }) => {
      return CategoryService.findById(input.id)
    }),

  /**
   * 获取分类树
   */
  getCategoryTree: publicProcedure
    .input(z.object({
      rootId: z.string().cuid().optional()
    }))
    .query(async ({ input }) => {
      return CategoryService.getTree(input.rootId)
    }),

  /**
   * 获取分类列表
   */
  getCategories: publicProcedure
    .input(z.object({
      parentId: z.string().cuid().optional(),
      depth: z.number().min(0).max(2).optional(),
      isActive: z.boolean().default(true),
      search: z.string().optional(),
      skip: z.number().min(0).default(0),
      take: z.number().min(1).max(100).default(50)
    }))
    .query(async ({ input }) => {
      return CategoryService.findMany({
        parentId: input.parentId,
        depth: input.depth,
        isActive: input.isActive,
        search: input.search,
        skip: input.skip,
        take: input.take
      })
    }),

  /**
   * 更新分类
   */
  updateCategory: adminProcedure
    .input(z.object({
      id: z.string().cuid(),
      data: UpdateCategorySchema
    }))
    .mutation(async ({ ctx, input }) => {
      const data: UpdateCategoryInput = {
        ...input.data,
        updatedBy: ctx.user.id
      }
      return CategoryService.update(input.id, data)
    }),

  /**
   * 删除分类（软删除）
   */
  deleteCategory: adminProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ input }) => {
      return CategoryService.delete(input.id)
    }),

  /**
   * 获取分类统计
   */
  getCategoryStats: publicProcedure
    .query(async () => {
      return CategoryService.getStats()
    }),

  /**
   * 获取指定分类的详细统计信息（新增）
   */
  getCategoryDetailStats: publicProcedure
    .input(z.object({ categoryId: z.string().cuid() }))
    .query(async ({ input }) => {
      return CategoryService.getCategoryDetailStats(input.categoryId)
    }),

  /**
   * 获取增强的分类树（包含统计信息）
   */
  getCategoryTreeWithStats: publicProcedure
    .input(z.object({
      rootId: z.string().cuid().optional()
    }))
    .query(async ({ input }) => {
      return CategoryService.getTreeWithStats(input.rootId)
    }),

  /**
   * 获取热门分类
   */
  getPopularCategories: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(10)
    }))
    .query(async ({ input }) => {
      return CategoryService.getPopularCategories(input.limit)
    }),

  // ==================== 复合查询 ====================

  /**
   * 根据分类获取资产数量
   */
  getCategoryAssetCount: publicProcedure
    .input(z.object({ categoryId: z.string().cuid() }))
    .query(async ({ input }) => {
      const result = await AssetService.findMany({
        categoryId: input.categoryId,
        take: 0 // 只获取总数
      })
      return { count: result.total }
    }),

  /**
   * 根据分类获取资产列表（优化版本）
   */
  getAssetsByCategory: publicProcedure
    .input(z.object({
      categoryId: z.string().cuid(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(50).default(20),
      sortBy: z.enum(['name', 'updatedAt', 'viewCount']).default('updatedAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc')
    }))
    .query(async ({ input }) => {
      const skip = (input.page - 1) * input.limit

      // 使用优化的查询参数
      const params: FindManyAssetsInput = {
        categoryId: input.categoryId,
        skip,
        take: input.limit,
        orderBy: {
          field: input.sortBy === 'viewCount' ? 'accessCount' : input.sortBy,
          direction: input.sortOrder
        }
      }

      const result = await AssetService.findMany(params)

      return {
        assets: result.assets.map(asset => ({
          id: asset.id,
          name: asset.name,
          description: asset.description,
          status: asset.status,
          updatedAt: asset.updatedAt,
          owner: asset.creator?.name,
          viewCount: asset.accessCount || 0,
          category: asset.category
        })),
        total: result.total,
        hasMore: skip + input.limit < result.total,
        page: input.page,
        limit: input.limit
      }
    }),

  /**
   * 获取顶级分类及其资产数量
   */
  getTopLevelCategoriesWithCounts: publicProcedure
    .query(async () => {
      const { categories } = await CategoryService.findMany({
        parentId: null,
        depth: 0,
        isActive: true
      })

      const categoriesWithCounts = await Promise.all(
        categories.map(async (category) => {
          const { total } = await AssetService.findMany({
            categoryId: category.id,
            take: 0
          })
          return {
            ...category,
            assetCount: total
          }
        })
      )

      return categoriesWithCounts
    }),

  /**
   * 搜索资产和分类
   */
  search: publicProcedure
    .input(z.object({
      query: z.string().min(1, '搜索关键词不能为空'),
      type: z.enum(['all', 'assets', 'categories']).default('all'),
      limit: z.number().min(1).max(50).default(20)
    }))
    .query(async ({ input }) => {
      const results: {
        assets?: any[]
        categories?: any[]
        total: number
      } = { total: 0 }

      if (input.type === 'all' || input.type === 'assets') {
        const assetResults = await AssetService.findMany({
          search: input.query,
          take: input.limit
        })
        results.assets = assetResults.assets
        results.total += assetResults.assets.length
      }

      if (input.type === 'all' || input.type === 'categories') {
        const categoryResults = await CategoryService.findMany({
          search: input.query,
          take: input.limit
        })
        results.categories = categoryResults.categories
        results.total += categoryResults.categories.length
      }

      return results
    })
})

export type AssetsRouter = typeof assetsRouter