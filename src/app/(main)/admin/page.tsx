'use client';

import React from 'react';
import { Card, Table, Tag, Row, Col, Statistic, Tabs, Progress } from 'antd';
import type { TabsProps } from 'antd';
import { UserOutlined, CheckCircleOutlined, SecurityScanOutlined, TeamOutlined, ExclamationCircleOutlined, SettingOutlined } from '@ant-design/icons';
import { trpc } from '@/lib/trpc-client';
import Link from 'next/link';

export default function AdminPage() {
  // 获取管理面板统计数据
  const { data: dashboardData, isLoading: dashboardLoading } = trpc.auth.getAdminDashboard.useQuery();

  // 获取用户列表
  const { data: usersData } = trpc.auth.getUsers.useQuery({
    limit: 10,
    offset: 0,
  });

  // 获取审计日志
  const { data: logsData } = trpc.auth.getUserAuditLogs.useQuery({
    limit: 10,
    offset: 0,
  });

  const userStats = dashboardData?.userStats || {
    total: 0,
    active: 0,
    admin: 0,
    online: 0
  };

  const users = usersData?.users || [];
  const logs = logsData?.logs || [];

  const getRoleText = (role: string) => {
    switch (role) {
      case 'SYSTEM_ADMIN': return '系统管理员';
      case 'ASSET_MANAGER': return '资产管理员';
      case 'BUSINESS_USER': return '业务用户';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SYSTEM_ADMIN': return 'red';
      case 'ASSET_MANAGER': return 'orange';
      case 'BUSINESS_USER': return 'green';
      default: return 'default';
    }
  };

  const userColumns = [
    {
      title: '用户信息',
      key: 'userInfo',
      render: (_: any, record: any) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.name || record.username}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.email}</div>
          {record.department && (
            <div style={{ fontSize: '12px', color: '#666' }}>{record.department}</div>
          )}
        </div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={getRoleColor(role)}>
          {getRoleText(role)}
        </Tag>
      ),
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      render: (time: string | null) => (
        <div style={{ fontSize: '12px' }}>
          {time ? new Date(time).toLocaleString('zh-CN') : '从未登录'}
        </div>
      ),
    },
  ];

  const logColumns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time: string) => (
        <div style={{ fontSize: '12px' }}>
          {new Date(time).toLocaleString('zh-CN')}
        </div>
      ),
    },
    {
      title: '用户',
      key: 'user',
      render: (_: any, record: any) => record.user?.username || '系统',
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
    },
    {
      title: '资源',
      dataIndex: 'resource',
      key: 'resource',
      ellipsis: true,
    },
  ];

  // 定义 Tabs items
  const tabItems: TabsProps['items'] = [
    {
      key: 'users',
      label: (
        <span>
          <UserOutlined />
          用户管理
        </span>
      ),
      children: (
        <>
          <div style={{ marginBottom: 16 }}>
            <Link href="/admin/users" style={{ color: '#1890ff' }}>
              查看完整用户列表 →
            </Link>
          </div>
          <Table
            columns={userColumns}
            dataSource={users}
            rowKey="id"
            pagination={false}
          />
        </>
      ),
    },
    {
      key: 'logs',
      label: (
        <span>
          <ExclamationCircleOutlined />
          系统日志
        </span>
      ),
      children: (
        <Table
          columns={logColumns}
          dataSource={logs}
          rowKey="id"
          pagination={false}
        />
      ),
    },
    {
      key: 'links',
      label: (
        <span>
          <SettingOutlined />
          快速链接
        </span>
      ),
      children: (
        <div style={{ padding: '20px' }}>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Link href="/admin/users">
                <Card hoverable>
                  <Card.Meta
                    avatar={<UserOutlined style={{ fontSize: '24px' }} />}
                    title="用户管理"
                    description="管理系统用户和角色权限"
                  />
                </Card>
              </Link>
            </Col>
            <Col span={8}>
              <Link href="/admin/assets">
                <Card hoverable>
                  <Card.Meta
                    avatar={<SettingOutlined style={{ fontSize: '24px' }} />}
                    title="资产管理"
                    description="管理数据资产和分类"
                  />
                </Card>
              </Link>
            </Col>
            <Col span={8}>
              <Link href="/admin/sso">
                <Card hoverable>
                  <Card.Meta
                    avatar={<SecurityScanOutlined style={{ fontSize: '24px' }} />}
                    title="SSO配置"
                    description="配置单点登录和认证"
                  />
                </Card>
              </Link>
            </Col>
          </Row>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 统计概览 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card loading={dashboardLoading}>
            <Statistic
              title="总用户数"
              value={userStats.total}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={dashboardLoading}>
            <Statistic
              title="活跃用户"
              value={userStats.active}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={dashboardLoading}>
            <Statistic
              title="管理员数"
              value={userStats.admin}
              valueStyle={{ color: '#faad14' }}
              prefix={<SecurityScanOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={dashboardLoading}>
            <Statistic
              title="在线用户"
              value={userStats.online}
              valueStyle={{ color: '#1890ff' }}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 系统健康状态 */}
      <Card style={{ marginBottom: 24 }} title="系统健康状态">
        <Row gutter={16}>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 8 }}>系统状态</div>
              <Progress
                type="circle"
                percent={98}
                format={() => '正常'}
                strokeColor="#52c41a"
              />
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 8 }}>内存使用率</div>
              <Progress
                type="circle"
                percent={75}
                status="active"
                strokeColor="#faad14"
              />
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 8 }}>CPU使用率</div>
              <Progress
                type="circle"
                percent={45}
                strokeColor="#1890ff"
              />
            </div>
          </Col>
        </Row>
      </Card>

      {/* 管理面板 */}
      <Card>
        <Tabs defaultActiveKey="users" items={tabItems} />
      </Card>
    </div>
  );
}
