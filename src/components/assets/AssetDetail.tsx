import React, { useState } from 'react';
import {
  Card,
  Typography,
  Space,
  Button,
  Descriptions,
  Table,
  Tabs,
  Tag,
  Divider,
  Tooltip,
  Row,
  Col,
  Badge,
  Affix,
} from 'antd';
import {
  TeamOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  EyeOutlined,
  HeartOutlined,
  ShareAltOutlined,
  DownloadOutlined,
  ApiOutlined,
  FileTextOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { StatusBadge, type AssetStatus, isStatusApplicable } from '@/components/common/StatusBadge';
import { themeColors } from '@/theme';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

export interface FieldSchema {
  /** 字段名 */
  name: string;
  /** 字段类型 */
  type: string;
  /** 字段描述 */
  description: string;
  /** 是否必填 */
  required?: boolean;
  /** 是否是主键 */
  isPrimaryKey?: boolean;
  /** 示例值 */
  example?: string;
}

export interface SampleData {
  [key: string]: any;
}

export interface RelatedAsset {
  id: string;
  title: string;
  category: string;
  similarity: number;
}

export interface AssetDetailProps {
  /** 资产ID */
  id: string;
  /** 资产标题 */
  title: string;
  /** 业务分类 */
  category: '人力资源' | '财务数据' | '法务数据';
  /** 资产描述 */
  description: string;
  /** 详细的业务用途说明 */
  businessPurpose: string;
  /** 资产状态 */
  status: AssetStatus;
  /** 负责人 */
  owner: string;
  /** 负责人联系方式 */
  ownerContact?: string;
  /** 更新频率 */
  updateFrequency: string;
  /** 数据源 */
  dataSource?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 表结构 */
  schema: FieldSchema[];
  /** 样例数据 */
  sampleData: SampleData[];
  /** 申请次数 */
  applicationCount: number;
  /** 相关资产推荐 */
  relatedAssets?: RelatedAsset[];
  /** 标签 */
  tags?: string[];
  /** 数据大小 */
  dataSize?: string;
  /** 记录数 */
  recordCount?: number;
  /** 申请按钮回调 */
  onApply?: (id: string) => void;
  /** 收藏按钮回调 */
  onFavorite?: (id: string) => void;
  /** 分享按钮回调 */
  onShare?: (id: string) => void;
  /** 是否已收藏 */
  isFavorited?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * AssetDetail - 资产详情组件
 *
 * 用于在资产详情页面展示完整的数据资产信息
 * 采用左主右辅的双栏布局，遵循UX设计规范
 *
 * 特性：
 * - 双栏布局：左侧主要内容，右侧基本信息和操作
 * - 标签页组织：业务描述、技术规格、样例数据分标签展示
 * - 吸附操作栏：右侧操作区域支持吸附定位
 * - 相关推荐：智能推荐相关资产
 * - 无障碍支持：完整的语义化标签和键盘导航
 */
export const AssetDetail: React.FC<AssetDetailProps> = ({
  id,
  title,
  category,
  description,
  businessPurpose,
  status,
  owner,
  ownerContact,
  updateFrequency,
  dataSource,
  createdAt,
  updatedAt,
  schema,
  sampleData,
  applicationCount,
  relatedAssets = [],
  tags = [],
  dataSize,
  recordCount,
  onApply,
  onFavorite,
  onShare,
  isFavorited = false,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState('business');
  const [favorited, setFavorited] = useState(isFavorited);

  const isApplicable = isStatusApplicable(status);

  // 业务分类颜色
  const categoryColors = {
    '人力资源': themeColors.primary,
    '财务数据': themeColors.success,
    '法务数据': themeColors.insight,
  } as const;

  const categoryColor = categoryColors[category];

  // 表结构表格列定义
  const schemaColumns = [
    {
      title: '字段名',
      dataIndex: 'name',
      key: 'name',
      width: '20%',
      render: (text: string, record: FieldSchema) => (
        <Space>
          <Text code strong={record.isPrimaryKey}>
            {text}
          </Text>
          {record.isPrimaryKey && (
            <Tag color="gold" size="small">PK</Tag>
          )}
          {record.required && (
            <Tag color="red" size="small">必填</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: '15%',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: '40%',
    },
    {
      title: '示例',
      dataIndex: 'example',
      key: 'example',
      width: '25%',
      render: (text?: string) => (
        text ? <Text type="secondary" code>{text}</Text> : '-'
      ),
    },
  ];

  // 样例数据表格列定义（动态生成）
  const sampleColumns = schema.slice(0, 6).map(field => ({
    title: field.name,
    dataIndex: field.name,
    key: field.name,
    ellipsis: true,
    render: (text: any) => {
      if (text === null || text === undefined) return '-';
      // 对敏感数据进行脱敏处理
      if (field.name.includes('phone') || field.name.includes('电话')) {
        return `${String(text).slice(0, 3)}****${String(text).slice(-4)}`;
      }
      if (field.name.includes('email') || field.name.includes('邮箱')) {
        const emailStr = String(text);
        const atIndex = emailStr.indexOf('@');
        if (atIndex > 0) {
          return `${emailStr.slice(0, 2)}***${emailStr.slice(atIndex)}`;
        }
      }
      return String(text);
    },
  }));

  const handleApply = () => {
    onApply?.(id);
  };

  const handleFavorite = () => {
    setFavorited(!favorited);
    onFavorite?.(id);
  };

  const handleShare = () => {
    onShare?.(id);
  };

  return (
    <div className={`asset-detail ${className}`}>
      <Row gutter={[32, 24]}>
        {/* 左侧主要内容区域 */}
        <Col xs={24} lg={16}>
          {/* 头部信息 */}
          <Card
            style={{
              marginBottom: '24px',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ marginBottom: '16px' }}>
              <Space size="small" style={{ marginBottom: '12px' }}>
                <Tag color={categoryColor} style={{ fontSize: '12px', fontWeight: 500 }}>
                  {category}
                </Tag>
                <StatusBadge status={status} />
                {tags.map(tag => (
                  <Tag key={tag} style={{ fontSize: '11px' }}>
                    {tag}
                  </Tag>
                ))}
              </Space>

              <Title
                level={2}
                style={{
                  margin: 0,
                  fontSize: '28px',
                  fontWeight: 600,
                  color: themeColors.textPrimary,
                  lineHeight: 1.3,
                }}
              >
                {title}
              </Title>
            </div>

            <Paragraph
              style={{
                fontSize: '16px',
                lineHeight: 1.6,
                color: themeColors.textSecondary,
                margin: 0,
              }}
            >
              {description}
            </Paragraph>
          </Card>

          {/* 详细信息标签页 */}
          <Card
            style={{
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              type="card"
              style={{ margin: '-24px -24px 0' }}
              tabBarStyle={{ margin: '0 24px', borderBottom: 'none' }}
            >
              <TabPane
                tab={
                  <Space>
                    <FileTextOutlined />
                    业务描述
                  </Space>
                }
                key="business"
              >
                <div style={{ padding: '24px' }}>
                  <Title level={4} style={{ marginBottom: '16px' }}>
                    业务用途说明
                  </Title>
                  <Paragraph
                    style={{
                      fontSize: '15px',
                      lineHeight: 1.7,
                      color: themeColors.textPrimary,
                    }}
                  >
                    {businessPurpose}
                  </Paragraph>
                </div>
              </TabPane>

              <TabPane
                tab={
                  <Space>
                    <ApiOutlined />
                    表结构
                  </Space>
                }
                key="schema"
              >
                <div style={{ padding: '24px' }}>
                  <Title level={4} style={{ marginBottom: '16px' }}>
                    字段定义
                  </Title>
                  <Table
                    columns={schemaColumns}
                    dataSource={schema}
                    rowKey="name"
                    pagination={false}
                    size="middle"
                    style={{ marginBottom: '16px' }}
                  />
                  <Text type="secondary" style={{ fontSize: '13px' }}>
                    共 {schema.length} 个字段
                  </Text>
                </div>
              </TabPane>

              <TabPane
                tab={
                  <Space>
                    <BarChartOutlined />
                    数据样例
                  </Space>
                }
                key="sample"
              >
                <div style={{ padding: '24px' }}>
                  <Title level={4} style={{ marginBottom: '16px' }}>
                    数据预览（脱敏）
                  </Title>
                  <Table
                    columns={sampleColumns}
                    dataSource={sampleData.slice(0, 5)}
                    rowKey={(record, index) => index?.toString() || '0'}
                    pagination={false}
                    size="middle"
                    scroll={{ x: true }}
                    style={{ marginBottom: '16px' }}
                  />
                  <Space>
                    <Text type="secondary" style={{ fontSize: '13px' }}>
                      仅显示前 5 条记录和前 6 个字段
                    </Text>
                    <Button type="link" size="small">
                      查看完整预览
                    </Button>
                  </Space>
                </div>
              </TabPane>
            </Tabs>
          </Card>
        </Col>

        {/* 右侧信息和操作区域 */}
        <Col xs={24} lg={8}>
          <Affix offsetTop={24}>
            <div>
              {/* 操作按钮 */}
              <Card
                style={{
                  marginBottom: '24px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {isApplicable ? (
                    <Button
                      type="primary"
                      size="large"
                      onClick={handleApply}
                      style={{
                        width: '100%',
                        height: '48px',
                        fontSize: '16px',
                        fontWeight: 600,
                        backgroundColor: categoryColor,
                        borderColor: categoryColor,
                      }}
                    >
                      立即申请访问
                    </Button>
                  ) : (
                    <Tooltip title="当前状态不可申请">
                      <Button
                        type="primary"
                        size="large"
                        disabled
                        style={{ width: '100%', height: '48px', fontSize: '16px' }}
                      >
                        暂不可申请
                      </Button>
                    </Tooltip>
                  )}

                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Button
                      icon={<HeartOutlined />}
                      onClick={handleFavorite}
                      type={favorited ? 'primary' : 'default'}
                      style={{ color: favorited ? undefined : categoryColor }}
                    >
                      {favorited ? '已收藏' : '收藏'}
                    </Button>
                    <Button
                      icon={<ShareAltOutlined />}
                      onClick={handleShare}
                    >
                      分享
                    </Button>
                    <Button
                      icon={<DownloadOutlined />}
                    >
                      导出
                    </Button>
                  </Space>
                </Space>
              </Card>

              {/* 基本信息 */}
              <Card
                title="基本信息"
                style={{
                  marginBottom: '24px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="负责人">
                    <Space>
                      <TeamOutlined />
                      <Text strong>{owner}</Text>
                      {ownerContact && (
                        <Button type="link" size="small" style={{ padding: 0 }}>
                          联系
                        </Button>
                      )}
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="更新频率">
                    <Space>
                      <ClockCircleOutlined />
                      <Text>{updateFrequency}</Text>
                    </Space>
                  </Descriptions.Item>
                  {dataSource && (
                    <Descriptions.Item label="数据源">
                      <Space>
                        <DatabaseOutlined />
                        <Text>{dataSource}</Text>
                      </Space>
                    </Descriptions.Item>
                  )}
                  <Descriptions.Item label="创建时间">
                    <Text type="secondary">{createdAt}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="更新时间">
                    <Text type="secondary">{updatedAt}</Text>
                  </Descriptions.Item>
                  {dataSize && (
                    <Descriptions.Item label="数据大小">
                      <Text>{dataSize}</Text>
                    </Descriptions.Item>
                  )}
                  {recordCount && (
                    <Descriptions.Item label="记录数">
                      <Text>{recordCount.toLocaleString()}</Text>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>

              {/* 使用统计 */}
              <Card
                title="使用统计"
                style={{
                  marginBottom: '24px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <div style={{ textAlign: 'center' }}>
                    <Badge
                      count={applicationCount}
                      style={{
                        backgroundColor: categoryColor,
                        fontSize: '16px',
                        height: '32px',
                        lineHeight: '32px',
                        minWidth: '32px',
                      }}
                    />
                    <div style={{ marginTop: '8px' }}>
                      <Text type="secondary">总申请次数</Text>
                    </div>
                  </div>
                </Space>
              </Card>

              {/* 相关资产推荐 */}
              {relatedAssets.length > 0 && (
                <Card
                  title="相关推荐"
                  style={{
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}
                >
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    {relatedAssets.slice(0, 3).map(asset => (
                      <div
                        key={asset.id}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px solid #f0f0f0',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = categoryColor;
                          e.currentTarget.style.backgroundColor = `${categoryColor}05`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#f0f0f0';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <div style={{ marginBottom: '4px' }}>
                          <Text strong style={{ fontSize: '14px' }}>
                            {asset.title}
                          </Text>
                        </div>
                        <Space size="small">
                          <Tag size="small">{asset.category}</Tag>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            相似度 {Math.round(asset.similarity * 100)}%
                          </Text>
                        </Space>
                      </div>
                    ))}
                  </Space>
                </Card>
              )}
            </div>
          </Affix>
        </Col>
      </Row>
    </div>
  );
};

export default AssetDetail;