import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { PlatformIntegrationService } from '@/lib/services/platformIntegration'
import { SSOAuthService } from '@/lib/services/ssoAuth'
import { RedirectLoggerService } from '@/lib/services/redirectLogger'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '请先登录' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { applicationId, platform, mode = 'new_window' } = body

    if (!applicationId || !platform) {
      return NextResponse.json(
        { error: 'Invalid parameters', message: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 验证平台支持
    const supportedPlatforms = PlatformIntegrationService.getSupportedPlatforms()
    if (!supportedPlatforms.includes(platform)) {
      return NextResponse.json(
        { error: 'Unsupported platform', message: `不支持的平台: ${platform}` },
        { status: 400 }
      )
    }

    // 获取申请信息
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { user: true }
    })

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found', message: '申请不存在' },
        { status: 404 }
      )
    }

    // 权限验证
    if (application.userId !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied', message: '无权限访问此申请' },
        { status: 403 }
      )
    }

    // 验证用户平台访问权限
    const hasAccess = await SSOAuthService.validatePlatformAccess(
      session.user.id,
      platform
    )

    if (!hasAccess) {
      return NextResponse.json(
        {
          error: 'Platform access denied',
          message: `您无权限访问 ${platform} 平台`
        },
        { status: 403 }
      )
    }

    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found', message: '用户不存在' },
        { status: 404 }
      )
    }

    // 检测移动端
    const userAgent = request.headers.get('user-agent') || ''
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)

    // 移动端优化：自动调整跳转模式
    let optimizedMode = mode
    if (isMobile) {
      // 移动端优先使用当前窗口跳转
      if (mode === 'new_window') {
        optimizedMode = 'current_window'
      }
      // iframe在移动端体验不佳，改为当前窗口
      if (mode === 'iframe') {
        optimizedMode = 'current_window'
      }
    }

    // 构建跳转URL
    const redirectUrl = await PlatformIntegrationService.buildRedirectUrl(
      platform,
      user,
      application,
      {
        redirectMode: optimizedMode,
        userAgent,
        isMobile,
        sessionId: session.user.id
      }
    )

    // 记录跳转开始日志
    const logId = await RedirectLoggerService.logRedirectStart(
      user,
      application,
      platform,
      redirectUrl,
      optimizedMode,
      {
        userAgent,
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        sessionId: session.user.id,
        isMobile,
        originalMode: mode,
        optimizedMode
      }
    )

    return NextResponse.json({
      success: true,
      redirectUrl,
      platform,
      mode: optimizedMode,
      logId,
      isMobile,
      optimized: mode !== optimizedMode,
      message: isMobile ? '已为移动端优化跳转方式' : '跳转URL生成成功'
    })

  } catch (error) {
    console.error('跳转API错误:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : '服务器内部错误'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '请先登录' },
        { status: 401 }
      )
    }

    // 获取支持的平台列表和用户权限
    const supportedPlatforms = PlatformIntegrationService.getSupportedPlatforms()
    const userPlatformAccess: Record<string, boolean> = {}

    for (const platform of supportedPlatforms) {
      userPlatformAccess[platform] = await SSOAuthService.validatePlatformAccess(
        session.user.id,
        platform
      )
    }

    // 检测用户设备
    const userAgent = request.headers.get('user-agent') || ''
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)

    return NextResponse.json({
      supportedPlatforms,
      userPlatformAccess,
      deviceInfo: {
        isMobile,
        userAgent: userAgent.substring(0, 100), // 截断以保护隐私
        recommendedMode: isMobile ? 'current_window' : 'new_window'
      }
    })

  } catch (error) {
    console.error('获取平台信息错误:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: '获取平台信息失败'
      },
      { status: 500 }
    )
  }
}