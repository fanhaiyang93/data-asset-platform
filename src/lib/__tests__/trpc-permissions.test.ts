/**
 * tRPC 权限中间件集成测试
 * 测试 API 接口级权限校验功能
 */

import { PrismaClient, UserRole } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { createTRPCContext } from '../trpc'
import { authRouter } from '../../server/routers/auth'
import { AuthService } from '../auth'

const prisma = new PrismaClient()

// Mock Next.js 请求对象
const createMockReq = (token?: string) => ({
  headers: {
    authorization: token ? `Bearer ${token}` : undefined,
    'x-forwarded-for': '127.0.0.1',
    'user-agent': 'Jest Test Agent'
  },
  cookies: token ? { 'auth-token': token } : {},
  connection: { remoteAddress: '127.0.0.1' }
} as any)

const createMockRes = () => ({} as any)

describe('tRPC 权限中间件测试', () => {
  let testUsers: {
    businessUser: { id: string; token: string }
    assetManager: { id: string; token: string }
    systemAdmin: { id: string; token: string }
  }

  beforeAll(async () => {
    // 获取现有测试用户
    const businessUser = await prisma.user.findFirst({
      where: { role: UserRole.BUSINESS_USER }
    })
    const assetManager = await prisma.user.findFirst({
      where: { role: UserRole.ASSET_MANAGER }
    })
    const systemAdmin = await prisma.user.findFirst({
      where: { role: UserRole.SYSTEM_ADMIN }
    })

    if (!businessUser || !assetManager || !systemAdmin) {
      throw new Error('测试用户未找到，请先运行数据库种子脚本')
    }

    // 为每个用户创建JWT令牌
    const businessToken = AuthService.generateToken(businessUser.id)
    const managerToken = AuthService.generateToken(assetManager.id)
    const adminToken = AuthService.generateToken(systemAdmin.id)

    testUsers = {
      businessUser: { id: businessUser.id, token: businessToken },
      assetManager: { id: assetManager.id, token: managerToken },
      systemAdmin: { id: systemAdmin.id, token: adminToken }
    }
  })

  describe('权限检查端点测试', () => {
    test('已认证用户应该能够检查权限', async () => {
      const ctx = await createTRPCContext({
        req: createMockReq(testUsers.businessUser.token),
        res: createMockRes()
      })

      const caller = authRouter.createCaller(ctx)

      const result = await caller.checkPermission({
        resource: 'assets',
        action: 'read'
      })

      expect(result.allowed).toBe(true)
    })

    test('未认证用户不应该能够访问权限检查端点', async () => {
      const ctx = await createTRPCContext({
        req: createMockReq(), // 没有token
        res: createMockRes()
      })

      const caller = authRouter.createCaller(ctx)

      await expect(
        caller.checkPermission({
          resource: 'assets',
          action: 'read'
        })
      ).rejects.toThrow(TRPCError)
    })

    test('业务用户不应该有资产写入权限', async () => {
      const ctx = await createTRPCContext({
        req: createMockReq(testUsers.businessUser.token),
        res: createMockRes()
      })

      const caller = authRouter.createCaller(ctx)

      const result = await caller.checkPermission({
        resource: 'assets',
        action: 'write'
      })

      expect(result.allowed).toBe(false)
    })
  })

  describe('用户信息端点测试', () => {
    test('已认证用户应该能够获取自己的信息', async () => {
      const ctx = await createTRPCContext({
        req: createMockReq(testUsers.businessUser.token),
        res: createMockRes()
      })

      const caller = authRouter.createCaller(ctx)

      const result = await caller.getMe()

      expect(result).toHaveProperty('id', testUsers.businessUser.id)
      expect(result).toHaveProperty('role', UserRole.BUSINESS_USER)
      expect(result).toHaveProperty('permissions')
    })

    test('已认证用户应该能够获取自己的权限列表', async () => {
      const ctx = await createTRPCContext({
        req: createMockReq(testUsers.assetManager.token),
        res: createMockRes()
      })

      const caller = authRouter.createCaller(ctx)

      const result = await caller.getUserPermissions()

      expect(result).toHaveProperty('assets')
      expect(result.assets).toHaveProperty('read', true)
      expect(result.assets).toHaveProperty('write', true)
      expect(result.assets).toHaveProperty('delete', true)
      expect(result.assets).toHaveProperty('manage', true)
    })
  })

  describe('管理员端点测试', () => {
    test('系统管理员应该能够获取用户列表', async () => {
      const ctx = await createTRPCContext({
        req: createMockReq(testUsers.systemAdmin.token),
        res: createMockRes()
      })

      const caller = authRouter.createCaller(ctx)

      const result = await caller.getUsers({
        limit: 10,
        offset: 0
      })

      expect(result).toHaveProperty('users')
      expect(result).toHaveProperty('total')
      expect(result).toHaveProperty('hasMore')
      expect(Array.isArray(result.users)).toBe(true)
    })

    test('非系统管理员不应该能够获取用户列表', async () => {
      const ctx = await createTRPCContext({
        req: createMockReq(testUsers.assetManager.token),
        res: createMockRes()
      })

      const caller = authRouter.createCaller(ctx)

      await expect(
        caller.getUsers({
          limit: 10,
          offset: 0
        })
      ).rejects.toThrow(TRPCError)
    })

    test('系统管理员应该能够更改用户角色', async () => {
      // 创建测试用户
      const testUser = await prisma.user.create({
        data: {
          username: 'test_trpc_role_change',
          email: 'test_trpc_role_change@example.com',
          passwordHash: 'test_hash',
          name: 'tRPC角色变更测试用户',
          role: UserRole.BUSINESS_USER
        }
      })

      try {
        const ctx = await createTRPCContext({
          req: createMockReq(testUsers.systemAdmin.token),
          res: createMockRes()
        })

        const caller = authRouter.createCaller(ctx)

        const result = await caller.changeUserRole({
          userId: testUser.id,
          newRole: UserRole.ASSET_MANAGER,
          reason: 'tRPC测试角色变更'
        })

        expect(result.success).toBe(true)

        // 验证角色已更改
        const updatedUser = await prisma.user.findUnique({
          where: { id: testUser.id },
          select: { role: true }
        })
        expect(updatedUser?.role).toBe(UserRole.ASSET_MANAGER)
      } finally {
        // 清理测试数据
        await prisma.auditLog.deleteMany({
          where: { resource: `user:${testUser.id}` }
        })
        await prisma.user.delete({ where: { id: testUser.id } })
      }
    })

    test('非系统管理员不应该能够更改用户角色', async () => {
      const ctx = await createTRPCContext({
        req: createMockReq(testUsers.assetManager.token),
        res: createMockRes()
      })

      const caller = authRouter.createCaller(ctx)

      await expect(
        caller.changeUserRole({
          userId: testUsers.businessUser.id,
          newRole: UserRole.SYSTEM_ADMIN,
          reason: '测试权限检查'
        })
      ).rejects.toThrow(TRPCError)
    })
  })

  describe('审计日志端点测试', () => {
    test('系统管理员应该能够获取审计日志', async () => {
      const ctx = await createTRPCContext({
        req: createMockReq(testUsers.systemAdmin.token),
        res: createMockRes()
      })

      const caller = authRouter.createCaller(ctx)

      const result = await caller.getUserAuditLogs({
        limit: 10,
        offset: 0
      })

      expect(result).toHaveProperty('logs')
      expect(result).toHaveProperty('total')
      expect(result).toHaveProperty('hasMore')
      expect(Array.isArray(result.logs)).toBe(true)
    })

    test('系统管理员应该能够获取权限统计', async () => {
      const ctx = await createTRPCContext({
        req: createMockReq(testUsers.systemAdmin.token),
        res: createMockRes()
      })

      const caller = authRouter.createCaller(ctx)

      const result = await caller.getPermissionStats()

      expect(result).toHaveProperty('roleDistribution')
      expect(result).toHaveProperty('recentActivity')
      expect(result).toHaveProperty('deniedAccessCount')
      expect(Array.isArray(result.roleDistribution)).toBe(true)
      expect(Array.isArray(result.recentActivity)).toBe(true)
      expect(typeof result.deniedAccessCount).toBe('number')
    })
  })

  describe('错误处理测试', () => {
    test('无效token应该返回认证错误', async () => {
      const ctx = await createTRPCContext({
        req: createMockReq('invalid-token'),
        res: createMockRes()
      })

      const caller = authRouter.createCaller(ctx)

      await expect(
        caller.getMe()
      ).rejects.toThrow(TRPCError)
    })

    test('过期token应该返回认证错误', async () => {
      // 创建过期的token
      const expiredToken = AuthService.generateToken(testUsers.businessUser.id, '-1h')

      const ctx = await createTRPCContext({
        req: createMockReq(expiredToken),
        res: createMockRes()
      })

      const caller = authRouter.createCaller(ctx)

      await expect(
        caller.getMe()
      ).rejects.toThrow(TRPCError)
    })
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})