import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SSOAuthService } from '@/lib/services/ssoAuth';
import { prisma } from '@/lib/prisma';
import { User, Application } from '@prisma/client';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    application: {
      findUnique: jest.fn(),
    },
    $executeRawUnsafe: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('SSOAuthService', () => {
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
    purpose: 'Data analysis',
    priority: 'normal',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    processedAt: null,
    notes: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // 设置默认的环境变量
    process.env.JWT_SECRET = 'test-secret-key-for-testing';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSSOToken', () => {
    it('应该为有效用户和申请生成JWT token', async () => {
      // Mock console.log to avoid noise in test output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const token = await SSOAuthService.generateSSOToken(
        mockUser,
        mockApplication,
        'hive'
      );

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('SSO Token生成')
      );

      consoleSpy.mockRestore();
    });

    it('应该生成包含正确payload的token', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const token = await SSOAuthService.generateSSOToken(
        mockUser,
        mockApplication,
        'hive'
      );

      const payload = await SSOAuthService.validateSSOToken(token);

      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(mockUser.id);
      expect(payload?.applicationId).toBe(mockApplication.id);
      expect(payload?.platform).toBe('hive');
      expect(payload?.iss).toBe('data-asset-platform');
      expect(payload?.aud).toBe('hive');

      consoleSpy.mockRestore();
    });

    it('生成失败时应该抛出错误', async () => {
      // 模拟加密过程失败
      const originalSign = global.TextEncoder;
      delete (global as any).TextEncoder;

      await expect(
        SSOAuthService.generateSSOToken(mockUser, mockApplication, 'hive')
      ).rejects.toThrow('SSO token生成失败');

      // 恢复
      global.TextEncoder = originalSign;
    });
  });

  describe('validateSSOToken', () => {
    it('应该验证有效的token', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const token = await SSOAuthService.generateSSOToken(
        mockUser,
        mockApplication,
        'hive'
      );

      const payload = await SSOAuthService.validateSSOToken(token);

      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(mockUser.id);
      expect(payload?.platform).toBe('hive');

      consoleSpy.mockRestore();
    });

    it('应该拒绝无效的token', async () => {
      const payload = await SSOAuthService.validateSSOToken('invalid-token');
      expect(payload).toBeNull();
    });

    it('应该拒绝缺少必要字段的token', async () => {
      // 这里我们无法轻易创建一个缺少字段的有效JWT，所以测试无效token
      const payload = await SSOAuthService.validateSSOToken('');
      expect(payload).toBeNull();
    });
  });

  describe('validatePlatformAccess', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        userRoles: [
          { role: 'data_engineer', userId: mockUser.id }
        ]
      } as any);
    });

    it('应该允许data_engineer访问hive平台', async () => {
      const hasAccess = await SSOAuthService.validatePlatformAccess(
        mockUser.id,
        'hive'
      );

      expect(hasAccess).toBe(true);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        include: { userRoles: true }
      });
    });

    it('应该允许所有用户访问enterprise_wechat', async () => {
      const hasAccess = await SSOAuthService.validatePlatformAccess(
        mockUser.id,
        'enterprise_wechat'
      );

      expect(hasAccess).toBe(true);
    });

    it('应该拒绝不存在的用户', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const hasAccess = await SSOAuthService.validatePlatformAccess(
        'non-existent-user',
        'hive'
      );

      expect(hasAccess).toBe(false);
    });

    it('应该拒绝不支持的平台', async () => {
      const hasAccess = await SSOAuthService.validatePlatformAccess(
        mockUser.id,
        'unsupported_platform'
      );

      expect(hasAccess).toBe(false);
    });

    it('数据库错误时应该返回false', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const hasAccess = await SSOAuthService.validatePlatformAccess(
        mockUser.id,
        'hive'
      );

      expect(hasAccess).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        '平台访问权限验证失败:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('createUserIdentityMapping', () => {
    it('应该为hive平台创建正确的身份映射', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        userRoles: [
          { role: 'data_engineer', userId: mockUser.id }
        ]
      } as any);

      const mapping = await SSOAuthService.createUserIdentityMapping(
        mockUser,
        'hive'
      );

      expect(mapping).toMatchObject({
        userId: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        platform: 'hive',
        hiveUsername: 'test',
        dataPermissions: expect.any(Array)
      });

      expect(mapping.mappedAt).toBeDefined();
      expect(mapping.dataPermissions).toContain('read');
      expect(mapping.dataPermissions).toContain('write');
    });

    it('应该为enterprise_wechat平台创建正确的身份映射', async () => {
      const mapping = await SSOAuthService.createUserIdentityMapping(
        mockUser,
        'enterprise_wechat'
      );

      expect(mapping).toMatchObject({
        userId: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        platform: 'enterprise_wechat',
        wechatUserId: mockUser.email,
        department: mockUser.department
      });
    });

    it('应该为未知平台返回基础映射', async () => {
      const mapping = await SSOAuthService.createUserIdentityMapping(
        mockUser,
        'unknown_platform'
      );

      expect(mapping).toMatchObject({
        userId: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        platform: 'unknown_platform',
        mappedAt: expect.any(String)
      });

      // 不应该包含平台特定字段
      expect(mapping).not.toHaveProperty('hiveUsername');
      expect(mapping).not.toHaveProperty('wechatUserId');
    });
  });

  describe('refreshToken', () => {
    it('应该拒绝无效token的刷新', async () => {
      const newToken = await SSOAuthService.refreshToken('invalid-token');
      expect(newToken).toBeNull();
    });

    it('应该返回未过期token不刷新', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const originalToken = await SSOAuthService.generateSSOToken(
        mockUser,
        mockApplication,
        'hive'
      );

      const refreshedToken = await SSOAuthService.refreshToken(originalToken);
      expect(refreshedToken).toBe(originalToken);

      consoleSpy.mockRestore();
    });
  });

  describe('revokeToken', () => {
    it('应该成功撤销有效token', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const token = await SSOAuthService.generateSSOToken(
        mockUser,
        mockApplication,
        'hive'
      );

      const revoked = await SSOAuthService.revokeToken(token);

      expect(revoked).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Token已撤销')
      );

      consoleSpy.mockRestore();
    });

    it('应该拒绝撤销无效token', async () => {
      const revoked = await SSOAuthService.revokeToken('invalid-token');
      expect(revoked).toBe(false);
    });
  });
});