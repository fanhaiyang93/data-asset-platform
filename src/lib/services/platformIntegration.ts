import { Application, User } from '@prisma/client';
import * as crypto from 'crypto';
import { SSOAuthService } from './ssoAuth';

/**
 * 第三方平台集成服务
 * 处理参数传递、URL构建和平台适配
 */

export interface RedirectParameters {
  applicationId: string;
  userId: string;
  platform: string;
  assetInfo?: Record<string, any>;
  customParams?: Record<string, any>;
}

export interface EncryptedParameters {
  data: string;
  signature: string;
  timestamp: number;
}

export interface PlatformEndpoint {
  platform: string;
  baseUrl: string;
  authEndpoint?: string;
  callbackUrl?: string;
  requiredParams: string[];
  optionalParams?: string[];
}

// 支持的第三方平台配置
const PLATFORM_CONFIGS: Record<string, PlatformEndpoint> = {
  hive: {
    platform: 'hive',
    baseUrl: process.env.HIVE_PLATFORM_URL || 'https://hive.company.com',
    authEndpoint: '/api/sso/auth',
    callbackUrl: '/api/sso/callback',
    requiredParams: ['user_token', 'application_id'],
    optionalParams: ['data_permissions', 'query_context']
  },
  enterprise_wechat: {
    platform: 'enterprise_wechat',
    baseUrl: 'https://work.weixin.qq.com',
    authEndpoint: '/wework_admin/approval',
    requiredParams: ['access_token', 'application_data'],
    optionalParams: ['template_id', 'approver_list']
  },
  oa_system: {
    platform: 'oa_system',
    baseUrl: process.env.OA_SYSTEM_URL || 'https://oa.company.com',
    authEndpoint: '/api/external/applications',
    callbackUrl: '/api/external/callback',
    requiredParams: ['auth_token', 'form_data'],
    optionalParams: ['workflow_id', 'priority']
  }
};

export class PlatformIntegrationService {
  private static readonly ENCRYPTION_KEY = process.env.PLATFORM_ENCRYPTION_KEY || 'default-key-change-in-production';
  private static readonly SIGNATURE_SECRET = process.env.PLATFORM_SIGNATURE_SECRET || 'default-secret-change-in-production';

  /**
   * 构建第三方平台跳转URL
   */
  static async buildRedirectUrl(
    platform: string,
    user: User,
    application: Application,
    customParams?: Record<string, any>
  ): Promise<string> {
    const config = PLATFORM_CONFIGS[platform];
    if (!config) {
      throw new Error(`不支持的平台: ${platform}`);
    }

    try {
      // 生成SSO token
      const ssoToken = await SSOAuthService.generateSSOToken(
        user,
        application,
        platform
      );

      // 准备基础参数
      const baseParams: RedirectParameters = {
        applicationId: application.id,
        userId: user.id,
        platform,
        customParams
      };

      // 序列化申请数据
      const serializedData = await this.serializeApplicationData(application);
      baseParams.assetInfo = serializedData;

      // 加密参数
      const encryptedParams = this.encryptParameters(baseParams);

      // 构建平台特定的URL参数
      const urlParams = await this.buildPlatformSpecificParams(
        platform,
        ssoToken,
        encryptedParams,
        user,
        application
      );

      // 构建最终URL
      const baseUrl = config.baseUrl + (config.authEndpoint || '');
      const url = new URL(baseUrl);

      Object.entries(urlParams).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });

      return url.toString();
    } catch (error) {
      throw new Error(`构建跳转URL失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 序列化申请数据
   */
  static async serializeApplicationData(application: Application): Promise<Record<string, any>> {
    return {
      id: application.id,
      assetId: application.assetId,
      purpose: application.purpose,
      priority: application.priority,
      status: application.status,
      createdAt: application.createdAt.toISOString(),
      // 不包含敏感信息如详细的用户数据
      metadata: {
        type: 'data_access_application',
        version: '1.0'
      }
    };
  }

  /**
   * 加密参数
   */
  static encryptParameters(params: RedirectParameters): EncryptedParameters {
    try {
      const timestamp = Date.now();
      const dataString = JSON.stringify({ ...params, timestamp });

      // 使用AES加密
      const cipher = crypto.createCipher('aes-256-cbc', this.ENCRYPTION_KEY);
      let encrypted = cipher.update(dataString, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // 生成签名
      const signature = crypto
        .createHmac('sha256', this.SIGNATURE_SECRET)
        .update(encrypted + timestamp)
        .digest('hex');

      return {
        data: encrypted,
        signature,
        timestamp
      };
    } catch (error) {
      throw new Error(`参数加密失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 解密参数
   */
  static decryptParameters(encryptedParams: EncryptedParameters): RedirectParameters | null {
    try {
      // 验证签名
      const expectedSignature = crypto
        .createHmac('sha256', this.SIGNATURE_SECRET)
        .update(encryptedParams.data + encryptedParams.timestamp)
        .digest('hex');

      if (expectedSignature !== encryptedParams.signature) {
        throw new Error('参数签名验证失败');
      }

      // 检查时效性（30分钟内有效）
      const now = Date.now();
      const maxAge = 30 * 60 * 1000; // 30分钟
      if (now - encryptedParams.timestamp > maxAge) {
        throw new Error('参数已过期');
      }

      // 解密数据
      const decipher = crypto.createDecipher('aes-256-cbc', this.ENCRYPTION_KEY);
      let decrypted = decipher.update(encryptedParams.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      const params = JSON.parse(decrypted);
      return params as RedirectParameters;
    } catch (error) {
      console.error('参数解密失败:', error);
      return null;
    }
  }

  /**
   * 构建平台特定的URL参数
   */
  private static async buildPlatformSpecificParams(
    platform: string,
    ssoToken: string,
    encryptedParams: EncryptedParameters,
    user: User,
    application: Application
  ): Promise<Record<string, any>> {
    const baseParams = {
      token: ssoToken,
      data: encryptedParams.data,
      signature: encryptedParams.signature,
      timestamp: encryptedParams.timestamp,
      callback: this.getCallbackUrl(platform)
    };

    switch (platform) {
      case 'hive':
        return {
          ...baseParams,
          user_token: ssoToken,
          application_id: application.id,
          hive_username: user.email.split('@')[0],
          data_permissions: (await SSOAuthService.createUserIdentityMapping(user, platform)).dataPermissions?.join(',') || 'read'
        };

      case 'enterprise_wechat':
        return {
          ...baseParams,
          access_token: ssoToken,
          application_data: JSON.stringify(await this.serializeApplicationData(application)),
          template_id: 'data_access_approval',
          user_id: user.email
        };

      case 'oa_system':
        return {
          ...baseParams,
          auth_token: ssoToken,
          form_data: JSON.stringify({
            applicant: user.name || user.email,
            application_type: 'data_access',
            details: application.purpose,
            priority: application.priority
          }),
          workflow_id: 'data_approval_workflow'
        };

      default:
        return baseParams;
    }
  }

  /**
   * 获取回调URL
   */
  private static getCallbackUrl(platform: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${baseUrl}/api/platform/callback/${platform}`;
  }

  /**
   * 验证参数完整性
   */
  static validateParameters(
    platform: string,
    params: Record<string, any>
  ): { valid: boolean; missing: string[] } {
    const config = PLATFORM_CONFIGS[platform];
    if (!config) {
      return { valid: false, missing: ['platform not supported'] };
    }

    const missing: string[] = [];
    config.requiredParams.forEach(param => {
      if (!params[param]) {
        missing.push(param);
      }
    });

    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * 格式转换适配器
   */
  static async convertParameterFormat(
    fromPlatform: string,
    toPlatform: string,
    params: Record<string, any>
  ): Promise<Record<string, any>> {
    // 这里可以实现不同平台间的参数格式转换
    // 目前返回原参数，可根据需要扩展
    return params;
  }

  /**
   * 获取支持的平台列表
   */
  static getSupportedPlatforms(): string[] {
    return Object.keys(PLATFORM_CONFIGS);
  }

  /**
   * 获取平台配置
   */
  static getPlatformConfig(platform: string): PlatformEndpoint | null {
    return PLATFORM_CONFIGS[platform] || null;
  }
}