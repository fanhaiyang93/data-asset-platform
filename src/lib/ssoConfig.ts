import { PrismaClient, SSOProviderType, SSOProviderStatus } from '@prisma/client'
import { encrypt, decrypt, validateCertificate, validatePrivateKey, validateUrl } from './encryption'

const prisma = new PrismaClient()

export interface SSOProviderConfig {
  id?: string
  name: string
  type: SSOProviderType
  status: SSOProviderStatus

  // 基础配置
  entityId?: string
  ssoUrl?: string
  sloUrl?: string
  certificateData?: string
  privateKeyData?: string

  // OAuth专用
  clientSecret?: string
  scopes?: string[]
  userInfoUrl?: string

  // LDAP专用
  ldapUrl?: string
  baseDn?: string
  bindDn?: string
  bindPassword?: string
  userFilter?: string

  // 属性映射
  attributeMapping?: Record<string, string>
  roleMapping?: Record<string, string>

  // 高级配置
  autoProvision?: boolean
  updateAttributes?: boolean
  enforceSSO?: boolean
}

export class SSOConfigService {
  /**
   * 获取所有SSO提供商
   */
  static async getAllProviders() {
    const providers = await prisma.sSOProvider.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return providers.map(provider => ({
      ...provider,
      // 解密敏感数据用于显示（脱敏）
      certificateData: provider.certificateData ? '[已配置]' : null,
      privateKeyData: provider.privateKeyData ? '[已配置]' : null,
      clientSecret: provider.clientSecret ? '[已配置]' : null,
      bindPassword: provider.bindPassword ? '[已配置]' : null,
      scopes: provider.scopes ? JSON.parse(provider.scopes) : null,
      attributeMapping: provider.attributeMapping as Record<string, string> | null,
      roleMapping: provider.roleMapping as Record<string, string> | null
    }))
  }

  /**
   * 根据ID获取SSO提供商
   */
  static async getProviderById(id: string) {
    const provider = await prisma.sSOProvider.findUnique({
      where: { id }
    })

    if (!provider) {
      return null
    }

    return {
      ...provider,
      // 解密敏感数据
      certificateData: provider.certificateData ? decrypt(provider.certificateData) : null,
      privateKeyData: provider.privateKeyData ? decrypt(provider.privateKeyData) : null,
      clientSecret: provider.clientSecret ? decrypt(provider.clientSecret) : null,
      bindPassword: provider.bindPassword ? decrypt(provider.bindPassword) : null,
      scopes: provider.scopes ? JSON.parse(provider.scopes) : null,
      attributeMapping: provider.attributeMapping as Record<string, string> | null,
      roleMapping: provider.roleMapping as Record<string, string> | null
    }
  }

  /**
   * 创建SSO提供商
   */
  static async createProvider(config: SSOProviderConfig, userId: string) {
    // 验证配置
    await this.validateConfig(config)

    const data: any = {
      name: config.name,
      type: config.type,
      status: config.status,
      entityId: config.entityId,
      ssoUrl: config.ssoUrl,
      sloUrl: config.sloUrl,
      userInfoUrl: config.userInfoUrl,
      ldapUrl: config.ldapUrl,
      baseDn: config.baseDn,
      bindDn: config.bindDn,
      userFilter: config.userFilter,
      autoProvision: config.autoProvision ?? true,
      updateAttributes: config.updateAttributes ?? true,
      enforceSSO: config.enforceSSO ?? false,
      createdBy: userId,
      updatedBy: userId
    }

    // 加密敏感数据
    if (config.certificateData) {
      data.certificateData = encrypt(config.certificateData)
    }
    if (config.privateKeyData) {
      data.privateKeyData = encrypt(config.privateKeyData)
    }
    if (config.clientSecret) {
      data.clientSecret = encrypt(config.clientSecret)
    }
    if (config.bindPassword) {
      data.bindPassword = encrypt(config.bindPassword)
    }

    // 处理JSON字段
    if (config.scopes) {
      data.scopes = JSON.stringify(config.scopes)
    }
    if (config.attributeMapping) {
      data.attributeMapping = config.attributeMapping
    }
    if (config.roleMapping) {
      data.roleMapping = config.roleMapping
    }

    return await prisma.sSOProvider.create({ data })
  }

  /**
   * 更新SSO提供商
   */
  static async updateProvider(id: string, config: SSOProviderConfig, userId: string) {
    // 验证配置
    await this.validateConfig(config)

    const data: any = {
      name: config.name,
      type: config.type,
      status: config.status,
      entityId: config.entityId,
      ssoUrl: config.ssoUrl,
      sloUrl: config.sloUrl,
      userInfoUrl: config.userInfoUrl,
      ldapUrl: config.ldapUrl,
      baseDn: config.baseDn,
      bindDn: config.bindDn,
      userFilter: config.userFilter,
      autoProvision: config.autoProvision,
      updateAttributes: config.updateAttributes,
      enforceSSO: config.enforceSSO,
      updatedBy: userId
    }

    // 加密敏感数据（只有提供时才更新）
    if (config.certificateData) {
      data.certificateData = encrypt(config.certificateData)
    }
    if (config.privateKeyData) {
      data.privateKeyData = encrypt(config.privateKeyData)
    }
    if (config.clientSecret) {
      data.clientSecret = encrypt(config.clientSecret)
    }
    if (config.bindPassword) {
      data.bindPassword = encrypt(config.bindPassword)
    }

    // 处理JSON字段
    if (config.scopes) {
      data.scopes = JSON.stringify(config.scopes)
    }
    if (config.attributeMapping) {
      data.attributeMapping = config.attributeMapping
    }
    if (config.roleMapping) {
      data.roleMapping = config.roleMapping
    }

    return await prisma.sSOProvider.update({
      where: { id },
      data
    })
  }

  /**
   * 删除SSO提供商
   */
  static async deleteProvider(id: string) {
    return await prisma.sSOProvider.delete({
      where: { id }
    })
  }

  /**
   * 测试SSO提供商连接
   */
  static async testProviderConnection(id: string) {
    const provider = await this.getProviderById(id)
    if (!provider) {
      throw new Error('SSO提供商不存在')
    }

    const startTime = Date.now()
    let healthStatus = 'healthy'
    let errorMessage = null

    try {
      // 根据类型进行连接测试
      switch (provider.type) {
        case 'SAML':
          await this.testSAMLConnection(provider)
          break
        case 'OAUTH':
          await this.testOAuthConnection(provider)
          break
        case 'LDAP':
          await this.testLDAPConnection(provider)
          break
        default:
          throw new Error('不支持的SSO类型')
      }
    } catch (error) {
      healthStatus = 'unhealthy'
      errorMessage = error instanceof Error ? error.message : 'Unknown error'
    }

    const responseTime = Date.now() - startTime

    // 更新健康状态
    await prisma.sSOProvider.update({
      where: { id },
      data: {
        lastHealthCheck: new Date(),
        healthStatus,
        errorMessage
      }
    })

    // 记录日志
    await this.logEvent(id, 'health_check', healthStatus === 'healthy' ? 'success' : 'failure', {
      responseTime,
      errorMessage
    })

    return {
      status: healthStatus,
      responseTime,
      errorMessage
    }
  }

  /**
   * 获取提供商统计信息
   */
  static async getProviderStatistics(id: string, days: number = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const logs = await prisma.sSOLog.findMany({
      where: {
        providerId: id,
        createdAt: { gte: startDate }
      }
    })

    const loginLogs = logs.filter(log => log.action === 'login')
    const successfulLogins = loginLogs.filter(log => log.status === 'success')
    const failedLogins = loginLogs.filter(log => log.status === 'failure')

    const avgResponseTime = logs
      .filter(log => log.responseTime !== null)
      .reduce((sum, log) => sum + (log.responseTime || 0), 0) / logs.length || 0

    return {
      totalLogins: loginLogs.length,
      successfulLogins: successfulLogins.length,
      failedLogins: failedLogins.length,
      successRate: loginLogs.length > 0 ? (successfulLogins.length / loginLogs.length) * 100 : 0,
      averageResponseTime: Math.round(avgResponseTime),
      totalEvents: logs.length
    }
  }

  /**
   * 记录SSO事件
   */
  static async logEvent(
    providerId: string,
    action: string,
    status: string,
    metadata?: any,
    userId?: string,
    email?: string
  ) {
    return await prisma.sSOLog.create({
      data: {
        providerId,
        userId,
        email,
        action,
        status,
        message: metadata?.message,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        sessionId: metadata?.sessionId,
        responseTime: metadata?.responseTime,
        errorCode: metadata?.errorCode,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    })
  }

  /**
   * 验证配置
   */
  private static async validateConfig(config: SSOProviderConfig) {
    const errors: string[] = []

    // 基础验证
    if (!config.name?.trim()) {
      errors.push('提供商名称不能为空')
    }

    if (!config.type) {
      errors.push('提供商类型不能为空')
    }

    // 检查名称唯一性
    if (config.name) {
      const existing = await prisma.sSOProvider.findFirst({
        where: {
          name: config.name,
          id: { not: config.id } // 排除自己
        }
      })
      if (existing) {
        errors.push('提供商名称已存在')
      }
    }

    // 类型特定验证
    switch (config.type) {
      case 'SAML':
        if (config.ssoUrl && !validateUrl(config.ssoUrl)) {
          errors.push('SAML SSO URL格式无效')
        }
        if (config.certificateData && !validateCertificate(config.certificateData)) {
          errors.push('SAML证书格式无效')
        }
        if (config.privateKeyData && !validatePrivateKey(config.privateKeyData)) {
          errors.push('SAML私钥格式无效')
        }
        break

      case 'OAUTH':
        if (!config.entityId?.trim()) {
          errors.push('OAuth Client ID不能为空')
        }
        if (!config.clientSecret?.trim()) {
          errors.push('OAuth Client Secret不能为空')
        }
        if (config.ssoUrl && !validateUrl(config.ssoUrl)) {
          errors.push('OAuth授权URL格式无效')
        }
        if (config.userInfoUrl && !validateUrl(config.userInfoUrl)) {
          errors.push('OAuth用户信息URL格式无效')
        }
        break

      case 'LDAP':
        if (!config.ldapUrl?.trim()) {
          errors.push('LDAP服务器URL不能为空')
        }
        if (config.ldapUrl && !validateUrl(config.ldapUrl)) {
          errors.push('LDAP服务器URL格式无效')
        }
        if (!config.baseDn?.trim()) {
          errors.push('LDAP基础DN不能为空')
        }
        break
    }

    if (errors.length > 0) {
      throw new Error(errors.join('; '))
    }
  }

  /**
   * 测试SAML连接
   */
  private static async testSAMLConnection(provider: any) {
    if (!provider.ssoUrl) {
      throw new Error('SAML SSO URL未配置')
    }

    // 简单的HTTP连接测试
    const response = await fetch(provider.ssoUrl, {
      method: 'HEAD',
      timeout: 5000
    })

    if (!response.ok) {
      throw new Error(`SAML端点不可访问: ${response.status}`)
    }
  }

  /**
   * 测试OAuth连接
   */
  private static async testOAuthConnection(provider: any) {
    if (!provider.ssoUrl) {
      throw new Error('OAuth授权URL未配置')
    }

    // 测试授权端点
    const response = await fetch(provider.ssoUrl, {
      method: 'HEAD',
      timeout: 5000
    })

    if (!response.ok) {
      throw new Error(`OAuth端点不可访问: ${response.status}`)
    }
  }

  /**
   * 测试LDAP连接
   */
  private static async testLDAPConnection(provider: any) {
    // 注意：这里简化处理，实际应用中需要使用LDAP客户端库
    if (!provider.ldapUrl) {
      throw new Error('LDAP服务器URL未配置')
    }

    try {
      const url = new URL(provider.ldapUrl)
      // 简单的端口连接测试
      // 实际应用中应该使用ldapjs等库进行真实的LDAP连接测试
      console.log(`Testing LDAP connection to ${url.hostname}:${url.port || 389}`)
    } catch (error) {
      throw new Error('LDAP服务器连接失败')
    }
  }
}