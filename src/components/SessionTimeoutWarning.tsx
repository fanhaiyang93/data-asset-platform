'use client'

import { useSessionTimeout } from '@/hooks/useSessionTimeout'
import { useAuth } from '@/hooks/useAuth'

export default function SessionTimeoutWarning() {
  const { showWarning, timeLeft, extendSession, formatTimeLeft } = useSessionTimeout()
  const { logout } = useAuth()

  if (!showWarning) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <svg
              className="h-6 w-6 text-yellow-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-gray-900">
              会话即将过期
            </h3>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            由于长时间未操作，您的会话将在以下时间后自动登出：
          </p>
          <div className="text-center">
            <span className="text-2xl font-bold text-red-600">
              {formatTimeLeft(timeLeft)}
            </span>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={extendSession}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            继续会话
          </button>
          <button
            onClick={logout}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            立即登出
          </button>
        </div>

        <p className="mt-3 text-xs text-gray-500 text-center">
          如果您不做任何操作，系统将自动登出以保护您的账户安全。
        </p>
      </div>
    </div>
  )
}