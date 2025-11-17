import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTimeEstimationService } from '@/lib/services/timeEstimation'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params

    const applicationId = params.id

    // 获取申请详情
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // 格式化申请数据
    const applicationData = {
      id: application.id,
      applicationNumber: application.applicationNumber,
      status: application.status,
      assetName: application.asset.name,
      applicantName: application.user.name,
      submittedAt: application.submittedAt,
      reviewedAt: application.reviewedAt,
      reviewComment: application.reviewComment,
      estimatedCompletionTime: application.estimatedCompletionTime
    }

    // 计算时间预估
    let timeEstimation = null
    try {
    const params = await context.params

      const timeEstimationService = getTimeEstimationService()
      const applicationWithAsset = {
        ...application,
        asset: application.asset
      }
      timeEstimation = await timeEstimationService.estimateCompletionTime(applicationWithAsset)

      // 如果数据库中没有预估时间，更新到数据库
      if (!application.estimatedCompletionTime && timeEstimation.estimatedCompletionTime) {
        await prisma.application.update({
          where: { id: applicationId },
          data: {
            estimatedCompletionTime: timeEstimation.estimatedCompletionTime
          }
        })

        // 更新返回数据中的预估时间
        applicationData.estimatedCompletionTime = timeEstimation.estimatedCompletionTime
      }
    } catch (error) {
      console.error('Failed to calculate time estimation:', error)
      // 时间预估失败不应该影响整个请求
    }

    return NextResponse.json({
      application: applicationData,
      timeEstimation
    })

  } catch (error) {
    console.error('Failed to fetch application status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 手动刷新状态（用于状态同步）
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params

    const applicationId = params.id

    // 获取申请当前状态
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    })

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // 重新计算时间预估
    const timeEstimationService = getTimeEstimationService()
    const timeEstimation = await timeEstimationService.estimateCompletionTime({
      ...application,
      asset: application.asset
    })

    // 更新预估时间到数据库
    const updatedApplication = await prisma.application.update({
      where: { id: applicationId },
      data: {
        estimatedCompletionTime: timeEstimation.estimatedCompletionTime,
        updatedAt: new Date()
      },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    // 格式化返回数据
    const applicationData = {
      id: updatedApplication.id,
      applicationNumber: updatedApplication.applicationNumber,
      status: updatedApplication.status,
      assetName: updatedApplication.asset.name,
      applicantName: updatedApplication.user.name,
      submittedAt: updatedApplication.submittedAt,
      reviewedAt: updatedApplication.reviewedAt,
      reviewComment: updatedApplication.reviewComment,
      estimatedCompletionTime: updatedApplication.estimatedCompletionTime
    }

    return NextResponse.json({
      application: applicationData,
      timeEstimation,
      refreshed: true,
      refreshedAt: new Date()
    })

  } catch (error) {
    console.error('Failed to refresh application status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}