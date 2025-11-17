import React from 'react';
import { Card, Typography, Space, Button, Tooltip, Tag } from 'antd';
import { EyeOutlined, TeamOutlined, ClockCircleOutlined, DatabaseOutlined } from '@ant-design/icons';
import { StatusBadge, type AssetStatus, isStatusApplicable } from '@/components/common/StatusBadge';
import { themeColors } from '@/theme';

const { Title, Text, Paragraph } = Typography;

export interface AssetCardProps {
  /** 数据资产ID */
  id: string;
  /** 资产标题 */
  title: string;
  /** 业务分类 */
  category: '人力资源' | '财务数据' | '法务数据';
  /** 资产描述 */
  description: string;
  /** 资产状态 */
  status: AssetStatus;
  /** 负责人 */
  owner: string;
  /** 更新频率 */
  updateFrequency: string;
  /** 申请次数（可选） */
  applicationCount?: number;
  /** 卡片变体 */
  variant?: 'standard' | 'compact' | 'recommended';
  /** 点击查看详情的回调 */
  onViewDetail?: (id: string) => void;
  /** 点击申请的回调 */
  onApply?: (id: string) => void;
  /** 是否显示推荐标识 */
  isRecommended?: boolean;
  /** 自定义类名 */
  className?: string;
}

// 业务分类颜色配置
const categoryColors = {
  '人力资源': themeColors.primary,      // 蓝色主题
  '财务数据': themeColors.success,      // 绿色主题
  '法务数据': themeColors.insight,      // 紫色主题
} as const;

/**
 * AssetCard - 资产卡片组件
 *
 * 用于在首页、分类页面、搜索结果中展示数据资产概览信息
 * 遵循UX设计规范中的卡片网格设计方向
 *
 * 特性：
 * - 三种变体：标准卡片、紧凑卡片、推荐卡片
 * - 悬停效果：轻微上升、阴影加深、边框高亮
 * - 状态驱动：根据状态控制操作按钮的可用性
 * - 语义化色彩：业务分类使用不同主题色
 * - 无障碍支持：完整的ARIA标签和键盘导航
 */
export const AssetCard: React.FC<AssetCardProps> = ({
  id,
  title,
  category,
  description,
  status,
  owner,
  updateFrequency,
  applicationCount,
  variant = 'standard',
  onViewDetail,
  onApply,
  isRecommended = false,
  className = '',
}) => {
  const isApplicable = isStatusApplicable(status);
  const categoryColor = categoryColors[category];

  // 根据变体设置样式
  const getCardStyles = () => {
    const baseStyles = {
      borderRadius: '12px',
      transition: 'all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1)',
      cursor: 'pointer',
      border: '1px solid #f0f0f0',
      position: 'relative' as const,
    };

    const hoverStyles = {
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      borderColor: categoryColor,
    };

    if (variant === 'compact') {
      return {
        ...baseStyles,
        height: '200px',
      };
    }

    if (variant === 'recommended') {
      return {
        ...baseStyles,
        border: `2px solid ${themeColors.insight}20`,
        background: `linear-gradient(135deg, ${themeColors.insight}05 0%, #ffffff 100%)`,
      };
    }

    return baseStyles;
  };

  const handleCardClick = () => {
    onViewDetail?.(id);
  };

  const handleApplyClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发卡片点击事件
    onApply?.(id);
  };

  return (
    <Card
      hoverable
      className={`asset-card asset-card-${variant} ${className}`}
      style={getCardStyles()}
      onClick={handleCardClick}
      role="article"
      aria-label={`数据资产：${title}，分类：${category}，状态：${status}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      styles={{
        body: {
          padding: variant === 'compact' ? '16px' : '20px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* 推荐标识 */}
      {(isRecommended || variant === 'recommended') && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 1,
          }}
        >
          <Tag
            color={themeColors.insight}
            style={{
              margin: 0,
              fontSize: '11px',
              fontWeight: 500,
              borderRadius: '12px',
              padding: '2px 8px',
            }}
          >
            推荐
          </Tag>
        </div>
      )}

      {/* 头部信息 */}
      <div style={{ marginBottom: '12px' }}>
        <Space
          style={{
            width: '100%',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '8px',
          }}
        >
          <Title
            level={variant === 'compact' ? 5 : 4}
            style={{
              margin: 0,
              fontSize: variant === 'compact' ? '14px' : '16px',
              fontWeight: 600,
              color: themeColors.textPrimary,
              lineHeight: 1.4,
              paddingRight: isRecommended ? '50px' : '0',
            }}
            ellipsis={{ tooltip: true }}
          >
            {title}
          </Title>
        </Space>

        <Space size="small" style={{ marginBottom: '8px' }}>
          <Tag
            color={categoryColor}
            style={{
              margin: 0,
              fontSize: '11px',
              fontWeight: 500,
              borderRadius: '4px',
              padding: '2px 6px',
            }}
          >
            {category}
          </Tag>
          <StatusBadge status={status} size="small" />
        </Space>
      </div>

      {/* 描述内容 */}
      <div style={{ flex: 1, marginBottom: '16px' }}>
        <Paragraph
          style={{
            margin: 0,
            fontSize: '13px',
            lineHeight: 1.5,
            color: themeColors.textSecondary,
          }}
          ellipsis={{
            rows: variant === 'compact' ? 2 : 3,
            tooltip: description,
          }}
        >
          {description}
        </Paragraph>
      </div>

      {/* 元数据信息 */}
      <div style={{ marginBottom: '16px' }}>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Space size="small" style={{ fontSize: '12px', color: themeColors.textTertiary }}>
            <TeamOutlined />
            <Text style={{ fontSize: '12px', color: themeColors.textTertiary }}>
              负责人：{owner}
            </Text>
          </Space>
          <Space size="small" style={{ fontSize: '12px', color: themeColors.textTertiary }}>
            <ClockCircleOutlined />
            <Text style={{ fontSize: '12px', color: themeColors.textTertiary }}>
              更新频率：{updateFrequency}
            </Text>
          </Space>
          {applicationCount !== undefined && (
            <Space size="small" style={{ fontSize: '12px', color: themeColors.textTertiary }}>
              <DatabaseOutlined />
              <Text style={{ fontSize: '12px', color: themeColors.textTertiary }}>
                申请次数：{applicationCount}
              </Text>
            </Space>
          )}
        </Space>
      </div>

      {/* 操作按钮 */}
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Button
          type="default"
          icon={<EyeOutlined />}
          size={variant === 'compact' ? 'small' : 'middle'}
          onClick={handleCardClick}
          style={{
            borderColor: categoryColor,
            color: categoryColor,
            fontWeight: 500,
          }}
        >
          查看详情
        </Button>

        {isApplicable ? (
          <Button
            type="primary"
            size={variant === 'compact' ? 'small' : 'middle'}
            onClick={handleApplyClick}
            style={{
              backgroundColor: categoryColor,
              borderColor: categoryColor,
              fontWeight: 500,
            }}
          >
            立即申请
          </Button>
        ) : (
          <Tooltip title="当前状态不可申请">
            <Button
              type="primary"
              size={variant === 'compact' ? 'small' : 'middle'}
              disabled
              style={{ fontWeight: 500 }}
            >
              暂不可申请
            </Button>
          </Tooltip>
        )}
      </Space>
    </Card>
  );
};

export default AssetCard;