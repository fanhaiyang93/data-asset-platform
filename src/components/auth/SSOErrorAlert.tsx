'use client'

import { useState } from 'react'

interface SSOErrorAlertProps {
  error: string;
  provider?: string;
  fallbackStrategy?: string;
  onRetry?: () => void;
  onFallback?: () => void;
  onDismiss: () => void;
}

export default function SSOErrorAlert({
  error,
  provider,
  fallbackStrategy,
  onRetry,
  onFallback,
  onDismiss
}: SSOErrorAlertProps) {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss();
  };

  if (!isVisible) return null;

  // 根据错误类型确定图标和颜色
  const getErrorIcon = () => {
    if (fallbackStrategy) {
      return '⚠️'; // 降级警告
    }
    return '❌'; // 一般错误
  };

  const getErrorClass = () => {
    if (fallbackStrategy) {
      return 'bg-yellow-50 border-yellow-200';
    }
    return 'bg-red-50 border-red-200';
  };

  const getTextClass = () => {
    if (fallbackStrategy) {
      return 'text-yellow-800';
    }
    return 'text-red-800';
  };

  return (
    <div className={`rounded-md border p-4 ${getErrorClass()}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <span className="text-xl">{getErrorIcon()}</span>
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${getTextClass()}`}>
            {provider ? `${provider.toUpperCase()} 登录` : 'SSO登录'}
            {fallbackStrategy ? '服务异常' : '失败'}
          </h3>
          <div className={`mt-2 text-sm ${getTextClass()}`}>
            <p>{error}</p>

            {fallbackStrategy && (
              <p className="mt-2 text-xs">
                💡 <strong>建议：</strong>
                {fallbackStrategy === 'local_auth' && '您可以使用账号密码登录'}
                {fallbackStrategy === 'maintenance_mode' && '系统维护中，请稍后重试'}
                {fallbackStrategy === 'queue_requests' && '服务繁忙，建议稍后重试'}
              </p>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="mt-4 flex flex-wrap gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                🔄 重试
              </button>
            )}

            {onFallback && fallbackStrategy === 'local_auth' && (
              <button
                onClick={onFallback}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                🔑 使用密码登录
              </button>
            )}

            <button
              onClick={handleDismiss}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              ✕ 关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}