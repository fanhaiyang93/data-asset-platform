'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import SSOErrorAlert from '@/components/auth/SSOErrorAlert'
import SSOStatusIndicator from '@/components/auth/SSOStatusIndicator'

const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
})

type LoginForm = z.infer<typeof loginSchema>

interface SSOProvider {
  name: string;
  key: string;
  available: boolean;
  displayName: string;
  icon: string;
  fallbackActive?: boolean;
  fallbackStrategy?: string;
}

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState<LoginForm>({
    username: '',
    password: '',
  })
  const [errors, setErrors] = useState<Partial<LoginForm>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [ssoProviders, setSSOProviders] = useState<SSOProvider[]>([])
  const [ssoLoading, setSSOLoading] = useState<Record<string, boolean>>({})
  const [showLocalAuth, setShowLocalAuth] = useState(false)
  const [ssoError, setSSOError] = useState<{
    message: string;
    provider?: string;
    fallbackStrategy?: string;
  } | null>(null)
  const [checkingAvailability, setCheckingAvailability] = useState(true)

  // 检查SSO可用性和降级状态
  useEffect(() => {
    const checkSSOAvailability = async () => {
      const providers: SSOProvider[] = [
        {
          name: 'SAML',
          key: 'saml',
          available: false,
          displayName: '企业SSO登录',
          icon: '🏢'
        },
        {
          name: 'OAuth',
          key: 'oauth',
          available: false,
          displayName: 'OAuth登录',
          icon: '🔗'
        }
      ];

      try {
        // 批量检查所有提供商的可用性
        const response = await fetch('/api/auth/sso/availability', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            providers: providers.map(p => p.key)
          })
        });

        if (response.ok) {
          const data = await response.json();

          if (data.success && data.results) {
            // 更新提供商可用性状态
            data.results.forEach((result: any) => {
              const provider = providers.find(p => p.key === result.provider);
              if (provider) {
                provider.available = result.available;
              }
            });
          }
        } else {
          console.error('Failed to check SSO availability:', response.statusText);
        }

        // 检查降级状态
        const fallbackResponse = await fetch('/api/auth/sso/fallback');
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();

          if (fallbackData.success && fallbackData.healthStatuses) {
            // 根据降级状态调整可用性
            fallbackData.healthStatuses.forEach((status: any) => {
              const provider = providers.find(p => p.key === status.provider);
              if (provider) {
                if (!status.healthy) {
                  provider.fallbackActive = true;
                  provider.fallbackStrategy = fallbackData.fallbackStrategy || 'local_auth';
                  console.warn(`SSO provider ${status.provider} is in fallback mode`);
                } else {
                  provider.fallbackActive = false;
                }
              }
            });
          }
        }

      } catch (error) {
        console.error('Error checking SSO availability:', error);
        // 发生错误时，默认启用本地认证
        providers.forEach(provider => {
          provider.available = false;
        });
      }

      setSSOProviders(providers);

      // 如果没有可用的SSO提供商，直接显示本地认证
      if (!providers.some(p => p.available)) {
        setShowLocalAuth(true);
      }

      setCheckingAvailability(false);
    };

    checkSSOAvailability();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    // 清除对应字段的错误
    if (errors[name as keyof LoginForm]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
    setApiError('') // 清除API错误
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setApiError('')

    try {
      // 前端验证
      const validatedData = loginSchema.parse(form)

      // 调用登录API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validatedData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '登录失败')
      }

      // 登录成功，重定向到主页
      router.push('/')
      router.refresh()
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<LoginForm> = {}
        error.issues.forEach((issue) => {
          if (issue.path[0]) {
            fieldErrors[issue.path[0] as keyof LoginForm] = issue.message
          }
        })
        setErrors(fieldErrors)
      } else {
        setApiError(error instanceof Error ? error.message : '登录失败，请重试')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // 处理SSO登录
  const handleSSOLogin = async (provider: string) => {
    try {
      setSSOLoading(prev => ({ ...prev, [provider]: true }));
      setApiError('');

      // 首先检查提供商是否仍然可用
      const availabilityResponse = await fetch(`/api/auth/sso/availability?provider=${provider}`);

      if (availabilityResponse.ok) {
        const availabilityData = await availabilityResponse.json();

        if (!availabilityData.available) {
          throw new Error(`${provider.toUpperCase()}服务当前不可用，请稍后重试或使用其他登录方式`);
        }
      }

      // 检查降级状态
      const fallbackResponse = await fetch(`/api/auth/sso/fallback?provider=${provider}`);
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();

        if (fallbackData.fallbackActive) {
          // 显示降级提示
          const fallbackMessage = getFallbackMessage(fallbackData.fallbackStrategy);
          if (!confirm(`${provider.toUpperCase()}服务异常：${fallbackMessage}\n\n是否继续尝试登录？`)) {
            setSSOLoading(prev => ({ ...prev, [provider]: false }));
            return;
          }
        }
      }

      // 重定向到SSO端点
      if (provider === 'saml') {
        // SAML通常需要重定向到IDP
        window.location.href = `/api/auth/sso/saml`;
      } else if (provider === 'oauth') {
        // OAuth重定向到授权初始化端点（包含state生成）
        const currentUrl = window.location.href;
        const redirectUrl = new URL('/api/auth/sso/oauth/authorize', window.location.origin);
        redirectUrl.searchParams.set('redirect', '/');

        window.location.href = redirectUrl.toString();
      }

    } catch (error) {
      console.error('SSO login error:', error);
      setApiError(error instanceof Error ? error.message : 'SSO登录失败，请重试');
      setSSOLoading(prev => ({ ...prev, [provider]: false }));
    }
  };

  // 获取降级策略的用户友好提示
  const getFallbackMessage = (strategy: string): string => {
    switch (strategy) {
      case 'local_auth':
        return 'SSO服务暂时不可用，建议使用账号密码登录';
      case 'maintenance_mode':
        return '系统维护中，请稍后再试';
      case 'queue_requests':
        return 'SSO服务繁忙，请稍后重试';
      default:
        return 'SSO服务异常，请联系管理员';
    }
  };

  // 切换到本地认证
  const toggleLocalAuth = () => {
    setShowLocalAuth(!showLocalAuth);
    setApiError('');
    setErrors({});
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            登录数据资产管理平台
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            使用您的企业账号登录
          </p>
        </div>

        {/* SSO登录选项 */}
        {!showLocalAuth && ssoProviders.some(p => p.available) && (
          <div className="mt-8 space-y-3">
            {ssoProviders
              .filter(provider => provider.available)
              .map((provider) => (
                <button
                  key={provider.key}
                  onClick={() => handleSSOLogin(provider.key)}
                  disabled={ssoLoading[provider.key]}
                  className="group relative w-full flex justify-center py-3 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="mr-2">{provider.icon}</span>
                  {ssoLoading[provider.key] ? '登录中...' : provider.displayName}
                </button>
              ))
            }

            {/* 分隔线 */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 text-gray-500">或</span>
              </div>
            </div>

            {/* 切换到本地认证按钮 */}
            <button
              type="button"
              onClick={toggleLocalAuth}
              className="w-full text-sm text-indigo-600 hover:text-indigo-500 font-medium"
            >
              使用账号密码登录
            </button>
          </div>
        )}

        {/* 本地认证表单 */}
        {showLocalAuth && (
          <>
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">
                用户名或邮箱
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className={`relative block w-full px-3 py-2 border ${
                  errors.username ? 'border-red-300' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                placeholder="用户名或邮箱"
                value={form.username}
                onChange={handleChange}
                disabled={isLoading}
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">{errors.username}</p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                密码
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className={`relative block w-full px-3 py-2 border ${
                  errors.password ? 'border-red-300' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                placeholder="密码"
                value={form.password}
                onChange={handleChange}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>
          </div>


          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              }`}
            >
              {isLoading ? '登录中...' : '登录'}
            </button>
          </div>
        </form>

        {/* 返回SSO登录选项 */}
        {ssoProviders.some(p => p.available) && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={toggleLocalAuth}
              className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
            >
              返回SSO登录
            </button>
          </div>
        )}
        </>
        )}

        {/* 全局错误提示 */}
        {apiError && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  登录失败
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{apiError}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}