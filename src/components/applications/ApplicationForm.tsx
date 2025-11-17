import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Typography,
  Space,
  Card,
  Alert,
  Steps,
  Divider,
  Row,
  Col,
  App,
} from 'antd';
import {
  FileTextOutlined,
  ClockCircleOutlined,
  BulbOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { themeColors } from '@/theme';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { Step } = Steps;

export interface AssetInfo {
  id: string;
  title: string;
  category: string;
  owner: string;
}

export interface ApplicationFormData {
  /** 申请理由 */
  reason: string;
  /** 使用期限 */
  duration: string;
  /** 数据用途 */
  purpose: string;
  /** 联系方式 */
  contact: string;
  /** 申请人姓名（可选） */
  applicantName?: string;
  /** 部门信息（可选） */
  department?: string;
}

export interface ApplicationFormProps {
  /** 是否显示模态框 */
  visible: boolean;
  /** 资产信息 */
  assetInfo: AssetInfo;
  /** 关闭回调 */
  onCancel: () => void;
  /** 提交回调 */
  onSubmit: (formData: ApplicationFormData) => Promise<{ success: boolean; applicationId?: string; error?: string }>;
  /** 是否处于提交中状态 */
  loading?: boolean;
  /** 预填充的表单数据 */
  initialValues?: Partial<ApplicationFormData>;
  /** 自定义类名 */
  className?: string;
}

// 使用期限选项
const durationOptions = [
  { value: '1month', label: '1个月', description: '适用于短期分析项目' },
  { value: '3months', label: '3个月', description: '适用于季度业务需求' },
  { value: '6months', label: '6个月', description: '适用于半年度项目' },
  { value: 'longterm', label: '长期使用', description: '适用于日常业务运营' },
];

// 数据用途选项
const purposeOptions = [
  { value: 'reporting', label: '报表分析', description: '用于生成业务报表和数据分析' },
  { value: 'decision', label: '业务决策', description: '支持管理层业务决策制定' },
  { value: 'compliance', label: '合规审计', description: '满足法规要求和审计需求' },
  { value: 'research', label: '数据研究', description: '用于数据挖掘和研究分析' },
  { value: 'other', label: '其他用途', description: '请在申请理由中详细说明' },
];

// 申请理由模板
const reasonTemplates = {
  reporting: '需要使用该数据资产生成定期业务报表，支持部门日常运营决策。预计使用频率为每周一次，主要用于分析业务指标和趋势。',
  decision: '为支持重要业务决策制定，需要访问该数据资产进行深入分析。将结合其他数据源，为管理层提供全面的决策依据。',
  compliance: '根据合规要求，需要定期审查该数据资产的相关信息。将严格按照数据保护规范使用，确保信息安全和合规性。',
  research: '计划开展专项数据研究，需要访问该数据资产进行分析建模。研究结果将用于优化业务流程和提升效率。',
};

/**
 * ApplicationForm - 申请表单组件
 *
 * 数据资产申请的专用表单，作为模态框展示
 * 遵循UX设计规范中的单页申请流程设计
 *
 * 特性：
 * - 三步流程：填写信息 → 确认预览 → 提交成功
 * - 智能建议：基于用途提供申请理由模板
 * - 实时验证：表单字段失焦时即时验证
 * - 状态保存：意外关闭时保留填写内容
 * - 无障碍支持：完整的标签和键盘导航
 */
export const ApplicationForm: React.FC<ApplicationFormProps> = ({
  visible,
  assetInfo,
  onCancel,
  onSubmit,
  loading = false,
  initialValues = {},
  className = '',
}) => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<ApplicationFormData | null>(null);
  const [characterCount, setCharacterCount] = useState(0);
  const [selectedPurpose, setSelectedPurpose] = useState<string>('');

  // 从localStorage恢复表单数据
  useEffect(() => {
    if (visible) {
      const savedData = localStorage.getItem(`application_draft_${assetInfo.id}`);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          form.setFieldsValue({ ...initialValues, ...parsed });
          setCharacterCount(parsed.reason?.length || 0);
          setSelectedPurpose(parsed.purpose || '');
        } catch (error) {
          console.warn('Failed to restore form data:', error);
        }
      } else {
        form.setFieldsValue(initialValues);
      }
    }
  }, [visible, assetInfo.id, form, initialValues]);

  // 自动保存表单数据
  const saveFormData = () => {
    const values = form.getFieldsValue();
    localStorage.setItem(`application_draft_${assetInfo.id}`, JSON.stringify(values));
  };

  // 处理申请理由变化
  const handleReasonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setCharacterCount(value.length);
    saveFormData();
  };

  // 使用模板填充申请理由
  const useReasonTemplate = (purpose: string) => {
    const template = reasonTemplates[purpose as keyof typeof reasonTemplates];
    if (template) {
      form.setFieldValue('reason', template);
      setCharacterCount(template.length);
      message.success('已填充申请理由模板，请根据实际情况调整');
    }
  };

  // 处理用途变化
  const handlePurposeChange = (value: string) => {
    setSelectedPurpose(value);
    saveFormData();
  };

  // 下一步
  const handleNext = async () => {
    try {
      const values = await form.validateFields();
      setFormData(values);
      setCurrentStep(1);
    } catch (error) {
      message.error('请完善表单信息');
    }
  };

  // 上一步
  const handlePrev = () => {
    setCurrentStep(0);
  };

  // 提交申请
  const handleSubmit = async () => {
    if (!formData) return;

    try {
      const result = await onSubmit(formData);
      if (result.success) {
        setCurrentStep(2);
        // 清除草稿数据
        localStorage.removeItem(`application_draft_${assetInfo.id}`);
        message.success('申请提交成功！');
      } else {
        message.error(result.error || '申请提交失败，请重试');
      }
    } catch (error) {
      message.error('申请提交失败，请检查网络连接');
    }
  };

  // 关闭模态框
  const handleCancel = () => {
    if (currentStep === 0) {
      saveFormData(); // 保存草稿
    }
    setCurrentStep(0);
    setFormData(null);
    onCancel();
  };

  // 完成申请
  const handleComplete = () => {
    setCurrentStep(0);
    setFormData(null);
    onCancel();
  };

  return (
    <Modal
      title={null}
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={800}
      className={`application-form-modal ${className}`}
      destroyOnClose={true}
      style={{ top: 50 }}
      bodyStyle={{ padding: 0 }}
    >
      <div style={{ padding: '32px' }}>
        {/* 步骤指示器 */}
        <Steps
          current={currentStep}
          style={{ marginBottom: '32px' }}
          items={[
            {
              title: '填写申请',
              icon: <FileTextOutlined />,
            },
            {
              title: '确认信息',
              icon: <ExclamationCircleOutlined />,
            },
            {
              title: '提交成功',
              icon: <CheckCircleOutlined />,
            },
          ]}
        />

        {/* 资产信息卡片 */}
        <Card
          size="small"
          style={{
            marginBottom: '24px',
            backgroundColor: '#fafafa',
            border: '1px solid #e8e8e8',
          }}
        >
          <Row align="middle">
            <Col flex="auto">
              <Space direction="vertical" size={0}>
                <Text strong style={{ fontSize: '16px' }}>
                  {assetInfo.title}
                </Text>
                <Space size="small">
                  <Text type="secondary">分类：{assetInfo.category}</Text>
                  <Divider type="vertical" />
                  <Text type="secondary">负责人：{assetInfo.owner}</Text>
                </Space>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 步骤内容 */}
        {currentStep === 0 && (
          <Form
            form={form}
            layout="vertical"
            onValuesChange={saveFormData}
            style={{ marginBottom: '24px' }}
          >
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  label={
                    <Space>
                      <FileTextOutlined />
                      <Text strong>申请理由</Text>
                      <Text type="secondary">(必填，最少20字)</Text>
                    </Space>
                  }
                  name="reason"
                  rules={[
                    { required: true, message: '请输入申请理由' },
                    { min: 20, message: '申请理由至少需要20个字符' },
                    { max: 500, message: '申请理由不能超过500个字符' },
                  ]}
                >
                  <TextArea
                    rows={4}
                    placeholder="请详细说明申请该数据资产的具体理由和用途..."
                    onChange={handleReasonChange}
                    showCount={{
                      formatter: ({ count, maxLength }) => (
                        <Text
                          type={count < 20 ? 'danger' : count > 500 ? 'danger' : 'secondary'}
                          style={{ fontSize: '12px' }}
                        >
                          {count}/500 (最少20字)
                        </Text>
                      ),
                    }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label={
                    <Space>
                      <ClockCircleOutlined />
                      <Text strong>使用期限</Text>
                    </Space>
                  }
                  name="duration"
                  rules={[{ required: true, message: '请选择使用期限' }]}
                >
                  <Select
                    placeholder="请选择使用期限"
                    optionLabelProp="label"
                  >
                    {durationOptions.map(option => (
                      <Option key={option.value} value={option.value} label={option.label}>
                        <div>
                          <Text strong>{option.label}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {option.description}
                          </Text>
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  label={
                    <Space>
                      <BulbOutlined />
                      <Text strong>数据用途</Text>
                    </Space>
                  }
                  name="purpose"
                  rules={[{ required: true, message: '请选择数据用途' }]}
                >
                  <Select
                    placeholder="请选择数据用途"
                    optionLabelProp="label"
                    onChange={handlePurposeChange}
                  >
                    {purposeOptions.map(option => (
                      <Option key={option.value} value={option.value} label={option.label}>
                        <div>
                          <Text strong>{option.label}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {option.description}
                          </Text>
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {/* 智能建议 */}
            {selectedPurpose && reasonTemplates[selectedPurpose as keyof typeof reasonTemplates] && (
              <Alert
                message="智能建议"
                description={
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Text>我们为您准备了申请理由模板，点击下方按钮可自动填充：</Text>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => useReasonTemplate(selectedPurpose)}
                      style={{ padding: 0 }}
                    >
                      使用 "{purposeOptions.find(p => p.value === selectedPurpose)?.label}" 理由模板
                    </Button>
                  </Space>
                }
                type="info"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            )}

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label={
                    <Space>
                      <UserOutlined />
                      <Text strong>联系方式</Text>
                    </Space>
                  }
                  name="contact"
                  rules={[
                    { required: true, message: '请输入联系方式' },
                    { pattern: /^[\w.-]+@[\w.-]+\.\w+$/, message: '请输入有效的邮箱地址' },
                  ]}
                  initialValue={initialValues.contact}
                >
                  <Input placeholder="请输入邮箱地址" />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  label={<Text strong>申请人姓名</Text>}
                  name="applicantName"
                  initialValue={initialValues.applicantName}
                >
                  <Input placeholder="请输入申请人姓名（可选）" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label={<Text strong>部门信息</Text>}
              name="department"
              initialValue={initialValues.department}
            >
              <Input placeholder="请输入所在部门（可选）" />
            </Form.Item>
          </Form>
        )}

        {/* 确认预览 */}
        {currentStep === 1 && formData && (
          <div style={{ marginBottom: '24px' }}>
            <Title level={4} style={{ marginBottom: '16px' }}>
              请确认申请信息
            </Title>
            <Card>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div>
                  <Text strong>申请理由：</Text>
                  <Paragraph style={{ marginTop: '8px', marginBottom: 0 }}>
                    {formData.reason}
                  </Paragraph>
                </div>
                <Row gutter={32}>
                  <Col span={12}>
                    <Text strong>使用期限：</Text>
                    <br />
                    <Text>
                      {durationOptions.find(d => d.value === formData.duration)?.label}
                    </Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>数据用途：</Text>
                    <br />
                    <Text>
                      {purposeOptions.find(p => p.value === formData.purpose)?.label}
                    </Text>
                  </Col>
                </Row>
                <Row gutter={32}>
                  <Col span={12}>
                    <Text strong>联系方式：</Text>
                    <br />
                    <Text>{formData.contact}</Text>
                  </Col>
                  {formData.applicantName && (
                    <Col span={12}>
                      <Text strong>申请人：</Text>
                      <br />
                      <Text>{formData.applicantName}</Text>
                    </Col>
                  )}
                </Row>
                {formData.department && (
                  <div>
                    <Text strong>部门：</Text>
                    <br />
                    <Text>{formData.department}</Text>
                  </div>
                )}
              </Space>
            </Card>
          </div>
        )}

        {/* 提交成功 */}
        {currentStep === 2 && (
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <CheckCircleOutlined
              style={{
                fontSize: '64px',
                color: themeColors.success,
                marginBottom: '16px',
              }}
            />
            <Title level={3} style={{ color: themeColors.success }}>
              申请提交成功！
            </Title>
            <Paragraph style={{ fontSize: '16px', marginBottom: '24px' }}>
              您的申请已成功提交，申请ID将通过邮件发送给您。
              <br />
              后续可在"我的申请"页面查看审批进度。
            </Paragraph>
          </div>
        )}

        {/* 底部操作按钮 */}
        <div style={{ textAlign: 'right' }}>
          {currentStep === 0 && (
            <Space>
              <Button onClick={handleCancel}>取消</Button>
              <Button type="primary" onClick={handleNext}>
                下一步
              </Button>
            </Space>
          )}

          {currentStep === 1 && (
            <Space>
              <Button onClick={handlePrev}>上一步</Button>
              <Button type="primary" onClick={handleSubmit} loading={loading}>
                提交申请
              </Button>
            </Space>
          )}

          {currentStep === 2 && (
            <Button type="primary" onClick={handleComplete}>
              完成
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ApplicationForm;