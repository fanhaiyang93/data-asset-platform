/**
 * 认证处理器
 * 处理API调用的身份验证和授权
 */

import { AuthConfig, AuthToken } from '@/types/integration'

export interface AuthHandlerConfig extends AuthConfig {
  tokenRefreshThreshold?: number // Token刷新阈值(秒),默认300秒
  enableAutoRefresh?: boolean     // 是否启用自动刷新,默认true
}

/**
 * 认证处理器类
 * 管理API认证Token的生成、刷新和验证
 */
export class AuthHandler {
  private config: AuthHandlerConfig
  private currentToken: AuthToken | null = null
  private refreshPromise: Promise<AuthToken> | null = null

  constructor(config: AuthHandlerConfig) {
    this.config = {
      tokenRefreshThreshold: 300, // 5分钟
      enableAutoRefresh: true,
      ...config
    }
  }

  /**
   * 获取有效的认证Token
   * 如果Token即将过期,自动刷新
   */
  async getValidToken(): Promise<string> {
    // 如果没有Token,生成新的
    if (!this.currentToken) {
      this.currentToken = await this.generateToken()
      return this.currentToken.token
    }

    // 检查Token是否即将过期
    if (this.isTokenExpiringSoon(this.currentToken)) {
      if (this.config.enableAutoRefresh) {
        // 避免并发刷新
        if (!this.refreshPromise) {
          this.refreshPromise = this.refreshToken(this.currentToken)
        }

        try {
          this.currentToken = await this.refreshPromise
          return this.currentToken.token
        } finally {
          this.refreshPromise = null
        }
      } else {
        // 不启用自动刷新,生成新Token
        this.currentToken = await this.generateToken()
        return this.currentToken.token
      }
    }

    return this.currentToken.token
  }

  /**
   * 获取认证请求头
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getValidToken()

    return {
      'Authorization': `Bearer ${token}`,
      'X-API-Key': this.config.apiKey
    }
  }

  /**
   * 验证Token是否有效
   */
  isTokenValid(token: AuthToken): boolean {
    return new Date() < token.expiresAt
  }

  /**
   * 检查Token是否即将过期
   */
  private isTokenExpiringSoon(token: AuthToken): boolean {
    const now = Date.now()
    const expiresAt = token.expiresAt.getTime()
    const threshold = (this.config.tokenRefreshThreshold || 300) * 1000

    return (expiresAt - now) < threshold
  }

  /**
   * 生成新的认证Token
   */
  private async generateToken(): Promise<AuthToken> {
    // 在实际应用中,这里应该调用认证服务API
    // 这里使用模拟实现
    const token = this.createJWT()
    const expiresAt = new Date(Date.now() + 3600 * 1000) // 1小时后过期

    return {
      token,
      expiresAt,
      refreshToken: this.createRefreshToken()
    }
  }

  /**
   * 刷新Token
   */
  private async refreshToken(oldToken: AuthToken): Promise<AuthToken> {
    if (!oldToken.refreshToken) {
      // 如果没有refreshToken,生成新Token
      return this.generateToken()
    }

    // 在实际应用中,这里应该调用Token刷新API
    // 这里使用模拟实现
    try {
      const token = this.createJWT()
      const expiresAt = new Date(Date.now() + 3600 * 1000)

      return {
        token,
        expiresAt,
        refreshToken: oldToken.refreshToken
      }
    } catch (error) {
      // 刷新失败,生成新Token
      console.error('Token刷新失败:', error)
      return this.generateToken()
    }
  }

  /**
   * 创建JWT Token (模拟实现)
   * 在实际应用中,应该调用认证服务生成真实的JWT
   */
  private createJWT(): string {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    }

    const payload = {
      apiKey: this.config.apiKey,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    }

    // 简化的JWT生成(实际应该使用加密库)
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header))
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload))
    const signature = this.createSignature(
      `${encodedHeader}.${encodedPayload}`,
      this.config.apiSecret || this.config.apiKey
    )

    return `${encodedHeader}.${encodedPayload}.${signature}`
  }

  /**
   * 创建RefreshToken
   */
  private createRefreshToken(): string {
    return `refresh_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }

  /**
   * Base64 URL编码
   */
  private base64UrlEncode(str: string): string {
    const base64 = Buffer.from(str).toString('base64')
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  /**
   * 创建签名(简化版)
   */
  private createSignature(data: string, secret: string): string {
    // 在实际应用中应该使用HMAC-SHA256
    // 这里使用简化实现
    const combined = `${data}.${secret}`
    let hash = 0

    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }

    return this.base64UrlEncode(hash.toString())
  }

  /**
   * 手动清除Token(用于登出等场景)
   */
  clearToken(): void {
    this.currentToken = null
    this.refreshPromise = null
  }

  /**
   * 手动设置Token(用于外部认证等场景)
   */
  setToken(token: AuthToken): void {
    this.currentToken = token
  }

  /**
   * 获取当前Token信息(不触发刷新)
   */
  getCurrentToken(): AuthToken | null {
    return this.currentToken
  }
}
