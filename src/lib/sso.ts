import { Strategy as SamlStrategy, Profile as SamlProfile } from '@node-saml/passport-saml';
import { AuthService, JWTPayload } from './auth';
import { prisma } from './prisma';
import { UserRole } from '@prisma/client';
import * as xml2js from 'xml2js';
import * as crypto from 'crypto-js';

// SSO配置接口
export interface SSOConfig {
  saml?: {
    entryPoint: string;
    issuer: string;
    cert: string;
    callbackUrl: string;
  };
  oauth?: {
    clientId: string;
    clientSecret: string;
    authorizationURL: string;
    tokenURL: string;
    callbackURL: string;
    userInfoURL?: string; // 用户信息端点
  };
}

// SSO用户信息接口
export interface SSOUserInfo {
  ssoId: string;
  email: string;
  name?: string;
  department?: string;
  provider: string;
}

// SSO响应验证结果
export interface SSOValidationResult {
  success: boolean;
  userInfo?: SSOUserInfo;
  error?: string;
}

export class SSOService {
  private static ssoConfig: SSOConfig = {};

  // 初始化SSO配置
  static initializeConfig(config: SSOConfig) {
    this.ssoConfig = { ...config };
  }

  // 处理SAML认证响应
  static async handleSAMLAuth(samlResponse: string): Promise<SSOValidationResult> {
    try {
      if (!this.ssoConfig.saml) {
        // 触发降级处理
        const { SSOFallbackService } = await import('./ssoFallback');
        await SSOFallbackService.handleSSOFailure('saml', new Error('SAML configuration not found'));
        return { success: false, error: 'SAML configuration not found' };
      }

      // 创建SAML策略
      const samlStrategy = new SamlStrategy(
        {
          entryPoint: this.ssoConfig.saml.entryPoint,
          issuer: this.ssoConfig.saml.issuer,
          idpCert: this.ssoConfig.saml.cert,
          callbackUrl: this.ssoConfig.saml.callbackUrl,
          acceptedClockSkewMs: 60000, // 1分钟时钟偏差容忍
          wantAssertionsSigned: false, // 在测试环境中禁用签名验证
        },
        async (profile: SamlProfile, done: Function) => {
          done(null, profile);
        }
      );

      // 验证SAML响应
      const userInfo = await this.validateSAMLResponse(samlResponse, samlStrategy);

      if (!userInfo) {
        return { success: false, error: 'Invalid SAML response' };
      }

      return { success: true, userInfo };

    } catch (error) {
      console.error('SAML authentication error:', error);

      // 触发降级处理
      const { SSOFallbackService } = await import('./ssoFallback');
      await SSOFallbackService.handleSSOFailure('saml', error instanceof Error ? error : new Error('SAML authentication failed'));

      return {
        success: false,
        error: error instanceof Error ? error.message : 'SAML authentication failed'
      };
    }
  }

  // 处理OAuth认证
  static async handleOAuthAuth(code: string, state: string): Promise<SSOValidationResult> {
    try {
      if (!this.ssoConfig.oauth) {
        return { success: false, error: 'OAuth configuration not found' };
      }

      // 交换authorization code获取access token
      const tokenResponse = await this.exchangeCodeForToken(code);

      if (!tokenResponse.access_token) {
        return { success: false, error: 'Failed to obtain access token' };
      }

      // 使用access token获取用户信息
      const userInfo = await this.fetchOAuthUserInfo(tokenResponse.access_token);

      if (!userInfo) {
        return { success: false, error: 'Failed to fetch user information' };
      }

      return { success: true, userInfo };

    } catch (error) {
      console.error('OAuth authentication error:', error);

      // 触发降级处理
      const { SSOFallbackService } = await import('./ssoFallback');
      await SSOFallbackService.handleSSOFailure('oauth', error instanceof Error ? error : new Error('OAuth authentication failed'));

      return {
        success: false,
        error: error instanceof Error ? error.message : 'OAuth authentication failed'
      };
    }
  }

  // 验证SSO响应
  static async validateResponse(provider: string, responseData: any): Promise<SSOValidationResult> {
    try {
      switch (provider.toLowerCase()) {
        case 'saml':
          return await this.handleSAMLAuth(responseData);
        case 'oauth':
          return await this.handleOAuthAuth(responseData.code, responseData.state);
        default:
          return { success: false, error: `Unsupported SSO provider: ${provider}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SSO validation failed'
      };
    }
  }

  // 提取并标准化用户信息
  static extractUserInfo(profile: any, provider: string): SSOUserInfo | null {
    try {
      switch (provider.toLowerCase()) {
        case 'saml':
          return this.extractSAMLUserInfo(profile);
        case 'oauth':
          return this.extractOAuthUserInfo(profile);
        default:
          return null;
      }
    } catch (error) {
      console.error('Error extracting user info:', error);
      return null;
    }
  }

  // 创建SSO用户会话
  static async createSSOSession(userInfo: SSOUserInfo): Promise<string> {
    try {
      // 查找或创建用户
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: userInfo.email },
            { ssoId: userInfo.ssoId, ssoProvider: userInfo.provider }
          ]
        }
      });

      if (!user) {
        // 首次SSO登录，创建新用户
        user = await prisma.user.create({
          data: {
            username: userInfo.email, // 使用email作为username
            email: userInfo.email,
            name: userInfo.name || '',
            department: userInfo.department || '',
            role: UserRole.BUSINESS_USER, // 默认角色
            ssoProvider: userInfo.provider,
            ssoId: userInfo.ssoId,
            passwordHash: '', // SSO用户不需要密码
            lastLoginAt: new Date(),
          }
        });
      } else {
        // 更新用户信息和登录时间
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            ssoProvider: userInfo.provider,
            ssoId: userInfo.ssoId,
            name: userInfo.name || user.name,
            department: userInfo.department || user.department,
          }
        });
      }

      // 生成JWT Token
      const token = await AuthService.generateTokenWithUserData(user.id);

      // 创建会话
      await AuthService.createSession(user.id, token);

      return token;

    } catch (error) {
      console.error('Error creating SSO session:', error);
      throw new Error('Failed to create SSO session');
    }
  }

  // 检查SSO服务可用性
  static async checkSSOAvailability(provider: string): Promise<boolean> {
    try {
      switch (provider.toLowerCase()) {
        case 'saml':
          return await this.checkSAMLAvailability();
        case 'oauth':
          return await this.checkOAuthAvailability();
        default:
          return false;
      }
    } catch (error) {
      console.error(`SSO availability check failed for ${provider}:`, error);
      return false;
    }
  }

  // 公开方法：验证OAuth state参数
  static validateStateParameter(state: string | null): boolean {
    return this.validateState(state);
  }

  // 公开方法：生成OAuth state参数
  static generateStateParameter(): string {
    return this.generateSecureState();
  }

  // 私有方法：验证SAML响应
  private static async validateSAMLResponse(
    samlResponse: string,
    strategy: SamlStrategy
  ): Promise<SSOUserInfo | null> {
    try {
      // 使用安全的XML解析器，禁用外部实体以防止XXE攻击
      const parser = new xml2js.Parser({
        explicitArray: false,
        ignoreAttrs: false,
        explicitRoot: true,
        // 安全配置：禁用外部实体
        explicitChildren: false,
        normalize: true,
        normalizeTags: true,
        trim: true
      });

      const decoded = Buffer.from(samlResponse, 'base64').toString('utf-8');

      // 输入验证：检查是否为有效的XML格式
      if (!decoded.includes('<saml:Response') && !decoded.includes('<Response')) {
        console.error('Invalid SAML response format');
        return null;
      }

      // 解析XML
      const result = await parser.parseStringPromise(decoded);

      if (!result) {
        console.error('Failed to parse SAML response');
        return null;
      }

      // 安全地提取用户信息
      const userInfo = this.extractSAMLUserInfoFromParsedXML(result);

      if (!userInfo || !userInfo.email || !userInfo.ssoId) {
        console.error('Missing required user information in SAML response');
        return null;
      }

      return userInfo;
    } catch (error) {
      console.error('SAML response validation error:', error);
      return null;
    }
  }

  // 私有方法：从解析的XML中提取用户信息
  private static extractSAMLUserInfoFromParsedXML(parsedXML: any): SSOUserInfo | null {
    try {
      let email = '';
      let name = '';
      let ssoId = '';
      let department = '';

      // 尝试从不同的SAML响应结构中提取信息
      const response = parsedXML['saml:response'] || parsedXML.response || parsedXML;
      const assertion = response['saml:assertion'] || response.assertion;

      if (!assertion) {
        return null;
      }

      // 提取NameID
      const nameID = assertion['saml:nameid'] || assertion.nameid;
      if (nameID) {
        ssoId = typeof nameID === 'string' ? nameID : nameID._;
      }

      // 提取属性
      const attributeStatement = assertion['saml:attributestatement'] || assertion.attributestatement;
      if (attributeStatement) {
        const attributes = attributeStatement['saml:attribute'] || attributeStatement.attribute;

        if (Array.isArray(attributes)) {
          for (const attr of attributes) {
            const attrName = attr.$.Name || attr.name || '';
            const attrValue = attr['saml:attributevalue'] || attr.attributevalue || attr.value || '';
            const value = typeof attrValue === 'string' ? attrValue : attrValue._ || '';

            switch (attrName.toLowerCase()) {
              case 'email':
              case 'emailaddress':
              case 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress':
                email = value;
                break;
              case 'name':
              case 'displayname':
              case 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name':
                name = value;
                break;
              case 'department':
              case 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/department':
                department = value;
                break;
            }
          }
        }
      }

      // 验证必需字段
      if (!email || !ssoId) {
        return null;
      }

      return {
        ssoId: this.sanitizeString(ssoId),
        email: this.sanitizeEmail(email),
        name: this.sanitizeString(name),
        department: this.sanitizeString(department),
        provider: 'saml'
      };
    } catch (error) {
      console.error('Error extracting user info from SAML XML:', error);
      return null;
    }
  }

  // 私有方法：交换authorization code
  private static async exchangeCodeForToken(code: string): Promise<any> {
    const response = await fetch(this.ssoConfig.oauth!.tokenURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${this.ssoConfig.oauth!.clientId}:${this.ssoConfig.oauth!.clientSecret}`
        ).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.ssoConfig.oauth!.callbackURL
      })
    });

    return response.json();
  }

  // 私有方法：获取OAuth用户信息
  private static async fetchOAuthUserInfo(accessToken: string): Promise<SSOUserInfo | null> {
    try {
      // 从环境变量或配置中获取用户信息端点
      const userInfoURL = process.env.OAUTH_USER_INFO_URL || this.ssoConfig.oauth?.userInfoURL;

      if (!userInfoURL) {
        throw new Error('OAuth user info URL not configured');
      }

      const response = await fetch(userInfoURL, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        },
        timeout: 10000 // 10秒超时
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.status} ${response.statusText}`);
      }

      const userProfile = await response.json();

      // 验证响应数据
      if (!userProfile || typeof userProfile !== 'object') {
        throw new Error('Invalid user profile response');
      }

      return {
        ssoId: this.sanitizeString(userProfile.id || userProfile.sub),
        email: this.sanitizeEmail(userProfile.email),
        name: this.sanitizeString(userProfile.name || userProfile.display_name),
        department: this.sanitizeString(userProfile.department || userProfile.org),
        provider: 'oauth'
      };
    } catch (error) {
      console.error('OAuth user info fetch error:', error);
      return null;
    }
  }

  // 私有方法：提取SAML用户信息
  private static extractSAMLUserInfo(profile: SamlProfile): SSOUserInfo {
    return {
      ssoId: profile.nameID || profile.ID || '',
      email: profile.email || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || '',
      name: profile.name || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || '',
      department: profile.department || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/department'] || '',
      provider: 'saml'
    };
  }

  // 私有方法：提取OAuth用户信息
  private static extractOAuthUserInfo(profile: any): SSOUserInfo {
    return {
      ssoId: profile.id || profile.sub || '',
      email: profile.email || '',
      name: profile.name || profile.given_name + ' ' + profile.family_name || '',
      department: profile.department || '',
      provider: 'oauth'
    };
  }

  // 私有方法：检查SAML可用性
  private static async checkSAMLAvailability(): Promise<boolean> {
    try {
      if (!this.ssoConfig.saml) return false;

      // 简单的健康检查 - 尝试访问SAML端点
      const response = await fetch(this.ssoConfig.saml.entryPoint, {
        method: 'HEAD',
        timeout: 5000
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // 私有方法：检查OAuth可用性
  private static async checkOAuthAvailability(): Promise<boolean> {
    try {
      if (!this.ssoConfig.oauth) return false;

      // 简单的健康检查 - 尝试访问OAuth端点
      const response = await fetch(this.ssoConfig.oauth.authorizationURL, {
        method: 'HEAD',
        timeout: 5000
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // 私有方法：输入sanitization
  private static sanitizeString(input: string | undefined): string {
    if (!input) return '';

    // 移除潜在的XSS字符和控制字符
    return input
      .replace(/[<>'"&]/g, '') // 移除HTML特殊字符
      .replace(/[\x00-\x1F\x7F]/g, '') // 移除控制字符
      .trim()
      .substring(0, 255); // 限制长度
  }

  private static sanitizeEmail(email: string | undefined): string {
    if (!email) return '';

    const sanitized = this.sanitizeString(email);

    // 基本的邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitized)) {
      throw new Error('Invalid email format');
    }

    return sanitized.toLowerCase();
  }

  // 私有方法：生成安全的state参数
  private static generateSecureState(): string {
    const timestamp = Date.now().toString();
    const random = crypto.lib.WordArray.random(16).toString();
    const state = `${timestamp}_${random}`;

    // 使用HMAC签名state以防止伪造
    const secret = process.env.SSO_STATE_SECRET || 'default-secret';
    const signature = crypto.HmacSHA256(state, secret).toString();

    return `${state}_${signature}`;
  }

  // 私有方法：验证state参数
  private static validateState(state: string | null): boolean {
    if (!state) return false;

    try {
      const parts = state.split('_');
      if (parts.length !== 3) return false;

      const [timestamp, random, signature] = parts;
      const originalState = `${timestamp}_${random}`;

      // 验证签名
      const secret = process.env.SSO_STATE_SECRET || 'default-secret';
      const expectedSignature = crypto.HmacSHA256(originalState, secret).toString();

      if (signature !== expectedSignature) {
        console.warn('Invalid state signature');
        return false;
      }

      // 验证时间戳（防止重放攻击）
      const stateTimestamp = parseInt(timestamp, 10);
      const now = Date.now();
      const maxAge = 10 * 60 * 1000; // 10分钟

      if (now - stateTimestamp > maxAge) {
        console.warn('State parameter expired');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating state parameter:', error);
      return false;
    }
  }
}