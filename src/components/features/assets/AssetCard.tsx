'use client';

import React, { useState } from 'react';
import { Card, Button, Space, Typography, Tooltip, Tag } from 'antd';
import {
  ClockCircleOutlined,
  EyeOutlined,
  UserOutlined,
  DatabaseOutlined,
  HeartOutlined,
  HeartFilled,
  SafetyOutlined,
  LockOutlined,
  UnlockOutlined
} from '@ant-design/icons';
import type { AssetSummary } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { AssetPreviewModal } from './AssetPreviewModal';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text, Paragraph } = Typography;

interface AssetCardProps {
  asset: AssetSummary;
  onClick?: () => void;
  showPreview?: boolean;
  className?: string;
  /** 是否显示收藏功能 */
  showFavorite?: boolean;
  /** 收藏状态 */
  isFavorited?: boolean;
  /** 收藏回调 */
  onFavoriteToggle?: (assetId: string, isFavorited: boolean) => void;
}

// 状态映射函数
const mapAssetStatus = (status: AssetSummary['status']): 'available' | 'maintenance' | 'offline' => {
  switch (status) {
    case 'AVAILABLE':
      return 'available';
    case 'MAINTENANCE':
      return 'maintenance';
    case 'DEPRECATED':
    case 'DRAFT':
      return 'offline';
    default:
      return 'offline';
  }
};

// 敏感级别配置
const sensitivityConfig = {
  PUBLIC: {
    label: '公开',
    color: 'green',
    icon: <UnlockOutlined />
  },
  INTERNAL: {
    label: '内部',
    color: 'blue',
    icon: <SafetyOutlined />
  },
  CONFIDENTIAL: {
    label: '机密',
    color: 'red',
    icon: <LockOutlined />
  }
};

/**
 * AssetCard - 资产卡片组件
 *
 * 符合UX设计规范的资产展示卡片,使用Ant Design Card组件
 *
 * 特性：
 * - 卡片式布局,支持悬停效果
 * - 状态标签使用StatusBadge组件
 * - 显示资产名称、描述、负责人、更新时间、浏览次数
 * - 支持快速预览和查看详情操作
 * - 支持收藏功能
 */
export const AssetCard: React.FC<AssetCardProps> = ({
  asset,
  onClick,
  showPreview = true,
  className = '',
  showFavorite = false,
  isFavorited = false,
  onFavoriteToggle,
}) => {
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [localFavorited, setLocalFavorited] = useState(isFavorited);

  // 格式化时间(相对时间)
  const formatRelativeTime = (date: Date) => {
    return dayjs(date).fromNow();
  };

  // 处理卡片点击
  const handleCardClick = () => {
    onClick?.();
  };

  // 处理预览点击
  const handlePreviewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPreviewModal(true);
  };

  // 处理收藏点击
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavoriteState = !localFavorited;
    setLocalFavorited(newFavoriteState);
    onFavoriteToggle?.(asset.id, newFavoriteState);
  };

  // 获取映射后的状态
  const mappedStatus = mapAssetStatus(asset.status);

  // 获取敏感级别配置
  const sensitivity = asset.sensitivity || 'INTERNAL';
  const sensitivityInfo = sensitivityConfig[sensitivity];

  return (
    <>
      <Card
        hoverable
        className={className}
        onClick={handleCardClick}
        style={{
          borderRadius: '12px',
          boxShadow: 'var(--shadow-light)',
          transition: 'all 0.3s ease',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        styles={{
          body: {
            padding: '20px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          },
        }}
        extra={
          <Space size="small">
            <StatusBadge status={mappedStatus} size="small" />
            <Tooltip title={`敏感级别: ${sensitivityInfo.label}`}>
              <Tag
                color={sensitivityInfo.color}
                icon={sensitivityInfo.icon}
                style={{ fontSize: '12px' }}
              >
                {sensitivityInfo.label}
              </Tag>
            </Tooltip>
            {showFavorite && (
              <Tooltip title={localFavorited ? '取消收藏' : '收藏'}>
                <Button
                  type="text"
                  size="small"
                  icon={localFavorited ? <HeartFilled style={{ color: '#f5222d' }} /> : <HeartOutlined />}
                  onClick={handleFavoriteClick}
                />
              </Tooltip>
            )}
          </Space>
        }
      >
        {/* 卡片标题 */}
        <div style={{ marginBottom: '12px' }}>
          <Title
            level={5}
            ellipsis={{ rows: 1, tooltip: asset.name }}
            style={{ margin: 0, fontWeight: 600 }}
          >
            <DatabaseOutlined style={{ marginRight: '8px', color: 'var(--primary-color)' }} />
            {asset.name}
          </Title>
        </div>

        {/* 资产描述 */}
        <Paragraph
          ellipsis={{ rows: 2, tooltip: asset.description }}
          style={{
            marginBottom: '16px',
            color: 'var(--text-secondary)',
            height: '44px',
            lineHeight: '22px',
          }}
        >
          {asset.description || '\u00A0'}
        </Paragraph>

        {/* 元信息 */}
        <Space
          direction="vertical"
          size="small"
          style={{ width: '100%', marginBottom: showPreview ? '16px' : 0, flex: 1 }}
        >
          <Space size="large" wrap>
            <Tooltip title={`最后更新: ${dayjs(asset.updatedAt).format('YYYY-MM-DD HH:mm')}`}>
              <Text type="secondary" style={{ fontSize: '13px' }}>
                <ClockCircleOutlined style={{ marginRight: '6px' }} />
                {formatRelativeTime(asset.updatedAt)}
              </Text>
            </Tooltip>

            <Text type="secondary" style={{ fontSize: '13px' }}>
              <EyeOutlined style={{ marginRight: '6px' }} />
              {asset.viewCount || 0} 次浏览
            </Text>

            {asset.owner && (
              <Tooltip title={`负责人: ${asset.owner}`}>
                <Text type="secondary" style={{ fontSize: '13px' }} ellipsis>
                  <UserOutlined style={{ marginRight: '6px' }} />
                  {asset.owner}
                </Text>
              </Tooltip>
            )}
          </Space>

          {/* 分类信息 */}
          {asset.category && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              分类: {asset.category.name}
            </Text>
          )}
        </Space>

        {/* 操作按钮 */}
        {showPreview && (
          <Space size="small" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Button
              type="link"
              size="small"
              onClick={handlePreviewClick}
              style={{ padding: 0 }}
            >
              快速预览
            </Button>

            <Button
              type="primary"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onClick?.();
              }}
            >
              查看详情
            </Button>
          </Space>
        )}
      </Card>

      {/* 预览模态框 */}
      {showPreviewModal && (
        <AssetPreviewModal
          asset={{
            id: asset.id,
            name: asset.name,
            description: asset.description,
            status: asset.status,
            owner: asset.owner,
            updatedAt: asset.updatedAt,
            accessCount: asset.viewCount,
          }}
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          onViewDetails={onClick}
        />
      )}
    </>
  );
};

export default AssetCard;