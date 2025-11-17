import { NextRequest, NextResponse } from 'next/server'
import { SSOConfigService } from '@/lib/ssoConfig'
import { getSession } from '@/lib/session'

// 获取所有SSO提供商
export async function GET(request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getSession(request)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 检查管理员权限
    if (session.user.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const providers = await SSOConfigService.getAllProviders()

    return NextResponse.json({
      success: true,
      providers
    })

  } catch (error) {
    console.error('Get SSO providers error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get SSO providers',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}

// 创建新的SSO提供商
export async function POST(request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getSession(request)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 检查管理员权限
    if (session.user.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const config = await request.json()

    // 验证必填字段
    if (!config.name || !config.type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      )
    }

    const provider = await SSOConfigService.createProvider(config, session.user.id)

    return NextResponse.json({
      success: true,
      provider: {
        id: provider.id,
        name: provider.name,
        type: provider.type,
        status: provider.status
      }
    })

  } catch (error) {
    console.error('Create SSO provider error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create SSO provider',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}