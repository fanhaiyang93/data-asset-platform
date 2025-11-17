/**
 * SAML 2.0认证服务核心模块
 * 提供完整的SAML认证流程支持
 */

import { Strategy as SamlStrategy, Profile as SamlProfile, AuthenticateOptions, AuthorizeOptions } from '@node-saml/passport-saml';
import { prisma } from '@/lib/prisma';
import { SSOProvider, SSOProviderType } from '@/types/sso';

/**
 * SAML配置接口
 */
export interface SAMLConfig {
  // 服务提供商(SP)配置
  entityId: string;                    // SP实体ID
  callbackUrl: string;                 // ACS (Assertion Consumer Service) URL

  // 身份提供商(IdP)配置
  entryPoint: string;                  // IdP SSO入口URL
  idpIssuer?: string;                  // IdP实体ID
  idpCert: string;                     // IdP签名证书

  // SP证书配置 (可选,用于签名和加密)
  privateCert?: string;                // SP私钥
  decryptionPvk?: string;              // 解密私钥

  // 安全配置
  wantAssertionsSigned?: boolean;      // 要求断言签名
  wantAuthnResponseSigned?: boolean;   // 要求响应签名
  signatureAlgorithm?: string;         // 签名算法

  // 高级配置
  acceptedClockSkewMs?: number;        // 时钟偏差容忍(毫秒)
  disableRequestedAuthnContext?: boolean;
  identifierFormat?: string;           // NameID格式

  // 属性映射
  attributeMapping?: {
    email?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    department?: string;
    position?: string;
  };

  // 单点登出配置
  logoutUrl?: string;                  // IdP SLO (Single Logout) URL
  logoutCallbackUrl?: string;          // SP SLO回调URL
}

/**
 * SAML用户信息
 */
export interface SAMLUserInfo {
  nameID: string;                      // SAML NameID
  sessionIndex?: string;               // 会话索引
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  position?: string;
  attributes?: Record<string, any>;    // 原始SAML属性
}

/**
 * SAML认证结果
 */
export interface SAMLAuthResult {
  success: boolean;
  userInfo?: SAMLUserInfo;
  error?: string;
  sessionIndex?: string;
}

/**
 * SAML服务类
 */
export class SAMLService {
  private strategy: SamlStrategy | null = null;
  private config: SAMLConfig | null = null;

  /**
   * 初始化SAML策略
   */
  async initialize(providerId: string): Promise<void> {
    try {
      // 从数据库加载提供商配置
      const provider = await prisma.sSOProvider.findUnique({
        where: { id: providerId }
      });

      if (!provider) {
        throw new Error(`SAML provider ${providerId} not found`);
      }

      if (provider.type !== 'SAML' as SSOProviderType) {
        throw new Error(`Provider ${providerId} is not a SAML provider`);
      }

      // 构建SAML配置
      this.config = this.buildSAMLConfig(provider);

      // 创建SAML策略
      this.strategy = new SamlStrategy(
        {
          // SP配置
          issuer: this.config.entityId,
          callbackUrl: this.config.callbackUrl,
          cert: this.config.privateCert,
          privateKey: this.config.privateCert,
          decryptionPvk: this.config.decryptionPvk,

          // IdP配置
          entryPoint: this.config.entryPoint,
          idpIssuer: this.config.idpIssuer,
          idpCert: this.config.idpCert,

          // 安全配置
          wantAssertionsSigned: this.config.wantAssertionsSigned ?? true,
          wantAuthnResponseSigned: this.config.wantAuthnResponseSigned ?? false,
          signatureAlgorithm: this.config.signatureAlgorithm || 'sha256',
          acceptedClockSkewMs: this.config.acceptedClockSkewMs || 60000,

          // 其他配置
          disableRequestedAuthnContext: this.config.disableRequestedAuthnContext ?? false,
          identifierFormat: this.config.identifierFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',

          // 登出配置
          logoutUrl: this.config.logoutUrl,
          logoutCallbackUrl: this.config.logoutCallbackUrl,
        },
        (profile: SamlProfile | null, done: (error: any, user?: any) => void) => {
          // 验证回调
          if (!profile) {
            done(new Error('No profile returned from SAML authentication'));
            return;
          }
          done(null, profile);
        }
      );

    } catch (error) {
      console.error('Failed to initialize SAML service:', error);
      throw error;
    }
  }

  /**
   * 生成SAML认证请求
   * @returns 重定向URL和RelayState
   */
  async generateAuthRequest(relayState?: string): Promise<{ url: string; relayState?: string }> {
    if (!this.strategy) {
      throw new Error('SAML strategy not initialized');
    }

    return new Promise((resolve, reject) => {
      const options: AuthorizeOptions = {
        additionalParams: relayState ? { RelayState: relayState } : {}
      };

      this.strategy!.authenticate(
        {} as any,
        options as any
      );

      // 获取重定向URL
      const authUrl = this.strategy!.generateServiceProviderMetadata(
        this.config?.privateCert,
        this.config?.privateCert
      );

      resolve({
        url: this.config!.entryPoint,
        relayState
      });
    });
  }

  /**
   * 验证SAML响应
   */
  async validateResponse(samlResponse: string): Promise<SAMLAuthResult> {
    if (!this.strategy) {
      return {
        success: false,
        error: 'SAML strategy not initialized'
      };
    }

    try {
      // 使用策略验证SAML响应
      const profile = await new Promise<SamlProfile>((resolve, reject) => {
        const request = {
          body: { SAMLResponse: samlResponse },
          query: {}
        };

        this.strategy!.authenticate(request as any, {} as AuthenticateOptions);

        // 模拟passport回调
        const originalCallback = this.strategy!._verify;
        this.strategy!._verify = (profile: SamlProfile | null, done: Function) => {
          if (profile) {
            resolve(profile);
          } else {
            reject(new Error('Invalid SAML response'));
          }
          originalCallback(profile, done);
        };
      });

      // 提取用户信息
      const userInfo = this.extractUserInfo(profile);

      if (!userInfo.email || !userInfo.nameID) {
        return {
          success: false,
          error: 'Missing required user information (email or nameID)'
        };
      }

      return {
        success: true,
        userInfo,
        sessionIndex: profile.sessionIndex
      };

    } catch (error) {
      console.error('SAML response validation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SAML validation failed'
      };
    }
  }

  /**
   * 生成SAML登出请求
   */
  async generateLogoutRequest(nameID: string, sessionIndex?: string): Promise<string> {
    if (!this.strategy || !this.config?.logoutUrl) {
      throw new Error('SAML logout not configured');
    }

    return new Promise((resolve, reject) => {
      const options = {
        nameID,
        sessionIndex
      };

      // 生成登出请求
      this.strategy!.logout({} as any, options, (err: Error | null, url?: string) => {
        if (err) {
          reject(err);
        } else {
          resolve(url || '');
        }
      });
    });
  }

  /**
   * 验证SAML登出响应
   */
  async validateLogoutResponse(samlResponse: string): Promise<boolean> {
    if (!this.strategy) {
      throw new Error('SAML strategy not initialized');
    }

    try {
      // 验证登出响应
      await new Promise((resolve, reject) => {
        const request = {
          body: { SAMLResponse: samlResponse }
        };

        this.strategy!.authenticate(request as any, {} as AuthenticateOptions);
        resolve(true);
      });

      return true;
    } catch (error) {
      console.error('SAML logout response validation error:', error);
      return false;
    }
  }

  /**
   * 从SAML Profile提取用户信息
   */
  private extractUserInfo(profile: SamlProfile): SAMLUserInfo {
    const mapping = this.config?.attributeMapping || {};

    // 提取基本信息
    const nameID = profile.nameID || profile.ID || '';
    const sessionIndex = profile.sessionIndex;

    // 提取属性 (支持多种属性格式)
    const getAttributeValue = (attrName: string): string => {
      // 尝试直接属性
      if (profile[attrName]) {
        return Array.isArray(profile[attrName]) ? profile[attrName][0] : profile[attrName];
      }

      // 尝试映射的属性名
      const mappedName = mapping[attrName as keyof typeof mapping];
      if (mappedName && profile[mappedName]) {
        return Array.isArray(profile[mappedName]) ? profile[mappedName][0] : profile[mappedName];
      }

      // 尝试标准SAML属性格式
      const standardAttr = `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/${attrName}`;
      if (profile[standardAttr]) {
        return Array.isArray(profile[standardAttr]) ? profile[standardAttr][0] : profile[standardAttr];
      }

      return '';
    };

    const email = getAttributeValue('email') || getAttributeValue('emailaddress') || '';
    const name = getAttributeValue('name') || getAttributeValue('displayname') || '';
    const firstName = getAttributeValue('firstName') || getAttributeValue('givenname') || '';
    const lastName = getAttributeValue('lastName') || getAttributeValue('surname') || '';
    const department = getAttributeValue('department') || '';
    const position = getAttributeValue('position') || getAttributeValue('title') || '';

    return {
      nameID: this.sanitizeString(nameID),
      sessionIndex,
      email: this.sanitizeEmail(email),
      name: this.sanitizeString(name),
      firstName: this.sanitizeString(firstName),
      lastName: this.sanitizeString(lastName),
      department: this.sanitizeString(department),
      position: this.sanitizeString(position),
      attributes: profile
    };
  }

  /**
   * 从数据库提供商构建SAML配置
   */
  private buildSAMLConfig(provider: any): SAMLConfig {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    return {
      entityId: provider.entityId || `${baseUrl}/saml/metadata`,
      callbackUrl: `${baseUrl}/api/auth/sso/saml/acs`,
      entryPoint: provider.ssoUrl || '',
      idpIssuer: provider.entityId,
      idpCert: provider.certificateData || '',
      privateCert: provider.privateKeyData,
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: false,
      signatureAlgorithm: 'sha256',
      acceptedClockSkewMs: 60000,
      identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      logoutUrl: provider.sloUrl,
      logoutCallbackUrl: `${baseUrl}/api/auth/sso/saml/slo`,
      attributeMapping: provider.attributeMapping as any || {}
    };
  }

  /**
   * 字符串清理
   */
  private sanitizeString(input: string | undefined): string {
    if (!input) return '';

    return input
      .replace(/[<>'"&]/g, '')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim()
      .substring(0, 255);
  }

  /**
   * 邮箱清理和验证
   */
  private sanitizeEmail(email: string | undefined): string {
    if (!email) return '';

    const sanitized = this.sanitizeString(email);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(sanitized)) {
      throw new Error('Invalid email format');
    }

    return sanitized.toLowerCase();
  }

  /**
   * 获取当前配置
   */
  getConfig(): SAMLConfig | null {
    return this.config;
  }
}

/**
 * 创建SAML服务实例
 */
export async function createSAMLService(providerId: string): Promise<SAMLService> {
  const service = new SAMLService();
  await service.initialize(providerId);
  return service;
}
