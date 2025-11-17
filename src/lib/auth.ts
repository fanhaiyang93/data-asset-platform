import jwt, { SignOptions } from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

// 强制要求JWT密钥，确保生产安全
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required for security')
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'

export interface JWTPayload {
  userId: string
  username: string
  email: string
  role: string  // 添加角色字段支持中间件权限检查
  iat?: number
  exp?: number
}

export class AuthService {
  // 生成JWT Token
  static async generateToken(userId: string, expiresIn: string = JWT_EXPIRES_IN): Promise<string> {
    // 从数据库获取用户信息以包含角色
    return await this.generateTokenWithUserData(userId, expiresIn)
  }

  // 生成包含完整用户数据的JWT Token
  static async generateTokenWithUserData(userId: string, expiresIn: string = JWT_EXPIRES_IN): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true, role: true }
    })

    if (!user) {
      throw new Error('User not found')
    }

    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    }

    return jwt.sign(payload, JWT_SECRET, { expiresIn })
  }

  // 兼容原有的同步方法（用于测试）
  static generateTokenSync(payload: JWTPayload, expiresIn: string = JWT_EXPIRES_IN): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn })
  }

  // 验证JWT Token
  static verifyToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as JWTPayload
    } catch (error) {
      return null
    }
  }

  // 密码加密
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12
    return bcrypt.hash(password, saltRounds)
  }

  // 密码验证
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  // 创建用户会话
  static async createSession(userId: string, token: string): Promise<void> {
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // 24小时后过期

    await prisma.session.create({
      data: {
        userId,
        token,
        expiresAt,
        lastActivity: new Date(),
      },
    })
  }

  // 验证会话
  static async validateSession(token: string): Promise<boolean> {
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!session || session.expiresAt < new Date()) {
      // 清理过期会话
      if (session) {
        await prisma.session.delete({ where: { id: session.id } })
      }
      return false
    }

    // 更新最后活动时间
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActivity: new Date() },
    })

    return true
  }

  // 删除会话（登出）
  static async deleteSession(token: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { token },
    })
  }

  // 清理过期会话
  static async cleanupExpiredSessions(): Promise<void> {
    await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })
  }

  // 检查会话超时（30分钟无活动）
  static async checkSessionTimeout(token: string): Promise<boolean> {
    const session = await prisma.session.findUnique({
      where: { token },
    })

    if (!session) return false

    const thirtyMinutesAgo = new Date()
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30)

    if (session.lastActivity < thirtyMinutesAgo) {
      // 删除超时会话
      await this.deleteSession(token)
      return false
    }

    return true
  }
}