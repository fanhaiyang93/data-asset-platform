/**
 * PermissionService 基础集成测试
 * 测试权限检查核心逻辑和角色权限映射功能
 */

import { PrismaClient, UserRole } from '@prisma/client'
import { PermissionService, PERMISSIONS } from '../permissions'

const prisma = new PrismaClient()

describe('PermissionService 基础功能测试', () => {
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

  describe('权限检查核心逻辑', () => {
    test('业务用户应该有资产读取权限', async () => {
      const result = await PermissionService.hasPermission(
        testUsers.businessUser.id,
        PERMISSIONS.RESOURCES.ASSETS,
        PERMISSIONS.ACTIONS.READ
      )
      expect(result).toBe(true)
    })

    test('业务用户不应该有资产写入权限', async () => {
      const result = await PermissionService.hasPermission(
        testUsers.businessUser.id,
        PERMISSIONS.RESOURCES.ASSETS,
        PERMISSIONS.ACTIONS.WRITE
      )
      expect(result).toBe(false)
    })

    test('资产管理员应该有所有资产权限', async () => {
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

      expect(readResult).toBe(true)
      expect(writeResult).toBe(true)
      expect(deleteResult).toBe(true)
    })

    test('系统管理员应该有用户管理权限', async () => {
      const result = await PermissionService.hasPermission(
        testUsers.systemAdmin.id,
        PERMISSIONS.RESOURCES.USERS,
        PERMISSIONS.ACTIONS.MANAGE
      )
      expect(result).toBe(true)
    })

    test('不存在的用户应该被拒绝访问', async () => {
      const result = await PermissionService.hasPermission(
        'non-existent-user',
        PERMISSIONS.RESOURCES.ASSETS,
        PERMISSIONS.ACTIONS.READ
      )
      expect(result).toBe(false)
    })
  })

  describe('角色检查功能', () => {
    test('应该正确识别用户角色', async () => {
      const isBusinessUser = await PermissionService.hasRole(
        testUsers.businessUser.id,
        UserRole.BUSINESS_USER
      )
      const isNotAdmin = await PermissionService.hasRole(
        testUsers.businessUser.id,
        UserRole.SYSTEM_ADMIN
      )

      expect(isBusinessUser).toBe(true)
      expect(isNotAdmin).toBe(false)
    })

    test('应该正确识别管理员', async () => {
      const assetManagerIsAdmin = await PermissionService.isAdmin(testUsers.assetManager.id)
      const systemAdminIsAdmin = await PermissionService.isAdmin(testUsers.systemAdmin.id)
      const businessUserIsAdmin = await PermissionService.isAdmin(testUsers.businessUser.id)

      expect(assetManagerIsAdmin).toBe(true)
      expect(systemAdminIsAdmin).toBe(true)
      expect(businessUserIsAdmin).toBe(false)
    })
  })

  describe('用户权限映射', () => {
    test('应该返回正确的业务用户权限映射', async () => {
      const permissions = await PermissionService.getUserPermissions(testUsers.businessUser.id)

      expect(permissions).toHaveProperty(PERMISSIONS.RESOURCES.ASSETS)
      expect(permissions[PERMISSIONS.RESOURCES.ASSETS]).toHaveProperty('read', true)
      expect(permissions[PERMISSIONS.RESOURCES.ASSETS]).not.toHaveProperty('write')

      expect(permissions).toHaveProperty(PERMISSIONS.RESOURCES.APPLICATIONS)
      expect(permissions[PERMISSIONS.RESOURCES.APPLICATIONS]).toHaveProperty('read', true)
      expect(permissions[PERMISSIONS.RESOURCES.APPLICATIONS]).toHaveProperty('write', true)
    })

    test('应该返回系统管理员的全部权限', async () => {
      const permissions = await PermissionService.getUserPermissions(testUsers.systemAdmin.id)

      // 检查是否有用户管理权限（只有系统管理员才有）
      expect(permissions).toHaveProperty(PERMISSIONS.RESOURCES.USERS)
      expect(permissions[PERMISSIONS.RESOURCES.USERS]).toHaveProperty('read', true)
      expect(permissions[PERMISSIONS.RESOURCES.USERS]).toHaveProperty('write', true)
      expect(permissions[PERMISSIONS.RESOURCES.USERS]).toHaveProperty('manage', true)
    })
  })

  describe('审计日志功能验证', () => {
    test('权限检查应该记录审计日志', async () => {
      // 执行权限检查
      await PermissionService.hasPermission(
        testUsers.businessUser.id,
        PERMISSIONS.RESOURCES.ASSETS,
        PERMISSIONS.ACTIONS.READ
      )

      // 检查是否记录了审计日志
      const logs = await prisma.auditLog.findMany({
        where: {
          userId: testUsers.businessUser.id,
          action: 'permission_checked'
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      })

      expect(logs.length).toBeGreaterThan(0)
      expect(logs[0].resource).toBe(`${PERMISSIONS.RESOURCES.ASSETS}:${PERMISSIONS.ACTIONS.READ}`)
    })
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})