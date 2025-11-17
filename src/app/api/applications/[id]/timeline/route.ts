import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ApplicationStatus } from '@prisma/client'

interface StatusChangeLog {
  id: string
  applicationId: string
  fromStatus: ApplicationStatus
  toStatus: ApplicationStatus
  reason?: string
  timestamp: Date
  operatorId?: string
  metadata?: Record<string, any>
}

interface TimelineEvent extends StatusChangeLog {
  operatorName?: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const applicationId = params.id

    // 验证申请是否存在
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true }
    })

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // 获取状态变更日志
    const statusLogs = await prisma.applicationStatusLog.findMany({
      where: { applicationId },
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

    // 转换为时间线事件格式
    const timeline: TimelineEvent[] = statusLogs.map(log => ({
      id: log.id,
      applicationId: log.applicationId,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      reason: log.reason || undefined,
      timestamp: log.timestamp,
      operatorId: log.operatorId || undefined,
      metadata: log.metadata || undefined,
      operatorName: log.operator?.name || undefined
    }))

    // 如果没有状态日志，创建初始状态（基于申请当前状态）
    if (timeline.length === 0) {
      const currentApplication = await prisma.application.findUnique({
        where: { id: applicationId },
        select: {
          status: true,
          submittedAt: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: { name: true }
          }
        }
      })

      if (currentApplication) {
        // 创建虚拟的初始状态记录
        const initialEvent: TimelineEvent = {
          id: `virtual-${applicationId}`,
          applicationId,
          fromStatus: 'DRAFT' as ApplicationStatus,
          toStatus: currentApplication.status,
          timestamp: currentApplication.submittedAt || currentApplication.createdAt,
          operatorName: currentApplication.user.name || '系统',
          reason: currentApplication.status === 'PENDING' ? '申请已提交' : undefined
        }

        timeline.push(initialEvent)
      }
    }

    return NextResponse.json({
      timeline,
      total: timeline.length
    })

  } catch (error) {
    console.error('Failed to fetch application timeline:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 添加新的状态变更记录（用于系统内部调用）
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const applicationId = params.id
    const body = await request.json()

    const { fromStatus, toStatus, reason, operatorId, metadata } = body

    // 验证必需字段
    if (!fromStatus || !toStatus) {
      return NextResponse.json(
        { error: 'fromStatus and toStatus are required' },
        { status: 400 }
      )
    }

    // 验证申请是否存在
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, status: true }
    })

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // 创建状态变更记录
    const statusLog = await prisma.applicationStatusLog.create({
      data: {
        applicationId,
        fromStatus,
        toStatus,
        reason,
        operatorId,
        metadata: metadata || {},
        timestamp: new Date()
      },
      include: {
        operator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    // 转换为时间线事件格式
    const timelineEvent: TimelineEvent = {
      id: statusLog.id,
      applicationId: statusLog.applicationId,
      fromStatus: statusLog.fromStatus,
      toStatus: statusLog.toStatus,
      reason: statusLog.reason || undefined,
      timestamp: statusLog.timestamp,
      operatorId: statusLog.operatorId || undefined,
      metadata: statusLog.metadata || undefined,
      operatorName: statusLog.operator?.name || undefined
    }

    return NextResponse.json(timelineEvent, { status: 201 })

  } catch (error) {
    console.error('Failed to create status log:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}