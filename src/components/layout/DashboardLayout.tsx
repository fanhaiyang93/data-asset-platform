'use client';

import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography, Badge, Button } from 'antd';
import type { MenuProps } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HomeOutlined,
  DatabaseOutlined,
  SearchOutlined,
  FileTextOutlined,
  SettingOutlined,
  UserOutlined,
  BellOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface DashboardLayoutProps {
  children: React.ReactNode;
  user?: {
    name: string;
    email: string;
    role: string;
    avatar?: string;
  };
  notificationCount?: number;
  onLogout?: () => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  user,
  notificationCount = 0,
  onLogout,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // 根据用户角色动态生成菜单
  const getMenuItems = (): MenuProps['items'] => {
    const baseMenuItems: MenuProps['items'] = [
      {
        key: '/',
        icon: <HomeOutlined />,
        label: '首页',
      },
      {
        key: '/assets',
        icon: <DatabaseOutlined />,
        label: '数据资产',
        children: [
          {
            key: '/assets/browse',
            label: '浏览与搜索',
          },
          {
            key: '/assets/favorites',
            label: '我的收藏',
          },
        ],
      },
      {
        key: '/applications',
        icon: <FileTextOutlined />,
        label: '我的申请',
      },
    ];

    // 只有资产管理员和系统管理员才能看到管理后台
    if (user && (user.role === 'ASSET_MANAGER' || user.role === 'SYSTEM_ADMIN')) {
      baseMenuItems.push(
        {
          type: 'divider',
        },
        {
          key: '/admin-main',
          icon: <SettingOutlined />,
          label: '管理后台',
          children: [
            {
              key: '/admin',
              label: '数据概览',
            },
            {
              key: '/admin/assets-group',
              label: '资产管理',
              children: [
                {
                  key: '/admin/assets',
                  label: '资产列表',
                },
                {
                  key: '/admin/assets/onboarding',
                  label: '资产接入',
                },
              ],
            },
            {
              key: '/admin/applications-group',
              label: '申请管理',
              children: [
                {
                  key: '/admin/applications/pending',
                  label: '待处理申请',
                },
                {
                  key: '/admin/applications/history',
                  label: '申请历史',
                },
              ],
            },
            ...(user.role === 'SYSTEM_ADMIN'
              ? [
                  {
                    key: '/admin/users',
                    label: '用户管理',
                  },
                  {
                    key: '/admin/settings-group',
                    label: '系统设置',
                    children: [
                      {
                        key: '/admin/sso',
                        label: 'SSO设置',
                      },
                      {
                        key: '/admin/settings/permissions',
                        label: '权限管理',
                      },
                    ],
                  },
                ]
              : []),
          ],
        }
      );
    }

    return baseMenuItems;
  };

  const menuItems = getMenuItems();

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
    },
    {
      type: 'divider',
    },
    {
      key: 'help',
      icon: <QuestionCircleOutlined />,
      label: '帮助中心',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: onLogout,
    },
  ];

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    router.push(key);
  };

  const selectedKeys = [pathname];
  const openKeys = pathname.split('/').slice(0, 2).join('/');

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        breakpoint="lg"
        onBreakpoint={(broken) => {
          if (broken) {
            setCollapsed(true);
          }
        }}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
        theme="light"
        width={240}
      >
        <div
          style={{
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          {!collapsed ? (
            <Space>
              <DatabaseOutlined style={{ fontSize: '24px', color: 'var(--primary-color)' }} />
              <Text strong style={{ fontSize: '18px' }}>
                数据资产平台
              </Text>
            </Space>
          ) : (
            <DatabaseOutlined style={{ fontSize: '24px', color: 'var(--primary-color)' }} />
          )}
        </div>

        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={[openKeys]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'margin-left 0.2s' }}>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            position: 'sticky',
            top: 0,
            zIndex: 999,
          }}
        >
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{
                fontSize: '16px',
                width: 48,
                height: 48,
              }}
            />
          </Space>

          <Space size="large">
            <Badge count={notificationCount} overflowCount={99}>
              <Button
                type="text"
                icon={<BellOutlined style={{ fontSize: '18px' }} />}
                style={{ width: 40, height: 40 }}
              />
            </Badge>

            {user && (
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <Space style={{ cursor: 'pointer' }} align="center">
                  <Avatar src={user.avatar} icon={<UserOutlined />} size={40} />
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                    <Text strong style={{ fontSize: '14px' }}>{user.name}</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {user.role === 'BUSINESS_USER' ? '业务用户' :
                       user.role === 'ASSET_MANAGER' ? '资产管理员' :
                       user.role === 'SYSTEM_ADMIN' ? '系统管理员' : user.role}
                    </Text>
                  </div>
                </Space>
              </Dropdown>
            )}
          </Space>
        </Header>

        <Content
          style={{
            margin: '24px',
            padding: '24px',
            minHeight: 'calc(100vh - 112px)',
            background: '#f5f5f5',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default DashboardLayout;
