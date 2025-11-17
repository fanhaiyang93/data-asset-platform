import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PlatformIntegrationService } from '@/lib/services/platformIntegration';
import { SSOAuthService } from '@/lib/services/ssoAuth';
import { User, Application } from '@prisma/client';
import * as crypto from 'crypto';

// Mock SSOAuthService
jest.mock('@/lib/services/ssoAuth');
const mockSSOAuthService = SSOAuthService as jest.Mocked<typeof SSOAuthService>;

describe('PlatformIntegrationService', () => {
  const mockUser: User = {
    id: 'user-1',
    email: 'test@company.com',
    name: 'Test User',
    department: 'IT',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockApplication: Application = {
    id: 'app-1',
    userId: 'user-1',
    assetId: 'asset-1',
    purpose: 'Data analysis for quarterly report',
    priority: 'high',
    status: 'pending',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date(),
    processedAt: null,
    notes: null
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // 设置环境变量
    process.env.PLATFORM_ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';
    process.env.PLATFORM_SIGNATURE_SECRET = 'test-signature-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.HIVE_PLATFORM_URL = 'https://hive.test.com';
    process.env.OA_SYSTEM_URL = 'https://oa.test.com';

    // Mock SSO service
    mockSSOAuthService.generateSSOToken.mockResolvedValue('mock-sso-token');
    mockSSOAuthService.createUserIdentityMapping.mockResolvedValue({
      userId: mockUser.id,
      email: mockUser.email,
      platform: 'hive',
      dataPermissions: ['read', 'write']
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSupportedPlatforms', () => {
    it('应该返回支持的平台列表', () => {
      const platforms = PlatformIntegrationService.getSupportedPlatforms();

      expect(platforms).toContain('hive');
      expect(platforms).toContain('enterprise_wechat');
      expect(platforms).toContain('oa_system');
      expect(platforms.length).toBeGreaterThan(0);
    });
  });

  describe('getPlatformConfig', () => {
    it('应该返回hive平台配置', () => {
      const config = PlatformIntegrationService.getPlatformConfig('hive');

      expect(config).toBeDefined();
      expect(config?.platform).toBe('hive');
      expect(config?.baseUrl).toBe('https://hive.test.com');
      expect(config?.requiredParams).toContain('user_token');
      expect(config?.requiredParams).toContain('application_id');
    });

    it('应该为不支持的平台返回null', () => {
      const config = PlatformIntegrationService.getPlatformConfig('unknown');
      expect(config).toBeNull();
    });
  });

  describe('buildRedirectUrl', () => {
    it('应该为hive平台构建正确的跳转URL', async () => {
      const url = await PlatformIntegrationService.buildRedirectUrl(
        'hive',
        mockUser,
        mockApplication,
        { isMobile: false }
      );

      expect(url).toContain('https://hive.test.com');
      expect(url).toContain('user_token=mock-sso-token');
      expect(url).toContain('application_id=app-1');
      expect(url).toContain('hive_username=test');
      expect(url).toContain('callback=http://localhost:3000/api/platform/callback/hive');

      // 验证SSO token生成被调用
      expect(mockSSOAuthService.generateSSOToken).toHaveBeenCalledWith(
        mockUser,
        mockApplication,
        'hive'
      );
    });

    it('应该为enterprise_wechat平台构建正确的跳转URL', async () => {
      const url = await PlatformIntegrationService.buildRedirectUrl(
        'enterprise_wechat',
        mockUser,
        mockApplication
      );

      expect(url).toContain('https://work.weixin.qq.com');
      expect(url).toContain('access_token=mock-sso-token');
      expect(url).toContain('user_id=test@company.com');
      expect(url).toContain('template_id=data_access_approval');
    });

    it('应该为oa_system平台构建正确的跳转URL', async () => {
      const url = await PlatformIntegrationService.buildRedirectUrl(
        'oa_system',
        mockUser,
        mockApplication
      );

      expect(url).toContain('https://oa.test.com');
      expect(url).toContain('auth_token=mock-sso-token');
      expect(url).toContain('workflow_id=data_approval_workflow');
    });

    it('不支持的平台应该抛出错误', async () => {
      await expect(
        PlatformIntegrationService.buildRedirectUrl(
          'unsupported',
          mockUser,
          mockApplication
        )
      ).rejects.toThrow('不支持的平台: unsupported');
    });

    it('SSO token生成失败应该抛出错误', async () => {
      mockSSOAuthService.generateSSOToken.mockRejectedValue(
        new Error('Token generation failed')
      );

      await expect(
        PlatformIntegrationService.buildRedirectUrl(
          'hive',
          mockUser,
          mockApplication
        )
      ).rejects.toThrow('构建跳转URL失败');
    });
  });

  describe('serializeApplicationData', () => {
    it('应该正确序列化申请数据', async () => {
      const serialized = await PlatformIntegrationService.serializeApplicationData(
        mockApplication
      );

      expect(serialized).toMatchObject({
        id: mockApplication.id,
        assetId: mockApplication.assetId,
        purpose: mockApplication.purpose,
        priority: mockApplication.priority,
        status: mockApplication.status,
        createdAt: mockApplication.createdAt.toISOString(),
        metadata: {
          type: 'data_access_application',
          version: '1.0'
        }
      });

      // 确保不包含敏感信息
      expect(serialized).not.toHaveProperty('userId');
      expect(serialized).not.toHaveProperty('processedAt');
    });
  });

  describe('encryptParameters 和 decryptParameters', () => {
    const testParams = {
      applicationId: 'app-1',
      userId: 'user-1',
      platform: 'hive',
      assetInfo: { assetId: 'asset-1' }
    };

    it('应该成功加密和解密参数', () => {
      const encrypted = PlatformIntegrationService.encryptParameters(testParams);

      expect(encrypted).toHaveProperty('data');
      expect(encrypted).toHaveProperty('signature');
      expect(encrypted).toHaveProperty('timestamp');
      expect(typeof encrypted.data).toBe('string');
      expect(typeof encrypted.signature).toBe('string');
      expect(typeof encrypted.timestamp).toBe('number');

      const decrypted = PlatformIntegrationService.decryptParameters(encrypted);

      expect(decrypted).toMatchObject(testParams);
      expect(decrypted?.timestamp).toBe(encrypted.timestamp);
    });

    it('应该拒绝被篡改的数据', () => {
      const encrypted = PlatformIntegrationService.encryptParameters(testParams);

      // 篡改签名
      const tamperedParams = {
        ...encrypted,
        signature: 'tampered-signature'
      };

      const decrypted = PlatformIntegrationService.decryptParameters(tamperedParams);
      expect(decrypted).toBeNull();
    });

    it('应该拒绝过期的参数', () => {
      const encrypted = PlatformIntegrationService.encryptParameters(testParams);

      // 伪造过期时间戳（31分钟前）
      const expiredParams = {
        ...encrypted,
        timestamp: Date.now() - (31 * 60 * 1000)
      };

      // 重新计算正确的签名，但时间戳是过期的
      const expectedSignature = crypto
        .createHmac('sha256', 'test-signature-secret')
        .update(expiredParams.data + expiredParams.timestamp)
        .digest('hex');

      expiredParams.signature = expectedSignature;

      const decrypted = PlatformIntegrationService.decryptParameters(expiredParams);
      expect(decrypted).toBeNull();
    });

    it('无效的加密数据应该返回null', () => {
      const invalidParams = {
        data: 'invalid-encrypted-data',
        signature: 'invalid-signature',
        timestamp: Date.now()
      };

      const decrypted = PlatformIntegrationService.decryptParameters(invalidParams);
      expect(decrypted).toBeNull();
    });
  });

  describe('validateParameters', () => {
    it('应该验证hive平台的必需参数', () => {
      const validParams = {
        user_token: 'token123',
        application_id: 'app-1'
      };

      const result = PlatformIntegrationService.validateParameters('hive', validParams);

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('应该识别缺失的必需参数', () => {
      const invalidParams = {
        user_token: 'token123'
        // 缺少 application_id
      };

      const result = PlatformIntegrationService.validateParameters('hive', invalidParams);

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('application_id');
    });

    it('不支持的平台应该返回无效', () => {
      const result = PlatformIntegrationService.validateParameters(
        'unsupported',
        { any: 'params' }
      );

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('platform not supported');
    });
  });

  describe('convertParameterFormat', () => {
    it('应该返回原参数（当前实现）', async () => {
      const originalParams = { test: 'value' };

      const converted = await PlatformIntegrationService.convertParameterFormat(
        'hive',
        'enterprise_wechat',
        originalParams
      );

      expect(converted).toEqual(originalParams);
    });
  });
});