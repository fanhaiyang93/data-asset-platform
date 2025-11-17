'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useUserPermissions } from '@/components/auth/RouteGuard'

export default function UnauthorizedPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useUserPermissions()

  const requiredRoles = searchParams.get('required')?.split(',') || []
  const currentRole = searchParams.get('current') || user?.role || 'unknown'
  const resource = searchParams.get('resource')
  const action = searchParams.get('action')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <div className="flex items-center justify-center mb-6">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            权限不足
          </h1>

          <div className="text-gray-600 mb-6 space-y-2">
            <p>抱歉，您没有权限访问此页面。</p>

            {requiredRoles.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
                <p><span className="font-medium">所需角色:</span> {requiredRoles.join(', ')}</p>
                <p><span className="font-medium">当前角色:</span> {currentRole}</p>
              </div>
            )}

            {resource && action && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                <p><span className="font-medium">需要权限:</span> 对资源 "{resource}" 执行 "{action}" 操作</p>
                <p><span className="font-medium">当前角色:</span> {currentRole}</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={() => router.back()}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded transition-colors"
            >
              返回上一页
            </button>

            <button
              onClick={() => router.push('/')}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition-colors"
            >
              返回首页
            </button>

            {user && (
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500 mb-2">
                  如需更高权限，请联系系统管理员
                </p>
                <div className="text-xs text-gray-400">
                  用户ID: {user.id}<br/>
                  用户角色: {user.role}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}