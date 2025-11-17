import { NextRequest, NextResponse } from 'next/server'
import { PlatformIntegrationService } from '@/lib/services/platformIntegration'
import { SSOAuthService } from '@/lib/services/ssoAuth'
import { RedirectLoggerService } from '@/lib/services/redirectLogger'
import { prisma } from '@/lib/prisma'

interface CallbackContext {
  params: Promise<{
    platform: string
  }>
}

export async function GET(
  request: NextRequest,
  context: CallbackContext
) {
  const params = await context.params
  return handleCallback(request, params.platform, 'GET')
}

export async function POST(
  request: NextRequest,
  context: CallbackContext
) {
  const params = await context.params
  return handleCallback(request, params.platform, 'POST')
}

async function handleCallback(
  request: NextRequest,
  platform: string,
  method: 'GET' | 'POST'
) {
  try {

    const { searchParams } = new URL(request.url)

    // 获取通用参数
    const token = searchParams.get('token')
    const logId = searchParams.get('logId')
    const status = searchParams.get('status') || 'unknown'
    const error = searchParams.get('error')

    console.log(`收到 ${platform} 平台回调: 方法=${method}, 状态=${status}`)

    // 验证平台支持
    const supportedPlatforms = PlatformIntegrationService.getSupportedPlatforms()
    if (!supportedPlatforms.includes(platform)) {
      return NextResponse.json(
        { error: 'Unsupported platform', message: `不支持的平台: ${platform}` },
        { status: 400 }
      )
    }

    // 验证和解析token
    let tokenPayload = null
    if (token) {
      tokenPayload = await SSOAuthService.validateSSOToken(token)
      if (!tokenPayload) {
        console.error('无效的SSO token:', token)
        return NextResponse.json(
          { error: 'Invalid token', message: 'SSO token无效或已过期' },
          { status: 401 }
        )
      }
    }

    // 根据不同平台处理回调
    const callbackResult = await processPlatformCallback(
      platform,
      method,
      request,
      tokenPayload
    )

    // 更新跳转日志
    if (logId && callbackResult.success) {
      await RedirectLoggerService.logRedirectSuccess(
        logId,
        callbackResult.duration,
        callbackResult.metadata
      )
    } else if (logId && !callbackResult.success) {
      await RedirectLoggerService.logRedirectFailure(
        logId,
        callbackResult.errorCode || 'CALLBACK_FAILED',
        callbackResult.message || '回调处理失败',
        callbackResult.metadata
      )
    }

    // 根据结果返回响应
    if (callbackResult.success) {
      return NextResponse.json({
        success: true,
        platform,
        message: callbackResult.message || '回调处理成功',
        data: callbackResult.data
      })
    } else {
      return NextResponse.json(
        {
          error: callbackResult.errorCode || 'CALLBACK_FAILED',
          message: callbackResult.message || '回调处理失败',
          platform
        },
        { status: callbackResult.statusCode || 400 }
      )
    }

  } catch (error) {
    console.error(`${platform} 平台回调处理错误:`, error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : '回调处理失败',
        platform
      },
      { status: 500 }
    )
  }
}

async function processPlatformCallback(
  platform: string,
  method: 'GET' | 'POST',
  request: NextRequest,
  tokenPayload: any
): Promise<{
  success: boolean
  message?: string
  errorCode?: string
  statusCode?: number
  duration?: number
  data?: any
  metadata?: Record<string, any>
}> {
  const startTime = Date.now()
  const { searchParams } = new URL(request.url)

  try {
    const params = await context.params

    switch (platform) {
      case 'hive':
        return await processHiveCallback(method, request, searchParams, tokenPayload)

      case 'enterprise_wechat':
        return await processEnterpriseWechatCallback(method, request, searchParams, tokenPayload)

      case 'oa_system':
        return await processOASystemCallback(method, request, searchParams, tokenPayload)

      default:
        return {
          success: false,
          errorCode: 'UNSUPPORTED_PLATFORM',
          message: `不支持的平台回调: ${platform}`,
          statusCode: 400
        }
    }
  } catch (error) {
    return {
      success: false,
      errorCode: 'CALLBACK_PROCESSING_ERROR',
      message: error instanceof Error ? error.message : '回调处理错误',
      statusCode: 500,
      duration: Date.now() - startTime
    }
  }
}

async function processHiveCallback(
  method: 'GET' | 'POST',
  request: NextRequest,
  searchParams: URLSearchParams,
  tokenPayload: any
) {
  const status = searchParams.get('status')
  const queryId = searchParams.get('query_id')
  const result = searchParams.get('result')

  if (status === 'success') {
    // Hive平台审批成功
    if (tokenPayload?.applicationId) {
      await prisma.application.update({
        where: { id: tokenPayload.applicationId },
        data: {
          status: 'approved',
          processedAt: new Date(),
          notes: `Hive平台审批通过 - Query ID: ${queryId}`
        }
      })
    }

    return {
      success: true,
      message: 'Hive平台审批成功',
      data: { queryId, result },
      metadata: { platform: 'hive', status, queryId }
    }
  } else {
    return {
      success: false,
      errorCode: 'HIVE_APPROVAL_FAILED',
      message: `Hive平台审批失败: ${result || '未知错误'}`,
      metadata: { platform: 'hive', status, result }
    }
  }
}

async function processEnterpriseWechatCallback(
  method: 'GET' | 'POST',
  request: NextRequest,
  searchParams: URLSearchParams,
  tokenPayload: any
) {
  const approvalId = searchParams.get('approval_id')
  const status = searchParams.get('status')
  const approver = searchParams.get('approver')

  if (status === 'approved') {
    // 企业微信审批通过
    if (tokenPayload?.applicationId) {
      await prisma.application.update({
        where: { id: tokenPayload.applicationId },
        data: {
          status: 'approved',
          processedAt: new Date(),
          notes: `企业微信审批通过 - 审批人: ${approver}, 审批单号: ${approvalId}`
        }
      })
    }

    return {
      success: true,
      message: '企业微信审批成功',
      data: { approvalId, approver },
      metadata: { platform: 'enterprise_wechat', status, approvalId, approver }
    }
  } else if (status === 'rejected') {
    // 审批被拒绝
    if (tokenPayload?.applicationId) {
      await prisma.application.update({
        where: { id: tokenPayload.applicationId },
        data: {
          status: 'rejected',
          processedAt: new Date(),
          notes: `企业微信审批被拒绝 - 审批人: ${approver}`
        }
      })
    }

    return {
      success: false,
      errorCode: 'WECHAT_APPROVAL_REJECTED',
      message: '企业微信审批被拒绝',
      metadata: { platform: 'enterprise_wechat', status, approver }
    }
  } else {
    return {
      success: false,
      errorCode: 'WECHAT_UNKNOWN_STATUS',
      message: `企业微信回调状态未知: ${status}`,
      metadata: { platform: 'enterprise_wechat', status }
    }
  }
}

async function processOASystemCallback(
  method: 'GET' | 'POST',
  request: NextRequest,
  searchParams: URLSearchParams,
  tokenPayload: any
) {
  const workflowId = searchParams.get('workflow_id')
  const status = searchParams.get('status')
  const processResult = searchParams.get('result')

  if (status === 'completed') {
    // OA系统流程完成
    if (tokenPayload?.applicationId) {
      await prisma.application.update({
        where: { id: tokenPayload.applicationId },
        data: {
          status: 'approved',
          processedAt: new Date(),
          notes: `OA系统审批完成 - 流程ID: ${workflowId}, 结果: ${processResult}`
        }
      })
    }

    return {
      success: true,
      message: 'OA系统审批完成',
      data: { workflowId, result: processResult },
      metadata: { platform: 'oa_system', status, workflowId, result: processResult }
    }
  } else {
    return {
      success: false,
      errorCode: 'OA_PROCESS_FAILED',
      message: `OA系统处理失败: ${processResult || '未知错误'}`,
      metadata: { platform: 'oa_system', status, result: processResult }
    }
  }
}