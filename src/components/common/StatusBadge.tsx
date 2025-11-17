import React from 'react';
import { Tag } from 'antd';
import { CheckCircleOutlined, ToolOutlined, StopOutlined, ClockCircleOutlined, StarOutlined } from '@ant-design/icons';
import { themeColors } from '@/theme';

export type AssetStatus = 'available' | 'maintenance' | 'offline' | 'applying' | 'popular';

interface StatusBadgeProps {
  status: AssetStatus;
  className?: string;
  size?: 'small' | 'default';
}

// 状态配置映射
const statusConfig = {
  available: {
    color: themeColors.statusAvailable,
    backgroundColor: '#f6ffed',
    icon: <CheckCircleOutlined />,
    text: '可用',
  },
  maintenance: {
    color: themeColors.statusMaintenance,
    backgroundColor: '#fff7e6',
    icon: <ToolOutlined />,
    text: '维护中',
  },
  offline: {
    color: themeColors.statusOffline,
    backgroundColor: '#f5f5f5',
    icon: <StopOutlined />,
    text: '已下线',
  },
  applying: {
    color: themeColors.statusInProgress,
    backgroundColor: '#e6f7ff',
    icon: <ClockCircleOutlined />,
    text: '申请中',
  },
  popular: {
    color: themeColors.statusNeedAction,
    backgroundColor: '#f9f0ff',
    icon: <StarOutlined />,
    text: '热门',
  },
} as const;

/**
 * StatusBadge - 状态标签组件
 *
 * 用于统一展示数据资产的各种状态信息，遵循UX设计规范中的语义化色彩系统
 *
 * 特性：
 * - 语义化颜色：绿色(可用)、橙色(维护中)、灰色(已下线)、蓝色(申请中)、紫色(热门)
 * - 图标增强：不仅依赖颜色，还使用图标传达状态信息，符合无障碍设计
 * - 响应式尺寸：支持small和default两种尺寸
 * - 一致性设计：统一的圆角、间距、阴影效果
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className = '',
  size = 'default'
}) => {
  const config = statusConfig[status];

  if (!config) {
    console.warn(`StatusBadge: Unknown status "${status}"`);
    return null;
  }

  return (
    <Tag
      icon={config.icon}
      color={config.color}
      className={`status-badge status-badge-${status} ${className}`}
      style={{
        backgroundColor: config.backgroundColor,
        color: config.color,
        border: `1px solid ${config.color}20`,
        borderRadius: size === 'small' ? '4px' : '6px',
        padding: size === 'small' ? '2px 6px' : '4px 8px',
        fontSize: size === 'small' ? '11px' : '12px',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        margin: 0,
      }}
    >
      {config.text}
    </Tag>
  );
};

// 工具函数：根据状态获取语义化描述
export const getStatusDescription = (status: AssetStatus): string => {
  const descriptions = {
    available: '数据资产当前可用，可以正常申请访问',
    maintenance: '数据资产正在维护中，暂时无法申请',
    offline: '数据资产已下线，不再提供服务',
    applying: '正在申请访问该数据资产',
    popular: '热门数据资产，使用频率较高',
  };

  return descriptions[status] || '未知状态';
};

// 工具函数：检查状态是否可申请
export const isStatusApplicable = (status: AssetStatus): boolean => {
  return status === 'available' || status === 'popular';
};

// 工具函数：获取状态优先级（用于排序）
export const getStatusPriority = (status: AssetStatus): number => {
  const priorities = {
    available: 1,
    popular: 2,
    maintenance: 3,
    applying: 4,
    offline: 5,
  };

  return priorities[status] || 999;
};

export default StatusBadge;