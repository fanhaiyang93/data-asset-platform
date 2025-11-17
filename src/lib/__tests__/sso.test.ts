import { SSOService, SSOConfig, SSOUserInfo } from '../sso';

// Mock dependencies
jest.mock('../prisma', () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    session: {
      create: jest.fn(),
    }
  }
}));

jest.mock('../auth', () => ({
  AuthService: {
    generateTokenWithUserData: jest.fn(),
    createSession: jest.fn(),
    verifyPassword: jest.fn(),
  }
}));

jest.mock('xml2js', () => ({
  Parser: jest.fn().mockImplementation(() => ({
    parseStringPromise: jest.fn()
  }))
}));

jest.mock('crypto-js', () => ({
  lib: {
    WordArray: {
      random: jest.fn(() => ({ toString: () => 'mock-random' }))
    }
  },
  HmacSHA256: jest.fn(() => ({ toString: () => 'mock-signature' }))
}));

describe('SSOService', () => {
  const mockSSOConfig: SSOConfig = {
    saml: {
      entryPoint: 'https://example.com/saml/sso',
      issuer: 'test-issuer',
      cert: `-----BEGIN CERTIFICATE-----
MIICajCCAdOgAwIBAgIBADANBgkqhkiG9w0BAQ0FADBSMQswCQYDVQQGEwJ1czET
MBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNjbzEWMBQG
A1UECgwNVGVzdCBDb21wYW55MB4XDTE5MDEwMTAwMDAwMFoXDTI5MDEwMTAwMDAw
MFowUjELMAkGA1UEBhMCdXMxEzARBgNVBAgMCkNhbGlmb3JuaWExFjAUBgNVBAcM
DVNhbiBGcmFuY2lzY28xFjAUBgNVBAoMDVRlc3QgQ29tcGFueTCBnzANBgkqhkiG
9w0BAQEFAAOBjQAwgYkCgYEAuIj1YUkRHRLJBKXRJl5zHfKcD/qNzn6CkMJ1VQSD
7k8FKqYLdH4hKvVhNlCK5CzFvWe7FyOoOoHqLnYdQ4GrYl7QrNcKlUvKPaJzHfKc
D/qNzn6CkMJ1VQSD7k8FKqYLdH4hKvVhNlCK5CzFvWe7FyOoOoHqLnYdQ4GrYl7Q
CAwEAAaBTTBLMB0GA1UdDgQWBBSIXPcC5SrZxfCB4d3JD3X1ZCmYmzALBgNVHQ8E
BAMCBaAwEwYDVR0lBAwwCgYIKwYBBQUHAwEwDQYJKoZIhvcNAQELBQADgYEAHFyV
8YEFR6iZfM+6RlU+hUkxGOiOoVkHo1dVnD7PAaLtqBKqHILKyj1cqgOwUUfOPBYs
lZ8vQ1Zhr/6yOEGQrE7cZ1bT5GfHhYhRZJKvZ2aRrS2aAz8Uq8J+1hOXEgYzrGz
-----END CERTIFICATE-----`,
      callbackUrl: 'https://app.example.com/auth/saml/callback'
    },
    oauth: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      authorizationURL: 'https://example.com/oauth/authorize',
      tokenURL: 'https://example.com/oauth/token',
      callbackURL: 'https://app.example.com/auth/oauth/callback',
      userInfoURL: 'https://api.example.com/user'
    }
  };

  const mockSSOUserInfo: SSOUserInfo = {
    ssoId: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    department: 'IT',
    provider: 'saml'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    SSOService.initializeConfig(mockSSOConfig);
  });

  describe('initializeConfig', () => {
    it('should initialize SSO configuration', () => {
      const config: SSOConfig = {
        saml: {
          entryPoint: 'https://test.com/saml',
          issuer: 'test',
          cert: `-----BEGIN CERTIFICATE-----
MIICTest123456789Test
-----END CERTIFICATE-----`,
          callbackUrl: 'callback'
        }
      };

      expect(() => SSOService.initializeConfig(config)).not.toThrow();
    });
  });

  describe('handleSAMLAuth', () => {
    it('should return error when SAML config is missing', async () => {
      SSOService.initializeConfig({});

      const result = await SSOService.handleSAMLAuth('test-response');

      expect(result.success).toBe(false);
      expect(result.error).toBe('SAML configuration not found');
    });

    it('should handle valid SAML response', async () => {
      // Mock XML parser response
      const xml2js = require('xml2js');
      const mockParser = {
        parseStringPromise: jest.fn().mockResolvedValue({
          'saml:response': {
            'saml:assertion': {
              'saml:nameid': 'test-user-123',
              'saml:attributestatement': {
                'saml:attribute': [
                  {
                    $: { Name: 'email' },
                    'saml:attributevalue': 'test@example.com'
                  },
                  {
                    $: { Name: 'name' },
                    'saml:attributevalue': 'Test User'
                  }
                ]
              }
            }
          }
        })
      };

      xml2js.Parser.mockImplementation(() => mockParser);

      // Initialize SSO config before test
      SSOService.initializeConfig(mockSSOConfig);

      // Mock a valid SAML response (Base64 encoded XML)
      const samlResponse = Buffer.from(`
        <saml:Response>
          <saml:Assertion>
            <saml:AttributeStatement>
              <saml:Attribute Name="email">
                <saml:AttributeValue>test@example.com</saml:AttributeValue>
              </saml:Attribute>
              <saml:Attribute Name="name">
                <saml:AttributeValue>Test User</saml:AttributeValue>
              </saml:Attribute>
            </saml:AttributeStatement>
            <saml:NameID>test-user-123</saml:NameID>
          </saml:Assertion>
        </saml:Response>
      `).toString('base64');

      const result = await SSOService.handleSAMLAuth(samlResponse);

      expect(result.success).toBe(true);
      expect(result.userInfo).toBeDefined();
      expect(result.userInfo?.email).toBe('test@example.com');
      expect(result.userInfo?.provider).toBe('saml');
    });

    it('should handle invalid SAML response', async () => {
      SSOService.initializeConfig(mockSSOConfig);

      const invalidResponse = 'invalid-response';

      const result = await SSOService.handleSAMLAuth(invalidResponse);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid SAML response');
    });
  });

  describe('handleOAuthAuth', () => {
    it('should return error when OAuth config is missing', async () => {
      SSOService.initializeConfig({});

      const result = await SSOService.handleOAuthAuth('test-code', 'test-state');

      expect(result.success).toBe(false);
      expect(result.error).toBe('OAuth configuration not found');
    });

    it('should handle OAuth authentication flow', async () => {
      SSOService.initializeConfig(mockSSOConfig);

      // Mock fetch for token exchange
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'test-token' })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-user-123',
            email: 'test@example.com',
            name: 'Test User'
          })
        } as Response);

      const result = await SSOService.handleOAuthAuth('test-code', 'test-state');

      expect(result.success).toBe(true);
      expect(result.userInfo).toBeDefined();
      expect(result.userInfo?.provider).toBe('oauth');
    });
  });

  describe('validateResponse', () => {
    it('should validate SAML response', async () => {
      // Mock XML parser response
      const xml2js = require('xml2js');
      const mockParser = {
        parseStringPromise: jest.fn().mockResolvedValue({
          'saml:response': {
            'saml:assertion': {
              'saml:nameid': 'test-user',
              'saml:attributestatement': {
                'saml:attribute': [
                  {
                    $: { Name: 'email' },
                    'saml:attributevalue': 'test@example.com'
                  }
                ]
              }
            }
          }
        })
      };

      xml2js.Parser.mockImplementation(() => mockParser);

      SSOService.initializeConfig(mockSSOConfig);

      const samlResponse = Buffer.from(`
        <saml:Response>
          <saml:Assertion>
            <saml:AttributeStatement>
              <saml:Attribute Name="email">
                <saml:AttributeValue>test@example.com</saml:AttributeValue>
              </saml:Attribute>
            </saml:AttributeStatement>
            <saml:NameID>test-user</saml:NameID>
          </saml:Assertion>
        </saml:Response>
      `).toString('base64');

      const result = await SSOService.validateResponse('saml', samlResponse);

      expect(result.success).toBe(true);
    });

    it('should validate OAuth response', async () => {
      SSOService.initializeConfig(mockSSOConfig);

      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'test-token' })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-user-123',
            email: 'test@example.com'
          })
        } as Response);

      const result = await SSOService.validateResponse('oauth', {
        code: 'test-code',
        state: 'test-state'
      });

      expect(result.success).toBe(true);
    });

    it('should reject unsupported provider', async () => {
      const result = await SSOService.validateResponse('unsupported', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported SSO provider');
    });
  });

  describe('extractUserInfo', () => {
    it('should extract SAML user info', () => {
      const samlProfile = {
        nameID: 'test-user-123',
        email: 'test@example.com',
        name: 'Test User',
        department: 'IT'
      };

      const result = SSOService.extractUserInfo(samlProfile, 'saml');

      expect(result).toEqual({
        ssoId: 'test-user-123',
        email: 'test@example.com',
        name: 'Test User',
        department: 'IT',
        provider: 'saml'
      });
    });

    it('should extract OAuth user info', () => {
      const oauthProfile = {
        id: 'test-user-123',
        email: 'test@example.com',
        name: 'Test User'
      };

      const result = SSOService.extractUserInfo(oauthProfile, 'oauth');

      expect(result).toEqual({
        ssoId: 'test-user-123',
        email: 'test@example.com',
        name: 'Test User',
        department: '',
        provider: 'oauth'
      });
    });

    it('should return null for unsupported provider', () => {
      const result = SSOService.extractUserInfo({}, 'unsupported');

      expect(result).toBeNull();
    });
  });

  describe('createSSOSession', () => {
    const { prisma } = require('../prisma');
    const { AuthService } = require('../auth');

    it('should create session for existing user', async () => {
      const existingUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User'
      };

      prisma.user.findFirst.mockResolvedValue(existingUser);
      prisma.user.update.mockResolvedValue(existingUser);
      AuthService.generateTokenWithUserData.mockResolvedValue('test-token');
      AuthService.createSession.mockResolvedValue(null);

      const result = await SSOService.createSSOSession(mockSSOUserInfo);

      expect(result).toBe('test-token');
      expect(prisma.user.update).toHaveBeenCalled();
      expect(AuthService.createSession).toHaveBeenCalled();
    });

    it('should create new user for first-time SSO login', async () => {
      const newUser = {
        id: 'new-user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'BUSINESS_USER'
      };

      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(newUser);
      AuthService.generateTokenWithUserData.mockResolvedValue('test-token');
      AuthService.createSession.mockResolvedValue(null);

      const result = await SSOService.createSSOSession(mockSSOUserInfo);

      expect(result).toBe('test-token');
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: mockSSOUserInfo.email,
          ssoProvider: mockSSOUserInfo.provider,
          ssoId: mockSSOUserInfo.ssoId,
          role: 'BUSINESS_USER'
        })
      });
    });
  });

  describe('checkSSOAvailability', () => {
    it('should check SAML availability', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true
      } as Response);

      const result = await SSOService.checkSSOAvailability('saml');

      expect(result).toBe(true);
    });

    it('should check OAuth availability', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true
      } as Response);

      const result = await SSOService.checkSSOAvailability('oauth');

      expect(result).toBe(true);
    });

    it('should return false for unavailable service', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await SSOService.checkSSOAvailability('saml');

      expect(result).toBe(false);
    });

    it('should return false for unsupported provider', async () => {
      const result = await SSOService.checkSSOAvailability('unsupported');

      expect(result).toBe(false);
    });
  });

  describe('OAuth state parameter security', () => {
    beforeEach(() => {
      // 设置环境变量用于测试
      process.env.SSO_STATE_SECRET = 'test-secret';
    });

    afterEach(() => {
      delete process.env.SSO_STATE_SECRET;
    });

    it('should generate secure state parameter', () => {
      const state = SSOService.generateStateParameter();

      expect(state).toBeDefined();
      expect(typeof state).toBe('string');
      expect(state.split('_')).toHaveLength(3); // timestamp_random_signature
    });

    it('should validate correct state parameter', () => {
      const state = SSOService.generateStateParameter();
      const isValid = SSOService.validateStateParameter(state);

      expect(isValid).toBe(true);
    });

    it('should reject invalid state parameter', () => {
      const invalidState = 'invalid-state';
      const isValid = SSOService.validateStateParameter(invalidState);

      expect(isValid).toBe(false);
    });

    it('should reject null state parameter', () => {
      const isValid = SSOService.validateStateParameter(null);

      expect(isValid).toBe(false);
    });

    it('should reject expired state parameter', () => {
      // 创建一个过期的state（11分钟前）
      const expiredTimestamp = Date.now() - (11 * 60 * 1000);
      const expiredState = `${expiredTimestamp}_mock-random_mock-signature`;

      const isValid = SSOService.validateStateParameter(expiredState);

      expect(isValid).toBe(false);
    });
  });

  describe('Input sanitization', () => {
    it('should handle SAML response with XML parser', async () => {
      const xml2js = require('xml2js');
      const mockParser = {
        parseStringPromise: jest.fn().mockResolvedValue({
          'saml:response': {
            'saml:assertion': {
              'saml:nameid': 'test-user-123',
              'saml:attributestatement': {
                'saml:attribute': [
                  {
                    $: { Name: 'email' },
                    'saml:attributevalue': 'test@example.com'
                  },
                  {
                    $: { Name: 'name' },
                    'saml:attributevalue': 'Test User'
                  }
                ]
              }
            }
          }
        })
      };

      xml2js.Parser.mockImplementation(() => mockParser);

      SSOService.initializeConfig(mockSSOConfig);

      const samlResponse = Buffer.from(`
        <saml:Response>
          <saml:Assertion>
            <saml:AttributeStatement>
              <saml:Attribute Name="email">
                <saml:AttributeValue>test@example.com</saml:AttributeValue>
              </saml:Attribute>
            </saml:AttributeStatement>
            <saml:NameID>test-user-123</saml:NameID>
          </saml:Assertion>
        </saml:Response>
      `).toString('base64');

      const result = await SSOService.handleSAMLAuth(samlResponse);

      expect(result.success).toBe(true);
      expect(result.userInfo?.email).toBe('test@example.com');
      expect(mockParser.parseStringPromise).toHaveBeenCalled();
    });

    it('should reject invalid XML in SAML response', async () => {
      SSOService.initializeConfig(mockSSOConfig);

      const invalidXml = Buffer.from('invalid-xml-content').toString('base64');

      const result = await SSOService.handleSAMLAuth(invalidXml);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid SAML response');
    });
  });
});