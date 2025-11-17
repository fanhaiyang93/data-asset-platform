export type SSOProviderType = 'SAML' | 'OAUTH' | 'LDAP' | 'OIDC'
export type SSOProviderStatus = 'ACTIVE' | 'INACTIVE' | 'TESTING' | 'MAINTENANCE'

export interface SSOProvider {
  id: string
  name: string
  type: SSOProviderType
  status: SSOProviderStatus

  // 基础配置
  entityId?: string
  ssoUrl?: string
  sloUrl?: string
  certificateData?: string | '[已配置]'
  privateKeyData?: string | '[已配置]'

  // OAuth专用
  clientSecret?: string | '[已配置]'
  scopes?: string[]
  userInfoUrl?: string

  // LDAP专用
  ldapUrl?: string
  baseDn?: string
  bindDn?: string
  bindPassword?: string | '[已配置]'
  userFilter?: string

  // 属性映射
  attributeMapping?: Record<string, string>
  roleMapping?: Record<string, string>

  // 高级配置
  autoProvision?: boolean
  updateAttributes?: boolean
  enforceSSO?: boolean

  // 状态信息
  lastHealthCheck?: string
  healthStatus?: string
  errorMessage?: string
  totalLogins?: number
  successfulLogins?: number
  lastLoginAt?: string

  // 时间戳
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
}

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

export interface SSOLog {
  id: string
  providerId: string
  userId?: string
  email?: string
  action: string
  status: string
  message?: string
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  responseTime?: number
  errorCode?: string
  metadata?: any
  createdAt: string
  provider?: {
    name: string
    type: SSOProviderType
  }
}

export interface SSOSession {
  id: string
  sessionId: string
  providerId: string
  userId: string
  nameId?: string
  sessionIndex?: string
  loginTime: string
  lastActivity: string
  expiresAt: string
  isActive: boolean
  logoutRequested: boolean
  ipAddress?: string
  userAgent?: string
  metadata?: any
  provider?: {
    name: string
    type: SSOProviderType
  }
  user?: {
    username: string
    email: string
    name?: string
  }
}

export interface SSOStatistics {
  totalLogins: number
  successfulLogins: number
  failedLogins: number
  successRate: number
  averageResponseTime: number
  totalEvents: number
}

export interface SSOConnectionTestResult {
  status: 'healthy' | 'unhealthy'
  responseTime: number
  errorMessage?: string
}