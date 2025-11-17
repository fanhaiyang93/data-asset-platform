'use client';

import React, { useState } from 'react';
import {
  Modal,
  Steps,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Typography,
  Card,
  Divider,
  Alert,
  App,
} from 'antd';
import type { FormInstance } from 'antd';
import {
  FileTextOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

// 申请表单数据接口
export interface ApplicationFormData {
  // 步骤1: 申请目的
  purpose: string; // 申请用途
  businessScenario: string; // 业务场景
  expectedUsage: string; // 预期用法

  // 步骤2: 访问权限
  accessPeriod: [Dayjs, Dayjs]; // 访问期限
  accessScope: 'full' | 'partial'; // 访问范围
  specificColumns?: string[]; // 指定字段(当访问范围为partial)
  dataVolume?: 'small' | 'medium' | 'large'; // 数据量级

  // 步骤3: 审批信息
  urgencyLevel: 'low' | 'normal' | 'high' | 'urgent'; // 紧急程度
  additionalInfo?: string; // 补充说明
  notifyApprover?: boolean; // 是否立即通知审批人
}

interface ApplicationFormProps {
  /** 资产名称 */
  assetName: string;
  /** 资产ID */
  assetId: string;
  /** 是否显示弹窗 */
  visible: boolean;
  /** 取消回调 */
  onCancel: () => void;
  /** 提交回调 */
  onSubmit: (data: ApplicationFormData) => Promise<void>;
  /** 是否正在提交 */
  loading?: boolean;
  /** 可用字段列表(用于部分字段申请) */
  availableColumns?: string[];
}

/**
 * ApplicationForm - 数据资产申请表单组件
 *
 * 提供三步骤的数据资产访问申请流程:
 * 1. 填写申请目的和业务场景(目的)
 * 2. 配置访问权限和数据范围(权限)
 * 3. 确认审批信息(紧急程度和补充说明)
 *
 * 特性:
 * - 步骤化表单,逐步引导
 * - 表单字段联动和验证
 * - 支持全字段或部分字段申请
 * - 实时预览申请信息
 * - 提交前最终确认
 */
export const ApplicationForm: React.FC<ApplicationFormProps> = ({
  assetName,
  assetId,
  visible,
  onCancel,
  onSubmit,
  loading = false,
  availableColumns = [],
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm<ApplicationFormData>();
  const { message } = App.useApp();

  // 监听表单字段变化 - 必须在组件顶层调用 Hook
  const accessScope = Form.useWatch('accessScope', form);

  // 步骤配置
  const steps = [
    {
      title: '申请目的',
      icon: <FileTextOutlined />,
      description: '说明申请用途',
    },
    {
      title: '访问权限',
      icon: <SafetyOutlined />,
      description: '配置访问范围',
    },
    {
      title: '确认提交',
      icon: <CheckCircleOutlined />,
      description: '审核信息确认',
    },
  ];

  // 下一步
  const handleNext = async () => {
    try {
      // 只验证当前步骤的字段
      const fieldsToValidate = getFieldsForStep(currentStep);
      await form.validateFields(fieldsToValidate);
      setCurrentStep(currentStep + 1);
    } catch (error) {
      message.warning('请完成当前步骤的必填项');
    }
  };

  // 上一步
  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      console.log('[ApplicationForm] 表单数据:', values);
      await onSubmit(values);
      message.success('申请提交成功!');
      handleReset();
    } catch (error) {
      console.error('[ApplicationForm] 表单验证或提交失败:', error);
      if (error instanceof Error) {
        message.error(`提交失败: ${error.message}`);
      } else {
        message.error('提交失败,请检查表单填写是否完整');
      }
    }
  };

  // 重置表单
  const handleReset = () => {
    form.resetFields();
    setCurrentStep(0);
    onCancel();
  };

  // 根据步骤获取需要验证的字段
  const getFieldsForStep = (step: number): string[] => {
    switch (step) {
      case 0:
        return ['purpose', 'businessScenario', 'expectedUsage'];
      case 1:
        return ['accessPeriod', 'accessScope', 'dataVolume'];
      case 2:
        return ['urgencyLevel'];
      default:
        return [];
    }
  };

  // 步骤1: 申请目的
  const renderStep1 = () => (
    <div>
      <Alert
        message="申请须知"
        description="请详细说明您的申请用途和业务场景,这将帮助审批人更快地处理您的申请"
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: '24px' }}
      />

      <Form.Item
        label="申请用途"
        name="purpose"
        rules={[{ required: true, message: '请选择申请用途' }]}
      >
        <Select
          placeholder="请选择申请用途"
          options={[
            { label: '数据分析', value: 'analysis' },
            { label: '报表生成', value: 'reporting' },
            { label: '机器学习训练', value: 'ml-training' },
            { label: '数据查询', value: 'query' },
            { label: '系统集成', value: 'integration' },
            { label: '其他', value: 'other' },
          ]}
        />
      </Form.Item>

      <Form.Item
        label="业务场景描述"
        name="businessScenario"
        rules={[
          { required: true, message: '请描述业务场景' },
          { min: 20, message: '描述至少需要20个字符' },
        ]}
      >
        <TextArea
          rows={4}
          placeholder="请详细描述您的业务场景,例如:用于季度销售分析报告..."
          showCount
          maxLength={500}
        />
      </Form.Item>

      <Form.Item
        label="预期用法"
        name="expectedUsage"
        rules={[{ required: true, message: '请说明预期用法' }]}
      >
        <TextArea
          rows={3}
          placeholder="请说明如何使用这些数据,例如:通过ETL工具导入分析数据库,供BI系统查询..."
          showCount
          maxLength={300}
        />
      </Form.Item>
    </div>
  );

  // 步骤2: 访问权限
  const renderStep2 = () => {
    return (
      <div>
        <Form.Item
          label="访问期限"
          name="accessPeriod"
          rules={[{ required: true, message: '请选择访问期限' }]}
        >
          <RangePicker
            style={{ width: '100%' }}
            format="YYYY-MM-DD"
            disabledDate={(current) => current && current < dayjs().startOf('day')}
            placeholder={['开始日期', '结束日期']}
          />
        </Form.Item>

        <Form.Item
          label="访问范围"
          name="accessScope"
          rules={[{ required: true, message: '请选择访问范围' }]}
          tooltip="全字段将授予对所有列的访问权限,部分字段需要指定具体的列"
        >
          <Select
            placeholder="请选择访问范围"
            options={[
              { label: '全字段', value: 'full' },
              { label: '部分字段', value: 'partial' },
            ]}
          />
        </Form.Item>

        {accessScope === 'partial' && (
          <Form.Item
            label="指定字段"
            name="specificColumns"
            rules={[{ required: true, message: '请至少选择一个字段' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择需要访问的字段"
              options={availableColumns.map((col) => ({ label: col, value: col }))}
              maxTagCount="responsive"
            />
          </Form.Item>
        )}

        <Form.Item
          label="数据量级"
          name="dataVolume"
          rules={[{ required: true, message: '请选择数据量级' }]}
          tooltip="预估您需要访问的数据量,以便我们分配合适的资源配额"
        >
          <Select
            placeholder="请选择预期数据量级"
            options={[
              { label: '小量级 (< 10万条)', value: 'small' },
              { label: '中量级 (10万 - 100万条)', value: 'medium' },
              { label: '大量级 (> 100万条)', value: 'large' },
            ]}
          />
        </Form.Item>
      </div>
    );
  };

  // 步骤3: 确认提交
  const renderStep3 = () => {
    const formValues = form.getFieldsValue();

    return (
      <div>
        <Alert
          message="请确认您的申请信息"
          description="提交后将发送给审批人,请仔细核对申请内容是否准确无误"
          type="success"
          showIcon
          style={{ marginBottom: '24px' }}
        />

        <Card title="申请信息摘要" size="small" style={{ marginBottom: '24px' }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div>
              <Text type="secondary">申请资产:</Text> <Text strong>{assetName}</Text>
            </div>
            <Divider style={{ margin: '12px 0' }} />
            <div>
              <Text type="secondary">申请用途:</Text> <Text>{formValues.purpose}</Text>
            </div>
            <div>
              <Text type="secondary">访问范围:</Text>{' '}
              <Text>{formValues.accessScope === 'full' ? '全字段' : '部分字段'}</Text>
            </div>
            {formValues.accessPeriod && (
              <div>
                <Text type="secondary">访问期限:</Text>{' '}
                <Text>
                  {formValues.accessPeriod[0]?.format('YYYY-MM-DD')} 至{' '}
                  {formValues.accessPeriod[1]?.format('YYYY-MM-DD')}
                </Text>
              </div>
            )}
          </Space>
        </Card>

        <Form.Item
          label="紧急程度"
          name="urgencyLevel"
          rules={[{ required: true, message: '请选择紧急程度' }]}
        >
          <Select
            placeholder="请选择紧急程度"
            options={[
              { label: '低 - 1周内', value: 'low' },
              { label: '正常 - 3个工作日', value: 'normal' },
              { label: '高 - 1个工作日', value: 'high' },
              { label: '紧急 - 当日处理', value: 'urgent' },
            ]}
          />
        </Form.Item>

        <Form.Item label="补充说明" name="additionalInfo">
          <TextArea
            rows={3}
            placeholder="如有其他需要说明的信息,请在此处填写..."
            showCount
            maxLength={200}
          />
        </Form.Item>
      </div>
    );
  };

  return (
    <Modal
      title={`申请访问 - ${assetName}`}
      open={visible}
      onCancel={handleReset}
      width={800}
      footer={null}
      destroyOnClose
    >
      <div style={{ marginTop: '24px' }}>
        <Steps current={currentStep} items={steps} style={{ marginBottom: '32px' }} />

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            accessScope: 'full',
            urgencyLevel: 'normal',
            dataVolume: 'medium',
          }}
        >
          <div style={{ minHeight: '400px' }}>
            <div style={{ display: currentStep === 0 ? 'block' : 'none' }}>
              {renderStep1()}
            </div>
            <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
              {renderStep2()}
            </div>
            <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
              {renderStep3()}
            </div>
          </div>

          <Divider />

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              {currentStep > 0 && (
                <Button onClick={handlePrev} disabled={loading}>
                  上一步
                </Button>
              )}
            </div>

            <Space>
              <Button onClick={handleReset} disabled={loading}>
                取消
              </Button>
              {currentStep < steps.length - 1 && (
                <Button type="primary" onClick={handleNext}>
                  下一步
                </Button>
              )}
              {currentStep === steps.length - 1 && (
                <Button type="primary" onClick={handleSubmit} loading={loading}>
                  提交申请
                </Button>
              )}
            </Space>
          </div>
        </Form>
      </div>
    </Modal>
  );
};

export default ApplicationForm;
