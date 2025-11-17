import { createTRPCRouter } from '@/server/api/trpc'
import { searchRouter } from '@/server/routers/search'
import { applicationsRouter } from '@/server/api/routers/applications'
import { usersRouter } from '@/server/api/routers/users'

/**
 * 这是应用程序的主路由器
 *
 * 如果你想要添加新的路由器，请在这里导入并添加到 appRouter 中
 */
export const appRouter = createTRPCRouter({
  search: searchRouter,
  applications: applicationsRouter,
  users: usersRouter,
  // 这里可以添加其他路由器，例如：
  // assets: assetsRouter,
  // categories: categoriesRouter,
})

// 导出路由器类型定义
export type AppRouter = typeof appRouter