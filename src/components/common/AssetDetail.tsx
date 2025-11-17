'use client';

import React from 'react';
import {
  Card,
  Descriptions,
  Space,
  Typography,
  Tabs,
  Table,
  Tag,
  Divider,
  Button,
  Row,
  Col,
  Statistic,
  Timeline,
} from 'antd';
import type { DescriptionsProps, TabsProps, ColumnsType } from 'antd';
import {
  DatabaseOutlined,
  ClockCircleOutlined,
  UserOutlined,
  EyeOutlined,
  TeamOutlined,
  FileTextOutlined,
  HistoryOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { StatusBadge } from './StatusBadge';
import type { AssetStatus } from './StatusBadge';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

// 配置 dayjs 插件
dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text, Paragraph } = Typography;

// 资产详情数据类型
export interface AssetDetailData {
  id: string;
  name: string;
  code: string;
  description?: string;
  status: 'AVAILABLE' | 'MAINTENANCE' | 'DEPRECATED' | 'DRAFT';
  categoryName?: string;
  owner: string;
  ownerContact?: string;
  technicalContact?: string;
  createdAt: Date;
  updatedAt: Date;
  viewCount?: number;
  applicationCount?: number;
  tags?: string[];
  // 表结构信息
  schema?: {
    columns: Array<{
      name: string;
      type: string;
      comment?: string;
      nullable?: boolean;
    }>;
  };
  // 数据样例
  sampleData?: Array<Record<string, any>>;
  // 访问控制信息
  accessControl?: {
    requireApproval: boolean;
    approvers?: string[];
    maxAccessDays?: number;
  };
  // 版本历史
  versionHistory?: Array<{
    version: string;
    changeDate: Date;
    changeBy: string;
    changeDescription: string;
  }>;
}

interface AssetDetailProps {
  asset: AssetDetailData;
  /** 是否显示操作按钮 */
  showActions?: boolean;
  /** 申请访问回调 */
  onApply?: (assetId: string) => void;
  /** 联系负责人回调 */
  onContact?: (assetId: string, type: 'owner' | 'technical') => void;
  className?: string;
}

// 状态映射
const mapStatus = (status: AssetDetailData['status']): AssetStatus => {
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

/**
 * AssetDetail - 资产详情展示组件
 *
 * 完整展示数据资产的所有信息,包括基本信息、表结构、数据样例和版本历史等
 *
 * 特性:
 * - Tab分页组织信息
 * - 基本信息描述表单展示
 * - 表结构和数据样例表格展示
 * - 支持申请访问和联系负责人操作
 * - 版本历史时间线展示
 */
export const AssetDetail: React.FC<AssetDetailProps> = ({
  asset,
  showActions = true,
  onApply,
  onContact,
  className = '',
}) => {
  // 基本信息描述项
  const basicInfoItems: DescriptionsProps['items'] = [
    {
      key: 'code',
      label: '资产编码',
      children: <Text code>{asset.code}</Text>,
    },
    {
      key: 'status',
      label: '状态',
      children: <StatusBadge status={mapStatus(asset.status)} />,
    },
    {
      key: 'category',
      label: '分类',
      children: asset.categoryName || '-',
    },
    {
      key: 'owner',
      label: '负责人',
      children: (
        <Space>
          <Text>{asset.owner}</Text>
          {asset.ownerContact && (
            <Button
              type="link"
              size="small"
              icon={<UserOutlined />}
              onClick={() => onContact?.(asset.id, 'owner')}
            >
              联系
            </Button>
          )}
        </Space>
      ),
    },
    {
      key: 'technicalContact',
      label: '技术负责人',
      children: asset.technicalContact ? (
        <Space>
          <Text>{asset.technicalContact}</Text>
          <Button
            type="link"
            size="small"
            icon={<UserOutlined />}
            onClick={() => onContact?.(asset.id, 'technical')}
          >
            联系
          </Button>
        </Space>
      ) : (
        '-'
      ),
    },
    {
      key: 'createdAt',
      label: '创建时间',
      children: dayjs(asset.createdAt).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      key: 'updatedAt',
      label: '更新时间',
      children: dayjs(asset.updatedAt).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  // 表结构列定义
  const schemaColumns: ColumnsType<any> = [
    {
      title: '字段名',
      dataIndex: 'name',
      key: 'name',
      width: '25%',
      render: (text) => <Text code>{text}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: '20%',
    },
    {
      title: '是否可空',
      dataIndex: 'nullable',
      key: 'nullable',
      width: '15%',
      render: (nullable) => (nullable ? '是' : '否'),
    },
    {
      title: '说明',
      dataIndex: 'comment',
      key: 'comment',
      render: (text) => text || '-',
    },
  ];

  // Tab项配置
  const tabItems: TabsProps['items'] = [
    {
      key: 'basic',
      label: (
        <span>
          <FileTextOutlined /> 基本信息
        </span>
      ),
      children: (
        <Card bordered={false}>
          <Descriptions
            items={basicInfoItems}
            column={{ xs: 1, sm: 2, md: 2, lg: 2, xl: 2, xxl: 2 }}
            bordered
          />

          {asset.description && (
            <>
              <Divider />
              <div>
                <Text strong>资产描述:</Text>
                <Paragraph style={{ marginTop: '12px' }}>{asset.description}</Paragraph>
              </div>
            </>
          )}

          {asset.tags && asset.tags.length > 0 && (
            <>
              <Divider />
              <div>
                <Text strong>标签:</Text>
                <div style={{ marginTop: '12px' }}>
                  <Space size="small" wrap>
                    {asset.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </Space>
                </div>
              </div>
            </>
          )}
        </Card>
      ),
    },
    {
      key: 'schema',
      label: (
        <span>
          <DatabaseOutlined /> 表结构
        </span>
      ),
      children: (
        <Card bordered={false}>
          {asset.schema && asset.schema.columns ? (
            <Table
              columns={schemaColumns}
              dataSource={asset.schema.columns}
              rowKey="name"
              pagination={false}
              size="middle"
            />
          ) : (
            <Text type="secondary">暂无表结构信息</Text>
          )}
        </Card>
      ),
    },
    {
      key: 'sample',
      label: (
        <span>
          <EyeOutlined /> 数据样例
        </span>
      ),
      children: (
        <Card bordered={false}>
          {asset.sampleData && asset.sampleData.length > 0 ? (
            <Table
              dataSource={asset.sampleData}
              pagination={{ pageSize: 10 }}
              size="middle"
              scroll={{ x: 'max-content' }}
            />
          ) : (
            <Text type="secondary">暂无数据样例</Text>
          )}
        </Card>
      ),
    },
    {
      key: 'access',
      label: (
        <span>
          <SafetyOutlined /> 访问控制
        </span>
      ),
      children: (
        <Card bordered={false}>
          {asset.accessControl ? (
            <Descriptions
              items={[
                {
                  key: 'requireApproval',
                  label: '是否需要审批',
                  children: asset.accessControl.requireApproval ? '是' : '否',
                },
                {
                  key: 'approvers',
                  label: '审批人',
                  children:
                    asset.accessControl.approvers && asset.accessControl.approvers.length > 0
                      ? asset.accessControl.approvers.join(', ')
                      : '-',
                },
                {
                  key: 'maxAccessDays',
                  label: '最大访问天数',
                  children: asset.accessControl.maxAccessDays
                    ? `${asset.accessControl.maxAccessDays} 天`
                    : '无限制',
                },
              ]}
              column={1}
              bordered
            />
          ) : (
            <Text type="secondary">暂无访问控制信息</Text>
          )}
        </Card>
      ),
    },
    {
      key: 'history',
      label: (
        <span>
          <HistoryOutlined /> 版本历史
        </span>
      ),
      children: (
        <Card bordered={false}>
          {asset.versionHistory && asset.versionHistory.length > 0 ? (
            <Timeline
              items={asset.versionHistory.map((item) => ({
                children: (
                  <div>
                    <Text strong>版本 {item.version}</Text>
                    <br />
                    <Text type="secondary">
                      {dayjs(item.changeDate).format('YYYY-MM-DD HH:mm')} by {item.changeBy}
                    </Text>
                    <br />
                    <Text>{item.changeDescription}</Text>
                  </div>
                ),
              }))}
            />
          ) : (
            <Text type="secondary">暂无版本历史</Text>
          )}
        </Card>
      ),
    },
  ];

  return (
    <div className={className}>
      {/* 顶部头部 */}
      <Card
        style={{
          marginBottom: '24px',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-light)',
        }}
      >
        <Row gutter={[24, 24]}>
          <Col xs={24} md={16}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Space size="large" align="start">
                <DatabaseOutlined style={{ fontSize: '48px', color: 'var(--primary-color)' }} />
                <div>
                  <Title level={2} style={{ margin: 0 }}>
                    {asset.name}
                  </Title>
                  <Space size="middle" style={{ marginTop: '8px' }}>
                    <Text type="secondary">
                      <ClockCircleOutlined /> 最后更新 {dayjs(asset.updatedAt).fromNow()}
                    </Text>
                  </Space>
                </div>
              </Space>

              {showActions && (
                <Space size="small">
                  <Button
                    type="primary"
                    size="large"
                    icon={<TeamOutlined />}
                    onClick={() => onApply?.(asset.id)}
                    disabled={mapStatus(asset.status) === 'offline'}
                  >
                    申请访问
                  </Button>
                  <Button size="large" icon={<UserOutlined />} onClick={() => onContact?.(asset.id, 'owner')}>
                    联系负责人
                  </Button>
                </Space>
              )}
            </Space>
          </Col>

          <Col xs={24} md={8}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="浏览次数"
                  value={asset.viewCount || 0}
                  prefix={<EyeOutlined />}
                  valueStyle={{ fontSize: '24px' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="申请次数"
                  value={asset.applicationCount || 0}
                  prefix={<TeamOutlined />}
                  valueStyle={{ fontSize: '24px' }}
                />
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      {/* 详细信息Tab */}
      <Card
        style={{
          borderRadius: '12px',
          boxShadow: 'var(--shadow-light)',
        }}
      >
        <Tabs items={tabItems} defaultActiveKey="basic" />
      </Card>
    </div>
  );
};

export default AssetDetail;
