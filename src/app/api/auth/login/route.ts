import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 验证请求数据
    const { username, password } = loginSchema.parse(body)

    // 查找用户
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email: username }, // 支持用户名或邮箱登录
        ],
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // 验证密码
    const isValidPassword = await AuthService.verifyPassword(password, user.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // 生成JWT Token
    const token = await AuthService.generateToken(user.id)

    // 创建会话
    await AuthService.createSession(user.id, token)

    // 清理过期会话
    await AuthService.cleanupExpiredSessions()

    // 设置Cookie
    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    })

    response.cookies.set('auth-token', token, {
      httpOnly: false, // 临时移除HttpOnly以便测试
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24小时
    })

    return response
  } catch (error) {
    console.error('Login error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}