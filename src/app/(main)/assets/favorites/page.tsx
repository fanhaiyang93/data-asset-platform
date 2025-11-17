'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Typography,
  Row,
  Col,
  Input,
  Space,
  Empty,
  Spin,
  Radio,
  Button,
  Pagination,
  App,
} from 'antd';
import type { RadioChangeEvent } from 'antd';
import {
  AppstoreOutlined,
  UnorderedListOutlined,
  SearchOutlined,
  HeartOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import { AssetCard } from '@/components/features/assets/AssetCard';
import { trpc } from '@/lib/trpc-client';

const { Title, Text } = Typography;

export default function FavoritesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { message } = App.useApp();

  // 状态管理
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // 检查认证状态
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // 使用tRPC查询收藏列表
  const { data: favoritesData, isLoading: favoritesLoading, refetch } = trpc.favorites.getFavorites.useQuery(
    {
      search: searchKeyword || undefined,
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
    },
    {
      enabled: isAuthenticated,
      keepPreviousData: true,
    }
  );

  const favorites = favoritesData?.favorites || [];
  const total = favoritesData?.total || 0;

  // 取消收藏mutation
  const removeFavoriteMutation = trpc.favorites.removeFavorite.useMutation({
    onSuccess: () => {
      message.success('已取消收藏');
      refetch(); // 重新获取收藏列表
    },
    onError: (error) => {
      message.error(`取消收藏失败: ${error.message}`);
    },
  });

  // 点击资产卡片
  const handleAssetClick = (assetId: string) => {
    router.push(`/assets/${assetId}`);
  };

  // 搜索
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setCurrentPage(1); // 重置到第一页
  };

  // 取消收藏
  const handleUnfavorite = (assetId: string) => {
    removeFavoriteMutation.mutate({ assetId });
  };

  // 分页
  const handlePageChange = (page: number, newPageSize?: number) => {
    setCurrentPage(page);
    if (newPageSize) {
      setPageSize(newPageSize);
    }
  };

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <>
      {/* 页面标题 */}
      <div style={{ marginBottom: '24px' }}>
        <Space size="middle">
          <HeartOutlined style={{ fontSize: '32px', color: 'var(--error-color)' }} />
          <div>
            <Title level={2} style={{ margin: 0 }}>
              我的收藏
            </Title>
            <Text type="secondary">常用的数据资产收藏 ({total}个)</Text>
          </div>
        </Space>
      </div>

      {/* 搜索和视图切换 */}
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
          <Col xs={24} md={20}>
            <Input
              placeholder="搜索我的收藏..."
              prefix={<SearchOutlined />}
              size="large"
              allowClear
              value={searchKeyword}
              onPressEnter={(e) => handleSearch(e.currentTarget.value)}
              onChange={(e) => {
                if (!e.target.value) {
                  handleSearch('');
                } else {
                  setSearchKeyword(e.target.value);
                }
              }}
            />
          </Col>
          <Col xs={24} md={4}>
            <Radio.Group
              value={viewMode}
              onChange={(e: RadioChangeEvent) => setViewMode(e.target.value)}
              size="large"
              style={{ width: '100%' }}
            >
              <Radio.Button value="grid" style={{ width: '50%', textAlign: 'center' }}>
                <AppstoreOutlined />
              </Radio.Button>
              <Radio.Button value="list" style={{ width: '50%', textAlign: 'center' }}>
                <UnorderedListOutlined />
              </Radio.Button>
            </Radio.Group>
          </Col>
        </Row>
      </div>

      {/* 收藏列表 */}
      {favoritesLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>
            <Text type="secondary">加载中...</Text>
          </div>
        </div>
      ) : favorites.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Space direction="vertical" size="small">
              <Text type="secondary">
                {searchKeyword ? '没有找到匹配的收藏' : '还没有收藏任何资产'}
              </Text>
              {!searchKeyword && (
                <Button type="primary" onClick={() => router.push('/assets/browse')}>
                  去浏览资产
                </Button>
              )}
            </Space>
          }
          style={{
            background: 'white',
            padding: '60px',
            borderRadius: '12px',
          }}
        />
      ) : (
        <>
          <Row gutter={[24, 24]}>
            {viewMode === 'grid' ? (
              favorites.map((favorite) => (
                <Col key={favorite.id} xs={24} sm={12} lg={8} xxl={6}>
                  <AssetCard
                    asset={favorite.asset}
                    onClick={() => handleAssetClick(favorite.asset.id)}
                    showPreview={false}
                    showFavorite={true}
                    isFavorited={true}
                    onFavoriteToggle={(assetId, isFavorited) => {
                      if (!isFavorited) {
                        handleUnfavorite(assetId);
                      }
                    }}
                  />
                </Col>
              ))
            ) : (
              <Col span={24}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {favorites.map((favorite) => (
                    <AssetCard
                      key={favorite.id}
                      asset={favorite.asset}
                      onClick={() => handleAssetClick(favorite.asset.id)}
                      showPreview={false}
                      showFavorite={true}
                      isFavorited={true}
                      onFavoriteToggle={(assetId, isFavorited) => {
                        if (!isFavorited) {
                          handleUnfavorite(assetId);
                        }
                      }}
                    />
                  ))}
                </Space>
              </Col>
            )}
          </Row>

          {/* 分页 */}
          {total > pageSize && (
            <div style={{ marginTop: '32px', textAlign: 'center' }}>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={total}
                onChange={handlePageChange}
                showSizeChanger
                showQuickJumper
                showTotal={(total) => `共 ${total} 个收藏`}
                pageSizeOptions={[12, 24, 48, 96]}
              />
            </div>
          )}
        </>
      )}
    </>
  );
}
