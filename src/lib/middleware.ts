import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from './auth'

export async function authMiddleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value ||
                request.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 验证JWT Token
  const payload = AuthService.verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // 验证会话
  const isValidSession = await AuthService.validateSession(token)
  if (!isValidSession) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 })
  }

  // 检查会话超时（30分钟无活动）
  const isActiveSession = await AuthService.checkSessionTimeout(token)
  if (!isActiveSession) {
    return NextResponse.json({ error: 'Session timeout' }, { status: 401 })
  }

  // 将用户信息添加到请求头中，供后续处理使用
  const response = NextResponse.next()
  response.headers.set('X-User-Id', payload.userId)
  response.headers.set('X-User-Email', payload.email)

  return response
}

export function createAuthenticatedHandler(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const authResponse = await authMiddleware(req)

    // 如果认证失败，直接返回错误响应
    if (authResponse.status !== 200) {
      return authResponse
    }

    // 认证成功，执行原始处理函数
    return handler(req)
  }
}