import { NextRequest, NextResponse } from 'next/server';
import { SSOService } from '@/lib/sso';
import { cookies } from 'next/headers';

// OAuth授权初始化
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const redirectUrl = searchParams.get('redirect') || '/';

    // 生成安全的state参数
    const state = SSOService.generateStateParameter();

    // 将state和redirect URL存储在cookie中（临时存储）
    const cookieStore = cookies();
    cookieStore.set('oauth-state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60, // 10分钟
      path: '/'
    });

    cookieStore.set('oauth-redirect', redirectUrl, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60, // 10分钟
      path: '/'
    });

    // 构建OAuth授权URL
    const authorizationURL = process.env.OAUTH_AUTHORIZATION_URL;
    const clientId = process.env.OAUTH_CLIENT_ID;
    const callbackURL = process.env.OAUTH_CALLBACK_URL || `${new URL(request.url).origin}/api/auth/sso/oauth`;

    if (!authorizationURL || !clientId) {
      return NextResponse.json(
        { error: 'OAuth configuration not found' },
        { status: 500 }
      );
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: callbackURL,
      state: state,
      scope: 'openid profile email' // 根据需要调整scope
    });

    const oauthURL = `${authorizationURL}?${params.toString()}`;

    // 重定向到OAuth提供商
    return NextResponse.redirect(oauthURL);

  } catch (error) {
    console.error('OAuth authorization initialization error:', error);

    return NextResponse.json(
      {
        error: 'Failed to initialize OAuth authorization',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}