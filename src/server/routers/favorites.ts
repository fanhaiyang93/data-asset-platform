/**
 * 收藏相关的 tRPC 路由
 */

import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/lib/trpc'
import { prisma } from '@/lib/prisma'
import { TRPCError } from '@trpc/server'

export const favoritesRouter = createTRPCRouter({
  /**
   * 获取用户收藏列表
   */
  getFavorites: protectedProcedure
    .input(z.object({
      search: z.string().optional(), // 搜索关键词
      skip: z.number().min(0).default(0),
      take: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input, ctx }) => {
      const { search, skip, take } = input
      const userId = ctx.user.id

      // 构建查询条件
      const where: any = {
        userId,
      }

      // 如果有搜索关键词,添加资产名称或描述的搜索
      if (search) {
        where.asset = {
          OR: [
            { name: { contains: search } },
            { description: { contains: search } },
            { code: { contains: search } },
          ],
        }
      }

      // 查询收藏列表
      const [favorites, total] = await Promise.all([
        prisma.userFavorite.findMany({
          where,
          include: {
            asset: {
              include: {
                category: true,
                creator: {
                  select: {
                    id: true,
                    name: true,
                    username: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc', // 按收藏时间倒序
          },
          skip,
          take,
        }),
        prisma.userFavorite.count({ where }),
      ])

      return {
        favorites: favorites.map(fav => ({
          id: fav.id,
          createdAt: fav.createdAt,
          asset: {
            id: fav.asset.id,
            name: fav.asset.name,
            code: fav.asset.code,
            description: fav.asset.description,
            status: fav.asset.status,
            categoryId: fav.asset.categoryId,
            category: {
              id: fav.asset.category.id,
              name: fav.asset.category.name,
              description: fav.asset.category.description,
            },
            owner: fav.asset.creator?.name || fav.asset.creator?.username || '未知',
            createdAt: fav.asset.createdAt,
            updatedAt: fav.asset.updatedAt,
            viewCount: fav.asset.accessCount,
          },
        })),
        total,
      }
    }),

  /**
   * 添加收藏
   */
  addFavorite: protectedProcedure
    .input(z.object({
      assetId: z.string().cuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { assetId } = input
      const userId = ctx.user.id

      // 检查资产是否存在
      const asset = await prisma.asset.findUnique({
        where: { id: assetId },
      })

      if (!asset) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '资产不存在',
        })
      }

      // 检查是否已经收藏
      const existing = await prisma.userFavorite.findUnique({
        where: {
          userId_assetId: {
            userId,
            assetId,
          },
        },
      })

      if (existing) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '已经收藏过此资产',
        })
      }

      // 创建收藏记录
      const favorite = await prisma.userFavorite.create({
        data: {
          userId,
          assetId,
        },
        include: {
          asset: true,
        },
      })

      return {
        success: true,
        favorite: {
          id: favorite.id,
          assetId: favorite.assetId,
          assetName: favorite.asset.name,
          createdAt: favorite.createdAt,
        },
      }
    }),

  /**
   * 取消收藏
   */
  removeFavorite: protectedProcedure
    .input(z.object({
      assetId: z.string().cuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { assetId } = input
      const userId = ctx.user.id

      // 检查收藏是否存在
      const favorite = await prisma.userFavorite.findUnique({
        where: {
          userId_assetId: {
            userId,
            assetId,
          },
        },
      })

      if (!favorite) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '未收藏此资产',
        })
      }

      // 删除收藏记录
      await prisma.userFavorite.delete({
        where: {
          id: favorite.id,
        },
      })

      return {
        success: true,
        message: '已取消收藏',
      }
    }),

  /**
   * 检查是否已收藏
   */
  checkFavorite: protectedProcedure
    .input(z.object({
      assetId: z.string().cuid(),
    }))
    .query(async ({ input, ctx }) => {
      const { assetId } = input
      const userId = ctx.user.id

      const favorite = await prisma.userFavorite.findUnique({
        where: {
          userId_assetId: {
            userId,
            assetId,
          },
        },
      })

      return {
        isFavorite: !!favorite,
      }
    }),

  /**
   * 批量检查收藏状态
   */
  checkFavorites: protectedProcedure
    .input(z.object({
      assetIds: z.array(z.string().cuid()),
    }))
    .query(async ({ input, ctx }) => {
      const { assetIds } = input
      const userId = ctx.user.id

      const favorites = await prisma.userFavorite.findMany({
        where: {
          userId,
          assetId: {
            in: assetIds,
          },
        },
        select: {
          assetId: true,
        },
      })

      const favoriteAssetIds = new Set(favorites.map(f => f.assetId))

      return {
        favorites: assetIds.reduce((acc, assetId) => {
          acc[assetId] = favoriteAssetIds.has(assetId)
          return acc
        }, {} as Record<string, boolean>),
      }
    }),
})
