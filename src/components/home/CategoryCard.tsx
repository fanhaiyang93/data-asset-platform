import React from 'react';
import { Card, Typography, Space, Avatar, Badge } from 'antd';
import { TeamOutlined, DollarOutlined, SafetyCertificateOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { themeColors } from '@/theme';

const { Title, Text } = Typography;

export type BusinessDomain = '人力资源' | '财务数据' | '法务数据';

interface CategoryCardProps {
  /** 业务域类型 */
  domain: BusinessDomain;
  /** 该域下的资产数量 */
  assetCount: number;
  /** 点击回调 */
  onClick?: (domain: BusinessDomain) => void;
  /** 自定义类名 */
  className?: string;
  /** 是否处于加载状态 */
  loading?: boolean;
}

// 业务域配置
const domainConfig = {
  '人力资源': {
    icon: <TeamOutlined style={{ fontSize: '32px' }} />,
    color: themeColors.primary,           // 蓝色主题
    backgroundColor: '#e6f7ff',
    gradient: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)',
    description: '员工信息、薪酬、绩效等人力资源数据',
  },
  '财务数据': {
    icon: <DollarOutlined style={{ fontSize: '32px' }} />,
    color: themeColors.success,           // 绿色主题
    backgroundColor: '#f6ffed',
    gradient: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)',
    description: '财务报表、预算、成本等财务管理数据',
  },
  '法务数据': {
    icon: <SafetyCertificateOutlined style={{ fontSize: '32px' }} />,
    color: themeColors.insight,           // 紫色主题
    backgroundColor: '#f9f0ff',
    gradient: 'linear-gradient(135deg, #f9f0ff 0%, #efdbff 100%)',
    description: '合同、法规、风险等法务合规数据',
  },
} as const;

/**
 * CategoryCard - 业务域分类组件
 *
 * 用于首页展示三大业务域的导航入口
 * 遵循UX设计规范中的视觉引导设计
 *
 * 特性：
 * - 渐变背景：每个业务域使用对应的主题色渐变
 * - 悬停动画：卡片上升、阴影扩散、图标放大
 * - 统计信息：显示该域下的资产数量
 * - 响应式设计：支持不同屏幕尺寸的适配
 * - 无障碍支持：键盘导航和屏幕阅读器支持
 */
export const CategoryCard: React.FC<CategoryCardProps> = ({
  domain,
  assetCount,
  onClick,
  className = '',
  loading = false,
}) => {
  const config = domainConfig[domain];

  const handleClick = () => {
    onClick?.(domain);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <Card
      hoverable
      loading={loading}
      className={`category-card category-card-${domain} ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`进入${domain}数据分类，共${assetCount}个资产`}
      style={{
        height: '240px',
        borderRadius: '16px',
        border: 'none',
        background: config.gradient,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        transition: 'all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1)',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
      styles={{
        body: {
          padding: '32px 24px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
        },
      }}
      // 悬停效果通过CSS实现
      onMouseEnter={(e) => {
        const card = e.currentTarget;
        card.style.transform = 'translateY(-8px) scale(1.02)';
        card.style.boxShadow = '0 12px 32px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        const card = e.currentTarget;
        card.style.transform = 'translateY(0) scale(1)';
        card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
      }}
    >
      {/* 装饰性背景元素 */}
      <div
        style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: `${config.color}15`,
          zIndex: 0,
        }}
      />

      {/* 主要内容 */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* 图标区域 */}
        <div style={{ marginBottom: '20px' }}>
          <Avatar
            size={64}
            style={{
              backgroundColor: config.color,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 4px 16px ${config.color}30`,
              transition: 'all 0.3s ease',
            }}
            className="category-icon"
          >
            {config.icon}
          </Avatar>
        </div>

        {/* 标题和统计 */}
        <div style={{ marginBottom: '12px' }}>
          <Space align="baseline" size="small">
            <Title
              level={3}
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: 600,
                color: config.color,
                lineHeight: 1.2,
              }}
            >
              {domain}
            </Title>
            <Badge
              count={assetCount}
              style={{
                backgroundColor: config.color,
                boxShadow: `0 2px 8px ${config.color}30`,
              }}
            />
          </Space>
        </div>

        {/* 描述文字 */}
        <Text
          style={{
            fontSize: '14px',
            color: themeColors.textSecondary,
            lineHeight: 1.4,
            display: 'block',
            marginBottom: '16px',
          }}
        >
          {config.description}
        </Text>
      </div>

      {/* 底部操作区域 */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            fontSize: '13px',
            color: config.color,
            fontWeight: 500,
          }}
        >
          查看全部资产
        </Text>
        <ArrowRightOutlined
          style={{
            fontSize: '16px',
            color: config.color,
            transition: 'all 0.3s ease',
          }}
          className="category-arrow"
        />
      </div>

      {/* CSS样式增强 */}
      <style jsx>{`
        .category-card:hover .category-icon {
          transform: scale(1.1);
        }
        .category-card:hover .category-arrow {
          transform: translateX(4px);
        }

        /* 焦点状态 */
        .category-card:focus {
          outline: 2px solid ${config.color};
          outline-offset: 2px;
        }

        /* 移动端适配 */
        @media (max-width: 768px) {
          .category-card {
            height: 200px !important;
          }
        }
      `}</style>
    </Card>
  );
};

// 工具函数：获取所有业务域
export const getAllDomains = (): BusinessDomain[] => {
  return ['人力资源', '财务数据', '法务数据'];
};

// 工具函数：根据域名获取配置
export const getDomainConfig = (domain: BusinessDomain) => {
  return domainConfig[domain];
};

export default CategoryCard;