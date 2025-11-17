'use client'

interface SSOStatusIndicatorProps {
  provider: string;
  available: boolean;
  loading?: boolean;
  fallbackActive?: boolean;
}

export default function SSOStatusIndicator({
  provider,
  available,
  loading = false,
  fallbackActive = false
}: SSOStatusIndicatorProps) {
  const getStatusInfo = () => {
    if (loading) {
      return {
        icon: '⏳',
        color: 'text-blue-500',
        bgColor: 'bg-blue-100',
        text: '检查中...'
      };
    }

    if (!available) {
      return {
        icon: '🔴',
        color: 'text-red-500',
        bgColor: 'bg-red-100',
        text: '不可用'
      };
    }

    if (fallbackActive) {
      return {
        icon: '🟡',
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-100',
        text: '降级模式'
      };
    }

    return {
      icon: '🟢',
      color: 'text-green-500',
      bgColor: 'bg-green-100',
      text: '正常'
    };
  };

  const status = getStatusInfo();

  return (
    <div className="flex items-center space-x-2">
      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
        <span className="mr-1">{status.icon}</span>
        <span>{provider.toUpperCase()}</span>
      </div>
      <span className={`text-xs ${status.color}`}>
        {status.text}
      </span>
    </div>
  );
}