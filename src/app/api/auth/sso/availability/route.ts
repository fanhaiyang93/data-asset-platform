import { NextRequest, NextResponse } from 'next/server';
import { SSOService } from '@/lib/sso';

// 检查SSO提供商可用性
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider parameter is required' },
        { status: 400 }
      );
    }

    // 检查提供商可用性
    const available = await SSOService.checkSSOAvailability(provider);

    return NextResponse.json({
      success: true,
      provider,
      available
    });

  } catch (error) {
    console.error('SSO availability check error:', error);

    return NextResponse.json(
      {
        error: 'Failed to check SSO availability',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}

// 获取所有提供商的状态
export async function POST(request: NextRequest) {
  try {
    const { providers } = await request.json();

    if (!Array.isArray(providers)) {
      return NextResponse.json(
        { error: 'Providers must be an array' },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      providers.map(async (provider: string) => ({
        provider,
        available: await SSOService.checkSSOAvailability(provider)
      }))
    );

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Batch SSO availability check error:', error);

    return NextResponse.json(
      {
        error: 'Failed to check SSO availability',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}