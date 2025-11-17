'use client'

import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Phone,
  Mail,
  Copy,
  ChevronDown,
  ChevronUp,
  Clock,
  Wifi,
  Shield,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { RedirectError as RedirectErrorType } from '@/types/platform'

export interface RedirectErrorProps {
  error: RedirectErrorType
  fallbackUrl?: string
  onRetry?: () => void
  onClose?: () => void
  showTechnicalDetails?: boolean
  className?: string
}

export function RedirectError({
  error,
  fallbackUrl,
  onRetry,
  onClose,
  showTechnicalDetails = false,
  className
}: RedirectErrorProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [copied, setCopied] = useState(false)

  // 错误分类和严重程度
  const getErrorSeverity = (code: string): 'low' | 'medium' | 'high' => {
    const highSeverity = ['AUTH_FAILED', 'PLATFORM_UNAVAILABLE', 'SECURITY_VIOLATION']
    const mediumSeverity = ['NETWORK_ERROR', 'TIMEOUT', 'INVALID_PARAMETERS']

    if (highSeverity.includes(code)) return 'high'
    if (mediumSeverity.includes(code)) return 'medium'
    return 'low'
  }

  // 获取错误图标
  const getErrorIcon = (code: string) => {
    switch (code) {
      case 'NETWORK_ERROR':
        return <Wifi className="h-5 w-5" />
      case 'AUTH_FAILED':
        return <Shield className="h-5 w-5" />
      case 'TIMEOUT':
        return <Clock className="h-5 w-5" />
      case 'PLATFORM_UNAVAILABLE':
        return <Settings className="h-5 w-5" />
      default:
        return <AlertTriangle className="h-5 w-5" />
    }
  }

  // 获取用户友好的错误消息
  const getUserFriendlyMessage = (code: string, originalMessage: string): string => {
    const messages: Record<string, string> = {
      'REDIRECT_URL_GENERATION_FAILED': '无法生成跳转链接，请检查申请信息是否完整',
      'REDIRECT_EXECUTION_FAILED': '跳转执行失败，可能是浏览器阻止了弹窗',
      'AUTH_FAILED': '身份验证失败，请重新登录后再试',
      'PLATFORM_UNAVAILABLE': '目标平台暂时不可用，请稍后重试或联系技术支持',
      'NETWORK_ERROR': '网络连接异常，请检查网络设置后重试',
      'TIMEOUT': '请求超时，可能是网络较慢，请稍后重试',
      'INVALID_PARAMETERS': '参数验证失败，请联系技术支持',
      'SECURITY_VIOLATION': '安全验证失败，请联系管理员',
      'POPUP_BLOCKED': '浏览器阻止了弹窗，请允许弹窗后重试'
    }

    return messages[code] || originalMessage
  }

  // 获取解决方案
  const getSolutions = (code: string): string[] => {
    const solutions: Record<string, string[]> = {
      'REDIRECT_URL_GENERATION_FAILED': [
        '检查申请信息是否完整填写',
        '确认您有访问该平台的权限',
        '刷新页面后重试'
      ],
      'REDIRECT_EXECUTION_FAILED': [
        '允许浏览器弹窗功能',
        '尝试使用当前窗口跳转模式',
        '手动复制链接在新标签页打开'
      ],
      'AUTH_FAILED': [
        '重新登录系统',
        '清除浏览器缓存和Cookie',
        '检查账号是否被锁定'
      ],
      'PLATFORM_UNAVAILABLE': [
        '等待5-10分钟后重试',
        '检查平台维护公告',
        '联系平台管理员确认状态'
      ],
      'NETWORK_ERROR': [
        '检查网络连接',
        '尝试切换网络环境',
        '关闭VPN或代理软件'
      ],
      'TIMEOUT': [
        '检查网络速度',
        '稍后重试（建议等待2-3分钟）',
        '联系网络管理员'
      ],
      'POPUP_BLOCKED': [
        '在浏览器地址栏允许弹窗',
        '暂时禁用弹窗阻止插件',
        '使用当前窗口模式跳转'
      ]
    }

    return solutions[code] || [
      '刷新页面重试',
      '清除浏览器缓存',
      '联系技术支持'
    ]
  }

  // 复制错误信息
  const copyErrorInfo = async () => {
    const errorInfo = {
      错误代码: error.code,
      错误消息: error.message,
      平台: error.platform,
      时间: new Date().toLocaleString(),
      详细信息: error.details
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(errorInfo, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  const severity = getErrorSeverity(error.code)
  const friendlyMessage = getUserFriendlyMessage(error.code, error.message)
  const solutions = getSolutions(error.code)

  return (
    <div className={cn('space-y-4', className)}>
      {/* 主要错误信息 */}
      <Alert variant="destructive">
        <div className="flex items-start gap-3">
          {getErrorIcon(error.code)}
          <div className="flex-1">
            <AlertTitle className="flex items-center gap-2">
              跳转失败
              <Badge variant={severity === 'high' ? 'destructive' : severity === 'medium' ? 'default' : 'secondary'}>
                {severity === 'high' ? '严重' : severity === 'medium' ? '警告' : '提示'}
              </Badge>
            </AlertTitle>
            <AlertDescription className="mt-2">
              {friendlyMessage}
            </AlertDescription>
          </div>
        </div>
      </Alert>

      {/* 解决方案 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            推荐解决方案
          </CardTitle>
          <CardDescription>
            请尝试以下解决方案来解决问题
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {solutions.map((solution, index) => (
            <div key={index} className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 text-xs">
                {index + 1}
              </Badge>
              <span className="text-sm">{solution}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 手动跳转备选方案 */}
      {fallbackUrl && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              手动跳转链接
            </CardTitle>
            <CardDescription>
              自动跳转失败时，您可以使用以下链接手动访问
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={fallbackUrl}
                readOnly
                className="flex-1 px-3 py-2 text-sm bg-muted border rounded-md"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(fallbackUrl)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => window.open(fallbackUrl, '_blank')}
              >
                打开链接
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2">
        {onRetry && (
          <Button onClick={onRetry} className="flex-1">
            <RefreshCw className="mr-2 h-4 w-4" />
            重试跳转
          </Button>
        )}
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        )}
      </div>

      {/* 技术支持联系方式 */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" />
            需要帮助？
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            如果问题持续存在，请联系技术支持：
          </p>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>support@company.com</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span>400-123-4567</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 技术详情（可选） */}
      {showTechnicalDetails && (
        <Card>
          <CardHeader>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="w-full justify-between p-0 h-auto"
            >
              <span className="text-base font-semibold">技术详情</span>
              {showDetails ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CardHeader>
          {showDetails && (
            <CardContent className="space-y-2">
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div>
                  <strong>错误代码:</strong> {error.code}
                </div>
                <div>
                  <strong>平台:</strong> {error.platform}
                </div>
                <div>
                  <strong>原始消息:</strong> {error.message}
                </div>
                {error.details && (
                  <div>
                    <strong>详细信息:</strong>
                    <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto">
                      {JSON.stringify(error.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={copyErrorInfo}
                className="w-full"
              >
                <Copy className="mr-2 h-4 w-4" />
                {copied ? '已复制' : '复制错误信息'}
              </Button>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}