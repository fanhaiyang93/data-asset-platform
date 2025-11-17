'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Card, Table, Tag, Space, Button, Select, DatePicker, Row, Col, Statistic, Divider, Tooltip, App } from 'antd';
import { SearchOutlined, DatabaseOutlined, TableOutlined, EyeOutlined, DownloadOutlined, HeartOutlined, StarOutlined } from '@ant-design/icons';

const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface DataAsset {
  key: string;
  name: string;
  database: string;
  table: string;
  description: string;
  type: string;
  tags: string[];
  owner: string;
  updateTime: string;
  size: string;
  status: 'active' | 'inactive';
  sensitivity: 'public' | 'internal' | 'confidential';
  popularity: number;
}

const mockData: DataAsset[] = [
  {
    key: '1',
    name: '用户行为分析表',
    database: 'user_analytics',
    table: 'user_behavior_log',
    description: '记录用户在平台上的各种行为数据，包括点击、浏览、购买等行为轨迹',
    type: '事实表',
    tags: ['用户行为', '日志', '实时'],
    owner: '张三',
    updateTime: '2024-01-15 14:30:00',
    size: '2.5GB',
    status: 'active',
    sensitivity: 'internal',
    popularity: 95
  },
  {
    key: '2',
    name: '商品信息维度表',
    database: 'product_master',
    table: 'product_info_dim',
    description: '商品基础信息维度表，包含商品分类、属性、价格等详细信息',
    type: '维度表',
    tags: ['商品', '维度', '主数据'],
    owner: '李四',
    updateTime: '2024-01-14 09:15:00',
    size: '856MB',
    status: 'active',
    sensitivity: 'public',
    popularity: 87
  },
  {
    key: '3',
    name: '订单交易明细表',
    database: 'transaction',
    table: 'order_detail',
    description: '订单交易的详细记录，包含订单金额、商品明细、支付方式等信息',
    type: '事实表',
    tags: ['订单', '交易', '金融'],
    owner: '王五',
    updateTime: '2024-01-16 16:45:00',
    size: '4.2GB',
    status: 'active',
    sensitivity: 'confidential',
    popularity: 92
  },
  {
    key: '4',
    name: '客户画像标签表',
    database: 'customer_profile',
    table: 'customer_tags',
    description: '基于用户行为和属性构建的客户画像标签体系',
    type: '标签表',
    tags: ['客户画像', '标签', 'ML'],
    owner: '赵六',
    updateTime: '2024-01-13 11:20:00',
    size: '1.3GB',
    status: 'active',
    sensitivity: 'internal',
    popularity: 78
  },
  {
    key: '5',
    name: '营销活动效果表',
    database: 'marketing',
    table: 'campaign_performance',
    description: '营销活动的效果数据，包括曝光量、点击率、转化率等关键指标',
    type: '汇总表',
    tags: ['营销', '效果', '指标'],
    owner: '钱七',
    updateTime: '2024-01-12 13:30:00',
    size: '654MB',
    status: 'inactive',
    sensitivity: 'internal',
    popularity: 65
  }
];

export default function SearchPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [searchText, setSearchText] = useState('');
  const [filteredData, setFilteredData] = useState<DataAsset[]>(mockData);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedSensitivity, setSelectedSensitivity] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const handleSearch = (value: string) => {
    setLoading(true);
    setSearchText(value);

    setTimeout(() => {
      let filtered = mockData;

      if (value) {
        filtered = filtered.filter(item =>
          item.name.toLowerCase().includes(value.toLowerCase()) ||
          item.description.toLowerCase().includes(value.toLowerCase()) ||
          item.tags.some(tag => tag.toLowerCase().includes(value.toLowerCase())) ||
          item.database.toLowerCase().includes(value.toLowerCase()) ||
          item.table.toLowerCase().includes(value.toLowerCase())
        );
      }

      if (selectedType !== 'all') {
        filtered = filtered.filter(item => item.type === selectedType);
      }

      if (selectedSensitivity !== 'all') {
        filtered = filtered.filter(item => item.sensitivity === selectedSensitivity);
      }

      setFilteredData(filtered);
      setLoading(false);
    }, 500);
  };

  const handleFilterChange = () => {
    handleSearch(searchText);
  };

  const getSensitivityColor = (sensitivity: string) => {
    switch (sensitivity) {
      case 'public': return 'green';
      case 'internal': return 'orange';
      case 'confidential': return 'red';
      default: return 'default';
    }
  };

  const getSensitivityText = (sensitivity: string) => {
    switch (sensitivity) {
      case 'public': return '公开';
      case 'internal': return '内部';
      case 'confidential': return '机密';
      default: return sensitivity;
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? 'success' : 'default';
  };

  const getStatusText = (status: string) => {
    return status === 'active' ? '活跃' : '非活跃';
  };

  const columns = [
    {
      title: '资产名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string, record: DataAsset) => (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            <DatabaseOutlined /> {record.database}.{record.table}
          </div>
        </div>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 300,
      ellipsis: {
        showTitle: false,
      },
      render: (description: string) => (
        <Tooltip placement="topLeft" title={description}>
          {description}
        </Tooltip>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => (
        <Tag color="blue">{type}</Tag>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 150,
      render: (tags: string[]) => (
        <Space size={[0, 4]} wrap>
          {tags.map(tag => (
            <Tag key={tag} color="cyan" style={{ fontSize: '11px' }}>
              {tag}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '敏感级别',
      dataIndex: 'sensitivity',
      key: 'sensitivity',
      width: 100,
      render: (sensitivity: string) => (
        <Tag color={getSensitivityColor(sensitivity)}>
          {getSensitivityText(sensitivity)}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '热度',
      dataIndex: 'popularity',
      key: 'popularity',
      width: 80,
      render: (popularity: number) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <StarOutlined style={{ color: '#faad14', marginRight: 4 }} />
          {popularity}
        </div>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'owner',
      key: 'owner',
      width: 100,
    },
    {
      title: '更新时间',
      dataIndex: 'updateTime',
      key: 'updateTime',
      width: 150,
      render: (time: string) => (
        <div style={{ fontSize: '12px' }}>{time}</div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: DataAsset) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => router.push(`/assets/${record.key}`)}
            />
          </Tooltip>
          <Tooltip title="下载数据">
            <Button
              type="text"
              icon={<DownloadOutlined />}
              size="small"
              onClick={() => message.info('下载功能开发中')}
            />
          </Tooltip>
          <Tooltip title="收藏">
            <Button
              type="text"
              icon={<HeartOutlined />}
              size="small"
              onClick={() => message.success('已添加到收藏')}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
        {/* 搜索统计区域 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总资产数量"
                value={mockData.length}
                prefix={<DatabaseOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="搜索结果"
                value={filteredData.length}
                prefix={<SearchOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="活跃表数"
                value={mockData.filter(item => item.status === 'active').length}
                prefix={<TableOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="平均热度"
                value={Math.round(mockData.reduce((sum, item) => sum + item.popularity, 0) / mockData.length)}
                prefix={<StarOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* 搜索和筛选区域 */}
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={16} align="middle">
            <Col span={12}>
              <Search
                placeholder="请输入关键词搜索数据资产..."
                allowClear
                enterButton={<SearchOutlined />}
                size="large"
                onSearch={handleSearch}
                loading={loading}
              />
            </Col>
            <Col span={4}>
              <Select
                placeholder="选择类型"
                style={{ width: '100%' }}
                value={selectedType}
                onChange={(value) => {
                  setSelectedType(value);
                  handleFilterChange();
                }}
              >
                <Option value="all">全部类型</Option>
                <Option value="事实表">事实表</Option>
                <Option value="维度表">维度表</Option>
                <Option value="汇总表">汇总表</Option>
                <Option value="标签表">标签表</Option>
              </Select>
            </Col>
            <Col span={4}>
              <Select
                placeholder="敏感级别"
                style={{ width: '100%' }}
                value={selectedSensitivity}
                onChange={(value) => {
                  setSelectedSensitivity(value);
                  handleFilterChange();
                }}
              >
                <Option value="all">全部级别</Option>
                <Option value="public">公开</Option>
                <Option value="internal">内部</Option>
                <Option value="confidential">机密</Option>
              </Select>
            </Col>
            <Col span={4}>
              <RangePicker style={{ width: '100%' }} placeholder={['开始日期', '结束日期']} />
            </Col>
          </Row>
        </Card>

        {/* 搜索结果 */}
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>搜索结果 ({filteredData.length})</span>
              <Space>
                <Button>导出结果</Button>
                <Button type="primary">批量操作</Button>
              </Space>
            </div>
          }
        >
          <Table
            columns={columns}
            dataSource={filteredData}
            loading={loading}
            pagination={{
              total: filteredData.length,
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `第 ${range[0]}-${range[1]} 条，共 ${total} 条数据`,
            }}
            scroll={{ x: 1200 }}
          />
        </Card>
    </div>
  );
}