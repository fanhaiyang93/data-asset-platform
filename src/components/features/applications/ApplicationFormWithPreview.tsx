'use client'

import { useState } from 'react'
import { ApplicationForm } from './ApplicationForm'
import { ApplicationPreview } from './ApplicationPreview'
import { StepIndicator } from './StepIndicator'
import { ApplicationFormData } from '@/lib/schemas/application'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { toast } from 'sonner'

interface ApplicationFormWithPreviewProps {
  assetId: string
  assetName?: string
  onSubmit: (data: ApplicationFormData) => Promise<void>
  onSaveDraft?: (data: Partial<ApplicationFormData>) => Promise<void>
  initialData?: Partial<ApplicationFormData>
  className?: string
}

export function ApplicationFormWithPreview({
  assetId,
  assetName,
  onSubmit,
  onSaveDraft,
  initialData,
  className
}: ApplicationFormWithPreviewProps) {
  const [currentStep, setCurrentStep] = useState<'form' | 'preview'>('form')
  const [formData, setFormData] = useState<ApplicationFormData | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 处理表单提交 - 进入预览模式
  const handleFormSubmit = (data: ApplicationFormData) => {
    setFormData(data)
    setCurrentStep('preview')
  }

  // 处理返回编辑
  const handleEdit = () => {
    setCurrentStep('form')
  }

  // 处理最终确认提交
  const handleConfirmSubmit = async () => {
    if (!formData) return

    setIsSubmitting(true)
    try {
      await onSubmit(formData)
      toast.success('申请提交成功', {
        description: '您的申请已提交，系统将生成申请编号并通知管理员审核',
      })
    } catch (error) {
      console.error('提交申请失败:', error)
      toast.error('申请提交失败', {
        description: error instanceof Error ? error.message : '请检查网络连接或稍后重试',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // 错误处理回调
  const handleError = (error: Error) => {
    console.error('ApplicationFormWithPreview error:', error)
    toast.error('页面出现错误', {
      description: '请刷新页面或联系技术支持',
    })
  }

  return (
    <ErrorBoundary onError={handleError}>
      <div className={className}>
        {/* 步骤指示器 */}
        <StepIndicator
          currentStep={currentStep}
          className="mb-6"
        />

        {/* 根据当前步骤渲染对应组件 */}
        {currentStep === 'preview' && formData ? (
          <ErrorBoundary onError={handleError}>
            <ApplicationPreview
              data={formData}
              assetName={assetName}
              onEdit={handleEdit}
              onConfirm={handleConfirmSubmit}
              loading={isSubmitting}
            />
          </ErrorBoundary>
        ) : (
          <ErrorBoundary onError={handleError}>
            <ApplicationForm
              assetId={assetId}
              onSubmit={handleFormSubmit}
              onSaveDraft={onSaveDraft}
              initialData={initialData || formData}
            />
          </ErrorBoundary>
        )}
      </div>
    </ErrorBoundary>
  )
}