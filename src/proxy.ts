import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// JWT验证函数 - Edge Runtime 兼容版本
async function verifyJWTToken(token: string): Promise<{
  userId: string
  username: string
  email: string
  role: string
} | null> {
  try {
    const JWT_SECRET = process.env.JWT_SECRET
    if (!JWT_SECRET) {
      console.error('[JWT] JWT_SECRET not found')
      return null
    }

    console.log('[JWT] Starting token verification')
    console.log('[JWT] Token preview:', token.substring(0, 50) + '...')

    // 解析JWT结构: header.payload.signature
    const parts = token.split('.')
    if (parts.length !== 3) {
      console.error('[JWT] Invalid token format - expected 3 parts, got:', parts.length)
      return null
    }

    const [headerB64, payloadB64, signatureB64] = parts
    console.log('[JWT] Token parts parsed successfully')

    // Base64URL解码
    const base64UrlDecode = (str: string): string => {
      // 将 Base64URL 转换为 Base64
      let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
      // 添加填充
      const pad = str.length % 4
      if (pad) {
        if (pad === 1) {
          throw new Error('Invalid base64 string')
        }
        base64 += new Array(5 - pad).join('=')
      }
      // 解码
      return decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
    }

    // 解析payload
    const payloadJson = base64UrlDecode(payloadB64)
    const payload = JSON.parse(payloadJson)
    console.log('[JWT] Payload decoded:', { userId: payload.userId, role: payload.role, exp: payload.exp })

    // 检查过期时间
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      console.error('[JWT] Token expired at:', new Date(payload.exp * 1000).toISOString())
      return null
    }

    // 使用 Web Crypto API 验证签名
    console.log('[JWT] Verifying signature with Web Crypto API')
    const encoder = new TextEncoder()
    const data = encoder.encode(`${headerB64}.${payloadB64}`)
    const secretKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    // Base64URL解码签名
    const signatureBytes = Uint8Array.from(
      atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0)
    )

    const isValid = await crypto.subtle.verify(
      'HMAC',
      secretKey,
      signatureBytes,
      data
    )

    console.log('[JWT] Signature verification result:', isValid)

    if (!isValid) {
      console.error('[JWT] Invalid signature')
      return null
    }

    console.log('[JWT] Token verified successfully, returning payload')
    // 返回payload
    return {
      userId: payload.userId,
      username: payload.username,
      email: payload.email,
      role: payload.role
    }
  } catch (error) {
    console.error('[JWT] Token verification error:', error)
    return null
  }
}

// 定义受保护的路由和所需权限
const PROTECTED_ROUTES = {
  // 系统管理员专用路由
  '/admin': { resource: 'admin', action: 'read', roles: ['SYSTEM_ADMIN'] },
  '/admin/users': { resource: 'users', action: 'read', roles: ['SYSTEM_ADMIN'] },
  '/admin/permissions': { resource: 'admin', action: 'manage', roles: ['SYSTEM_ADMIN'] },
  '/admin/audit': { resource: 'admin', action: 'read', roles: ['SYSTEM_ADMIN'] },
  '/admin/sso': { resource: 'admin', action: 'manage', roles: ['SYSTEM_ADMIN'] },

  // 资产管理路由 (资产管理员 + 系统管理员)
  '/admin/assets': { resource: 'assets', action: 'manage', roles: ['ASSET_MANAGER', 'SYSTEM_ADMIN'] },
  '/assets/manage': { resource: 'assets', action: 'manage', roles: ['ASSET_MANAGER', 'SYSTEM_ADMIN'] },
  '/assets/create': { resource: 'assets', action: 'write', roles: ['ASSET_MANAGER', 'SYSTEM_ADMIN'] },
  '/assets/edit': { resource: 'assets', action: 'write', roles: ['ASSET_MANAGER', 'SYSTEM_ADMIN'] },

  // 申请审批管理路由 (资产管理员 + 系统管理员)
  '/admin/applications': { resource: 'applications', action: 'manage', roles: ['ASSET_MANAGER', 'SYSTEM_ADMIN'] },
  '/applications/manage': { resource: 'applications', action: 'manage', roles: ['ASSET_MANAGER', 'SYSTEM_ADMIN'] },
  '/applications/review': { resource: 'applications', action: 'manage', roles: ['ASSET_MANAGER', 'SYSTEM_ADMIN'] },
} as const

type RouteConfig = {
  resource: string
  action: string
  roles: string[]
}

/**
 * 检查路径是否匹配受保护路由
 */
function getRouteConfig(pathname: string): RouteConfig | null {
  // 精确匹配
  if (PROTECTED_ROUTES[pathname as keyof typeof PROTECTED_ROUTES]) {
    return PROTECTED_ROUTES[pathname as keyof typeof PROTECTED_ROUTES]
  }

  // 前缀匹配（用于动态路由）
  for (const [route, config] of Object.entries(PROTECTED_ROUTES)) {
    if (pathname.startsWith(route + '/')) {
      return config
    }
  }

  return null
}

/**
 * 验证用户权限
 * Edge Runtime兼容的权限检查，基于JWT中的角色信息
 */
async function checkUserPermission(
  token: string,
  resource: string,
  action: string,
  requiredRoles: string[]
): Promise<{ hasPermission: boolean; user?: { id: string; role: string; username: string } }> {
  try {
    // 验证 JWT token - 使用 Edge Runtime 兼容的验证函数
    const payload = await verifyJWTToken(token)

    if (!payload || !payload.role) {
      return { hasPermission: false }
    }

    const user = {
      id: payload.userId,
      role: payload.role,
      username: payload.username
    }

    // 基于JWT中的角色进行权限检查
    const userRole = payload.role

    // 检查角色是否满足要求
    if (requiredRoles.includes(userRole)) {
      return { hasPermission: true, user }
    }

    return { hasPermission: false, user }
  } catch (error) {
    console.error('[Proxy] 权限检查失败:', error)
    return { hasPermission: false }
  }
}

/**
 * Next.js 16 Proxy 入口
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 跳过静态资源和 API 路由
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // 检查是否为受保护路由
  const routeConfig = getRouteConfig(pathname)
  if (!routeConfig) {
    return NextResponse.next()
  }

  // 获取认证 token
  const token = request.cookies.get('auth-token')?.value ||
                request.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    // 未认证用户重定向到登录页
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // 检查用户权限
  const { hasPermission, user } = await checkUserPermission(
    token,
    routeConfig.resource,
    routeConfig.action,
    routeConfig.roles
  )

  if (!hasPermission) {
    // 权限不足,重定向到无权限页面
    const url = request.nextUrl.clone()
    url.pathname = '/unauthorized'
    url.searchParams.set('required', routeConfig.roles.join(','))
    url.searchParams.set('current', user?.role || 'unknown')
    return NextResponse.redirect(url)
  }

  // 权限检查通过,继续处理
  const response = NextResponse.next()

  // 设置用户信息到请求头(供后续组件使用)
  if (user) {
    response.headers.set('x-user-id', user.id)
    response.headers.set('x-user-role', user.role)
  }

  return response
}

// 配置匹配的路径
export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}