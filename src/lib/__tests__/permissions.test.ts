import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals'
import { PrismaClient, UserRole } from '@prisma/client'
import { PermissionService, PERMISSIONS } from '../permissions'

// 为测试创建独立的数据库连接
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test.db'
    }
  }
})

describe('PermissionService 集成测试', () => {
  let testUsers: {
    businessUser: { id: string }
    assetManager: { id: string }
    systemAdmin: { id: string }
  }

  beforeEach(async () => {
    // 清理测试数据库
    await prisma.auditLog.deleteMany()
    await prisma.permission.deleteMany()
    await prisma.user.deleteMany()

    // 创建测试用户
    const businessUser = await prisma.user.create({
      data: {
        username: 'test_business_user',
        email: 'test_business@example.com',
        passwordHash: 'test_hash',
        name: '测试业务用户',
        role: UserRole.BUSINESS_USER
      }
    })

    const assetManager = await prisma.user.create({
      data: {
        username: 'test_asset_manager',
        email: 'test_manager@example.com',
        passwordHash: 'test_hash',
        name: '测试资产管理员',
        role: UserRole.ASSET_MANAGER
      }
    })

    const systemAdmin = await prisma.user.create({
      data: {
        username: 'test_system_admin',
        email: 'test_admin@example.com',
        passwordHash: 'test_hash',
        name: '测试系统管理员',
        role: UserRole.SYSTEM_ADMIN
      }
    })

    testUsers = { businessUser, assetManager, systemAdmin }

    // 创建测试权限配置
    const permissions = [
      // 业务用户权限
      { resource: PERMISSIONS.RESOURCES.ASSETS, action: PERMISSIONS.ACTIONS.READ, role: UserRole.BUSINESS_USER },
      { resource: PERMISSIONS.RESOURCES.APPLICATIONS, action: PERMISSIONS.ACTIONS.READ, role: UserRole.BUSINESS_USER },
      { resource: PERMISSIONS.RESOURCES.APPLICATIONS, action: PERMISSIONS.ACTIONS.WRITE, role: UserRole.BUSINESS_USER },

      // 资产管理员权限
      { resource: PERMISSIONS.RESOURCES.ASSETS, action: PERMISSIONS.ACTIONS.READ, role: UserRole.ASSET_MANAGER },
      { resource: PERMISSIONS.RESOURCES.ASSETS, action: PERMISSIONS.ACTIONS.WRITE, role: UserRole.ASSET_MANAGER },
      { resource: PERMISSIONS.RESOURCES.ASSETS, action: PERMISSIONS.ACTIONS.DELETE, role: UserRole.ASSET_MANAGER },
      { resource: PERMISSIONS.RESOURCES.ASSETS, action: PERMISSIONS.ACTIONS.MANAGE, role: UserRole.ASSET_MANAGER },
      { resource: PERMISSIONS.RESOURCES.APPLICATIONS, action: PERMISSIONS.ACTIONS.READ, role: UserRole.ASSET_MANAGER },
      { resource: PERMISSIONS.RESOURCES.APPLICATIONS, action: PERMISSIONS.ACTIONS.WRITE, role: UserRole.ASSET_MANAGER },
      { resource: PERMISSIONS.RESOURCES.APPLICATIONS, action: PERMISSIONS.ACTIONS.MANAGE, role: UserRole.ASSET_MANAGER },

      // 系统管理员权限
      { resource: PERMISSIONS.RESOURCES.ASSETS, action: PERMISSIONS.ACTIONS.READ, role: UserRole.SYSTEM_ADMIN },
      { resource: PERMISSIONS.RESOURCES.ASSETS, action: PERMISSIONS.ACTIONS.WRITE, role: UserRole.SYSTEM_ADMIN },
      { resource: PERMISSIONS.RESOURCES.ASSETS, action: PERMISSIONS.ACTIONS.DELETE, role: UserRole.SYSTEM_ADMIN },
      { resource: PERMISSIONS.RESOURCES.ASSETS, action: PERMISSIONS.ACTIONS.MANAGE, role: UserRole.SYSTEM_ADMIN },
      { resource: PERMISSIONS.RESOURCES.APPLICATIONS, action: PERMISSIONS.ACTIONS.READ, role: UserRole.SYSTEM_ADMIN },
      { resource: PERMISSIONS.RESOURCES.APPLICATIONS, action: PERMISSIONS.ACTIONS.WRITE, role: UserRole.SYSTEM_ADMIN },
      { resource: PERMISSIONS.RESOURCES.APPLICATIONS, action: PERMISSIONS.ACTIONS.MANAGE, role: UserRole.SYSTEM_ADMIN },
      { resource: PERMISSIONS.RESOURCES.USERS, action: PERMISSIONS.ACTIONS.READ, role: UserRole.SYSTEM_ADMIN },
      { resource: PERMISSIONS.RESOURCES.USERS, action: PERMISSIONS.ACTIONS.WRITE, role: UserRole.SYSTEM_ADMIN },
      { resource: PERMISSIONS.RESOURCES.USERS, action: PERMISSIONS.ACTIONS.MANAGE, role: UserRole.SYSTEM_ADMIN },
      { resource: PERMISSIONS.RESOURCES.ADMIN, action: PERMISSIONS.ACTIONS.READ, role: UserRole.SYSTEM_ADMIN },
      { resource: PERMISSIONS.RESOURCES.ADMIN, action: PERMISSIONS.ACTIONS.WRITE, role: UserRole.SYSTEM_ADMIN },
      { resource: PERMISSIONS.RESOURCES.ADMIN, action: PERMISSIONS.ACTIONS.MANAGE, role: UserRole.SYSTEM_ADMIN },
    ]

    for (const permission of permissions) {
      await prisma.permission.create({ data: permission })
    }
  })

  afterEach(async () => {
    // 清理测试数据
    await prisma.auditLog.deleteMany()
    await prisma.permission.deleteMany()
    await prisma.user.deleteMany()
  })

  describe('hasPermission 权限检查核心逻辑', () => {
    it('应该正确验证业务用户的读取权限', async () => {
      const result = await PermissionService.hasPermission(
        testUsers.businessUser.id,
        PERMISSIONS.RESOURCES.ASSETS,
        PERMISSIONS.ACTIONS.READ
      )
      expect(result).toBe(true)
    })

    it('应该拒绝业务用户的写入权限', async () => {
      const result = await PermissionService.hasPermission(
        testUsers.businessUser.id,
        PERMISSIONS.RESOURCES.ASSETS,
        PERMISSIONS.ACTIONS.WRITE
      )
      expect(result).toBe(false)
    })

    it('应该正确验证资产管理员的所有资产权限', async () => {
      const readResult = await PermissionService.hasPermission(
        testUsers.assetManager.id,
        PERMISSIONS.RESOURCES.ASSETS,
        PERMISSIONS.ACTIONS.READ
      )
      const writeResult = await PermissionService.hasPermission(
        testUsers.assetManager.id,
        PERMISSIONS.RESOURCES.ASSETS,
        PERMISSIONS.ACTIONS.WRITE
      )
      const deleteResult = await PermissionService.hasPermission(
        testUsers.assetManager.id,
        PERMISSIONS.RESOURCES.ASSETS,
        PERMISSIONS.ACTIONS.DELETE
      )
      const manageResult = await PermissionService.hasPermission(
        testUsers.assetManager.id,
        PERMISSIONS.RESOURCES.ASSETS,
        PERMISSIONS.ACTIONS.MANAGE
      )

      expect(readResult).toBe(true)
      expect(writeResult).toBe(true)
      expect(deleteResult).toBe(true)
      expect(manageResult).toBe(true)
    })

    it('应该拒绝资产管理员的用户管理权限', async () => {
      const result = await PermissionService.hasPermission(
        testUsers.assetManager.id,
        PERMISSIONS.RESOURCES.USERS,
        PERMISSIONS.ACTIONS.MANAGE
      )
      expect(result).toBe(false)
    })

    it('应该验证系统管理员拥有所有权限', async () => {
      const assetsRead = await PermissionService.hasPermission(
        testUsers.systemAdmin.id,
        PERMISSIONS.RESOURCES.ASSETS,
        PERMISSIONS.ACTIONS.READ
      )
      const usersManage = await PermissionService.hasPermission(
        testUsers.systemAdmin.id,
        PERMISSIONS.RESOURCES.USERS,
        PERMISSIONS.ACTIONS.MANAGE
      )
      const adminAccess = await PermissionService.hasPermission(
        testUsers.systemAdmin.id,
        PERMISSIONS.RESOURCES.ADMIN,
        PERMISSIONS.ACTIONS.READ
      )

      expect(assetsRead).toBe(true)
      expect(usersManage).toBe(true)
      expect(adminAccess).toBe(true)
    })

    it('应该处理不存在的用户', async () => {
      const result = await PermissionService.hasPermission(
        'non-existent-user-id',
        PERMISSIONS.RESOURCES.ASSETS,
        PERMISSIONS.ACTIONS.READ
      )
      expect(result).toBe(false)
    })
  })

  describe('getUserPermissions 角色权限映射', () => {
    it('应该返回业务用户的权限映射', async () => {
      const permissions = await PermissionService.getUserPermissions(testUsers.businessUser.id)

      expect(permissions).toHaveProperty(PERMISSIONS.RESOURCES.ASSETS)
      expect(permissions[PERMISSIONS.RESOURCES.ASSETS]).toHaveProperty(PERMISSIONS.ACTIONS.READ, true)
      expect(permissions[PERMISSIONS.RESOURCES.ASSETS]).not.toHaveProperty(PERMISSIONS.ACTIONS.WRITE)

      expect(permissions).toHaveProperty(PERMISSIONS.RESOURCES.APPLICATIONS)
      expect(permissions[PERMISSIONS.RESOURCES.APPLICATIONS]).toHaveProperty(PERMISSIONS.ACTIONS.READ, true)
      expect(permissions[PERMISSIONS.RESOURCES.APPLICATIONS]).toHaveProperty(PERMISSIONS.ACTIONS.WRITE, true)
    })

    it('应该返回资产管理员的完整权限映射', async () => {
      const permissions = await PermissionService.getUserPermissions(testUsers.assetManager.id)

      expect(permissions).toHaveProperty(PERMISSIONS.RESOURCES.ASSETS)
      expect(permissions[PERMISSIONS.RESOURCES.ASSETS]).toHaveProperty(PERMISSIONS.ACTIONS.READ, true)
      expect(permissions[PERMISSIONS.RESOURCES.ASSETS]).toHaveProperty(PERMISSIONS.ACTIONS.WRITE, true)
      expect(permissions[PERMISSIONS.RESOURCES.ASSETS]).toHaveProperty(PERMISSIONS.ACTIONS.DELETE, true)
      expect(permissions[PERMISSIONS.RESOURCES.ASSETS]).toHaveProperty(PERMISSIONS.ACTIONS.MANAGE, true)
    })

    it('应该处理不存在的用户', async () => {
      const permissions = await PermissionService.getUserPermissions('non-existent-user-id')
      expect(permissions).toEqual({})
    })
  })

  describe('角色检查功能', () => {
    it('应该正确验证用户角色', async () => {
      const isBusinessUser = await PermissionService.hasRole(testUsers.businessUser.id, UserRole.BUSINESS_USER)
      const isNotAdmin = await PermissionService.hasRole(testUsers.businessUser.id, UserRole.SYSTEM_ADMIN)

      expect(isBusinessUser).toBe(true)
      expect(isNotAdmin).toBe(false)
    })

    it('应该正确识别管理员角色', async () => {
      const assetManagerIsAdmin = await PermissionService.isAdmin(testUsers.assetManager.id)
      const systemAdminIsAdmin = await PermissionService.isAdmin(testUsers.systemAdmin.id)
      const businessUserIsAdmin = await PermissionService.isAdmin(testUsers.businessUser.id)

      expect(assetManagerIsAdmin).toBe(true)
      expect(systemAdminIsAdmin).toBe(true)
      expect(businessUserIsAdmin).toBe(false)
    })
  })

  describe('角色变更功能', () => {
    it('应该允许系统管理员更改用户角色', async () => {
      const result = await PermissionService.changeUserRole(
        testUsers.systemAdmin.id,
        testUsers.businessUser.id,
        UserRole.ASSET_MANAGER,
        '127.0.0.1',
        'test-agent'
      )

      expect(result.success).toBe(true)

      // 验证角色已更改
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUsers.businessUser.id },
        select: { role: true }
      })
      expect(updatedUser?.role).toBe(UserRole.ASSET_MANAGER)
    })

    it('应该拒绝非系统管理员的角色变更请求', async () => {
      const result = await PermissionService.changeUserRole(
        testUsers.assetManager.id, // 资产管理员尝试更改角色
        testUsers.businessUser.id,
        UserRole.SYSTEM_ADMIN,
        '127.0.0.1',
        'test-agent'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('权限不足')
    })

    it('应该处理目标用户不存在的情况', async () => {
      const result = await PermissionService.changeUserRole(
        testUsers.systemAdmin.id,
        'non-existent-user-id',
        UserRole.ASSET_MANAGER,
        '127.0.0.1',
        'test-agent'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('目标用户不存在')
    })
  })

  describe('审计日志功能', () => {
    it('应该记录权限检查审计日志', async () => {
      await PermissionService.hasPermission(
        testUsers.businessUser.id,
        PERMISSIONS.RESOURCES.ASSETS,
        PERMISSIONS.ACTIONS.READ
      )

      const auditLogs = await prisma.auditLog.findMany({
        where: { userId: testUsers.businessUser.id }
      })

      expect(auditLogs.length).toBeGreaterThan(0)
      expect(auditLogs[0].action).toBe('permission_checked')
      expect(auditLogs[0].resource).toBe(`${PERMISSIONS.RESOURCES.ASSETS}:${PERMISSIONS.ACTIONS.READ}`)
    })

    it('应该记录角色变更审计日志', async () => {
      await PermissionService.changeUserRole(
        testUsers.systemAdmin.id,
        testUsers.businessUser.id,
        UserRole.ASSET_MANAGER,
        '127.0.0.1',
        'test-agent'
      )

      const auditLogs = await prisma.auditLog.findMany({
        where: {
          userId: testUsers.systemAdmin.id,
          action: 'role_changed'
        }
      })

      expect(auditLogs.length).toBe(1)
      expect(auditLogs[0].oldValue).toBe(UserRole.BUSINESS_USER)
      expect(auditLogs[0].newValue).toBe(UserRole.ASSET_MANAGER)
    })

    it('应该正确获取用户审计日志', async () => {
      // 生成一些审计日志
      await PermissionService.hasPermission(
        testUsers.businessUser.id,
        PERMISSIONS.RESOURCES.ASSETS,
        PERMISSIONS.ACTIONS.READ
      )

      const logs = await PermissionService.getUserAuditLogs(testUsers.businessUser.id, 10, 0)

      expect(logs.length).toBeGreaterThan(0)
      expect(logs[0]).toHaveProperty('action')
      expect(logs[0]).toHaveProperty('resource')
      expect(logs[0]).toHaveProperty('createdAt')
    })
  })

  describe('错误处理', () => {
    it('应该安全处理数据库连接错误', async () => {
      // 这里我们可以模拟数据库错误，但在实际测试中可能需要更复杂的mock
      const result = await PermissionService.hasPermission(
        '', // 空用户ID会触发错误处理
        PERMISSIONS.RESOURCES.ASSETS,
        PERMISSIONS.ACTIONS.READ
      )
      expect(result).toBe(false) // 错误时应默认拒绝
    })
  })
})

// 运行测试后清理
afterAll(async () => {
  await prisma.$disconnect()
})