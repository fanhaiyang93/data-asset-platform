import { PrismaClient, UserRole } from '@prisma/client'
import { SSOProviderConfig } from './ssoConfig'

const prisma = new PrismaClient()

export interface SSOUserAttributes {
  email: string
  name?: string
  department?: string
  title?: string
  groups?: string[]
  roles?: string[]
  customAttributes?: Record<string, any>
}

export interface RoleMappingRule {
  id: string
  providerId: string
  condition: {
    attribute: string
    operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'regex'
    value: string | string[]
  }
  targetRole: UserRole
  priority: number
  description?: string
  isActive: boolean
}

export interface UserSyncResult {
  userId: string
  action: 'created' | 'updated' | 'noChange'
  oldRole?: UserRole
  newRole: UserRole
  attributes: Record<string, any>
  errors?: string[]
}

export class SSORoleMappingService {
  /**
   * 根据SSO属性映射用户角色
   */
  static async mapUserRole(
    providerId: string,
    userAttributes: SSOUserAttributes
  ): Promise<UserRole> {
    try {
      // 获取提供商的角色映射配置
      const provider = await prisma.sSOProvider.findUnique({
        where: { id: providerId }
      })

      if (!provider || !provider.roleMapping) {
        return 'BUSINESS_USER' // 默认角色
      }

      const roleMapping = provider.roleMapping as Record<string, string>

      // 检查自定义角色映射规则
      const mappingRules = await this.getRoleMappingRules(providerId)

      for (const rule of mappingRules) {
        if (this.evaluateCondition(rule.condition, userAttributes)) {
          return rule.targetRole
        }
      }

      // 检查提供商配置的简单角色映射
      for (const [ssoRole, systemRole] of Object.entries(roleMapping)) {
        if (this.hasRole(userAttributes, ssoRole)) {
          return this.parseSystemRole(systemRole)
        }
      }

      // 基于部门的角色映射
      const departmentRole = this.mapByDepartment(userAttributes.department)
      if (departmentRole) {
        return departmentRole
      }

      // 基于邮箱域名的角色映射
      const domainRole = this.mapByEmailDomain(userAttributes.email)
      if (domainRole) {
        return domainRole
      }

      return 'BUSINESS_USER' // 默认角色
    } catch (error) {
      console.error('Role mapping error:', error)
      return 'BUSINESS_USER'
    }
  }

  /**
   * 同步SSO用户信息
   */
  static async syncUser(
    providerId: string,
    ssoId: string,
    userAttributes: SSOUserAttributes
  ): Promise<UserSyncResult> {
    try {
      // 查找现有用户
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: userAttributes.email },
            { ssoProvider: providerId, ssoId }
          ]
        }
      })

      const mappedRole = await this.mapUserRole(providerId, userAttributes)
      const oldRole = user?.role as UserRole

      const userData = {
        email: userAttributes.email,
        name: userAttributes.name || userAttributes.email.split('@')[0],
        department: userAttributes.department,
        role: mappedRole,
        ssoProvider: providerId,
        ssoId,
        lastLoginAt: new Date()
      }

      let action: 'created' | 'updated' | 'noChange' = 'noChange'

      if (!user) {
        // 创建新用户
        user = await prisma.user.create({
          data: {
            ...userData,
            username: userAttributes.email,
            passwordHash: '', // SSO用户不需要密码
          }
        })
        action = 'created'
      } else {
        // 更新现有用户
        const needsUpdate =
          user.name !== userData.name ||
          user.department !== userData.department ||
          user.role !== userData.role ||
          user.ssoProvider !== userData.ssoProvider ||
          user.ssoId !== userData.ssoId

        if (needsUpdate) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: userData
          })
          action = 'updated'
        } else {
          // 只更新最后登录时间
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
          })
        }
      }

      // 记录同步日志
      await this.logUserSync(providerId, user.id, userAttributes, action, oldRole, mappedRole)

      return {
        userId: user.id,
        action,
        oldRole,
        newRole: mappedRole,
        attributes: userAttributes
      }
    } catch (error) {
      console.error('User sync error:', error)
      throw new Error('Failed to sync user')
    }
  }

  /**
   * 批量同步用户
   */
  static async bulkSyncUsers(
    providerId: string,
    users: Array<{ ssoId: string; attributes: SSOUserAttributes }>
  ): Promise<UserSyncResult[]> {
    const results: UserSyncResult[] = []

    for (const userData of users) {
      try {
        const result = await this.syncUser(providerId, userData.ssoId, userData.attributes)
        results.push(result)
      } catch (error) {
        results.push({
          userId: '',
          action: 'noChange',
          newRole: 'BUSINESS_USER',
          attributes: userData.attributes,
          errors: [error instanceof Error ? error.message : 'Unknown error']
        })
      }
    }

    return results
  }

  /**
   * 获取角色映射规则
   */
  static async getRoleMappingRules(providerId: string): Promise<RoleMappingRule[]> {
    // 注意：这里应该从数据库获取规则，暂时返回示例规则
    return [
      {
        id: '1',
        providerId,
        condition: {
          attribute: 'groups',
          operator: 'contains',
          value: 'admin'
        },
        targetRole: 'SYSTEM_ADMIN',
        priority: 1,
        description: '管理员组用户映射为系统管理员',
        isActive: true
      },
      {
        id: '2',
        providerId,
        condition: {
          attribute: 'department',
          operator: 'equals',
          value: 'IT'
        },
        targetRole: 'DATA_ADMIN',
        priority: 2,
        description: 'IT部门用户映射为数据管理员',
        isActive: true
      }
    ]
  }

  /**
   * 创建角色映射规则
   */
  static async createRoleMappingRule(rule: Omit<RoleMappingRule, 'id'>): Promise<RoleMappingRule> {
    // 注意：这里应该保存到数据库
    const newRule: RoleMappingRule = {
      ...rule,
      id: `rule_${Date.now()}`
    }

    return newRule
  }

  /**
   * 更新角色映射规则
   */
  static async updateRoleMappingRule(id: string, updates: Partial<RoleMappingRule>): Promise<RoleMappingRule> {
    // 注意：这里应该更新数据库中的规则
    const existingRules = await this.getRoleMappingRules(updates.providerId || '')
    const rule = existingRules.find(r => r.id === id)

    if (!rule) {
      throw new Error('Rule not found')
    }

    return { ...rule, ...updates }
  }

  /**
   * 删除角色映射规则
   */
  static async deleteRoleMappingRule(id: string): Promise<boolean> {
    // 注意：这里应该从数据库删除规则
    return true
  }

  /**
   * 评估条件是否匹配
   */
  private static evaluateCondition(
    condition: RoleMappingRule['condition'],
    attributes: SSOUserAttributes
  ): boolean {
    const value = this.getAttributeValue(attributes, condition.attribute)

    if (value === undefined || value === null) {
      return false
    }

    switch (condition.operator) {
      case 'equals':
        return String(value).toLowerCase() === String(condition.value).toLowerCase()

      case 'contains':
        if (Array.isArray(value)) {
          return Array.isArray(condition.value)
            ? condition.value.some(v => value.includes(v))
            : value.includes(String(condition.value))
        }
        return String(value).toLowerCase().includes(String(condition.value).toLowerCase())

      case 'startsWith':
        return String(value).toLowerCase().startsWith(String(condition.value).toLowerCase())

      case 'endsWith':
        return String(value).toLowerCase().endsWith(String(condition.value).toLowerCase())

      case 'in':
        if (!Array.isArray(condition.value)) {
          return false
        }
        return condition.value.includes(String(value))

      case 'regex':
        try {
          const regex = new RegExp(String(condition.value), 'i')
          return regex.test(String(value))
        } catch {
          return false
        }

      default:
        return false
    }
  }

  /**
   * 获取属性值
   */
  private static getAttributeValue(attributes: SSOUserAttributes, path: string): any {
    const keys = path.split('.')
    let value: any = attributes

    for (const key of keys) {
      if (value === null || value === undefined) {
        return undefined
      }
      value = value[key]
    }

    return value
  }

  /**
   * 检查用户是否具有指定角色
   */
  private static hasRole(attributes: SSOUserAttributes, role: string): boolean {
    if (attributes.roles?.includes(role)) {
      return true
    }

    if (attributes.groups?.some(group =>
      group.toLowerCase().includes(role.toLowerCase())
    )) {
      return true
    }

    return false
  }

  /**
   * 解析系统角色
   */
  private static parseSystemRole(roleString: string): UserRole {
    const roleMap: Record<string, UserRole> = {
      'SYSTEM_ADMIN': 'SYSTEM_ADMIN',
      'DATA_ADMIN': 'DATA_ADMIN',
      'BUSINESS_USER': 'BUSINESS_USER'
    }

    return roleMap[roleString.toUpperCase()] || 'BUSINESS_USER'
  }

  /**
   * 基于部门映射角色
   */
  private static mapByDepartment(department?: string): UserRole | null {
    if (!department) return null

    const departmentMap: Record<string, UserRole> = {
      'IT': 'DATA_ADMIN',
      'TECHNOLOGY': 'DATA_ADMIN',
      'ENGINEERING': 'DATA_ADMIN',
      'ADMIN': 'SYSTEM_ADMIN',
      'MANAGEMENT': 'SYSTEM_ADMIN'
    }

    return departmentMap[department.toUpperCase()] || null
  }

  /**
   * 基于邮箱域名映射角色
   */
  private static mapByEmailDomain(email: string): UserRole | null {
    const domain = email.split('@')[1]

    if (domain) {
      // 内部域名的用户可能有更高权限
      const internalDomains = ['admin.company.com', 'it.company.com']
      if (internalDomains.includes(domain.toLowerCase())) {
        return 'DATA_ADMIN'
      }
    }

    return null
  }

  /**
   * 记录用户同步日志
   */
  private static async logUserSync(
    providerId: string,
    userId: string,
    attributes: SSOUserAttributes,
    action: string,
    oldRole?: UserRole,
    newRole?: UserRole
  ) {
    try {
      const metadata = {
        action,
        oldRole,
        newRole,
        attributes,
        syncedAt: new Date().toISOString()
      }

      // 使用SSO日志系统记录
      await prisma.sSOLog.create({
        data: {
          providerId,
          userId,
          email: attributes.email,
          action: 'user_sync',
          status: 'success',
          message: `User ${action}: ${attributes.email}`,
          metadata: JSON.stringify(metadata)
        }
      })
    } catch (error) {
      console.error('Failed to log user sync:', error)
    }
  }

  /**
   * 获取用户权限统计
   */
  static async getUserPermissionStats(providerId?: string) {
    const where = providerId ? { ssoProvider: providerId } : {}

    const [total, byRole] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.groupBy({
        by: ['role'],
        where,
        _count: { id: true }
      })
    ])

    return {
      total,
      byRole: byRole.map(item => ({
        role: item.role,
        count: item._count.id
      }))
    }
  }

  /**
   * 获取最近的用户同步活动
   */
  static async getRecentSyncActivity(providerId: string, limit: number = 50) {
    return await prisma.sSOLog.findMany({
      where: {
        providerId,
        action: 'user_sync'
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        provider: {
          select: { name: true, type: true }
        }
      }
    })
  }
}