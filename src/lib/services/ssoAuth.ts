import { JWTPayload, SignJWT } from 'jose';
import { User, Application } from '@prisma/client';
import { prisma } from '../prisma';
import * as crypto from 'crypto';

/**
 * 第三方平台SSO认证服务
 * 专门用于生成用于第三方平台跳转的安全token
 */

export interface SSOTokenPayload extends JWTPayload {
  userId: string;
  applicationId: string;
  platform: string;
  timestamp: number;
  expiresAt: number;
}

export interface PlatformSSOConfig {
  platform: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string;
  expirationTime?: number; // 默认15分钟
}

export class SSOAuthService {
  private static readonly DEFAULT_EXPIRATION = 15 * 60 * 1000; // 15分钟
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

  /**
   * 为用户和申请生成SSO跳转token
   */
  static async generateSSOToken(
    user: User,
    application: Application,
    platform: string
  ): Promise<string> {
    try {
      const now = Date.now();
      const expiresAt = now + this.DEFAULT_EXPIRATION;

      const payload: SSOTokenPayload = {
        userId: user.id,
        applicationId: application.id,
        platform,
        timestamp: now,
        expiresAt,
        iss: 'data-asset-platform',
        aud: platform,
        exp: Math.floor(expiresAt / 1000),
        iat: Math.floor(now / 1000)
      };

      // 使用JOSE库生成JWT
      const secret = new TextEncoder().encode(this.JWT_SECRET);
      const jwt = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(secret);

      // 记录token生成日志
      await this.logTokenGeneration(user.id, application.id, platform);

      return jwt;
    } catch (error) {
      throw new Error(`SSO token生成失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 验证SSO token
   */
  static async validateSSOToken(token: string): Promise<SSOTokenPayload | null> {
    try {
      const { jwtVerify } = await import('jose');
      const secret = new TextEncoder().encode(this.JWT_SECRET);

      const { payload } = await jwtVerify(token, secret);

      // 验证必要字段
      if (!payload.userId || !payload.applicationId || !payload.platform) {
        return null;
      }

      return payload as SSOTokenPayload;
    } catch (error) {
      console.error('SSO token验证失败:', error);
      return null;
    }
  }

  /**
   * 刷新即将过期的token
   */
  static async refreshToken(oldToken: string): Promise<string | null> {
    const payload = await this.validateSSOToken(oldToken);
    if (!payload) return null;

    // 检查是否在刷新窗口内（过期前5分钟）
    const now = Date.now();
    const refreshWindow = 5 * 60 * 1000; // 5分钟
    const timeToExpiry = payload.expiresAt - now;

    if (timeToExpiry > refreshWindow) {
      return oldToken; // 还不需要刷新
    }

    try {
      // 获取用户和申请信息重新生成token
      const user = await prisma.user.findUnique({
        where: { id: payload.userId }
      });

      const application = await prisma.application.findUnique({
        where: { id: payload.applicationId }
      });

      if (!user || !application) {
        return null;
      }

      return await this.generateSSOToken(user, application, payload.platform);
    } catch (error) {
      console.error('Token刷新失败:', error);
      return null;
    }
  }

  /**
   * 为特定平台验证用户权限
   */
  static async validatePlatformAccess(
    userId: string,
    platform: string
  ): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { userRoles: true }
      });

      if (!user) return false;

      // 基于平台的权限检查
      switch (platform) {
        case 'hive':
          return user.userRoles.some(role =>
            ['admin', 'data_analyst', 'data_engineer'].includes(role.role)
          );
        case 'enterprise_wechat':
          return true; // 所有用户都可以访问企业微信
        case 'oa_system':
          return user.userRoles.some(role =>
            ['admin', 'manager', 'employee'].includes(role.role)
          );
        default:
          return false;
      }
    } catch (error) {
      console.error('平台访问权限验证失败:', error);
      return false;
    }
  }

  /**
   * 生成用于第三方平台的用户身份映射
   */
  static async createUserIdentityMapping(
    user: User,
    platform: string
  ): Promise<Record<string, any>> {
    const baseMapping = {
      userId: user.id,
      email: user.email,
      name: user.name,
      platform,
      mappedAt: new Date().toISOString()
    };

    // 根据不同平台添加特定字段
    switch (platform) {
      case 'hive':
        return {
          ...baseMapping,
          hiveUsername: user.email.split('@')[0],
          dataPermissions: await this.getUserDataPermissions(user.id)
        };
      case 'enterprise_wechat':
        return {
          ...baseMapping,
          wechatUserId: user.email,
          department: user.department || 'default'
        };
      case 'oa_system':
        return {
          ...baseMapping,
          employeeId: user.id,
          department: user.department || 'IT'
        };
      default:
        return baseMapping;
    }
  }

  /**
   * 记录token生成日志
   */
  private static async logTokenGeneration(
    userId: string,
    applicationId: string,
    platform: string
  ): Promise<void> {
    try {
      // 这里可以扩展为写入专门的audit表
      console.log(`SSO Token生成: 用户=${userId}, 申请=${applicationId}, 平台=${platform}`);
    } catch (error) {
      console.error('SSO日志记录失败:', error);
    }
  }

  /**
   * 获取用户数据权限
   */
  private static async getUserDataPermissions(userId: string): Promise<string[]> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { userRoles: true }
      });

      if (!user) return [];

      // 基于角色返回数据权限
      const permissions: string[] = [];
      user.userRoles.forEach(userRole => {
        switch (userRole.role) {
          case 'admin':
            permissions.push('full_access', 'read', 'write', 'delete');
            break;
          case 'data_engineer':
            permissions.push('read', 'write');
            break;
          case 'data_analyst':
            permissions.push('read');
            break;
          default:
            permissions.push('read');
        }
      });

      return [...new Set(permissions)];
    } catch (error) {
      console.error('获取用户数据权限失败:', error);
      return ['read'];
    }
  }

  /**
   * 处理token失效
   */
  static async revokeToken(token: string): Promise<boolean> {
    try {
      const payload = await this.validateSSOToken(token);
      if (!payload) return false;

      // 可以在这里实现token黑名单机制
      console.log(`Token已撤销: 用户=${payload.userId}, 平台=${payload.platform}`);
      return true;
    } catch (error) {
      console.error('Token撤销失败:', error);
      return false;
    }
  }
}