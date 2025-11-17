/**
 * tRPC 配置文件
 * 这里定义了 tRPC 的基础配置，包括上下文创建和中间件
 */

import { initTRPC, TRPCError } from '@trpc/server'
import { type CreateNextContextOptions } from '@trpc/server/adapters/next'
import superjson from 'superjson'
import { ZodError } from 'zod'

/**
 * 创建上下文
 * 这里可以访问请求信息，用于身份验证、数据库连接等
 */
export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const { req, res } = opts

  // 模拟会话，实际项目中应该从 req 中获取会话信息
  const session = {
    user: {
      id: 'anonymous',
      name: 'Anonymous User',
      email: 'anonymous@example.com'
    }
  }

  return {
    req,
    res,
    session,
    // 这里可以添加数据库连接、其他服务等
  }
}

/**
 * 初始化 tRPC
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

/**
 * 导出 tRPC 路由器和程序
 */
export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

/**
 * 需要身份验证的程序（暂时未实现完整的身份验证）
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  // 这里应该检查用户是否已登录
  // 现在暂时允许所有请求通过

  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  return next({
    ctx: {
      // 确保上下文中包含用户信息
      ...ctx,
      session: { ...ctx.session, user: ctx.session.user },
    },
  })
})

/**
 * 上下文类型定义
 */
export type Context = Awaited<ReturnType<typeof createTRPCContext>>