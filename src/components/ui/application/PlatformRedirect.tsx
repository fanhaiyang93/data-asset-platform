'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, ExternalLink, Monitor, Smartphone, AlertTriangle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlatformRedirectProps, RedirectMode, RedirectResult, RedirectError } from '@/types/platform'

export function PlatformRedirect({
  applicationId,
  platform,
  mode = 'new_window',
  onSuccess,
  onError,
  className
}: PlatformRedirectProps) {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<RedirectError | null>(null)
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [selectedMode, setSelectedMode] = useState<RedirectMode>(mode)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // 检测移动设备
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
      setIsMobile(isMobileDevice)

      // 移动端优化模式选择
      if (isMobileDevice) {
        setSelectedMode('current_window')
      }
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 生成跳转URL
  const generateRedirectUrl = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/platform/redirect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          applicationId,
          platform,
          mode: selectedMode
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '生成跳转URL失败')
      }

      const data = await response.json()
      setRedirectUrl(data.redirectUrl)

      const result: RedirectResult = {
        success: true,
        redirectUrl: data.redirectUrl,
        platform,
        timestamp: Date.now()
      }

      onSuccess?.(result)
    } catch (err) {
      const redirectError: RedirectError = {
        code: 'REDIRECT_URL_GENERATION_FAILED',
        message: err instanceof Error ? err.message : '未知错误',
        platform
      }

      setError(redirectError)
      onError?.(redirectError)
    } finally {
      setLoading(false)
    }
  }

  // 执行跳转
  const executeRedirect = () => {
    if (!redirectUrl) return

    try {
      switch (selectedMode) {
        case 'new_window':
          const features = isMobile
            ? 'width=375,height=667,scrollbars=1,resizable=1'
            : 'width=1200,height=800,scrollbars=1,resizable=1,toolbar=0,menubar=0'

          const newWindow = window.open(redirectUrl, `platform_${platform}`, features)

          if (!newWindow) {
            throw new Error('弹窗被阻止，请允许弹窗并重试')
          }

          // 监听窗口关闭
          const checkClosed = setInterval(() => {
            if (newWindow.closed) {
              clearInterval(checkClosed)
              console.log('第三方平台窗口已关闭')
            }
          }, 1000)

          break

        case 'current_window':
          window.location.href = redirectUrl
          break

        case 'iframe':
          // iframe模式将在组件中直接显示
          break
      }
    } catch (err) {
      const redirectError: RedirectError = {
        code: 'REDIRECT_EXECUTION_FAILED',
        message: err instanceof Error ? err.message : '跳转执行失败',
        platform
      }

      setError(redirectError)
      onError?.(redirectError)
    }
  }

  // 获取模式图标
  const getModeIcon = (modeType: RedirectMode) => {
    switch (modeType) {
      case 'new_window':
        return <ExternalLink className="h-4 w-4" />
      case 'current_window':
        return <Monitor className="h-4 w-4" />
      case 'iframe':
        return <Monitor className="h-4 w-4" />
      default:
        return <ExternalLink className="h-4 w-4" />
    }
  }

  // 获取平台显示名称
  const getPlatformDisplayName = (platformKey: string): string => {
    const names: Record<string, string> = {
      hive: 'Hive数据平台',
      enterprise_wechat: '企业微信',
      oa_system: 'OA办公系统'
    }
    return names[platformKey] || platformKey
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* 平台信息 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {getPlatformDisplayName(platform)}
          </h3>
          <p className="text-sm text-muted-foreground">
            申请ID: {applicationId}
          </p>
        </div>
        <Badge variant="outline">
          {isMobile ? <Smartphone className="h-3 w-3 mr-1" /> : <Monitor className="h-3 w-3 mr-1" />}
          {isMobile ? '移动端' : '桌面端'}
        </Badge>
      </div>

      {/* 跳转模式选择 */}
      {!isMobile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">跳转方式</CardTitle>
            <CardDescription>
              选择适合您的跳转方式
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {(['new_window', 'current_window', 'iframe'] as RedirectMode[]).map((modeType) => (
                <Button
                  key={modeType}
                  variant={selectedMode === modeType ? 'default' : 'outline'}
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => setSelectedMode(modeType)}
                >
                  {getModeIcon(modeType)}
                  {modeType === 'new_window' && '新窗口'}
                  {modeType === 'current_window' && '当前窗口'}
                  {modeType === 'iframe' && '嵌入式'}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 错误显示 */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>跳转失败:</strong> {error.message}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setError(null)}
            >
              重试
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 主要操作按钮 */}
      <div className="flex gap-2">
        {!redirectUrl ? (
          <Button
            onClick={generateRedirectUrl}
            disabled={loading}
            className="flex-1"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            生成跳转链接
          </Button>
        ) : (
          <>
            {selectedMode !== 'iframe' && (
              <Button
                onClick={executeRedirect}
                className="flex-1"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                跳转到平台
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setRedirectUrl(null)}
            >
              重新生成
            </Button>
          </>
        )}
      </div>

      {/* 手动跳转备选方案 */}
      {redirectUrl && (
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">跳转链接已生成</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              如果自动跳转失败，您可以复制以下链接手动访问：
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={redirectUrl}
                readOnly
                className="flex-1 px-2 py-1 text-xs bg-background border rounded"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(redirectUrl)}
              >
                复制链接
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* iframe模式显示 */}
      {selectedMode === 'iframe' && redirectUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">嵌入式平台页面</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <iframe
              ref={iframeRef}
              src={redirectUrl}
              className="w-full h-96 border-0 rounded-b-lg"
              title={`${getPlatformDisplayName(platform)} 平台页面`}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          </CardContent>
        </Card>
      )}

      {/* 移动端优化提示 */}
      {isMobile && (
        <Alert>
          <Smartphone className="h-4 w-4" />
          <AlertDescription>
            检测到您正在使用移动设备，已自动选择最适合的跳转方式。
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}