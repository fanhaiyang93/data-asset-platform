'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Typography,
  Row,
  Col,
  Select,
  Space,
  Pagination,
  Empty,
  Spin,
  Radio,
  Tag,
  Card,
  Statistic,
  Table,
  Button,
  Tooltip,
  App,
} from 'antd';
import type { RadioChangeEvent } from 'antd';
import {
  AppstoreOutlined,
  UnorderedListOutlined,
  FilterOutlined,
  DatabaseOutlined,
  TableOutlined,
  EyeOutlined,
  StarOutlined,
  DownloadOutlined,
  HeartOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import { AssetCard } from '@/components/features/assets/AssetCard';
import { SearchBar } from '@/components/features/search/SearchBar';
import type { AssetSummary } from '@/types';
import { trpc } from '@/lib/trpc-client';

const { Title, Text } = Typography;

// 扩展资产类型以包含敏感级别
interface ExtendedAssetSummary extends AssetSummary {
  sensitivity?: 'public' | 'internal' | 'confidential';
  tags?: string[];
  database?: string;
  table?: string;
  size?: string;
  popularity?: number;
}

export default function AssetBrowsePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const { message } = App.useApp();

  // 分类和状态映射
  const categoryLabels: Record<string, string> = {
    hr: 'HR数据域',
    finance: 'Finance数据域',
    legal: 'Legal数据域',
  };

  const statusLabels: Record<string, string> = {
    AVAILABLE: '可用',
    MAINTENANCE: '维护中',
    DEPRECATED: '已弃用',
    DRAFT: '草稿',
  };

  const sensitivityLabels: Record<string, string> = {
    PUBLIC: '公开',
    INTERNAL: '内部',
    CONFIDENTIAL: '机密',
  };

  // 状态管理
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [total, setTotal] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState(
    searchParams?.get('q') || ''
  );
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(
    searchParams?.get('category') || undefined
  );
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [sensitivityFilter, setSensitivityFilter] = useState<string | undefined>(undefined);

  // 使用tRPC查询分类数据
  const { data: categoriesData } = trpc.assets.getCategories.useQuery(
    { depth: 0, isActive: true },
    { enabled: isAuthenticated }
  );

  // 使用tRPC查询资产数据
  const { data: assetsData, isLoading: assetsLoading } = trpc.assets.getAssets.useQuery(
    {
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      categoryId: categoryFilter,
      status: statusFilter as any,
      sensitivity: sensitivityFilter as any,
      search: searchKeyword || undefined,
    },
    {
      enabled: isAuthenticated,
      keepPreviousData: true, // 保持之前的数据直到新数据加载完成
    }
  );

  // 添加收藏mutation
  const addFavoriteMutation = trpc.favorites.addFavorite.useMutation({
    onSuccess: () => {
      message.success('已添加到收藏');
    },
    onError: (error) => {
      message.error(`收藏失败: ${error.message}`);
    },
  });

  // 取消收藏mutation
  const removeFavoriteMutation = trpc.favorites.removeFavorite.useMutation({
    onSuccess: () => {
      message.success('已取消收藏');
    },
    onError: (error) => {
      message.error(`取消收藏失败: ${error.message}`);
    },
  });

  // 检查认证状态
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // 更新本地状态
  useEffect(() => {
    if (assetsData) {
      setAssets(assetsData.assets as any);
      setTotal(assetsData.total);
      setLoading(false);
    }
  }, [assetsData]);

  // 同步加载状态
  useEffect(() => {
    setLoading(assetsLoading);
  }, [assetsLoading]);

  // 点击资产卡片
  const handleAssetClick = (assetId: string) => {
    router.push(`/assets/${assetId}`);
  };

  // 搜索 - 使用useCallback防止SearchBar重复渲染
  const handleSearch = useCallback((value: string) => {
    setSearchKeyword(value);
    setCurrentPage(1);
  }, []);

  // 分页
  const handlePageChange = (page: number, newPageSize?: number) => {
    setCurrentPage(page);
    if (newPageSize) {
      setPageSize(newPageSize);
    }
  };

  // 收藏切换处理
  const handleFavoriteToggle = (assetId: string, isFavorited: boolean) => {
    if (isFavorited) {
      addFavoriteMutation.mutate({ assetId });
    } else {
      removeFavoriteMutation.mutate({ assetId });
    }
  };

  // 表格列配置
  const tableColumns = [
    {
      title: '资产名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string, record: ExtendedAssetSummary) => (
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
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category: any) => (
        <Tag color="blue">{category?.name}</Tag>
      ),
    },
    {
      title: '敏感级别',
      dataIndex: 'sensitivity',
      key: 'sensitivity',
      width: 100,
      render: (sensitivity: string) => {
        const colors = { public: 'green', internal: 'orange', confidential: 'red' };
        return (
          <Tag color={colors[sensitivity as keyof typeof colors] || 'default'}>
            {sensitivityLabels[sensitivity] || sensitivity}
          </Tag>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => {
        const color = status === 'AVAILABLE' ? 'success' : 'default';
        return <Tag color={color}>{statusLabels[status] || status}</Tag>;
      },
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
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: ExtendedAssetSummary) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => handleAssetClick(record.id)}
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
    <>
      {/* 页面标题 */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>浏览与搜索</Title>
        <Text type="secondary">发现和探索数据资产 - 支持全文搜索、智能推荐和结构化筛选</Text>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总资产数量"
              value={100}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="搜索结果"
              value={total}
              prefix={<TableOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="活跃资产"
              value={assets.filter(a => a.status === 'AVAILABLE').length}
              prefix={<EyeOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="平均热度"
              value={Math.round(
                assets.reduce((sum, a) => sum + ((a as ExtendedAssetSummary).popularity || 0), 0) / (assets.length || 1)
              )}
              prefix={<StarOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 智能搜索栏 */}
      <div
        style={{
          background: 'white',
          padding: '24px',
          borderRadius: '12px',
          marginBottom: '24px',
          boxShadow: 'var(--shadow-light)',
        }}
      >
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <SearchBar
              placeholder="全文搜索资产名称、描述、标签..."
              initialValue={searchKeyword}
              onSearch={handleSearch}
              showSuggestions={true}
            />
          </Col>
        </Row>
      </div>

      {/* 快速筛选栏 */}
      <div
        style={{
          background: 'white',
          padding: '24px',
          borderRadius: '12px',
          marginBottom: '24px',
          boxShadow: 'var(--shadow-light)',
        }}
      >
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} lg={6}>
            <Space direction="vertical" style={{ width: '100%' }} size={4}>
              <Text type="secondary" style={{ fontSize: '12px' }}>数据分类</Text>
              <Select
                placeholder="选择分类"
                size="large"
                style={{ width: '100%' }}
                allowClear
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={(categoriesData?.categories || []).map(cat => ({
                  label: cat.name,
                  value: cat.id
                }))}
              />
            </Space>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Space direction="vertical" style={{ width: '100%' }} size={4}>
              <Text type="secondary" style={{ fontSize: '12px' }}>资产状态</Text>
              <Select
                placeholder="选择状态"
                size="large"
                style={{ width: '100%' }}
                allowClear
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { label: '可用', value: 'AVAILABLE' },
                  { label: '维护中', value: 'MAINTENANCE' },
                  { label: '已弃用', value: 'DEPRECATED' },
                  { label: '草稿', value: 'DRAFT' },
                ]}
              />
            </Space>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Space direction="vertical" style={{ width: '100%' }} size={4}>
              <Text type="secondary" style={{ fontSize: '12px' }}>敏感级别</Text>
              <Select
                placeholder="选择敏感级别"
                size="large"
                style={{ width: '100%' }}
                allowClear
                value={sensitivityFilter}
                onChange={setSensitivityFilter}
                options={[
                  { label: '公开', value: 'PUBLIC' },
                  { label: '内部', value: 'INTERNAL' },
                  { label: '机密', value: 'CONFIDENTIAL' },
                ]}
              />
            </Space>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Space direction="vertical" style={{ width: '100%' }} size={4}>
              <Text type="secondary" style={{ fontSize: '12px' }}>显示模式</Text>
              <Radio.Group
                value={viewMode}
                onChange={(e: RadioChangeEvent) => setViewMode(e.target.value)}
                size="large"
                style={{ width: '100%' }}
              >
                <Radio.Button value="grid" style={{ width: '33.33%', textAlign: 'center' }}>
                  <AppstoreOutlined />
                </Radio.Button>
                <Radio.Button value="list" style={{ width: '33.33%', textAlign: 'center' }}>
                  <UnorderedListOutlined />
                </Radio.Button>
                <Radio.Button value="table" style={{ width: '33.33%', textAlign: 'center' }}>
                  <TableOutlined />
                </Radio.Button>
              </Radio.Group>
            </Space>
          </Col>
        </Row>

        {/* 当前筛选条件 */}
        {(categoryFilter || statusFilter || sensitivityFilter || searchKeyword) && (
          <div style={{ marginTop: '16px' }}>
            <Space size="small" wrap>
              <Text type="secondary">
                <FilterOutlined /> 当前筛选:
              </Text>
              {searchKeyword && (
                <Tag closable onClose={() => handleSearch('')}>
                  关键词: {searchKeyword}
                </Tag>
              )}
              {categoryFilter && (
                <Tag closable onClose={() => setCategoryFilter(undefined)}>
                  分类: {categoriesData?.categories.find(c => c.id === categoryFilter)?.name || categoryFilter}
                </Tag>
              )}
              {statusFilter && (
                <Tag closable onClose={() => setStatusFilter(undefined)}>
                  状态: {statusLabels[statusFilter] || statusFilter}
                </Tag>
              )}
              {sensitivityFilter && (
                <Tag closable onClose={() => setSensitivityFilter(undefined)}>
                  敏感级别: {sensitivityLabels[sensitivityFilter] || sensitivityFilter}
                </Tag>
              )}
            </Space>
          </div>
        )}
      </div>

      {/* 数据列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>
            <Text type="secondary">加载中...</Text>
          </div>
        </div>
      ) : assets.length === 0 ? (
        <Empty
          description="暂无数据资产"
          style={{
            background: 'white',
            padding: '60px',
            borderRadius: '12px',
          }}
        />
      ) : viewMode === 'table' ? (
        <>
          <Card>
            <Table
              columns={tableColumns}
              dataSource={assets as ExtendedAssetSummary[]}
              rowKey="id"
              loading={loading}
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: total,
                onChange: handlePageChange,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条数据`,
                pageSizeOptions: [12, 24, 48, 96],
              }}
              scroll={{ x: 1200 }}
            />
          </Card>
        </>
      ) : (
        <>
          <Row gutter={[24, 24]}>
            {viewMode === 'grid' ? (
              assets.map((asset) => (
                <Col key={asset.id} xs={24} sm={12} lg={8} xxl={6}>
                  <AssetCard
                    asset={asset}
                    onClick={() => handleAssetClick(asset.id)}
                    showPreview={false}
                    showFavorite={true}
                    onFavoriteToggle={handleFavoriteToggle}
                  />
                </Col>
              ))
            ) : (
              <Col span={24}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {assets.map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      onClick={() => handleAssetClick(asset.id)}
                      showPreview={false}
                      showFavorite={true}
                      onFavoriteToggle={handleFavoriteToggle}
                    />
                  ))}
                </Space>
              </Col>
            )}
          </Row>

          {/* 分页 */}
          <div style={{ marginTop: '32px', textAlign: 'center' }}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={total}
              onChange={handlePageChange}
              showSizeChanger
              showQuickJumper
              showTotal={(total) => `共 ${total} 个资产`}
              pageSizeOptions={[12, 24, 48, 96]}
            />
          </div>
        </>
      )}
    </>
  );
}
