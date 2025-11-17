/**
 * SAML登录路由
 * 发起SAML认证请求,重定向到IdP
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSAMLService } from '@/lib/auth/sso/saml/samlService';
import { prisma } from '@/lib/prisma';
import * as crypto from 'crypto';

/**
 * GET /api/auth/sso/saml/login
 * 发起SAML认证流程
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 1. 获取可选的RelayState参数 (用于认证后重定向)
    const returnUrl = searchParams.get('returnUrl') || '/';
    const providerId = searchParams.get('providerId');

    // 2. 查找SAML提供商
    let samlProvider;

    if (providerId) {
      // 使用指定的提供商
      samlProvider = await prisma.sSOProvider.findUnique({
        where: {
          id: providerId,
          type: 'SAML',
          status: 'ACTIVE'
        }
      });
    } else {
      // 使用第一个活跃的SAML提供商
      samlProvider = await prisma.sSOProvider.findFirst({
        where: {
          type: 'SAML',
          status: 'ACTIVE'
        }
      });
    }

    if (!samlProvider) {
      console.error('No active SAML provider found');

      // 触发降级处理
      const { SSOFallbackService } = await import('@/lib/ssoFallback');
      await SSOFallbackService.handleSSOFailure(
        'saml',
        new Error('No active SAML provider configured')
      );

      return NextResponse.redirect(
        new URL('/login?error=sso_unavailable', request.url)
      );
    }

    // 3. 检查提供商健康状态
    const healthStatus = await checkProviderHealth(samlProvider.id);

    if (!healthStatus.healthy) {
      console.error('SAML provider is unhealthy:', healthStatus.error);

      // 触发降级处理
      const { SSOFallbackService } = await import('@/lib/ssoFallback');
      await SSOFallbackService.handleSSOFailure(
        'saml',
        new Error(`SAML provider unhealthy: ${healthStatus.error}`)
      );

      return NextResponse.redirect(
        new URL('/login?error=sso_unavailable', request.url)
      );
    }

    // 4. 初始化SAML服务
    const samlService = await createSAMLService(samlProvider.id);

    // 5. 生成RelayState (包含返回URL和CSRF令牌)
    const relayState = generateRelayState(returnUrl);

    // 6. 生成SAML认证请求
    const authRequest = await samlService.generateAuthRequest(relayState);

    // 7. 记录SSO登录尝试
    await prisma.sSOLog.create({
      data: {
        providerId: samlProvider.id,
        action: 'SAML_LOGIN_INITIATED',
        status: 'SUCCESS',
        message: 'SAML authentication request generated',
        ipAddress: request.headers.get('x-forwarded-for') ||
                  request.headers.get('x-real-ip') ||
                  'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        metadata: {
          relayState,
          returnUrl
        }
      }
    });

    // 8. 更新提供商统计
    await prisma.sSOProvider.update({
      where: { id: samlProvider.id },
      data: {
        totalLogins: { increment: 1 },
        lastHealthCheck: new Date(),
        healthStatus: 'healthy'
      }
    });

    // 9. 构建IdP URL并重定向
    const config = samlService.getConfig();
    if (!config || !config.entryPoint) {
      throw new Error('SAML configuration missing entry point');
    }

    // 构建完整的认证URL
    const idpUrl = new URL(config.entryPoint);

    // 添加SAMLRequest参数 (如果需要)
    // 注意: 某些IdP需要SAMLRequest参数,某些则直接重定向
    if (relayState) {
      idpUrl.searchParams.set('RelayState', relayState);
    }

    // 重定向到IdP
    return NextResponse.redirect(idpUrl.toString());

  } catch (error) {
    console.error('SAML login initiation error:', error);

    // 记录错误
    try {
      const samlProvider = await prisma.sSOProvider.findFirst({
        where: { type: 'SAML', status: 'ACTIVE' }
      });

      if (samlProvider) {
        await prisma.sSOLog.create({
          data: {
            providerId: samlProvider.id,
            action: 'SAML_LOGIN_INITIATED',
            status: 'ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            errorCode: 'SAML_INIT_ERROR',
            ipAddress: request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown'
          }
        });
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    // 触发降级处理
    try {
      const { SSOFallbackService } = await import('@/lib/ssoFallback');
      await SSOFallbackService.handleSSOFailure(
        'saml',
        error instanceof Error ? error : new Error('SAML login initiation failed')
      );
    } catch (fallbackError) {
      console.error('Fallback handling failed:', fallbackError);
    }

    return NextResponse.redirect(
      new URL('/login?error=sso_error', request.url)
    );
  }
}

/**
 * 生成安全的RelayState
 * 包含返回URL和CSRF保护
 */
function generateRelayState(returnUrl: string): string {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(16).toString('hex');
  const data = {
    returnUrl,
    timestamp,
    random
  };

  // Base64编码
  const encoded = Buffer.from(JSON.stringify(data)).toString('base64url');

  // 使用HMAC签名
  const secret = process.env.SSO_STATE_SECRET || 'default-secret';
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encoded)
    .digest('hex');

  return `${encoded}.${signature}`;
}

/**
 * 验证RelayState
 */
export function validateRelayState(relayState: string): {
  valid: boolean;
  returnUrl?: string;
  error?: string;
} {
  try {
    if (!relayState) {
      return { valid: false, error: 'RelayState is empty' };
    }

    const parts = relayState.split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid RelayState format' };
    }

    const [encoded, signature] = parts;

    // 验证签名
    const secret = process.env.SSO_STATE_SECRET || 'default-secret';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(encoded)
      .digest('hex');

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid RelayState signature' };
    }

    // 解码数据
    const decoded = Buffer.from(encoded, 'base64url').toString('utf-8');
    const data = JSON.parse(decoded);

    // 验证时间戳 (防止重放攻击)
    const timestamp = parseInt(data.timestamp, 10);
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10分钟

    if (now - timestamp > maxAge) {
      return { valid: false, error: 'RelayState expired' };
    }

    return {
      valid: true,
      returnUrl: data.returnUrl || '/'
    };

  } catch (error) {
    console.error('RelayState validation error:', error);
    return {
      valid: false,
      error: 'RelayState validation failed'
    };
  }
}

/**
 * 检查提供商健康状态
 */
async function checkProviderHealth(providerId: string): Promise<{
  healthy: boolean;
  error?: string;
}> {
  try {
    const provider = await prisma.sSOProvider.findUnique({
      where: { id: providerId }
    });

    if (!provider) {
      return { healthy: false, error: 'Provider not found' };
    }

    // 检查必需配置
    if (!provider.ssoUrl || !provider.certificateData) {
      return { healthy: false, error: 'Missing required configuration' };
    }

    // 检查上次健康检查时间
    if (provider.lastHealthCheck) {
      const lastCheck = new Date(provider.lastHealthCheck).getTime();
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      // 如果最近5分钟内检查过且健康,直接返回
      if (now - lastCheck < fiveMinutes && provider.healthStatus === 'healthy') {
        return { healthy: true };
      }
    }

    // TODO: 实现实际的健康检查 (ping IdP端点等)
    // 简化实现: 假设配置正确则健康

    return { healthy: true };

  } catch (error) {
    console.error('Provider health check error:', error);
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Health check failed'
    };
  }
}
