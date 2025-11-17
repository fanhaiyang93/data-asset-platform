import { initTRPC, TRPCError } from '@trpc/server'
import { type CreateNextContextOptions } from '@trpc/server/adapters/next'
import { type NextRequest } from 'next/server'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { AuthService } from './auth'
import { prisma } from './prisma'

// 创建tRPC上下文
export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const { req, res } = opts

  // 获取用户认证信息
  const getUser = async () => {
    try {
      const token = req.cookies['auth-token'] ||
                   req.headers.authorization?.replace('Bearer ', '')

      if (!token) return null

      const payload = AuthService.verifyToken(token)
      if (!payload) return null

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          name: true,
          department: true
        }
      })

      return user
    } catch (error) {
      console.error('获取用户信息失败:', error)
      return null
    }
  }

  const user = await getUser()

  return {
    req,
    res,
    prisma,
    user,
    // 辅助方法
    getUserId: () => user?.id || null,
    getUserRole: () => user?.role || null,
  }
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>

// 初始化tRPC
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.code === 'BAD_REQUEST' && error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    }
  },
})

// 创建路由器
export const createTRPCRouter = t.router

// 基础程序（无认证要求）
export const publicProcedure = t.procedure

// 需要认证的程序
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: '您需要登录才能访问此资源',
    })
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // 确保用户已认证
    },
  })
})

// 需要特定权限的程序装饰器
export const createPermissionProcedure = (resource: string, action: string) => {
  return protectedProcedure.use(async ({ ctx, next }) => {
    // 简化权限检查 - 仅用于前端测试
    // 实际项目中应该实现完整的权限检查逻辑
    const isAuthorized = ctx.user.role === 'SYSTEM_ADMIN' || ctx.user.role === 'ASSET_MANAGER'

    if (!isAuthorized) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `权限不足：无法执行 ${resource} 的 ${action} 操作`,
      })
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    })
  })
}

// 管理员专用程序（资产管理员或系统管理员）
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const isAdmin = ctx.user.role === 'SYSTEM_ADMIN' || ctx.user.role === 'ASSET_MANAGER'

  if (!isAdmin) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '权限不足：此操作仅限管理员访问',
    })
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  })
})

// 系统管理员专用程序
export const systemAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const isSystemAdmin = ctx.user.role === 'SYSTEM_ADMIN'

  if (!isSystemAdmin) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '权限不足：此操作仅限系统管理员访问',
    })
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  })
})