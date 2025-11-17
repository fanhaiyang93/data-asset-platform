'use client'

import { useState } from 'react'
import { Button, Input, Table, Space, Tag, Card, Row, Col, Statistic, Typography, Drawer, Form, Select, App } from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined
} from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { themeColors } from '@/theme'
import { trpc } from '@/lib/trpc-client'

const { Title, Text } = Typography

interface Asset {
  id: string
  name: string
  code: string
  status: string
  category: {
    name: string
  }
  updatedAt: string
  creator?: {
    name: string | null
    username: string
  }
}

export default function AdminAssetsPage() {
  const router = useRouter()
  const { modal, message } = App.useApp()
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>()
  const pageSize = 10

  // 获取资产列表
  const { data: assetsData, isLoading, refetch } = trpc.assets.getAssets.useQuery({
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
    search: searchTerm || undefined,
    status: statusFilter as any,
    categoryId: categoryFilter,
    orderBy: {
      field: 'updatedAt',
      direction: 'desc'
    }
  })

  // 删除资产 mutation
  const deleteAsset = trpc.assets.deleteAsset.useMutation({
    onSuccess: () => {
      message.success('资产删除成功')
      refetch()
    },
    onError: (error) => {
      message.error(`删除失败: ${error.message}`)
    }
  })

  const assets = assetsData?.assets || []
  const total = assetsData?.total || 0

  // 获取资产统计
  const activeCount = assets.filter((a: Asset) => a.status === 'AVAILABLE').length
  const maintenanceCount = assets.filter((a: Asset) => a.status === 'MAINTENANCE').length

  // 使用 tRPC mutation 更新资产状态
  const updateAsset = trpc.assets.updateAsset.useMutation()

  // 下架资产处理函数
  const handleOffline = (record: Asset) => {
    modal.confirm({
      title: '确认下架',
      content: `确定要下架资产"${record.name}"吗?下架后资产状态将变更为"已废弃"。`,
      okText: '确认下架',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteAsset.mutateAsync({ id: record.id })
        } catch (error) {
          console.error('下架失败:', error)
        }
      }
    })
  }

  // 重新上架资产处理函数
  const handleOnline = (record: Asset) => {
    modal.confirm({
      title: '确认上架',
      content: `确定要上架资产"${record.name}"吗?上架后资产状态将变更为"可用"。`,
      okText: '确认上架',
      okType: 'primary',
      cancelText: '取消',
      onOk: async () => {
        try {
          await updateAsset.mutateAsync({
            id: record.id,
            data: { status: 'AVAILABLE' }
          })
          message.success('资产已上架')
          refetch()
        } catch (error) {
          console.error('上架失败:', error)
          message.error('上架失败')
        }
      }
    })
  }

  const getStatusTag = (status: string) => {
    const statusMap: { [key: string]: { color: string; text: string } } = {
      'AVAILABLE': { color: 'green', text: '可用' },
      'MAINTENANCE': { color: 'orange', text: '维护中' },
      'DEPRECATED': { color: 'red', text: '已废弃' },
      'DRAFT': { color: 'default', text: '草稿' },
    }
    const config = statusMap[status] || { color: 'default', text: status }
    return <Tag color={config.color}>{config.text}</Tag>
  }

  const columns = [
    {
      title: '资产名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Asset) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>{record.code}</div>
        </div>
      )
    },
    {
      title: '分类',
      key: 'category',
      render: (_: any, record: Asset) => (
        <Tag color="blue">{record.category?.name || '未分类'}</Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status)
    },
    {
      title: '负责人',
      key: 'owner',
      render: (_: any, record: Asset) => record.creator?.name || record.creator?.username || '-'
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date: string) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Asset) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/assets/${record.id}`)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => router.push(`/admin/assets/${record.id}/edit`)}
          >
            编辑
          </Button>
          {record.status === 'DEPRECATED' ? (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleOnline(record)}
              loading={updateAsset.isPending}
              style={{ color: '#52c41a' }}
            >
              上架
            </Button>
          ) : (
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleOffline(record)}
              loading={deleteAsset.isPending}
            >
              下架
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <>
      {/* 页面标题 */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>资产管理</Title>
        <Text type="secondary">管理和查看所有数据资产</Text>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="资产总数"
              value={total}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: themeColors.primary }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="正常运行"
              value={activeCount}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="维护中"
              value={maintenanceCount}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本页显示"
              value={assets.length}
              valueStyle={{ color: themeColors.primary }}
            />
          </Card>
        </Col>
      </Row>

      {/* 操作栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Input
              placeholder="搜索资产名称、描述..."
              allowClear
              style={{ width: 300 }}
              prefix={<SearchOutlined />}
              onPressEnter={(e) => setSearchTerm(e.currentTarget.value)}
              onChange={(e) => {
                if (!e.target.value) {
                  setSearchTerm('')
                }
              }}
            />
            <Button
              icon={<FilterOutlined />}
              onClick={() => setFilterDrawerOpen(true)}
            >
              筛选
              {(statusFilter || categoryFilter) && (
                <span style={{ marginLeft: 4, color: themeColors.primary }}>●</span>
              )}
            </Button>
          </Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => router.push('/admin/assets/new')}
          >
            新建资产
          </Button>
        </Space>
      </Card>

      {/* 资产列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={assets}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: false,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page) => setCurrentPage(page)
          }}
        />
      </Card>

      {/* 筛选抽屉 */}
      <Drawer
        title="筛选条件"
        placement="right"
        onClose={() => setFilterDrawerOpen(false)}
        open={filterDrawerOpen}
        width={400}
        extra={
          <Button
            onClick={() => {
              setStatusFilter(undefined)
              setCategoryFilter(undefined)
              setCurrentPage(1)
            }}
          >
            清空筛选
          </Button>
        }
      >
        <Form layout="vertical">
          <Form.Item label="状态">
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="请选择状态"
              allowClear
            >
              <Select.Option value="AVAILABLE">可用</Select.Option>
              <Select.Option value="MAINTENANCE">维护中</Select.Option>
              <Select.Option value="DEPRECATED">已废弃</Select.Option>
              <Select.Option value="DRAFT">草稿</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="分类">
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              placeholder="请选择分类"
              allowClear
            >
              <Select.Option value="cat1">用户数据</Select.Option>
              <Select.Option value="cat2">业务数据</Select.Option>
              <Select.Option value="cat3">系统数据</Select.Option>
            </Select>
          </Form.Item>

          <Button
            type="primary"
            block
            onClick={() => {
              setCurrentPage(1)
              setFilterDrawerOpen(false)
            }}
          >
            应用筛选
          </Button>
        </Form>
      </Drawer>
    </>
  )
}
