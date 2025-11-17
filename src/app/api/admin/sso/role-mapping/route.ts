import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { SSORoleMappingService, RoleMappingRule } from '@/lib/ssoRoleMapping'

// 获取角色映射规则
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

    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get('providerId')

    if (!providerId) {
      return NextResponse.json(
        { error: 'Provider ID is required' },
        { status: 400 }
      )
    }

    const rules = await SSORoleMappingService.getRoleMappingRules(providerId)

    return NextResponse.json({
      success: true,
      rules
    })

  } catch (error) {
    console.error('Get role mapping rules error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get role mapping rules',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}

// 创建角色映射规则
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

    const ruleData = await request.json()

    // 验证必填字段
    if (!ruleData.providerId || !ruleData.condition || !ruleData.targetRole) {
      return NextResponse.json(
        { error: 'Provider ID, condition, and target role are required' },
        { status: 400 }
      )
    }

    // 验证条件格式
    const { condition } = ruleData
    if (!condition.attribute || !condition.operator || condition.value === undefined) {
      return NextResponse.json(
        { error: 'Invalid condition format' },
        { status: 400 }
      )
    }

    const rule = await SSORoleMappingService.createRoleMappingRule({
      providerId: ruleData.providerId,
      condition: ruleData.condition,
      targetRole: ruleData.targetRole,
      priority: ruleData.priority || 0,
      description: ruleData.description,
      isActive: ruleData.isActive ?? true
    })

    return NextResponse.json({
      success: true,
      rule
    })

  } catch (error) {
    console.error('Create role mapping rule error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create role mapping rule',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}