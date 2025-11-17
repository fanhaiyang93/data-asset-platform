'use client';

import React from 'react';
import { Modal, Tag, Descriptions, Statistic, Row, Col, Space } from 'antd';
import { 
  EyeOutlined, 
  UserOutlined, 
  ClockCircleOutlined, 
  FileTextOutlined,
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  ToolOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  TagOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';

interface Asset {
  id: string;
  name: string;
  description?: string;
  status: string;
  owner?: string;
  updatedAt?: Date;
  databaseName?: string;
  schemaName?: string;
  tableName?: string;
  format?: string;
  tags?: string;
  accessCount?: number;
  size?: bigint;
  recordCount?: bigint;
  qualityScore?: number;
}

interface AssetPreviewModalProps {
  asset: Asset | null;
  isOpen: boolean;
  onClose: () => void;
  onViewDetails?: () => void;
}

export const AssetPreviewModal: React.FC<AssetPreviewModalProps> = ({
  asset,
  isOpen,
  onClose,
  onViewDetails
}) => {
  // 状态配置
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return {
          color: 'success',
          icon: <CheckCircleOutlined />,
          label: '可用'
        };
      case 'MAINTENANCE':
        return {
          color: 'warning',
          icon: <ToolOutlined />,
          label: '维护中'
        };
      case 'DEPRECATED':
        return {
          color: 'error',
          icon: <ExclamationCircleOutlined />,
          label: '已弃用'
        };
      case 'DRAFT':
        return {
          color: 'default',
          icon: <FileTextOutlined />,
          label: '草稿'
        };
      default:
        return {
          color: 'default',
          icon: <FileTextOutlined />,
          label: '未知'
        };
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes?: bigint | number) => {
    if (!bytes) return '未知';
    const size = typeof bytes === 'bigint' ? Number(bytes) : bytes;
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let formattedSize = size;

    while (formattedSize >= 1024 && i < units.length - 1) {
      formattedSize /= 1024;
      i++;
    }

    return `${formattedSize.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  };

  // 格式化记录数
  const formatRecordCount = (count?: bigint | number) => {
    if (!count) return '未知';
    const num = typeof count === 'bigint' ? Number(count) : count;
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}万`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}千`;
    }
    return num.toString();
  };

  // 格式化时间
  const formatDate = (date?: Date) => {
    if (!date) return '未知';
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const statusConfig = asset ? getStatusConfig(asset.status) : null;

  return (
    <Modal
      title={asset?.name || '资产详情'}
      open={isOpen}
      onCancel={onClose}
      width={800}
      footer={[
        <Space key="actions">
          <button
            key="close"
            onClick={onClose}
            style={{
              padding: '4px 15px',
              fontSize: '14px',
              border: '1px solid #d9d9d9',
              borderRadius: '6px',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            关闭
          </button>
          <button
            key="details"
            onClick={() => {
              onViewDetails?.();
              onClose();
            }}
            style={{
              padding: '4px 15px',
              fontSize: '14px',
              border: 'none',
              borderRadius: '6px',
              background: '#1890ff',
              color: 'white',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            查看详情
            <ArrowRightOutlined />
          </button>
        </Space>
      ]}
    >
      {asset ? (
        <div>
          {/* 描述和状态 */}
          <div style={{ marginBottom: '24px' }}>
            {asset.description && (
              <p style={{ color: '#666', marginBottom: '12px' }}>{asset.description}</p>
            )}
            {statusConfig && (
              <Tag icon={statusConfig.icon} color={statusConfig.color}>
                {statusConfig.label}
              </Tag>
            )}
          </div>

          {/* 统计信息 */}
          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col span={6}>
              <Statistic
                title="浏览次数"
                value={asset.accessCount || 0}
                prefix={<EyeOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="数据大小"
                value={formatFileSize(asset.size)}
                prefix={<DatabaseOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="记录数"
                value={formatRecordCount(asset.recordCount)}
                prefix={<BarChartOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="质量评分"
                value={asset.qualityScore || 'N/A'}
                prefix={<TagOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Col>
          </Row>

          {/* 详细信息 */}
          <Descriptions title="详细信息" column={2} bordered size="small">
            {asset.owner && (
              <Descriptions.Item label={<><UserOutlined /> 负责人</>}>
                {asset.owner}
              </Descriptions.Item>
            )}
            <Descriptions.Item label={<><ClockCircleOutlined /> 更新时间</>}>
              {formatDate(asset.updatedAt)}
            </Descriptions.Item>
            {asset.databaseName && (
              <Descriptions.Item label="数据库" span={2}>
                {asset.databaseName}
                {asset.schemaName && `.${asset.schemaName}`}
                {asset.tableName && `.${asset.tableName}`}
              </Descriptions.Item>
            )}
            {asset.format && (
              <Descriptions.Item label="数据格式" span={2}>
                {asset.format}
              </Descriptions.Item>
            )}
          </Descriptions>

          {/* 标签 */}
          {asset.tags && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ color: '#666', marginBottom: '8px', fontSize: '14px' }}>标签:</div>
              <Space size={[0, 8]} wrap>
                {asset.tags.split(',').map((tag, index) => (
                  <Tag key={index} color="blue">
                    {tag.trim()}
                  </Tag>
                ))}
              </Space>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
};

export default AssetPreviewModal;
