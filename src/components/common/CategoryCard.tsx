'use client';

import React from 'react';
import { Card, Typography, Space, Statistic, Button } from 'antd';
import { TeamOutlined, DollarOutlined, SafetyOutlined, DatabaseOutlined, RightOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';

const { Title, Text } = Typography;

export interface CategoryConfig {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  gradient: string;
  assetCount?: number;
  features?: string[];
}

export const PREDEFINED_CATEGORIES: Record<string, CategoryConfig> = {
  hr: {
    id: 'hr',
    title: 'HR数据域',
    description: '人力资源相关数据资产，包括员工、招聘、考核等',
    icon: <TeamOutlined />,
    gradient: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 50%, #91d5ff 100%)', // 浅蓝色渐变
    assetCount: 45,
    features: ['员工信息表', '考勤记录', '绩效数据']
  },
  finance: {
    id: 'finance',
    title: 'Finance数据域',
    description: '财务相关数据资产，包括报表、成本、预算等',
    icon: <DollarOutlined />,
    gradient: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 50%, #b7eb8f 100%)', // 浅绿色渐变
    assetCount: 38,
    features: ['财务报表', '成本分析', '预算数据']
  },
  legal: {
    id: 'legal',
    title: 'Legal数据域',
    description: '法务相关数据资产，包括合同、合规、风控等',
    icon: <SafetyOutlined />,
    gradient: 'linear-gradient(135deg, #fff7e6 0%, #ffd591 50%, #ffc53d 100%)', // 浅橙色渐变
    assetCount: 27,
    features: ['合同信息', '法律文档', '合规记录']
  }
};

interface CategoryCardProps {
  config: CategoryConfig;
  onClick?: () => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ config, onClick }) => {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.push(`/assets/browse?category=${config.id}`);
    }
  };

  return (
    <Card
      hoverable
      onClick={handleClick}
      style={{
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-light)',
        height: '100%',
        transition: 'all 0.3s ease',
      }}
      styles={{ body: { padding: 0 } }}
    >
      {/* 顶部渐变背景区域 */}
      <div
        style={{
          background: config.gradient,
          padding: '24px',
          position: 'relative',
        }}
      >
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div style={{
            fontSize: '48px',
            color: '#0052CC',
            textShadow: '0 2px 8px rgba(0, 82, 204, 0.15)'
          }}>
            {config.icon}
          </div>
          <div>
            <Title level={4} style={{ color: '#1a1a1a', margin: 0, fontWeight: 600 }}>
              {config.title}
            </Title>
            {config.assetCount !== undefined && (
              <Space style={{ marginTop: '8px' }}>
                <DatabaseOutlined style={{ color: '#666' }} />
                <Text style={{ color: '#666', fontSize: '14px' }}>
                  {config.assetCount} 个资产
                </Text>
              </Space>
            )}
          </div>
        </Space>
      </div>

      {/* 底部内容区域 */}
      <div style={{ padding: '20px', background: 'white' }}>
        {config.description && (
          <Text type="secondary" style={{ display: 'block', marginBottom: '12px', fontSize: '13px', lineHeight: 1.6 }}>
            {config.description}
          </Text>
        )}

        {config.features && config.features.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <Text strong style={{ fontSize: '12px', color: '#999', marginBottom: '8px', display: 'block' }}>
              热门资产:
            </Text>
            <Space direction="vertical" size={4}>
              {config.features.map((feature, index) => (
                <Text key={index} style={{ fontSize: '13px', color: '#666' }}>
                  • {feature}
                </Text>
              ))}
            </Space>
          </div>
        )}

        <Button
          type="link"
          icon={<RightOutlined />}
          iconPosition="end"
          style={{ padding: 0, height: 'auto', color: '#0052CC' }}
        >
          浏览资产
        </Button>
      </div>
    </Card>
  );
};

export default CategoryCard;
