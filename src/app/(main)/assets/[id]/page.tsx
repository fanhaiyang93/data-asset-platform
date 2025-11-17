'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button, Space, Spin, Breadcrumb, App } from 'antd';
import { ArrowLeftOutlined, HomeOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import { AssetDetail } from '@/components/common/AssetDetail';
import type { AssetDetailData } from '@/components/common/AssetDetail';
import { ApplicationForm } from '@/components/common/ApplicationForm';
import type { ApplicationFormData } from '@/components/common/ApplicationForm';
import { trpc } from '@/lib/trpc-client';

export default function AssetDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { message } = App.useApp();

  const [asset, setAsset] = useState<AssetDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  const assetId = params?.id as string;

  // 使用 tRPC mutation 提交申请
  const submitApplication = trpc.application.submitApplication.useMutation();

  // 加载数据
  useEffect(() => {
    // 等待认证状态加载完成
    if (authLoading) {
      return;
    }

    // 认证加载完成后,如果未登录则跳转
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // 已登录,加载资产详情
    if (assetId) {
      loadAssetDetail(assetId);
    }
  }, [authLoading, isAuthenticated, assetId, router]);

  const loadAssetDetail = async (id: string) => {
    setLoading(true);
    try {
      // TODO: 替换为真实API
      // const response = await api.assets.getById.query({ id });

      // 模拟数据
      await new Promise((resolve) => setTimeout(resolve, 800));

      const mockAsset: AssetDetailData = {
        id,
        name: `数据资产 ${id}`,
        code: `ASSET_${id.toUpperCase()}`,
        description:
          '这是一个完整的数据资产详情,包含了资产的基本信息、数据结构、访问权限、版本历史等重要信息,帮助用户全面了解该数据资产。',
        status: 'AVAILABLE',
        categoryName: 'HR数据域',
        owner: '张三',
        ownerContact: 'zhangsan@company.com',
        technicalContact: '李四',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-11-10'),
        viewCount: 523,
        applicationCount: 45,
        tags: ['员工数据', '基础数据', '敏感', '高质量'],
        schema: {
          columns: [
            { name: 'employee_id', type: 'VARCHAR(50)', comment: '员工ID', nullable: false },
            { name: 'employee_name', type: 'VARCHAR(100)', comment: '员工姓名', nullable: false },
            { name: 'department', type: 'VARCHAR(100)', comment: '所属部门', nullable: true },
            { name: 'position', type: 'VARCHAR(100)', comment: '职位', nullable: true },
            { name: 'hire_date', type: 'DATE', comment: '入职日期', nullable: false },
            { name: 'email', type: 'VARCHAR(200)', comment: '邮箱', nullable: true },
            { name: 'phone', type: 'VARCHAR(20)', comment: '电话(脱敏)', nullable: true },
            { name: 'status', type: 'VARCHAR(20)', comment: '状态(在职/离职)', nullable: false },
          ],
        },
        sampleData: [
          {
            key: '1',
            employee_id: 'EMP001',
            employee_name: '张**',
            department: '技术部',
            position: '高级工程师',
            hire_date: '2020-03-15',
            email: 'zhang***@company.com',
            phone: '138****1234',
            status: '在职',
          },
          {
            key: '2',
            employee_id: 'EMP002',
            employee_name: '李**',
            department: '产品部',
            position: '产品经理',
            hire_date: '2019-06-01',
            email: 'li***@company.com',
            phone: '139****5678',
            status: '在职',
          },
          {
            key: '3',
            employee_id: 'EMP003',
            employee_name: '王**',
            department: '市场部',
            position: '市场专员',
            hire_date: '2021-09-20',
            email: 'wang***@company.com',
            phone: '136****9012',
            status: '在职',
          },
        ],
        accessControl: {
          requireApproval: true,
          approvers: ['张三', '李四'],
          maxAccessDays: 90,
        },
        versionHistory: [
          {
            version: '1.3.0',
            changeDate: new Date('2024-11-10'),
            changeBy: '张三',
            changeDescription: '新增phone字段脱敏',
          },
          {
            version: '1.2.0',
            changeDate: new Date('2024-09-15'),
            changeBy: '李四',
            changeDescription: '优化索引,提升性能',
          },
          {
            version: '1.1.0',
            changeDate: new Date('2024-06-01'),
            changeBy: '张三',
            changeDescription: '新增status字段,支持离职员工',
          },
          {
            version: '1.0.0',
            changeDate: new Date('2024-01-15'),
            changeBy: '系统',
            changeDescription: '初始版本',
          },
        ],
      };

      setAsset(mockAsset);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 申请访问
  const handleApply = () => {
    setShowApplicationForm(true);
  };

  // 联系负责人
  const handleContact = (assetId: string, type: 'owner' | 'technical') => {
    const contact = type === 'owner' ? asset?.ownerContact : asset?.technicalContact;
    if (contact) {
      message.info(`联系${type === 'owner' ? '负责人' : '技术负责人'}: ${contact}`);
      // TODO: 可以集成邮件发送或即时通讯工具
    }
  };

  // 提交申请
  const handleSubmitApplication = async (data: ApplicationFormData) => {
    try {
      if (!user) {
        message.error('用户信息获取失败,请重新登录');
        return;
      }

      // 验证必填字段
      if (!data.accessPeriod || !data.accessPeriod[0] || !data.accessPeriod[1]) {
        message.error('请选择访问期限');
        return;
      }

      if (!data.purpose) {
        message.error('请选择申请用途');
        return;
      }

      if (!data.businessScenario) {
        message.error('请填写业务场景');
        return;
      }

      // 将前端表单数据转换为后端 API 期望的格式
      // 映射前端选项值到后端枚举值
      const purposeMap: Record<string, string> = {
        'analysis': 'DATA_ANALYSIS',
        'reporting': 'REPORT_CREATION',
        'ml-training': 'MODEL_TRAINING',
        'query': 'DATA_ANALYSIS',
        'integration': 'SYSTEM_INTEGRATION',
        'other': 'OTHER',
      };
      const purpose = purposeMap[data.purpose] || 'OTHER';

      // 组合申请理由
      const reason = `
业务场景: ${data.businessScenario}

预期用法: ${data.expectedUsage || '未填写'}

${data.additionalInfo ? `补充说明: ${data.additionalInfo}` : ''}
      `.trim();

      await submitApplication.mutateAsync({
        assetId,
        purpose,
        reason,
        startDate: data.accessPeriod[0].toDate(),
        endDate: data.accessPeriod[1].toDate(),
        applicantName: user.name || user.username,
        department: user.department,
        contactEmail: user.email,
        contactPhone: undefined, // 表单中未收集电话
      });

      message.success('申请提交成功!请等待审批');
      setShowApplicationForm(false);

      // 跳转到申请页
      setTimeout(() => {
        router.push('/applications');
      }, 1500);
    } catch (error: any) {
      console.error('提交申请失败:', error);
      message.error(error.message || '提交失败,请重试');
      throw error;
    }
  };

  return (
    <>
      {/* 面包屑导航 */}
      <div style={{ marginBottom: '24px' }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Breadcrumb
            items={[
              {
                href: '/',
                title: (
                  <>
                    <HomeOutlined />
                    <span>首页</span>
                  </>
                ),
              },
              {
                href: '/assets/browse',
                title: (
                  <>
                    <DatabaseOutlined />
                    <span>数据资产</span>
                  </>
                ),
              },
              {
                title: asset?.name || '资产详情',
              },
            ]}
          />

          <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
            返回
          </Button>
        </Space>
      </div>

      {/* 资产详情 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>加载中...</div>
        </div>
      ) : asset ? (
        <>
          <AssetDetail
            asset={asset}
            showActions={true}
            onApply={handleApply}
            onContact={handleContact}
          />

          {/* 申请表单弹窗 */}
          <ApplicationForm
            assetName={asset.name}
            assetId={asset.id}
            visible={showApplicationForm}
            onCancel={() => setShowApplicationForm(false)}
            onSubmit={handleSubmitApplication}
            loading={submitApplication.isPending}
            availableColumns={asset.schema?.columns.map((col) => col.name) || []}
          />
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <div>资产不存在</div>
          <Button type="primary" onClick={() => router.push('/assets/browse')} style={{ marginTop: '16px' }}>
            返回资产列表
          </Button>
        </div>
      )}
    </>
  );
}
