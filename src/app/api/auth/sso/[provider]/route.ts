import { NextRequest, NextResponse } from 'next/server';
import { SSOService } from '@/lib/sso';
import { cookies } from 'next/headers';

// 支持的SSO提供商
const SUPPORTED_PROVIDERS = ['saml', 'oauth'];

// 允许的CORS域名（从环境变量读取）
const getAllowedOrigins = (): string[] => {
  const origins = process.env.ALLOWED_CORS_ORIGINS;
  if (!origins) {
    // 开发环境默认值
    return process.env.NODE_ENV === 'development'
      ? ['http://localhost:3000', 'http://localhost:3001']
      : [];
  }
  return origins.split(',').map(origin => origin.trim());
};

// 创建用户会话的公共方法
const createUserSession = async (userInfo: any): Promise<{ token: string; response: NextResponse }> => {
  // 创建用户会话
  const token = await SSOService.createSSOSession(userInfo);

  // 设置认证cookie
  const cookieStore = cookies();
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60, // 24小时
    path: '/'
  });

  return { token, response: NextResponse.json({ success: true }) };
};

// 处理SSO回调的POST请求 (SAML)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  try {
    const params = await context.params

    const { provider } = params;

    // 验证提供商
    if (!SUPPORTED_PROVIDERS.includes(provider.toLowerCase())) {
      return NextResponse.json(
        { error: `Unsupported SSO provider: ${provider}` },
        { status: 400 }
      );
    }

    // 获取请求体
    const body = await request.text();

    let responseData: any;

    if (provider.toLowerCase() === 'saml') {
      // 处理SAML POST响应
      const formData = new URLSearchParams(body);
      const samlResponse = formData.get('SAMLResponse');

      if (!samlResponse) {
        return NextResponse.json(
          { error: 'Missing SAMLResponse in request' },
          { status: 400 }
        );
      }

      responseData = samlResponse;
    } else {
      // 处理其他POST数据
      responseData = JSON.parse(body);
    }

    // 验证SSO响应
    const validationResult = await SSOService.validateResponse(provider, responseData);

    if (!validationResult.success || !validationResult.userInfo) {
      return NextResponse.json(
        { error: validationResult.error || 'SSO validation failed' },
        { status: 401 }
      );
    }

    // 使用公共方法创建会话
    const { token } = await createUserSession(validationResult.userInfo);

    // 返回成功响应或重定向
    if (request.headers.get('accept')?.includes('application/json')) {
      return NextResponse.json({
        success: true,
        user: {
          email: validationResult.userInfo.email,
          name: validationResult.userInfo.name,
          provider: validationResult.userInfo.provider
        }
      });
    } else {
      // 重定向到主页面
      return NextResponse.redirect(new URL('/', request.url));
    }

  } catch (error) {
    console.error(`SSO ${params.provider} authentication error:`, error);

    return NextResponse.json(
      {
        error: 'Internal server error during SSO authentication',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}

// 处理SSO回调的GET请求 (OAuth)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  try {
    const params = await context.params

    const { provider } = params;
    const { searchParams } = new URL(request.url);

    // 验证提供商
    if (!SUPPORTED_PROVIDERS.includes(provider.toLowerCase())) {
      return NextResponse.json(
        { error: `Unsupported SSO provider: ${provider}` },
        { status: 400 }
      );
    }

    if (provider.toLowerCase() === 'oauth') {
      // 处理OAuth回调
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        return NextResponse.json(
          { error: `OAuth error: ${error}` },
          { status: 400 }
        );
      }

      if (!code) {
        return NextResponse.json(
          { error: 'Missing authorization code' },
          { status: 400 }
        );
      }

      // 验证state参数以防止CSRF攻击
      if (!SSOService.validateStateParameter(state)) {
        return NextResponse.json(
          { error: 'Invalid or expired state parameter' },
          { status: 400 }
        );
      }

      // 验证OAuth响应
      const validationResult = await SSOService.validateResponse(provider, { code, state });

      if (!validationResult.success || !validationResult.userInfo) {
        return NextResponse.json(
          { error: validationResult.error || 'OAuth validation failed' },
          { status: 401 }
        );
      }

      // 使用公共方法创建会话
      const { token } = await createUserSession(validationResult.userInfo);

      // 重定向到主页面
      const redirectUrl = new URL('/', request.url);
      const response = NextResponse.redirect(redirectUrl);

      // 重新设置cookie（因为NextResponse.redirect会创建新的响应对象）
      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60, // 24小时
        path: '/'
      });

      return response;

    } else if (provider.toLowerCase() === 'saml') {
      // SAML通常使用POST，但也可能有GET请求用于发起认证
      const redirectUrl = searchParams.get('redirect') || '/';

      // 这里可以生成SAML认证请求并重定向到IDP
      // 简化实现，直接重定向到配置的SAML端点
      const samlEntryPoint = process.env.SAML_ENTRY_POINT;

      if (!samlEntryPoint) {
        return NextResponse.json(
          { error: 'SAML configuration not found' },
          { status: 500 }
        );
      }

      return NextResponse.redirect(samlEntryPoint);
    }

    return NextResponse.json(
      { error: 'Unsupported request method for this provider' },
      { status: 405 }
    );

  } catch (error) {
    console.error(`SSO ${params.provider} authentication error:`, error);

    return NextResponse.json(
      {
        error: 'Internal server error during SSO authentication',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}

// 处理SSO登录启动 (支持OPTIONS用于CORS)
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = getAllowedOrigins();

  // 检查origin是否在允许列表中
  const isAllowed = allowedOrigins.length === 0 || allowedOrigins.includes(origin || '');

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24小时预检缓存
  };

  if (isAllowed && origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return new NextResponse(null, {
    status: 200,
    headers,
  });
}