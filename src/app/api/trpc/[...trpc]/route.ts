import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/routers'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'

const handler = async (req: Request) => {
  // 为App Router创建上下文
  const createContext = async () => {
    // 从请求头或cookie获取认证token
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || req.headers.get('cookie')?.match(/auth-token=([^;]+)/)?.[1]

    let user = null
    if (token) {
      try {
        const payload = AuthService.verifyToken(token)
        if (payload) {
          user = await prisma.user.findUnique({
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
        }
      } catch (error) {
        console.error('Token验证失败:', error)
      }
    }

    return {
      prisma,
      user,
      getUserId: () => user?.id || null,
      getUserRole: () => user?.role || null,
    }
  }

  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  })
}

export { handler as GET, handler as POST }
