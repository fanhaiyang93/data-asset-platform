'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Table, Tag, Space, Button, Select, DatePicker, Row, Col, Statistic, Modal, Form, Input, Tooltip, Progress, App } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import { trpc } from '@/lib/trpc-client';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

interface ApplicationData {
  id: string;
  applicationNumber: string;
  status: string;
  purpose: string;
  reason: string;
  startDate: Date;
  endDate: Date;
  applicantName: string;
  department?: string | null;
  contactEmail: string;
  contactPhone?: string | null;
  reviewComment?: string | null;
  reviewedAt?: Date | null;
  submittedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  asset: {
    id: string;
    name: string;
    description: string;
    category: {
      name: string;
    };
  };
  reviewer?: {
    name: string | null;
    email: string;
  } | null;
}

export default function ApplicationsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { message } = App.useApp();
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentApplication, setCurrentApplication] = useState<ApplicationData | null>(null);
  const [form] = Form.useForm();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 检查认证状态
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // 使用tRPC查询申请数据
  const { data: applicationsData, isLoading: applicationsLoading, refetch } = trpc.application.getApplications.useQuery(
    {
      page: currentPage,
      limit: pageSize,
      status: selectedStatus === 'all' ? undefined : [selectedStatus as any],
      sortBy: 'createdAt',
      sortOrder: 'desc',
    },
    {
      enabled: isAuthenticated,
      keepPreviousData: true,
    }
  );

  const applications = applicationsData?.applications || [];
  const total = applicationsData?.total || 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'default';
      case 'PENDING': return 'warning';
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'error';
      case 'PROCESSING': return 'processing';
      case 'COMPLETED': return 'success';
      case 'CANCELLED': return 'default';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'DRAFT': return '草稿';
      case 'PENDING': return '待审批';
      case 'APPROVED': return '已批准';
      case 'REJECTED': return '已拒绝';
      case 'PROCESSING': return '处理中';
      case 'COMPLETED': return '已完成';
      case 'CANCELLED': return '已取消';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <ClockCircleOutlined />;
      case 'APPROVED': return <CheckCircleOutlined />;
      case 'REJECTED': return <CloseCircleOutlined />;
      case 'PROCESSING': return <ExclamationCircleOutlined />;
      default: return null;
    }
  };

  const getPurposeText = (purpose: string) => {
    const purposeMap: Record<string, string> = {
      DATA_ANALYSIS: '数据分析',
      BUSINESS_REPORT: '业务报表',
      ALGORITHM_TRAINING: '算法训练',
      DATA_MIGRATION: '数据迁移',
      SYSTEM_INTEGRATION: '系统集成',
      AUDIT_COMPLIANCE: '审计合规',
      OTHER: '其他',
    };
    return purposeMap[purpose] || purpose;
  };

  const handleViewDetail = (record: ApplicationData) => {
    setCurrentApplication(record);
    setIsModalVisible(true);
  };

  const handlePageChange = (page: number, newPageSize?: number) => {
    setCurrentPage(page);
    if (newPageSize) {
      setPageSize(newPageSize);
    }
  };

  const statusStats = {
    total: applications.length,
    pending: applications.filter(app => app.status === 'PENDING').length,
    approved: applications.filter(app => app.status === 'APPROVED').length,
    rejected: applications.filter(app => app.status === 'REJECTED').length,
    processing: applications.filter(app => app.status === 'PROCESSING').length,
  };

  const columns = [
    {
      title: '申请编号',
      dataIndex: 'applicationNumber',
      key: 'applicationNumber',
      width: 150,
      render: (text: string) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{text}</span>
      ),
    },
    {
      title: '数据资产',
      key: 'asset',
      width: 200,
      render: (_: any, record: ApplicationData) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.asset.name}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            分类: {record.asset.category.name}
          </div>
        </div>
      ),
    },
    {
      title: '申请人信息',
      key: 'applicant',
      width: 150,
      render: (_: any, record: ApplicationData) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.applicantName}</div>
          {record.department && (
            <div style={{ fontSize: '12px', color: '#666' }}>{record.department}</div>
          )}
        </div>
      ),
    },
    {
      title: '业务用途',
      dataIndex: 'purpose',
      key: 'purpose',
      width: 120,
      render: (purpose: string) => (
        <Tag color="blue">{getPurposeText(purpose)}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag icon={getStatusIcon(status)} color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '使用期限',
      key: 'duration',
      width: 180,
      render: (_: any, record: ApplicationData) => (
        <div style={{ fontSize: '12px' }}>
          <div>{new Date(record.startDate).toLocaleDateString()}</div>
          <div>至 {new Date(record.endDate).toLocaleDateString()}</div>
        </div>
      ),
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 140,
      render: (time: Date | null) => (
        <div style={{ fontSize: '12px' }}>
          {time ? new Date(time).toLocaleString() : '-'}
        </div>
      ),
    },
    {
      title: '审批信息',
      key: 'approval',
      width: 140,
      render: (_: any, record: ApplicationData) => {
        if (record.status === 'APPROVED' || record.status === 'REJECTED') {
          return (
            <div style={{ fontSize: '12px' }}>
              {record.reviewer && <div>审批人: {record.reviewer.name}</div>}
              {record.reviewedAt && <div>时间: {new Date(record.reviewedAt).toLocaleString()}</div>}
            </div>
          );
        }
        return <span style={{ color: '#999' }}>-</span>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: ApplicationData) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          {record.status === 'DRAFT' && (
            <Tooltip title="编辑">
              <Button type="text" icon={<EditOutlined />} size="small" />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div style={{ padding: '24px' }}>
        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总申请数"
                value={total}
                prefix={<PlusOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="待审批"
                value={statusStats.pending}
                valueStyle={{ color: '#faad14' }}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="已批准"
                value={statusStats.approved}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="已拒绝"
                value={statusStats.rejected}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* 进度条显示 */}
        {total > 0 && (
          <Card style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ marginBottom: 8 }}>审批进度</div>
                  <Progress
                    type="circle"
                    percent={Math.round((statusStats.approved / total) * 100)}
                    format={() => `${statusStats.approved}/${total}`}
                  />
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ marginBottom: 8 }}>待处理率</div>
                  <Progress
                    type="circle"
                    percent={Math.round((statusStats.pending / total) * 100)}
                    status="active"
                    strokeColor="#faad14"
                    format={() => `${statusStats.pending}/${total}`}
                  />
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ marginBottom: 8 }}>拒绝率</div>
                  <Progress
                    type="circle"
                    percent={Math.round((statusStats.rejected / total) * 100)}
                    status={statusStats.rejected > 0 ? "exception" : "normal"}
                    format={() => `${statusStats.rejected}/${total}`}
                  />
                </div>
              </Col>
            </Row>
          </Card>
        )}

        {/* 筛选和操作区域 */}
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={16} align="middle">
            <Col span={6}>
              <Select
                placeholder="选择状态"
                style={{ width: '100%' }}
                value={selectedStatus}
                onChange={setSelectedStatus}
              >
                <Option value="all">全部状态</Option>
                <Option value="DRAFT">草稿</Option>
                <Option value="PENDING">待审批</Option>
                <Option value="APPROVED">已批准</Option>
                <Option value="REJECTED">已拒绝</Option>
                <Option value="PROCESSING">处理中</Option>
                <Option value="COMPLETED">已完成</Option>
              </Select>
            </Col>
            <Col span={18}>
              <Space wrap style={{ float: 'right' }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/assets/browse')}>
                  新建申请
                </Button>
                <Button onClick={() => message.info('批量操作功能开发中')}>批量操作</Button>
                <Button onClick={() => message.info('导出数据功能开发中')}>导出数据</Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 申请列表 */}
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>申请列表 ({total})</span>
            </div>
          }
        >
          <Table
            columns={columns}
            dataSource={applications}
            rowKey="id"
            loading={applicationsLoading}
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: total,
              onChange: handlePageChange,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `第 ${range[0]}-${range[1]} 条，共 ${total} 条申请`,
              pageSizeOptions: ['10', '20', '50', '100'],
            }}
            scroll={{ x: 1400 }}
          />
        </Card>

        {/* 详情模态框 */}
        <Modal
          title="申请详情"
          open={isModalVisible}
          onCancel={() => setIsModalVisible(false)}
          footer={null}
          width={800}
        >
          {currentApplication && (
            <div>
              <Row gutter={16}>
                <Col span={12}>
                  <p><strong>申请编号:</strong> {currentApplication.applicationNumber}</p>
                  <p><strong>申请人:</strong> {currentApplication.applicantName}</p>
                  <p><strong>部门:</strong> {currentApplication.department || '-'}</p>
                  <p><strong>联系邮箱:</strong> {currentApplication.contactEmail}</p>
                  <p><strong>联系电话:</strong> {currentApplication.contactPhone || '-'}</p>
                  <p><strong>数据资产:</strong> {currentApplication.asset.name}</p>
                </Col>
                <Col span={12}>
                  <p><strong>业务用途:</strong> <Tag color="blue">{getPurposeText(currentApplication.purpose)}</Tag></p>
                  <p><strong>状态:</strong> <Tag color={getStatusColor(currentApplication.status)}>{getStatusText(currentApplication.status)}</Tag></p>
                  <p><strong>提交时间:</strong> {currentApplication.submittedAt ? new Date(currentApplication.submittedAt).toLocaleString() : '-'}</p>
                  <p><strong>使用开始:</strong> {new Date(currentApplication.startDate).toLocaleDateString()}</p>
                  <p><strong>使用结束:</strong> {new Date(currentApplication.endDate).toLocaleDateString()}</p>
                </Col>
              </Row>
              <p><strong>申请理由:</strong></p>
              <p style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px' }}>
                {currentApplication.reason}
              </p>
              {currentApplication.status === 'REJECTED' && currentApplication.reviewComment && (
                <>
                  <p><strong>拒绝原因:</strong></p>
                  <p style={{ background: '#fff2f0', padding: '12px', borderRadius: '4px', border: '1px solid #ffccc7' }}>
                    {currentApplication.reviewComment}
                  </p>
                </>
              )}
              {currentApplication.status === 'APPROVED' && currentApplication.reviewComment && (
                <>
                  <p><strong>审批意见:</strong></p>
                  <p style={{ background: '#f6ffed', padding: '12px', borderRadius: '4px', border: '1px solid #b7eb8f' }}>
                    {currentApplication.reviewComment}
                  </p>
                </>
              )}
            </div>
          )}
        </Modal>
    </div>
  );
}
