/**
 * PermissionService 高级集成测试
 * 测试角色变更、审计日志和数据级权限验证功能
 */

import { PrismaClient, UserRole } from '@prisma/client'
import { PermissionService } from '../permissions'

const prisma = new PrismaClient()

describe('PermissionService 高级功能测试', () => {
  let testUsers: {
    businessUser: { id: string }
    assetManager: { id: string }
    systemAdmin: { id: string }
  }

  beforeAll(async () => {
    // 获取现有的测试用户
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

    testUsers = { businessUser, assetManager, systemAdmin }
  })

  describe('角色变更功能', () => {
    test('系统管理员应该能够更改用户角色', async () => {
      // 创建一个测试用户
      const testUser = await prisma.user.create({
        data: {
          username: 'test_role_change',
          email: 'test_role_change@example.com',
          passwordHash: 'test_hash',
          name: '角色变更测试用户',
          role: UserRole.BUSINESS_USER
        }
      })

      try {
        // 系统管理员更改用户角色
        const result = await PermissionService.changeUserRole(
          testUsers.systemAdmin.id,
          testUser.id,
          UserRole.ASSET_MANAGER,
          '127.0.0.1',
          'jest-test-agent'
        )

        expect(result.success).toBe(true)

        // 验证角色已更改
        const updatedUser = await prisma.user.findUnique({
          where: { id: testUser.id },
          select: { role: true }
        })
        expect(updatedUser?.role).toBe(UserRole.ASSET_MANAGER)

        // 验证审计日志
        const auditLogs = await prisma.auditLog.findMany({
          where: {
            userId: testUsers.systemAdmin.id,
            action: 'role_changed',
            resource: `user:${testUser.id}`
          }
        })
        expect(auditLogs.length).toBeGreaterThan(0)
        expect(auditLogs[0].oldValue).toBe(UserRole.BUSINESS_USER)
        expect(auditLogs[0].newValue).toBe(UserRole.ASSET_MANAGER)
      } finally {
        // 清理测试用户
        await prisma.auditLog.deleteMany({
          where: { resource: `user:${testUser.id}` }
        })
        await prisma.user.delete({ where: { id: testUser.id } })
      }
    })

    test('非系统管理员不应该能够更改用户角色', async () => {
      const result = await PermissionService.changeUserRole(
        testUsers.assetManager.id, // 资产管理员尝试更改角色
        testUsers.businessUser.id,
        UserRole.SYSTEM_ADMIN,
        '127.0.0.1',
        'jest-test-agent'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('权限不足')
    })

    test('应该处理更改不存在用户角色的情况', async () => {
      const result = await PermissionService.changeUserRole(
        testUsers.systemAdmin.id,
        'non-existent-user-id',
        UserRole.ASSET_MANAGER,
        '127.0.0.1',
        'jest-test-agent'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('目标用户不存在')
    })
  })

  describe('审计日志记录功能', () => {
    test('应该正确记录审计日志', async () => {
      const testEvent = {
        userId: testUsers.businessUser.id,
        action: 'test_action',
        resource: 'test_resource',
        oldValue: 'old_value',
        newValue: 'new_value',
        ipAddress: '192.168.1.1',
        userAgent: 'Jest Test Agent',
        metadata: { testKey: 'testValue' }
      }

      await PermissionService.logAuditEvent(testEvent)

      const logs = await prisma.auditLog.findMany({
        where: {
          userId: testUsers.businessUser.id,
          action: 'test_action',
          resource: 'test_resource'
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      })

      expect(logs.length).toBe(1)
      expect(logs[0].oldValue).toBe('old_value')
      expect(logs[0].newValue).toBe('new_value')
      expect(logs[0].ipAddress).toBe('192.168.1.1')
      expect(logs[0].userAgent).toBe('Jest Test Agent')
      expect(logs[0].metadata).toEqual({ testKey: 'testValue' })

      // 清理测试日志
      await prisma.auditLog.deleteMany({
        where: { id: logs[0].id }
      })
    })

    test('应该正确获取用户审计日志', async () => {
      // 记录一些测试日志
      await PermissionService.logAuditEvent({
        userId: testUsers.businessUser.id,
        action: 'test_action_1',
        resource: 'test_resource_1'
      })

      await PermissionService.logAuditEvent({
        userId: testUsers.businessUser.id,
        action: 'test_action_2',
        resource: 'test_resource_2'
      })

      const logs = await PermissionService.getUserAuditLogs(testUsers.businessUser.id, 10, 0)

      expect(logs.length).toBeGreaterThanOrEqual(2)
      expect(logs[0]).toHaveProperty('action')
      expect(logs[0]).toHaveProperty('resource')
      expect(logs[0]).toHaveProperty('createdAt')

      // 清理测试日志
      await prisma.auditLog.deleteMany({
        where: {
          userId: testUsers.businessUser.id,
          action: { in: ['test_action_1', 'test_action_2'] }
        }
      })
    })
  })

  describe('错误处理和边界情况', () => {
    test('权限检查应该安全处理异常情况', async () => {
      // 测试空用户ID
      const result1 = await PermissionService.hasPermission('', 'assets', 'read')
      expect(result1).toBe(false)

      // 测试null用户ID - 这会被转换为字符串'null'
      const result2 = await PermissionService.hasPermission('null', 'assets', 'read')
      expect(result2).toBe(false)
    })

    test('角色检查应该处理不存在的用户', async () => {
      const result1 = await PermissionService.hasRole('non-existent-user', UserRole.BUSINESS_USER)
      expect(result1).toBe(false)

      const result2 = await PermissionService.isAdmin('non-existent-user')
      expect(result2).toBe(false)
    })

    test('getUserPermissions 应该处理不存在的用户', async () => {
      const permissions = await PermissionService.getUserPermissions('non-existent-user')
      expect(permissions).toEqual({})
    })
  })

  describe('数据级权限验证模拟', () => {
    test('应该能够模拟基于角色的数据访问控制', async () => {
      // 模拟数据级权限检查逻辑
      const mockAssetId = 'asset-123'

      // 业务用户只能读取公开资产
      const businessUserCanRead = await PermissionService.hasPermission(
        testUsers.businessUser.id,
        'assets',
        'read'
      )
      expect(businessUserCanRead).toBe(true)

      // 资产管理员可以管理所有资产
      const assetManagerCanManage = await PermissionService.hasPermission(
        testUsers.assetManager.id,
        'assets',
        'manage'
      )
      expect(assetManagerCanManage).toBe(true)

      // 系统管理员有全部权限
      const systemAdminCanManage = await PermissionService.hasPermission(
        testUsers.systemAdmin.id,
        'assets',
        'manage'
      )
      expect(systemAdminCanManage).toBe(true)
    })
  })

  describe('权限系统性能测试', () => {
    test('权限检查应该具有合理的性能', async () => {
      const startTime = Date.now()

      // 执行多次权限检查
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(
          PermissionService.hasPermission(
            testUsers.businessUser.id,
            'assets',
            'read'
          )
        )
      }

      await Promise.all(promises)

      const endTime = Date.now()
      const duration = endTime - startTime

      // 10次权限检查应该在1秒内完成
      expect(duration).toBeLessThan(1000)
    })
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})