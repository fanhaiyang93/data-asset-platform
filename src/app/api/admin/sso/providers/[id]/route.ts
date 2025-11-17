import { NextRequest, NextResponse } from 'next/server'
import { SSOConfigService } from '@/lib/ssoConfig'
import { getSession } from '@/lib/session'

// 获取单个SSO提供商
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params

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

    const provider = await SSOConfigService.getProviderById(params.id)
    if (!provider) {
      return NextResponse.json(
        { error: 'SSO provider not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      provider
    })

  } catch (error) {
    console.error('Get SSO provider error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get SSO provider',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}

// 更新SSO提供商
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params

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
    config.id = params.id // 确保ID正确

    const provider = await SSOConfigService.updateProvider(params.id, config, session.user.id)

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
    console.error('Update SSO provider error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update SSO provider',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}

// 删除SSO提供商
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params

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

    await SSOConfigService.deleteProvider(params.id)

    return NextResponse.json({
      success: true,
      message: 'SSO provider deleted successfully'
    })

  } catch (error) {
    console.error('Delete SSO provider error:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete SSO provider',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}