import { createTRPCRouter } from '@/lib/trpc'
import { authRouter } from './auth'
import { assetsRouter } from './assets'
import { searchRouter } from './search'
import { applicationRouter } from './application'
import { platformRouter } from './platform'
import { favoritesRouter } from './favorites'

/**
 * 主 tRPC 路由器
 * 包含所有子路由器
 */
export const appRouter = createTRPCRouter({
  auth: authRouter,
  assets: assetsRouter,
  search: searchRouter,
  application: applicationRouter,
  platform: platformRouter,
  favorites: favoritesRouter,
})

export type AppRouter = typeof appRouter