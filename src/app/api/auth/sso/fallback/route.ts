import { NextRequest, NextResponse } from 'next/server';
import { SSOFallbackService } from '@/lib/ssoFallback';

// 获取SSO降级状态
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');

    if (provider) {
      // 检查特定提供商的降级状态
      const health = SSOFallbackService.getProviderHealth(provider);
      const fallbackStrategy = SSOFallbackService.getFallbackStrategy(provider);

      return NextResponse.json({
        success: true,
        provider,
        health,
        fallbackStrategy,
        fallbackActive: health && !health.healthy
      });
    } else {
      // 获取所有提供商的状态
      const healthStatuses = SSOFallbackService.getHealthStatuses();
      const statistics = SSOFallbackService.getFallbackStatistics();

      return NextResponse.json({
        success: true,
        healthStatuses,
        statistics
      });
    }

  } catch (error) {
    console.error('SSO fallback status check error:', error);

    return NextResponse.json(
      {
        error: 'Failed to check SSO fallback status',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}

// 手动触发降级模式
export async function POST(request: NextRequest) {
  try {
    const { provider, enabled } = await request.json();

    if (!provider || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Provider and enabled parameters are required' },
        { status: 400 }
      );
    }

    // 强制设置降级模式
    SSOFallbackService.setFallbackMode(provider, enabled);

    return NextResponse.json({
      success: true,
      message: `Fallback mode ${enabled ? 'enabled' : 'disabled'} for ${provider}`,
      provider,
      enabled
    });

  } catch (error) {
    console.error('SSO fallback control error:', error);

    return NextResponse.json(
      {
        error: 'Failed to control SSO fallback',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}

// 重置提供商状态
export async function PUT(request: NextRequest) {
  try {
    const { provider } = await request.json();

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider parameter is required' },
        { status: 400 }
      );
    }

    // 重置提供商状态
    SSOFallbackService.resetProviderStatus(provider);

    return NextResponse.json({
      success: true,
      message: `Provider ${provider} status reset`,
      provider
    });

  } catch (error) {
    console.error('SSO provider reset error:', error);

    return NextResponse.json(
      {
        error: 'Failed to reset SSO provider status',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}