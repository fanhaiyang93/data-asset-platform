import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { AlertRule } from '@/lib/ssoLogger'

// 模拟告警规则数据存储（实际应用中应该使用数据库）
let alertRules: AlertRule[] = [
  {
    id: 'high_failure_rate',
    name: '高失败率告警',
    description: '当登录失败率超过20%时触发告警',
    condition: {
      metric: 'failed_login_rate',
      operator: 'gt',
      threshold: 20,
      timeWindow: 10
    },
    actions: [
      {
        type: 'email',
        target: 'admin@company.com',
        template: 'high_failure_rate'
      }
    ],
    isActive: true,
    cooldown: 30
  },
  {
    id: 'slow_response',
    name: '响应时间告警',
    description: '当平均响应时间超过5秒时触发告警',
    condition: {
      metric: 'response_time',
      operator: 'gt',
      threshold: 5000,
      timeWindow: 5
    },
    actions: [
      {
        type: 'email',
        target: 'admin@company.com',
        template: 'slow_response'
      },
      {
        type: 'webhook',
        target: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
      }
    ],
    isActive: true,
    cooldown: 15
  },
  {
    id: 'error_spike',
    name: '错误激增告警',
    description: '当5分钟内错误数超过50次时触发告警',
    condition: {
      metric: 'error_count',
      operator: 'gt',
      threshold: 50,
      timeWindow: 5
    },
    actions: [
      {
        type: 'email',
        target: 'admin@company.com'
      },
      {
        type: 'sms',
        target: '+86138000000000'
      }
    ],
    isActive: true,
    cooldown: 10
  }
]

let alertHistory: Array<{
  id: string
  ruleId: string
  ruleName: string
  triggeredAt: string
  status: 'fired' | 'resolved'
  message: string
  metadata?: any
}> = []

// 获取告警规则列表
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
    const type = searchParams.get('type') || 'rules'

    switch (type) {
      case 'rules':
        return NextResponse.json({
          success: true,
          rules: alertRules
        })

      case 'history':
        const limit = parseInt(searchParams.get('limit') || '50')
        const page = parseInt(searchParams.get('page') || '1')
        const skip = (page - 1) * limit

        const paginatedHistory = alertHistory.slice(skip, skip + limit)

        return NextResponse.json({
          success: true,
          history: paginatedHistory,
          pagination: {
            page,
            limit,
            total: alertHistory.length,
            pages: Math.ceil(alertHistory.length / limit)
          }
        })

      case 'metrics':
        const now = new Date()
        const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

        const recentAlerts = alertHistory.filter(alert =>
          new Date(alert.triggeredAt) >= past24h
        )

        const alertsByRule = alertRules.map(rule => ({
          ruleId: rule.id,
          ruleName: rule.name,
          alertCount: recentAlerts.filter(alert => alert.ruleId === rule.id).length,
          lastTriggered: rule.lastTriggered?.toISOString()
        }))

        return NextResponse.json({
          success: true,
          metrics: {
            totalRules: alertRules.length,
            activeRules: alertRules.filter(rule => rule.isActive).length,
            alertsLast24h: recentAlerts.length,
            alertsByRule
          }
        })

      default:
        return NextResponse.json(
          { error: 'Invalid type parameter' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Get alerts error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get alerts',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}

// 创建告警规则
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
    if (!ruleData.name || !ruleData.condition || !ruleData.actions) {
      return NextResponse.json(
        { error: 'Name, condition, and actions are required' },
        { status: 400 }
      )
    }

    // 生成新规则
    const newRule: AlertRule = {
      id: `rule_${Date.now()}`,
      name: ruleData.name,
      description: ruleData.description || '',
      condition: {
        metric: ruleData.condition.metric,
        operator: ruleData.condition.operator,
        threshold: ruleData.condition.threshold,
        timeWindow: ruleData.condition.timeWindow
      },
      actions: ruleData.actions,
      isActive: ruleData.isActive ?? true,
      cooldown: ruleData.cooldown || 30
    }

    // 验证规则配置
    const validation = validateAlertRule(newRule)
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.errors.join('; ') },
        { status: 400 }
      )
    }

    alertRules.push(newRule)

    return NextResponse.json({
      success: true,
      rule: newRule
    })

  } catch (error) {
    console.error('Create alert rule error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create alert rule',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}

// 测试告警规则
export async function PUT(request: NextRequest) {
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

    const { action, ruleId, ...data } = await request.json()

    switch (action) {
      case 'test':
        const rule = alertRules.find(r => r.id === ruleId)
        if (!rule) {
          return NextResponse.json(
            { error: 'Alert rule not found' },
            { status: 404 }
          )
        }

        // 模拟测试告警
        const testResult = await testAlertRule(rule)

        return NextResponse.json({
          success: true,
          testResult
        })

      case 'update':
        const ruleIndex = alertRules.findIndex(r => r.id === ruleId)
        if (ruleIndex === -1) {
          return NextResponse.json(
            { error: 'Alert rule not found' },
            { status: 404 }
          )
        }

        const updatedRule = { ...alertRules[ruleIndex], ...data }

        // 验证更新的规则
        const validation = validateAlertRule(updatedRule)
        if (!validation.isValid) {
          return NextResponse.json(
            { error: validation.errors.join('; ') },
            { status: 400 }
          )
        }

        alertRules[ruleIndex] = updatedRule

        return NextResponse.json({
          success: true,
          rule: updatedRule
        })

      case 'toggle':
        const toggleIndex = alertRules.findIndex(r => r.id === ruleId)
        if (toggleIndex === -1) {
          return NextResponse.json(
            { error: 'Alert rule not found' },
            { status: 404 }
          )
        }

        alertRules[toggleIndex].isActive = !alertRules[toggleIndex].isActive

        return NextResponse.json({
          success: true,
          rule: alertRules[toggleIndex]
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Alert rule action error:', error)
    return NextResponse.json(
      {
        error: 'Failed to perform alert action',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}

// 删除告警规则
export async function DELETE(request: NextRequest) {
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
    const ruleId = searchParams.get('ruleId')

    if (!ruleId) {
      return NextResponse.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      )
    }

    const ruleIndex = alertRules.findIndex(r => r.id === ruleId)
    if (ruleIndex === -1) {
      return NextResponse.json(
        { error: 'Alert rule not found' },
        { status: 404 }
      )
    }

    alertRules.splice(ruleIndex, 1)

    return NextResponse.json({
      success: true,
      message: 'Alert rule deleted successfully'
    })

  } catch (error) {
    console.error('Delete alert rule error:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete alert rule',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}

// 验证告警规则
function validateAlertRule(rule: AlertRule): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!rule.name?.trim()) {
    errors.push('规则名称不能为空')
  }

  if (!rule.condition?.metric) {
    errors.push('监控指标不能为空')
  }

  if (!['failed_login_rate', 'response_time', 'error_count', 'login_count'].includes(rule.condition?.metric)) {
    errors.push('无效的监控指标')
  }

  if (!rule.condition?.operator || !['gt', 'gte', 'lt', 'lte', 'eq'].includes(rule.condition.operator)) {
    errors.push('无效的比较操作符')
  }

  if (typeof rule.condition?.threshold !== 'number') {
    errors.push('阈值必须是数字')
  }

  if (!rule.condition?.timeWindow || rule.condition.timeWindow < 1) {
    errors.push('时间窗口必须大于0分钟')
  }

  if (!rule.actions || rule.actions.length === 0) {
    errors.push('至少需要配置一个告警动作')
  }

  for (const action of rule.actions || []) {
    if (!action.type || !['email', 'webhook', 'sms'].includes(action.type)) {
      errors.push('无效的告警动作类型')
    }

    if (!action.target?.trim()) {
      errors.push('告警动作目标不能为空')
    }

    if (action.type === 'email' && !isValidEmail(action.target)) {
      errors.push('无效的邮箱地址')
    }

    if (action.type === 'webhook' && !isValidUrl(action.target)) {
      errors.push('无效的Webhook URL')
    }
  }

  if (typeof rule.cooldown !== 'number' || rule.cooldown < 0) {
    errors.push('冷却时间必须是非负数')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// 测试告警规则
async function testAlertRule(rule: AlertRule) {
  try {
    // 模拟测试结果
    const testAlert = {
      id: `test_${Date.now()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      triggeredAt: new Date().toISOString(),
      status: 'fired' as const,
      message: `测试告警：${rule.name}`,
      metadata: {
        isTest: true,
        condition: rule.condition,
        testValue: rule.condition.threshold + 1
      }
    }

    // 添加到历史记录
    alertHistory.unshift(testAlert)

    // 限制历史记录长度
    if (alertHistory.length > 1000) {
      alertHistory = alertHistory.slice(0, 1000)
    }

    // 模拟执行告警动作
    const actionResults = []
    for (const action of rule.actions) {
      try {
        await simulateAlertAction(action, rule, testAlert)
        actionResults.push({
          type: action.type,
          target: action.target,
          status: 'success',
          message: `测试${action.type}告警成功`
        })
      } catch (error) {
        actionResults.push({
          type: action.type,
          target: action.target,
          status: 'failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return {
      success: true,
      alert: testAlert,
      actionResults
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Test failed'
    }
  }
}

// 模拟执行告警动作
async function simulateAlertAction(action: AlertRule['actions'][0], rule: AlertRule, alert: any) {
  // 模拟延迟
  await new Promise(resolve => setTimeout(resolve, Math.random() * 1000))

  switch (action.type) {
    case 'email':
      console.log(`模拟发送邮件告警到 ${action.target}`)
      break
    case 'webhook':
      console.log(`模拟发送Webhook告警到 ${action.target}`)
      break
    case 'sms':
      console.log(`模拟发送短信告警到 ${action.target}`)
      break
    default:
      throw new Error(`未知的告警类型: ${action.type}`)
  }
}

// 验证邮箱格式
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// 验证URL格式
function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}