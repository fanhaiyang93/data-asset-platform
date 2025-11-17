import { prisma } from './prisma';
import { UserRole } from '@prisma/client';
import { SSOUserInfo } from './sso';

// 用户同步结果接口
export interface UserSyncResult {
  success: boolean;
  user?: any;
  created?: boolean;
  updated?: boolean;
  error?: string;
}

// 用户同步配置
export interface UserSyncConfig {
  autoCreateUser: boolean;
  defaultRole: UserRole;
  allowRoleUpdate: boolean;
  requiredFields: string[];
}

export class UserSyncService {
  private static config: UserSyncConfig = {
    autoCreateUser: true,
    defaultRole: UserRole.BUSINESS_USER,
    allowRoleUpdate: false,
    requiredFields: ['email']
  };

  // 配置用户同步设置
  static configure(config: Partial<UserSyncConfig>) {
    this.config = { ...this.config, ...config };
  }

  // 从SSO信息同步用户
  static async syncUserFromSSO(ssoUserInfo: SSOUserInfo): Promise<UserSyncResult> {
    try {
      // 验证必需字段
      const missingFields = this.config.requiredFields.filter(
        field => !ssoUserInfo[field as keyof SSOUserInfo]
      );

      if (missingFields.length > 0) {
        return {
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`
        };
      }

      // 查找现有用户
      const existingUser = await this.findExistingUser(ssoUserInfo);

      if (existingUser) {
        // 更新现有用户
        return await this.updateExistingUser(existingUser, ssoUserInfo);
      } else if (this.config.autoCreateUser) {
        // 创建新用户
        return await this.createNewUser(ssoUserInfo);
      } else {
        return {
          success: false,
          error: 'User not found and auto-creation is disabled'
        };
      }

    } catch (error) {
      console.error('User sync error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'User sync failed'
      };
    }
  }

  // 创建用户账号
  static async createUserAccount(ssoUserInfo: SSOUserInfo): Promise<UserSyncResult> {
    try {
      const user = await prisma.user.create({
        data: {
          username: this.generateUsername(ssoUserInfo),
          email: ssoUserInfo.email,
          name: ssoUserInfo.name || '',
          department: ssoUserInfo.department || '',
          role: this.config.defaultRole,
          ssoProvider: ssoUserInfo.provider,
          ssoId: ssoUserInfo.ssoId,
          passwordHash: '', // SSO用户不需要密码
          lastLoginAt: new Date(),
        }
      });

      return {
        success: true,
        user,
        created: true
      };

    } catch (error) {
      console.error('User creation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'User creation failed'
      };
    }
  }

  // 更新用户信息
  static async updateUserInfo(userId: string, updateData: Partial<SSOUserInfo>): Promise<UserSyncResult> {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          name: updateData.name,
          department: updateData.department,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        }
      });

      return {
        success: true,
        user,
        updated: true
      };

    } catch (error) {
      console.error('User update error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'User update failed'
      };
    }
  }

  // 从LDAP同步用户
  static async syncFromLDAP(): Promise<UserSyncResult[]> {
    try {
      // 动态导入LDAP服务以避免循环依赖
      const { LDAPService } = await import('./ldap');

      // 执行LDAP同步
      const syncResult = await LDAPService.syncUsers();

      if (!syncResult.success) {
        return [{
          success: false,
          error: `LDAP sync failed: ${syncResult.errors.join(', ')}`
        }];
      }

      // 返回同步统计信息
      return [{
        success: true,
        user: {
          processed: syncResult.processedUsers,
          created: syncResult.createdUsers,
          updated: syncResult.updatedUsers,
          skipped: syncResult.skippedUsers
        }
      }];

    } catch (error) {
      console.error('LDAP sync error:', error);
      return [{
        success: false,
        error: error instanceof Error ? error.message : 'LDAP sync failed'
      }];
    }
  }

  // 批量同步用户
  static async batchSyncUsers(userInfoList: SSOUserInfo[]): Promise<UserSyncResult[]> {
    const results: UserSyncResult[] = [];

    for (const userInfo of userInfoList) {
      const result = await this.syncUserFromSSO(userInfo);
      results.push(result);

      // 添加延迟以避免数据库压力
      if (userInfoList.length > 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  // 验证用户数据
  static validateUserData(ssoUserInfo: SSOUserInfo): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 邮箱格式验证
    if (!ssoUserInfo.email || !this.isValidEmail(ssoUserInfo.email)) {
      errors.push('Invalid email format');
    }

    // SSO ID验证
    if (!ssoUserInfo.ssoId || ssoUserInfo.ssoId.trim().length === 0) {
      errors.push('Missing SSO ID');
    }

    // 提供商验证
    if (!ssoUserInfo.provider || !['saml', 'oauth', 'ldap'].includes(ssoUserInfo.provider)) {
      errors.push('Invalid SSO provider');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // 获取用户同步统计
  static async getSyncStatistics(): Promise<{
    totalUsers: number;
    ssoUsers: number;
    localUsers: number;
    lastSyncTime: Date | null;
  }> {
    try {
      const [totalUsers, ssoUsers] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: {
            ssoProvider: { not: null }
          }
        })
      ]);

      // 获取最近的同步时间（基于用户的最后更新时间）
      const lastSync = await prisma.user.findFirst({
        where: { ssoProvider: { not: null } },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true }
      });

      return {
        totalUsers,
        ssoUsers,
        localUsers: totalUsers - ssoUsers,
        lastSyncTime: lastSync?.updatedAt || null
      };

    } catch (error) {
      console.error('Error getting sync statistics:', error);
      return {
        totalUsers: 0,
        ssoUsers: 0,
        localUsers: 0,
        lastSyncTime: null
      };
    }
  }

  // 私有方法：查找现有用户
  private static async findExistingUser(ssoUserInfo: SSOUserInfo) {
    return await prisma.user.findFirst({
      where: {
        OR: [
          // 通过邮箱匹配
          { email: ssoUserInfo.email },
          // 通过SSO信息匹配
          {
            AND: [
              { ssoProvider: ssoUserInfo.provider },
              { ssoId: ssoUserInfo.ssoId }
            ]
          }
        ]
      }
    });
  }

  // 私有方法：更新现有用户
  private static async updateExistingUser(existingUser: any, ssoUserInfo: SSOUserInfo): Promise<UserSyncResult> {
    const updateData: any = {
      lastLoginAt: new Date(),
      updatedAt: new Date()
    };

    // 如果是通过邮箱匹配但没有SSO信息，添加SSO信息
    if (!existingUser.ssoProvider || !existingUser.ssoId) {
      updateData.ssoProvider = ssoUserInfo.provider;
      updateData.ssoId = ssoUserInfo.ssoId;
    }

    // 更新用户信息（如果有变更）
    if (ssoUserInfo.name && ssoUserInfo.name !== existingUser.name) {
      updateData.name = ssoUserInfo.name;
    }

    if (ssoUserInfo.department && ssoUserInfo.department !== existingUser.department) {
      updateData.department = ssoUserInfo.department;
    }

    const user = await prisma.user.update({
      where: { id: existingUser.id },
      data: updateData
    });

    return {
      success: true,
      user,
      updated: true
    };
  }

  // 私有方法：创建新用户
  private static async createNewUser(ssoUserInfo: SSOUserInfo): Promise<UserSyncResult> {
    return await this.createUserAccount(ssoUserInfo);
  }

  // 私有方法：生成用户名
  private static generateUsername(ssoUserInfo: SSOUserInfo): string {
    // 优先使用邮箱前缀作为用户名
    const emailPrefix = ssoUserInfo.email.split('@')[0];

    // 清理用户名，只保留字母数字和下划线
    const cleanUsername = emailPrefix.replace(/[^a-zA-Z0-9_]/g, '_');

    return cleanUsername || `user_${ssoUserInfo.ssoId}`;
  }

  // 私有方法：验证邮箱格式
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}