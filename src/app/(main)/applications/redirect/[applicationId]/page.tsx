import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PlatformIntegrationService } from '@/lib/services/platformIntegration'
import { PlatformRedirect } from '@/components/ui/application/PlatformRedirect'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface PageProps {
  params: {
    applicationId: string
  }
  searchParams: {
    platform?: string
    mode?: 'new_window' | 'current_window' | 'iframe'
  }
}

export default async function RedirectPage({ params, searchParams }: PageProps) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const { applicationId } = params
  const { platform, mode } = searchParams

  try {
    // 获取申请信息
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        user: true,
        asset: true
      }
    })

    if (!application) {
      return (
        <div className="container mx-auto py-8">
          <Card>
            <CardHeader>
              <CardTitle>申请未找到</CardTitle>
              <CardDescription>
                指定的申请不存在或您没有访问权限
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )
    }

    // 验证用户权限
    if (application.userId !== session.user.id && session.user.role !== 'admin') {
      return (
        <div className="container mx-auto py-8">
          <Card>
            <CardHeader>
              <CardTitle>访问被拒绝</CardTitle>
              <CardDescription>
                您没有访问此申请的权限
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )
    }

    if (!platform) {
      // 显示平台选择页面
      const supportedPlatforms = PlatformIntegrationService.getSupportedPlatforms()

      return (
        <div className="container mx-auto py-8">
          <Card>
            <CardHeader>
              <CardTitle>选择跳转平台</CardTitle>
              <CardDescription>
                请选择要跳转的第三方平台完成申请审批
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {supportedPlatforms.map((platformKey) => (
                  <Card
                    key={platformKey}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => {
                      window.location.href = `/applications/redirect/${applicationId}?platform=${platformKey}`
                    }}
                  >
                    <CardContent className="p-4 text-center">
                      <h3 className="font-semibold capitalize">{platformKey.replace('_', ' ')}</h3>
                      <p className="text-sm text-muted-foreground mt-2">
                        {getPlatformDescription(platformKey)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    // 显示跳转组件
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>第三方平台跳转</CardTitle>
            <CardDescription>
              正在准备跳转到 {platform.replace('_', ' ')} 平台...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PlatformRedirect
              applicationId={applicationId}
              platform={platform}
              mode={mode}
            />
          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    console.error('跳转页面错误:', error)

    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>系统错误</CardTitle>
            <CardDescription>
              加载跳转页面时发生错误，请稍后重试
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }
}

function getPlatformDescription(platform: string): string {
  const descriptions: Record<string, string> = {
    hive: '数据平台 - 进行数据访问审批',
    enterprise_wechat: '企业微信 - 企业内部审批流程',
    oa_system: 'OA系统 - 办公自动化审批'
  }

  return descriptions[platform] || '第三方平台审批'
}

export async function generateMetadata({ params }: { params: { applicationId: string } }) {
  return {
    title: '第三方平台跳转',
    description: `申请 ${params.applicationId} 的第三方平台跳转页面`
  }
}