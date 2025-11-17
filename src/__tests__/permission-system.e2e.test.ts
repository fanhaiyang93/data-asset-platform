/**
 * 权限系统端到端测试
 * 测试完整的权限流程：认证 -> 权限检查 -> 数据访问 -> 审计日志
 */

import { PrismaClient, UserRole } from '@prisma/client'
import { AuthService } from '@/lib/auth'
import { PermissionService, PERMISSIONS } from '@/lib/permissions'
import { createTRPCContext } from '@/lib/trpc'
import { authRouter } from '@/server/routers/auth'

const prisma = new PrismaClient()

describe('权限系统端到端测试', () => {
  let testUsers: {
    businessUser: { id: string; token: string; email: string }
    assetManager: { id: string; token: string; email: string }
    systemAdmin: { id: string; token: string; email: string }
  }

  beforeAll(async () => {
    // 获取现有测试用户并生成令牌
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

    testUsers = {
      businessUser: {
        id: businessUser.id,
        token: AuthService.generateTokenSync({
          userId: businessUser.id,
          username: businessUser.username,
          email: businessUser.email,
          role: businessUser.role
        }),
        email: businessUser.email
      },
      assetManager: {
        id: assetManager.id,
        token: AuthService.generateTokenSync({
          userId: assetManager.id,
          username: assetManager.username,
          email: assetManager.email,
          role: assetManager.role
        }),
        email: assetManager.email
      },
      systemAdmin: {
        id: systemAdmin.id,
        token: AuthService.generateTokenSync({
          userId: systemAdmin.id,
          username: systemAdmin.username,
          email: systemAdmin.email,
          role: systemAdmin.role
        }),
        email: systemAdmin.email
      }
    }
  })

  describe('完整权限流程测试', () => {
    test('业务用户完整权限流程', async () => {
      const user = testUsers.businessUser

      // 1. 认证测试
      const payload = AuthService.verifyToken(user.token)
      expect(payload).toBeTruthy()
      expect(payload?.userId).toBe(user.id)

      // 2. 权限检查测试
      const hasAssetsRead = await PermissionService.hasPermission(
        user.id,
        PERMISSIONS.RESOURCES.ASSETS,
        PERMISSIONS.ACTIONS.READ
      )
      const hasAssetsWrite = await PermissionService.hasPermission(
        user.id,
        PERMISSIONS.RESOURCES.ASSETS,
        PERMISSIONS.ACTIONS.WRITE
      )

      expect(hasAssetsRead).toBe(true)  // 业务用户可以读取资产
      expect(hasAssetsWrite).toBe(false) // 业务用户不能写入资产

      // 3. tRPC API 测试
      const ctx = await createTRPCContext({
        req: {
          headers: { authorization: `Bearer ${user.token}` },
          cookies: {}
        } as any,
        res: {} as any
      })

      const caller = authRouter.createCaller(ctx)

      // 获取用户信息
      const userInfo = await caller.getMe()
      expect(userInfo.id).toBe(user.id)
      expect(userInfo.role).toBe(UserRole.BUSINESS_USER)

      // 权限检查
      const permissionCheck = await caller.checkPermission({
        resource: PERMISSIONS.RESOURCES.ASSETS,
        action: PERMISSIONS.ACTIONS.READ
      })
      expect(permissionCheck.allowed).toBe(true)

      // 4. 审计日志验证
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          userId: user.id,
          action: 'permission_checked'
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      })

      expect(auditLogs.length).toBeGreaterThan(0)
      expect(auditLogs[0].resource).toContain(PERMISSIONS.RESOURCES.ASSETS)
    })

    test('资产管理员完整权限流程', async () => {
      const user = testUsers.assetManager

      // 1. 权限检查测试
      const hasAssetsManage = await PermissionService.hasPermission(
        user.id,
        PERMISSIONS.RESOURCES.ASSETS,
        PERMISSIONS.ACTIONS.MANAGE
      )
      const hasUsersManage = await PermissionService.hasPermission(
        user.id,
        PERMISSIONS.RESOURCES.USERS,
        PERMISSIONS.ACTIONS.MANAGE
      )

      expect(hasAssetsManage).toBe(true)  // 资产管理员可以管理资产
      expect(hasUsersManage).toBe(false)  // 资产管理员不能管理用户

      // 2. 管理员权限验证
      const isAdmin = await PermissionService.isAdmin(user.id)
      expect(isAdmin).toBe(true)

      // 3. 角色检查
      const hasCorrectRole = await PermissionService.hasRole(user.id, UserRole.ASSET_MANAGER)
      expect(hasCorrectRole).toBe(true)
    })

    test('系统管理员完整权限流程', async () => {
      const user = testUsers.systemAdmin

      // 1. 全权限验证
      const permissions = [
        { resource: PERMISSIONS.RESOURCES.ASSETS, action: PERMISSIONS.ACTIONS.MANAGE },
        { resource: PERMISSIONS.RESOURCES.USERS, action: PERMISSIONS.ACTIONS.MANAGE },
        { resource: PERMISSIONS.RESOURCES.ADMIN, action: PERMISSIONS.ACTIONS.MANAGE },
        { resource: PERMISSIONS.RESOURCES.APPLICATIONS, action: PERMISSIONS.ACTIONS.MANAGE }
      ]

      for (const perm of permissions) {
        const hasPermission = await PermissionService.hasPermission(
          user.id,
          perm.resource,
          perm.action
        )
        expect(hasPermission).toBe(true)
      }

      // 2. tRPC 管理员功能测试
      const ctx = await createTRPCContext({
        req: {
          headers: { authorization: `Bearer ${user.token}` },
          cookies: {}
        } as any,
        res: {} as any
      })

      const caller = authRouter.createCaller(ctx)

      // 获取用户列表（只有系统管理员可以）
      const usersList = await caller.getUsers({ limit: 10, offset: 0 })
      expect(usersList).toHaveProperty('users')
      expect(usersList).toHaveProperty('total')
      expect(Array.isArray(usersList.users)).toBe(true)

      // 获取权限统计
      const permissionStats = await caller.getPermissionStats()
      expect(permissionStats).toHaveProperty('roleDistribution')
      expect(permissionStats).toHaveProperty('recentActivity')
      expect(permissionStats).toHaveProperty('deniedAccessCount')

      // 3. 角色变更测试
      const testUser = await prisma.user.create({
        data: {
          username: 'test_e2e_user',
          email: 'test_e2e@example.com',
          passwordHash: 'test_hash',
          name: 'E2E测试用户',
          role: UserRole.BUSINESS_USER
        }
      })

      try {
        const roleChangeResult = await caller.changeUserRole({
          userId: testUser.id,
          newRole: UserRole.ASSET_MANAGER,
          reason: 'E2E测试角色变更'
        })

        expect(roleChangeResult.success).toBe(true)

        // 验证角色已更改
        const updatedUser = await prisma.user.findUnique({
          where: { id: testUser.id },
          select: { role: true }
        })
        expect(updatedUser?.role).toBe(UserRole.ASSET_MANAGER)

        // 验证审计日志
        const auditLogs = await prisma.auditLog.findMany({
          where: {
            userId: user.id,
            action: 'role_changed',
            resource: `user:${testUser.id}`
          }
        })
        expect(auditLogs.length).toBeGreaterThan(0)

      } finally {
        // 清理测试数据
        await prisma.auditLog.deleteMany({
          where: { resource: `user:${testUser.id}` }
        })
        await prisma.user.delete({ where: { id: testUser.id } })
      }
    })

    test('权限拒绝和审计测试', async () => {
      const businessUser = testUsers.businessUser
      const assetManager = testUsers.assetManager

      // 1. 业务用户尝试管理用户（应被拒绝）
      const businessUserCanManageUsers = await PermissionService.hasPermission(
        businessUser.id,
        PERMISSIONS.RESOURCES.USERS,
        PERMISSIONS.ACTIONS.MANAGE
      )
      expect(businessUserCanManageUsers).toBe(false)

      // 2. 资产管理员尝试角色变更（应被拒绝）
      const roleChangeResult = await PermissionService.changeUserRole(
        assetManager.id,
        businessUser.id,
        UserRole.SYSTEM_ADMIN,
        '127.0.0.1',
        'test-agent'
      )
      expect(roleChangeResult.success).toBe(false)
      expect(roleChangeResult.error).toContain('权限不足')

      // 3. 验证拒绝访问的审计日志
      const deniedLogs = await prisma.auditLog.findMany({
        where: {
          userId: assetManager.id,
          action: 'role_change_denied'
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      })
      expect(deniedLogs.length).toBeGreaterThan(0)
    })

    test('数据级权限隔离测试', async () => {
      // 模拟数据级权限检查
      const businessUser = testUsers.businessUser
      const assetManager = testUsers.assetManager

      // 业务用户权限映射
      const businessUserPermissions = await PermissionService.getUserPermissions(businessUser.id)
      expect(businessUserPermissions).toHaveProperty(PERMISSIONS.RESOURCES.ASSETS)
      expect(businessUserPermissions[PERMISSIONS.RESOURCES.ASSETS]).toHaveProperty('read', true)
      expect(businessUserPermissions[PERMISSIONS.RESOURCES.ASSETS]).not.toHaveProperty('write')
      expect(businessUserPermissions[PERMISSIONS.RESOURCES.ASSETS]).not.toHaveProperty('delete')

      // 资产管理员权限映射
      const assetManagerPermissions = await PermissionService.getUserPermissions(assetManager.id)
      expect(assetManagerPermissions).toHaveProperty(PERMISSIONS.RESOURCES.ASSETS)
      expect(assetManagerPermissions[PERMISSIONS.RESOURCES.ASSETS]).toHaveProperty('read', true)
      expect(assetManagerPermissions[PERMISSIONS.RESOURCES.ASSETS]).toHaveProperty('write', true)
      expect(assetManagerPermissions[PERMISSIONS.RESOURCES.ASSETS]).toHaveProperty('delete', true)
      expect(assetManagerPermissions[PERMISSIONS.RESOURCES.ASSETS]).toHaveProperty('manage', true)

      // 但资产管理员不应该有用户管理权限
      expect(assetManagerPermissions).not.toHaveProperty(PERMISSIONS.RESOURCES.USERS)
    })

    test('JWT Token 安全性测试', async () => {
      const user = testUsers.businessUser

      // 1. 有效 token 测试
      const validPayload = AuthService.verifyToken(user.token)
      expect(validPayload).toBeTruthy()
      expect(validPayload?.userId).toBe(user.id)

      // 2. 无效 token 测试
      const invalidPayload = AuthService.verifyToken('invalid-token')
      expect(invalidPayload).toBeNull()

      // 3. 过期 token 测试
      const expiredToken = AuthService.generateToken(user.id, '-1h') // 过期时间为1小时前
      const expiredPayload = AuthService.verifyToken(expiredToken)
      expect(expiredPayload).toBeNull()

      // 4. 篡改 token 测试
      const tamperedToken = user.token.slice(0, -5) + 'xxxxx'
      const tamperedPayload = AuthService.verifyToken(tamperedToken)
      expect(tamperedPayload).toBeNull()
    })
  })

  describe('性能和稳定性测试', () => {
    test('权限检查性能测试', async () => {
      const user = testUsers.businessUser
      const startTime = Date.now()

      // 并发执行多个权限检查
      const promises = []
      for (let i = 0; i < 50; i++) {
        promises.push(
          PermissionService.hasPermission(
            user.id,
            PERMISSIONS.RESOURCES.ASSETS,
            PERMISSIONS.ACTIONS.READ
          )
        )
      }

      const results = await Promise.all(promises)
      const endTime = Date.now()
      const duration = endTime - startTime

      // 所有检查都应该返回 true
      expect(results.every(result => result === true)).toBe(true)

      // 50个权限检查应该在2秒内完成
      expect(duration).toBeLessThan(2000)
    })

    test('错误恢复测试', async () => {
      // 测试不存在的用户
      const nonExistentResult = await PermissionService.hasPermission(
        'non-existent-user',
        PERMISSIONS.RESOURCES.ASSETS,
        PERMISSIONS.ACTIONS.READ
      )
      expect(nonExistentResult).toBe(false)

      // 测试错误的资源名称
      const invalidResourceResult = await PermissionService.hasPermission(
        testUsers.businessUser.id,
        'invalid-resource',
        PERMISSIONS.ACTIONS.READ
      )
      expect(invalidResourceResult).toBe(false)

      // 测试错误的操作名称
      const invalidActionResult = await PermissionService.hasPermission(
        testUsers.businessUser.id,
        PERMISSIONS.RESOURCES.ASSETS,
        'invalid-action'
      )
      expect(invalidActionResult).toBe(false)
    })
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})