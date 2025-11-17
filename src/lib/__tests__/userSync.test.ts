import { UserSyncService, UserSyncResult } from '../userSync';
import { SSOUserInfo } from '../sso';
import { UserRole } from '@prisma/client';

// Mock dependencies
jest.mock('../prisma', () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    }
  }
}));

describe('UserSyncService', () => {
  const mockSSOUserInfo: SSOUserInfo = {
    ssoId: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    department: 'IT',
    provider: 'saml'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Configure with default settings
    UserSyncService.configure({
      autoCreateUser: true,
      defaultRole: UserRole.BUSINESS_USER,
      allowRoleUpdate: false,
      requiredFields: ['email']
    });
  });

  describe('configure', () => {
    it('should update configuration', () => {
      const newConfig = {
        autoCreateUser: false,
        defaultRole: UserRole.ASSET_MANAGER
      };

      expect(() => UserSyncService.configure(newConfig)).not.toThrow();
    });
  });

  describe('syncUserFromSSO', () => {
    const { prisma } = require('../prisma');

    it('should return error for missing required fields', async () => {
      const invalidUserInfo: SSOUserInfo = {
        ssoId: 'test-123',
        email: '', // Missing required email
        provider: 'saml'
      };

      const result = await UserSyncService.syncUserFromSSO(invalidUserInfo);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });

    it('should update existing user', async () => {
      const existingUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Old Name',
        ssoProvider: null,
        ssoId: null
      };

      const updatedUser = {
        ...existingUser,
        name: 'Test User',
        ssoProvider: 'saml',
        ssoId: 'test-user-123'
      };

      prisma.user.findFirst.mockResolvedValue(existingUser);
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await UserSyncService.syncUserFromSSO(mockSSOUserInfo);

      expect(result.success).toBe(true);
      expect(result.user).toEqual(updatedUser);
      expect(result.updated).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: expect.objectContaining({
          name: mockSSOUserInfo.name,
          ssoProvider: mockSSOUserInfo.provider,
          ssoId: mockSSOUserInfo.ssoId
        })
      });
    });

    it('should create new user when auto-creation is enabled', async () => {
      const newUser = {
        id: 'new-user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: UserRole.BUSINESS_USER,
        ssoProvider: 'saml',
        ssoId: 'test-user-123'
      };

      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(newUser);

      const result = await UserSyncService.syncUserFromSSO(mockSSOUserInfo);

      expect(result.success).toBe(true);
      expect(result.user).toEqual(newUser);
      expect(result.created).toBe(true);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: 'test',
          email: mockSSOUserInfo.email,
          name: mockSSOUserInfo.name,
          department: mockSSOUserInfo.department,
          role: UserRole.BUSINESS_USER,
          ssoProvider: mockSSOUserInfo.provider,
          ssoId: mockSSOUserInfo.ssoId,
          passwordHash: ''
        })
      });
    });

    it('should return error when user not found and auto-creation is disabled', async () => {
      UserSyncService.configure({ autoCreateUser: false });

      prisma.user.findFirst.mockResolvedValue(null);

      const result = await UserSyncService.syncUserFromSSO(mockSSOUserInfo);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found and auto-creation is disabled');
    });
  });

  describe('createUserAccount', () => {
    const { prisma } = require('../prisma');

    it('should create new user account', async () => {
      const newUser = {
        id: 'new-user-123',
        username: 'test',
        email: 'test@example.com',
        name: 'Test User',
        role: UserRole.BUSINESS_USER
      };

      prisma.user.create.mockResolvedValue(newUser);

      const result = await UserSyncService.createUserAccount(mockSSOUserInfo);

      expect(result.success).toBe(true);
      expect(result.user).toEqual(newUser);
      expect(result.created).toBe(true);
    });

    it('should handle creation error', async () => {
      prisma.user.create.mockRejectedValue(new Error('Database error'));

      const result = await UserSyncService.createUserAccount(mockSSOUserInfo);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('updateUserInfo', () => {
    const { prisma } = require('../prisma');

    it('should update user information', async () => {
      const updatedUser = {
        id: 'user-123',
        name: 'Updated Name',
        department: 'Updated Department'
      };

      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await UserSyncService.updateUserInfo('user-123', {
        name: 'Updated Name',
        department: 'Updated Department'
      });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(updatedUser);
      expect(result.updated).toBe(true);
    });

    it('should handle update error', async () => {
      prisma.user.update.mockRejectedValue(new Error('Update failed'));

      const result = await UserSyncService.updateUserInfo('user-123', {
        name: 'Updated Name'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  describe('batchSyncUsers', () => {
    const { prisma } = require('../prisma');

    it('should sync multiple users', async () => {
      const users: SSOUserInfo[] = [
        {
          ssoId: 'user-1',
          email: 'user1@example.com',
          name: 'User 1',
          provider: 'saml'
        },
        {
          ssoId: 'user-2',
          email: 'user2@example.com',
          name: 'User 2',
          provider: 'saml'
        }
      ];

      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'new-user' });

      const results = await UserSyncService.batchSyncUsers(users);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle mixed success/failure in batch sync', async () => {
      const users: SSOUserInfo[] = [
        {
          ssoId: 'user-1',
          email: 'user1@example.com',
          name: 'User 1',
          provider: 'saml'
        },
        {
          ssoId: 'user-2',
          email: '', // Invalid email
          provider: 'saml'
        }
      ];

      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'new-user' });

      const results = await UserSyncService.batchSyncUsers(users);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe('validateUserData', () => {
    it('should validate correct user data', () => {
      const result = UserSyncService.validateUserData(mockSSOUserInfo);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid email', () => {
      const invalidUserInfo: SSOUserInfo = {
        ...mockSSOUserInfo,
        email: 'invalid-email'
      };

      const result = UserSyncService.validateUserData(invalidUserInfo);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    it('should reject missing SSO ID', () => {
      const invalidUserInfo: SSOUserInfo = {
        ...mockSSOUserInfo,
        ssoId: ''
      };

      const result = UserSyncService.validateUserData(invalidUserInfo);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing SSO ID');
    });

    it('should reject invalid provider', () => {
      const invalidUserInfo: SSOUserInfo = {
        ...mockSSOUserInfo,
        provider: 'invalid-provider' as any
      };

      const result = UserSyncService.validateUserData(invalidUserInfo);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid SSO provider');
    });
  });

  describe('getSyncStatistics', () => {
    const { prisma } = require('../prisma');

    it('should return sync statistics', async () => {
      prisma.user.count
        .mockResolvedValueOnce(100) // Total users
        .mockResolvedValueOnce(75); // SSO users

      prisma.user.findFirst.mockResolvedValue({
        updatedAt: new Date('2023-01-01')
      });

      const stats = await UserSyncService.getSyncStatistics();

      expect(stats.totalUsers).toBe(100);
      expect(stats.ssoUsers).toBe(75);
      expect(stats.localUsers).toBe(25);
      expect(stats.lastSyncTime).toEqual(new Date('2023-01-01'));
    });

    it('should handle errors in statistics retrieval', async () => {
      prisma.user.count.mockRejectedValue(new Error('Database error'));

      const stats = await UserSyncService.getSyncStatistics();

      expect(stats.totalUsers).toBe(0);
      expect(stats.ssoUsers).toBe(0);
      expect(stats.localUsers).toBe(0);
      expect(stats.lastSyncTime).toBeNull();
    });
  });
});