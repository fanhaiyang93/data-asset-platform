import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ApplicationStatus } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const applicationId = params.id
    const body = await request.json()

    const { appealReason, originalRejectionReason } = body

    // 验证必需字段
    if (!appealReason?.trim()) {
      return NextResponse.json(
        { error: 'Appeal reason is required' },
        { status: 400 }
      )
    }

    // 验证申请是否存在且状态为REJECTED
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        reviewComment: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        asset: {
          select: {
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

    if (application.status !== 'REJECTED') {
      return NextResponse.json(
        { error: 'Only rejected applications can be appealed' },
        { status: 400 }
      )
    }

    // 检查是否已经有未处理的申诉
    const existingAppeal = await prisma.applicationStatusLog.findFirst({
      where: {
        applicationId,
        fromStatus: 'REJECTED',
        toStatus: 'PENDING',
        reason: { contains: '申诉' }
      },
      orderBy: { timestamp: 'desc' }
    })

    if (existingAppeal) {
      // 检查申诉是否在24小时内
      const hoursSinceAppeal = (Date.now() - existingAppeal.timestamp.getTime()) / (1000 * 60 * 60)
      if (hoursSinceAppeal < 24) {
        return NextResponse.json(
          { error: '您已经提交过申诉，请等待处理结果' },
          { status: 409 }
        )
      }
    }

    // 创建申诉记录（将状态改为PENDING，并添加申诉原因）
    const appealMetadata = {
      type: 'appeal',
      appealReason: appealReason.trim(),
      originalRejectionReason: originalRejectionReason || application.reviewComment,
      appealedAt: new Date().toISOString(),
      appealedBy: application.user.id
    }

    // 开始事务
    const result = await prisma.$transaction(async (tx) => {
      // 更新申请状态为PENDING（重新审核）
      const updatedApplication = await tx.application.update({
        where: { id: applicationId },
        data: {
          status: 'PENDING' as ApplicationStatus,
          reviewComment: null, // 清除之前的拒绝原因
          reviewedAt: null,
          updatedAt: new Date()
        }
      })

      // 创建状态变更日志
      const statusLog = await tx.applicationStatusLog.create({
        data: {
          applicationId,
          fromStatus: 'REJECTED' as ApplicationStatus,
          toStatus: 'PENDING' as ApplicationStatus,
          reason: `申请人提交申诉：${appealReason.trim()}`,
          operatorId: application.user.id, // 申请人作为操作者
          metadata: appealMetadata,
          timestamp: new Date()
        }
      })

      return { updatedApplication, statusLog }
    })

    // 这里可以触发通知审核人员重新审核
    // 可以调用通知服务通知相关人员
    try {
      // TODO: 发送申诉通知给审核人员
      console.log('Appeal submitted for application:', applicationId)
    } catch (notificationError) {
      console.error('Failed to send appeal notification:', notificationError)
      // 通知失败不应该影响申诉提交
    }

    return NextResponse.json({
      success: true,
      message: '申诉已提交成功',
      appealId: result.statusLog.id,
      newStatus: 'PENDING',
      submittedAt: new Date(),
      expectedReviewTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2个工作日后
    }, { status: 201 })

  } catch (error) {
    console.error('Failed to submit appeal:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 获取申诉历史
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const applicationId = params.id

    // 获取所有申诉记录
    const appeals = await prisma.applicationStatusLog.findMany({
      where: {
        applicationId,
        metadata: {
          path: ['type'],
          equals: 'appeal'
        }
      },
      include: {
        operator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { timestamp: 'desc' }
    })

    const appealHistory = appeals.map(appeal => ({
      id: appeal.id,
      appealReason: appeal.metadata?.appealReason,
      originalRejectionReason: appeal.metadata?.originalRejectionReason,
      submittedAt: appeal.timestamp,
      submittedBy: appeal.operator?.name,
      status: appeal.toStatus,
      response: appeal.metadata?.reviewResponse || null
    }))

    return NextResponse.json({
      appeals: appealHistory,
      total: appealHistory.length
    })

  } catch (error) {
    console.error('Failed to fetch appeal history:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}