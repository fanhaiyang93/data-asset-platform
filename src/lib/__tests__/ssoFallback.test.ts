import { SSOFallbackService, FallbackStrategy } from '../ssoFallback';

// Mock dependencies
jest.mock('../sso', () => ({
  SSOService: {
    checkSSOAvailability: jest.fn()
  }
}));

jest.mock('../auth', () => ({
  AuthService: {
    verifyPassword: jest.fn(),
    generateTokenWithUserData: jest.fn()
  }
}));

jest.mock('../prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn()
    }
  }
}));

describe('SSOFallbackService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();

    // Reset service state
    SSOFallbackService.stopHealthChecks();
    SSOFallbackService.configure({
      enabled: true,
      healthCheckInterval: 30000,
      fallbackAfterFailures: 3,
      retryInterval: 60000,
      maxRetryAttempts: 10,
      localAuthEnabled: true,
      maintenanceMode: false
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    SSOFallbackService.stopHealthChecks();
  });

  describe('configure', () => {
    it('should update configuration', () => {
      const newConfig = {
        fallbackAfterFailures: 5,
        localAuthEnabled: false
      };

      expect(() => SSOFallbackService.configure(newConfig)).not.toThrow();
    });
  });

  describe('startHealthChecks', () => {
    const { SSOService } = require('../sso');

    it('should start health checks for providers', () => {
      const providers = ['saml', 'oauth'];
      SSOService.checkSSOAvailability.mockResolvedValue(true);

      SSOFallbackService.startHealthChecks(providers);

      // Verify health status initialized
      const samlHealth = SSOFallbackService.getProviderHealth('saml');
      const oauthHealth = SSOFallbackService.getProviderHealth('oauth');

      expect(samlHealth).toBeDefined();
      expect(oauthHealth).toBeDefined();
      expect(samlHealth?.provider).toBe('saml');
      expect(oauthHealth?.provider).toBe('oauth');
    });

    it('should not start health checks when disabled', () => {
      SSOFallbackService.configure({ enabled: false });

      const providers = ['saml'];
      SSOFallbackService.startHealthChecks(providers);

      const health = SSOFallbackService.getProviderHealth('saml');
      expect(health).toBeNull();
    });
  });

  describe('checkSSOAvailability', () => {
    const { SSOService } = require('../sso');

    it('should check and update provider health status', async () => {
      SSOService.checkSSOAvailability.mockResolvedValue(true);
      SSOFallbackService.startHealthChecks(['saml']);

      const result = await SSOFallbackService.checkSSOAvailability('saml');

      expect(result).toBe(true);

      const health = SSOFallbackService.getProviderHealth('saml');
      expect(health?.healthy).toBe(true);
      expect(health?.consecutiveFailures).toBe(0);
    });

    it('should handle SSO service failures', async () => {
      SSOService.checkSSOAvailability.mockResolvedValue(false);
      SSOFallbackService.startHealthChecks(['saml']);

      const result = await SSOFallbackService.checkSSOAvailability('saml');

      expect(result).toBe(false);

      const health = SSOFallbackService.getProviderHealth('saml');
      expect(health?.healthy).toBe(false);
      expect(health?.consecutiveFailures).toBe(1);
    });

    it('should handle exceptions during health check', async () => {
      SSOService.checkSSOAvailability.mockRejectedValue(new Error('Network error'));
      SSOFallbackService.startHealthChecks(['saml']);

      const result = await SSOFallbackService.checkSSOAvailability('saml');

      expect(result).toBe(false);

      const health = SSOFallbackService.getProviderHealth('saml');
      expect(health?.healthy).toBe(false);
      expect(health?.lastError).toBe('Network error');
    });
  });

  describe('getFallbackStrategy', () => {
    it('should return maintenance mode when enabled', () => {
      SSOFallbackService.configure({ maintenanceMode: true });

      const strategy = SSOFallbackService.getFallbackStrategy('saml');

      expect(strategy).toBe(FallbackStrategy.MAINTENANCE_MODE);
    });

    it('should return local auth when fallback is active', () => {
      SSOFallbackService.setFallbackMode('saml', true);

      const strategy = SSOFallbackService.getFallbackStrategy('saml');

      expect(strategy).toBe(FallbackStrategy.LOCAL_AUTH);
    });

    it('should return queue requests by default', () => {
      const strategy = SSOFallbackService.getFallbackStrategy('saml');

      expect(strategy).toBe(FallbackStrategy.QUEUE_REQUESTS);
    });
  });

  describe('handleSSOFailure', () => {
    it('should track failures and activate fallback', async () => {
      SSOFallbackService.startHealthChecks(['saml']);

      // Simulate consecutive failures
      for (let i = 0; i < 3; i++) {
        await SSOFallbackService.handleSSOFailure('saml', new Error('SSO failed'));
      }

      const result = await SSOFallbackService.handleSSOFailure('saml', new Error('SSO failed'));

      expect(result.shouldFallback).toBe(true);
      expect(result.strategy).toBe(FallbackStrategy.LOCAL_AUTH);
      expect(result.message).toContain('SSO服务暂时不可用');
    });

    it('should not activate fallback before threshold', async () => {
      SSOFallbackService.startHealthChecks(['saml']);

      const result = await SSOFallbackService.handleSSOFailure('saml', new Error('SSO failed'));

      expect(result.shouldFallback).toBe(false);
    });
  });

  describe('fallbackToLocalAuth', () => {
    const { AuthService } = require('../auth');
    const { prisma } = require('../prisma');

    it('should authenticate user with local credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'BUSINESS_USER',
        passwordHash: 'hashed-password'
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      AuthService.verifyPassword.mockResolvedValue(true);
      AuthService.generateTokenWithUserData.mockResolvedValue('auth-token');

      const result = await SSOFallbackService.fallbackToLocalAuth('test@example.com', 'password');

      expect(result.success).toBe(true);
      expect(result.token).toBe('auth-token');
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role
      });
    });

    it('should reject invalid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password'
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      AuthService.verifyPassword.mockResolvedValue(false);

      const result = await SSOFallbackService.fallbackToLocalAuth('test@example.com', 'wrong-password');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await SSOFallbackService.fallbackToLocalAuth('nonexistent@example.com', 'password');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found or SSO-only account');
    });

    it('should reject when local auth is disabled', async () => {
      SSOFallbackService.configure({ localAuthEnabled: false });

      const result = await SSOFallbackService.fallbackToLocalAuth('test@example.com', 'password');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Local authentication is disabled');
    });
  });

  describe('getHealthStatuses', () => {
    it('should return all provider health statuses', () => {
      SSOFallbackService.startHealthChecks(['saml', 'oauth']);

      const statuses = SSOFallbackService.getHealthStatuses();

      expect(statuses).toHaveLength(2);
      expect(statuses.map(s => s.provider)).toEqual(['saml', 'oauth']);
    });
  });

  describe('getProviderHealth', () => {
    it('should return specific provider health', () => {
      SSOFallbackService.startHealthChecks(['saml']);

      const health = SSOFallbackService.getProviderHealth('saml');

      expect(health).toBeDefined();
      expect(health?.provider).toBe('saml');
    });

    it('should return null for non-existent provider', () => {
      const health = SSOFallbackService.getProviderHealth('nonexistent');

      expect(health).toBeNull();
    });
  });

  describe('manualHealthCheck', () => {
    const { SSOService } = require('../sso');

    it('should perform manual health check', async () => {
      SSOService.checkSSOAvailability.mockResolvedValue(true);
      SSOFallbackService.startHealthChecks(['saml']);

      const result = await SSOFallbackService.manualHealthCheck('saml');

      expect(result).toBeDefined();
      expect(result.provider).toBe('saml');
      expect(SSOService.checkSSOAvailability).toHaveBeenCalledWith('saml');
    });
  });

  describe('resetProviderStatus', () => {
    it('should reset provider health status', () => {
      SSOFallbackService.startHealthChecks(['saml']);
      SSOFallbackService.setFallbackMode('saml', true);

      // Simulate failure
      const health = SSOFallbackService.getProviderHealth('saml');
      if (health) {
        health.consecutiveFailures = 5;
        health.healthy = false;
      }

      SSOFallbackService.resetProviderStatus('saml');

      const resetHealth = SSOFallbackService.getProviderHealth('saml');
      expect(resetHealth?.healthy).toBe(true);
      expect(resetHealth?.consecutiveFailures).toBe(0);
    });
  });

  describe('getFallbackStatistics', () => {
    it('should return fallback statistics', () => {
      SSOFallbackService.startHealthChecks(['saml', 'oauth']);
      SSOFallbackService.setFallbackMode('saml', true);

      const stats = SSOFallbackService.getFallbackStatistics();

      expect(stats.totalProviders).toBe(2);
      expect(stats.healthyProviders).toBe(2); // Both start healthy
      expect(stats.fallbackActive).toBe(1); // One in fallback mode
    });
  });

  describe('periodic health checks', () => {
    const { SSOService } = require('../sso');

    it('should run periodic health checks', async () => {
      SSOService.checkSSOAvailability.mockResolvedValue(true);
      SSOFallbackService.configure({ healthCheckInterval: 1000 });

      SSOFallbackService.startHealthChecks(['saml']);

      // Fast-forward timer
      jest.advanceTimersByTime(1000);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(SSOService.checkSSOAvailability).toHaveBeenCalledTimes(2); // Initial + periodic
    });
  });
});