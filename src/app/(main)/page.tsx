'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import SessionTimeoutWarning from '@/components/SessionTimeoutWarning';
import { trpc } from '@/lib/trpc-client';

export default function HomePage() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();
  const [searchValue, setSearchValue] = useState('');

  // 获取分类数据
  const { data: categoriesData } = trpc.assets.getCategories.useQuery(
    { depth: 0, isActive: true },
    { enabled: isAuthenticated }
  );

  // 获取热门资产(按访问次数排序,只要AVAILABLE状态)
  const { data: popularAssetsData } = trpc.assets.getAssets.useQuery(
    {
      status: 'AVAILABLE',
      skip: 0,
      take: 4,
      orderBy: { field: 'accessCount', direction: 'desc' }
    },
    { enabled: isAuthenticated }
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #f0f0f0',
            borderTopColor: '#1890ff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#666', fontSize: '14px' }}>加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleSearch = () => {
    if (searchValue.trim()) {
      router.push(`/assets/browse?q=${encodeURIComponent(searchValue)}`);
    }
  };

  const handleCategoryClick = (categoryId: string) => {
    router.push(`/assets/browse?category=${categoryId}`);
  };

  const handleAssetClick = (assetTitle: string) => {
    router.push(`/assets/browse?q=${encodeURIComponent(assetTitle)}`);
  };

  return (
    <>
      <SessionTimeoutWarning />
      {/* Hero Section - 渐变背景大标题 */}
        <div style={{
          background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
          color: 'white',
          padding: '48px 40px',
          textAlign: 'center',
          borderRadius: '0',
          marginBottom: '24px'
        }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '600',
            margin: '0 0 16px 0',
            lineHeight: '1.2'
          }}>
            数据资产管理平台
          </h1>
          <p style={{
            fontSize: '18px',
            opacity: 0.9,
            margin: '0 0 32px 0'
          }}>
            2分钟找到您需要的数据资产
          </p>

          {/* Hero Search Box */}
          <div style={{
            maxWidth: '600px',
            margin: '0 auto',
            position: 'relative'
          }}>
            <input
              type="text"
              placeholder="搜索数据表、字段名或描述..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{
                width: '100%',
                padding: '16px 24px',
                border: 'none',
                borderRadius: '50px',
                fontSize: '16px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                outline: 'none',
                backgroundColor: '#ffffff',
                color: '#333333'
              }}
            />
          </div>
        </div>

        {/* Categories Section - 按业务域浏览 */}
        <div style={{ padding: '0 40px 40px 40px' }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            marginBottom: '24px',
            textAlign: 'center',
            color: '#262626'
          }}>
            按业务域浏览
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '24px',
            marginBottom: '0'
          }}>
            {(categoriesData?.categories || []).map((category, index) => {
              // 根据分类code映射图标
              const iconMap: Record<string, string> = {
                'hr': '👥',
                'finance': '💰',
                'legal': '⚖️'
              }
              const icon = iconMap[category.code] || '📊'

              return (
              <div
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '32px 24px',
                  textAlign: 'center',
                  border: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(24,144,255,0.15)';
                  e.currentTarget.style.borderColor = '#1890ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = '#f0f0f0';
                }}
              >
                <div style={{
                  width: '64px',
                  height: '64px',
                  background: '#f0f8ff',
                  borderRadius: '50%',
                  margin: '0 auto 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  color: '#1890ff'
                }}>
                  {icon}
                </div>
                <div style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  marginBottom: '8px',
                  color: '#262626'
                }}>
                  {category.name}
                </div>
                <div style={{
                  color: '#666',
                  fontSize: '14px'
                }}>
                  {(category as any)._count?.assets || 0}个数据资产
                </div>
              </div>
              )
            })}
          </div>
        </div>

        {/* Popular Assets Section - 热门数据资产 */}
        <div style={{
          background: '#fafafa',
          padding: '32px 40px'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            marginBottom: '24px',
            textAlign: 'center',
            color: '#262626'
          }}>
            热门数据资产
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '20px',
            maxWidth: '1200px',
            margin: '0 auto'
          }}>
            {(popularAssetsData?.assets || []).map((asset) => (
              <div
                key={asset.id}
                style={{
                  background: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  border: '1px solid #f0f0f0',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '12px'
                }}>
                  <div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1890ff',
                      marginBottom: '4px'
                    }}>
                      {asset.name}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#722ed1',
                      background: '#f9f0ff',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      display: 'inline-block'
                    }}>
                      {asset.category?.name || '未分类'}
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '500',
                    background: asset.status === 'AVAILABLE' ? '#f6ffed' : '#fff7e6',
                    color: asset.status === 'AVAILABLE' ? '#52c41a' : '#faad14'
                  }}>
                    {asset.status === 'AVAILABLE' ? '可用' : '维护中'}
                  </span>
                </div>

                <div style={{
                  color: '#666',
                  fontSize: '14px',
                  marginBottom: '16px',
                  lineHeight: '1.5'
                }}>
                  {asset.description}
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                  color: '#999'
                }}>
                  <span>负责人：{asset.creator?.name || '未知'} | 更新时间：{new Date(asset.updatedAt).toLocaleDateString()}</span>
                  <button
                    onClick={() => handleAssetClick(asset.name)}
                    disabled={asset.status !== 'AVAILABLE'}
                    style={{
                      background: asset.status === 'AVAILABLE' ? '#1890ff' : '#d9d9d9',
                      color: 'white',
                      border: 'none',
                      padding: '4px 12px',
                      borderRadius: '4px',
                      cursor: asset.status === 'AVAILABLE' ? 'pointer' : 'not-allowed',
                      fontSize: '12px'
                    }}
                  >
                    立即申请
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}
