import { prisma } from '@/lib/prisma'
import { type Category } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { getCachedOrCompute, cache, CACHE_KEYS, invalidateCache } from '@/lib/cache'

export interface CreateCategoryInput {
  name: string
  description?: string
  code: string
  parentId?: string
  sortOrder?: number
  createdBy?: string
}

export interface UpdateCategoryInput {
  name?: string
  description?: string
  code?: string
  parentId?: string
  sortOrder?: number
  isActive?: boolean
  updatedBy?: string
}

export interface CategoryWithChildren extends Category {
  children?: CategoryWithChildren[]
  assets?: any[]
  _count?: {
    assets: number
    children: number
  }
}

export interface CategoryTree extends CategoryWithChildren {
  children: CategoryTree[]
}

export class CategoryService {
  /**
   * 创建分类
   */
  static async create(data: CreateCategoryInput): Promise<Category> {
    try {
      // 检查分类编码是否唯一
      const existingCategory = await prisma.category.findUnique({
        where: { code: data.code }
      })

      if (existingCategory) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '分类编码已存在'
        })
      }

      let depth = 0
      let path = `/${data.code}`

      // 如果有父分类，检查父分类并计算深度
      if (data.parentId) {
        const parent = await prisma.category.findUnique({
          where: { id: data.parentId }
        })

        if (!parent) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '父分类不存在'
          })
        }

        // 检查深度限制（最多3级）
        if (parent.depth >= 2) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '分类层级不能超过3级'
          })
        }

        depth = parent.depth + 1
        path = `${parent.path}/${data.code}`
      }

      const category = await prisma.category.create({
        data: {
          ...data,
          depth,
          path,
          sortOrder: data.sortOrder || 0
        },
        include: {
          parent: true,
          creator: {
            select: {
              id: true,
              username: true,
              name: true
            }
          }
        }
      })

      // 创建分类后，使相关缓存失效
      invalidateCache('category*')

      return category
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }

      console.error('创建分类失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '创建分类失败'
      })
    }
  }

  /**
   * 根据ID获取分类
   */
  static async findById(id: string): Promise<CategoryWithChildren | null> {
    try {
      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          parent: true,
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' }
          },
          creator: {
            select: {
              id: true,
              username: true,
              name: true
            }
          },
          updater: {
            select: {
              id: true,
              username: true,
              name: true
            }
          },
          _count: {
            select: {
              assets: true,
              children: true
            }
          }
        }
      })

      return category
    } catch (error) {
      console.error('获取分类失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '获取分类失败'
      })
    }
  }

  /**
   * 获取分类树（带缓存）
   */
  static async getTree(rootId?: string): Promise<CategoryTree[]> {
    const cacheKey = rootId ? `${CACHE_KEYS.CATEGORY_TREE}_${rootId}` : CACHE_KEYS.CATEGORY_TREE

    return getCachedOrCompute(cacheKey, async () => {
      return this.getTreeInternal(rootId)
    }, 15 * 60 * 1000) // 15分钟缓存
  }

  /**
   * 获取分类树（内部实现，不带缓存）
   */
  private static async getTreeInternal(rootId?: string): Promise<CategoryTree[]> {
    try {
      // 如果指定了根ID，从该节点开始构建树
      const rootCondition = rootId ? { id: rootId } : { parentId: null }

      const buildTree = async (parentId: string | null): Promise<CategoryTree[]> => {
        const categories = await prisma.category.findMany({
          where: {
            parentId,
            isActive: true
          },
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: {
              select: {
                assets: true,
                children: true
              }
            }
          }
        })

        const tree: CategoryTree[] = []

        for (const category of categories) {
          const children = await buildTree(category.id)
          tree.push({
            ...category,
            children
          })
        }

        return tree
      }

      if (rootId) {
        // 获取指定根节点及其子树
        const rootCategory = await prisma.category.findUnique({
          where: { id: rootId },
          include: {
            _count: {
              select: {
                assets: true,
                children: true
              }
            }
          }
        })

        if (!rootCategory) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '指定的根分类不存在'
          })
        }

        const children = await buildTree(rootId)
        return [{
          ...rootCategory,
          children
        }]
      } else {
        return buildTree(null)
      }
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }

      console.error('构建分类树失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '构建分类树失败'
      })
    }
  }

  /**
   * 获取扁平化的分类列表
   */
  static async findMany(params: {
    parentId?: string
    depth?: number
    isActive?: boolean
    search?: string
    skip?: number
    take?: number
  } = {}): Promise<{
    categories: CategoryWithChildren[]
    total: number
  }> {
    try {
      const {
        parentId,
        depth,
        isActive = true,
        search,
        skip = 0,
        take = 50
      } = params

      const where: any = {}

      if (parentId !== undefined) {
        where.parentId = parentId
      }

      if (depth !== undefined) {
        where.depth = depth
      }

      if (isActive !== undefined) {
        where.isActive = isActive
      }

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { description: { contains: search } },
          { code: { contains: search } }
        ]
      }

      const [categories, total] = await Promise.all([
        prisma.category.findMany({
          where,
          skip,
          take,
          orderBy: [
            { depth: 'asc' },
            { sortOrder: 'asc' },
            { name: 'asc' }
          ],
          include: {
            parent: true,
            creator: {
              select: {
                id: true,
                username: true,
                name: true
              }
            },
            _count: {
              select: {
                assets: true,
                children: true
              }
            }
          }
        }),
        prisma.category.count({ where })
      ])

      return { categories, total }
    } catch (error) {
      console.error('查询分类失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '查询分类失败'
      })
    }
  }

  /**
   * 更新分类
   */
  static async update(id: string, data: UpdateCategoryInput): Promise<Category> {
    try {
      const existingCategory = await prisma.category.findUnique({
        where: { id }
      })

      if (!existingCategory) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '分类不存在'
        })
      }

      // 如果更新编码，检查唯一性
      if (data.code && data.code !== existingCategory.code) {
        const codeExists = await prisma.category.findUnique({
          where: { code: data.code }
        })

        if (codeExists) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: '分类编码已存在'
          })
        }
      }

      let updateData = { ...data }

      // 如果更新父分类，需要重新计算深度和路径
      if (data.parentId !== undefined && data.parentId !== existingCategory.parentId) {
        if (data.parentId === id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '分类不能作为自己的父分类'
          })
        }

        let depth = 0
        let path = `/${data.code || existingCategory.code}`

        if (data.parentId) {
          const parent = await prisma.category.findUnique({
            where: { id: data.parentId }
          })

          if (!parent) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: '父分类不存在'
            })
          }

          // 检查是否会形成循环引用
          const isDescendant = await this.isDescendant(id, data.parentId)
          if (isDescendant) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: '不能将分类移动到其子分类下'
            })
          }

          // 检查深度限制
          if (parent.depth >= 2) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: '分类层级不能超过3级'
            })
          }

          depth = parent.depth + 1
          path = `${parent.path}/${data.code || existingCategory.code}`
        }

        updateData = {
          ...updateData,
          depth,
          path
        }
      }

      const category = await prisma.category.update({
        where: { id },
        data: updateData,
        include: {
          parent: true,
          creator: {
            select: {
              id: true,
              username: true,
              name: true
            }
          },
          updater: {
            select: {
              id: true,
              username: true,
              name: true
            }
          }
        }
      })

      // 如果更新了编码或父分类，需要更新所有子分类的路径
      if (data.code || data.parentId !== undefined) {
        await this.updateChildrenPaths(id)
      }

      return category
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }

      console.error('更新分类失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '更新分类失败'
      })
    }
  }

  /**
   * 删除分类（软删除）
   */
  static async delete(id: string): Promise<void> {
    try {
      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          children: true,
          assets: true
        }
      })

      if (!category) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '分类不存在'
        })
      }

      // 检查是否有子分类
      if (category.children.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '无法删除包含子分类的分类'
        })
      }

      // 检查是否有关联的资产
      if (category.assets.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '无法删除包含资产的分类'
        })
      }

      // 软删除：设置为不活跃状态
      await prisma.category.update({
        where: { id },
        data: {
          isActive: false
        }
      })
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }

      console.error('删除分类失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '删除分类失败'
      })
    }
  }

  /**
   * 检查一个分类是否是另一个分类的后代
   */
  private static async isDescendant(ancestorId: string, descendantId: string): Promise<boolean> {
    const descendant = await prisma.category.findUnique({
      where: { id: descendantId },
      include: { parent: true }
    })

    if (!descendant || !descendant.parent) {
      return false
    }

    if (descendant.parent.id === ancestorId) {
      return true
    }

    return this.isDescendant(ancestorId, descendant.parent.id)
  }

  /**
   * 更新子分类路径
   */
  private static async updateChildrenPaths(parentId: string): Promise<void> {
    const parent = await prisma.category.findUnique({
      where: { id: parentId }
    })

    if (!parent) return

    const children = await prisma.category.findMany({
      where: { parentId }
    })

    for (const child of children) {
      const newPath = `${parent.path}/${child.code}`
      await prisma.category.update({
        where: { id: child.id },
        data: { path: newPath }
      })

      // 递归更新子分类的子分类
      await this.updateChildrenPaths(child.id)
    }
  }

  /**
   * 获取分类统计信息
   */
  static async getStats(): Promise<{
    total: number
    byDepth: Record<number, number>
    activeCount: number
    inactiveCount: number
  }> {
    try {
      const [total, depthStats, activeCount, inactiveCount] = await Promise.all([
        prisma.category.count(),
        prisma.category.groupBy({
          by: ['depth'],
          _count: {
            depth: true
          }
        }),
        prisma.category.count({ where: { isActive: true } }),
        prisma.category.count({ where: { isActive: false } })
      ])

      const byDepth = depthStats.reduce((acc, stat) => {
        acc[stat.depth] = stat._count.depth
        return acc
      }, {} as Record<number, number>)

      return {
        total,
        byDepth,
        activeCount,
        inactiveCount
      }
    } catch (error) {
      console.error('获取分类统计失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '获取分类统计失败'
      })
    }
  }

  /**
   * 获取指定分类的详细统计信息（带缓存）
   */
  static async getCategoryDetailStats(categoryId: string): Promise<{
    assetCount: number
    subCategoryCount: number
    totalAssetsIncludingChildren: number
    lastUpdated?: Date
  }> {
    const cacheKey = CACHE_KEYS.CATEGORY_DETAIL_STATS(categoryId)

    return getCachedOrCompute(cacheKey, async () => {
      return this.getCategoryDetailStatsInternal(categoryId)
    }, 15 * 60 * 1000) // 15分钟缓存
  }

  /**
   * 获取指定分类的详细统计信息（内部实现）
   */
  private static async getCategoryDetailStatsInternal(categoryId: string): Promise<{
    assetCount: number
    subCategoryCount: number
    totalAssetsIncludingChildren: number
    lastUpdated?: Date
  }> {
    try {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
        include: {
          _count: {
            select: {
              assets: true,
              children: true
            }
          }
        }
      })

      if (!category) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '分类不存在'
        })
      }

      // 递归计算所有子分类的资产总数
      const getTotalAssetsRecursive = async (catId: string): Promise<number> => {
        const cat = await prisma.category.findUnique({
          where: { id: catId },
          include: {
            children: true,
            _count: {
              select: { assets: true }
            }
          }
        })

        if (!cat) return 0

        let total = cat._count.assets

        for (const child of cat.children) {
          total += await getTotalAssetsRecursive(child.id)
        }

        return total
      }

      const totalAssetsIncludingChildren = await getTotalAssetsRecursive(categoryId)

      // 获取最近更新时间
      const lastAsset = await prisma.asset.findFirst({
        where: { categoryId },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true }
      })

      return {
        assetCount: category._count.assets,
        subCategoryCount: category._count.children,
        totalAssetsIncludingChildren,
        lastUpdated: lastAsset?.updatedAt
      }
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }

      console.error('获取分类详细统计失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '获取分类详细统计失败'
      })
    }
  }

  /**
   * 获取增强的分类树（包含统计信息）
   */
  static async getTreeWithStats(rootId?: string): Promise<CategoryTree[]> {
    try {
      const buildTreeWithStats = async (parentId: string | null): Promise<CategoryTree[]> => {
        const categories = await prisma.category.findMany({
          where: {
            parentId,
            isActive: true
          },
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: {
              select: {
                assets: true,
                children: true
              }
            }
          }
        })

        const tree: CategoryTree[] = []

        for (const category of categories) {
          const children = await buildTreeWithStats(category.id)

          // 计算递归统计信息
          const totalAssetsIncludingChildren = category._count.assets +
            children.reduce((sum, child) => sum + (child.assetCount || 0), 0)

          tree.push({
            ...category,
            children,
            assetCount: totalAssetsIncludingChildren
          })
        }

        return tree
      }

      if (rootId) {
        const rootCategory = await prisma.category.findUnique({
          where: { id: rootId },
          include: {
            _count: {
              select: {
                assets: true,
                children: true
              }
            }
          }
        })

        if (!rootCategory) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '指定的根分类不存在'
          })
        }

        const children = await buildTreeWithStats(rootId)
        const totalAssetsIncludingChildren = rootCategory._count.assets +
          children.reduce((sum, child) => sum + (child.assetCount || 0), 0)

        return [{
          ...rootCategory,
          children,
          assetCount: totalAssetsIncludingChildren
        }]
      } else {
        return buildTreeWithStats(null)
      }
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }

      console.error('构建带统计信息的分类树失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '构建带统计信息的分类树失败'
      })
    }
  }

  /**
   * 获取热门分类（按资产数量排序）
   */
  static async getPopularCategories(limit: number = 10): Promise<CategoryWithChildren[]> {
    try {
      const categories = await prisma.category.findMany({
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
        take: limit
      })

      return categories
    } catch (error) {
      console.error('获取热门分类失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '获取热门分类失败'
      })
    }
  }
}