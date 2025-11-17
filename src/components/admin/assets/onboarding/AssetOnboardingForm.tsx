'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Save, ArrowLeft, ArrowRight, Eye, Check, AlertTriangle } from 'lucide-react'
import { AssetFormData, FormStep, FormState, ValidationResult } from '@/types/assetOnboarding'
import { AdminButton } from '@/components/admin/ui/AdminButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { assetOnboardingService } from '@/lib/services/assetOnboarding'
import { NotificationService } from '@/lib/services/notificationService'
import { cn } from '@/lib/utils'
import { trpc } from '@/lib/trpc-client'

interface AssetOnboardingFormProps {
  onSubmit?: (data: AssetFormData) => Promise<void>
  onCancel?: () => void
  defaultValues?: Partial<AssetFormData>
}

const FORM_STEPS: { key: FormStep; label: string; description: string }[] = [
  {
    key: FormStep.TEMPLATE_SELECTION,
    label: '选择模板',
    description: '选择资产类型和预设模板'
  },
  {
    key: FormStep.BASIC_INFO,
    label: '基本信息',
    description: '输入资产名称、描述等基本信息'
  },
  {
    key: FormStep.SCHEMA_DEFINITION,
    label: '表结构',
    description: '定义字段结构和约束'
  },
  {
    key: FormStep.METADATA,
    label: '元数据',
    description: '设置数据源、更新频率等元数据'
  },
  {
    key: FormStep.PREVIEW,
    label: '预览确认',
    description: '预览资产信息并确认'
  }
]

export function AssetOnboardingForm({
  onSubmit,
  onCancel,
  defaultValues
}: AssetOnboardingFormProps) {
  const router = useRouter()
  const [formState, setFormState] = useState<FormState>({
    currentStep: FormStep.TEMPLATE_SELECTION,
    completedSteps: [],
    data: defaultValues || {},
    validationErrors: {},
    isDirty: false,
    isSaving: false
  })

  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: false,
    errors: [],
    warnings: []
  })

  // 使用 tRPC mutation 创建资产
  const createAssetMutation = trpc.assets.createAsset.useMutation()

  // 加载草稿
  useEffect(() => {
    const loadDraft = async () => {
      if (!defaultValues) {
        const draft = await assetOnboardingService.loadDraft()
        if (draft) {
          setFormState(prev => ({
            ...prev,
            data: draft,
            isDirty: true
          }))
          NotificationService.info('已加载草稿', '检测到未完成的资产录入，已自动恢复')
        }
      }
    }

    loadDraft()
  }, [defaultValues])

  // 自动保存草稿
  useEffect(() => {
    if (formState.isDirty && !formState.isSaving) {
      const saveTimeout = setTimeout(() => {
        assetOnboardingService.saveDraft(formState.data)
      }, 2000)

      return () => clearTimeout(saveTimeout)
    }
  }, [formState.data, formState.isDirty, formState.isSaving])

  // 验证当前步骤
  const validateCurrentStep = useCallback(async () => {
    const result = await assetOnboardingService.validateAssetData(formState.data)
    setValidationResult(result)

    // 检查当前步骤的必填字段
    const stepErrors: Record<string, string[]> = {}

    switch (formState.currentStep) {
      case FormStep.BASIC_INFO:
        if (!formState.data.name) {
          stepErrors.name = ['资产名称不能为空']
        }
        if (!formState.data.description) {
          stepErrors.description = ['资产描述不能为空']
        }
        if (!formState.data.categoryId) {
          stepErrors.categoryId = ['请选择资产分类']
        }
        if (!formState.data.ownerId) {
          stepErrors.ownerId = ['请选择资产负责人']
        }
        break
      case FormStep.SCHEMA_DEFINITION:
        if (!formState.data.schema?.tableName) {
          stepErrors.tableName = ['表名不能为空']
        }
        if (!formState.data.schema?.fields?.length) {
          stepErrors.fields = ['至少需要定义一个字段']
        }
        break
      case FormStep.METADATA:
        if (!formState.data.metadata?.dataSource) {
          stepErrors.dataSource = ['请选择数据源类型']
        }
        if (!formState.data.metadata?.updateFrequency) {
          stepErrors.updateFrequency = ['请选择更新频率']
        }
        if (!formState.data.metadata?.sensitivityLevel) {
          stepErrors.sensitivityLevel = ['请选择敏感级别']
        }
        break
    }

    setFormState(prev => ({
      ...prev,
      validationErrors: stepErrors
    }))

    return Object.keys(stepErrors).length === 0
  }, [formState.currentStep, formState.data])

  // 下一步
  const nextStep = async () => {
    const isValid = await validateCurrentStep()
    if (!isValid) {
      NotificationService.warning('验证失败', '请检查表单中的错误并修正')
      return
    }

    const currentIndex = FORM_STEPS.findIndex(step => step.key === formState.currentStep)
    if (currentIndex < FORM_STEPS.length - 1) {
      const nextStep = FORM_STEPS[currentIndex + 1].key
      setFormState(prev => ({
        ...prev,
        currentStep: nextStep,
        completedSteps: [...prev.completedSteps, prev.currentStep]
      }))
    }
  }

  // 上一步
  const prevStep = () => {
    const currentIndex = FORM_STEPS.findIndex(step => step.key === formState.currentStep)
    if (currentIndex > 0) {
      const prevStep = FORM_STEPS[currentIndex - 1].key
      setFormState(prev => ({
        ...prev,
        currentStep: prevStep
      }))
    }
  }

  // 提交表单
  const handleSubmit = async () => {
    try {
      setFormState(prev => ({ ...prev, isSaving: true }))

      const result = await assetOnboardingService.validateAssetData(formState.data)
      if (!result.isValid) {
        NotificationService.error('验证失败', '资产数据验证失败，请检查所有必填字段')
        return
      }

      if (onSubmit) {
        await onSubmit(formState.data as AssetFormData)
      } else {
        // 使用 tRPC API 创建资产
        // 将 AssetFormData 转换为 CreateAssetInput 格式
        const createInput = {
          name: formState.data.name || '',
          description: formState.data.description || '',
          code: formState.data.code || `ASSET_${Date.now()}`, // 如果没有code,生成一个默认的
          categoryId: formState.data.categoryId || '',
          status: 'DRAFT' as const, // 新建资产默认为草稿状态
          type: formState.data.assetType || 'table',
          databaseName: formState.data.schema?.databaseName || formState.data.metadata?.dataSource,
          tableName: formState.data.schema?.tableName,
          tags: formState.data.metadata?.tags?.join(',')
        }

        await createAssetMutation.mutateAsync(createInput)

        // 清除草稿
        assetOnboardingService.clearDraft()

        NotificationService.success('创建成功', '数据资产已成功创建')
        router.push('/admin/assets')
      }
    } catch (error) {
      console.error('Submit failed:', error)
      NotificationService.error('提交失败', error instanceof Error ? error.message : '未知错误')
    } finally {
      setFormState(prev => ({ ...prev, isSaving: false }))
    }
  }

  // 取消操作
  const handleCancel = () => {
    if (formState.isDirty) {
      const confirmed = window.confirm('当前表单有未保存的修改，确定要离开吗？')
      if (!confirmed) return
    }

    if (onCancel) {
      onCancel()
    } else {
      router.push('/admin/assets')
    }
  }

  // 更新表单数据
  const updateFormData = (updates: Partial<AssetFormData>) => {
    setFormState(prev => ({
      ...prev,
      data: { ...prev.data, ...updates },
      isDirty: true
    }))
  }

  // 渲染步骤指示器
  const renderStepIndicator = () => {
    return (
      <div className="flex items-center justify-between mb-8">
        {FORM_STEPS.map((step, index) => {
          const isCompleted = formState.completedSteps.includes(step.key)
          const isCurrent = formState.currentStep === step.key
          const isAccessible = isCompleted || isCurrent || index === 0

          return (
            <div
              key={step.key}
              className="flex items-center"
            >
              <div className="flex items-center">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                    isCompleted && "bg-green-500 text-white",
                    isCurrent && !isCompleted && "bg-blue-500 text-white",
                    !isCompleted && !isCurrent && isAccessible && "bg-gray-200 text-gray-700",
                    !isAccessible && "bg-gray-100 text-gray-400"
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <div className="ml-3">
                  <div className={cn(
                    "text-sm font-medium",
                    isCurrent && "text-blue-600",
                    isCompleted && "text-green-600",
                    !isCompleted && !isCurrent && "text-gray-500"
                  )}>
                    {step.label}
                  </div>
                  <div className="text-xs text-gray-400">{step.description}</div>
                </div>
              </div>

              {index < FORM_STEPS.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-4 min-w-[50px]",
                    isCompleted ? "bg-green-500" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // 渲染基本信息表单
  const renderBasicInfoForm = () => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="name">
              资产名称 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formState.data.name || ''}
              onChange={(e) => updateFormData({ name: e.target.value })}
              placeholder="请输入资产名称"
              className={formState.validationErrors.name ? 'border-red-500' : ''}
            />
            {formState.validationErrors.name && (
              <p className="text-sm text-red-600">{formState.validationErrors.name[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">显示名称</Label>
            <Input
              id="displayName"
              value={formState.data.displayName || ''}
              onChange={(e) => updateFormData({ displayName: e.target.value })}
              placeholder="资产的友好显示名称"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">
            资产描述 <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="description"
            value={formState.data.description || ''}
            onChange={(e) => updateFormData({ description: e.target.value })}
            placeholder="请详细描述该资产的用途、包含的数据内容等"
            rows={4}
            className={formState.validationErrors.description ? 'border-red-500' : ''}
          />
          {formState.validationErrors.description && (
            <p className="text-sm text-red-600">{formState.validationErrors.description[0]}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="categoryId">
              资产分类 <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formState.data.categoryId || ''}
              onValueChange={(value) => updateFormData({ categoryId: value })}
            >
              <SelectTrigger className={formState.validationErrors.categoryId ? 'border-red-500' : ''}>
                <SelectValue placeholder="请选择资产分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user_data">用户数据</SelectItem>
                <SelectItem value="business_data">业务数据</SelectItem>
                <SelectItem value="system_data">系统数据</SelectItem>
                <SelectItem value="external_data">外部数据</SelectItem>
              </SelectContent>
            </Select>
            {formState.validationErrors.categoryId && (
              <p className="text-sm text-red-600">{formState.validationErrors.categoryId[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerId">
              资产负责人 <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formState.data.ownerId || ''}
              onValueChange={(value) => updateFormData({ ownerId: value })}
            >
              <SelectTrigger className={formState.validationErrors.ownerId ? 'border-red-500' : ''}>
                <SelectValue placeholder="请选择负责人" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user1">张三 (数据工程师)</SelectItem>
                <SelectItem value="user2">李四 (产品经理)</SelectItem>
                <SelectItem value="user3">王五 (系统架构师)</SelectItem>
              </SelectContent>
            </Select>
            {formState.validationErrors.ownerId && (
              <p className="text-sm text-red-600">{formState.validationErrors.ownerId[0]}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 渲染当前步骤内容
  const renderStepContent = () => {
    switch (formState.currentStep) {
      case FormStep.TEMPLATE_SELECTION:
        return (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium mb-4">选择资产模板</h3>
            <p className="text-gray-500 mb-8">选择合适的模板可以快速创建标准化的资产结构</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="cursor-pointer hover:shadow-md" onClick={() => nextStep()}>
                <CardHeader>
                  <CardTitle className="text-sm">业务表模板</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-500">标准业务表结构</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md" onClick={() => nextStep()}>
                <CardHeader>
                  <CardTitle className="text-sm">维度表模板</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-500">数据仓库维度表</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md" onClick={() => nextStep()}>
                <CardHeader>
                  <CardTitle className="text-sm">自定义</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-500">从头开始创建</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )

      case FormStep.BASIC_INFO:
        return renderBasicInfoForm()

      case FormStep.SCHEMA_DEFINITION:
        return (
          <div className="space-y-6">
            <div className="text-center py-8">
              <h3 className="text-lg font-medium mb-2">表结构定义</h3>
              <p className="text-gray-500">定义资产的字段结构和约束条件</p>
            </div>
            {/* 这里应该有表结构编辑器，暂时用简单提示 */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <p className="text-gray-500">表结构编辑器将在后续任务中实现</p>
            </div>
          </div>
        )

      case FormStep.METADATA:
        return (
          <div className="space-y-6">
            <div className="text-center py-4">
              <h3 className="text-lg font-medium mb-2">元数据配置</h3>
              <p className="text-gray-500">设置数据源、更新频率等关键元数据</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>数据源类型 <span className="text-red-500">*</span></Label>
                <Select
                  value={formState.data.metadata?.dataSource || ''}
                  onValueChange={(value) => updateFormData({
                    metadata: {
                      ...formState.data.metadata,
                      dataSource: value as any
                    }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择数据源" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="postgresql">PostgreSQL</SelectItem>
                    <SelectItem value="hive">Hive</SelectItem>
                    <SelectItem value="clickhouse">ClickHouse</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>更新频率 <span className="text-red-500">*</span></Label>
                <Select
                  value={formState.data.metadata?.updateFrequency || ''}
                  onValueChange={(value) => updateFormData({
                    metadata: {
                      ...formState.data.metadata,
                      updateFrequency: value as any
                    }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择更新频率" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">实时</SelectItem>
                    <SelectItem value="daily">每日</SelectItem>
                    <SelectItem value="weekly">每周</SelectItem>
                    <SelectItem value="monthly">每月</SelectItem>
                    <SelectItem value="manual">手动</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>敏感级别 <span className="text-red-500">*</span></Label>
                <Select
                  value={formState.data.metadata?.sensitivityLevel || ''}
                  onValueChange={(value) => updateFormData({
                    metadata: {
                      ...formState.data.metadata,
                      sensitivityLevel: value as any
                    }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择敏感级别" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">公开</SelectItem>
                    <SelectItem value="internal">内部</SelectItem>
                    <SelectItem value="confidential">机密</SelectItem>
                    <SelectItem value="restricted">限制</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )

      case FormStep.PREVIEW:
        return (
          <div className="space-y-6">
            <div className="text-center py-4">
              <h3 className="text-lg font-medium mb-2">预览确认</h3>
              <p className="text-gray-500">请确认资产信息无误后提交</p>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">基本信息</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500">资产名称：</span>
                      <span className="font-medium">{formState.data.name}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">显示名称：</span>
                      <span>{formState.data.displayName || '-'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm text-gray-500">描述：</span>
                      <p className="mt-1 text-sm">{formState.data.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {formState.data.metadata && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">元数据信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-gray-500">数据源：</span>
                        <Badge>{formState.data.metadata.dataSource}</Badge>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">更新频率：</span>
                        <Badge>{formState.data.metadata.updateFrequency}</Badge>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">敏感级别：</span>
                        <Badge variant={
                          formState.data.metadata.sensitivityLevel === 'restricted' ? 'destructive' :
                          formState.data.metadata.sensitivityLevel === 'confidential' ? 'secondary' : 'default'
                        }>
                          {formState.data.metadata.sensitivityLevel}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {validationResult.warnings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mr-2" />
                      注意事项
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {validationResult.warnings.map((warning, index) => (
                        <li key={index} className="text-sm text-yellow-600">
                          • {warning.message}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )

      default:
        return <div>步骤内容</div>
    }
  }

  const currentStepIndex = FORM_STEPS.findIndex(step => step.key === formState.currentStep)
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === FORM_STEPS.length - 1

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">新增数据资产</h1>
          <div className="flex items-center space-x-2">
            {formState.isDirty && (
              <Badge variant="secondary" className="flex items-center">
                <Save className="h-3 w-3 mr-1" />
                已自动保存
              </Badge>
            )}
          </div>
        </div>
      </div>

      {renderStepIndicator()}

      <Card>
        <CardContent className="p-6">
          {renderStepContent()}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mt-6">
        <AdminButton
          variant="outline"
          onClick={isFirstStep ? handleCancel : prevStep}
          disabled={formState.isSaving}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {isFirstStep ? '取消' : '上一步'}
        </AdminButton>

        <div className="flex items-center space-x-3">
          {validationResult.errors.length > 0 && (
            <span className="text-sm text-red-600">
              {validationResult.errors.length} 个错误需要修正
            </span>
          )}

          <AdminButton
            onClick={isLastStep ? handleSubmit : nextStep}
            loading={formState.isSaving}
            disabled={formState.isSaving}
          >
            {isLastStep ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                创建资产
              </>
            ) : (
              <>
                下一步
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </AdminButton>
        </div>
      </div>
    </div>
  )
}