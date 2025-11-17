/**
 * SAML ACS (Assertion Consumer Service) 路由
 * 处理IdP返回的SAML响应
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSAMLService } from '@/lib/auth/sso/saml/samlService';
import { SSOService } from '@/lib/sso';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/auth/sso/saml/acs
 * 处理SAML POST绑定的断言响应
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 获取SAML响应
    const formData = await request.formData();
    const samlResponse = formData.get('SAMLResponse') as string;
    const relayState = formData.get('RelayState') as string | null;

    if (!samlResponse) {
      return NextResponse.json(
        { error: 'Missing SAMLResponse parameter' },
        { status: 400 }
      );
    }

    // 2. 查找活跃的SAML提供商
    const samlProvider = await prisma.sSOProvider.findFirst({
      where: {
        type: 'SAML',
        status: 'ACTIVE'
      }
    });

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

    // 3. 初始化SAML服务
    const samlService = await createSAMLService(samlProvider.id);

    // 4. 验证SAML响应
    const validationResult = await samlService.validateResponse(samlResponse);

    if (!validationResult.success || !validationResult.userInfo) {
      console.error('SAML validation failed:', validationResult.error);

      // 记录失败的SSO日志
      await prisma.sSOLog.create({
        data: {
          providerId: samlProvider.id,
          action: 'SAML_LOGIN',
          status: 'FAILED',
          message: validationResult.error || 'SAML validation failed',
          ipAddress: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown'
        }
      });

      // 触发降级处理
      const { SSOFallbackService } = await import('@/lib/ssoFallback');
      await SSOFallbackService.handleSSOFailure(
        'saml',
        new Error(validationResult.error || 'SAML validation failed')
      );

      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(validationResult.error || 'saml_validation_failed')}`, request.url)
      );
    }

    // 5. 创建用户会话
    const ssoUserInfo = {
      ssoId: validationResult.userInfo.nameID,
      email: validationResult.userInfo.email,
      name: validationResult.userInfo.name ||
            `${validationResult.userInfo.firstName || ''} ${validationResult.userInfo.lastName || ''}`.trim(),
      department: validationResult.userInfo.department,
      provider: 'saml'
    };

    const token = await SSOService.createSSOSession(ssoUserInfo);

    // 6. 存储SAML会话信息 (用于单点登出)
    if (validationResult.sessionIndex) {
      await prisma.sSOSession.create({
        data: {
          sessionId: validationResult.sessionIndex,
          providerId: samlProvider.id,
          userId: '', // 将在创建用户后更新
          nameId: validationResult.userInfo.nameID,
          sessionIndex: validationResult.sessionIndex,
          loginTime: new Date(),
          lastActivity: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时
          isActive: true,
          logoutRequested: false,
          ipAddress: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          metadata: {
            attributes: validationResult.userInfo.attributes
          }
        }
      });
    }

    // 7. 记录成功的SSO日志
    await prisma.sSOLog.create({
      data: {
        providerId: samlProvider.id,
        email: ssoUserInfo.email,
        action: 'SAML_LOGIN',
        status: 'SUCCESS',
        message: 'SAML authentication successful',
        ipAddress: request.headers.get('x-forwarded-for') ||
                  request.headers.get('x-real-ip') ||
                  'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        responseTime: 0 // TODO: 计算实际响应时间
      }
    });

    // 8. 设置认证Cookie
    const cookieStore = cookies();
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24小时
      path: '/'
    });

    // 9. 重定向到目标页面
    const redirectUrl = relayState || '/';
    const response = NextResponse.redirect(new URL(redirectUrl, request.url));

    // 确保Cookie在重定向响应中设置
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('SAML ACS error:', error);

    // 记录错误日志
    try {
      const samlProvider = await prisma.sSOProvider.findFirst({
        where: { type: 'SAML', status: 'ACTIVE' }
      });

      if (samlProvider) {
        await prisma.sSOLog.create({
          data: {
            providerId: samlProvider.id,
            action: 'SAML_LOGIN',
            status: 'ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
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
        error instanceof Error ? error : new Error('SAML ACS processing failed')
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
 * GET /api/auth/sso/saml/acs
 * 支持SAML Redirect绑定 (部分IdP使用)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const samlResponse = searchParams.get('SAMLResponse');
  const relayState = searchParams.get('RelayState');

  if (!samlResponse) {
    return NextResponse.json(
      { error: 'Missing SAMLResponse parameter' },
      { status: 400 }
    );
  }

  // 创建FormData并转发到POST处理器
  const formData = new FormData();
  formData.append('SAMLResponse', samlResponse);
  if (relayState) {
    formData.append('RelayState', relayState);
  }

  // 重用POST处理逻辑
  return POST(request);
}
